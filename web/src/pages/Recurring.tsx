import { RecurringSkeleton } from '../components/Skeleton'
import { useState, useEffect } from 'react'
import { recurringApi, accountsApi, exportApi, RecurringItem, Account, AmortizeResult } from '../api/client'
import { formatCurrency, CYCLE_LABELS } from '../components/utils'
import Modal from '../components/Modal'
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
  Info
} from 'lucide-react'

const CYCLE_DIVISORS: Record<string, number> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
}

export default function Recurring() {
  const [items, setItems] = useState<RecurringItem[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [amortize, setAmortize] = useState<AmortizeResult | null>(null)
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
    account_id: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      setLoadError(null)
      const [recList, accs, amort] = await Promise.all([
        recurringApi.list(),
        accountsApi.list(),
        recurringApi.amortize(),
      ])
      setItems(recList)
      setAccounts(accs)
      if (amort) setAmortize(amort)
    } catch (err: any) {
      console.error('Failed to load recurring data:', err)
      setLoadError(err.message || '固定收支資料載入失敗，請檢查連線')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenAdd = () => {
    setEditingItem(null)
    setForm({
      name: '',
      type: 'expense',
      amount: '',
      cycle: 'monthly',
      day_of_cycle: '1',
      account_id: accounts[0]?.id || '',
    })
    setErrorMsg('')
    setShowModal(true)
  }

  const handleOpenEdit = (item: RecurringItem) => {
    setEditingItem(item)
    setForm({
      name: item.name,
      type: item.type,
      amount: item.amount.toString(),
      cycle: item.cycle,
      day_of_cycle: item.day_of_cycle.toString(),
      account_id: item.account_id || '',
    })
    setErrorMsg('')
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

    try {
      setSubmitting(true)
      if (editingItem) {
        await recurringApi.update(editingItem.id, {
          name: form.name.trim(),
          type: form.type,
          amount: amt,
          cycle: form.cycle,
          day_of_cycle: day,
          account_id: form.account_id || undefined,
        })
      } else {
        await recurringApi.create({
          name: form.name.trim(),
          type: form.type,
          amount: amt,
          cycle: form.cycle,
          day_of_cycle: day,
          account_id: form.account_id || undefined,
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

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`確定要刪除固定收支「${name}」嗎？`)) return
    try {
      await recurringApi.remove(id)
      loadData()
    } catch (err: any) {
      alert(err.message || '刪除失敗')
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
            <span>⚠️ <strong>固定收支資料載入失敗</strong>：{loadError}</span>
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
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">固定收支 🔄</h1>
          <p className="page-subtitle">管理每月定期租金、水電、訂閱與薪資，自動計算平均月度攤提</p>
        </div>
        <div className="flex gap-2">
          <button id="btn-export-recurring" className="btn btn-secondary" onClick={() => exportApi.recurringCsv()}>
            <Download size={18} />
            <span>匯出 CSV</span>
          </button>
          <button id="btn-add-recurring" className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={18} />
            <span>新增固定項目</span>
          </button>
        </div>
      </div>

      {/* 月攤提統計卡片 */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <span className="stat-label">固定支出每月平均攤提</span>
          <div className="stat-value" style={{ color: 'var(--color-danger)' }}>
            {formatCurrency(amortize?.monthly_expense ?? 0)}
          </div>
          <div className="stat-sub">將年繳、季繳換算為每月預留負擔</div>
        </div>

        <div className="stat-card">
          <span className="stat-label">固定收入每月預估</span>
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>
            {formatCurrency(amortize?.monthly_income ?? 0)}
          </div>
          <div className="stat-sub">穩定每月現金流進帳</div>
        </div>

        <div className="stat-card" style={{ background: 'var(--bg-surface-2)' }}>
          <span className="stat-label">每月固定淨額</span>
          <div className="stat-value" style={{ color: (amortize?.monthly_income ?? 0) - (amortize?.monthly_expense ?? 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatCurrency((amortize?.monthly_income ?? 0) - (amortize?.monthly_expense ?? 0))}
          </div>
          <div className="stat-sub">收入減去固定必要支出</div>
        </div>
      </div>

      {/* 固定支出清單 */}
      <div style={{ marginBottom: 32 }}>
        <h2 className="text-xl flex items-center gap-xs" style={{ marginBottom: 14 }}>
          <TrendingDown size={20} color="var(--color-danger)" />
          固定支出項目 ({expenseItems.length})
        </h2>

        {expenseItems.length === 0 ? (
          <div className="card empty-state">
            <div className="emoji">📝</div>
            <h3>尚未新增固定支出</h3>
            <p style={{ fontSize: '0.875rem', marginBottom: 12 }}>如房租、網路費、Netflix 訂閱、保險費等</p>
            <button className="btn btn-primary btn-sm" onClick={handleOpenAdd}>立即新增</button>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {expenseItems.map((item, idx) => {
                const monthlyShare = item.amount / (CYCLE_DIVISORS[item.cycle] || 1)
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px 20px',
                      borderBottom: idx !== expenseItems.length - 1 ? '1px solid var(--border-color)' : 'none',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: '1rem' }}>{item.name}</span>
                        <span className="badge badge-expense">
                          {CYCLE_LABELS[item.cycle] || item.cycle}
                        </span>
                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                          每月 {item.day_of_cycle} 號扣款
                        </span>
                      </div>
                      <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                        {item.account_name ? `關聯扣款帳戶：${item.account_name}` : '未指定關聯帳戶'}
                        {item.cycle !== 'monthly' && ` · 換算月攤提：${formatCurrency(monthlyShare)} / 月`}
                      </div>
                    </div>

                    <div className="flex items-center gap-md">
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--color-danger)', fontFamily: 'var(--font-display)' }}>
                          {formatCurrency(item.amount)}
                        </div>
                        <div className="text-xs text-muted">
                          {CYCLE_LABELS[item.cycle]}繳
                        </div>
                      </div>

                      <div className="flex gap-xs">
                        <button className="btn btn-ghost btn-sm" style={{ padding: 6 }} onClick={() => handleOpenEdit(item)}>
                          <Edit2 size={15} />
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ padding: 6, color: 'var(--color-danger)' }} onClick={() => handleDelete(item.id, item.name)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 固定收入清單 */}
      <div>
        <h2 className="text-xl flex items-center gap-xs" style={{ marginBottom: 14 }}>
          <TrendingUp size={20} color="var(--color-success)" />
          固定收入項目 ({incomeItems.length})
        </h2>

        {incomeItems.length === 0 ? (
          <div className="card empty-state" style={{ padding: 24 }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>尚未設定固定收入（如每月薪資、租金收益）</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {incomeItems.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: idx !== incomeItems.length - 1 ? '1px solid var(--border-color)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: '1rem' }}>{item.name}</span>
                      <span className="badge badge-income">{CYCLE_LABELS[item.cycle] || item.cycle}</span>
                      <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>每月 {item.day_of_cycle} 號入帳</span>
                    </div>
                    <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                      {item.account_name ? `入帳帳戶：${item.account_name}` : '未指定關聯帳戶'}
                    </div>
                  </div>

                  <div className="flex items-center gap-md">
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--color-success)', fontFamily: 'var(--font-display)' }}>
                        +{formatCurrency(item.amount)}
                      </div>
                      <div className="text-xs text-muted">{CYCLE_LABELS[item.cycle]}收</div>
                    </div>

                    <div className="flex gap-xs">
                      <button className="btn btn-ghost btn-sm" style={{ padding: 6 }} onClick={() => handleOpenEdit(item)}>
                        <Edit2 size={15} />
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ padding: 6, color: 'var(--color-danger)' }} onClick={() => handleDelete(item.id, item.name)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 新增/編輯 Modal */}
      {showModal && (
        <Modal
          title={editingItem ? '編輯固定收支' : '新增固定收支'}
          onClose={() => setShowModal(false)}
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
                固定支出
              </button>
              <button
                type="button"
                className={`btn btn-full ${form.type === 'income' ? 'btn-primary' : 'btn-secondary'}`}
                style={form.type === 'income' ? { background: 'var(--color-success)' } : {}}
                onClick={() => setForm(p => ({ ...p, type: 'income' }))}
              >
                固定收入
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

            {/* 週期 */}
            <div className="grid grid-2" style={{ gap: 10 }}>
              <div className="input-group">
                <label className="input-label">付款 / 入帳週期</label>
                <select
                  id="rec-cycle"
                  className="input"
                  value={form.cycle}
                  onChange={e => setForm(p => ({ ...p, cycle: e.target.value as any }))}
                >
                  <option value="monthly">每月</option>
                  <option value="bimonthly">每雙月 (2個月)</option>
                  <option value="quarterly">每季 (3個月)</option>
                  <option value="semiannual">每半年 (6個月)</option>
                  <option value="annual">每年 (12個月)</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">每期第幾天 (1~31)</label>
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

            {/* 關聯帳戶 */}
            <div className="input-group">
              <label className="input-label">關聯帳戶 (選填)</label>
              <select
                id="rec-account"
                className="input"
                value={form.account_id}
                onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}
              >
                <option value="">無特定帳戶</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type === 'bank' ? '銀行' : '信用卡'})
                  </option>
                ))}
              </select>
            </div>

            <button
              id="rec-submit"
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={submitting}
              style={{ marginTop: 8 }}
            >
              {submitting ? '儲存中…' : (editingItem ? '儲存變更' : '建立固定項目')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
