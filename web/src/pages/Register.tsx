import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { authApi } from '../api/client'
import { Sparkles } from 'lucide-react'

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setAuth } = useStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('兩次密碼不一致'); return }
    if (form.password.length < 6) { setError('密碼至少 6 個字元'); return }
    setLoading(true)
    try {
      const { token, user } = await authApi.register({ name: form.name, email: form.email, password: form.password })
      setAuth(user, token)
      navigate('/')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    { id: 'reg-name', key: 'name', label: '姓名', type: 'text', placeholder: '家庭成員名稱' },
    { id: 'reg-email', key: 'email', label: '電子郵件', type: 'email', placeholder: 'your@email.com' },
    { id: 'reg-password', key: 'password', label: '密碼', type: 'password', placeholder: '至少 6 個字元' },
    { id: 'reg-confirm', key: 'confirm', label: '確認密碼', type: 'password', placeholder: '再輸入一次密碼' },
  ] as const

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--color-primary)' }}>
            <Sparkles size={48} />
          </div>
          <h1 className="font-display" style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-primary)' }}>建立帳號</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>開始記錄你的財務生活</p>
        </div>

        <div className="card" style={{ borderRadius: 20, padding: 32 }}>
          {error && (
            <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid var(--color-danger)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: 'var(--color-danger)', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {fields.map(f => (
              <div key={f.key} className="input-group">
                <label className="input-label" htmlFor={f.id}>{f.label}</label>
                <input id={f.id} className="input" type={f.type} placeholder={f.placeholder} required
                  value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <button id="register-submit" className="btn btn-primary btn-lg btn-full" type="submit" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? '建立中…' : '建立帳號'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            已有帳號？<Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>登入</Link>
          </p>
        </div>
      </div>
    </div>
  )
}