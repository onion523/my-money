import { FamilySkeleton } from '../components/Skeleton'
import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { householdApi, HouseholdData, HouseholdMember, HouseholdAdvance, accountsApi, Account } from '../api/client'
import { formatCurrency, today, formatLocalDate } from '../components/utils'
import Modal from '../components/Modal'
import {
  Users,
  UserPlus,
  Shield,
  User,
  Copy,
  Check,
  LogOut,
  Trash2,
  Home,
  Sparkles,
  Info,
  Calendar,
  Mail,
  DollarSign,
  CheckCircle2,
  ArrowRightLeft,
  Wallet,
  ChevronDown,
  ChevronUp,
  Receipt,
  History,
  Lightbulb
} from 'lucide-react'

export default function Family() {
  const { user } = useStore()
  const [data, setData] = useState<HouseholdData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteExpires, setInviteExpires] = useState('')

  // Create household form
  const [createName, setCreateName] = useState('')
  const [creating, setCreating] = useState(false)

  // Join household form
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  // 代墊與報銷狀態
  const [advances, setAdvances] = useState<HouseholdAdvance[]>([])
  const [jointAccounts, setJointAccounts] = useState<Account[]>([])
  const [allAccounts, setAllAccounts] = useState<Account[]>([])
  const [expandedMemberIds, setExpandedMemberIds] = useState<Record<string, boolean>>({})
  const [reimburseModalTarget, setReimburseModalTarget] = useState<any | null>(null)
  const [reimburseForm, setReimburseForm] = useState({
    from_account_id: '',
    to_account_id: '',
    amount: '',
    date: today(),
    note: '',
  })
  const [reimbursing, setReimbursing] = useState(false)
  const [reimburseError, setReimburseError] = useState('')

  const loadData = async () => {
    try {
      setLoading(true)
      const [res, advList, accs] = await Promise.all([
        householdApi.current(),
        householdApi.advances(),
        accountsApi.list()
      ])
      setData(res)
      setAdvances(advList || [])
      setAllAccounts(accs || [])
      setJointAccounts((accs || []).filter(a => a.is_joint === 1 && (a.type === 'bank' || a.type === 'cash')))
      if (res.activeInvitation) {
        setInviteCode(res.activeInvitation.code)
        setInviteExpires(res.activeInvitation.expires_at)
      }
    } catch (err: any) {
      setErrorMsg(err.message || '無法載入家庭資料')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (userId: string) => {
    setExpandedMemberIds(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }))
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createName.trim()) return
    try {
      setCreating(true)
      await householdApi.create(createName.trim())
      setCreateName('')
      await loadData()
    } catch (err: any) {
      alert(err.message || '建立家庭群組失敗')
    } finally {
      setCreating(false)
    }
  }

  
  const handleOpenReimburse = (adv: any) => {
    setReimburseModalTarget(adv)

    setReimburseForm({
      from_account_id: '',
      to_account_id: '',
      amount: adv.pending_reimburse.toString(),
      date: today(),
      note: `家庭共同基金撥款報銷 ${adv.user_name} 代墊公帳`,
    })
    setReimburseError('')
  }

  const handleReimburseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reimburseModalTarget) return
    setReimburseError('')

    const { from_account_id, to_account_id, amount, date, note } = reimburseForm
    const amt = parseFloat(amount)
    if (!from_account_id || !to_account_id || isNaN(amt) || amt <= 0) {
      setReimburseError('請選擇撥款公帳、收款帳戶並輸入大於 0 的金額')
      return
    }

    try {
      setReimbursing(true)
      const res = await householdApi.reimburse({
        target_user_id: reimburseModalTarget.user_id,
        from_account_id,
        to_account_id,
        amount: amt,
        date,
        note,
      })
      setReimburseModalTarget(null)
      await loadData()
      alert(res.message || '撥款報銷成功！')
    } catch (err: any) {
      setReimburseError(err.message || '報銷失敗')
    } finally {
      setReimbursing(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim()) return
    try {
      setJoining(true)
      await householdApi.join(joinCode.trim())
      setJoinCode('')
      await loadData()
    } catch (err: any) {
      alert(err.message || '加入家庭群組失敗，請確認邀請碼是否正確')
    } finally {
      setJoining(false)
    }
  }

  const handleGenerateInvite = async () => {
    try {
      const res = await householdApi.invite()
      setInviteCode(res.code)
      setInviteExpires(res.expires_at)
      setShowInviteModal(true)
    } catch (err: any) {
      alert(err.message || '無法產生邀請碼')
    }
  }

  const handleCopyCode = () => {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLeave = async () => {
    if (!confirm('確定要退出這個家庭群組嗎？退出後將無法查看此家庭的家庭群組帳本。')) return
    try {
      await householdApi.leave()
      await loadData()
    } catch (err: any) {
      alert(err.message || '退出失敗')
    }
  }

  const handleRemoveMember = async (member: HouseholdMember) => {
    if (!confirm(`確定要將成員「${member.name}」移出家庭群組嗎？`)) return
    try {
      await householdApi.removeMember(member.user_id)
      await loadData()
    } catch (err: any) {
      alert(err.message || '移除成員失敗')
    }
  }

  if (loading) {
    return <FamilySkeleton />
  }

  const hasHousehold = !!data?.household

  return (
    <div className="fade-in">
      {/* 標題與說明 */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>家庭協同管理</span>
            <Users size={24} style={{ color: 'var(--color-primary)' }} />
          </h1>
          <p className="page-subtitle">與伴侶或家人共同管理即時資金、分擔開支與追蹤儲蓄進度</p>
        </div>
        {hasHousehold && (
          <button id="btn-invite-family" className="btn btn-primary" onClick={handleGenerateInvite}>
            <UserPlus size={18} />
            <span>邀請新成員</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="badge badge-over" style={{ padding: '10px 14px', marginBottom: 16, display: 'block' }}>
          {errorMsg}
        </div>
      )}

      {!hasHousehold ? (
        /* 尚未建立或加入家庭群組 */
        <div className="grid grid-2" style={{ gap: 24 }}>
          {/* 建立家庭群組 */}
          <div className="card" style={{ padding: 28 }}>
            <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'var(--gradient-card)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: '#FF6B6B'
              }}>
                <Home size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>建立新家庭群組帳本</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>創建專屬空間並邀請另一半或家人加入</p>
              </div>
            </div>

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">家庭名稱</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="例如：溫馨小家庭、洋蔥小窩"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={creating}>
                <Sparkles size={18} />
                <span>{creating ? '建立中...' : '立即建立家庭群組'}</span>
              </button>
            </form>
          </div>

          {/* 加入已有家庭 */}
          <div className="card" style={{ padding: 28 }}>
            <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'var(--gradient-card-blue)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: '#4A90E2'
              }}>
                <UserPlus size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>輸入邀請碼加入</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>輸入家人分享給你的 6~8 碼家庭邀請碼</p>
              </div>
            </div>

            <form onSubmit={handleJoin}>
              <div className="form-group">
                <label className="form-label">家庭邀請碼</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="例如：FAM-EULQ"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  style={{ textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }}
                  required
                />
              </div>
              <button type="submit" className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }} disabled={joining}>
                <Users size={18} />
                <span>{joining ? '驗證加入中...' : '加入家庭帳本'}</span>
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* 已在家庭中 */
        <div>
          {/* 家庭資訊橫幅 */}
          <div className="card" style={{
            padding: 24,
            marginBottom: 24,
            background: 'var(--gradient-card)',
            border: '1px solid rgba(255,138,138,0.2)'
          }}>
            <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 16 }}>
              <div className="flex items-center gap-4">
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: 'white', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: 'var(--color-primary)', boxShadow: 'var(--shadow-sm)'
                }}>
                  <Home size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{data.household?.name}</h2>
                    <span className="badge badge-default" style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {data.myRole === 'admin' ? <><Shield size={12} /> 家庭管理員</> : <><User size={12} /> 家庭群組成員</>}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                    共有 {data.members.length} 位成員共同協同記帳中
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                {data.myRole === 'admin' && (
                  <button className="btn btn-secondary" onClick={handleGenerateInvite}>
                    <UserPlus size={16} />
                    <span>邀請碼</span>
                  </button>
                )}
                <button className="btn btn-ghost" style={{ color: 'var(--color-danger)' }} onClick={handleLeave}>
                  <LogOut size={16} />
                  <span>離開家庭群組</span>
                </button>
              </div>
            </div>
          </div>

          
          {/* 家庭公帳代墊與報銷中心 */}
          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <DollarSign size={20} color="var(--color-primary)" />
                  家庭公帳代墊與報銷中心
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                  即時統計各成員掏個人錢包或信用卡為家庭代墊的公帳，支援從共同基金一鍵撥款報銷平帳！
                </p>
              </div>
            </div>

            {advances.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)' }}>
                <Info size={28} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.6 }} />
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>暫無公帳代墊款紀錄</div>
                <div className="text-xs" style={{ marginTop: 4 }}>
                  當家庭群組成員使用個人私帳、私卡或個人現金錢包支付公帳支出時，系統將自動在此產生待報銷代墊款。
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {advances.map(adv => {
                  const isExpanded = !!expandedMemberIds[adv.user_id]
                  const advanceItems = adv.advance_items || []
                  const reimbItems = adv.reimbursement_items || []

                  return (
                    <div
                      key={adv.user_id}
                      style={{
                        borderRadius: 12,
                        background: adv.pending_reimburse > 0 ? 'rgba(255, 138, 138, 0.05)' : 'var(--bg-surface-2)',
                        border: adv.pending_reimburse > 0 ? '1px solid rgba(255, 138, 138, 0.3)' : '1px solid var(--border-color)',
                        overflow: 'hidden',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {/* 頂部成員代墊概覽 */}
                      <div
                        style={{
                          padding: '16px 20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 16
                        }}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{adv.user_name}</span>
                            {adv.pending_reimburse > 0 ? (
                              <span className="badge badge-danger">有待請款代墊</span>
                            ) : (
                              <span className="badge badge-success">
                                <CheckCircle2 size={12} style={{ display: 'inline', marginRight: 2 }} />
                                已全數結清
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-secondary)', marginTop: 6 }}>
                            <span>累計公帳墊付：{formatCurrency(adv.total_advanced)}</span>
                            <span>·</span>
                            <span>已獲撥款報銷：{formatCurrency(adv.total_reimbursed)}</span>
                          </div>
                        </div>

                        <div className="family-adv-actions">
                          <div className="family-adv-amount-box" style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>待報銷總額</div>
                            <div style={{
                              fontSize: '1.35rem',
                              fontWeight: 800,
                              color: adv.pending_reimburse > 0 ? 'var(--color-danger)' : 'var(--color-success)'
                            }}>
                              {formatCurrency(adv.pending_reimburse)}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
                            {adv.pending_reimburse > 0 && (data.myRole === 'admin' || user?.id === adv.user_id) && (
                              <button
                                className="btn btn-primary"
                                onClick={() => handleOpenReimburse(adv)}
                                style={{ padding: '7px 14px', fontSize: '0.9rem', flex: '1 1 auto', minWidth: '120px' }}
                              >
                                <ArrowRightLeft size={15} style={{ marginRight: 4 }} />
                                報銷沖帳
                              </button>
                            )}

                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => toggleExpand(adv.user_id)}
                              style={{ padding: '7px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flex: '1 1 auto', minWidth: '120px' }}
                            >
                              {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                              {isExpanded ? '收起明細' : '查看代墊明細'}
                              <span style={{
                                background: 'rgba(0,0,0,0.1)',
                                borderRadius: 10,
                                padding: '1px 6px',
                                fontSize: '0.75rem',
                                marginLeft: 2
                              }}>
                                {advanceItems.length}
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 就地展開明細區塊 */}
                      {isExpanded && (
                        <div style={{
                          borderTop: '1px solid var(--border-color)',
                          background: 'rgba(0, 0, 0, 0.02)',
                          padding: '16px 20px'
                        }}>
                          {/* 1. 代墊消費明細清單 */}
                          <div style={{ marginBottom: 20 }}>
                            <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                              <h4 style={{ fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                                <Receipt size={16} color="var(--color-primary)" />
                                個人代墊消費明細 ({advanceItems.length} 筆)
                              </h4>
                              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                僅計入自個人私帳、私卡或現金錢包支付之公帳
                              </span>
                            </div>

                            {advanceItems.length === 0 ? (
                              <div className="text-xs text-secondary" style={{ padding: '12px 14px', background: 'var(--bg-surface-2)', borderRadius: 8 }}>
                                尚未有任何個人代墊公帳消費紀錄。
                              </div>
                            ) : (
                              <div style={{
                                background: 'var(--bg-surface)',
                                borderRadius: 8,
                                border: '1px solid var(--border-color)',
                                overflowX: 'auto'
                              }}>
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: '100px 1fr 140px 110px',
                                  minWidth: 440,
                                  padding: '8px 14px',
                                  background: 'var(--bg-surface-2)',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  color: 'var(--text-secondary)',
                                  borderBottom: '1px solid var(--border-color)'
                                }}>
                                  <div>消費日期</div>
                                  <div>類別與備註</div>
                                  <div>墊付扣款帳戶</div>
                                  <div style={{ textAlign: 'right' }}>代墊金額</div>
                                </div>
                                {advanceItems.map(item => (
                                  <div
                                    key={item.id}
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: '100px 1fr 140px 110px',
                                      minWidth: 440,
                                      padding: '10px 14px',
                                      fontSize: '0.85rem',
                                      alignItems: 'center',
                                      borderBottom: '1px solid var(--border-color)'
                                    }}
                                  >
                                    <div style={{ color: 'var(--text-secondary)' }}>{item.date}</div>
                                    <div>
                                      <span style={{ fontWeight: 600, marginRight: 6 }}>{item.category}</span>
                                      {item.note && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.note}</span>}
                                    </div>
                                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                      {item.account_name}
                                    </div>
                                    <div style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-danger)' }}>
                                      {formatCurrency(item.amount)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 2. 歷史撥款報銷沖帳紀錄 */}
                          <div>
                            <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                              <h4 style={{ fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                                <History size={16} color="var(--color-success)" />
                                共同基金撥款沖帳紀錄 ({reimbItems.length} 筆)
                              </h4>
                              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                從家庭共同基金撥回該成員個人帳戶之已報銷紀錄
                              </span>
                            </div>

                            {reimbItems.length === 0 ? (
                              <div className="text-xs text-secondary" style={{ padding: '12px 14px', background: 'var(--bg-surface-2)', borderRadius: 8 }}>
                                尚未有自共同基金撥款報銷之歷史沖帳紀錄。
                              </div>
                            ) : (
                              <div style={{
                                background: 'var(--bg-surface)',
                                borderRadius: 8,
                                border: '1px solid var(--border-color)',
                                overflowX: 'auto'
                              }}>
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: '100px 140px 1fr 110px',
                                  minWidth: 440,
                                  padding: '8px 14px',
                                  background: 'var(--bg-surface-2)',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  color: 'var(--text-secondary)',
                                  borderBottom: '1px solid var(--border-color)'
                                }}>
                                  <div>撥款日期</div>
                                  <div>撥入收款帳戶</div>
                                  <div>說明備註</div>
                                  <div style={{ textAlign: 'right' }}>已沖銷金額</div>
                                </div>
                                {reimbItems.map(item => (
                                  <div
                                    key={item.id}
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: '100px 140px 1fr 110px',
                                      minWidth: 440,
                                      padding: '10px 14px',
                                      fontSize: '0.85rem',
                                      alignItems: 'center',
                                      borderBottom: '1px solid var(--border-color)'
                                    }}
                                  >
                                    <div style={{ color: 'var(--text-secondary)' }}>{item.date}</div>
                                    <div className="text-xs" style={{ fontWeight: 600 }}>{item.account_name}</div>
                                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                      {item.note || '撥款報銷代墊款'}
                                    </div>
                                    <div style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success)' }}>
                                      +{formatCurrency(item.amount)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 成員列表 */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>家庭群組成員名冊</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between"
                  style={{
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface-2)',
                    border: '1px solid var(--border-color)',
                    flexWrap: 'wrap',
                    gap: 12
                  }}
                >
                  <div className="flex items-center gap-3" style={{ minWidth: 0, flex: '1 1 200px' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: member.role === 'admin' ? '#FFD4A0' : '#A8D8EA',
                      color: '#333', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontWeight: 700, fontSize: '1rem',
                      flexShrink: 0
                    }}>
                      {member.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600 }}>{member.name}</span>
                        {member.role === 'admin' ? (
                          <span className="badge badge-default" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                            <Shield size={12} style={{ display: 'inline', marginRight: 2 }} /> 管理員
                          </span>
                        ) : (
                          <span className="badge" style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'var(--bg-card)' }}>
                            <User size={12} style={{ display: 'inline', marginRight: 2 }} /> 成員
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)', marginTop: 2, flexWrap: 'wrap', wordBreak: 'break-all' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}><Mail size={12} style={{ flexShrink: 0 }} />{member.email}</span>
                        <span>•</span>
                        <span>加入時間：{formatLocalDate(member.joined_at)}</span>
                      </div>
                    </div>
                  </div>

                  {data.myRole === 'admin' && member.role !== 'admin' && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-danger)', flexShrink: 0 }}
                      onClick={() => handleRemoveMember(member)}
                      title="移出家庭群組"
                    >
                      <Trash2 size={16} />
                      <span className="text-xs">移除</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 邀請碼 Modal */}
      {showInviteModal && (
        <Modal title="邀請家庭群組成員加入" onClose={() => setShowInviteModal(false)}>
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
              請將以下邀請碼分享給你的家人，對方登入網站後至「家庭協同」輸入即可加入家庭帳本：
            </p>

            <div style={{
              background: 'var(--bg-surface-2)',
              border: '2px dashed var(--color-primary)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px 24px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 16
            }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: 4, color: 'var(--color-primary-dark)' }}>
                {inviteCode}
              </span>
              <button className="btn btn-primary btn-sm" onClick={handleCopyCode}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? '已複製！' : '複製'}</span>
              </button>
            </div>

            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              此邀請碼有效期限至：{inviteExpires ? new Date(inviteExpires).toLocaleString('zh-TW') : '7 天後'}
            </div>
          </div>
        </Modal>
      )}

      {/* 共同基金撥款報銷 Modal */}
      {reimburseModalTarget && (
        <Modal
          
          onClose={() => setReimburseModalTarget(null)}
          title={`從共同基金撥款報銷給 ${reimburseModalTarget.user_name}`}
        >
          <form onSubmit={handleReimburseSubmit}>
            {reimburseError && <div className="alert alert-danger" style={{ marginBottom: 14 }}>{reimburseError}</div>}

            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.85rem', color: '#1E40AF' }}>
              <Lightbulb size={15} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              此操作將從家庭共同基金扣款，並撥入該成員的個人帳戶，自動結清公帳代墊款，<strong>不會被重複計入家庭消費支出</strong>！
            </div>

            <div className="form-group">
              <label className="form-label">撥款公帳 (家庭共同基金)</label>
              <select
                className="input"
                value={reimburseForm.from_account_id}
                onChange={e => setReimburseForm(p => ({ ...p, from_account_id: e.target.value }))}
                required
              >
                <option value="" disabled>-- 請選擇家庭共同基金帳戶 --</option>
                {jointAccounts.map(j => (
                  <option key={j.id} value={j.id}>
                    {j.name} (目前家庭共同基金餘額: {formatCurrency(j.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">撥入收款帳戶 ({reimburseModalTarget.user_name} 的個人帳戶/皮夾)</label>
              <select
                className="input"
                value={reimburseForm.to_account_id}
                onChange={e => setReimburseForm(p => ({ ...p, to_account_id: e.target.value }))}
                required
              >
                <option value="" disabled>-- 請選擇收款個人帳戶 --</option>
                {(reimburseModalTarget.receiving_accounts || []).map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.type === 'cash' ? '現金' : '銀行'} - {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-2 gap-sm">
              <div className="form-group">
                <label className="form-label">報銷金額 (NT$)</label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  className="input"
                  value={reimburseForm.amount}
                  onChange={e => setReimburseForm(p => ({ ...p, amount: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">撥款日期</label>
                <input
                  type="date"
                  className="input"
                  value={reimburseForm.date}
                  onChange={e => setReimburseForm(p => ({ ...p, date: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">備註</label>
              <input
                type="text"
                className="input"
                value={reimburseForm.note}
                onChange={e => setReimburseForm(p => ({ ...p, note: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-sm" style={{ marginTop: 24 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setReimburseModalTarget(null)}>
                取消
              </button>
              <button type="submit" className="btn btn-primary" disabled={reimbursing}>
                {reimbursing ? '撥款報銷中...' : '確認撥款沖帳'}
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  )
}