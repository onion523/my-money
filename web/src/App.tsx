import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import { bootstrapAuth, clearAllAuth, hasRefreshToken, refreshAccessToken } from './auth/oauth'
import { Loader2 } from 'lucide-react'
import { Skeleton } from './components/Skeleton'
import Layout from './components/Layout'
import Login from './pages/Login'
import OAuthCallback from './pages/OAuthCallback'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Accounts from './pages/Accounts'
import Recurring from './pages/Recurring'
import Goals from './pages/Goals'
import Analytics from './pages/Analytics'
import Forecast from './pages/Forecast'
import Family from './pages/Family'
import BotIntegration from './pages/BotIntegration'
import Settings from './pages/Settings'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useStore(s => s.token)
  const [retrying, setRetrying] = useState(false)

  if (!token) {
    if (hasRefreshToken()) {
      const handleRetry = async () => {
        setRetrying(true)
        try {
          await refreshAccessToken()
        } finally {
          setRetrying(false)
        }
      }
      return (
        <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 380, textAlign: 'center', padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>連線暫時中斷</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
              無法連接伺服器驗證登入狀態，您的登入憑證仍安全保留。
            </p>
            <button type="button" className="btn btn-primary" disabled={retrying} onClick={handleRetry} style={{ justifyContent: 'center' }}>
              {retrying ? '重新連線中...' : '重新連線'}
            </button>
            <button type="button" className="btn btn-ghost" disabled={retrying} onClick={() => clearAllAuth()} style={{ justifyContent: 'center' }}>
              改用其他帳號登入
            </button>
          </div>
        </div>
      )
    }
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

export default function App() {
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    bootstrapAuth().finally(() => setAuthReady(true))
  }, [])

  if (!authReady) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div
          className="card"
          style={{
            width: '100%',
            maxWidth: 360,
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            textAlign: 'center',
          }}
        >
          <Loader2 size={28} style={{ color: 'var(--color-primary)', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontWeight: 600, fontSize: '1rem' }}>正在驗證登入狀態...</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            正在安全連線至帳本伺服器，請稍候
          </div>
          <Skeleton variant="rect" width="100%" height={8} borderRadius={999} style={{ marginTop: 4 }} />
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/oauth/callback" element={<OAuthCallback />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="recurring" element={<Recurring />} />
        <Route path="goals" element={<Goals />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="forecast" element={<Forecast />} />
        <Route path="family" element={<Family />} />
        <Route path="bot" element={<BotIntegration />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
