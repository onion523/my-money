import { useState, useEffect } from 'react'
import { householdApi, HouseholdData, HouseholdMember } from '../api/client'
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
  Mail
} from 'lucide-react'

export default function Family() {
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

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await householdApi.current()
      setData(res)
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
      alert(err.message || '建立家庭失敗')
    } finally {
      setCreating(false)
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
      alert(err.message || '加入家庭失敗，請確認邀請碼是否正確')
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
    if (!confirm('確定要退出這個家庭群組嗎？退出後將無法查看此家庭的共用帳本。')) return
    try {
      await householdApi.leave()
      await loadData()
    } catch (err: any) {
      alert(err.message || '退出失敗')
    }
  }

  const handleRemoveMember = async (member: HouseholdMember) => {
    if (!confirm(`確定要將成員「${member.name}」移出家庭嗎？`)) return
    try {
      await householdApi.removeMember(member.user_id)
      await loadData()
    } catch (err: any) {
      alert(err.message || '移除成員失敗')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 300 }}>
        <div style={{ color: 'var(--text-muted)' }}>載入家庭資料中...</div>
      </div>
    )
  }

  const hasHousehold = !!data?.household

  return (
    <div className="fade-in">
      {/* 標題與說明 */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">家庭協同管理 👨‍👩‍👧</h1>
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
        /* 尚未建立或加入家庭 */
        <div className="grid grid-2" style={{ gap: 24 }}>
          {/* 建立家庭 */}
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
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>建立新家庭帳本</h3>
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
                <span>{creating ? '建立中...' : '立即建立家庭'}</span>
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
                  fontSize: '1.8rem', boxShadow: 'var(--shadow-sm)'
                }}>
                  🏡
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{data.household?.name}</h2>
                    <span className="badge badge-default" style={{ fontSize: '0.75rem' }}>
                      {data.myRole === 'admin' ? '👑 家庭管理員' : '👤 家庭成員'}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                    共有 {data.members.length} 位成員共同協同記帳中
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="btn btn-secondary" onClick={handleGenerateInvite}>
                  <UserPlus size={16} />
                  <span>邀請碼</span>
                </button>
                <button className="btn btn-ghost" style={{ color: 'var(--color-danger)' }} onClick={handleLeave}>
                  <LogOut size={16} />
                  <span>離開家庭</span>
                </button>
              </div>
            </div>
          </div>

          {/* 成員列表 */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>家庭成員名冊</h3>
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
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: member.role === 'admin' ? '#FFD4A0' : '#A8D8EA',
                      color: '#333', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontWeight: 700, fontSize: '1rem'
                    }}>
                      {member.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
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
                      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                        <span><Mail size={12} style={{ display: 'inline', marginRight: 2 }} />{member.email}</span>
                        <span>•</span>
                        <span>加入時間：{member.joined_at.slice(0, 10)}</span>
                      </div>
                    </div>
                  </div>

                  {data.myRole === 'admin' && member.role !== 'admin' && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-danger)' }}
                      onClick={() => handleRemoveMember(member)}
                      title="移出家庭"
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
        <Modal title="邀請家庭成員加入 💌" onClose={() => setShowInviteModal(false)}>
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
              請將以下邀請碼分享給你的家人，對方登入網站後至「家庭協同」輸入即可加入共用帳本：
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
    </div>
  )
}