import { RecurringSkeleton } from '../components/Skeleton'
import { useState, useEffect } from 'react'
import { recurringApi, accountsApi, exportApi, householdApi, RecurringItem, Account, AmortizeResult } from '../api/client'
import { useStore } from '../store/useStore'
import { formatCurrency, CYCLE_LABELS } from '../components/utils'
import Modal from '../components/Modal'
import ScopeTabBar from '../components/ScopeTabBar'
import FormulaTooltip from '../components/FormulaTooltip'
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
  CheckCircle2,
  Circle,
  PiggyBank,
} from 'lucide-react'

const CYCLE_DIVISORS: Record<string, number> = {
  weekly: 0.25,
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
}

const WEEKDAY_LABELS: Record<number, string> = {
  1: '週一',
  2: '週二',
  3: '週三',
  4: '週四',
  5: '週五',
  6: '週六',
  7: '週日',
}

function formatScheduleLabel(item: RecurringItem, actionText: '扣款' | '入帳'): string {
  const day = item.day_of_cycle;
  const month = item.month_of_cycle || 1;
  if (item.cycle === 'weekly') {
    const wd = WEEKDAY_LABELS[day] || '週一';
    return `每${wd}${actionText}`;
  }
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
    cycle: 'monthly' as 'weekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual',
    day_of_cycle: '1',
    month_of_cycle: '1',
    account_id: '',
    is_shared: 0,
  })
  const [submitting, setSubmitting] = useState(false)
  const [settlingId, setSettlingId] = useState<string | null>(null)
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
      if (amort && Array.isArray(amort.items)) {
        setItems(amort.items)
        setAmortize(amort)
      } else {
        setItems(recList)
        if (amort) setAmortize(amort)
      }
      setAccounts(accs)
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
      let newDay = prev.day_of_cycle
      const mNum = parseInt(newMonth) || 1
      const dNum = parseInt(newDay) || 1
      if (newCycle === 'weekly') {
        newMonth = '1'
        if (dNum < 1 || dNum > 7) {
          newDay = '1'
        }
      } else if (newCycle === 'monthly') {
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
      return { ...prev, cycle: newCycle, day_of_cycle: newDay, month_of_cycle: newMonth }
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
    const month = form.cycle === 'weekly' || form.cycle === 'monthly' ? 1 : (parseInt(form.month_of_cycle) || 1)

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

  const handleToggleSettle = async (e: React.MouseEvent, item: RecurringItem) => {
    e.stopPropagation()
    if (!canModifyRecurring(item) || settlingId) return
    const nextSettled = !item.is_settled_current_cycle
    try {
      setSettlingId(item.id)
      await recurringApi.toggleSettle(item.id, nextSettled)
      await loadData(scope)
    } catch (err: any) {
      alert(err.message || '更新已繳狀態失敗')
    } finally {
      setSettlingId(null)
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

      {/* 統計卡片 (ADR-0047 & ADR-0048：每月平均扣除已繳後之待預留額 ＋ 預留不足往後平攤追補 ＋ 一年內週期準備金池) */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <span className="stat-label">
            <span>本月週期支出待預留</span>
            <FormulaTooltip
              label="檢視本月週期支出待預留計算公式"
              formula="本月待預留 ＝（週期支出每月平均總和 － 本月已繳份額）＋ 預留金不足往後平攤之本月追補額"
              calculation={`每月平均 ${formatCurrency(amortize?.monthly_expense ?? 0)} - 本月已繳 ${formatCurrency(amortize?.settled_monthly_expense ?? 0)}${(amortize?.catchup_monthly_add ?? 0) > 0 ? ` + 預留不足追補 ${formatCurrency(amortize?.catchup_monthly_add ?? 0)}` : ''} = 本月尚需預留 ${formatCurrency(amortize?.remaining_monthly_expense ?? amortize?.monthly_expense ?? 0)}`}
            />
          </span>
          <div className="stat-value" style={{ color: 'var(--color-danger)' }}>
            {formatCurrency(amortize?.remaining_monthly_expense ?? amortize?.monthly_expense ?? 0)}
          </div>
          <div className="stat-sub">
            每月平均 {formatCurrency(amortize?.monthly_expense ?? 0)} · 已繳 {formatCurrency(amortize?.settled_monthly_expense ?? 0)}
            {(amortize?.catchup_monthly_add ?? 0) > 0 && (
              <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>
                {' '}· 含不足平攤 +{formatCurrency(amortize?.catchup_monthly_add ?? 0)}
              </span>
            )}
          </div>
        </div>

        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(255,138,138,0.1) 0%, rgba(168,216,234,0.12) 100%)' }}>
          <span className="stat-label">
            <span>一年內週期準備金池</span>
            <FormulaTooltip
              label="檢視一年內週期準備金池與預留金帳戶比對公式"
              formula="截至本月底應留存準備金 ＝ ∑ 未繳長週期項目(雙月/季/半年/年) × 已累積月數 × 每月平均；截至上月底應有準備金 vs 預留金帳戶實際總額，若不足則自動往後平攤至下次繳款前的月份"
              calculation={`截至上月底應有 ${formatCurrency(amortize?.prior_expected_sinking_fund ?? 0)} vs 預留金帳戶實際總額 ${formatCurrency(amortize?.actual_reserve_balance ?? 0)}（前期缺口 ${formatCurrency(amortize?.reserve_shortfall ?? 0)}）；含本月應達標 ${formatCurrency(amortize?.accumulated_sinking_fund ?? 0)}`}
            />
          </span>
          <div className="stat-value" style={{ color: 'var(--color-primary)' }}>
            {formatCurrency(amortize?.accumulated_sinking_fund ?? 0)}
          </div>
          <div className="stat-sub">
            預留金帳戶已存 {formatCurrency(amortize?.actual_reserve_balance ?? 0)}
            {(amortize?.reserve_shortfall ?? 0) > 0
              ? ` · 缺口 ${formatCurrency(amortize?.reserve_shortfall ?? 0)} (已往後平攤)`
              : ` · 年內待付 ${formatCurrency(amortize?.annual_remaining_expense ?? 0)}`}
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            <span>週期收入每月預估</span>
            <FormulaTooltip
              label="檢視週期收入每月預估計算公式"
              formula="∑（各筆週期收入金額 ÷ 週期月數：週領×4(÷0.25)、月領÷1、雙月÷2、季領÷3、半年÷6、年領÷12）"
              calculation={
                incomeItems.length > 0
                  ? `共 ${incomeItems.length} 筆週期收入平攤合計 = ${formatCurrency(amortize?.monthly_income ?? 0)} / 月（本月已入帳 ${formatCurrency(amortize?.settled_monthly_income ?? 0)}）`
                  : `0 筆週期收入 = ${formatCurrency(0)}`
              }
            />
          </span>
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>
            {formatCurrency(amortize?.monthly_income ?? 0)}
          </div>
          <div className="stat-sub">
            {(amortize?.settled_monthly_income ?? 0) > 0
              ? `本月已入帳 ${formatCurrency(amortize?.settled_monthly_income ?? 0)}`
              : '穩定每月現金流進帳'}
          </div>
        </div>

        <div className="stat-card" style={{ background: 'var(--bg-surface-2)' }}>
          <span className="stat-label">
            <span>每月週期淨額</span>
            <FormulaTooltip
              label="檢視每月週期淨額計算公式"
              formula="週期收入每月預估 － 週期支出每月平均"
              calculation={`${formatCurrency(amortize?.monthly_income ?? 0)} - ${formatCurrency(amortize?.monthly_expense ?? 0)} = ${formatCurrency((amortize?.monthly_income ?? 0) - (amortize?.monthly_expense ?? 0))}`}
            />
          </span>
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
                const monthlyShare = item.monthly_share ?? (item.amount / (CYCLE_DIVISORS[item.cycle] || 1))
                const isConfirming = confirmingDeleteId === item.id
                const isSettled = Boolean(item.is_settled_current_cycle)
                const sinkingFund = item.accumulated_sinking_fund || 0
                return (
                  <div
                    key={item.id}
                    className="recurring-card"
                    style={isSettled ? { opacity: 0.78 } : undefined}
                    onClick={() => canModifyRecurring(item) && handleOpenEdit(item)}
                  >
                    <div className="recurring-card-main">
                      <div className="recurring-card-header">
                        <span className="recurring-card-title" style={isSettled ? { textDecoration: 'line-through' } : undefined}>
                          {item.name}
                        </span>
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
                          <span className="badge" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', fontSize: '0.7rem' }}>
                            {item.user_name}
                          </span>
                        )}
                        <span className="badge badge-expense">
                          {CYCLE_LABELS[item.cycle] || item.cycle}
                        </span>
                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                          {formatScheduleLabel(item, '扣款')}
                        </span>
                        {isSettled ? (
                          <span className="badge badge-income" style={{ fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <CheckCircle2 size={11} />
                            <span>
                              本期已繳{item.settled_source === 'transaction' ? ' · 記帳自動匹配' : ' · 已豁免預留'}
                            </span>
                          </span>
                        ) : sinkingFund > 0 ? (
                          <>
                            <span
                              className="badge"
                              style={{
                                fontSize: '0.7rem',
                                background: 'rgba(255, 138, 138, 0.14)',
                                color: 'var(--color-primary-dark)',
                                border: '1px solid var(--border-color)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                            >
                              <PiggyBank size={11} />
                              <span>應留準備金 {formatCurrency(sinkingFund)}（已累 {item.accumulated_months || 1} 個月）</span>
                            </span>
                            {(item.catchup_monthly_add ?? 0) > 0 && (
                              <span
                                className="badge badge-danger"
                                style={{
                                  fontSize: '0.7rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                              >
                                <AlertCircle size={11} />
                                <span>
                                  預留不足 {formatCurrency(item.shortfall_amount ?? 0)} · 往後平攤 {item.remaining_months_to_due ?? 1} 個月 (+{formatCurrency(item.catchup_monthly_add ?? 0)}/月)
                                </span>
                              </span>
                            )}
                          </>
                        ) : null}
                      </div>
                      <div className="recurring-card-meta">
                        {item.account_name ? `關聯扣款帳戶：${item.account_name}` : '未指定關聯帳戶'}
                        {item.cycle !== 'monthly' && ` · 換算每月平均：${formatCurrency(monthlyShare)} / 月`}
                        {` · 本月待預留：${formatCurrency(item.remaining_monthly_share ?? (isSettled ? 0 : monthlyShare))}`}
                        {(item.catchup_monthly_add ?? 0) > 0 && `（原 ${formatCurrency(monthlyShare)} + 追補 ${formatCurrency(item.catchup_monthly_add ?? 0)}）`}
                      </div>
                    </div>

                    <div className="recurring-card-side">
                      <div className="recurring-card-amount-block">
                        <div className="recurring-card-amount" style={{ color: isSettled ? 'var(--text-muted)' : 'var(--color-danger)' }}>
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
                            className={`btn btn-sm ${isSettled ? 'btn-secondary' : 'btn-ghost'}`}
                            style={{ border: '1px solid var(--border-color)' }}
                            disabled={settlingId === item.id}
                            onClick={(e) => handleToggleSettle(e, item)}
                            title={isSettled ? '取消本期已繳，恢復列入本月預留計算' : '標記本期已繳，從本月待預留額與可支配現金扣減中豁免'}
                          >
                            {isSettled ? <CheckCircle2 size={14} color="var(--color-success)" /> : <Circle size={14} />}
                            <span>{settlingId === item.id ? '處理中…' : isSettled ? '已繳' : '標記已繳'}</span>
                          </button>
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
          <div className="card empty-state">
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>尚未設定週期收入（如每月薪資、租金收益）</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {incomeItems.map((item) => {
                const monthlyShare = item.monthly_share ?? (item.amount / (CYCLE_DIVISORS[item.cycle] || 1))
                const isConfirming = confirmingDeleteId === item.id
                const isSettled = Boolean(item.is_settled_current_cycle)
                return (
                  <div
                    key={item.id}
                    className="recurring-card"
                    style={isSettled ? { opacity: 0.78 } : undefined}
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
                          <span className="badge" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', fontSize: '0.7rem' }}>
                            {item.user_name}
                          </span>
                        )}
                        <span className="badge badge-income">{CYCLE_LABELS[item.cycle] || item.cycle}</span>
                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{formatScheduleLabel(item, '入帳')}</span>
                        {isSettled && (
                          <span className="badge badge-income" style={{ fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <CheckCircle2 size={11} />
                            <span>本期已入帳{item.settled_source === 'transaction' ? ' · 記帳自動匹配' : ''}</span>
                          </span>
                        )}
                      </div>
                      <div className="recurring-card-meta">
                        {item.account_name ? `入帳帳戶：${item.account_name}` : '未指定關聯帳戶'}
                        {item.cycle !== 'monthly' && ` · 換算每月平均：${formatCurrency(monthlyShare)} / 月`}
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
                            className={`btn btn-sm ${isSettled ? 'btn-secondary' : 'btn-ghost'}`}
                            style={{ border: '1px solid var(--border-color)' }}
                            disabled={settlingId === item.id}
                            onClick={(e) => handleToggleSettle(e, item)}
                          >
                            {isSettled ? <CheckCircle2 size={14} color="var(--color-success)" /> : <Circle size={14} />}
                            <span>{settlingId === item.id ? '處理中…' : isSettled ? '已入帳' : '標記已入帳'}</span>
                          </button>
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
            {form.cycle === 'weekly' || form.cycle === 'monthly' ? (
              <div className="grid grid-2" style={{ gap: 10 }}>
                <div className="input-group">
                  <label className="input-label">付款 / 入帳週期</label>
                  <select
                    id="rec-cycle"
                    className="input"
                    value={form.cycle}
                    onChange={e => handleCycleChange(e.target.value as any)}
                  >
                    <option value="weekly">每週</option>
                    <option value="monthly">每月</option>
                    <option value="bimonthly">每雙月 (2個月)</option>
                    <option value="quarterly">每季 (3個月)</option>
                    <option value="semiannual">每半年 (6個月)</option>
                    <option value="annual">每年 (12個月)</option>
                  </select>
                </div>

                {form.cycle === 'weekly' ? (
                  <div className="input-group">
                    <label className="input-label">{form.type === 'income' ? '入帳星期' : '扣款星期'}</label>
                    <select
                      id="rec-day"
                      className="input"
                      value={form.day_of_cycle}
                      onChange={e => setForm(p => ({ ...p, day_of_cycle: e.target.value }))}
                    >
                      <option value="1">每週一</option>
                      <option value="2">每週二</option>
                      <option value="3">每週三</option>
                      <option value="4">每週四</option>
                      <option value="5">每週五</option>
                      <option value="6">每週六</option>
                      <option value="7">每週日</option>
                    </select>
                  </div>
                ) : (
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
                )}
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
                    <option value="weekly">每週</option>
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
