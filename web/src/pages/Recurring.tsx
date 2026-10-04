import { RecurringSkeleton } from '../components/Skeleton'
import { useState, useEffect } from 'react'
import { recurringApi, accountsApi, exportApi, householdApi, RecurringItem, Account, AmortizeResult } from '../api/client'
import { useStore } from '../store/useStore'
import { formatCurrency, CYCLE_LABELS } from '../components/utils'
import Modal from '../components/Modal'
import ScopeTabBar from '../components/ScopeTabBar'
import {
  AlertCircle,
  Plus,
  Download,
  Edit2,
  Trash2,
  RefreshCw,
  Calendar,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Info,
  Home,
  Lock,
  FileText,
} from 'lucide-react'

const CYCLE_DIVISORS: Record<string, number> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
}

function formatScheduleLabel(item: RecurringItem, actionText: '扣款' | '入帳'): string {
  const day = item.day_of_cycle;
  const month = item.month_of_cycle || 1;
  if (item.cycle === 'monthly') return `每月 ${day} 號${actionText}`;
  if (item.cycle === 'bimonthly') {
    return `${month === 1 ? '單數月' : '雙數月'} ${day} 號${actionText}`;
  }
  if (item.cycle === 'quarterly') {
    const qMap: Record<number, string> = { 1: '1/4/7/10月', 2: '2/5/8/11月', 3: '3/6/9/12月' };
    return `每季 (${qMap[month] || '1/4/7/10月'}) ${day} 號${actionText}`;
  }
  if (item.cycle === 'semiannual') {
    const sMap: Record<number, string> = { 1: '1/7月', 2: '2/8月', 3: '3/9月', 4: '4/10月', 5: '5/11月', 6: '6/12月' };
    return `每半年 (${sMap[month] || '1/7月'}) ${day} 號${actionText}`;
  }
  if (item.cycle === 'annual') {
    return `每年 ${month} 月 ${day} 號${actionText}`;
  }
  return `每月 ${day} 號${actionText}`;
}

