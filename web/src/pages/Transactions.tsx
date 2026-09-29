import { TransactionsSkeleton } from '../components/Skeleton'
import { useState, useEffect, useMemo } from 'react'
import { txApi, accountsApi, exportApi, Transaction, Account } from '../api/client'
import { formatCurrency, formatDate, today, thisMonth, CATEGORIES, CATEGORY_ICONS, buildHistoryMemo, recommendCategory } from '../components/utils'
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
  Tag,
  Users,
  Lock,
  Globe
} from 'lucide-react'

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  // 篩選狀態
  const [categoryFilter, setCategoryFilter] = useState('全部')
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [scopeFilter, setScopeFilter] = useState<'all' | 'household' | 'personal'>('all')
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
    is_shared: 1, // 1: 公帳, 0: 個人私帳
  })
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isCategoryManuallyChanged, setIsCategoryManuallyChanged] = useState(false)
  const [recommendationHint, setRecommendationHint] = useState<string | null>(null)

  const historyMemo = useMemo(() => buildHistoryMemo(transactions), [transactions])

  // 載入資料
  const loadData = async () => {
    try {
      setLoading(true)
      const [txs, accs] = await Promise.all([
        txApi.list({ from: startDate, to: endDate, scope: scopeFilter, limit: '200' }),
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
  }, [startDate, endDate, scopeFilter])

  // 開啟新增 Modal
  const handleOpenAdd = () => {
    setEditingTx(null)
    setForm({
      account_id: accounts[0]?.id || '',
      type: 'expense',
      category: '餐飲',
      amount: '',
      note: '',
      date: today(),
      is_shared: 1,
    })
    setIsCategoryManuallyChanged(false)
    setRecommendationHint(null)
    setErrorMsg('')
    setShowModal(true)
  }

  // 開啟編輯 Modal
  const handleOpenEdit = (tx: Transaction) => {
    setIsCategoryManuallyChanged(true)
    setRecommendationHint(null)
    setEditingTx(tx)
    setForm({
      account_id: tx.account_id,
      type: tx.type,
      category: tx.category,
      amount: tx.amount.toString(),
      note: tx.note || '',
      date: tx.date,
      is_shared: tx.is_shared !== undefined ? tx.is_shared : 1,
    })
    setErrorMsg('')
    setShowModal(true)
  }

  // 提交新增/編輯
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (!form.account_id) {
      setErrorMsg('請先建立並選擇帳戶')
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
          is_shared: form.is_shared,
        })
      } else {
        await txApi.create({
          account_id: form.account_id,
          type: form.type,
          category: form.category,
          amount: amt,
          note: form.note.trim(),
          date: form.date,
          is_shared: form.is_shared,
        })
      }
      setShowModal(false)
      loadData()
    } catch (err: any) {
      setErrorMsg(err.message || '操作失敗')
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
      const matchUser = t.user_name?.toLowerCase().includes(keyword.toLowerCase())
      if (!matchNote && !matchCat && !matchAcc && !matchUser) return false
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

  // 計算篩選之收支加總
  // 計算篩選後收支總額 (預設排除內部轉帳等非實質收支；若使用者主動篩選該分類則統計該分類)
  const SYSTEM_CATEGORIES = ['信用卡還款', '內部轉帳', 'ATM提款', '公帳代墊報銷'];
  const totalIncome = filtered
    .filter(t => t.type === 'income' && (categoryFilter !== '全部' || !SYSTEM_CATEGORIES.includes(t.category)))
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered
    .filter(t => t.type === 'expense' && (categoryFilter !== '全部' || !SYSTEM_CATEGORIES.includes(t.category)))
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="fade-in">
      {/* 標題與操作按鈕 */}
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">交易記錄 📜</h1>
          <p className="page-subtitle">追蹤與管理所有收支明細、快速篩選與匯出明細</p>
        </div>
        <div className="flex gap-sm">
          <button id="btn-export-csv" className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={16} />
            <span>匯出 CSV</span>
          </button>
          <button id="btn-add-tx" className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={18} />
            <span>記一筆</span>
          </button>
        </div>
      </div>

      {/* 篩選工具列 */}
      <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        {/* 帳本範疇切換 (公帳 / 個人私帳 / 全部) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
          paddingBottom: 14,
          borderBottom: '1px solid var(--border-color)',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>帳本分類：</span>
          <button
            type="button"
            className={`btn btn-sm ${scopeFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 8, padding: '4px 12px' }}
            onClick={() => setScopeFilter('all')}
          >
            <Globe size={14} /> 全部
          </button>
          <button
            type="button"
            className={`btn btn-sm ${scopeFilter === 'household' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 8, padding: '4px 12px' }}
            onClick={() => setScopeFilter('household')}
          >
            <Users size={14} /> 🏠 家庭公帳
          </button>
          <button
            type="button"
            className={`btn btn-sm ${scopeFilter === 'personal' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 8, padding: '4px 12px' }}
            onClick={() => setScopeFilter('personal')}
          >
            <Lock size={14} /> 🔒 個人私帳
          </button>
        </div>

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

          {/* 類型篩選 */}
          <div className="input-group">
            <label className="input-label flex items-center gap-xs">
              <ArrowUpDown size={14} /> 收支類型
            </label>
            <select
              className="input"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
            >
              <option value="all">全部類型</option>
              <option value="expense">僅支出</option>
              <option value="income">僅收入</option>
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
              {Array.from(new Set([...CATEGORIES.expense, ...CATEGORIES.income])).map(c => (
                <option key={c} value={c}>{CATEGORY_ICONS[c] || ''} {c}</option>
              ))}
            </select>
          </div>

          {/* 關鍵字搜尋 */}
          <div className="input-group">
            <label className="input-label flex items-center gap-xs">
              <Search size={14} /> 搜尋備註/成員
            </label>
            <input
              className="input"
              type="text"
              placeholder="搜尋備註或記帳人..."
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
            />
          </div>
        </div>

        {/* 篩選結果加總橫條 */}
        <div className="flex items-center justify-between" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-color)', fontSize: '0.875rem', flexWrap: 'wrap', gap: 8 }}>
          <div>
            篩選筆數：<strong>{filtered.length}</strong> 筆
          </div>
          <div className="flex gap-md">
            <span style={{ color: 'var(--color-success)' }}>
              總收入：<strong>+{formatCurrency(totalIncome)}</strong>
            </span>
            <span style={{ color: 'var(--color-danger)' }}>
              總支出：<strong>-{formatCurrency(totalExpense)}</strong>
            </span>
            <span style={{ fontWeight: 600 }}>
              淨收支：<span style={{ color: totalIncome - totalExpense >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {formatCurrency(totalIncome - totalExpense)}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* 交易清單 (依日期分組) */}
      {loading && transactions.length === 0 ? (
        <TransactionsSkeleton />
      ) : sortedDates.length === 0 ? (
        <div className="card empty-state">
          <div className="emoji">🔍</div>
          <h3>沒有符合條件的明細</h3>
          <p style={{ fontSize: '0.875rem', marginBottom: 16 }}>試著調整篩選條件，或新增第一筆收支</p>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={16} /> 記一筆
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sortedDates.map(dateStr => {
            const dayTxs = groupedByDate[dateStr]
            const dayIncome = dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
            const dayExpense = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

            return (
              <div key={dateStr} className="card" style={{ padding: '16px 20px' }}>
                {/* 日期標題欄 */}
                <div className="flex items-center justify-between" style={{ paddingBottom: 10, borderBottom: '1px solid var(--border-color)', marginBottom: 8 }}>
                  <div className="flex items-center gap-xs" style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    <Calendar size={16} color="var(--color-primary)" />
                    <span>{formatDate(dateStr)}</span>
                  </div>
                  <div className="flex gap-sm text-xs text-muted">
                    {dayIncome > 0 && <span style={{ color: 'var(--color-success)' }}>+{formatCurrency(dayIncome)}</span>}
                    {dayExpense > 0 && <span style={{ color: 'var(--color-danger)' }}>-{formatCurrency(dayExpense)}</span>}
                  </div>
                </div>

                {/* 當日明細列表 */}
                <div className="tx-list">
                  {dayTxs.map(tx => (
                    <div key={tx.id} className="tx-item">
                      <div className={`tx-icon ${tx.type}`}>
                        {CATEGORY_ICONS[tx.category] || (tx.type === 'income' ? '💰' : '💸')}
                      </div>
                      <div className="tx-info">
                        <div className="tx-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{tx.category}</span>
                          {tx.note && <span className="text-muted" style={{ fontWeight: 400 }}>· {tx.note}</span>}
                          {tx.is_shared === 0 ? (
                            <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.7rem', padding: '1px 6px' }}>
                              🔒 個人私帳
                            </span>
                          ) : (
                            <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontSize: '0.7rem', padding: '1px 6px' }}>
                              🏠 公帳
                            </span>
                          )}
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
                      <div className="flex items-center gap-md">
                        <div className={`tx-amount ${tx.type}`} style={{ fontSize: '1.1rem' }}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </div>
                        <div className="flex gap-xs">
                          {['信用卡還款', '內部轉帳', 'ATM提款', '公帳代墊報銷'].includes(tx.category) ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                background: 'var(--bg-surface-2)',
                                border: '1px solid var(--border-color)',
                                padding: '3px 8px',
                                borderRadius: 6,
                              }}
                              title="🔒 系統內部平帳還款紀錄受保護。若金額有誤，請至帳戶管理校正餘額。"
                            >
                              <Lock size={12} />
                              <span>系統保護</span>
                            </span>
                          ) : (
                            <>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: 4 }}
                                onClick={() => handleOpenEdit(tx)}
                                title="編輯"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: 4, color: 'var(--color-danger)' }}
                                onClick={() => handleDelete(tx.id)}
                                title="刪除"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
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
            {/* 公帳 / 個人私帳 切換 */}
            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 600, marginBottom: 6 }}>帳本歸屬</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  className={`btn ${form.is_shared === 1 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px' }}
                  onClick={() => setForm(p => ({ ...p, is_shared: 1 }))}
                >
                  <Users size={16} />
                  <span>🏠 家庭公帳 (公開)</span>
                </button>
                <button
                  type="button"
                  className={`btn ${form.is_shared === 0 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px' }}
                  onClick={() => setForm(p => ({ ...p, is_shared: 0 }))}
                >
                  <Lock size={16} />
                  <span>🔒 個人私帳 (隱私)</span>
                </button>
              </div>
            </div>

            {/* 收支類型 */}
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
                className="input"
                type="number"
                step="1"
                min="1"
                placeholder="例如 100"
                required
                autoFocus
                value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              />
            </div>

            {/* 分類 */}
            <div className="input-group">
              <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                <label className="input-label" style={{ margin: 0 }}>分類</label>
                {recommendationHint && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-primary-dark)', background: 'rgba(255, 107, 107, 0.12)', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                    {recommendationHint}
                  </span>
                )}
              </div>
              <select
                className="input"
                value={form.category}
                onChange={e => {
                  setIsCategoryManuallyChanged(true);
                  setRecommendationHint(null);
                  setForm(p => ({ ...p, category: e.target.value }));
                }}
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
              <label className="input-label">扣款 / 存入帳戶</label>
              <select
                className="input"
                value={form.account_id}
                onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}
                required
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.type === 'cash' ? '💵 現金' : acc.type === 'bank' ? '🏦 活存' : '💳 信用卡'} - {acc.name} ({acc.is_joint === 1 ? (acc.type === 'credit_card' ? '🏠 家庭信用卡' : '🏠 家庭共同基金') : '👤 個人私帳'})
                  </option>
                ))}
              </select>
            </div>

            {/* 日期 */}
            <div className="input-group">
              <label className="input-label">交易日期</label>
              <input
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
                className="input"
                type="text"
                placeholder="例如 午餐、中油加油、Netflix"
                value={form.note}
                onChange={e => {
                  const newNote = e.target.value;
                  setForm(p => {
                    const next = { ...p, note: newNote };
                    if (!isCategoryManuallyChanged) {
                      const rec = recommendCategory(newNote, p.type, historyMemo);
                      if (rec) {
                        next.category = rec.category;
                        setRecommendationHint(rec.source === 'history' ? `✨ 依歷史習慣推薦【${rec.category}】` : `✨ 智慧推薦為【${rec.category}】`);
                      } else {
                        setRecommendationHint(null);
                      }
                    }
                    return next;
                  });
                }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={submitting}
              style={{ marginTop: 8 }}
            >
              {submitting ? '儲存中...' : (editingTx ? '儲存修改' : '確認新增')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
