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
  PieChart as PieIcon,
  BarChart2,
  TrendingUp,
  Sliders,
  AlertTriangle,
  Calendar,
  CheckCircle2
} from 'lucide-react'

const PIE_COLORS = [
  '#FF8A8A', '#FFB347', '#FFD4A0', '#55C595',
  '#A8D8EA', '#95E1D3', '#F38181', '#B2BEC3'
]

export default function Analytics() {
  const [currentMonth, setCurrentMonth] = useState(thisMonth())
  const [catSummary, setCatSummary] = useState<CategorySummary[]>([])
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([])
  const [budgets, setBudgets] = useState<BudgetWithSpent[]>([])
  const [loading, setLoading] = useState(true)

  // 預算設定 Modal
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [selectedCat, setSelectedCat] = useState('餐飲')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [submittingBudget, setSubmittingBudget] = useState(false)

  const loadData = async (month: string) => {
    try {
      setLoading(true)
      const [sum, mStats, buds] = await Promise.all([
        txApi.summary(month).catch(() => []),
        txApi.monthly().catch(() => []),
        budgetsApi.list(month).catch(() => []),
      ])
      setCatSummary(sum)
      setMonthlyStats(mStats)
      setBudgets(buds)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(currentMonth)
  }, [currentMonth])

  // 處理 12 月收支柱狀圖資料結構整理
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

  // 預算 upsert
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
      loadData(currentMonth)
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

  return (
    <div className="fade-in">
      {/* 標題與月份切換 */}
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">統計與預算 📊</h1>
          <p className="page-subtitle">分類花費占比、長期收支走勢分析，與嚴格的月度預算監控</p>
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

      {/* 圖表兩欄：左側圓餅圖 (分類占比) + 右側最近月收支柱狀圖 */}
      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        {/* 本月分類占比 */}
        <div className="card">
          <h2 className="text-xl flex items-center gap-xs" style={{ marginBottom: 16 }}>
            <PieIcon size={20} color="var(--color-primary)" />
            {currentMonth} 支出分類占比
          </h2>

          {pieData.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <div className="emoji">🍰</div>
              <h3>本月尚無支出記錄</h3>
              <p style={{ fontSize: '0.85rem' }}>記錄交易後，這裡將呈現各分類花費佔比</p>
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

        {/* 最近收支對比柱狀圖 */}
        <div className="card">
          <h2 className="text-xl flex items-center gap-xs" style={{ marginBottom: 16 }}>
            <BarChart2 size={20} color="var(--color-success)" />
            收支趨勢對比 (月度)
          </h2>

          {monthlyChartData.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <div className="emoji">📊</div>
              <h3>尚無歷史收支數據</h3>
              <p style={{ fontSize: '0.85rem' }}>持續記帳將自動為您繪製月度趨勢</p>
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

      {/* 月度預算管理模組 */}
      <div className="card">
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <div>
            <h2 className="text-xl flex items-center gap-xs">
              <Sliders size={20} color="var(--color-primary)" />
              {currentMonth} 分類預算管理
            </h2>
            <p className="text-xs text-muted" style={{ marginTop: 2 }}>
              為各日常支出設定金額上限，防範不知不覺中超支
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
                    <span style={{ fontSize: '1.2rem' }}>{CATEGORY_ICONS[cat] || '📦'}</span>
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
        <Modal title={`設定 ${selectedCat} 月預算`} onClose={() => setShowBudgetModal(false)} maxWidth={400}>
          <form onSubmit={handleSaveBudget} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="input-group">
              <label className="input-label">支出分類</label>
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
                step="500"
                min="100"
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
              {submittingBudget ? '儲存中…' : '確認預算設定'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
