import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import { bootstrapAuth } from './auth/oauth'
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

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useStore(s => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    bootstrapAuth().finally(() => setAuthReady(true))
  }, [])

  if (!authReady) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>載入工作階段中...</p>
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
