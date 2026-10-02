import { AccountsSkeleton } from '../components/Skeleton'
import { useState, useEffect } from 'react'
import { accountsApi, Account, BalanceSummary, householdApi } from '../api/client'
import { useStore } from '../store/useStore'
import { formatCurrency, ACCOUNT_COLORS, today } from '../components/utils'
import Modal from '../components/Modal'
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
  CheckCircle2,
  ArrowDownRight,
  Globe,
  Users,
  Lock
} from 'lucide-react'

export default function Accounts() {
  const { user } = useStore()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [balance, setBalance] = useState<BalanceSummary | null>(null)
  const [myRole, setMyRole] = useState<'admin' | 'member' | null>(null)
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<'all' | 'household' | 'personal'>('all')

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
      const [accs, bal, householdData] = await Promise.all([
        accountsApi.list(currentScope),
        accountsApi.balance(currentScope).catch(() => null),
        householdApi.current().catch(() => null),
      ])
      setAccounts(accs)
      if (bal) setBalance(bal)
      if (householdData?.myRole) setMyRole(householdData.myRole)
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

  const handleRollover = async (card: Account) => {
    if (!window.confirm(`確定要將「${card.name}」的未出帳消費 NT$ ${card.unbilled.toLocaleString()} 出帳作業為本期已出帳待繳嗎？`)) {
      return
    }
    try {
      const res = await accountsApi.rolloverStatement(card.id)
      alert(res.message || '出帳作業成功！')
      loadData()
    } catch (err: any) {
      alert(err.message || '出帳作業失敗')
    }
  }

  const handleOpenPay = (card: Account, payType: 'shared' | 'personal' | 'full' = 'full') => {
    setPayCardModal(card)
    
    let defaultAmount = (card.balance || 0) + (card.unbilled || 0)
    let isSharedTarget = 1
    if (payType === 'shared') {
      defaultAmount = card.shared_debt || 0
      isSharedTarget = 1
    } else if (payType === 'personal') {
      defaultAmount = card.personal_debt || 0
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

    const maxPayable = (payCardModal.balance || 0) + (payCardModal.unbilled || 0)
    const amt = parseFloat(payForm.amount)
    if (isNaN(amt) || amt <= 0) {
      setPayError('請輸入大於 0 的扣款金額')
      return
    }
    if (amt > maxPayable && maxPayable > 0) {
      setPayError(`還款金額不可超過信用卡待繳總額 NT$ ${maxPayable.toLocaleString()}`)
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
        is_shared: payForm.is_shared,
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
    if (!window.confirm(`確定要刪除「${name}」嗎？其關聯的交易記錄亦會一併移除！`)) return
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
      <div className="flex items-center justify-between" style={{ marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">資產與帳戶管理 💼</h1>
          <p className="page-subtitle">現金錢包、銀行活存與信用卡分離管理，支援公私帳隔離與代墊調度</p>
        </div>
        <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
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

      {/* 視角切換器 (Scope Filter) */}
      <div className="card" style={{ marginBottom: 20, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div className="flex items-center gap-xs">
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>檢視範圍：</span>
          <div className="flex gap-xs">
            <button
              className={`btn btn-sm ${scope === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setScope('all')}
            >
              <Globe size={14} style={{ marginRight: 4 }} />
              全部
            </button>
            <button
              className={`btn btn-sm ${scope === 'household' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setScope('household')}
            >
              <Users size={14} style={{ marginRight: 4 }} />
              🏠 公帳
            </button>
            <button
              className={`btn btn-sm ${scope === 'personal' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setScope('personal')}
            >
              <Lock size={14} style={{ marginRight: 4 }} />
              🔒 私帳
            </button>
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          🔒 嚴格隱私保護：其他成員之個人私帳與私卡自動隱藏
        </div>
      </div>

      {/* 核心資產統計四宮格 */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span className="stat-label flex items-center gap-xs">
            <Wallet size={16} color="#10B981" />
            💵 現金錢包總額
          </span>
          <div className="stat-value" style={{ color: '#10B981' }}>
            {formatCurrency(balance?.cashTotal ?? 0)}
          </div>
          <div className="stat-sub">{cashAccounts.length} 個現金錢包 / 零用金盒</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <span className="stat-label flex items-center gap-xs">
            <Building size={16} color="#3B82F6" />
            🏦 銀行存款總額
          </span>
          <div className="stat-value" style={{ color: 'var(--color-primary)' }}>
            {formatCurrency(balance?.bankTotal ?? 0)}
          </div>
          <div className="stat-sub">{bankAccounts.length} 個銀行存款帳戶</div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
          <span className="stat-label flex items-center gap-xs">
            <CreditCard size={16} color="var(--color-danger)" />
            💳 信用卡總待繳
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
            💎 淨可用餘額
          </span>
          <div className="stat-value" style={{ color: (balance?.available ?? 0) >= 0 ? 'var(--text-primary)' : 'var(--color-danger)' }}>
            {formatCurrency(balance?.available ?? 0)}
          </div>
          <div className="stat-sub">現金 + 銀行存款 - 信用卡待繳</div>
        </div>
      </div>

      {/* 專區一：💵 現金錢包 */}
      <div style={{ marginBottom: 32 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <h2 className="text-xl flex items-center gap-xs">
            <Wallet size={20} color="#10B981" />
            💵 現金錢包 ({cashAccounts.length})
          </h2>
          <button className="btn btn-sm btn-secondary" onClick={() => handleOpenAdd('cash')}>
            + 新增現金錢包
          </button>
        </div>

        {cashAccounts.length === 0 ? (
          <div className="card empty-state">
            <div className="emoji">👛</div>
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
                      <span className="badge badge-primary">🏠 公帳</span>
                    ) : (
                      <span className="badge badge-secondary">🔒 私帳</span>
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

      {/* 專區二：🏦 銀行帳戶 */}
      <div style={{ marginBottom: 32 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <h2 className="text-xl flex items-center gap-xs">
            <Building size={20} color="var(--color-primary)" />
            🏦 銀行存款帳戶 ({bankAccounts.length})
          </h2>
          <button className="btn btn-sm btn-secondary" onClick={() => handleOpenAdd('bank')}>
            + 新增銀行
          </button>
        </div>

        {bankAccounts.length === 0 ? (
          <div className="card empty-state">
            <div className="emoji">🏦</div>
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
                      <span className="badge badge-primary">🏠 公帳</span>
                    ) : (
                      <span className="badge badge-secondary">🔒 私帳</span>
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

      {/* 專區三：💳 信用卡專區 */}
      <div style={{ marginBottom: 32 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <h2 className="text-xl flex items-center gap-xs">
            <CreditCard size={20} color="var(--color-danger)" />
            💳 信用卡 ({creditCards.length})
          </h2>
          <button className="btn btn-sm btn-secondary" onClick={() => handleOpenAdd('credit_card')}>
            + 新增信用卡
          </button>
        </div>

        {creditCards.length === 0 ? (
          <div className="card empty-state">
            <div className="emoji">💳</div>
            <h3>目前此範圍無信用卡</h3>
            <p>新增信用卡可掌握家庭公帳代墊與個人私帳刷卡分流，避免突襲式信用卡待繳款！</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => handleOpenAdd('credit_card')}>
              立即新增信用卡
            </button>
          </div>
        ) : (
          <div className="grid grid-2">
            {creditCards.map(card => {
              const billed = card.balance || 0
              const unbilled = card.unbilled || 0
              const totalDue = billed + unbilled
              const sharedDebt = card.shared_debt || 0
              const personalDebt = card.personal_debt || 0
              const limit = card.credit_limit || 0
              const remainingLimit = limit > 0 ? Math.max(0, limit - totalDue) : null

              return (
                <div key={card.id} className="card cc-card" style={{ borderTop: `4px solid ${card.color}` }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                    <div className="account-name-group">
                      <span className="account-color-dot" style={{ backgroundColor: card.color }} />
                      <h3 className="account-name">{card.name}</h3>
                      {card.is_joint === 1 ? (
                        <span className="badge badge-primary">🏠 公帳</span>
                      ) : (
                        <span className="badge badge-secondary">🔒 私帳</span>
                      )}
                      {card.owner_name && (
                        <span className="badge" style={{ background: 'rgba(0,0,0,0.06)' }}>
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
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>待繳款總負債</span>
                      <span style={{ fontSize: '1.4rem', fontWeight: 800, color: totalDue > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                        {formatCurrency(totalDue)}
                      </span>
                    </div>

                    <div className="grid grid-2 gap-sm" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>已出帳待繳款</div>
                        <div style={{ fontWeight: 600, color: billed > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                          {formatCurrency(billed)}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>未出帳（累計消費）</span>
                          {canOperateCard(card) && (
                            <div className="flex gap-xs">
                              <button
                                id={`btn-reconcile-${card.id}`}
                                className="btn btn-xs btn-secondary"
                                style={{ padding: '1px 6px', fontSize: '0.7rem' }}
                                title="依當前消費紀錄自動校準未出帳金額"
                                onClick={() => handleReconcile(card)}
                                disabled={reconcilingCardId === card.id}
                              >
                                {reconcilingCardId === card.id ? '校準中...' : '🔄 校準'}
                              </button>
                              {unbilled > 0 && (
                                <button
                                  className="btn btn-xs btn-secondary"
                                  style={{ padding: '1px 6px', fontSize: '0.7rem' }}
                                  title="結帳日出帳作業"
                                  onClick={() => handleRollover(card)}
                                >
                                  出帳作業
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{ fontWeight: 600 }}>{formatCurrency(unbilled)}</div>
                      </div>
                    </div>
                  </div>

                  {/* 公私債務即時拆解 */}
                  <div style={{ background: '#FAFBFD', borderRadius: 8, padding: '10px 14px', marginBottom: 14, border: '1px solid rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      📊 負債性質拆解：
                    </div>
                    <div className="flex items-center justify-between" style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                      <span className="flex items-center gap-xs">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }} />
                        🏠 家庭代墊公帳：
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                        {formatCurrency(sharedDebt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between" style={{ fontSize: '0.85rem' }}>
                      <span className="flex items-center gap-xs">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6B7280' }} />
                        👤 個人私帳消費：
                      </span>
                      <span style={{ fontWeight: 700, color: '#4B5563' }}>
                        {formatCurrency(personalDebt)}
                      </span>
                    </div>
                  </div>

                  {/* 帳單週期資訊 */}
                  <div className="flex items-center justify-between" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
                    <span>每月 {card.statement_day || '--'} 日結帳 · {card.payment_due_day || '--'} 日繳款</span>
                    {remainingLimit !== null && (
                      <span>剩餘額度：{formatCurrency(remainingLimit)}</span>
                    )}
                  </div>

                  {/* 還款操作按鈕組 */}
                  {totalDue > 0 && canOperateCard(card) ? (
                    <div className="grid grid-3 gap-xs">
                      <button
                        className="btn btn-sm btn-secondary"
                        style={{ border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}
                        onClick={() => handleOpenPay(card, 'shared')}
                        disabled={sharedDebt <= 0}
                      >
                        🏠 繳家庭代墊
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleOpenPay(card, 'personal')}
                        disabled={personalDebt <= 0}
                      >
                        👤 繳個人私帳
                      </button>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleOpenPay(card, 'full')}
                      >
                        全額結清
                      </button>
                    </div>
                  ) : totalDue > 0 ? (
                    <div className="text-center" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '6px 0' }}>
                      🔒 個人私卡僅持卡人本人可執行繳款沖銷作業
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
                    onClick={() => setForm(p => ({ ...p, type: 'cash', color: '#10B981' }))}
                  >
                    💵 現金錢包
                  </button>
                  <button
                    type="button"
                    className={`btn ${form.type === 'bank' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setForm(p => ({ ...p, type: 'bank', color: '#3B82F6' }))}
                  >
                    🏦 銀行活存
                  </button>
                  <button
                    type="button"
                    className={`btn ${form.type === 'credit_card' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setForm(p => ({ ...p, type: 'credit_card', color: '#EF4444' }))}
                  >
                    💳 信用卡
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
              <div className="grid grid-2 gap-xs">
                <button
                  type="button"
                  className={`btn ${form.is_joint === 0 ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setForm(p => ({ ...p, is_joint: 0 }))}
                >
                  <Lock size={14} style={{ marginRight: 4 }} />
                  🔒 私帳
                </button>
                <button
                  type="button"
                  className={`btn ${form.is_joint === 1 ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setForm(p => ({ ...p, is_joint: 1 }))}
                >
                  <Users size={14} style={{ marginRight: 4 }} />
                  🏠 公帳
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
          title="💸 ATM 提款 / 帳戶轉帳"
        >
          <form onSubmit={handleTransferSubmit}>
            {transferError && <div className="alert alert-danger" style={{ marginBottom: 14 }}>{transferError}</div>}

            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.85rem', color: '#166534' }}>
              💡 帳戶間互轉或 ATM 提領現鈔純屬資產調度，<strong>不會</strong>被列為生活消費支出，淨可用餘額維持準確！
            </div>

            {/* 快速情境切換 */}
            <div className="form-group">
              <label className="form-label">快捷情境</label>
              <div className="flex gap-xs" style={{ flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-xs btn-secondary"
                  onClick={() => {
                    const firstBank = bankAccounts[0]?.id || ''
                    const firstCash = cashAccounts[0]?.id || ''
                    if (firstBank && firstCash) {
                      setTransferForm(p => ({ ...p, from_account_id: firstBank, to_account_id: firstCash, note: 'ATM 提領現鈔至現金錢包' }))
                    }
                  }}
                >
                  🏧 ATM 提款至現金錢包
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-secondary"
                  onClick={() => {
                    const firstCash = cashAccounts[0]?.id || ''
                    const firstBank = bankAccounts[0]?.id || ''
                    if (firstCash && firstBank) {
                      setTransferForm(p => ({ ...p, from_account_id: firstCash, to_account_id: firstBank, note: '存入現金至銀行' }))
                    }
                  }}
                >
                  💰 存款至銀行
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
                      {a.type === 'cash' ? '💵 現金' : '🏦 銀行'} - {a.name} (餘額: {formatCurrency(a.balance)})
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
                      {a.type === 'cash' ? '💵 現金' : '🏦 銀行'} - {a.name} (餘額: {formatCurrency(a.balance)})
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
          title={`💳 信用卡扣款還款 ${payCardModal.name} 信用卡待繳款`}
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

            <div className="form-group">
              <label className="form-label">還款性質歸屬</label>
              <div className="grid grid-2 gap-xs">
                <button
                  type="button"
                  className={`btn ${payForm.is_shared === 1 ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPayForm(p => ({ ...p, is_shared: 1 }))}
                >
                  <Users size={14} style={{ marginRight: 4 }} />
                  🏠 公帳
                </button>
                <button
                  type="button"
                  className={`btn ${payForm.is_shared === 0 ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPayForm(p => ({ ...p, is_shared: 0 }))}
                >
                  <Lock size={14} style={{ marginRight: 4 }} />
                  🔒 私帳
                </button>
              </div>
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
    </div>
  )
}
