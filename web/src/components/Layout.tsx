import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import {
  LayoutDashboard,
  CreditCard,
  ArrowLeftRight,
  RefreshCw,
  Target,
  BarChart2,
  TrendingUp,
  Users,
  Bot,
  Sun,
  Moon,
  LogOut,
  BookHeart
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '儀表板', end: true },
  { to: '/transactions', icon: ArrowLeftRight, label: '交易記錄' },
  { to: '/accounts', icon: CreditCard, label: '帳戶管理' },
  { to: '/recurring', icon: RefreshCw, label: '固定收支' },
  { to: '/goals', icon: Target, label: '儲蓄目標' },
  { to: '/analytics', icon: BarChart2, label: '統計圖表' },
  { to: '/forecast', icon: TrendingUp, label: '現金流預測' },
  { to: '/family', icon: Users, label: '家庭協同' },
  { to: '/bot', icon: Bot, label: '機器人記帳' },
]

export default function Layout() {
  const { user, theme, toggleTheme, logout } = useStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <BookHeart size={24} />
          <span>我的記帳本</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 8 }}>
          <div className="nav-section-title">主選單</div>
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>

        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ padding: '8px 16px', marginBottom: 4 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email}</div>
          </div>
          <button className="nav-item" style={{ width: '100%' }} onClick={toggleTheme}>
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            <span>{theme === 'light' ? '切換深色' : '切換淺色'}</span>
          </button>
          <button className="nav-item" style={{ width: '100%', color: 'var(--color-danger)' }} onClick={handleLogout}>
            <LogOut size={16} />
            <span>登出</span>
          </button>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}