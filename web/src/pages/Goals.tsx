import { useState, useEffect } from 'react'
import { goalsApi, Goal } from '../api/client'
import { formatCurrency, formatDate } from '../components/utils'
import Modal from '../components/Modal'
import ProgressBar from '../components/ProgressBar'
import {
  Plus,
  Edit2,
  Trash2,
  Target,
  PiggyBank,
  CheckCircle,
  Calendar,
  Sparkles,
  Coins
} from 'lucide-react'

const EMOJI_PRESETS = ['🎯', '✈️', '🏠', '🚗', '💍', '💻', '👶', '🎓', '🏥', '🏖️', '🎒', '🎨']

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  // 新增/編輯 Modal 狀態
  const [showModal, setShowModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [form, setForm] = useState({
    name: '',
    emoji: '🎯',
    target_amount: '',
    monthly_reserve: '',
    deadline: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // 存錢 Modal 狀態
  const [depositGoal, setDepositGoal] = useState<Goal | null>(null)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositSubmitting, setDepositSubmitting] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const list = await goalsApi.list()
      setGoals(list)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenAdd = () => {
    setEditingGoal(null)
    setForm({
      name: '',
      emoji: '🎯',
      target_amount: '',
      monthly_reserve: '',
      deadline: '',
    })
    setErrorMsg('')
    setShowModal(true)
  }

  const handleOpenEdit = (goal: Goal) => {
    setEditingGoal(goal)
    setForm({
      name: goal.name,
      emoji: goal.emoji || '🎯',
      target_amount: goal.target_amount.toString(),
      monthly_reserve: goal.monthly_reserve?.toString() || '0',
      deadline: goal.deadline || '',
    })
    setErrorMsg('')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (!form.name.trim()) {
      setErrorMsg('請輸入目標名稱')
      return
    }
    const targetAmt = parseFloat(form.target_amount)
    if (isNaN(targetAmt) || targetAmt <= 0) {
      setErrorMsg('請輸入有效目標金額')
      return
    }
    const monthlyReserve = parseFloat(form.monthly_reserve) || 0

    try {
      setSubmitting(true)
      if (editingGoal) {
        await goalsApi.update(editingGoal.id, {
          name: form.name.trim(),
          emoji: form.emoji,
          target_amount: targetAmt,
          monthly_reserve: monthlyReserve,
          deadline: form.deadline || undefined,
        })
      } else {
        await goalsApi.create({
          name: form.name.trim(),
          emoji: form.emoji,
          target_amount: targetAmt,
          monthly_reserve: monthlyReserve,
          deadline: form.deadline || undefined,
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

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!depositGoal) return
    const amt = parseFloat(depositAmount)
    if (isNaN(amt) || amt <= 0) {
      alert('請輸入有效存款金額')
      return
    }

    try {
      setDepositSubmitting(true)
      await goalsApi.deposit(depositGoal.id, amt)
      setDepositGoal(null)
      setDepositAmount('')
      loadData()
    } catch (err: any) {
      alert(err.message || '存錢失敗')
    } finally {
      setDepositSubmitting(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`確定要刪除儲蓄目標「${name}」嗎？`)) return
    try {
      await goalsApi.remove(id)
      loadData()
    } catch (err: any) {
      alert(err.message || '刪除失敗')
    }
  }

  const totalSaved = goals.reduce((s, g) => s + g.saved_amount, 0)
  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0)
  const totalMonthlyReserve = goals.reduce((s, g) => s + (g.monthly_reserve || 0), 0)

  const timedGoals = goals.filter(g => !!g.deadline)
  const untimedGoals = goals.filter(g => !g.deadline)

  return (
    <div className="fade-in">
      {/* 標題與操作按鈕 */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">儲蓄目標 🎯</h1>
          <p className="page-subtitle">設立旅行、購屋、緊急備用金等夢想目標，按月預留並逐步實現</p>
        </div>
        <button id="btn-add-goal" className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={18} />
          <span>建立新目標</span>
        </button>
      </div>

      {/* 統計概覽 */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <span className="stat-label">已存總金額</span>
          <div className="stat-value" style={{ color: 'var(--color-primary)' }}>
            {formatCurrency(totalSaved)}
          </div>
          <div className="stat-sub">所有目標累計已存資金</div>
        </div>

        <div className="stat-card">
          <span className="stat-label">目標總金額</span>
          <div className="stat-value">
            {formatCurrency(totalTarget)}
          </div>
          <div className="stat-sub">整體達成率 {totalTarget > 0 ? ((totalSaved / totalTarget) * 100).toFixed(1) : 0}%</div>
        </div>

        <div className="stat-card" style={{ background: 'var(--bg-surface-2)' }}>
          <span className="stat-label">每月儲蓄預留合計</span>
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>
            {formatCurrency(totalMonthlyReserve)}
          </div>
          <div className="stat-sub">每月自可用預算中優先留存</div>
        </div>
      </div>

      {/* 目標清單 */}
      {goals.length === 0 ? (
        <div className="card empty-state">
          <div className="emoji">🌴</div>
          <h3>尚未設立任何儲蓄目標</h3>
          <p style={{ fontSize: '0.875rem', marginBottom: 16 }}>為自己和家庭設立第一個儲蓄目標吧，一步步累積安心感！</p>
          <button className="btn btn-primary btn-sm" onClick={handleOpenAdd}>立刻設定目標</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* 有期限目標 */}
          {timedGoals.length > 0 && (
            <div>
              <h2 className="text-xl flex items-center gap-xs" style={{ marginBottom: 14 }}>
                <Calendar size={20} color="var(--color-primary)" />
                有期限目標 ({timedGoals.length})
              </h2>
              <div className="grid grid-2">
                {timedGoals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={() => handleOpenEdit(goal)}
                    onDelete={() => handleDelete(goal.id, goal.name)}
                    onDeposit={() => {
                      setDepositGoal(goal)
                      setDepositAmount('')
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 無期限目標 */}
          {untimedGoals.length > 0 && (
            <div>
              <h2 className="text-xl flex items-center gap-xs" style={{ marginBottom: 14 }}>
                <PiggyBank size={20} color="var(--color-success)" />
                長期 / 無期限儲蓄 ({untimedGoals.length})
              </h2>
              <div className="grid grid-2">
                {untimedGoals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={() => handleOpenEdit(goal)}
                    onDelete={() => handleDelete(goal.id, goal.name)}
                    onDeposit={() => {
                      setDepositGoal(goal)
                      setDepositAmount('')
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 新增/編輯 Modal */}
      {showModal && (
        <Modal
          title={editingGoal ? '編輯儲蓄目標' : '建立儲蓄目標'}
          onClose={() => setShowModal(false)}
        >
          {errorMsg && (
            <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid var(--color-danger)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, color: 'var(--color-danger)', fontSize: '0.85rem' }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Emoji 選擇 */}
            <div className="input-group">
              <label className="input-label">選擇圖示</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {EMOJI_PRESETS.map(em => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, emoji: em }))}
                    style={{
                      fontSize: '1.4rem',
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: form.emoji === em ? 'rgba(255,138,138,0.2)' : 'var(--bg-surface-2)',
                      border: form.emoji === em ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                      cursor: 'pointer',
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {/* 名稱 */}
            <div className="input-group">
              <label className="input-label">目標名稱</label>
              <input
                id="goal-name"
                className="input"
                type="text"
                placeholder="例如 日本沖繩旅遊、緊急備用金、買新筆電"
                required
                autoFocus
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>

            {/* 目標金額 */}
            <div className="input-group">
              <label className="input-label">目標金額 (NT$)</label>
              <input
                id="goal-target"
                className="input"
                type="number"
                step="100"
                min="100"
                placeholder="例如 60000"
                required
                value={form.target_amount}
                onChange={e => setForm(p => ({ ...p, target_amount: e.target.value }))}
              />
            </div>

            {/* 每月預留 */}
            <div className="input-group">
              <label className="input-label">每月預留存入金額 (選填)</label>
              <input
                id="goal-reserve"
                className="input"
                type="number"
                step="100"
                min="0"
                placeholder="例如 5000（將自每月可自由支配金額扣除）"
                value={form.monthly_reserve}
                onChange={e => setForm(p => ({ ...p, monthly_reserve: e.target.value }))}
              />
            </div>

            {/* 截止日 */}
            <div className="input-group">
              <label className="input-label">目標達成截止日 (選填)</label>
              <input
                id="goal-deadline"
                className="input"
                type="date"
                value={form.deadline}
                onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
              />
            </div>

            <button
              id="goal-submit"
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={submitting}
              style={{ marginTop: 8 }}
            >
              {submitting ? '儲存中…' : (editingGoal ? '儲存變更' : '確認建立目標')}
            </button>
          </form>
        </Modal>
      )}

      {/* 存錢 Modal */}
      {depositGoal && (
        <Modal
          title={`存入「${depositGoal.emoji} ${depositGoal.name}」`}
          onClose={() => setDepositGoal(null)}
          maxWidth={400}
        >
          <form onSubmit={handleDepositSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 6 }}>💰</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                目前已存：{formatCurrency(depositGoal.saved_amount)} / 目標：{formatCurrency(depositGoal.target_amount)}
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">本次存入金額 (NT$)</label>
              <input
                id="deposit-amount"
                className="input"
                type="number"
                step="1"
                min="1"
                placeholder="例如 3000"
                required
                autoFocus
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
              />
            </div>

            <button
              id="deposit-submit"
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={depositSubmitting}
              style={{ marginTop: 8 }}
            >
              {depositSubmitting ? '處理中…' : '確認存入'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

function GoalCard({
  goal,
  onEdit,
  onDelete,
  onDeposit
}: {
  goal: Goal
  onEdit: () => void
  onDelete: () => void
  onDeposit: () => void
}) {
  const pct = Math.min((goal.saved_amount / goal.target_amount) * 100, 100)
  const isDone = goal.saved_amount >= goal.target_amount

  return (
    <div className="card" style={{ borderTop: isDone ? '4px solid var(--color-success)' : '4px solid var(--color-primary)' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.6rem' }}>{goal.emoji || '🎯'}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{goal.name}</div>
            {goal.deadline && (
              <div className="text-xs text-muted">
                預計截止：{goal.deadline}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-xs">
          <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} onClick={onEdit}>
            <Edit2 size={14} />
          </button>
          <button className="btn btn-ghost btn-sm" style={{ padding: 4, color: 'var(--color-danger)' }} onClick={onDelete}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div className="flex justify-between items-center text-sm" style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1.1rem', fontFamily: 'var(--font-display)' }}>
            {formatCurrency(goal.saved_amount)}
          </span>
          <span className="text-muted">
            目標 {formatCurrency(goal.target_amount)} ({pct.toFixed(0)}%)
          </span>
        </div>
        <ProgressBar value={goal.saved_amount} max={goal.target_amount} variant={isDone ? 'safe' : 'default'} height={10} />
      </div>

      <div className="flex items-center justify-between" style={{ paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
        <div className="text-xs text-muted">
          {goal.monthly_reserve > 0 ? `每月預留 ${formatCurrency(goal.monthly_reserve)}` : '未設定每月固定預留'}
        </div>

        <button
          className={`btn btn-sm ${isDone ? 'btn-secondary' : 'btn-primary'}`}
          onClick={onDeposit}
          disabled={isDone}
        >
          <Coins size={14} />
          <span>{isDone ? '已達成目標 🎉' : '存錢進度 +'}</span>
        </button>
      </div>
    </div>
  )
}
