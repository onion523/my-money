import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { authApi } from '../api/client'
import { BookHeart, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const { setAuth } = useStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token, user } = await authApi.login(form)
      setAuth(user, token)
      navigate('/')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--color-primary)' }}>
            <BookHeart size={48} />
          </div>
          <h1 className="font-display" style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-primary)' }}>我的記帳本</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>家庭財務，輕鬆掌握</p>
        </div>

        <div className="card" style={{ borderRadius: 20, padding: 32 }}>
          <h2 style={{ marginBottom: 24, fontSize: '1.2rem', fontWeight: 600 }}>登入帳號</h2>

          {error && (
            <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid var(--color-danger)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: 'var(--color-danger)', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex-col gap-md" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="input-group">
              <label className="input-label">電子郵件</label>
              <input id="login-email" className="input" type="email" placeholder="your@email.com" required
                value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">密碼</label>
              <div style={{ position: 'relative' }}>
                <input id="login-password" className="input" type={showPwd ? 'text' : 'password'} placeholder="••••••" required
                  style={{ paddingRight: 40 }}
                  value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button id="login-submit" className="btn btn-primary btn-lg btn-full" type="submit" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? '登入中…' : '登入'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            還沒有帳號？<Link to="/register" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>立即註冊</Link>
          </p>
        </div>
      </div>
    </div>
  )
}