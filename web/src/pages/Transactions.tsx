import { useState, useEffect } from 'react'
import { txApi, accountsApi, exportApi, Transaction, Account } from '../api/client'
import { formatCurrency, formatDate, today, thisMonth, CATEGORIES, CATEGORY_ICONS } from '../components/utils'
import Modal from '../components/Modal'
import {
  Plus,
  Filter,
  Download,
  Trash2,
  Edit2,
  Calendar,
  Search,
  ArrowUpDown,
  Tag
} from 'lucide-react'

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  // 篩選狀態
  const [categoryFilter, setCategoryFilter] = useState('全部')
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [startDate, setStartDate] = useState(`${thisMonth()}-01`)
  const [endDate, setEndDate] = useState(today())
  const [keyword, setKeyword] = useState('')

  // Modal 狀態
  const [showModal, setShowModal] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [form, setForm] = useState({
    account_id: '',
    type: 'expense' as 'expense' | 'income',
    category: '餐飲',
    amount: '',
    note: '',
    date: today(),
  })
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // 載入資料
  const loadData = async () => {
    try {
      setLoading(true)
      const [txs, accs] = await Promise.all([
        txApi.list({ from: startDate, to: endDate }),
        accountsApi.list(),
      ])
      setTransactions(txs)
      setAccounts(accs)
      if (accs.length > 0 && !form.account_id) {
        setForm(p => ({ ...p, account_id: accs[0].id }))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [startDate, endDate])

  // 打開新增 Modal
  const handleOpenAdd = () => {
    setEditingTx(null)
    setForm({
      account_id: accounts[0]?.id || '',
      type: 'expense',
      category: '餐飲',
      amount: '',
      note: '',
      date: today(),
    })
    setErrorMsg('')
    setShowModal(true)
  }

  // 打開編輯 Modal
  const handleOpenEdit = (tx: Transaction) => {
    setEditingTx(tx)
    setForm({
      account_id: tx.account_id,
      type: tx.type,
      category: tx.category,
      amount: tx.amount.toString(),
      note: tx.note || '',
      date: tx.date,
    })
    setErrorMsg('')
    setShowModal(true)
  }

  // 提交新增/編輯
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (!form.account_id) {
      setErrorMsg('請先建立或選擇帳戶')
      return
    }
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('請輸入有效金額')
      return
    }

    try {
      setSubmitting(true)
      if (editingTx) {
        await txApi.update(editingTx.id, {
          account_id: form.account_id,
          type: form.type,
          category: form.category,
          amount: amt,
          note: form.note.trim(),
          date: form.date,
        })
      } else {
        await txApi.create({
          account_id: form.account_id,
          type: form.type,
          category: form.category,
          amount: amt,
          note: form.note.trim(),
          date: form.date,
        })
      }
      setShowModal(false)
      loadData()
    } catch (err: any) {
      setErrorMsg(err.message || '儲存失敗')
    } finally {
      setSubmitting(false)
    }
  }

  // 刪除交易
  const handleDelete = async (id: string) => {
    if (!window.confirm('確定要刪除這筆交易記錄嗎？')) return
    try {
      await txApi.remove(id)
      loadData()
    } catch (err: any) {
      alert(err.message || '刪除失敗')
    }
  }

  // 匯出 CSV
  const handleExportCSV = () => {
    exportApi.csv(startDate, endDate)
  }

  // 本地篩選
  const filtered = transactions.filter(t => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false
    if (categoryFilter !== '全部' && t.category !== categoryFilter) return false
    if (keyword) {
      const matchNote = t.note?.toLowerCase().includes(keyword.toLowerCase())
      const matchCat = t.category?.toLowerCase().includes(keyword.toLowerCase())
      const matchAcc = t.account_name?.toLowerCase().includes(keyword.toLowerCase())
      if (!matchNote && !matchCat && !matchAcc) return false
    }
    return true
  })

  // 按日期分組
  const groupedByDate: Record<string, Transaction[]> = {}
  filtered.forEach(tx => {
    if (!groupedByDate[tx.date]) groupedByDate[tx.date] = []
    groupedByDate[tx.date].push(tx)
  })
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a))

  // 當前篩選之收支小計
  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="fade-in">
      {/* 標題與操作按鈕 */}
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">交易記錄 💳</h1>
          <p className="page-subtitle">追蹤與管理所有收支項目、快速篩選與匯出明細</p>
        </div>
        <div className="flex gap-sm">
          <button id="btn-export-csv" className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={16} />
            <span>匯出 CSV</span>
          </button>
          <button id="btn-add-tx" className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={18} />
            <span>新增明細</span>
          </button>
        </div>
      </div>

      {/* 篩選工具列 */}
      <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, alignItems: 'center' }}>
          {/* 日期範圍 */}
          <div className="input-group">
            <label className="input-label flex items-center gap-xs">
              <Calendar size={14} /> 起始日期
            </label>
            <input
              className="input"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label flex items-center gap-xs">
              <Calendar size={14} /> 結束日期
            </label>
            <input
              className="input"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>

          {/* 收支類型篩選 */}
          <div className="input-group">
            <label className="input-label flex items-center gap-xs">
              <ArrowUpDown size={14} /> 收支類型
            </label>
            <select
              className="input"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
            >
              <option value="all">全部收支</option>
              <option value="expense">只看支出</option>
              <option value="income">只看收入</option>
            </select>
          </div>

          {/* 分類篩選 */}
          <div className="input-group">
            <label className="input-label flex items-center gap-xs">
              <Tag size={14} /> 分類
            </label>
            <select
              className="input"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              <option value="全部">全部分類</option>
              {CATEGORIES.expense.map(c => <option key={c} value={c}>{c}</option>)}
              {CATEGORIES.income.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* 關鍵字搜尋 */}
          <div className="input-group">
            <label className="input-label flex items-center gap-xs">
              <Search size={14} /> 備註搜尋
            </label>
            <input
              className="input"
              type="text"
              placeholder="搜尋關鍵字…"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
            />
          </div>
        </div>

        {/* 本期彙總條 */}
        <div className="flex items-center justify-between" style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-color)' }}>
          <div className="flex gap-lg">
            <span style={{ fontSize: '0.875rem' }}>
              篩選筆數：<strong>{filtered.length}</strong> 筆
            </span>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-success)' }}>
              總收入：<strong>{formatCurrency(totalIncome)}</strong>
            </span>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-danger)' }}>
              總支出：<strong>{formatCurrency(totalExpense)}</strong>
            </span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
              淨收支：<span style={{ color: totalIncome - totalExpense >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {formatCurrency(totalIncome - totalExpense)}
              </span>
            </span>
          </div>

          {/* 快捷日期按鈕 */}
          <div className="flex gap-xs">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setStartDate(`${thisMonth()}-01`)
                setEndDate(today())
              }}
            >
              本月
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const d = new Date()
                d.setDate(d.getDate() - 30)
                setStartDate(d.toISOString().slice(0, 10))
                setEndDate(today())
              }}
            >
              近 30 天
            </button>
          </div>
        </div>
      </div>

      {/* 交易清單 (依日期分組) */}
      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          載入明細中…
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="card empty-state">
          <div className="emoji">🔍</div>
          <h3>沒有符合條件的交易記錄</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>試著調整篩選條件或點擊上方「新增明細」</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sortedDates.map(dateStr => {
            const dayTxs = groupedByDate[dateStr]
            const dayIncome = dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
            const dayExpense = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

            return (
              <div key={dateStr} className="card" style={{ padding: '12px 18px' }}>
                {/* 日期標題與該日小計 */}
                <div className="flex items-center justify-between" style={{ paddingBottom: 10, borderBottom: '1px solid var(--border-color)', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    📅 {dateStr}
                  </div>
                  <div className="flex gap-md" style={{ fontSize: '0.8rem' }}>
                    {dayIncome > 0 && <span style={{ color: 'var(--color-success)' }}>+ {formatCurrency(dayIncome)}</span>}
                    {dayExpense > 0 && <span style={{ color: 'var(--color-danger)' }}>- {formatCurrency(dayExpense)}</span>}
                  </div>
                </div>

                {/* 當日項目 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {dayTxs.map(tx => (
                    <div key={tx.id} className="transaction-item" style={{ padding: '8px 10px' }}>
                      <div className={`tx-icon ${tx.type}`}>
                        {CATEGORY_ICONS[tx.category] || (tx.type === 'income' ? '💰' : '💸')}
                      </div>
                      <div className="tx-info">
                        <div className="tx-name">
                          {tx.category} {tx.note && <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>· {tx.note}</span>}
                        </div>
                        <div className="tx-meta">
                          帳戶：{tx.account_name || '預設帳戶'}
                          {tx.user_name && (
                            <span className="badge badge-safe" style={{ fontSize: '0.7rem', padding: '1px 6px', marginLeft: 6 }}>
                              👤 {tx.user_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`tx-amount ${tx.type}`} style={{ marginRight: 12 }}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </div>
                      <div className="flex gap-xs">
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: 6 }}
                          title="編輯"
                          onClick={() => handleOpenEdit(tx)}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: 6, color: 'var(--color-danger)' }}
                          title="刪除"
                          onClick={() => handleDelete(tx.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 新增/編輯 Modal */}
      {showModal && (
        <Modal
          title={editingTx ? '編輯交易記錄' : '新增交易記錄'}
          onClose={() => setShowModal(false)}
        >
          {errorMsg && (
            <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid var(--color-danger)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, color: 'var(--color-danger)', fontSize: '0.85rem' }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                id="tx-amount"
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
                id="tx-category"
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
              <label className="input-label">關聯帳戶</label>
              <select
                id="tx-account"
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
              <label className="input-label">交易日期</label>
              <input
                id="tx-date"
                className="input"
                type="date"
                required
                value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              />
            </div>

            {/* 備註 */}
            <div className="input-group">
              <label className="input-label">備註說明 (選填)</label>
              <input
                id="tx-note"
                className="input"
                type="text"
                placeholder="例如 家樂福採買、捷運儲值"
                value={form.note}
                onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              />
            </div>

            <button
              id="tx-submit"
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={submitting}
              style={{ marginTop: 8 }}
            >
              {submitting ? '儲存中…' : (editingTx ? '儲存變更' : '新增記錄')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
