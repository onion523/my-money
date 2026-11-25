import { AnalyticsSkeleton } from '../components/Skeleton'
import { useState, useEffect, useRef } from 'react'
import {
  txApi,
  budgetsApi,
  TOTAL_BUDGET_CATEGORY,
  CategorySummary,
  MonthlyStats,
  BudgetWithSpent,
  BudgetSummary
} from '../api/client'
import {
  formatCurrency,
  thisMonth,
  CATEGORIES,
  ACCOUNT_COLORS
} from '../components/utils'
import { CategoryIcon } from '../components/icons'
import Modal from '../components/Modal'
import ProgressBar from '../components/ProgressBar'
import ScopeTabBar from '../components/ScopeTabBar'
import FormulaTooltip from '../components/FormulaTooltip'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import {
  AlertCircle,
  PieChart as PieIcon,
  BarChart2,
  TrendingUp,
  Sliders,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Coins,
  User,
  Lightbulb,
  Home,
  Lock,
  Trash2,
  RefreshCw,
} from 'lucide-react'

const PIE_COLORS = [
  '#FF8A8A', // 櫻粉 (餐飲)
  '#3B82F6', // 湛藍 (交通)
  '#F59E0B', // 琥珀澄 (汽機車輛)
  '#10B981', // 翡翠綠 (居家水電)
  '#8B5CF6', // 紫羅蘭 (數位訂閱)
  '#EC4899', // 亮桃粉 (購物)
  '#6EE7B7', // 薄荷綠 (生活)
  '#F43F5E', // 玫瑰紅 (娛樂)
  '#FB7185', // 珊瑚粉 (美妝保養)
  '#14B8A6', // 青碧綠 (醫療)
  '#6366F1', // 靛青藍 (教育)
  '#F97316', // 暖橘 (寵物毛孩)
  '#06B6D4', // 湖水青 (旅行度假)
  '#E11D48', // 胭脂紅 (社交人情)
  '#64748B', // 岩灰藍 (保險稅費)
  '#94A3B8', // 石墨灰 (其他)
]

