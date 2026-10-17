import { AccountsSkeleton } from '../components/Skeleton'
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { accountsApi, Account, BalanceSummary, householdApi } from '../api/client'
import { useStore } from '../store/useStore'
import { formatCurrency, ACCOUNT_COLORS, today } from '../components/utils'
import Modal from '../components/Modal'
import ScopeTabBar from '../components/ScopeTabBar'
import FormulaTooltip from '../components/FormulaTooltip'
import {
  Plus,
  Edit2,
  Trash2,
  Building,
  CreditCard,
  DollarSign,
  Calendar,
  AlertCircle,
  TrendingDown,
  ArrowRightLeft,
  Wallet,
  Coins,
  ShieldCheck,
  User,
  Home,
  Lock,
  CheckCircle2,
  ArrowDownRight,
  Receipt,
  ArrowRight,
  RefreshCw,
  Lightbulb,
  BarChart2,
  Banknote,
  PieChart,
  Landmark,
  Clock,
} from 'lucide-react'
import { CategoryIcon } from '../components/icons'

export default function Accounts() {
  const { user } = useStore()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [balance, setBalance] = useState<BalanceSummary | null>(null)
  const [myRole, setMyRole] = useState<'admin' | 'member' | null>(null)
  const [totalPendingAdvances, setTotalPendingAdvances] = useState(0)
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<'all' | 'household' | 'personal'>('all')
  const hasLoadedRoleRef = useRef(false)

  // 新增 / 編輯帳戶 Modal
  const [showModal, setShowModal] = useState(false)
  const [editingAcc, setEditingAcc] = useState<Account | null>(null)
  const [form, setForm] = useState({
    name: '',
    type: 'cash' as 'cash' | 'bank' | 'credit_card',
    balance: '',
    credit_limit: '',
    statement_day: '',
    payment_due_day: '',
    unbilled: '',
    is_joint: 0,
    color: ACCOUNT_COLORS[0],
  })
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // 信用卡還款 Modal
  const [payCardModal, setPayCardModal] = useState<Account | null>(null)
  const [payForm, setPayForm] = useState({
    bank_account_id: '',
    amount: '',
    date: today(),
    note: '',
    is_shared: 1,
  })
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')

  // ATM 提款 / 帳戶轉帳 Modal
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferForm, setTransferForm] = useState({
    from_account_id: '',
    to_account_id: '',
    amount: '',
    date: today(),
    note: '',
  })
  const [transferring, setTransferring] = useState(false)
  const [transferError, setTransferError] = useState('')

  const loadData = async (currentScope: 'all' | 'household' | 'personal' = scope) => {
    try {
      setLoading(true)
      const isInitial = !hasLoadedRoleRef.current
      const [accs, bal, householdData, advancesData] = await Promise.all([
        accountsApi.list(currentScope),
        accountsApi.balance(currentScope).catch(() => null),
        isInitial ? householdApi.current().catch(() => null) : Promise.resolve(undefined),
        currentScope === 'household' ? householdApi.advances().catch(() => []) : Promise.resolve([]),
      ])
      setAccounts(accs)
      if (bal) setBalance(bal)
      if (householdData !== undefined) {
        setMyRole(householdData?.myRole || null)
        hasLoadedRoleRef.current = true
      }
      if (currentScope === 'household' && Array.isArray(advancesData)) {
        const sumPending = advancesData.reduce((sum: number, a) => sum + (Number(a.pending_reimburse) || 0), 0)
        setTotalPendingAdvances(sumPending)
      } else {
        setTotalPendingAdvances(0)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // 權限檢查輔助函數 (ADR 0013)
  const canModifyAccount = (acc: Account) => {
    if (acc.is_joint === 0) {
      return !user || acc.user_id === user.id
    }
    // 家庭共同帳戶：建立者本人或家庭管理員共治
    return (!user || acc.user_id === user.id) || myRole === 'admin'
  }

  const canOperateCard = (card: Account) => {
    if (card.is_joint === 0) {
      return !user || card.user_id === user.id
    }
    return true
  }

  useEffect(() => {
    loadData(scope)
  }, [scope])

  const handleOpenAdd = (type: 'cash' | 'bank' | 'credit_card' = 'cash') => {
    setEditingAcc(null)
    setForm({
      name: '',
      type,
      balance: '0',
      credit_limit: type === 'credit_card' ? '100000' : '',
      statement_day: type === 'credit_card' ? '15' : '',
      payment_due_day: type === 'credit_card' ? '5' : '',
      unbilled: '0',
      is_joint: 0,
      color: type === 'cash' ? '#10B981' : ACCOUNT_COLORS[Math.floor(Math.random() * ACCOUNT_COLORS.length)],
    })
    setErrorMsg('')
    setShowModal(true)
  }

  const handleOpenEdit = (acc: Account) => {
    setEditingAcc(acc)
    setForm({
      name: acc.name,
      type: acc.type,
      balance: acc.balance.toString(),
      credit_limit: acc.credit_limit?.toString() || '',
      statement_day: acc.statement_day?.toString() || '',
      payment_due_day: acc.payment_due_day?.toString() || '',
      unbilled: acc.unbilled?.toString() || '0',
      is_joint: acc.is_joint || 0,
      color: acc.color || ACCOUNT_COLORS[0],
    })
    setErrorMsg('')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (!form.name.trim()) {
      setErrorMsg('請輸入資產帳戶名稱')
      return
    }

    const bal = parseFloat(form.balance) || 0
    const unb = parseFloat(form.unbilled) || 0
    const limit = form.credit_limit ? parseFloat(form.credit_limit) : undefined
    const stmtDay = form.statement_day ? parseInt(form.statement_day) : undefined
    const dueDay = form.payment_due_day ? parseInt(form.payment_due_day) : undefined

    try {
      setSubmitting(true)
      if (editingAcc) {
        await accountsApi.update(editingAcc.id, {
          name: form.name.trim(),
          type: form.type,
          balance: bal,
          unbilled: unb,
          credit_limit: limit,
          statement_day: stmtDay,
          payment_due_day: dueDay,
          is_joint: form.is_joint,
          color: form.color,
        })
      } else {
        await accountsApi.create({
          name: form.name.trim(),
          type: form.type,
          balance: bal,
          unbilled: unb,
          credit_limit: limit,
          statement_day: stmtDay,
          payment_due_day: dueDay,
          is_joint: form.is_joint,
          color: form.color,
        })
      }
      setShowModal(false)
      loadData()
    } catch (err: any) {
      setErrorMsg(err.message || '儲存帳戶失敗')
    } finally {
      setSubmitting(false)
    }
  }

  const [reconcilingCardId, setReconcilingCardId] = useState<string | null>(null)

  const handleReconcile = async (card: Account) => {
    if (!window.confirm(`確定要依據「${card.name}」的當期消費明細，自動校準未出帳金額嗎？`)) {
      return
    }
    setReconcilingCardId(card.id)
    try {
      const res = await accountsApi.reconcileCreditCard(card.id)
      alert(res.message || '校準成功！')
      loadData()
    } catch (err: any) {
      alert(err.message || '校準失敗')
    } finally {
      setReconcilingCardId(null)
    }
  }

  // 出帳作業預覽 Modal (ADR-0024)
  const [rolloverModalCard, setRolloverModalCard] = useState<Account | null>(null)
  const [rolloverPreview, setRolloverPreview] = useState<any | null>(null)
  const [rolloverLoading, setRolloverLoading] = useState(false)
  const [rolloverSubmitting, setRolloverSubmitting] = useState(false)
  const [rolloverDeferredIds, setRolloverDeferredIds] = useState<Set<string>>(new Set())
  const [rolloverError, setRolloverError] = useState('')

  const handleOpenRollover = async (card: Account) => {
    // 強制要求設定結帳日防呆 (ADR-0030)
    if (!card.statement_day || card.statement_day < 1 || card.statement_day > 31) {
      alert(`「${card.name}」尚未設定每月結帳日。\n請先點擊該卡片的「編輯」設定每月結帳日，方可執行出帳作業。`)
      return
    }

    setRolloverModalCard(card)
    setRolloverLoading(true)
    setRolloverError('')
    setRolloverDeferredIds(new Set())
    setRolloverPreview(null)
    try {
      const res = await accountsApi.rolloverPreview(card.id)
      setRolloverPreview(res)
      if (Array.isArray(res?.transactions)) {
        const deferred = res.transactions
          .filter((t: any) => {
            const isPrior = Boolean(
              t.is_prior_deferred ||
                (res.prevStatementDate && t.date <= res.prevStatementDate)
            )
            if (isPrior) {
              return false
            }
            if (t.is_initially_deferred !== undefined) {
              return Boolean(t.is_initially_deferred)
            }
            return Number(t.defer_to_next_statement) === 1
          })
          .map((t: any) => t.id)
        setRolloverDeferredIds(new Set(deferred))
      }
    } catch (err: any) {
      setRolloverError(err.message || '載入出帳預覽失敗')
    } finally {
      setRolloverLoading(false)
    }
  }

  const handleToggleDefer = (txId: string) => {
    setRolloverDeferredIds(prev => {
      const next = new Set(prev)
      if (next.has(txId)) {
        next.delete(txId)
      } else {
        next.add(txId)
      }
      return next
    })
  }

  const handleConfirmRollover = async () => {
    if (!rolloverModalCard) return
    try {
      setRolloverSubmitting(true)
      setRolloverError('')
      const res = await accountsApi.rolloverStatement(
        rolloverModalCard.id,
        Array.from(rolloverDeferredIds)
      )
      alert(res.message || '出帳作業成功！')
      setRolloverModalCard(null)
      setRolloverPreview(null)
      await loadData()
    } catch (err: any) {
      setRolloverError(err.message || '出帳作業失敗')
    } finally {
      setRolloverSubmitting(false)
    }
  }

  const handleOpenPay = (card: Account, payType: 'shared' | 'personal' | 'full' = 'full') => {
    setPayCardModal(card)
    
    let defaultAmount = (card.balance || 0) + (card.unbilled || 0)
    let isSharedTarget = 1
    if (payType === 'shared') {
      const billedShared = card.billed_shared_debt ?? 0
      const unbilledShared = card.unbilled_shared_debt ?? (card.shared_debt ?? 0)
      defaultAmount = billedShared > 0 ? billedShared : (card.shared_debt ?? unbilledShared)
      isSharedTarget = 1
    } else if (payType === 'personal') {
      const billedPersonal = card.billed_personal_debt ?? 0
      const unbilledPersonal = card.unbilled_personal_debt ?? (card.personal_debt ?? 0)
      defaultAmount = billedPersonal > 0 ? billedPersonal : (card.personal_debt ?? unbilledPersonal)
      isSharedTarget = 0
    }

    setPayForm({
      bank_account_id: '',
      amount: defaultAmount > 0 ? defaultAmount.toString() : '',
      date: today(),
      note: `扣繳【${card.name}】卡費 (${payType === 'shared' ? '家庭公帳代墊' : payType === 'personal' ? '個人私帳' : '全額'})`,
      is_shared: isSharedTarget,
    })
    setPayError('')
  }

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payCardModal) return
    setPayError('')

    if (!payForm.bank_account_id) {
      setPayError('請選擇扣款銀行帳戶')
      return
    }

    const isOtherMemberCard = payCardModal.is_joint === 0 && Boolean(user && payCardModal.user_id !== user.id)
    const maxPayable = isOtherMemberCard
      ? (payCardModal.shared_debt || 0)
      : ((payCardModal.balance || 0) + (payCardModal.unbilled || 0))
    const amt = parseFloat(payForm.amount)
    if (isNaN(amt) || amt <= 0) {
      setPayError('請輸入大於 0 的扣款金額')
      return
    }
    if (amt > maxPayable && maxPayable > 0) {
      setPayError(`還款金額不可超過${isOtherMemberCard ? '家庭代墊公帳待繳額' : '信用卡待繳總額'} NT$ ${maxPayable.toLocaleString()}`)
      return
    }

    const selectedBank = bankAccounts.find(b => b.id === payForm.bank_account_id)
    if (selectedBank && selectedBank.balance < amt) {
      if (!window.confirm(`扣款帳戶「${selectedBank.name}」目前餘額為 NT$ ${selectedBank.balance.toLocaleString()}，小於扣款金額 NT$ ${amt.toLocaleString()}。確認仍要繼續扣款嗎？`)) {
        return
      }
    }

    try {
      setPaying(true)
      await accountsApi.payCreditCard({
        bank_account_id: payForm.bank_account_id,
        credit_card_id: payCardModal.id,
        amount: amt,
        date: payForm.date,
        note: payForm.note,
        is_shared: isOtherMemberCard ? 1 : payForm.is_shared,
      })
      setPayCardModal(null)
      await loadData()
    } catch (err: any) {
      setPayError(err.message || '還款失敗')
    } finally {
      setPaying(false)
    }
  }

  // 啟動 ATM 提款 / 轉帳 Modal
  const handleOpenTransfer = (defaultFromId?: string, defaultToId?: string) => {
    const fromId = defaultFromId || ''
    const toId = defaultToId || ''
    setTransferForm({
      from_account_id: fromId,
      to_account_id: toId === fromId && fromId !== '' ? '' : toId,
      amount: '',
      date: today(),
      note: '',
    })
    setTransferError('')
    setShowTransferModal(true)
  }

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTransferError('')

    const { from_account_id, to_account_id, amount, date, note } = transferForm
    const amt = parseFloat(amount)
    if (!from_account_id || !to_account_id || isNaN(amt) || amt <= 0) {
      setTransferError('請選擇轉出、轉入帳戶，並輸入大於 0 的金額')
      return
    }
    if (from_account_id === to_account_id) {
      setTransferError('轉出與轉入帳戶不能相同')
      return
    }

    try {
      setTransferring(true)
      const res = await accountsApi.transfer({
        from_account_id,
        to_account_id,
        amount: amt,
        date,
        note,
      })
      setShowTransferModal(false)
      await loadData()
      alert(res.message || '轉帳成功！')
    } catch (err: any) {
      setTransferError(err.message || '轉帳失敗')
    } finally {
      setTransferring(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`確定要刪除「${name}」嗎？其關聯的收支紀錄亦會一併移除！`)) return
    try {
      await accountsApi.remove(id)
      loadData()
    } catch (err: any) {
      alert(err.message || '刪除失敗')
    }
  }

  const cashAccounts = accounts.filter(a => a.type === 'cash')
  const bankAccounts = accounts.filter(a => a.type === 'bank')
  const creditCards = accounts.filter(a => a.type === 'credit_card')

  if (loading && !balance) {
    return <AccountsSkeleton />
  }

  return (
    <div className="fade-in">
      {/* 頁面標題與快速操作 */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title flex items-center gap-xs">
            <Wallet size={26} color="var(--color-primary)" />
            <span>資產與帳戶管理</span>
          </h1>
          <p className="page-subtitle">現金錢包、銀行活存與信用卡分離管理，支援公私帳隔離與代墊調度</p>
        </div>
        <div className="header-actions accounts-header-actions">
          <button id="btn-atm-transfer" className="btn btn-secondary" onClick={() => handleOpenTransfer()}>
            <ArrowRightLeft size={16} />
            <span>ATM 提款 / 轉帳</span>
          </button>
          <button id="btn-add-cash" className="btn btn-secondary" onClick={() => handleOpenAdd('cash')}>
            <Wallet size={16} />
            <span>+ 新增現金錢包</span>
          </button>
          <button id="btn-add-bank" className="btn btn-secondary" onClick={() => handleOpenAdd('bank')}>
            <Building size={16} />
            <span>+ 新增銀行存款帳戶</span>
          </button>
          <button id="btn-add-cc" className="btn btn-primary" onClick={() => handleOpenAdd('credit_card')}>
            <Plus size={18} />
            <span>+ 新增信用卡</span>
          </button>
        </div>
      </div>

      {/* 帳本視角切換器 */}
      <div style={{ marginBottom: 20 }}>
        <ScopeTabBar scope={scope} onChange={setScope} />
      </div>

      {/* 家庭代墊待報銷款總覽橫幅 (ADR 0015) */}
      {scope === 'household' && totalPendingAdvances > 0 && (
        <div
          id="household-advances-banner"
          className="card"
          style={{
            marginBottom: 20,
            padding: '14px 20px',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(245, 158, 11, 0.08) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            borderRadius: 12,
          }}
        >
          <div className="flex items-center gap-sm">
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-danger)',
              }}
            >
              <Receipt size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span>家庭公帳待報銷代墊款：{formatCurrency(totalPendingAdvances)}</span>
                <FormulaTooltip
                  label="檢視家庭公帳待報銷代墊款計算公式"
                  formula="全體成員以個人私帳／現金墊付公帳總額 － 已由共同基金撥款報銷總額"
                  calculation={`各成員待報銷淨額合計 = ${formatCurrency(totalPendingAdvances)}`}
                />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                成員以個人私帳/現金墊付生活開銷，待家庭共同基金撥款報銷沖抵
              </div>
            </div>
          </div>
          <Link
            to="/family"
            className="btn btn-sm btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span>前往家庭協同報銷</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* 核心資產統計四宮格 */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span className="stat-label flex items-center gap-xs">
            <Wallet size={16} color="#10B981" />
            <span>現金錢包總額</span>
            <FormulaTooltip
              label="檢視現金錢包總額計算公式"
              formula="當前視角下所有「現金錢包」帳戶之即時餘額加總"
              calculation={
                cashAccounts.length > 0
                  ? `${cashAccounts.map(a => `${a.name} ${formatCurrency(a.balance)}`).join(' + ')} = ${formatCurrency(balance?.cashTotal ?? 0)}`
                  : `0 個現金錢包 = ${formatCurrency(0)}`
              }
            />
          </span>
          <div className="stat-value" style={{ color: '#10B981' }}>
            {formatCurrency(balance?.cashTotal ?? 0)}
          </div>
          <div className="stat-sub">{cashAccounts.length} 個現金錢包 / 零用金盒</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span className="stat-label flex items-center gap-xs">
            <Building size={16} color="#3B82F6" />
            <span>銀行存款總額</span>
            <FormulaTooltip
              label="檢視銀行存款總額計算公式"
              formula="當前視角下所有「銀行存款帳戶」之活存餘額加總"
              calculation={
                bankAccounts.length > 0
                  ? `${bankAccounts.map(a => `${a.name} ${formatCurrency(a.balance)}`).join(' + ')} = ${formatCurrency(balance?.bankTotal ?? 0)}`
                  : `0 個銀行存款帳戶 = ${formatCurrency(0)}`
              }
            />
          </span>
          <div className="stat-value" style={{ color: 'var(--color-primary)' }}>
            {formatCurrency(balance?.bankTotal ?? 0)}
          </div>
          <div className="stat-sub">{bankAccounts.length} 個銀行存款帳戶</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
          <span className="stat-label flex items-center gap-xs">
            <CreditCard size={16} color="var(--color-danger)" />
            <span>信用卡總待繳</span>
            <FormulaTooltip
              label="檢視信用卡總待繳計算公式"
              formula={
                scope === 'household'
                  ? '家庭共同信用卡總欠款 ＋ 成員個人私卡上之家庭公帳代墊欠款'
                  : '當前視角下所有信用卡之「已出帳待繳款 ＋ 未出帳款」總和'
              }
              calculation={`已出帳 ${formatCurrency(balance?.ccBilled ?? 0)} + 未出帳 ${formatCurrency(balance?.ccUnbilled ?? 0)} = ${formatCurrency((balance?.ccBilled ?? 0) + (balance?.ccUnbilled ?? 0))}`}
            />
          </span>
          <div className="stat-value" style={{ color: 'var(--color-danger)' }}>
            {formatCurrency((balance?.ccBilled ?? 0) + (balance?.ccUnbilled ?? 0))}
          </div>
          <div className="stat-sub">
            已出帳：{formatCurrency(balance?.ccBilled ?? 0)} · 未出帳：{formatCurrency(balance?.ccUnbilled ?? 0)}
          </div>
        </div>

        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(255,138,138,0.12) 0%, rgba(168,216,234,0.15) 100%)', borderLeft: '4px solid var(--text-primary)' }}>
          <span className="stat-label flex items-center gap-xs">
            <ShieldCheck size={16} color="var(--color-primary)" />
            <span>淨可用餘額</span>
            <FormulaTooltip
              label="檢視淨可用餘額計算公式"
              formula="現金錢包總額 ＋ 銀行存款總額 － 信用卡總待繳（已出帳 ＋ 未出帳）"
              calculation={`${formatCurrency(balance?.cashTotal ?? 0)} + ${formatCurrency(balance?.bankTotal ?? 0)} - ${formatCurrency((balance?.ccBilled ?? 0) + (balance?.ccUnbilled ?? 0))} = ${formatCurrency(balance?.available ?? 0)}`}
            />
          </span>
          <div className="stat-value" style={{ color: (balance?.available ?? 0) >= 0 ? 'var(--text-primary)' : 'var(--color-danger)' }}>
            {formatCurrency(balance?.available ?? 0)}
          </div>
          <div className="stat-sub">現金 + 銀行存款 - 信用卡待繳</div>
        </div>
      </div>

      {/* 專區一：現金錢包 */}
      <div style={{ marginBottom: 32 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <h2 className="text-xl flex items-center gap-xs">
            <Wallet size={20} color="#10B981" />
            現金錢包 ({cashAccounts.length})
          </h2>
          <button className="btn btn-sm btn-secondary" onClick={() => handleOpenAdd('cash')}>
            + 新增現金錢包
          </button>
        </div>

        {cashAccounts.length === 0 ? (
          <div className="card empty-state">
            <div className="emoji"><Wallet size={40} /></div>
            <h3>目前此範圍無現金錢包</h3>
            <p>建立你的個人隨身現金錢包或客廳公用零用金盒，掌握實體現鈔流向！</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => handleOpenAdd('cash')}>
              立即建立現金錢包
            </button>
          </div>
        ) : (
          <div className="grid grid-3">
            {cashAccounts.map(cash => (
              <div key={cash.id} className="card account-card" style={{ borderTop: `4px solid ${cash.color || '#10B981'}` }}>
                <div className="account-card-header">
                  <div className="account-name-group">
                    <span className="account-color-dot" style={{ backgroundColor: cash.color || '#10B981' }} />
                    <h3 className="account-name">{cash.name}</h3>
                  </div>
                  {canModifyAccount(cash) && (
                    <div className="flex gap-xs">
                      <button className="btn-icon" title="編輯" onClick={() => handleOpenEdit(cash)}>
                        <Edit2 size={16} />
                      </button>
                      <button className="btn-icon danger" title="刪除" onClick={() => handleDelete(cash.id, cash.name)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="account-balance-group" style={{ margin: '14px 0' }}>
                  <span className="account-balance-label">現金錢包餘額</span>
                  <div className="account-balance" style={{ color: '#10B981', fontSize: '1.75rem', fontWeight: 700 }}>
                    {formatCurrency(cash.balance)}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-sm border-t" style={{ marginTop: 12 }}>
                  <div className="flex gap-xs">
                    {cash.is_joint === 1 ? (
                      <span className="badge badge-primary" style={{ gap: 3 }}>
                        <Home size={11} />
                        <span>公帳</span>
                      </span>
                    ) : (
                      <span className="badge badge-secondary" style={{ gap: 3 }}>
                        <Lock size={11} />
                        <span>私帳</span>
                      </span>
                    )}
                    {cash.owner_name && (
                      <span className="badge" style={{ background: 'rgba(0,0,0,0.06)' }}>
                        {cash.owner_name}
                      </span>
                    )}
                  </div>
                  <button
                    className="btn btn-sm btn-secondary"
                    title="從銀行 ATM 領錢至此現金錢包"
                    onClick={() => handleOpenTransfer(undefined, cash.id)}
                  >
                    <ArrowDownRight size={14} style={{ marginRight: 2 }} />
                    ATM 提款
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 專區二：銀行帳戶 */}
      <div style={{ marginBottom: 32 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <h2 className="text-xl flex items-center gap-xs">
            <Building size={20} color="var(--color-primary)" />
            銀行存款帳戶 ({bankAccounts.length})
          </h2>
          <button className="btn btn-sm btn-secondary" onClick={() => handleOpenAdd('bank')}>
            + 新增銀行
          </button>
        </div>

        {bankAccounts.length === 0 ? (
          <div className="card empty-state">
            <div className="emoji"><Building size={40} /></div>
            <h3>目前此範圍無銀行帳戶</h3>
            <p>新增個人薪轉、活存或家庭共同基金帳戶，輕鬆追蹤儲蓄與扣款。</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => handleOpenAdd('bank')}>
              立即新增銀行存款帳戶
            </button>
          </div>
        ) : (
          <div className="grid grid-3">
            {bankAccounts.map(acc => (
              <div key={acc.id} className="card account-card" style={{ borderTop: `4px solid ${acc.color}` }}>
                <div className="account-card-header">
                  <div className="account-name-group">
                    <span className="account-color-dot" style={{ backgroundColor: acc.color }} />
                    <h3 className="account-name">{acc.name}</h3>
                  </div>
                  {canModifyAccount(acc) && (
                    <div className="flex gap-xs">
                      <button className="btn-icon" title="編輯" onClick={() => handleOpenEdit(acc)}>
                        <Edit2 size={16} />
                      </button>
                      <button className="btn-icon danger" title="刪除" onClick={() => handleDelete(acc.id, acc.name)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="account-balance-group" style={{ margin: '14px 0' }}>
                  <span className="account-balance-label">存款餘額</span>
                  <div className="account-balance" style={{ color: 'var(--color-primary)', fontSize: '1.75rem', fontWeight: 700 }}>
                    {formatCurrency(acc.balance)}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-sm border-t" style={{ marginTop: 12 }}>
                  <div className="flex gap-xs">
                    {acc.is_joint === 1 ? (
                      <span className="badge badge-primary" style={{ gap: 3 }}>
                        <Home size={11} />
                        <span>公帳</span>
                      </span>
                    ) : (
                      <span className="badge badge-secondary" style={{ gap: 3 }}>
                        <Lock size={11} />
                        <span>私帳</span>
                      </span>
                    )}
                    {acc.owner_name && (
                      <span className="badge" style={{ background: 'rgba(0,0,0,0.06)' }}>
                        {acc.owner_name}
                      </span>
                    )}
                  </div>
                  <button
                    className="btn btn-sm btn-secondary"
                    title="以此銀行轉帳或提款"
                    onClick={() => handleOpenTransfer(acc.id, undefined)}
                  >
                    <ArrowRightLeft size={14} style={{ marginRight: 2 }} />
                    轉帳 / 提款
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 專區三：信用卡專區 */}
      <div style={{ marginBottom: 32 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <h2 className="text-xl flex items-center gap-xs">
            <CreditCard size={20} color="var(--color-danger)" />
            信用卡 ({creditCards.length})
          </h2>
          <button className="btn btn-sm btn-secondary" onClick={() => handleOpenAdd('credit_card')}>
            + 新增信用卡
          </button>
        </div>

        {creditCards.length === 0 ? (
          <div className="card empty-state">
            <div className="emoji"><CreditCard size={40} /></div>
            <h3>目前此範圍無信用卡</h3>
            <p>新增信用卡可掌握家庭公帳代墊與個人私帳刷卡分流，避免突襲式信用卡待繳款！</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => handleOpenAdd('credit_card')}>
              立即新增信用卡
            </button>
          </div>
        ) : (
          <div className="grid grid-2">
            {creditCards.map(card => {
              const isOtherMemberCard = card.is_joint === 0 && Boolean(user && card.user_id !== user.id)
              const isMasked = Boolean(card.is_masked || isOtherMemberCard)
              const billed = card.balance || 0
              const unbilled = card.unbilled || 0
              const totalDue = billed + unbilled
              const billedShared = card.billed_shared_debt ?? 0
              const billedPersonal = card.billed_personal_debt ?? Math.max(0, billed - billedShared)
              const unbilledShared = card.unbilled_shared_debt ?? 0
              const unbilledPersonal = card.unbilled_personal_debt ?? Math.max(0, unbilled - unbilledShared)
              const sharedDebt = card.shared_debt ?? (billedShared + unbilledShared)
              const personalDebt = card.personal_debt ?? (billedPersonal + unbilledPersonal)
              const limit = card.credit_limit || 0
              const remainingLimit = isMasked ? null : (limit > 0 ? Math.max(0, limit - totalDue) : null)

              return (
                <div key={card.id} className="card cc-card" style={{ borderTop: `4px solid ${card.color}` }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                    <div className="account-name-group">
                      <span className="account-color-dot" style={{ backgroundColor: card.color }} />
                      <h3 className="account-name">{card.name}</h3>
                      {card.is_joint === 1 ? (
                        <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Home size={11} /> 公帳
                        </span>
                      ) : scope === 'household' ? (
                        <span
                          className="badge badge-secondary"
                          style={{
                            background: 'rgba(245, 158, 11, 0.14)',
                            color: 'var(--color-amber-text)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Lock size={11} /> 私卡代墊
                        </span>
                      ) : (
                        <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Lock size={11} /> 私帳
                        </span>
                      )}
                      {card.owner_name && (
                        <span className="badge" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                          {card.owner_name}
                        </span>
                      )}
                    </div>
                    {canModifyAccount(card) && (
                      <div className="flex gap-xs">
                        <button className="btn-icon" title="編輯" onClick={() => handleOpenEdit(card)}>
                          <Edit2 size={16} />
                        </button>
                        <button className="btn-icon danger" title="刪除" onClick={() => handleDelete(card.id, card.name)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 待繳總額 */}
                  <div className="cc-due-hero" style={{ background: 'rgba(255,138,138,0.08)', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {isMasked ? '家庭公帳代墊待繳總額' : '待繳款總負債'}
                      </span>
                      <span style={{ fontSize: '1.4rem', fontWeight: 800, color: (isMasked ? sharedDebt : totalDue) > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                        {formatCurrency(isMasked ? sharedDebt : totalDue)}
                      </span>
                    </div>

                    <div className="grid grid-2 gap-sm" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border-color)' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {isMasked ? '本期公帳待繳' : '已出帳待繳款'}
                        </div>
                        <div style={{ fontWeight: 600, color: ((!isMasked && billed > 0) || (isMasked && billedShared > 0)) ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                          {isMasked ? (
                            billedShared > 0 ? formatCurrency(billedShared) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                                <Lock size={12} /> 無待繳公帳
                              </span>
                            )
                          ) : formatCurrency(billed)}
                        </div>
                        {!isMasked && billed > 0 && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>公 {formatCurrency(billedShared)}</span>
                            <span style={{ opacity: 0.4 }}>·</span>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>私 {formatCurrency(billedPersonal)}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {isMasked ? '未出帳公帳代墊' : '未出帳（累計消費）'}
                          </span>
                          {canOperateCard(card) && (
                            <div className="flex gap-xs" style={{ flexWrap: 'wrap' }}>
                              <button
                                id={`btn-reconcile-${card.id}`}
                                className="btn btn-xs btn-secondary cc-sub-action-btn"
                                title="依當前消費紀錄自動校準未出帳金額"
                                onClick={() => handleReconcile(card)}
                                disabled={reconcilingCardId === card.id}
                              >
                                {reconcilingCardId === card.id ? '校準中...' : <><RefreshCw size={12} /> 校準</>}
                              </button>
                              {(card.statement_day || unbilled > 0 || billed > 0) && (
                                <button
                                  className="btn btn-xs btn-secondary cc-sub-action-btn"
                                  title="結帳日出帳作業與週期明細檢視"
                                  onClick={() => handleOpenRollover(card)}
                                >
                                  出帳作業
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{ fontWeight: 600, color: isMasked ? 'var(--color-primary)' : 'inherit' }}>
                          {isMasked ? formatCurrency(unbilledShared) : formatCurrency(unbilled)}
                        </div>
                        {!isMasked && unbilled > 0 && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>公 {formatCurrency(unbilledShared)}</span>
                            <span style={{ opacity: 0.4 }}>·</span>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>私 {formatCurrency(unbilledPersonal)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 公私債務即時拆解 */}
                  <div style={{ background: 'var(--bg-surface-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <PieChart size={13} /> 負債性質拆解：
                    </div>
                    <div className="flex items-center justify-between" style={{ fontSize: '0.85rem', marginBottom: 2 }}>
                      <span className="flex items-center gap-xs">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }} />
                        <Home size={13} /> 家庭代墊公帳：
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                        {formatCurrency(sharedDebt)}
                      </span>
                    </div>
                    {sharedDebt > 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', paddingLeft: 16, marginBottom: 6 }}>
                        本期已出帳待繳：<strong style={{ color: 'var(--color-primary)' }}>{formatCurrency(billedShared)}</strong> · 未出帳累計：{formatCurrency(unbilledShared)}
                      </div>
                    )}
                    <div className="flex items-center justify-between" style={{ fontSize: '0.85rem', marginBottom: 2 }}>
                      <span className="flex items-center gap-xs">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-secondary)' }} />
                        <User size={13} /> 個人私帳消費：
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {isMasked ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Lock size={12} /> 隱私遮蔽
                          </span>
                        ) : formatCurrency(personalDebt)}
                      </span>
                    </div>
                    {personalDebt > 0 && !isMasked && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', paddingLeft: 16 }}>
                        本期已出帳待繳：<strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(billedPersonal)}</strong> · 未出帳累計：{formatCurrency(unbilledPersonal)}
                      </div>
                    )}
                  </div>

                  {/* 帳單週期資訊 */}
                  <div className="flex items-center justify-between" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
                    <span>每月 {card.statement_day || '--'} 日結帳 · {card.payment_due_day || '--'} 日繳款</span>
                    {remainingLimit !== null ? (
                      <span>剩餘額度：{formatCurrency(remainingLimit)}</span>
                    ) : (
                      <span>剩餘額度：--</span>
                    )}
                  </div>

                  {/* 還款操作按鈕組 */}
                  {totalDue > 0 && canOperateCard(card) ? (
                    <div className="cc-action-btns">
                      <button
                        className="btn btn-sm btn-secondary"
                        style={{ border: '1px solid var(--color-primary)', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={() => handleOpenPay(card, 'shared')}
                        disabled={sharedDebt <= 0}
                      >
                        <Home size={13} /> 繳家庭代墊 {billedShared > 0 ? `(${formatCurrency(billedShared)})` : `(${formatCurrency(sharedDebt)})`}
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={() => handleOpenPay(card, 'personal')}
                        disabled={personalDebt <= 0}
                      >
                        <User size={13} /> 繳個人私帳 {billedPersonal > 0 ? `(${formatCurrency(billedPersonal)})` : `(${formatCurrency(personalDebt)})`}
                      </button>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleOpenPay(card, 'full')}
                      >
                        全額結清
                      </button>
                    </div>
                  ) : isMasked ? (
                    sharedDebt > 0 ? (
                      <div className="flex flex-col gap-xs">
                        <button
                          className="btn btn-sm btn-primary"
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          onClick={() => handleOpenPay(card, 'shared')}
                        >
                          <Home size={14} />
                          <span>繳家庭代墊款 {billedShared > 0 ? `(${formatCurrency(billedShared)})` : `(${formatCurrency(sharedDebt)})`}</span>
                        </button>
                        <div className="text-center" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <Lock size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                          他人私卡僅開放自共同帳戶繳納家庭代墊款
                        </div>
                      </div>
                    ) : (
                      <div className="text-center" style={{ fontSize: '0.85rem', color: 'var(--color-success)', padding: '6px 0', fontWeight: 600 }}>
                        <CheckCircle2 size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                        家庭公帳代墊款已全數清償
                      </div>
                    )
                  ) : totalDue > 0 ? (
                    <div className="text-center" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '6px 0' }}>
                      <Lock size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                      個人私卡僅持卡人本人可執行繳款沖銷作業
                    </div>
                  ) : (
                    <div className="text-center" style={{ fontSize: '0.85rem', color: 'var(--color-success)', padding: '6px 0', fontWeight: 600 }}>
                      <CheckCircle2 size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                      信用卡待繳款已全數結清，無待繳款項
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 新增 / 編輯帳戶 Modal */}
      {showModal && (
        <Modal
          
          onClose={() => setShowModal(false)}
          title={editingAcc ? '編輯帳戶 / 錢包' : '新增帳戶 / 錢包'}
        >
          <form onSubmit={handleSubmit}>
            {errorMsg && <div className="alert alert-danger" style={{ marginBottom: 14 }}>{errorMsg}</div>}

            {/* 帳戶類型選擇 (僅新增時可切換) */}
            {!editingAcc && (
              <div className="form-group">
                <label className="form-label">帳戶類型</label>
                <div className="grid grid-3 gap-xs">
                  <button
                    type="button"
                    className={`btn ${form.type === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    onClick={() => setForm(p => ({ ...p, type: 'cash', color: '#10B981' }))}
                  >
                    <Wallet size={15} /> 現金錢包
                  </button>
                  <button
                    type="button"
                    className={`btn ${form.type === 'bank' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    onClick={() => setForm(p => ({ ...p, type: 'bank', color: '#3B82F6' }))}
                  >
                    <Landmark size={15} /> 銀行存款
                  </button>
                  <button
                    type="button"
                    className={`btn ${form.type === 'credit_card' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    onClick={() => setForm(p => ({ ...p, type: 'credit_card', color: '#EF4444' }))}
                  >
                    <CreditCard size={15} /> 信用卡
                  </button>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">{form.type === 'cash' ? '錢包名稱' : form.type === 'bank' ? '銀行名稱' : '信用卡名稱'}</label>
              <input
                type="text"
                className="input"
                placeholder={form.type === 'cash' ? '例如：我的現金錢包、客廳零用金盒' : form.type === 'bank' ? '例如：台新活存、家庭共同基金' : '例如：國泰世華 CUBE 卡'}
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                required
              />
            </div>

            {form.type !== 'credit_card' ? (
              <div className="form-group">
                <label className="form-label">{form.type === 'cash' ? '目前現金餘額 (NT$)' : '目前存款餘額 (NT$)'}</label>
                <input
                  type="number"
                  step="any"
                  className="input"
                  placeholder="0"
                  value={form.balance}
                  onChange={e => setForm(p => ({ ...p, balance: e.target.value }))}
                  required
                />
              </div>
            ) : (
              <>
                <div className="grid grid-2 gap-sm">
                  <div className="form-group">
                    <label className="form-label">信用額度 (NT$)</label>
                    <input
                      type="number"
                      step="any"
                      className="input"
                      value={form.credit_limit}
                      onChange={e => setForm(p => ({ ...p, credit_limit: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">目前未出帳金額 (NT$)</label>
                    <input
                      type="number"
                      step="any"
                      className="input"
                      value={form.unbilled}
                      onChange={e => setForm(p => ({ ...p, unbilled: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-2 gap-sm">
                  <div className="form-group">
                    <label className="form-label">每月結帳日 (1-31)</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      className="input"
                      value={form.statement_day}
                      onChange={e => setForm(p => ({ ...p, statement_day: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">每月繳款日 (1-31)</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      className="input"
                      value={form.payment_due_day}
                      onChange={e => setForm(p => ({ ...p, payment_due_day: e.target.value }))}
                    />
                  </div>
                </div>
              </>
            )}

            {/* 公私屬性 */}
            <div className="form-group">
              <label className="form-label">帳戶屬性歸屬</label>
              <div className="binary-toggle-grid">
                <button
                  type="button"
                  className={`btn ${form.is_joint === 0 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onClick={() => setForm(p => ({ ...p, is_joint: 0 }))}
                >
                  <Lock size={14} /> 私帳
                </button>
                <button
                  type="button"
                  className={`btn ${form.is_joint === 1 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onClick={() => setForm(p => ({ ...p, is_joint: 1 }))}
                >
                  <Home size={14} /> 公帳
                </button>
              </div>
              <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: 4 }}>
                {form.is_joint === 0
                  ? '個人私帳僅你本人可見，其他家庭成員無法檢視餘額。'
                  : form.type === 'credit_card'
                    ? '家庭信用卡帳戶將對家庭群組全體成員公開。'
                    : '家庭共同基金帳戶將對家庭群組全體成員公開。'}
              </small>
            </div>

            {/* 色彩選擇 */}
            <div className="form-group">
              <label className="form-label">色彩代表色</label>
              <div className="flex gap-xs" style={{ flexWrap: 'wrap' }}>
                {ACCOUNT_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className="color-picker-btn"
                    style={{
                      backgroundColor: c,
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: form.color === c ? '2px solid #000' : 'none',
                      cursor: 'pointer',
                    }}
                    onClick={() => setForm(p => ({ ...p, color: c }))}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-sm" style={{ marginTop: 24 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                取消
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? '儲存中...' : editingAcc ? '更新帳戶' : '立即新增'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ATM 提款 / 帳戶轉帳 Modal */}
      {showTransferModal && (
        <Modal
          
          onClose={() => setShowTransferModal(false)}
          title="ATM 提款 / 帳戶轉帳"
        >
          <form onSubmit={handleTransferSubmit}>
            {transferError && <div className="alert alert-danger" style={{ marginBottom: 14 }}>{transferError}</div>}

            <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.85rem', color: 'var(--color-success)' }}>
              <Lightbulb size={15} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              帳戶間互轉或 ATM 提領現鈔純屬資產調度，<strong>不會</strong>被列為生活消費支出，淨可用餘額維持準確！
            </div>

            {/* 快速情境切換 */}
            <div className="form-group">
              <label className="form-label">快捷情境</label>
              <div className="flex gap-xs" style={{ flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-xs btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  onClick={() => {
                    const firstBank = bankAccounts[0]?.id || ''
                    const firstCash = cashAccounts[0]?.id || ''
                    if (firstBank && firstCash) {
                      setTransferForm(p => ({ ...p, from_account_id: firstBank, to_account_id: firstCash, note: 'ATM 提領現鈔至現金錢包' }))
                    }
                  }}
                >
                  <ArrowRightLeft size={13} /> ATM 提款至現金錢包
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  onClick={() => {
                    const firstCash = cashAccounts[0]?.id || ''
                    const firstBank = bankAccounts[0]?.id || ''
                    if (firstCash && firstBank) {
                      setTransferForm(p => ({ ...p, from_account_id: firstCash, to_account_id: firstBank, note: '存入現金至銀行' }))
                    }
                  }}
                >
                  <Landmark size={13} /> 存款至銀行
                </button>
              </div>
            </div>

            <div className="grid grid-2 gap-sm">
              <div className="form-group">
                <label className="form-label">轉出帳戶 (扣款)</label>
                <select
                  className="input"
                  value={transferForm.from_account_id}
                  onChange={e => setTransferForm(p => ({ ...p, from_account_id: e.target.value }))}
                  required
                >
                  <option value="" disabled>-- 請選擇轉出帳戶 --</option>
                  {accounts.filter(a => a.type !== 'credit_card').map(a => (
                    <option key={a.id} value={a.id}>
                      {a.type === 'cash' ? '現金' : '銀行'} - {a.name} (餘額: {formatCurrency(a.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">轉入帳戶 (存入)</label>
                <select
                  className="input"
                  value={transferForm.to_account_id}
                  onChange={e => setTransferForm(p => ({ ...p, to_account_id: e.target.value }))}
                  required
                >
                  <option value="" disabled>-- 請選擇轉入帳戶 --</option>
                  {accounts.filter(a => a.type !== 'credit_card' && a.id !== transferForm.from_account_id).map(a => (
                    <option key={a.id} value={a.id}>
                      {a.type === 'cash' ? '現金' : '銀行'} - {a.name} (餘額: {formatCurrency(a.balance)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-2 gap-sm">
              <div className="form-group">
                <label className="form-label">金額 (NT$)</label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  className="input"
                  placeholder="例如：3000"
                  value={transferForm.amount}
                  onChange={e => setTransferForm(p => ({ ...p, amount: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">日期</label>
                <input
                  type="date"
                  className="input"
                  value={transferForm.date}
                  onChange={e => setTransferForm(p => ({ ...p, date: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">備註 (選填)</label>
              <input
                type="text"
                className="input"
                placeholder="例如：超商 ATM 提款、薪資轉家庭公帳"
                value={transferForm.note}
                onChange={e => setTransferForm(p => ({ ...p, note: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-sm" style={{ marginTop: 24 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>
                取消
              </button>
              <button type="submit" className="btn btn-primary" disabled={transferring}>
                {transferring ? '處理中...' : '確認轉帳 / 提款'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 信用卡還款 Modal */}
      {payCardModal && (
        <Modal
          
          onClose={() => setPayCardModal(null)}
          title={`信用卡繳費沖銷 — ${payCardModal.name}`}
        >
          <form onSubmit={handlePaySubmit}>
            {payError && <div className="alert alert-danger" style={{ marginBottom: 14 }}>{payError}</div>}

            <div className="form-group">
              <label className="form-label">扣款銀行存款帳戶</label>
              <select
                className="input"
                value={payForm.bank_account_id}
                onChange={e => setPayForm(p => ({ ...p, bank_account_id: e.target.value }))}
                required
              >
                <option value="" disabled>-- 請選擇扣款銀行 --</option>
                {bankAccounts.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} (目前存款餘額: {formatCurrency(b.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-2 gap-sm">
              <div className="form-group">
                <label className="form-label">還款扣款金額 (NT$)</label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  className="input"
                  value={payForm.amount}
                  onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">扣款日期</label>
                <input
                  type="date"
                  className="input"
                  value={payForm.date}
                  onChange={e => setPayForm(p => ({ ...p, date: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* 快捷金額標籤 (滿寬整行排版) */}
            <div className="form-group" style={{ marginTop: -4, marginBottom: 16 }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                快捷填入扣款金額：
              </div>
              <div className="flex flex-wrap gap-xs">
                {payForm.is_shared === 1 ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-xs btn-secondary"
                      onClick={() => setPayForm(p => ({ ...p, amount: (payCardModal.billed_shared_debt || 0).toString() }))}
                      disabled={(payCardModal.billed_shared_debt || 0) <= 0}
                    >
                      當期已出帳公帳: {formatCurrency(payCardModal.billed_shared_debt || 0)}
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-secondary"
                      onClick={() => setPayForm(p => ({ ...p, amount: (payCardModal.shared_debt || 0).toString() }))}
                      disabled={(payCardModal.shared_debt || 0) <= 0}
                    >
                      結清全部代墊: {formatCurrency(payCardModal.shared_debt || 0)}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-xs btn-secondary"
                      onClick={() => setPayForm(p => ({ ...p, amount: (payCardModal.billed_personal_debt || 0).toString() }))}
                      disabled={(payCardModal.billed_personal_debt || 0) <= 0}
                    >
                      當期已出帳私帳: {formatCurrency(payCardModal.billed_personal_debt || 0)}
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-secondary"
                      onClick={() => setPayForm(p => ({ ...p, amount: (payCardModal.personal_debt || 0).toString() }))}
                      disabled={(payCardModal.personal_debt || 0) <= 0}
                    >
                      結清全部私帳: {formatCurrency(payCardModal.personal_debt || 0)}
                    </button>
                  </>
                )}
                {(payCardModal.is_joint === 1 || (user && payCardModal.user_id === user.id)) && (
                  <button
                    type="button"
                    className="btn btn-xs btn-secondary"
                    onClick={() => setPayForm(p => ({ ...p, amount: ((payCardModal.balance || 0) + (payCardModal.unbilled || 0)).toString() }))}
                    disabled={((payCardModal.balance || 0) + (payCardModal.unbilled || 0)) <= 0}
                  >
                    全額待繳: {formatCurrency((payCardModal.balance || 0) + (payCardModal.unbilled || 0))}
                  </button>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">還款性質歸屬</label>
              {payCardModal.is_joint === 0 && user && payCardModal.user_id !== user.id ? (
                <div style={{ padding: '8px 12px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: 6, fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                  <Home size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                  公帳（僅限自家庭共同帳戶沖抵他人私卡之家庭代墊款）
                </div>
              ) : (
              <div className="binary-toggle-grid">
                <button
                  type="button"
                  className={`btn ${payForm.is_shared === 1 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onClick={() => {
                    const billedShared = payCardModal.billed_shared_debt ?? 0
                    const defaultShared = billedShared > 0 ? billedShared : (payCardModal.shared_debt ?? 0)
                    setPayForm(p => ({
                      ...p,
                      is_shared: 1,
                      amount: defaultShared > 0 ? defaultShared.toString() : p.amount,
                      note: `扣繳【${payCardModal.name}】卡費 (家庭公帳代墊)`
                    }))
                  }}
                >
                  <Home size={14} /> 公帳
                </button>
                <button
                  type="button"
                  className={`btn ${payForm.is_shared === 0 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onClick={() => {
                    const billedPersonal = payCardModal.billed_personal_debt ?? 0
                    const defaultPersonal = billedPersonal > 0 ? billedPersonal : (payCardModal.personal_debt ?? 0)
                    setPayForm(p => ({
                      ...p,
                      is_shared: 0,
                      amount: defaultPersonal > 0 ? defaultPersonal.toString() : p.amount,
                      note: `扣繳【${payCardModal.name}】卡費 (個人私帳)`
                    }))
                  }}
                >
                  <Lock size={14} /> 私帳
                </button>
              </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">備註</label>
              <input
                type="text"
                className="input"
                value={payForm.note}
                onChange={e => setPayForm(p => ({ ...p, note: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-sm" style={{ marginTop: 24 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setPayCardModal(null)}>
                取消
              </button>
              <button type="submit" className="btn btn-primary" disabled={paying}>
                {paying ? '繳款扣款中...' : '確認信用卡扣款還款信用卡待繳款'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 結帳日出帳作業預覽 Modal (ADR-0024) */}
      {rolloverModalCard && (
        <Modal
          maxWidth={720}
          onClose={() => {
            if (!rolloverSubmitting) {
              setRolloverModalCard(null)
              setRolloverPreview(null)
            }
          }}
          title={`結帳日出帳作業預覽 — ${rolloverModalCard.name}`}
        >
          {rolloverError && (
            <div className="alert alert-danger" style={{ marginBottom: 14 }}>
              {rolloverError}
            </div>
          )}

          {rolloverLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
              <RefreshCw size={24} className="spin" style={{ marginBottom: 8, display: 'inline-block' }} />
              <div>正在計算本期結帳週期之消費與刷退明細...</div>
            </div>
          ) : rolloverPreview ? (
            <div>
              {/* 結算週期資訊條 */}
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div className="flex items-center gap-xs" style={{ fontSize: '0.88rem', color: 'var(--color-blue-text)', fontWeight: 600, flexWrap: 'wrap' }}>
                  <Calendar size={16} />
                  <span>
                    本期結算區間：
                    {rolloverPreview.displayText || (
                      rolloverPreview.isPreStatement
                        ? `${rolloverPreview.startDate || `${rolloverPreview.prevStatementDate} 次日`} ～ ${rolloverPreview.endDate || rolloverPreview.statementDate}（當月 ${rolloverModalCard.statement_day || '--'} 號結帳日未到，結算上期帳單）`
                        : `${rolloverPreview.startDate || `${rolloverPreview.prevStatementDate} 次日`} ～ ${rolloverPreview.endDate || rolloverPreview.statementDate}（當月 ${rolloverModalCard.statement_day || '--'} 號結帳日已過，結算本期帳單）`
                    )}
                  </span>
                  {Number(rolloverPreview.priorDeferredCount || 0) > 0 && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: '0.73rem',
                        fontWeight: 600,
                        background: 'rgba(99, 102, 241, 0.16)',
                        color: 'var(--color-indigo-text)',
                        padding: '1px 7px',
                        borderRadius: 10,
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                      }}
                    >
                      含 {rolloverPreview.priorDeferredCount} 筆歷史延入款（已預設納入結算）
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  每月 {rolloverModalCard.statement_day || '--'} 號結帳 · {rolloverModalCard.payment_due_day || '--'} 號繳款
                </div>
              </div>

              {(() => {
                const allTxs = rolloverPreview.transactions || []
                const isPriorTx = (t: any) =>
                  Boolean(t.is_prior_deferred || (rolloverPreview.prevStatementDate && t.date <= rolloverPreview.prevStatementDate))

                const activeTxs = allTxs.filter((t: any) => !rolloverDeferredIds.has(t.id))
                const activeExp = activeTxs.filter((t: any) => t.type === 'expense')
                const activeRef = activeTxs.filter((t: any) => t.type === 'income')
                const curExp = activeExp.reduce((s: number, t: any) => s + Number(t.amount || 0), 0)
                const curRef = activeRef.reduce((s: number, t: any) => s + Number(t.amount || 0), 0)
                const curNet = Math.max(0, curExp - curRef)
                const activeCount = activeTxs.length

                // 方案 B 固定總額基準：本期新增（當期區間內全部交易）、本期延後（勾選延至下期）、上期延入（早於起始日之延入交易）
                const cycleNewTxs = allTxs.filter((t: any) => !isPriorTx(t))
                const cycleNewNet = cycleNewTxs.reduce(
                  (s: number, t: any) => s + (t.type === 'expense' ? Number(t.amount || 0) : -Number(t.amount || 0)),
                  0
                )
                const cycleNewCount = cycleNewTxs.length

                const priorDeferredTxs = allTxs.filter((t: any) => isPriorTx(t))
                const priorDeferredNet = priorDeferredTxs.reduce(
                  (s: number, t: any) => s + (t.type === 'expense' ? Number(t.amount || 0) : -Number(t.amount || 0)),
                  0
                )
                const priorDeferredTxCount = priorDeferredTxs.length

                // ADR-0029：公帳已報銷者轉列個人自負，公帳刷退優先折抵公帳欠款
                const sharedExpUnreimbursed = activeExp
                  .filter((t: any) => Number(t.is_shared) === 1 && (!t.reimbursement_id || String(t.reimbursement_id).trim() === ''))
                  .reduce((s: number, t: any) => s + Number(t.amount || 0), 0)
                const sharedRef = activeRef
                  .filter((t: any) => Number(t.is_shared) === 1)
                  .reduce((s: number, t: any) => s + Number(t.amount || 0), 0)
                const curShared = Math.max(0, sharedExpUnreimbursed - sharedRef)
                const curPersonal = Math.max(0, curNet - curShared)
                const reimbursedSharedCount = activeExp.filter((t: any) => Number(t.is_shared) === 1 && t.reimbursement_id && String(t.reimbursement_id).trim() !== '').length

                const deferredExp = allTxs.filter((t: any) => rolloverDeferredIds.has(t.id) && t.type === 'expense').reduce((s: number, t: any) => s + Number(t.amount || 0), 0)
                const deferredRef = allTxs.filter((t: any) => rolloverDeferredIds.has(t.id) && t.type === 'income').reduce((s: number, t: any) => s + Number(t.amount || 0), 0)
                const curDeferredNet = deferredExp - deferredRef
                const deferredCount = rolloverDeferredIds.size

                const curProjUnb = rolloverPreview.baseNetUnbilled !== undefined
                  ? Math.max(0, (rolloverPreview.baseNetUnbilled || 0) + curDeferredNet)
                  : Math.max(0, (rolloverModalCard.unbilled || 0) - curNet)
                const baseUnbilledCount = Number(rolloverPreview.baseUnbilledCount || 0)
                const projUnbilledCount = baseUnbilledCount + deferredCount

                return (
                  <>
                    {/* 四層統計摘要卡片 (ADR-0030) */}
                    <div
                      style={{
                        background: 'rgba(239, 68, 68, 0.05)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: 8,
                        padding: '12px 16px',
                        marginBottom: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-danger)' }}>
                        本期出帳淨額 {formatCurrency(curNet)}({activeCount} 筆)
                      </div>
                      <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        刷卡金額：{formatCurrency(curExp)}({activeExp.length} 筆)，刷退折抵：-{formatCurrency(curRef)}({activeRef.length} 筆)
                      </div>
                      <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        本期新增：{formatCurrency(cycleNewNet)}({cycleNewCount} 筆)，本期延後：{formatCurrency(curDeferredNet)} ({deferredCount} 筆)，上期延入：{formatCurrency(priorDeferredNet)}({priorDeferredTxCount} 筆)
                      </div>
                      <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        剩餘未出帳：{formatCurrency(curProjUnb)}({projUnbilledCount} 筆)
                      </div>
                    </div>

                    {/* 公私帳債務拆解 */}
                    <div
                      style={{
                        background: 'var(--bg-surface-2)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        padding: '10px 14px',
                        marginBottom: 16,
                      }}
                    >
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <PieChart size={13} /> 本期出帳債務性質拆解：
                      </div>
                      <div className="flex items-center justify-between" style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                        <span className="flex items-center gap-xs">
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }} />
                          <Home size={13} color="var(--color-primary)" />
                          <span>家庭代墊公帳（待向共同基金報銷）：</span>
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                          {formatCurrency(curShared)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between" style={{ fontSize: '0.85rem' }}>
                        <span className="flex items-center gap-xs">
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-secondary)' }} />
                          <Lock size={13} color="var(--text-secondary)" />
                          <span>個人私帳消費{reimbursedSharedCount > 0 ? `（含 ${reimbursedSharedCount} 筆公帳已由家庭報銷結清）` : ''}：</span>
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {formatCurrency(curPersonal)}
                        </span>
                      </div>
                    </div>

                    {/* 明細清單與延至下期開關 */}
                    <div style={{ marginBottom: 16 }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          本期參與結算明細 ({allTxs.length} 筆{deferredCount > 0 ? `，已延期 ${deferredCount} 筆` : ''})
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          若有未請款項目可勾選延期
                        </div>
                      </div>

                      {allTxs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', background: 'var(--bg-surface-2)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                          目前週期內無待出帳之消費記錄
                        </div>
                      ) : (
                        <div
                          style={{
                            maxHeight: 'min(300px, 38vh)',
                            overflowY: 'auto',
                            border: '1px solid var(--border-color)',
                            borderRadius: 8,
                            padding: '4px 8px',
                          }}
                        >
                          {allTxs.map((t: any) => {
                            const isDeferred = rolloverDeferredIds.has(t.id)
                            const isExpense = t.type === 'expense'

                            return (
                              <div
                                key={t.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 6px',
                                  borderBottom: '1px solid var(--border-color-2)',
                                  opacity: isDeferred ? 0.55 : 1,
                                  background: isDeferred ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                                  borderRadius: 6,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <div className="flex items-center gap-xs" style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                                  <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                                    <CategoryIcon category={t.category || '其他'} size={15} />
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: '0.82rem', fontWeight: 600, textDecoration: isDeferred ? 'line-through' : 'none' }}>
                                        {t.category || '消費'}
                                      </span>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        {t.date}
                                      </span>
                                      {t.is_shared === 1 ? (
                                        t.reimbursement_id && String(t.reimbursement_id).trim() !== '' ? (
                                          <span
                                            className="badge"
                                            style={{
                                              fontSize: '0.7rem',
                                              padding: '1px 5px',
                                              background: 'rgba(16, 185, 129, 0.14)',
                                              color: 'var(--color-success)',
                                              border: '1px solid rgba(16, 185, 129, 0.3)',
                                              fontWeight: 600,
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 2,
                                            }}
                                            title="家庭共同基金已完成撥款報銷，出帳由持卡人自負向發卡機構繳費"
                                          >
                                            <CheckCircle2 size={10} />
                                            公帳 · 家庭已報銷
                                          </span>
                                        ) : (
                                          <span
                                            className="badge badge-primary"
                                            style={{ fontSize: '0.7rem', padding: '1px 5px', display: 'inline-flex', alignItems: 'center', gap: 2 }}
                                            title="家庭公帳代墊款，待向共同基金報銷"
                                          >
                                            <Home size={10} />
                                            公帳 · 待報銷
                                          </span>
                                        )
                                      ) : (
                                        <span className="badge badge-secondary" style={{ fontSize: '0.7rem', padding: '1px 5px', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                          <Lock size={10} />
                                          私帳
                                        </span>
                                      )}
                                      {isPriorTx(t) && (
                                        <span
                                          className="badge"
                                          style={{
                                            fontSize: '0.7rem',
                                            padding: '1px 5px',
                                            background: 'rgba(99, 102, 241, 0.15)',
                                            color: 'var(--color-indigo-text)',
                                            fontWeight: 600,
                                            border: '1px solid rgba(99, 102, 241, 0.3)',
                                          }}
                                          title="自上一結帳週期遞延而來，預設納入本期出帳"
                                        >
                                          上期延入
                                        </span>
                                      )}
                                      {isDeferred && (
                                        <span
                                          className="badge"
                                          style={{
                                            fontSize: '0.7rem',
                                            padding: '1px 5px',
                                            background: 'rgba(245, 158, 11, 0.16)',
                                            color: 'var(--color-amber-text)',
                                            fontWeight: 600,
                                            border: '1px solid rgba(245, 158, 11, 0.32)',
                                          }}
                                        >
                                          已延至下期
                                        </span>
                                      )}
                                    </div>
                                    {t.note && (
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', wordBreak: 'break-word', lineHeight: 1.35, marginTop: 2 }}>
                                        {t.note}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-sm">
                                  <span
                                    style={{
                                      fontSize: '0.88rem',
                                      fontWeight: 700,
                                      color: isDeferred ? 'var(--text-secondary)' : isExpense ? 'var(--color-danger)' : 'var(--color-success)',
                                      textDecoration: isDeferred ? 'line-through' : 'none',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {isExpense ? '-' : '+'}{formatCurrency(t.amount)}
                                  </span>
                                  <button
                                    type="button"
                                    className={`btn btn-xs ${isDeferred ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ whiteSpace: 'nowrap' }}
                                    onClick={() => handleToggleDefer(t.id)}
                                  >
                                    {isDeferred ? '取消延期' : '延至下期'}
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* 底部確認按鈕組 */}
                    <div className="flex items-center justify-between" style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        切換延期僅於預覽中試算，確認出帳時統一寫入
                      </span>
                      <div className="flex gap-xs">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setRolloverModalCard(null)
                            setRolloverPreview(null)
                          }}
                          disabled={rolloverSubmitting}
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{
                            background: curNet > 0 ? 'var(--color-danger)' : 'var(--color-primary)',
                            borderColor: curNet > 0 ? 'var(--color-danger)' : 'var(--color-primary)',
                          }}
                          disabled={rolloverSubmitting || (activeTxs.length === 0 && deferredCount === 0)}
                          onClick={handleConfirmRollover}
                        >
                          {rolloverSubmitting
                            ? '出帳處理中...'
                            : activeTxs.length === 0 && deferredCount > 0
                            ? `僅提交延期 (${deferredCount} 筆)`
                            : `確認出帳 ${formatCurrency(curNet)}`}
                        </button>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
              無法取得出帳預覽資料
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
