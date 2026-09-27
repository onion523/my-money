import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
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
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
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