export default function Analytics() {
  const [currentMonth, setCurrentMonth] = useState(thisMonth())
  const [scope, setScope] = useState<'all' | 'household' | 'personal'>('all')
  const [catSummary, setCatSummary] = useState<CategorySummary[]>([])
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([])
  const [budgets, setBudgets] = useState<BudgetWithSpent[]>([])
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null)
  const [householdShares, setHouseholdShares] = useState<Array<{ user_id: string; user_name: string; total: number }>>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 640 : false)
  const loadedMonthScopeRef = useRef<string | null>(null)
  const loadedMonthSharesRef = useRef<string | null>(null)
  const loadedYearScopeRef = useRef<string | null>(null)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 預算設定 Modal
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [selectedCat, setSelectedCat] = useState<string>('餐飲')
  const [budgetIsShared, setBudgetIsShared] = useState<0 | 1>(0)
  const [budgetAmount, setBudgetAmount] = useState('')
  const [submittingBudget, setSubmittingBudget] = useState(false)

  const loadData = async (month: string, currentScope: 'all' | 'household' | 'personal', forceBudgets = false) => {
    try {
      setLoading(true)
      setLoadError(null)
      const year = month.slice(0, 4)
      const yearScopeKey = `${year}:${currentScope}`
      const monthScopeKey = `${month}:${currentScope}`
      const needMonthScopeData = forceBudgets || loadedMonthScopeRef.current !== monthScopeKey
      const needMonthShares = forceBudgets || loadedMonthSharesRef.current !== month
      const needYearScopeData = loadedYearScopeRef.current !== yearScopeKey

      const [sum, mStats, budsRes, shares] = await Promise.all([
        txApi.summary(month, currentScope),
        needYearScopeData ? txApi.monthly(year, currentScope) : Promise.resolve(null),
        needMonthScopeData ? budgetsApi.listWithSummary(month, currentScope) : Promise.resolve(null),
        needMonthShares ? txApi.householdShares(month) : Promise.resolve(null),
      ])
      setCatSummary(sum)
      if (mStats !== null) {
        setMonthlyStats(mStats)
        loadedYearScopeRef.current = yearScopeKey
      }
      if (budsRes !== null) {
        setBudgets(budsRes.items)
        setBudgetSummary(budsRes.summary)
        loadedMonthScopeRef.current = monthScopeKey
      }
      if (shares !== null) {
        setHouseholdShares(shares)
        loadedMonthSharesRef.current = month
      }
    } catch (e: any) {
      console.error('Failed to load analytics data:', e)
      setLoadError(e.message || '統計資料載入失敗，請檢查連線')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(currentMonth, scope)
  }, [currentMonth, scope])

  // 近 12 月收支柱狀圖資料結構整理
  const monthlyChartMap: Record<string, { month: string; income: number; expense: number }> = {}
  monthlyStats.forEach(st => {
    if (!monthlyChartMap[st.month]) {
      monthlyChartMap[st.month] = { month: st.month, income: 0, expense: 0 }
    }
    if (st.type === 'income') monthlyChartMap[st.month].income = st.total
    if (st.type === 'expense') monthlyChartMap[st.month].expense = st.total
  })
  const monthlyChartData = Object.values(monthlyChartMap).sort((a, b) => a.month.localeCompare(b.month))

  // 圓餅圖資料
  const pieData = catSummary.map(c => ({
    name: c.category,
    value: c.total,
  }))

  const totalExpense = catSummary.reduce((s, c) => s + c.total, 0)
  const totalSharedExpense = householdShares.reduce((s, m) => s + m.total, 0)

  const getExistingLayerBudgetAmount = (cat: string, isShared: 0 | 1): number => {
    if (cat === TOTAL_BUDGET_CATEGORY) {
      if (!budgetSummary) return 0
      return isShared === 1
        ? (budgetSummary.shared_manual_total_budget || 0)
        : (budgetSummary.personal_manual_total_budget || 0)
    }
    const b = budgets.find(bg => bg.category === cat)
    if (!b) return 0
    if (scope === 'household') return isShared === 1 ? b.amount : (b.personal_amount || 0)
    if (scope === 'personal') return isShared === 0 ? b.amount : (b.shared_amount || 0)
    return isShared === 1 ? (b.shared_amount ?? 0) : (b.personal_amount ?? 0)
  }

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(budgetAmount)
    if (isNaN(amt) || amt <= 0) {
      alert('請輸入有效預算金額')
      return
    }

    try {
      setSubmittingBudget(true)
      await budgetsApi.upsert({
        category: selectedCat,
        amount: amt,
        month: 'default',
        is_shared: budgetIsShared,
      })
      setShowBudgetModal(false)
      setBudgetAmount('')
      loadData(currentMonth, scope, true)
    } catch (err: any) {
      alert(err.message || '預算設定失敗')
    } finally {
      setSubmittingBudget(false)
    }
  }

  const handleClearBudget = async () => {
    try {
      setSubmittingBudget(true)
      await budgetsApi.remove(selectedCat, budgetIsShared)
      setShowBudgetModal(false)
      setBudgetAmount('')
      loadData(currentMonth, scope, true)
    } catch (err: any) {
      alert(err.message || '清除預算失敗')
    } finally {
      setSubmittingBudget(false)
    }
  }

  const openBudgetDialog = (cat: string, preferredIsShared?: 0 | 1) => {
    const defaultLayer: 0 | 1 =
      preferredIsShared !== undefined
        ? preferredIsShared
        : scope === 'household'
        ? 1
        : 0
    setSelectedCat(cat)
    setBudgetIsShared(defaultLayer)
    const existingAmt = getExistingLayerBudgetAmount(cat, defaultLayer)
    setBudgetAmount(existingAmt > 0 ? existingAmt.toString() : (cat === TOTAL_BUDGET_CATEGORY ? '30000' : '5000'))
    setShowBudgetModal(true)
  }

  const handleSwitchBudgetLayer = (nextLayer: 0 | 1) => {
    setBudgetIsShared(nextLayer)
    const existingAmt = getExistingLayerBudgetAmount(selectedCat, nextLayer)
    setBudgetAmount(existingAmt > 0 ? existingAmt.toString() : (selectedCat === TOTAL_BUDGET_CATEGORY ? '30000' : '5000'))
  }

  const handleSwitchBudgetCategory = (nextCat: string) => {
    setSelectedCat(nextCat)
    const existingAmt = getExistingLayerBudgetAmount(nextCat, budgetIsShared)
    setBudgetAmount(existingAmt > 0 ? existingAmt.toString() : (nextCat === TOTAL_BUDGET_CATEGORY ? '30000' : '5000'))
  }

  if (loading && !catSummary.length && !monthlyStats.length) {
    return <AnalyticsSkeleton />
  }

  return (
    <div className="fade-in">
      {loadError && (
        <div className="alert alert-danger flex items-center justify-between" style={{ marginBottom: 20 }}>
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <span><strong>統計資料載入失敗</strong>：{loadError}</span>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => loadData(currentMonth, scope)}
            style={{ padding: '4px 12px', fontSize: '0.85rem' }}
          >
            重新嘗試
          </button>
        </div>
      )}
      {/* 標題與月份切換 */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>統計與分析</span>
            <PieIcon size={24} style={{ color: 'var(--color-primary)' }} />
          </h1>
          <p className="page-subtitle">深入洞悉消費佔比、長期收支走勢與嚴格把關年度預算</p>
        </div>

        <div className="header-actions flex items-center gap-sm">
          <Calendar size={16} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
          <input
            className="input analytics-month-input"
            type="month"
            value={currentMonth}
            onChange={e => setCurrentMonth(e.target.value)}
          />
        </div>
      </div>

      {/* 帳本視角切換器 */}
      <div style={{ marginBottom: 20 }}>
        <ScopeTabBar scope={scope} onChange={setScope} />
      </div>

      {/* 家庭公帳成員分攤與墊付統計 (當有家庭成員分攤數據時顯示) */}
      {(scope === 'household' || scope === 'all') && householdShares.length > 0 && (
        <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, rgba(85,197,149,0.06) 0%, rgba(168,216,234,0.08) 100%)', border: '1px solid var(--border-color)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <h2 className="text-xl flex items-center gap-xs">
              <Coins size={20} color="var(--color-success)" />
              {currentMonth} 家庭成員公帳墊付與分攤統計
            </h2>
            <div className="text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span>當月家庭公帳總額：<strong style={{ color: 'var(--color-danger)' }}>{formatCurrency(totalSharedExpense)}</strong></span>
              <FormulaTooltip
                label="檢視當月家庭公帳總額與分攤計算公式"
                formula="公帳總額 ＝ ∑ 各成員本月紀錄之公帳支出；個人佔比 ＝ 成員公帳支出 ÷ 當月家庭公帳總額 × 100%"
                calculation={`${householdShares.map(m => `${m.user_name} ${formatCurrency(m.total)}`).join(' + ')} = ${formatCurrency(totalSharedExpense)}`}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {householdShares.map((m) => {
              const pct = totalSharedExpense > 0 ? ((m.total / totalSharedExpense) * 100).toFixed(1) : '0'
              return (
                <div
                  key={m.user_id}
                  style={{
                    padding: '14px 18px',
                    borderRadius: 12,
                    background: 'var(--surface-color, #ffffff)',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <User size={14} /> {m.user_name}
                    </span>
                    <span className="badge badge-safe" style={{ fontSize: '0.75rem' }}>{pct}%</span>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                    {formatCurrency(m.total)}
                  </div>
                  <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                    已墊付本月家庭公帳 {pct}%
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <ProgressBar value={m.total} max={totalSharedExpense || 1} height={6} />
                  </div>
                </div>
              )
            })}
          </div>

          {householdShares.length === 2 && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,212,160,0.15)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <Lightbulb size={15} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              <strong>平分 (AA制) 結算建議</strong>：
              若採兩人均攤，平均每人應負擔 {formatCurrency(Math.round(totalSharedExpense / 2))}。
              {householdShares[0].total !== householdShares[1].total && (
                <span>
                  【{householdShares[1].user_name}】可轉帳 <strong>{formatCurrency(Math.abs(Math.round((householdShares[0].total - householdShares[1].total) / 2)))}</strong> 給【{householdShares[0].user_name}】完成結算。
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 圖表區：左圓餅圖 (類別佔比) + 右側近期收支走勢 */}
      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        {/* 類別佔比圓餅圖 */}
        <div className="card">
          <div className="flex items-center justify-between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 6 }}>
            <h2 className="text-xl flex items-center gap-xs">
              <PieIcon size={20} color="var(--color-primary)" />
              {currentMonth} 支出分類佔比 ({scope === 'household' ? '公帳' : scope === 'personal' ? '私帳' : '全部'})
            </h2>
            <span className="text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
              <span>總支出：<strong style={{ color: 'var(--color-danger)' }}>{formatCurrency(totalExpense)}</strong></span>
              <FormulaTooltip
                label="檢視本月分類總支出與佔比計算公式"
                formula="本月總支出 ＝ ∑ 各消費分類金額（排除內部轉帳、ATM 提款、信用卡還款與代墊報銷）；分類佔比 ＝ 該類金額 ÷ 本月總支出 × 100%"
                calculation={
                  catSummary.length > 0
                    ? `${catSummary.map(c => `${c.category} ${formatCurrency(c.total)}`).join(' + ')} = ${formatCurrency(totalExpense)}`
                    : `0 筆支出 = ${formatCurrency(0)}`
                }
              />
            </span>
          </div>

          {pieData.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <div className="emoji"><PieIcon size={40} /></div>
              <h3>此範疇本月尚無支出紀錄</h3>
              <p style={{ fontSize: '0.85rem' }}>記錄收支後，這裡將為您分析各分類消費佔比</p>
            </div>
          ) : (
            <div style={{ height: 260, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={isMobile ? 45 : 55}
                    outerRadius={isMobile ? 75 : 90}
                    paddingAngle={3}
                    dataKey="value"
                    label={isMobile ? false : ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={!isMobile}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {pieData.length > 0 && (
            <div className="analytics-pie-legend">
              {catSummary.map((item, idx) => {
                const pct = totalExpense > 0 ? ((item.total / totalExpense) * 100).toFixed(1) : '0'
                return (
                  <div key={item.category} className="flex items-center justify-between gap-xs" style={{ fontSize: '0.82rem' }}>
                    <div className="flex items-center gap-xs" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                      <span style={{ fontWeight: 500 }}>{item.category}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{pct}%</span>
                    </div>
                    <span style={{ fontWeight: 600, flexShrink: 0 }}>{formatCurrency(item.total)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 近期收支對比柱狀圖 */}
        <div className="card">
          <h2 className="text-xl flex items-center gap-xs" style={{ marginBottom: 16 }}>
            <BarChart2 size={20} color="var(--color-success)" />
            收支趨勢對比 (年度)
          </h2>

          {monthlyChartData.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <div className="emoji"><TrendingUp size={40} /></div>
              <h3>尚無歷史收支數據</h3>
              <p style={{ fontSize: '0.85rem' }}>持續記帳將自動為您繪製年度趨勢</p>
            </div>
          ) : (
            <div style={{ height: 260, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis
                    dataKey="month"
                    stroke="var(--text-muted)"
                    fontSize={isMobile ? 11 : 12}
                    minTickGap={10}
                    tickFormatter={(v: string) => isMobile && v.includes('-') ? `${parseInt(v.split('-')[1], 10)}月` : v}
                  />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={(val: number) => formatCurrency(val)} />
                  <Legend />
                  <Bar dataKey="income" name="收入" fill="#55C595" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="支出" fill="#FF8A8A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* 預算管理模組 (ADR-0046：三態常駐預算與智慧每月總預算) */}
      <div className="card">
        <div className="flex items-center justify-between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 className="text-xl flex items-center gap-xs">
              <Sliders size={20} color="var(--color-primary)" />
              {currentMonth} 預算限額把關 ({scope === 'household' ? '公帳' : scope === 'personal' ? '私帳' : '全部'})
            </h2>
            <p className="text-xs text-muted" style={{ marginTop: 2 }}>
              設定一次即作為每月常駐預設自動跨月沿用，區分公私帳並自動彙算每月有效總預算
            </p>
          </div>
          <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => openBudgetDialog(TOTAL_BUDGET_CATEGORY)}
            >
              設定每月總預算
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => openBudgetDialog(CATEGORIES.expense[0])}
            >
              設定分類預算
            </button>
          </div>
        </div>

        {/* 每月總預算進度總覽卡 */}
        {(() => {
          const effTotal = budgetSummary?.effective_total_budget ?? budgets.reduce((s, b) => s + (b.amount || 0), 0)
          const manualTotal = budgetSummary?.manual_total_budget ?? 0
          const catSum = budgetSummary?.category_budget_sum ?? budgets.reduce((s, b) => s + (b.amount || 0), 0)
          const spentTotal = budgetSummary?.total_spent ?? totalExpense
          const remTotal = Math.max(0, effTotal - spentTotal)
          const isOverTotal = effTotal > 0 && spentTotal > effTotal
          const isWarnTotal = effTotal > 0 && !isOverTotal && spentTotal / effTotal >= 0.8
          const pctTotal = effTotal > 0 ? Math.round((spentTotal / effTotal) * 100) : 0

          return (
            <div
              style={{
                padding: 18,
                borderRadius: 'var(--radius-md)',
                marginBottom: 20,
                background: isOverTotal
                  ? 'rgba(255, 107, 107, 0.08)'
                  : isWarnTotal
                  ? 'rgba(247, 185, 85, 0.1)'
                  : 'var(--bg-surface-2)',
                border: `1.5px solid ${
                  isOverTotal
                    ? 'var(--color-danger)'
                    : isWarnTotal
                    ? 'var(--color-warning)'
                    : 'var(--border-color)'
                }`,
              }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                    每月有效總預算 ({scope === 'household' ? '公帳' : scope === 'personal' ? '私帳' : '全部'})
                  </span>
                  <FormulaTooltip
                    label="檢視每月有效總預算與剩餘額度計算公式"
                    formula="每月有效總預算 ＝ max(手動設定每月總預算, ∑ 已設定各分類預算總和)；當月剩餘可花費 ＝ max(0, 每月有效總預算 － 當月日常消費總支出)"
                    calculation={`max(手動總預算 ${formatCurrency(manualTotal)}, 分類加總 ${formatCurrency(catSum)}) = 有效總預算 ${formatCurrency(effTotal)}；已花 ${formatCurrency(spentTotal)} → ${isOverTotal ? `超支 ${formatCurrency(spentTotal - effTotal)}` : `剩餘可花 ${formatCurrency(remTotal)}`}`}
                  />
                  {effTotal > 0 && (
                    <span
                      className={`badge ${isOverTotal ? 'badge-expense' : 'badge-secondary'}`}
                      style={{ fontSize: '0.72rem' }}
                    >
                      {manualTotal >= catSum && manualTotal > 0 ? '依手動總預算上限' : '依分類預算加總'} · 已用 {pctTotal}%
                    </span>
                  )}
                  {isOverTotal && (
                    <span className="badge badge-expense flex items-center gap-xs">
                      <AlertTriangle size={12} /> 總預算超支 {formatCurrency(spentTotal - effTotal)}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ border: '1px solid var(--border-color)', fontSize: '0.78rem' }}
                  onClick={() => openBudgetDialog(TOTAL_BUDGET_CATEGORY)}
                >
                  {manualTotal > 0 ? '調整總預算' : '+ 設定總預算'}
                </button>
              </div>

              <div className="grid grid-3" style={{ gap: 12, marginBottom: 12 }}>
                <div>
                  <div className="text-xs text-muted">當月日常消費已花</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: isOverTotal ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                    {formatCurrency(spentTotal)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">每月有效總預算</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                    {effTotal > 0 ? formatCurrency(effTotal) : '未設定'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">{isOverTotal ? '本月已超支' : '本月剩餘可花費'}</div>
                  <div
                    style={{
                      fontSize: '1.2rem',
                      fontWeight: 700,
                      fontFamily: 'var(--font-display)',
                      color: isOverTotal
                        ? 'var(--color-danger)'
                        : effTotal > 0
                        ? 'var(--color-success)'
                        : 'var(--text-muted)',
                    }}
                  >
                    {effTotal > 0
                      ? isOverTotal
                        ? `-${formatCurrency(spentTotal - effTotal)}`
                        : formatCurrency(remTotal)
                      : '—'}
                  </div>
                </div>
              </div>

              {effTotal > 0 ? (
                <ProgressBar
                  value={spentTotal}
                  max={effTotal}
                  variant={isOverTotal ? 'over' : isWarnTotal ? 'default' : 'safe'}
                  height={10}
                />
              ) : (
                <div className="text-xs text-muted">
                  尚未設定任何總預算或分類預算。點擊右上角「+ 設定總預算」或下方各分類「+ 設定」，系統將自動跨月常駐把關並於真實可支配現金預留當月剩餘預算。
                </div>
              )}
            </div>
          )
        })()}

        {/* 分類預算進度清單 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {CATEGORIES.expense.map(cat => {
            const b = budgets.find(bg => bg.category === cat)
            const spent = b ? b.spent : (catSummary.find(cs => cs.category === cat)?.total || 0)
            const amount = b?.amount || 0
            const hasBudget = !!b && amount > 0
            const isOver = hasBudget && spent > amount
            const personalAmt = b?.personal_amount || 0
            const sharedAmt = b?.shared_amount || 0

            return (
              <div
                key={cat}
                style={{
                  padding: 14,
                  borderRadius: 'var(--radius-md)',
                  background: isOver ? 'rgba(255,107,107,0.06)' : 'var(--bg-surface-2)',
                  border: isOver ? '1px solid var(--color-danger)' : '1px solid var(--border-color)',
                }}
              >
                <div className="budget-item-header">
                  <div className="flex items-center gap-sm" style={{ flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'rgba(255,138,138,0.12)', color: 'var(--color-primary)', flexShrink: 0 }}>
                      <CategoryIcon category={cat} size={16} />
                    </span>
                    <span style={{ fontWeight: 600 }}>{cat}</span>
                    {hasBudget && (
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.68rem',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-color)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <RefreshCw size={10} /> 常駐每月
                      </span>
                    )}
                    {scope === 'all' && hasBudget && (
                      <>
                        {sharedAmt > 0 && (
                          <span className="badge badge-primary" style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Home size={10} /> 公帳 {formatCurrency(sharedAmt)}
                          </span>
                        )}
                        {personalAmt > 0 && (
                          <span className="badge badge-secondary" style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Lock size={10} /> 私帳 {formatCurrency(personalAmt)}
                          </span>
                        )}
                      </>
                    )}
                    {isOver && (
                      <span className="badge badge-expense flex items-center gap-xs">
                        <AlertTriangle size={12} /> 超支 {formatCurrency(spent - amount)}
                      </span>
                    )}
                  </div>

                  <div className="budget-item-meta">
                    <div className="budget-item-amounts">
                      已花 <strong>{formatCurrency(spent)}</strong>
                      {hasBudget ? (
                        <span className="text-muted">
                          {' '}/ 預算 {formatCurrency(amount)}（{isOver ? `超支 ${formatCurrency(spent - amount)}` : `剩餘 ${formatCurrency(amount - spent)}`}）
                        </span>
                      ) : (
                        <span className="text-muted"> (未設定預算)</span>
                      )}
                    </div>

                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '0.78rem', padding: '4px 10px', flexShrink: 0 }}
                      onClick={() =>
                        openBudgetDialog(
                          cat,
                          scope === 'household' ? 1 : scope === 'personal' ? 0 : (sharedAmt > 0 && personalAmt === 0 ? 1 : 0)
                        )
                      }
                    >
                      {hasBudget ? '調整' : '+ 設定'}
                    </button>
                  </div>
                </div>

                {hasBudget ? (
                  <ProgressBar
                    value={spent}
                    max={amount}
                    variant={isOver ? 'over' : (spent / amount >= 0.8 ? 'default' : 'safe')}
                    height={8}
                  />
                ) : (
                  <div style={{ height: 6, background: 'var(--border-color)', borderRadius: 9999, opacity: 0.5 }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 預算設定彈窗 */}
      {showBudgetModal && (
        <Modal
          title={selectedCat === TOTAL_BUDGET_CATEGORY ? '設定每月總預算上限' : `設定「${selectedCat}」每月常駐預算`}
          onClose={() => setShowBudgetModal(false)}
          maxWidth={440}
        >
          <form onSubmit={handleSaveBudget} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 預算項目選擇 */}
            <div className="input-group">
              <label className="input-label">預算項目</label>
              <select
                className="input"
                value={selectedCat}
                onChange={e => handleSwitchBudgetCategory(e.target.value)}
              >
                <option value={TOTAL_BUDGET_CATEGORY}>每月總預算上限（全分類總和把關）</option>
                {CATEGORIES.expense.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* 帳本歸屬選擇 (私帳 / 公帳) */}
            <div className="input-group">
              <label className="input-label">預算歸屬</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  className={`btn ${budgetIsShared === 0 ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    border: budgetIsShared === 0 ? 'none' : '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  onClick={() => handleSwitchBudgetLayer(0)}
                >
                  <Lock size={14} />
                  <span>私帳預算</span>
                </button>
                <button
                  type="button"
                  className={`btn ${budgetIsShared === 1 ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    border: budgetIsShared === 1 ? 'none' : '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  onClick={() => handleSwitchBudgetLayer(1)}
                >
                  <Home size={14} />
                  <span>公帳預算</span>
                </button>
              </div>
              <p className="text-xs text-muted" style={{ marginTop: 4 }}>
                {budgetIsShared === 1
                  ? '家庭公帳預算：全體家庭成員共享檢視並協作共管，專門把關家庭公帳日常開銷。'
                  : '個人私帳預算：僅您本人可見，把關個人私帳日常消費；於「全部」視角將與公帳預算自動相加。'}
              </p>
            </div>

            {/* 每月常駐預算金額 */}
            <div className="input-group">
              <label className="input-label">每月常駐預算上限 (NT$)</label>
              <input
                className="input"
                type="number"
                step="1"
                min="1"
                placeholder={selectedCat === TOTAL_BUDGET_CATEGORY ? '例如 30000' : '例如 8000'}
                required
                autoFocus
                value={budgetAmount}
                onChange={e => setBudgetAmount(e.target.value)}
              />
              <span className="text-xs text-muted" style={{ marginTop: 4 }}>
                設定後將作為每月常駐預設值自動跨月沿用，無須每個月重新設定。
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8 }}>
              {getExistingLayerBudgetAmount(selectedCat, budgetIsShared) > 0 && (
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 14px' }}
                  disabled={submittingBudget}
                  onClick={handleClearBudget}
                >
                  <Trash2 size={16} />
                  <span>清除此項預算</span>
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={submittingBudget}
                style={{ flex: 1 }}
              >
                {submittingBudget ? '儲存中...' : '確認儲存常駐預算'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