export default function Recurring() {
  const { user } = useStore()
  const [items, setItems] = useState<RecurringItem[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [amortize, setAmortize] = useState<AmortizeResult | null>(null)
  const [myRole, setMyRole] = useState<'admin' | 'member' | null>(null)
  const [scope, setScope] = useState<'all' | 'household' | 'personal'>('all')
  const [loading, setLoading] = useState(true)

  // Modal 狀態
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<RecurringItem | null>(null)
  const [form, setForm] = useState({
    name: '',
    type: 'expense' as 'expense' | 'income',
    amount: '',
    cycle: 'monthly' as 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual',
    day_of_cycle: '1',
    month_of_cycle: '1',
    account_id: '',
    is_shared: 0,
  })
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)

  // 二段式防誤觸刪除狀態
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [confirmingModalDelete, setConfirmingModalDelete] = useState(false)
  const [deleteTimer, setDeleteTimer] = useState<any>(null)
  const [modalDeleteTimer, setModalDeleteTimer] = useState<any>(null)

  useEffect(() => {
    return () => {
      if (deleteTimer) clearTimeout(deleteTimer)
      if (modalDeleteTimer) clearTimeout(modalDeleteTimer)
    }
  }, [deleteTimer, modalDeleteTimer])

  const loadData = async (currentScope: 'all' | 'household' | 'personal' = scope) => {
    try {
      setLoading(true)
      setLoadError(null)
      const [recList, accs, amort, householdData] = await Promise.all([
        recurringApi.list(currentScope),
        accountsApi.list('all'),
        recurringApi.amortize(currentScope),
        householdApi.current().catch(() => null),
      ])
      setItems(recList)
      setAccounts(accs)
      if (amort) setAmortize(amort)
      if (householdData?.myRole) setMyRole(householdData.myRole)
    } catch (err: any) {
      console.error('Failed to load recurring data:', err)
      setLoadError(err.message || '週期收支資料載入失敗，請檢查連線')
    } finally {
      setLoading(false)
    }
  }

  // 權限檢查 (ADR 0013 & ADR 0016)：
  const canModifyRecurring = (item: RecurringItem) => {
    if (item.is_shared === 0 || !item.is_shared) {
      return !user || item.user_id === user.id
    }
    // 家庭公帳週期收支：建立者本人或家庭管理員共治
    return (!user || item.user_id === user.id) || myRole === 'admin'
  }

  useEffect(() => {
    loadData(scope)
  }, [scope])

  const handleCycleChange = (newCycle: typeof form.cycle) => {
    setForm(prev => {
      let newMonth = prev.month_of_cycle
      const mNum = parseInt(newMonth) || 1
      if (newCycle === 'monthly') {
        newMonth = '1'
      } else if (newCycle === 'bimonthly' && mNum > 2) {
        newMonth = '1'
      } else if (newCycle === 'quarterly' && mNum > 3) {
        newMonth = '1'
      } else if (newCycle === 'semiannual' && mNum > 6) {
        newMonth = '1'
      } else if (newCycle === 'annual' && (mNum < 1 || mNum > 12)) {
        newMonth = '1'
      }
      return { ...prev, cycle: newCycle, month_of_cycle: newMonth }
    })
  }

  const handleOpenAdd = () => {
    setEditingItem(null)
    setForm({
      name: '',
      type: 'expense',
      amount: '',
      cycle: 'monthly',
      day_of_cycle: '1',
      month_of_cycle: '1',
      account_id: '',
      is_shared: scope === 'household' ? 1 : 0,
    })
    setErrorMsg('')
    setConfirmingModalDelete(false)
    setShowModal(true)
  }

  const handleOpenEdit = (item: RecurringItem) => {
    if (!canModifyRecurring(item)) return
    setEditingItem(item)
    setForm({
      name: item.name,
      type: item.type,
      amount: item.amount.toString(),
      cycle: item.cycle,
      day_of_cycle: item.day_of_cycle.toString(),
      month_of_cycle: (item.month_of_cycle || 1).toString(),
      account_id: item.account_id || '',
      is_shared: item.is_shared ?? 0,
    })
    setErrorMsg('')
    setConfirmingModalDelete(false)
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (!form.name.trim()) {
      setErrorMsg('請填寫項目名稱')
      return
    }
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('請輸入有效金額')
      return
    }
    const day = parseInt(form.day_of_cycle) || 1
    const month = form.cycle === 'monthly' ? 1 : (parseInt(form.month_of_cycle) || 1)

    try {
      setSubmitting(true)
      if (editingItem) {
        await recurringApi.update(editingItem.id, {
          name: form.name.trim(),
          type: form.type,
          amount: amt,
          cycle: form.cycle,
          day_of_cycle: day,
          month_of_cycle: month,
          account_id: form.account_id || undefined,
          is_shared: form.is_shared,
        })
      } else {
        await recurringApi.create({
          name: form.name.trim(),
          type: form.type,
          amount: amt,
          cycle: form.cycle,
          day_of_cycle: day,
          month_of_cycle: month,
          account_id: form.account_id || undefined,
          is_shared: form.is_shared,
        })
      }
      setShowModal(false)
      loadData(scope)
    } catch (err: any) {
      setErrorMsg(err.message || '儲存失敗')
    } finally {
      setSubmitting(false)
    }
  }

  // 卡片獨立按鈕二段式防呆刪除（徹底廢除原生 window.confirm）
  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirmingDeleteId === id) {
      if (deleteTimer) clearTimeout(deleteTimer)
      setConfirmingDeleteId(null)
      executeDelete(id)
    } else {
      setConfirmingDeleteId(id)
      if (deleteTimer) clearTimeout(deleteTimer)
      const timer = setTimeout(() => {
        setConfirmingDeleteId(null)
      }, 3000)
      setDeleteTimer(timer)
    }
  }

  const executeDelete = async (id: string) => {
    try {
      await recurringApi.remove(id)
      loadData()
    } catch (err: any) {
      alert(err.message || '刪除失敗')
    }
  }

  // Modal 內部二段式防呆刪除
  const handleModalDelete = async (id: string) => {
    if (!confirmingModalDelete) {
      setConfirmingModalDelete(true)
      if (modalDeleteTimer) clearTimeout(modalDeleteTimer)
      const timer = setTimeout(() => {
        setConfirmingModalDelete(false)
      }, 3000)
      setModalDeleteTimer(timer)
      return
    }

    if (modalDeleteTimer) clearTimeout(modalDeleteTimer)
    setConfirmingModalDelete(false)
    try {
      setSubmitting(true)
      await recurringApi.remove(id)
      setShowModal(false)
      loadData()
    } catch (err: any) {
      setErrorMsg(err.message || '刪除失敗')
    } finally {
      setSubmitting(false)
    }
  }

  const expenseItems = items.filter(i => i.type === 'expense')
  const incomeItems = items.filter(i => i.type === 'income')

  if (loading && items.length === 0) {
    return <RecurringSkeleton />
  }

  return (
    <div className="fade-in">
      {loadError && (
        <div className="alert alert-danger flex items-center justify-between" style={{ marginBottom: 20 }}>
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <span><strong>週期收支資料載入失敗</strong>：{loadError}</span>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => loadData()}
            style={{ padding: '4px 12px', fontSize: '0.85rem' }}
          >
            重新嘗試
          </button>
        </div>
      )}
      {/* 標題與操作按鈕 */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>週期收支</span>
            <RefreshCw size={24} style={{ color: 'var(--color-primary)' }} />
          </h1>
          <p className="page-subtitle">管理每月定期租金、水電、訂閱與薪資，自動計算平均每月支出</p>
        </div>
        <div className="header-actions">
          <button id="btn-export-recurring" className="btn btn-secondary" onClick={() => exportApi.recurringCsv()}>
            <Download size={18} />
            <span>匯出 CSV</span>
          </button>
          <button id="btn-add-recurring" className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={18} />
            <span>新增週期項目</span>
          </button>
        </div>
      </div>

      {/* 帳本視角切換器 */}
      <div style={{ marginBottom: 20 }}>
        <ScopeTabBar scope={scope} onChange={setScope} />
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <span className="stat-label">週期支出每月平均</span>
          <div className="stat-value" style={{ color: 'var(--color-danger)' }}>
            {formatCurrency(amortize?.monthly_expense ?? 0)}
          </div>
          <div className="stat-sub">將年繳、季繳換算為每月預留負擔</div>
        </div>

        <div className="stat-card">
          <span className="stat-label">週期收入每月預估</span>
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>
            {formatCurrency(amortize?.monthly_income ?? 0)}
          </div>
          <div className="stat-sub">穩定每月現金流進帳</div>
        </div>

        <div className="stat-card" style={{ background: 'var(--bg-surface-2)' }}>
          <span className="stat-label">每月週期淨額</span>
          <div className="stat-value" style={{ color: (amortize?.monthly_income ?? 0) - (amortize?.monthly_expense ?? 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatCurrency((amortize?.monthly_income ?? 0) - (amortize?.monthly_expense ?? 0))}
          </div>
          <div className="stat-sub">週期收入減去必要支出</div>
        </div>
      </div>

      {/* 週期支出清單 */}
      <div style={{ marginBottom: 32 }}>
        <h2 className="text-xl flex items-center gap-xs" style={{ marginBottom: 14 }}>
          <TrendingDown size={20} color="var(--color-danger)" />
          週期支出項目 ({expenseItems.length})
        </h2>

        {expenseItems.length === 0 ? (
          <div className="card empty-state">
            <div className="emoji"><FileText size={40} /></div>
            <h3>尚未新增週期支出</h3>
            <p style={{ fontSize: '0.875rem', marginBottom: 12 }}>如房租、網路費、Netflix 訂閱、保險費等</p>
            <button className="btn btn-primary btn-sm" onClick={handleOpenAdd}>立即新增</button>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {expenseItems.map((item) => {
                const monthlyShare = item.amount / (CYCLE_DIVISORS[item.cycle] || 1)
                const isConfirming = confirmingDeleteId === item.id
                return (
                  <div
                    key={item.id}
                    className="recurring-card"
                    onClick={() => canModifyRecurring(item) && handleOpenEdit(item)}
                  >
                    <div className="recurring-card-main">
                      <div className="recurring-card-header">
                        <span className="recurring-card-title">{item.name}</span>
                        {item.is_shared === 1 ? (
                          <span className="badge badge-primary" style={{ fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Home size={11} /> 公帳
                          </span>
                        ) : (
                          <span className="badge badge-secondary" style={{ fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Lock size={11} /> 私帳
                          </span>
                        )}
                        {item.user_name && (
                          <span className="badge" style={{ background: 'rgba(0,0,0,0.06)', fontSize: '0.7rem' }}>
                            {item.user_name}
                          </span>
                        )}
                        <span className="badge badge-expense">
                          {CYCLE_LABELS[item.cycle] || item.cycle}
                        </span>
                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                          {formatScheduleLabel(item, '扣款')}
                        </span>
                      </div>
                      <div className="recurring-card-meta">
                        {item.account_name ? `關聯扣款帳戶：${item.account_name}` : '未指定關聯帳戶'}
                        {item.cycle !== 'monthly' && ` · 換算每月平均：${formatCurrency(monthlyShare)} / 月`}
                      </div>
                    </div>

                    <div className="recurring-card-side">
                      <div className="recurring-card-amount-block">
                        <div className="recurring-card-amount" style={{ color: 'var(--color-danger)' }}>
                          {formatCurrency(item.amount)}
                        </div>
                        <div className="recurring-card-cycle">
                          {CYCLE_LABELS[item.cycle]}繳
                        </div>
                      </div>

                      {canModifyRecurring(item) && (
                        <div className="recurring-card-actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenEdit(item)
                            }}
                            title="編輯"
                          >
                            <Edit2 size={15} />
                            <span>編輯</span>
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${isConfirming ? 'btn-danger' : 'btn-ghost'}`}
                            style={isConfirming ? {} : { color: 'var(--color-danger)' }}
                            onClick={(e) => handleDeleteClick(e, item.id)}
                            title="刪除"
                          >
                            <Trash2 size={15} />
                            <span>{isConfirming ? '確定刪除？' : '刪除'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 週期收入清單 */}
      <div>
        <h2 className="text-xl flex items-center gap-xs" style={{ marginBottom: 14 }}>
          <TrendingUp size={20} color="var(--color-success)" />
          週期收入項目 ({incomeItems.length})
        </h2>

        {incomeItems.length === 0 ? (
          <div className="card empty-state" style={{ padding: 24 }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>尚未設定週期收入（如每月薪資、租金收益）</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {incomeItems.map((item) => {
                const isConfirming = confirmingDeleteId === item.id
                return (
                  <div
                    key={item.id}
                    className="recurring-card"
                    onClick={() => canModifyRecurring(item) && handleOpenEdit(item)}
                  >
                    <div className="recurring-card-main">
                      <div className="recurring-card-header">
                        <span className="recurring-card-title">{item.name}</span>
                        {item.is_shared === 1 ? (
                          <span className="badge badge-primary" style={{ fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Home size={11} /> 公帳
                          </span>
                        ) : (
                          <span className="badge badge-secondary" style={{ fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Lock size={11} /> 私帳
                          </span>
                        )}
                        {item.user_name && (
                          <span className="badge" style={{ background: 'rgba(0,0,0,0.06)', fontSize: '0.7rem' }}>
                            {item.user_name}
                          </span>
                        )}
                        <span className="badge badge-income">{CYCLE_LABELS[item.cycle] || item.cycle}</span>
                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{formatScheduleLabel(item, '入帳')}</span>
                      </div>
                      <div className="recurring-card-meta">
                        {item.account_name ? `入帳帳戶：${item.account_name}` : '未指定關聯帳戶'}
                      </div>
                    </div>

                    <div className="recurring-card-side">
                      <div className="recurring-card-amount-block">
                        <div className="recurring-card-amount" style={{ color: 'var(--color-success)' }}>
                          +{formatCurrency(item.amount)}
                        </div>
                        <div className="recurring-card-cycle">{CYCLE_LABELS[item.cycle]}收</div>
                      </div>

                      {canModifyRecurring(item) && (
                        <div className="recurring-card-actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenEdit(item)
                            }}
                            title="編輯"
                          >
                            <Edit2 size={15} />
                            <span>編輯</span>
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${isConfirming ? 'btn-danger' : 'btn-ghost'}`}
                            style={isConfirming ? {} : { color: 'var(--color-danger)' }}
                            onClick={(e) => handleDeleteClick(e, item.id)}
                            title="刪除"
                          >
                            <Trash2 size={15} />
                            <span>{isConfirming ? '確定刪除？' : '刪除'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 新增/編輯 Modal */}
      {showModal && (
        <Modal
          title={editingItem ? '編輯週期收支' : '新增週期收支'}
          onClose={() => {
            setShowModal(false)
            setConfirmingModalDelete(false)
          }}
        >
          {errorMsg && (
            <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid var(--color-danger)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, color: 'var(--color-danger)', fontSize: '0.85rem' }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 類型切換 */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`btn btn-full ${form.type === 'expense' ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => setForm(p => ({ ...p, type: 'expense' }))}
              >
                週期支出
              </button>
              <button
                type="button"
                className={`btn btn-full ${form.type === 'income' ? 'btn-primary' : 'btn-secondary'}`}
                style={form.type === 'income' ? { background: 'var(--color-success)' } : {}}
                onClick={() => setForm(p => ({ ...p, type: 'income' }))}
              >
                週期收入
              </button>
            </div>

            {/* 名稱 */}
            <div className="input-group">
              <label className="input-label">項目名稱</label>
              <input
                id="rec-name"
                className="input"
                type="text"
                placeholder={form.type === 'expense' ? '例如 房租、電信費、健身房月費' : '例如 每月薪資、租金收益'}
                required
                autoFocus
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>

            {/* 金額 */}
            <div className="input-group">
              <label className="input-label">每期金額 (NT$)</label>
              <input
                id="rec-amount"
                className="input"
                type="number"
                step="1"
                min="1"
                placeholder="例如 15000"
                required
                value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              />
            </div>

            {/* 週期與月份選擇 */}
            {form.cycle === 'monthly' ? (
              <div className="grid grid-2" style={{ gap: 10 }}>
                <div className="input-group">
                  <label className="input-label">付款 / 入帳週期</label>
                  <select
                    id="rec-cycle"
                    className="input"
                    value={form.cycle}
                    onChange={e => handleCycleChange(e.target.value as any)}
                  >
                    <option value="monthly">每月</option>
                    <option value="bimonthly">每雙月 (2個月)</option>
                    <option value="quarterly">每季 (3個月)</option>
                    <option value="semiannual">每半年 (6個月)</option>
                    <option value="annual">每年 (12個月)</option>
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">{form.type === 'income' ? '入帳日' : '扣款日'} (每月 1~31 號)</label>
                  <input
                    id="rec-day"
                    className="input"
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={form.day_of_cycle}
                    onChange={e => setForm(p => ({ ...p, day_of_cycle: e.target.value }))}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="input-group">
                  <label className="input-label">付款 / 入帳週期</label>
                  <select
                    id="rec-cycle"
                    className="input"
                    value={form.cycle}
                    onChange={e => handleCycleChange(e.target.value as any)}
                  >
                    <option value="monthly">每月</option>
                    <option value="bimonthly">每雙月 (2個月)</option>
                    <option value="quarterly">每季 (3個月)</option>
                    <option value="semiannual">每半年 (6個月)</option>
                    <option value="annual">每年 (12個月)</option>
                  </select>
                </div>

                <div className="grid grid-2" style={{ gap: 10 }}>
                  <div className="input-group">
                    <label className="input-label">
                      {form.cycle === 'annual'
                        ? (form.type === 'income' ? '入帳月份' : '扣款月份')
                        : form.cycle === 'bimonthly'
                        ? '單數或雙數月'
                        : '起算月份'}
                    </label>
                    <select
                      id="rec-month"
                      className="input"
                      value={form.month_of_cycle}
                      onChange={e => setForm(p => ({ ...p, month_of_cycle: e.target.value }))}
                    >
                      {form.cycle === 'bimonthly' && (
                        <>
                          <option value="1">單數月（1、3、5、7、9、11月）</option>
                          <option value="2">雙數月（2、4、6、8、10、12月）</option>
                        </>
                      )}
                      {form.cycle === 'quarterly' && (
                        <>
                          <option value="1">1、4、7、10 月</option>
                          <option value="2">2、5、8、11 月</option>
                          <option value="3">3、6、9、12 月</option>
                        </>
                      )}
                      {form.cycle === 'semiannual' && (
                        <>
                          <option value="1">1、7 月</option>
                          <option value="2">2、8 月</option>
                          <option value="3">3、9 月</option>
                          <option value="4">4、10 月</option>
                          <option value="5">5、11 月</option>
                          <option value="6">6、12 月</option>
                        </>
                      )}
                      {form.cycle === 'annual' && Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m.toString()}>每年 {m} 月</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <label className="input-label">{form.type === 'income' ? '入帳日' : '扣款日'} (1~31 號)</label>
                    <input
                      id="rec-day"
                      className="input"
                      type="number"
                      min="1"
                      max="31"
                      required
                      value={form.day_of_cycle}
                      onChange={e => setForm(p => ({ ...p, day_of_cycle: e.target.value }))}
                    />
                  </div>
                </div>
              </>
            )}

            {/* 關聯帳戶 */}
            <div className="input-group">
              <label className="input-label">關聯帳戶 (選填)</label>
              <select
                id="rec-account"
                className="input"
                value={form.account_id}
                onChange={e => {
                  const selectedId = e.target.value
                  const targetAcc = accounts.find(a => a.id === selectedId)
                  setForm(p => ({
                    ...p,
                    account_id: selectedId,
                    ...(targetAcc ? { is_shared: targetAcc.is_joint === 1 ? 1 : 0 } : {})
                  }))
                }}
              >
                <option value="">無特定帳戶</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type === 'cash' ? '現金' : acc.type === 'bank' ? '銀行存款帳戶' : '信用卡'})
                  </option>
                ))}
              </select>
            </div>

            {/* 帳本歸屬 */}
            <div className="input-group">
              <label className="input-label">帳本歸屬</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  id="rec-is-shared-0"
                  className={`btn ${form.is_shared === 0 ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    border: form.is_shared === 0 ? 'none' : '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                  onClick={() => setForm(p => ({ ...p, is_shared: 0 }))}
                >
                  <Lock size={14} />
                  <span>私帳</span>
                </button>
                <button
                  type="button"
                  id="rec-is-shared-1"
                  className={`btn ${form.is_shared === 1 ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    border: form.is_shared === 1 ? 'none' : '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                  onClick={() => setForm(p => ({ ...p, is_shared: 1 }))}
                >
                  <Home size={14} />
                  <span>公帳</span>
                </button>
              </div>
              <p className="text-xs text-muted" style={{ marginTop: 4 }}>
                {form.is_shared === 1
                  ? '家庭公帳：此項週期收支計入家庭公共現金流與固定收支，家庭管理員與建立者皆可管理。'
                  : '個人私帳：僅本人可見並計入個人現金流。若選用個人信用卡固定扣繳公用費用，可手動切換為公帳。'}
              </p>
            </div>

            {/* 操作按鈕列：編輯時左側提供刪除按鈕，右側為儲存按鈕 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: editingItem ? 'space-between' : 'flex-end', gap: 10, marginTop: 12 }}>
              {editingItem && (
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ minHeight: 40, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => handleModalDelete(editingItem.id)}
                  disabled={submitting}
                >
                  <Trash2 size={16} />
                  <span>{confirmingModalDelete ? '確定刪除？再次點擊' : '刪除此項目'}</span>
                </button>
              )}
              <button
                id="rec-submit"
                type="submit"
                className="btn btn-primary"
                style={{ flex: editingItem ? 1 : 'none', width: editingItem ? 'auto' : '100%', minHeight: 40 }}
                disabled={submitting}
              >
                {submitting ? '儲存中…' : (editingItem ? '儲存變更' : '建立週期收支')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
