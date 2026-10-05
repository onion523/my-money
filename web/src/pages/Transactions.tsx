import { TransactionsSkeleton } from '../components/Skeleton'
import { useState, useEffect, useMemo } from 'react'
import { txApi, accountsApi, exportApi, householdApi, Transaction, Account } from '../api/client'
import { useStore } from '../store/useStore'
import { formatCurrency, formatDate, today, thisMonth, CATEGORIES, buildHistoryMemo, recommendCategory } from '../components/utils'
import Modal from '../components/Modal'
import ScopeTabBar from '../components/ScopeTabBar'
import TransactionRow from '../components/TransactionRow'
import FormulaTooltip from '../components/FormulaTooltip'
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
  Lock,
  CreditCard,
  FileText,
  Home,
  CalendarClock,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

export default function Transactions() {
  const { user } = useStore()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [myRole, setMyRole] = useState<'admin' | 'member' | null>(null)
  const [loading, setLoading] = useState(true)

  // 篩選狀態
  const [categoryFilter, setCategoryFilter] = useState('全部')
  const [accountFilter, setAccountFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [scopeFilter, setScopeFilter] = useState<'all' | 'household' | 'personal'>('all')
  const [startDate, setStartDate] = useState(`${thisMonth()}-01`)
  const [endDate, setEndDate] = useState(today())
  const [keyword, setKeyword] = useState('')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

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
    defer_to_next_statement: 0,
  })
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isCategoryManuallyChanged, setIsCategoryManuallyChanged] = useState(false)
  const [recommendationHint, setRecommendationHint] = useState<string | null>(null)

  const historyMemo = useMemo(() => buildHistoryMemo(transactions), [transactions])

  const scopedAccounts = useMemo(() => {
    if (scopeFilter === 'household') {
      return accounts.filter(a => a.is_joint === 1)
    }
    if (scopeFilter === 'personal') {
      return accounts.filter(a => a.is_joint === 0 && (!user || a.user_id === user.id))
    }
    return accounts
  }, [accounts, scopeFilter, user])

  useEffect(() => {
    if (accountFilter !== 'all') {
      const stillExists = scopedAccounts.some(a => a.id === accountFilter)
      if (!stillExists) {
        setAccountFilter('all')
      }
    }
  }, [scopeFilter, scopedAccounts])

  // 載入資料
  const loadData = async () => {
    try {
      setLoading(true)
      const params: Record<string, string> = {
        from: startDate,
        to: endDate,
        scope: scopeFilter,
        limit: '200'
      }
      if (accountFilter !== 'all') {
        params.account_id = accountFilter
      }
      const [txs, accs, householdData] = await Promise.all([
        txApi.list(params),
        accountsApi.list(),
        householdApi.current().catch(() => null),
      ])
      setTransactions(txs)
      setAccounts(accs)
      if (householdData?.myRole) {
        setMyRole(householdData.myRole)
      } else {
        setMyRole(null)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // 權限檢查輔助函數 (ADR 0013)
  const canModifyTx = (tx: Transaction) => {
    if (tx.is_shared === 0) {
      return !user || tx.user_id === user.id
    }
    // 家庭公開/公帳交易：建立者本人或家庭管理員共治
    return (!user || tx.user_id === user.id) || myRole === 'admin'
  }

  useEffect(() => {
    loadData()
  }, [startDate, endDate, scopeFilter, accountFilter])

  // 開啟新增 Modal
  const handleOpenAdd = () => {
    setEditingTx(null)
    setForm({
      account_id: '',
      type: 'expense',
      category: '餐飲',
      amount: '',
      note: '',
      date: today(),
      is_shared: 1,
      defer_to_next_statement: 0,
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
      defer_to_next_statement: tx.defer_to_next_statement || 0,
    })
    setErrorMsg('')
    setShowModal(true)
  }

  // 提交新增/編輯
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (!form.account_id) {
      setErrorMsg(accounts.length === 0 ? '請先至「帳戶管理」建立至少一個帳戶' : '請選擇扣款或存入帳戶')
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
          defer_to_next_statement: form.defer_to_next_statement,
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
          defer_to_next_statement: form.defer_to_next_statement,
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
    if (accountFilter !== 'all' && t.account_id !== accountFilter) return false
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

  const activeFilterCount =
    (typeFilter !== 'all' ? 1 : 0) +
    (categoryFilter !== '全部' ? 1 : 0) +
    (accountFilter !== 'all' ? 1 : 0) +
    (startDate !== `${thisMonth()}-01` || endDate !== today() ? 1 : 0)

  return (
    <div className="fade-in">
      {/* 標題與操作按鈕 */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title flex items-center gap-xs">
            <FileText size={26} color="var(--color-primary)" />
            <span>收支明細</span>
          </h1>
          <p className="page-subtitle">追蹤與管理所有個人與家庭收支明細、快速篩選與匯出</p>
        </div>
        <div className="header-actions">
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
      <div className="card tx-filter-card" style={{ marginBottom: 20 }}>
        {/* 帳本範疇切換 (全部 / 公帳 / 私帳) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 14,
          paddingBottom: 12,
          borderBottom: '1px solid var(--border-color)',
          flexWrap: 'wrap'
        }}>
          <ScopeTabBar scope={scopeFilter} onChange={setScopeFilter} style={{ marginBottom: 0 }} />
        </div>

        {/* 常駐搜尋框 + 行動端進階篩選收合鈕 */}
        <div className="tx-filter-primary-row">
          <div className="tx-search-box">
            <Search size={16} className="tx-search-icon" />
            <input
              className="input tx-search-input"
              type="text"
              placeholder="搜尋備註、分類、帳戶或記帳人..."
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
            />
          </div>
          <button
            type="button"
            id="btn-toggle-mobile-filters"
            className={`btn ${mobileFiltersOpen || activeFilterCount > 0 ? 'btn-primary' : 'btn-secondary'} tx-mobile-filter-toggle`}
            onClick={() => setMobileFiltersOpen(prev => !prev)}
          >
            <Filter size={15} />
            <span>篩選</span>
            {activeFilterCount > 0 && (
              <span className="tx-filter-badge">{activeFilterCount}</span>
            )}
            {mobileFiltersOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        {/* 進階篩選面板 (桌面常駐展開，手機預設收合) */}
        <div className={`tx-advanced-filters ${mobileFiltersOpen ? 'open' : ''}`}>
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
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 帳戶篩選 */}
          <div className="input-group tx-filter-account-group">
            <label className="input-label flex items-center gap-xs">
              <CreditCard size={14} /> 帳戶
            </label>
            <select
              id="filter-account"
              className="input"
              value={accountFilter}
              onChange={e => setAccountFilter(e.target.value)}
            >
              <option value="all">全部帳戶</option>
              {scopedAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  [{acc.is_joint === 1 ? '公帳' : '私帳'}] {acc.name} ({acc.type === 'cash' ? '現金' : acc.type === 'bank' ? '銀行存款帳戶' : '信用卡'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 篩選結果加總橫條 */}
        <div className="tx-summary-strip">
          <div className="tx-summary-count">
            篩選筆數：<strong>{filtered.length}</strong> 筆
          </div>
          <div className="tx-summary-metrics">
            <div className="tx-summary-metric">
              <span className="tx-summary-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <span>總收入</span>
                <FormulaTooltip
                  label="檢視篩選結果總收入計算公式"
                  formula="當前篩選條件下所有「一般收入」明細加總（排除內部轉帳、ATM 提款、信用卡還款與代墊報銷）"
                  calculation={`共 ${filtered.filter(t => t.type === 'income' && (categoryFilter !== '全部' || !SYSTEM_CATEGORIES.includes(t.category))).length} 筆有效收入 = +${formatCurrency(totalIncome)}`}
                />
              </span>
              <strong style={{ color: 'var(--color-success)' }}>+{formatCurrency(totalIncome)}</strong>
            </div>
            <div className="tx-summary-metric">
              <span className="tx-summary-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <span>總支出</span>
                <FormulaTooltip
                  label="檢視篩選結果總支出計算公式"
                  formula="當前篩選條件下所有「一般消費支出」明細加總（排除內部轉帳、ATM 提款、信用卡還款與代墊報銷）"
                  calculation={`共 ${filtered.filter(t => t.type === 'expense' && (categoryFilter !== '全部' || !SYSTEM_CATEGORIES.includes(t.category))).length} 筆有效支出 = -${formatCurrency(totalExpense)}`}
                />
              </span>
              <strong style={{ color: 'var(--color-danger)' }}>-{formatCurrency(totalExpense)}</strong>
            </div>
            <div className="tx-summary-metric">
              <span className="tx-summary-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <span>淨收支</span>
                <FormulaTooltip
                  label="檢視篩選結果淨收支計算公式"
                  formula="篩選結果總收入 － 篩選結果總支出"
                  calculation={`${formatCurrency(totalIncome)} - ${formatCurrency(totalExpense)} = ${formatCurrency(totalIncome - totalExpense)}`}
                />
              </span>
              <strong style={{ color: totalIncome - totalExpense >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {formatCurrency(totalIncome - totalExpense)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 交易清單 (依日期分組) */}
      {loading && transactions.length === 0 ? (
        <TransactionsSkeleton />
      ) : sortedDates.length === 0 ? (
        <div className="card empty-state">
          <div className="emoji"><Search size={40} /></div>
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
              <div key={dateStr} className="card tx-day-card">
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
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      showDate={false}
                      actions={
                        ['信用卡還款', '內部轉帳', 'ATM提款', '公帳代墊報銷'].includes(tx.category) ? (
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
                            title="系統內部平帳還款紀錄受保護。若金額有誤，請至帳戶管理校正餘額。"
                          >
                            <Lock size={12} />
                            <span>系統保護</span>
                          </span>
                        ) : (
                          canModifyTx(tx) && (
                            <>
                              <button
                                className="btn btn-ghost btn-sm tx-action-btn"
                                onClick={() => handleOpenEdit(tx)}
                                title="編輯"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                className="btn btn-ghost btn-sm tx-action-btn danger"
                                onClick={() => handleDelete(tx.id)}
                                title="刪除"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )
                        )
                      }
                    />
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
                  <Home size={15} />
                  <span>公帳</span>
                </button>
                <button
                  type="button"
                  className={`btn ${form.is_shared === 0 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px' }}
                  onClick={() => setForm(p => ({ ...p, is_shared: 0 }))}
                >
                  <Lock size={15} />
                  <span>私帳</span>
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
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-primary-dark)', background: 'rgba(255, 107, 107, 0.12)', padding: '2px 8px', borderRadius: 6, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Sparkles size={12} />
                    <span>{recommendationHint}</span>
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
                    {cat}
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
                <option value="" disabled>-- 請選擇扣款 / 存入帳戶 --</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.type === 'cash' ? '現金' : acc.type === 'bank' ? '銀行存款帳戶' : '信用卡'} - {acc.name} ({acc.is_joint === 1 ? '公帳' : '私帳'})
                  </option>
                ))}
              </select>
            </div>

            {/* 信用卡專屬：列入下期帳單勾選 */}
            {(() => {
              const selectedAcc = accounts.find(a => a.id === form.account_id)
              const isCreditCard = selectedAcc?.type === 'credit_card'
              if (!isCreditCard || (form.type !== 'expense' && form.type !== 'income')) return null

              return (
                <div
                  style={{
                    background: form.defer_to_next_statement === 1 ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-surface-2)',
                    border: form.defer_to_next_statement === 1 ? '1px solid #F59E0B' : '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md, 8px)',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => setForm(p => ({ ...p, defer_to_next_statement: p.defer_to_next_statement === 1 ? 0 : 1 }))}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CalendarClock size={16} color="#D97706" />
                      <span>列入下期帳單</span>
                      {form.defer_to_next_statement === 1 && (
                        <span className="badge" style={{ background: '#F59E0B', color: '#fff', fontSize: '0.7rem', padding: '1px 6px' }}>
                          遞延結算
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                      {form.type === 'expense'
                        ? '適用於商家延遲請款或跨結帳日刷卡，本期出帳作業時自動保留於未出帳'
                        : '適用於店家延遲刷退或跨期退款折抵，本期出帳作業時自動保留於未出帳'}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.defer_to_next_statement === 1}
                    onChange={e => setForm(p => ({ ...p, defer_to_next_statement: e.target.checked ? 1 : 0 }))}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                </div>
              )
            })()}

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
                        setRecommendationHint(rec.source === 'history' ? `依歷史習慣推薦【${rec.category}】` : `智慧推薦為【${rec.category}】`);
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
