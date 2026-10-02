import { AnalyticsSkeleton } from '../components/Skeleton'
import { useState, useEffect } from 'react'
import {
  txApi,
  budgetsApi,
  CategorySummary,
  MonthlyStats,
  BudgetWithSpent
} from '../api/client'
import {
  formatCurrency,
  thisMonth,
  CATEGORIES,
  CATEGORY_ICONS,
  ACCOUNT_COLORS
} from '../components/utils'
import Modal from '../components/Modal'
import ProgressBar from '../components/ProgressBar'
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
  Users,
  Lock,
  Globe,
  Coins
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
  const [householdShares, setHouseholdShares] = useState<Array<{ user_id: string; user_name: string; total: number }>>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // 預算設定 Modal
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [selectedCat, setSelectedCat] = useState('餐飲')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [submittingBudget, setSubmittingBudget] = useState(false)

  const loadData = async (month: string, currentScope: 'all' | 'household' | 'personal') => {
    try {
      setLoading(true)
      setLoadError(null)
      const [sum, mStats, buds, shares] = await Promise.all([
        txApi.summary(month, currentScope),
        txApi.monthly(undefined, currentScope),
        budgetsApi.list(month),
        txApi.householdShares(month),
      ])
      setCatSummary(sum)
      setMonthlyStats(mStats)
      setBudgets(buds)
      setHouseholdShares(shares)
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
        month: currentMonth,
      })
      setShowBudgetModal(false)
      setBudgetAmount('')
      loadData(currentMonth, scope)
    } catch (err: any) {
      alert(err.message || '預算設定失敗')
    } finally {
      setSubmittingBudget(false)
    }
  }

  const openBudgetDialog = (cat: string, existingAmount?: number) => {
    setSelectedCat(cat)
    setBudgetAmount(existingAmount ? existingAmount.toString() : '5000')
    setShowBudgetModal(true)
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
            <span>⚠️ <strong>統計資料載入失敗</strong>：{loadError}</span>
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
          <h1 className="page-title">統計與分析 📊</h1>
          <p className="page-subtitle">深入洞悉消費佔比、長期收支走勢與嚴格把關年度預算</p>
        </div>

        <div className="flex items-center gap-sm">
          <Calendar size={16} color="var(--text-secondary)" />
          <input
            className="input"
            style={{ width: 140, padding: '0.4rem 0.6rem' }}
            type="month"
            value={currentMonth}
            onChange={e => setCurrentMonth(e.target.value)}
          />
        </div>
      </div>

      {/* 帳本視角切換器 */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: 4,
        background: 'var(--bg-surface-2)',
        borderRadius: 12,
        border: '1px solid var(--border-color)',
        marginBottom: 20
      }}>
        <button
          type="button"
          className={`btn btn-sm ${scope === 'all' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: 8, padding: '6px 14px', fontSize: '0.85rem' }}
          onClick={() => setScope('all')}
        >
          <Globe size={15} />
          <span>全部</span>
        </button>
        <button
          type="button"
          className={`btn btn-sm ${scope === 'household' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: 8, padding: '6px 14px', fontSize: '0.85rem' }}
          onClick={() => setScope('household')}
        >
          <Users size={15} />
          <span>🏠 公帳</span>
        </button>
        <button
          type="button"
          className={`btn btn-sm ${scope === 'personal' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: 8, padding: '6px 14px', fontSize: '0.85rem' }}
          onClick={() => setScope('personal')}
        >
          <Lock size={15} />
          <span>🔒 私帳</span>
        </button>
      </div>

      {/* 家庭公帳成員分攤與墊付統計 (當有家庭成員分攤數據時顯示) */}
      {(scope === 'household' || scope === 'all') && householdShares.length > 0 && (
        <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, rgba(85,197,149,0.06) 0%, rgba(168,216,234,0.08) 100%)', border: '1px solid var(--border-color)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <h2 className="text-xl flex items-center gap-xs">
              <Coins size={20} color="var(--color-success)" />
              {currentMonth} 家庭成員公帳墊付與分攤統計
            </h2>
            <div className="text-sm">
              當月家庭公帳總額：<strong style={{ color: 'var(--color-danger)' }}>{formatCurrency(totalSharedExpense)}</strong>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {householdShares.map((m, idx) => {
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
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>👤 {m.user_name}</span>
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
              💡 <strong>平分 (AA制) 結算建議</strong>：
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
          <h2 className="text-xl flex items-center gap-xs" style={{ marginBottom: 16 }}>
            <PieIcon size={20} color="var(--color-primary)" />
            {currentMonth} 支出分類佔比 ({scope === 'household' ? '公帳' : scope === 'personal' ? '私帳' : '全部'})
          </h2>

          {pieData.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <div className="emoji">📊</div>
              <h3>此範疇本月尚無支出紀錄</h3>
              <p style={{ fontSize: '0.85rem' }}>記錄交易後，這裡將為您分析各分類消費佔比</p>
            </div>
          ) : (
            <div style={{ height: 260, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12, justifyContent: 'center' }}>
              {catSummary.map((item, idx) => (
                <div key={item.category} className="flex items-center gap-xs" style={{ fontSize: '0.8rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                  <span>{item.category}: {formatCurrency(item.total)}</span>
                </div>
              ))}
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
              <div className="emoji">📈</div>
              <h3>尚無歷史收支數據</h3>
              <p style={{ fontSize: '0.85rem' }}>持續記帳將自動為您繪製年度趨勢</p>
            </div>
          ) : (
            <div style={{ height: 260, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
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

      {/* 年度預算管理模組 */}
      <div className="card">
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <div>
            <h2 className="text-xl flex items-center gap-xs">
              <Sliders size={20} color="var(--color-primary)" />
              {currentMonth} 預算限額把關
            </h2>
            <p className="text-xs text-muted" style={{ marginTop: 2 }}>
              為經常支出設定預算上限，防範在不自覺中超支
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => openBudgetDialog(CATEGORIES.expense[0])}>
            設定新預算
          </button>
        </div>

        {/* 分類預算進度清單 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {CATEGORIES.expense.map(cat => {
            const b = budgets.find(bg => bg.category === cat)
            const spent = catSummary.find(cs => cs.category === cat)?.total || 0
            const amount = b?.amount || 0
            const hasBudget = !!b && amount > 0
            const isOver = hasBudget && spent > amount

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
                <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                  <div className="flex items-center gap-sm">
                    <span style={{ fontSize: '1.2rem' }}>{CATEGORY_ICONS[cat] || '🏷️'}</span>
                    <span style={{ fontWeight: 600 }}>{cat}</span>
                    {isOver && (
                      <span className="badge badge-expense flex items-center gap-xs">
                        <AlertTriangle size={12} /> 超支 {formatCurrency(spent - amount)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-md">
                    <div style={{ textAlign: 'right', fontSize: '0.875rem' }}>
                      已花 <strong>{formatCurrency(spent)}</strong>
                      {hasBudget ? (
                        <span className="text-muted"> / 預算 {formatCurrency(amount)}</span>
                      ) : (
                        <span className="text-muted"> (未設定預算)</span>
                      )}
                    </div>

                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                      onClick={() => openBudgetDialog(cat, amount)}
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
        <Modal title={`設定 ${selectedCat} 的預算`} onClose={() => setShowBudgetModal(false)} maxWidth={400}>
          <form onSubmit={handleSaveBudget} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="input-group">
              <label className="input-label">支出類別</label>
              <select
                className="input"
                value={selectedCat}
                onChange={e => setSelectedCat(e.target.value)}
              >
                {CATEGORIES.expense.map(c => (
                  <option key={c} value={c}>{CATEGORY_ICONS[c] || ''} {c}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">{currentMonth} 預算上限 (NT$)</label>
              <input
                className="input"
                type="number"
                step="1"
                min="1"
                placeholder="例如 8000"
                required
                autoFocus
                value={budgetAmount}
                onChange={e => setBudgetAmount(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={submittingBudget}
              style={{ marginTop: 8 }}
            >
              {submittingBudget ? '儲存中...' : '確認儲存設定'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
