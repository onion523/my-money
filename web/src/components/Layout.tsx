import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
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
  BookHeart,
  Menu,
  X,
  Plus
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '儀表板', end: true },
  { to: '/transactions', icon: ArrowLeftRight, label: '收支明細' },
  { to: '/accounts', icon: CreditCard, label: '帳戶管理' },
  { to: '/recurring', icon: RefreshCw, label: '週期收支' },
  { to: '/goals', icon: Target, label: '儲蓄目標' },
  { to: '/analytics', icon: BarChart2, label: '統計圖表' },
  { to: '/forecast', icon: TrendingUp, label: '現金流預測' },
  { to: '/family', icon: Users, label: '家庭協同' },
  { to: '/bot', icon: Bot, label: '機器人記帳' },
]

export default function Layout() {
  const { user, theme, toggleTheme, logout } = useStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }

  // 換頁時自動關閉行動端抽屜並將畫面捲回頂端
  useEffect(() => {
    setMobileMenuOpen(false)
    scrollToTop()
  }, [location.pathname])

  // 抽屜開啟時防止背景頁面滾動
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const currentNavItem = navItems.find(item =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  )

  const handleQuickAddFab = () => {
    const quickAddBtn = document.getElementById('btn-quick-add') as HTMLButtonElement | null
    if (quickAddBtn) {
      quickAddBtn.click()
      return
    }
    const addTxBtn = document.getElementById('btn-add-tx') as HTMLButtonElement | null
    if (addTxBtn) {
      addTxBtn.click()
      return
    }
    navigate('/?quickAdd=1')
  }

  return (
    <div className="layout">
      {/* 行動端頂部 Header (<= 960px 顯示) */}
      <header className="mobile-header">
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '8px', minHeight: 40, minWidth: 40, justifyContent: 'center' }}
          onClick={() => setMobileMenuOpen(true)}
          aria-label="打開導覽選單"
        >
          <Menu size={22} />
        </button>

        <div className="mobile-header-title">
          <BookHeart size={20} style={{ flexShrink: 0 }} />
          <span>我的記帳本</span>
          {currentNavItem && currentNavItem.to !== '/' && (
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              · {currentNavItem.label}
            </span>
          )}
        </div>

        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '8px', minHeight: 40, minWidth: 40, justifyContent: 'center' }}
          onClick={toggleTheme}
          aria-label="切換主題"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </header>

      {/* 行動端抽屜黑色遮罩 */}
      {mobileMenuOpen && (
        <div
          className="mobile-drawer-overlay"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 側邊導覽欄 (桌面端固定，行動端為滑動抽屜) */}
      <nav className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-logo" style={{ justifyContent: 'space-between' }}>
          <div className="flex items-center gap-sm">
            <BookHeart size={24} />
            <span>我的記帳本</span>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="關閉選單"
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 8 }}>
          <div className="nav-section-title">主選單</div>
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                setMobileMenuOpen(false)
                scrollToTop()
              }}
            >
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

      {/* 主要內容區域 */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* 行動端右下角懸浮快速記帳鈕 (Quick-Add FAB) */}
      <button
        type="button"
        id="mobile-quick-add-fab"
        className="mobile-quick-add-fab"
        onClick={handleQuickAddFab}
        aria-label="快速記帳"
        title="隨手記一筆"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {/* 行動端底部導覽列 (<= 960px 顯示) */}
      <nav className="mobile-bottom-nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          onClick={scrollToTop}
        >
          <LayoutDashboard size={20} />
          <span>總覽</span>
        </NavLink>
        <NavLink
          to="/transactions"
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          onClick={scrollToTop}
        >
          <ArrowLeftRight size={20} />
          <span>明細</span>
        </NavLink>
        <NavLink
          to="/accounts"
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          onClick={scrollToTop}
        >
          <CreditCard size={20} />
          <span>帳戶</span>
        </NavLink>
        <NavLink
          to="/analytics"
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          onClick={scrollToTop}
        >
          <BarChart2 size={20} />
          <span>統計</span>
        </NavLink>
        <button
          type="button"
          className={`bottom-nav-item ${mobileMenuOpen ? 'active' : ''}`}
          onClick={() => setMobileMenuOpen(prev => !prev)}
        >
          <Menu size={20} />
          <span>更多</span>
        </button>
      </nav>
    </div>
  )
}

