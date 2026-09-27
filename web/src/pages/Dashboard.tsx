import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { accountsApi, txApi, recurringApi, goalsApi, budgetsApi, Account, Transaction } from '../api/client'
import { formatCurrency, formatDate, today, CATEGORIES, CATEGORY_ICONS } from '../components/utils'
import Modal from '../components/Modal'
import ProgressBar from '../components/ProgressBar'
import {
  Wallet,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Plus,
  AlertTriangle,
  CreditCard,
  Building,
  Sparkles,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Calendar
} from 'lucide-react'

export default function Dashboard() {
  const { user, balance, setBalance, accounts, setAccounts, transactions, setTransactions } = useStore()
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [budgets, setBudgets] = useState<any[]>([])
  const [recurringList, setRecurringList] = useState<any[]>([])
  const [goalsList, setGoalsList] = useState<any[]>([])
  const navigate = useNavigate()

  // 快速新增表單
  const [form, setForm] = useState({
    account_id: '',
    type: 'expense' as 'expense' | 'income',
    category: '餐飲',
    amount: '',
    note: '',
    date: today(),
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const loadData = async () => {
    try {
      setLoading(true)
      const [bal, accs, txs, buds, rec, g] = await Promise.all([
        accountsApi.balance().catch(() => null),
        accountsApi.list().catch(() => []),
        txApi.list({ limit: '6' }).catch(() => []),
        budgetsApi.list().catch(() => []),
        recurringApi.list().catch(() => []),
        goalsApi.list().catch(() => []),
      ])

      if (bal) setBalance(bal)
      setAccounts(accs)
      setTransactions(txs)
      setBudgets(buds)
      setRecurringList(rec)
      setGoalsList(g)

      if (accs.length > 0 && !form.account_id) {
        setForm(p => ({ ...p, account_id: accs[0].id }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    if (!form.account_id) {
      setSubmitError('請先在「帳戶管理」建立至少一個帳戶')
      return
    }
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt <= 0) {
      setSubmitError('請輸入正確的金額')
      return
    }

    try {
      setSubmitting(true)
      await txApi.create({
        account_id: form.account_id,
        type: form.type,
        category: form.category,
        amount: amt,
        note: form.note.trim(),
        date: form.date,
      })
      setShowAddModal(false)
      setForm(p => ({ ...p, amount: '', note: '', date: today() }))
      loadData()
    } catch (err: any) {
      setSubmitError(err.message || '新增失敗')
    } finally {
      setSubmitting(false)
    }
  }

  // 本月收支計算
  const thisMonthStr = today().slice(0, 7)
  const monthTransactions = transactions.filter(t => t.date?.startsWith(thisMonthStr))
  const monthIncome = monthTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthExpense = monthTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  // 警示預算
  const overBudgets = budgets.filter(b => b.over)

  return (
    <div className="fade-in">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">早安，{user?.name || '朋友'} 🌸</h1>
          <p className="page-subtitle">這是你本月的家庭財務總覽與可用資金狀況</p>
        </div>
        <button
          id="btn-quick-add"
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={18} />
          <span>快速記帳</span>
        </button>
      </div>

      {/* 核心資金卡片區（3欄） */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        {/* 即時可用餘額 */}
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(255,138,138,0.15) 0%, rgba(255,212,160,0.15) 100%)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <span className="stat-label">即時可用餘額</span>
            <div style={{ background: 'var(--color-primary)', color: 'white', padding: 6, borderRadius: '50%' }}>
              <Wallet size={18} />
            </div>
          </div>
          <div className="stat-value" style={{ color: (balance?.available ?? 0) >= 0 ? 'var(--text-primary)' : 'var(--color-danger)' }}>
            {formatCurrency(balance?.available ?? 0)}
          </div>
          <div className="stat-sub">
            銀行 {formatCurrency(balance?.bankTotal ?? 0)} - 信用卡已出帳 {formatCurrency(balance?.ccBilled ?? 0)} - 未出帳 {formatCurrency(balance?.ccUnbilled ?? 0)}
          </div>
        </div>

        {/* 攤提後可自由花用 */}
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(85,197,149,0.15) 0%, rgba(168,216,234,0.15) 100%)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <span className="stat-label">攤提後可自由花用</span>
            <div style={{ background: 'var(--color-success)', color: 'white', padding: 6, borderRadius: '50%' }}>
              <Sparkles size={18} />
            </div>
          </div>
          <div className="stat-value" style={{ color: (balance?.disposable ?? 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatCurrency(balance?.disposable ?? 0)}
          </div>
          <div className="stat-sub">
            扣除固定月攤提 {formatCurrency(balance?.monthlyFixed ?? 0)} 及儲蓄預留 {formatCurrency(balance?.monthlyGoals ?? 0)}
          </div>
        </div>

        {/* 本月收支結餘 */}
        <div className="stat-card">
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <span className="stat-label">本月淨收支</span>
            <div style={{ background: 'var(--color-secondary)', color: '#7a4e00', padding: 6, borderRadius: '50%' }}>
              {monthIncome - monthExpense >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            </div>
          </div>
          <div className="stat-value" style={{ color: monthIncome - monthExpense >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatCurrency(monthIncome - monthExpense)}
          </div>
          <div className="stat-sub flex gap-sm" style={{ marginTop: 6 }}>
            <span style={{ color: 'var(--color-success)' }}>
              ↑ 收入 {formatCurrency(monthIncome)}
            </span>
            <span style={{ color: 'var(--color-danger)' }}>
              ↓ 支出 {formatCurrency(monthExpense)}
            </span>
          </div>
        </div>
      </div>

      {/* 警告區塊（若有預算超支） */}
      {overBudgets.length > 0 && (
        <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--color-danger)', background: 'rgba(255,107,107,0.06)' }}>
          <div className="flex items-center gap-sm">
            <AlertTriangle size={20} color="var(--color-danger)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-danger)' }}>
              本月有 {overBudgets.length} 個分類支出已超過預算！
            </h3>
          </div>
          <div className="flex gap-md" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {overBudgets.map(b => (
              <span key={b.category} className="badge badge-expense">
                {b.category}：已花 {formatCurrency(b.spent)} / 預算 {formatCurrency(b.amount)}（超支 {formatCurrency(b.spent - b.amount)}）
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 主體區塊：左 2/3 (帳戶 + 最近交易) + 右 1/3 (儲蓄目標 + 固定支出速覽) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        <div className="flex-col gap-lg" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* 帳戶一覽 */}
          <div className="card">
            <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
              <h2 className="text-xl flex items-center gap-xs">
                <CreditCard size={20} color="var(--color-primary)" />
                帳戶現況
              </h2>
              <Link to="/accounts" className="btn btn-ghost btn-sm">
                管理帳戶 <ChevronRight size={16} />
              </Link>
            </div>

            {accounts.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="emoji">💳</div>
                <h3>尚未建立帳戶</h3>
                <p style={{ fontSize: '0.875rem', marginBottom: 12 }}>請先新增銀行帳戶或信用卡以開始記帳</p>
                <Link to="/accounts" className="btn btn-primary btn-sm">立即新增</Link>
              </div>
            ) : (
              <div className="grid grid-2">
                {accounts.map(acc => (
                  <div
                    key={acc.id}
                    style={{
                      padding: 14,
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface-2)',
                      border: '1px solid var(--border-color)',
                      borderLeft: `5px solid ${acc.color || 'var(--color-primary)'}`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{acc.name}</span>
                      <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                        {acc.type === 'bank' ? '銀行' : '信用卡'}
                      </span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 6, fontFamily: 'var(--font-display)' }}>
                      {formatCurrency(acc.balance)}
                    </div>
                    {acc.type === 'credit_card' && (
                      <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                        未出帳：{formatCurrency(acc.unbilled || 0)}
                        {acc.payment_due_day ? ` · 繳款日 ${acc.payment_due_day} 號` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 最近交易 */}
          <div className="card">
            <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
              <h2 className="text-xl flex items-center gap-xs">
                <Calendar size={20} color="var(--color-primary)" />
                最近交易記錄
              </h2>
              <Link to="/transactions" className="btn btn-ghost btn-sm">
                查看全部 <ChevronRight size={16} />
              </Link>
            </div>

            {transactions.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="emoji">📝</div>
                <h3>尚無交易記錄</h3>
                <p style={{ fontSize: '0.875rem' }}>點擊右上角「快速記帳」記錄第一筆收支吧！</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {transactions.slice(0, 6).map(tx => (
                  <div key={tx.id} className="transaction-item" onClick={() => navigate('/transactions')}>
                    <div className={`tx-icon ${tx.type}`}>
                      {CATEGORY_ICONS[tx.category] || (tx.type === 'income' ? '💰' : '💸')}
                    </div>
                    <div className="tx-info">
                      <div className="tx-name">
                        {tx.category} {tx.note ? `· ${tx.note}` : ''}
                      </div>
                      <div className="tx-meta">
                        {formatDate(tx.date)} · {tx.account_name || '帳戶'}
                      </div>
                    </div>
                    <div className={`tx-amount ${tx.type}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右側資訊欄 */}
        <div className="flex-col gap-lg" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* 儲蓄目標進度 */}
          <div className="card">
            <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
              <h2 className="text-xl flex items-center gap-xs">
                <PiggyBank size={20} color="var(--color-primary)" />
                儲蓄目標
              </h2>
              <Link to="/goals" className="btn btn-ghost btn-sm">
                查看 <ChevronRight size={16} />
              </Link>
            </div>

            {goalsList.length === 0 ? (
              <div className="text-sm text-muted" style={{ textAlign: 'center', padding: '16px 0' }}>
                還沒有設定儲蓄目標，去設定一個旅行或夢想基金吧！
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {goalsList.slice(0, 3).map(goal => (
                  <div key={goal.id}>
                    <div className="flex items-center justify-between text-sm" style={{ marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>
                        {goal.emoji || '🎯'} {goal.name}
                      </span>
                      <span className="text-muted">
                        {formatCurrency(goal.saved_amount)} / {formatCurrency(goal.target_amount)}
                      </span>
                    </div>
                    <ProgressBar value={goal.saved_amount} max={goal.target_amount} height={6} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 智慧理財提示與即將到期固定收支 */}
          <div className="card" style={{ background: 'var(--bg-surface-2)' }}>
            <h3 className="text-lg flex items-center gap-xs" style={{ marginBottom: 12 }}>
              <Sparkles size={18} color="var(--color-warning)" />
              家庭財務錦囊
            </h3>
            <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingLeft: 18, lineHeight: 1.8 }}>
              <li>
                固定支出每月平均攤提 <strong>{formatCurrency(balance?.monthlyFixed ?? 0)}</strong>，已自動自可用餘額扣除。
              </li>
              <li>
                每月儲蓄目標預留 <strong>{formatCurrency(balance?.monthlyGoals ?? 0)}</strong>，建議專款專用。
              </li>
              <li>
                想評估大額支出？可至「<Link to="/forecast" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>現金流預測</Link>」使用購買力檢查工具！
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 快速記帳彈出視窗 */}
      {showAddModal && (
        <Modal title="快速記帳" onClose={() => setShowAddModal(false)}>
          {submitError && (
            <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid var(--color-danger)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, color: 'var(--color-danger)', fontSize: '0.85rem' }}>
              {submitError}
            </div>
          )}
          <form onSubmit={handleQuickAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 類型切換 (收入/支出) */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`btn btn-full ${form.type === 'expense' ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => setForm(p => ({ ...p, type: 'expense', category: '餐飲' }))}
              >
                支出
              </button>
              <button
                type="button"
                className={`btn btn-full ${form.type === 'income' ? 'btn-primary' : 'btn-secondary'}`}
                style={form.type === 'income' ? { background: 'var(--color-success)' } : {}}
                onClick={() => setForm(p => ({ ...p, type: 'income', category: '薪資' }))}
              >
                收入
              </button>
            </div>

            {/* 金額 */}
            <div className="input-group">
              <label className="input-label">金額 (NT$)</label>
              <input
                id="quick-amount"
                className="input"
                type="number"
                step="1"
                min="1"
                placeholder="例如 150"
                required
                autoFocus
                value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              />
            </div>

            {/* 分類 */}
            <div className="input-group">
              <label className="input-label">分類</label>
              <select
                id="quick-category"
                className="input"
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              >
                {CATEGORIES[form.type].map(cat => (
                  <option key={cat} value={cat}>
                    {CATEGORY_ICONS[cat] || ''} {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* 帳戶選擇 */}
            <div className="input-group">
              <label className="input-label">支付 / 存入帳戶</label>
              <select
                id="quick-account"
                className="input"
                value={form.account_id}
                onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}
                required
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type === 'bank' ? '銀行' : '信用卡'})
                  </option>
                ))}
              </select>
            </div>

            {/* 日期 */}
            <div className="input-group">
              <label className="input-label">日期</label>
              <input
                id="quick-date"
                className="input"
                type="date"
                required
                value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              />
            </div>

            {/* 備註 */}
            <div className="input-group">
              <label className="input-label">備註 (選填)</label>
              <input
                id="quick-note"
                className="input"
                type="text"
                placeholder="例如 午餐便當、買日用品"
                value={form.note}
                onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              />
            </div>

            <button
              id="quick-submit"
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={submitting}
              style={{ marginTop: 8 }}
            >
              {submitting ? '記錄中…' : '確認記錄'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
