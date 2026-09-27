import { useState, useEffect } from 'react'
import { accountsApi, Account, BalanceSummary } from '../api/client'
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
  TrendingDown
} from 'lucide-react'

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [balance, setBalance] = useState<BalanceSummary | null>(null)
  const [loading, setLoading] = useState(true)

  // Modal 狀態
  const [showModal, setShowModal] = useState(false)
  const [editingAcc, setEditingAcc] = useState<Account | null>(null)
  const [form, setForm] = useState({
    name: '',
    type: 'bank' as 'bank' | 'credit_card',
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
  // 繳納卡費 Modal 狀態
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


  const loadData = async () => {
    try {
      setLoading(true)
      const [accs, bal] = await Promise.all([
        accountsApi.list(),
        accountsApi.balance().catch(() => null),
      ])
      setAccounts(accs)
      if (bal) setBalance(bal)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenAdd = (type: 'bank' | 'credit_card' = 'bank') => {
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
      color: ACCOUNT_COLORS[Math.floor(Math.random() * ACCOUNT_COLORS.length)],
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
      setErrorMsg('請輸入帳戶名稱')
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



  const handleRollover = async (card: Account) => {
    if (!window.confirm(`確定要將「${card.name}」的未出帳金額 NT$ ${card.unbilled.toLocaleString()} 結轉為本期已出帳待繳嗎？`)) {
      return
    }
    try {
      const res = await accountsApi.rolloverStatement(card.id)
      alert(res.message || '結轉成功！')
      loadData()
    } catch (err: any) {
      alert(err.message || '結轉失敗')
    }
  }

  const handleOpenPay = (card: Account) => {
    setPayCardModal(card)
    const defaultBank = bankAccounts.find(b => b.balance > 0) || bankAccounts[0]
    const defaultAmount = (card.balance || 0) > 0 ? card.balance : (card.unbilled || 0)
    setPayForm({
      bank_account_id: defaultBank ? defaultBank.id : '',
      amount: defaultAmount > 0 ? defaultAmount.toString() : '',
      date: today(),
      note: `繳納【${card.name}】卡費`,
      is_shared: (card.shared_debt || 0) >= (card.personal_debt || 0) ? 1 : 0,
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

    const maxPayable = (payCardModal.balance || 0) + (payCardModal.unbilled || 0);
    const amt = parseFloat(payForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setPayError('請輸入大於 0 的繳款金額');
      return;
    }
    if (amt > maxPayable && maxPayable > 0) {
      setPayError(`繳款金額不可超過當前待繳總額 NT$ ${maxPayable.toLocaleString()}`);
      return;
    }
    const selectedBank = bankAccounts.find(b => b.id === payForm.bank_account_id)
    if (selectedBank && selectedBank.balance < amt) {
      if (!window.confirm(`扣款帳戶「${selectedBank.name}」目前餘額為 NT$ ${selectedBank.balance.toLocaleString()}，小於繳納金額 NT$ ${amt.toLocaleString()}。確認仍要繼續扣款嗎？`)) {
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
      setPayError(err.message || '繳款失敗')
    } finally {
      setPaying(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`確定要刪除帳戶「${name}」嗎？關聯的交易記錄也將一併移除！`)) return
    try {
      await accountsApi.remove(id)
      loadData()
    } catch (err: any) {
      alert(err.message || '刪除失敗')
    }
  }

  const bankAccounts = accounts.filter(a => a.type === 'bank')
  const creditCards = accounts.filter(a => a.type === 'credit_card')

  return (
    <div className="fade-in">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">帳戶管理 🏦</h1>
          <p className="page-subtitle">追蹤活存銀行帳戶與信用卡額度、掌握精確負債與資產</p>
        </div>
        <div className="flex gap-sm">
          <button id="btn-add-bank" className="btn btn-secondary" onClick={() => handleOpenAdd('bank')}>
            <Building size={16} />
            <span>新增銀行帳戶</span>
          </button>
          <button id="btn-add-cc" className="btn btn-primary" onClick={() => handleOpenAdd('credit_card')}>
            <Plus size={18} />
            <span>新增信用卡</span>
          </button>
        </div>
      </div>

      {/* 資金彙總卡片 */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <span className="stat-label">銀行存款總額</span>
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>
            {formatCurrency(balance?.bankTotal ?? 0)}
          </div>
          <div className="stat-sub">{bankAccounts.length} 個銀行/現金帳戶</div>
        </div>

        <div className="stat-card">
          <span className="stat-label">信用卡總待繳 (已出+未出)</span>
          <div className="stat-value" style={{ color: 'var(--color-danger)' }}>
            {formatCurrency((balance?.ccBilled ?? 0) + (balance?.ccUnbilled ?? 0))}
          </div>
          <div className="stat-sub">
            已出帳：{formatCurrency(balance?.ccBilled ?? 0)} · 未出帳：{formatCurrency(balance?.ccUnbilled ?? 0)}
          </div>
        </div>

        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(255,138,138,0.12) 0%, rgba(168,216,234,0.15) 100%)' }}>
          <span className="stat-label">淨可用現金 (扣除信用卡欠款)</span>
          <div className="stat-value" style={{ color: (balance?.available ?? 0) >= 0 ? 'var(--text-primary)' : 'var(--color-danger)' }}>
            {formatCurrency(balance?.available ?? 0)}
          </div>
          <div className="stat-sub">真實手頭可立即支配金額</div>
        </div>
      </div>

      {/* 銀行帳戶分區 */}
      <div style={{ marginBottom: 32 }}>
        <h2 className="text-xl flex items-center gap-xs" style={{ marginBottom: 14 }}>
          <Building size={20} color="var(--color-primary)" />
          銀行 / 現金帳戶 ({bankAccounts.length})
        </h2>

        {bankAccounts.length === 0 ? (
          <div className="card empty-state">
            <div className="emoji">🏦</div>
            <h3>尚未新增銀行帳戶</h3>
            <p style={{ fontSize: '0.875rem', marginBottom: 14 }}>建立活存或錢包帳戶，才能精確追蹤存款</p>
            <button className="btn btn-primary btn-sm" onClick={() => handleOpenAdd('bank')}>立即新增</button>
          </div>
        ) : (
          <div className="grid grid-3">
            {bankAccounts.map(acc => (
              <div
                key={acc.id}
                className="card"
                style={{
                  borderTop: `4px solid ${acc.color || 'var(--color-primary)'}`,
                  position: 'relative',
                }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{acc.name}</span>
                    {acc.is_joint === 1 && (
                      <span className="badge" style={{ background: 'rgba(255, 193, 7, 0.18)', color: '#d97706', fontSize: '0.72rem', padding: '2px 8px', fontWeight: 600, border: '1px solid rgba(255, 193, 7, 0.4)' }}>
                        🏠 家庭共同基金
                      </span>
                    )}
                  </div>
                  <div className="flex gap-xs">
                    <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} onClick={() => handleOpenEdit(acc)}>
                      <Edit2 size={14} />
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ padding: 4, color: 'var(--color-danger)' }} onClick={() => handleDelete(acc.id, acc.name)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="stat-label">帳戶餘額</div>
                <div className="stat-value" style={{ fontSize: '1.5rem', color: acc.balance >= 0 ? 'var(--text-primary)' : 'var(--color-danger)' }}>
                  {formatCurrency(acc.balance)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 信用卡分區 */}
      <div>
        <h2 className="text-xl flex items-center gap-xs" style={{ marginBottom: 14 }}>
          <CreditCard size={20} color="var(--color-danger)" />
          信用卡 ({creditCards.length})
        </h2>

        {creditCards.length === 0 ? (
          <div className="card empty-state">
            <div className="emoji">💳</div>
            <h3>尚未新增信用卡</h3>
            <p style={{ fontSize: '0.875rem', marginBottom: 14 }}>加入信用卡以便管理出帳日、繳款日及未出帳金額</p>
            <button className="btn btn-secondary btn-sm" onClick={() => handleOpenAdd('credit_card')}>新增信用卡</button>
          </div>
        ) : (
          <div className="grid grid-2">
            {creditCards.map(cc => {
              const totalDue = (cc.balance || 0) + (cc.unbilled || 0)
              const remainingLimit = cc.credit_limit ? cc.credit_limit - totalDue : null

              return (
                <div
                  key={cc.id}
                  className="card"
                  style={{
                    borderLeft: `5px solid ${cc.color || 'var(--color-danger)'}`,
                  }}
                >
                  <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{cc.name}</span>
                      {cc.credit_limit && (
                        <span className="text-xs text-muted" style={{ marginLeft: 8 }}>
                          額度 {formatCurrency(cc.credit_limit)}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-xs items-center">
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.8rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          borderRadius: 6,
                          background: totalDue > 0 ? 'rgba(255, 138, 138, 0.15)' : 'var(--bg-surface-2)',
                          color: totalDue > 0 ? 'var(--color-danger)' : 'var(--text-muted)',
                          border: totalDue > 0 ? '1px solid var(--color-danger)' : '1px solid var(--border-color)',
                          cursor: totalDue > 0 ? 'pointer' : 'default',
                          fontWeight: 600,
                        }}
                        onClick={() => handleOpenPay(cc)}
                        title={totalDue > 0 ? '繳納此卡款項並沖銷欠款' : '此卡目前無待繳欠款'}
                      >
                        <CreditCard size={13} />
                        <span>繳卡費</span>
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} onClick={() => handleOpenEdit(cc)}>
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ padding: 4, color: 'var(--color-danger)' }} onClick={() => handleDelete(cc.id, cc.name)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  
                  {/* Q1: 結帳日提醒與一鍵結轉 */}
                  {cc.statement_day && (cc.unbilled || 0) > 0 && new Date().getDate() >= cc.statement_day && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(255, 193, 7, 0.12)',
                      border: '1px solid rgba(255, 193, 7, 0.35)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      marginBottom: 10,
                      fontSize: '0.82rem',
                    }}>
                      <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>
                        📅 每月 {cc.statement_day} 號結帳日已過，有未出帳待結轉！
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.75rem',
                          background: 'var(--color-warning)',
                          color: '#000',
                          fontWeight: 700,
                          borderRadius: 6,
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleRollover(cc)}
                      >
                        一鍵出帳
                      </button>
                    </div>
                  )}

                  
                  {/* 欠款公私拆解標籤 */}
                  {totalDue > 0 && (
                    <div style={{
                      background: 'var(--bg-surface-2)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      marginBottom: 10,
                      border: '1px solid var(--border-color)',
                      fontSize: '0.82rem',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span className="text-muted" style={{ fontWeight: 500 }}>欠款公私拆解</span>
                        <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                          {cc.shared_debt ? Math.round(((cc.shared_debt || 0) / totalDue) * 100) : 0}% 家庭公帳
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>🏠 家庭公帳：</span>
                          <strong>{formatCurrency(cc.shared_debt || 0)}</strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>👤 個人私帳：</span>
                          <strong>{formatCurrency(cc.personal_debt || 0)}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-2" style={{ gap: 10, marginBottom: 12 }}>
                    <div style={{ background: 'var(--bg-surface-2)', padding: '8px 12px', borderRadius: 8 }}>
                      <div className="text-xs text-muted">已出帳 (待繳)</div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-danger)' }}>
                        {formatCurrency(cc.balance || 0)}
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg-surface-2)', padding: '8px 12px', borderRadius: 8 }}>
                      <div className="text-xs text-muted">未出帳金額</div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-warning)' }}>
                        {formatCurrency(cc.unbilled || 0)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted" style={{ paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
                    <span>
                      {cc.statement_day ? `結帳日：每月 ${cc.statement_day} 號` : ''}
                      {cc.statement_day && cc.payment_due_day ? ' · ' : ''}
                      {cc.payment_due_day ? `繳款日：每月 ${cc.payment_due_day} 號` : ''}
                    </span>
                    {remainingLimit !== null && (
                      <span style={{ color: remainingLimit < 10000 ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                        剩餘額度：{formatCurrency(remainingLimit)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>


      {/* 繳納卡費 Modal */}
      {payCardModal && (
        <Modal
          title={`繳納信用卡費 — ${payCardModal.name}`}
          onClose={() => setPayCardModal(null)}
        >
          {payError && (
            <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid var(--color-danger)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, color: 'var(--color-danger)', fontSize: '0.85rem' }}>
              {payError}
            </div>
          )}

          {/* 欠款明細卡片 */}
          <div style={{
            background: 'var(--bg-surface-2)',
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 16,
            border: '1px solid var(--border-color)',
            borderLeft: `4px solid ${payCardModal.color || 'var(--color-danger)'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>待繳卡費總額</span>
              <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--color-danger)' }}>
                {formatCurrency((payCardModal.balance || 0) + (payCardModal.unbilled || 0))}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <div>已出帳待繳：<strong style={{ color: 'var(--color-danger)' }}>{formatCurrency(payCardModal.balance || 0)}</strong></div>
              <div>未出帳消費：<strong style={{ color: 'var(--color-warning)' }}>{formatCurrency(payCardModal.unbilled || 0)}</strong></div>
              <div>🏠 公帳代墊：<strong style={{ color: 'var(--color-primary)' }}>{formatCurrency(payCardModal.shared_debt || 0)}</strong></div>
              <div>👤 個人私帳：<strong>{formatCurrency(payCardModal.personal_debt || 0)}</strong></div>
            </div>
          </div>

          <form onSubmit={handlePaySubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 扣款來源帳戶 */}
            <div className="input-group">
              <label className="input-label">扣款銀行 / 現金帳戶</label>
              <select
                id="pay-bank-select"
                className="input"
                required
                value={payForm.bank_account_id}
                onChange={e => setPayForm(p => ({ ...p, bank_account_id: e.target.value }))}
              >
                <option value="" disabled>請選擇扣款帳戶</option>
                {bankAccounts.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}（可用餘額：{formatCurrency(b.balance)}）
                  </option>
                ))}
              </select>
            </div>

            {/* 繳款金額 */}
            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="input-label" style={{ marginBottom: 0 }}>繳費金額 (NT$)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  
                  {(payCardModal.shared_debt || 0) > 0 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 8px', fontSize: '0.75rem', background: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6 }}
                      onClick={() => {
                        setPayForm(p => ({
                          ...p,
                          amount: (payCardModal.shared_debt || 0).toString(),
                          is_shared: 1,
                          bank_account_id: bankAccounts.find(b => b.is_joint === 1)?.id || p.bank_account_id
                        }))
                      }}
                    >
                      🏠 繳家庭代墊 {formatCurrency(payCardModal.shared_debt || 0)}
                    </button>
                  )}
                  {(payCardModal.personal_debt || 0) > 0 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 8px', fontSize: '0.75rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6 }}
                      onClick={() => {
                        setPayForm(p => ({
                          ...p,
                          amount: (payCardModal.personal_debt || 0).toString(),
                          is_shared: 0,
                          bank_account_id: bankAccounts.find(b => b.is_joint !== 1)?.id || p.bank_account_id
                        }))
                      }}
                    >
                      👤 繳個人私帳 {formatCurrency(payCardModal.personal_debt || 0)}
                    </button>
                  )}

                  {(payCardModal.balance || 0) > 0 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 8px', fontSize: '0.75rem', background: 'var(--bg-surface-2)', border: '1px solid var(--border-color)', borderRadius: 6 }}
                      onClick={() => setPayForm(p => ({ ...p, amount: (payCardModal.balance || 0).toString() }))}
                    >
                      繳已出帳 {formatCurrency(payCardModal.balance || 0)}
                    </button>
                  )}
                  {((payCardModal.balance || 0) + (payCardModal.unbilled || 0)) > 0 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 8px', fontSize: '0.75rem', background: 'rgba(92,124,250,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(92,124,250,0.3)', borderRadius: 6 }}
                      onClick={() => setPayForm(p => ({ ...p, amount: ((payCardModal.balance || 0) + (payCardModal.unbilled || 0)).toString() }))}
                    >
                      全額結清 {formatCurrency((payCardModal.balance || 0) + (payCardModal.unbilled || 0))}
                    </button>
                  )}
                </div>
              </div>
              <input
                id="pay-amount"
                className="input"
                type="number"
                step="1"
                min="1"
                placeholder="請輸入繳款金額"
                required
                value={payForm.amount}
                onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
              />
            </div>

            {/* 扣款日期 */}
            <div className="input-group">
              <label className="input-label">扣款日期</label>
              <input
                id="pay-date"
                className="input"
                type="date"
                required
                value={payForm.date}
                onChange={e => setPayForm(p => ({ ...p, date: e.target.value }))}
              />
            </div>

            
            {/* 還款紀錄歸屬選擇 */}
            <div className="input-group">
              <label className="input-label">還款帳務歸屬</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className={`btn btn-full ${payForm.is_shared === 1 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.85rem', padding: '8px' }}
                  onClick={() => setPayForm(p => ({ ...p, is_shared: 1 }))}
                >
                  🏠 家庭公帳（共同基金沖銷）
                </button>
                <button
                  type="button"
                  className={`btn btn-full ${payForm.is_shared === 0 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.85rem', padding: '8px' }}
                  onClick={() => setPayForm(p => ({ ...p, is_shared: 0 }))}
                >
                  👤 個人私帳（自付薪轉）
                </button>
              </div>
            </div>

            {/* 備註說明 */}
            <div className="input-group">
              <label className="input-label">備註說明 (選填)</label>
              <input
                id="pay-note"
                className="input"
                type="text"
                placeholder={`繳納【${payCardModal.name}】卡費`}
                value={payForm.note}
                onChange={e => setPayForm(p => ({ ...p, note: e.target.value }))}
              />
            </div>

            {/* 會計提示說明 */}
            <div style={{
              background: 'rgba(92, 124, 250, 0.08)',
              border: '1px solid rgba(92, 124, 250, 0.25)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5
            }}>
              💡 <strong>會計帳務說明：</strong>
              繳納卡費屬於內部資金轉移沖銷，系統將自動自扣款銀行扣減存款，並沖銷信用卡欠款。此筆還款<strong>不會重複計入本月生活消費支出</strong>。
            </div>

            {payCardModal && parseFloat(payForm.amount) > ((payCardModal.balance || 0) + (payCardModal.unbilled || 0)) && (
              <div style={{ color: 'var(--color-danger)', fontSize: '0.82rem', marginTop: -6 }}>
                ⚠️ 繳款金額不可超過當前待繳總額 NT$ {formatCurrency((payCardModal.balance || 0) + (payCardModal.unbilled || 0))}
              </div>
            )}

            <button
              id="pay-submit"
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={paying || (!!payCardModal && parseFloat(payForm.amount) > ((payCardModal.balance || 0) + (payCardModal.unbilled || 0)))}
              style={{ marginTop: 8 }}
            >
              {paying ? '繳款處理中…' : '確認扣款繳納'}
            </button>
          </form>
        </Modal>
      )}

      {/* 新增/編輯 Modal */}
      {showModal && (
        <Modal
          title={editingAcc ? `編輯${form.type === 'bank' ? '銀行帳戶' : '信用卡'}` : `新增${form.type === 'bank' ? '銀行帳戶' : '信用卡'}`}
          onClose={() => setShowModal(false)}
        >
          {errorMsg && (
            <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid var(--color-danger)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, color: 'var(--color-danger)', fontSize: '0.85rem' }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!editingAcc && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className={`btn btn-full ${form.type === 'bank' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setForm(p => ({ ...p, type: 'bank' }))}
                >
                  銀行 / 現金
                </button>
                <button
                  type="button"
                  className={`btn btn-full ${form.type === 'credit_card' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setForm(p => ({ ...p, type: 'credit_card' }))}
                >
                  信用卡
                </button>
              </div>
            )}

            {/* 名稱 */}
            <div className="input-group">
              <label className="input-label">帳戶名稱</label>
              <input
                id="acc-name"
                className="input"
                type="text"
                placeholder={form.type === 'bank' ? '例如 國泰世華活存、台新 Richart' : '例如 玉山 Pi 卡、中信 LINE Pay'}
                required
                autoFocus
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>

            {/* 餘額 / 欠款 */}
            <div className="input-group">
              <label className="input-label">
                {form.type === 'bank' ? '目前餘額 (NT$)' : '已出帳待繳金額 (NT$)'}
              </label>
              <input
                id="acc-balance"
                className="input"
                type="number"
                step="1"
                placeholder="0"
                required
                value={form.balance}
                onChange={e => setForm(p => ({ ...p, balance: e.target.value }))}
              />
            </div>

            {/* 信用卡專用欄位 */}
            {form.type === 'credit_card' && (
              <>
                <div className="input-group">
                  <label className="input-label">未出帳金額 (NT$)</label>
                  <input
                    id="acc-unbilled"
                    className="input"
                    type="number"
                    step="1"
                    placeholder="例如 3200"
                    value={form.unbilled}
                    onChange={e => setForm(p => ({ ...p, unbilled: e.target.value }))}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">信用額度 (選填)</label>
                  <input
                    id="acc-limit"
                    className="input"
                    type="number"
                    step="1000"
                    placeholder="例如 150000"
                    value={form.credit_limit}
                    onChange={e => setForm(p => ({ ...p, credit_limit: e.target.value }))}
                  />
                </div>

                <div className="grid grid-2" style={{ gap: 10 }}>
                  <div className="input-group">
                    <label className="input-label">每月結帳日</label>
                    <input
                      id="acc-stmt-day"
                      className="input"
                      type="number"
                      min="1"
                      max="31"
                      placeholder="15"
                      value={form.statement_day}
                      onChange={e => setForm(p => ({ ...p, statement_day: e.target.value }))}
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">每月繳款日</label>
                    <input
                      id="acc-due-day"
                      className="input"
                      type="number"
                      min="1"
                      max="31"
                      placeholder="5"
                      value={form.payment_due_day}
                      onChange={e => setForm(p => ({ ...p, payment_due_day: e.target.value }))}
                    />
                  </div>
                </div>
              </>
            )}

            
            {/* 家庭共同基金設定 */}
            {form.type === 'bank' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: 'var(--bg-surface-2)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <input
                  id="acc-is-joint"
                  type="checkbox"
                  checked={form.is_joint === 1}
                  onChange={e => setForm(p => ({ ...p, is_joint: e.target.checked ? 1 : 0 }))}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                  設為家庭共同基金帳戶 🏠（供家庭公帳採買扣款或代墊請款報銷）
                </span>
              </label>
            )}

            {/* 標籤顏色 */}
            <div className="input-group">
              <label className="input-label">代表顏色</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ACCOUNT_COLORS.map(c => (
                  <div
                    key={c}
                    onClick={() => setForm(p => ({ ...p, color: c }))}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: c,
                      cursor: 'pointer',
                      border: form.color === c ? '3px solid var(--text-primary)' : '2px solid transparent',
                      transition: 'transform 0.15s ease',
                      transform: form.color === c ? 'scale(1.15)' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            <button
              id="acc-submit"
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={submitting}
              style={{ marginTop: 8 }}
            >
              {submitting ? '儲存中…' : (editingAcc ? '更新帳戶' : '確認建立')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
