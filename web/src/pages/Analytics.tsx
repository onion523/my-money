import { AnalyticsSkeleton } from '../components/Skeleton'
import { useState, useEffect, useRef } from 'react'
import {
  txApi,
  CategorySummary,
  MonthlyStats,
} from '../api/client'
import {
  formatCurrency,
  thisMonth,
} from '../components/utils'
import ProgressBar from '../components/ProgressBar'
import ScopeTabBar from '../components/ScopeTabBar'
import FormulaTooltip from '../components/FormulaTooltip'
import {
  BarChart,
  Bar,
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
  Calendar,
  Coins,
  User,
  Lightbulb,
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
  const [householdShares, setHouseholdShares] = useState<Array<{ user_id: string; user_name: string; total: number }>>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 640 : false)
  const loadedMonthSharesRef = useRef<string | null>(null)
  const loadedYearScopeRef = useRef<string | null>(null)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const loadData = async (month: string, currentScope: 'all' | 'household' | 'personal') => {
    try {
      setLoading(true)
      setLoadError(null)
      const year = month.slice(0, 4)
      const yearScopeKey = `${year}:${currentScope}`
      const needMonthShares = loadedMonthSharesRef.current !== month
      const needYearScopeData = loadedYearScopeRef.current !== yearScopeKey

      const [sum, mStats, shares] = await Promise.all([
        txApi.summary(month, currentScope),
        needYearScopeData ? txApi.monthly(year, currentScope) : Promise.resolve(null),
        needMonthShares ? txApi.householdShares(month) : Promise.resolve(null),
      ])
      setCatSummary(sum)
      if (mStats !== null) {
        setMonthlyStats(mStats)
        loadedYearScopeRef.current = yearScopeKey
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
          <p className="page-subtitle">深入洞悉消費分類佔比、家庭成員公帳分攤與長期收支走勢</p>
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
                    background: 'var(--bg-surface)',
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
                    {pieData.map((_, index) => (
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
    </div>
  )
}
