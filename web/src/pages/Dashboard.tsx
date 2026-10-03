import { DashboardSkeleton } from '../components/Skeleton'
import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { accountsApi, txApi, recurringApi, goalsApi, budgetsApi, Account, Transaction } from '../api/client'
import { formatCurrency, formatDate, today, thisMonth, CATEGORIES, CATEGORY_ICONS, buildHistoryMemo, recommendCategory } from '../components/utils'
import Modal from '../components/Modal'
import ProgressBar from '../components/ProgressBar'
import {
  AlertCircle,
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
  Calendar,
} from 'lucide-react'

export default function Dashboard() {
  const { user, balance, setBalance, accounts, setAccounts, transactions, setTransactions } = useStore()
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [budgets, setBudgets] = useState<any[]>([])
  const [recurringList, setRecurringList] = useState<any[]>([])
  const [goalsList, setGoalsList] = useState<any[]>([])
  const [monthlyStats, setMonthlyStats] = useState<any[]>([])
  const [viewScope, setViewScope] = useState<'all' | 'household' | 'personal'>('all')
  const navigate = useNavigate()

  // 快速新增表單
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
  const [submitError, setSubmitError] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isCategoryManuallyChanged, setIsCategoryManuallyChanged] = useState(false)
  const [recommendationHint, setRecommendationHint] = useState<string | null>(null)

  const historyMemo = useMemo(() => buildHistoryMemo(transactions), [transactions])

  const loadData = async (scope = viewScope) => {
    try {
      setLoading(true)
      setLoadError(null)
      const currentYear = thisMonth().slice(0, 4);
      const [bal, accs, txs, buds, rec, g, monthlyStats] = await Promise.all([
        accountsApi.balance(scope),
        accountsApi.list(scope),
        txApi.list({ limit: '10', scope }),
        budgetsApi.list(),
        recurringApi.list(),
        goalsApi.list(),
        txApi.monthly(currentYear, scope),
      ])

      if (bal) setBalance(bal)
      setAccounts(accs)
      setTransactions(txs)
      setBudgets(buds)
      setRecurringList(rec)
      setGoalsList(g)
      setMonthlyStats(monthlyStats)
    } catch (e: any) {
      console.error('Failed to load dashboard data:', e)
      setLoadError(e.message || '資料載入失敗，請檢查網路連線或伺服器狀態')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(viewScope)
  }, [viewScope])

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    if (!form.account_id) {
      setSubmitError(accounts.length === 0 ? '請先至「帳戶管理」建立至少一個帳戶' : '請選擇扣款或存入帳戶')
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
        is_shared: form.is_shared,
      })
      setShowAddModal(false)
      setForm(p => ({ ...p, amount: '', note: '', date: today() }))
      loadData(viewScope)
    } catch (err: any) {
      setSubmitError(err.message || '記帳失敗')
    } finally {
      setSubmitting(false)
    }
  }

  // 本月收支計算 (依目前選定之視角)
  const thisMonthStr = today().slice(0, 7)
  const monthTransactions = transactions.filter(t => {
    if (!t.date?.startsWith(thisMonthStr)) return false
    if (viewScope === 'household') return t.is_shared === 1
    if (viewScope === 'personal') return t.is_shared === 0
    return true
  })
  const thisMonthData = monthlyStats.filter((m: any) => m.month === thisMonthStr)
  const monthIncome = thisMonthData.find((m: any) => m.type === 'income')?.total || 0
  const monthExpense = thisMonthData.find((m: any) => m.type === 'expense')?.total || 0

  // 警示預算
  const overBudgets = budgets.filter(b => b.over)

  // 視角防禦過濾帳戶清單
  const displayAccounts = accounts.filter(acc => {
    if (viewScope === 'household') {
      return acc.is_joint === 1;
    }
    if (viewScope === 'personal') {
      return acc.is_joint === 0 && (!user || acc.user_id === user.id);
    }
    return true;
  });

  if (loading && !balance) {
    return <DashboardSkeleton />
  }

  return (
    <div className="fade-in">
      {loadError && (
        <div className="alert alert-danger flex items-center justify-between" style={{ marginBottom: 20 }}>
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <span>⚠️ <strong>資料載入失敗</strong>：{loadError}</span>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => loadData(viewScope)}
            style={{ padding: '4px 12px', fontSize: '0.85rem' }}
          >
            重新嘗試
          </button>
        </div>
      )}
      {/* 頁面標題 */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">早安，{user?.name || '朋友'} 👋</h1>
          <p className="page-subtitle">這裡是您本月的財務總覽與即時收支數據</p>
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

      {/* 帳本視角切換器 */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: 4,
        background: 'var(--bg-surface-2)',
        borderRadius: 12,
        border: '1px solid var(--border-color)',
        marginBottom: 20
      }}>
        <button
          type="button"
          className={`btn btn-sm ${viewScope === 'all' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: 8, padding: '6px 14px', fontSize: '0.85rem' }}
          onClick={() => setViewScope('all')}
        >
          <span>🌐 全部</span>
        </button>
        <button
          type="button"
          className={`btn btn-sm ${viewScope === 'household' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: 8, padding: '6px 14px', fontSize: '0.85rem' }}
          onClick={() => setViewScope('household')}
        >
          <span>🏠 公帳</span>
        </button>
        <button
          type="button"
          className={`btn btn-sm ${viewScope === 'personal' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: 8, padding: '6px 14px', fontSize: '0.85rem' }}
          onClick={() => setViewScope('personal')}
        >
          <span>🔒 私帳</span>
        </button>
      </div>

      {/* 核心資產/可動用資訊欄位 */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        {/* 淨可用餘額 */}
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(255,138,138,0.15) 0%, rgba(255,212,160,0.15) 100%)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <span className="stat-label">淨可用餘額</span>
            <div style={{ background: 'var(--color-primary)', color: 'white', padding: 6, borderRadius: '50%' }}>
              <Wallet size={18} />
            </div>
          </div>
          <div className="stat-value" style={{ color: (balance?.available ?? 0) >= 0 ? 'var(--text-primary)' : 'var(--color-danger)' }}>
            {formatCurrency(balance?.available ?? 0)}
          </div>
          <div className="stat-sub">
            現金 {formatCurrency(balance?.cashTotal ?? 0)} + 銀行存款帳戶 {formatCurrency(balance?.bankTotal ?? 0)} - 卡債 {formatCurrency((balance?.ccBilled ?? 0) + (balance?.ccUnbilled ?? 0))}
          </div>
        </div>

        {/* 真實可支配現金 */}
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(85,197,149,0.15) 0%, rgba(168,216,234,0.15) 100%)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <span className="stat-label">真實可支配現金</span>
            <div style={{ background: 'var(--color-success)', color: 'white', padding: 6, borderRadius: '50%' }}>
              <Sparkles size={18} />
            </div>
          </div>
          <div className="stat-value" style={{ color: (balance?.disposable ?? 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatCurrency(balance?.disposable ?? 0)}
          </div>
          <div className="stat-sub">
            含固定開銷分攤 {formatCurrency(balance?.monthlyFixed ?? 0)} 與儲蓄扣款 {formatCurrency(balance?.monthlyGoals ?? 0)}
          </div>
        </div>

        {/* 當月收支結算 */}
        <div className="stat-card">
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <span className="stat-label">
              {viewScope === 'household' ? '當月公帳淨結算' : viewScope === 'personal' ? '當月個人私帳淨收支' : '當月淨收支'}
            </span>
            <div style={{ background: 'var(--color-secondary)', color: '#7a4e00', padding: 6, borderRadius: '50%' }}>
              {monthIncome - monthExpense >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            </div>
          </div>
          <div className="stat-value" style={{ color: monthIncome - monthExpense >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatCurrency(monthIncome - monthExpense)}
          </div>
          <div className="stat-sub flex gap-sm" style={{ marginTop: 6 }}>
            <span style={{ color: 'var(--color-success)' }}>
              收入 {formatCurrency(monthIncome)}
            </span>
            <span style={{ color: 'var(--color-danger)' }}>
              支出 {formatCurrency(monthExpense)}
            </span>
          </div>
        </div>
      </div>

      {/* 警示區塊：當月預算超支時 */}
      {overBudgets.length > 0 && (
        <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--color-danger)', background: 'rgba(255,107,107,0.06)' }}>
          <div className="flex items-center gap-sm">
            <AlertTriangle size={20} color="var(--color-danger)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-danger)' }}>
              注意！有 {overBudgets.length} 個分類支出已超出預算！
            </h3>
          </div>
          <div className="flex gap-md" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {overBudgets.map(b => (
              <span key={b.category} className="badge badge-expense">
                {b.category}：已用 {formatCurrency(b.spent)} / 預算 {formatCurrency(b.amount)}（超支 {formatCurrency(b.spent - b.amount)}）
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 主要區塊：左 2/3 (帳戶 + 最近交易) + 右 1/3 (儲蓄目標 + 週期支出總覽) */}
      <div className="grid-dashboard-main">
        <div className="flex-col gap-lg" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* 帳戶一覽 */}
          <div className="card">
            <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
              <h2 className="text-xl flex items-center gap-xs">
                <CreditCard size={20} color="var(--color-primary)" />
                帳戶一覽
              </h2>
              <Link to="/accounts" className="btn btn-ghost btn-sm">
                管理帳戶 <ChevronRight size={16} />
              </Link>
            </div>

            {displayAccounts.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="emoji">💳</div>
                <h3>{viewScope === 'household' ? '目前無家庭公用帳戶' : viewScope === 'personal' ? '目前無個人私帳' : '尚未建立帳戶'}</h3>
                <p style={{ fontSize: '0.875rem', marginBottom: 12 }}>
                  {viewScope === 'household' ? '至帳戶管理將帳戶屬性設為家庭公用（共同基金或家庭卡）即可在此呈現' : '至帳戶管理新增你的銀行、現金或信用卡'}
                </p>
                <Link to="/accounts" className="btn btn-primary btn-sm">前往帳戶管理</Link>
              </div>
            ) : (
              <div className="grid grid-2">
                {displayAccounts.map(acc => {
                  const isCc = acc.type === 'credit_card';
                  const isCash = acc.type === 'cash';
                  const totalDue = isCc ? (acc.balance || 0) + (acc.unbilled || 0) : acc.balance;

                  return (
                    <div
                      key={acc.id}
                      style={{
                        padding: 14,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-surface-2)',
                        border: '1px solid var(--border-color)',
                        borderLeft: `5px solid ${acc.color || (isCash ? '#10B981' : isCc ? 'var(--color-danger)' : 'var(--color-primary)')}`,
                      }}
                    >
                      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                        <div className="flex items-center gap-xs">
                          {isCash ? (
                            <Wallet size={16} color="#10B981" />
                          ) : isCc ? (
                            <CreditCard size={16} color="var(--color-danger)" />
                          ) : (
                            <Building size={16} color="var(--color-primary)" />
                          )}
                          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{acc.name}</span>
                        </div>
                        <div className="flex items-center gap-xs">
                          {acc.is_joint === 1 ? (
                            <span className="badge badge-primary" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                              🏠 公帳
                            </span>
                          ) : (
                            <span className="badge badge-secondary" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                              🔒 私帳
                            </span>
                          )}
                          <span className="badge" style={{ fontSize: '0.68rem', padding: '1px 5px', background: 'rgba(0,0,0,0.05)' }}>
                            {isCash ? '現金' : isCc ? '信用卡' : '銀行存款帳戶'}
                          </span>
                        </div>
                      </div>

                      <div style={{
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        marginTop: 4,
                        fontFamily: 'var(--font-display)',
                        color: isCc && totalDue > 0 ? 'var(--color-danger)' : isCash ? '#10B981' : 'var(--text-primary)'
                      }}>
                        {formatCurrency(totalDue)}
                      </div>

                      {/* 信用卡公私拆解與未出帳/繳款狀態 */}
                      {isCc && (
                        <div style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {totalDue > 0 ? (
                            <div className="flex items-center justify-between" style={{ background: 'rgba(0,0,0,0.03)', padding: '3px 6px', borderRadius: 4, marginBottom: 2 }}>
                              <span>🏠 代墊：<strong>{formatCurrency(acc.shared_debt || 0)}</strong></span>
                              <span>·</span>
                              <span>👤 個人私帳：<strong>{formatCurrency(acc.personal_debt || 0)}</strong></span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>卡費已全數結清</span>
                          )}
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            未出帳 {formatCurrency(acc.unbilled || 0)}
                            {acc.payment_due_day ? ` · 每月 ${acc.payment_due_day} 日繳款` : ''}
                          </div>
                        </div>
                      )}

                      {/* 擁有者註記 */}
                      {!isCc && acc.owner_name && (
                        <div className="text-xs text-muted" style={{ marginTop: 4, fontSize: '0.72rem' }}>
                          擁有者：{acc.owner_name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 最近明細 */}
          <div className="card">
            <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
              <h2 className="text-xl flex items-center gap-xs">
                <Calendar size={20} color="var(--color-primary)" />
                最近交易記錄 ({viewScope === 'household' ? '公帳' : viewScope === 'personal' ? '個人私帳' : '全部'})
              </h2>
              <Link to="/transactions" className="btn btn-ghost btn-sm">
                查看全部 <ChevronRight size={16} />
              </Link>
            </div>

            {transactions.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <p style={{ color: 'var(--text-muted)' }}>此視角目前尚無收支記錄</p>
                <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => setShowAddModal(true)}>
                  記一筆帳
                </button>
              </div>
            ) : (
              <div className="tx-list">
                {transactions.slice(0, 6).map(tx => (
                  <div key={tx.id} className="tx-item">
                    <div className={`tx-icon ${tx.type}`}>
                      {CATEGORY_ICONS[tx.category] || (tx.type === 'income' ? '💰' : '💸')}
                    </div>
                    <div className="tx-info">
                      <div className="tx-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{tx.category} {tx.note ? `· ${tx.note}` : ''}</span>
                        {tx.is_shared === 0 ? (
                          <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.7rem', padding: '1px 6px' }}>
                            🔒 私帳
                          </span>
                        ) : (
                          <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontSize: '0.7rem', padding: '1px 6px' }}>
                            🏠 公帳
                          </span>
                        )}
                        {tx.user_name && (
                          <span className="badge badge-safe" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                            👤 {tx.user_name}
                          </span>
                        )}
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
                儲蓄進度
              </h2>
              <Link to="/goals" className="btn btn-ghost btn-sm">
                管理 <ChevronRight size={16} />
              </Link>
            </div>

            {goalsList.length === 0 ? (
              <div className="text-sm text-muted" style={{ textAlign: 'center', padding: '16px 0' }}>
                目前未設定儲蓄目標，點擊設定一個旅行或儲蓄目標吧！
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

          {/* 智慧理財提示 */}
          <div className="card" style={{ background: 'var(--bg-surface-2)' }}>
            <h3 className="text-lg flex items-center gap-xs" style={{ marginBottom: 12 }}>
              <Sparkles size={18} color="var(--color-warning)" />
              家庭財務錦囊
            </h3>
            <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingLeft: 18, lineHeight: 1.8 }}>
              <li>
                週期支出每月平均預算 <strong>{formatCurrency(balance?.monthlyFixed ?? 0)}</strong>，已自動從真實可支配現金扣除。
              </li>
              <li>
                每月計劃儲蓄金額 <strong>{formatCurrency(balance?.monthlyGoals ?? 0)}</strong>，建議按款項留存。
              </li>
              <li>
                公帳由全體家庭成員共同分攤檢視，個人私帳僅個人專屬可見，彼此保有獨立財務隱私。
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 快速記帳彈窗 */}
      {showAddModal && (
        <Modal title="快速記帳" onClose={() => { setShowAddModal(false); setIsCategoryManuallyChanged(false); setRecommendationHint(null); }}>
          {submitError && (
            <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid var(--color-danger)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, color: 'var(--color-danger)', fontSize: '0.85rem' }}>
              {submitError}
            </div>
          )}
          <form onSubmit={handleQuickAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 帳本歸屬選擇器 (公帳 / 個人私帳) */}
            <div className="input-group">
              <label className="input-label" style={{ marginBottom: 6, fontWeight: 600 }}>帳本歸屬</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  className={`btn ${form.is_shared === 1 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px' }}
                  onClick={() => setForm(p => ({ ...p, is_shared: 1 }))}
                >
                  <span>🏠 公帳</span>
                </button>
                <button
                  type="button"
                  className={`btn ${form.is_shared === 0 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px' }}
                  onClick={() => setForm(p => ({ ...p, is_shared: 0 }))}
                >
                  <span>🔒 私帳</span>
                </button>
              </div>
            </div>

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
              <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                <label className="input-label" style={{ margin: 0 }}>分類</label>
                {recommendationHint && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-primary-dark)', background: 'rgba(255, 107, 107, 0.12)', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                    {recommendationHint}
                  </span>
                )}
              </div>
              <select
                id="quick-category"
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
                id="quick-account"
                className="input"
                value={form.account_id}
                onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}
                required
              >
                <option value="" disabled>-- 請選擇扣款 / 存入帳戶 --</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.type === 'cash' ? '💵 現金' : acc.type === 'bank' ? '🏦 銀行存款帳戶' : '💳 信用卡'} - {acc.name} ({acc.is_joint === 1 ? '🏠 公帳' : '🔒 私帳'})
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
                placeholder="例如 午餐便當、中油加油、Netflix"
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
              id="quick-submit"
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={submitting}
              style={{ marginTop: 8 }}
            >
              {submitting ? '記錄中...' : '確認記錄'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
