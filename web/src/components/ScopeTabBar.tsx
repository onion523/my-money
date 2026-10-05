import React from 'react'
import { Globe, Home, Lock } from 'lucide-react'

export type LedgerScope = 'all' | 'household' | 'personal'

interface ScopeTabBarProps {
  scope: LedgerScope
  onChange: (scope: LedgerScope) => void
  className?: string
  style?: React.CSSProperties
}

export default function ScopeTabBar({ scope, onChange, className = '', style }: ScopeTabBarProps) {
  return (
    <div
      className={`scope-tab-bar ${className}`}
      style={style}
    >
      <button
        type="button"
        id="scope-btn-all"
        className={`btn btn-sm scope-tab-btn ${scope === 'all' ? 'btn-primary' : 'btn-ghost'}`}
        onClick={() => onChange('all')}
      >
        <Globe size={15} style={{ flexShrink: 0 }} />
        <span>全部</span>
      </button>
      <button
        type="button"
        id="scope-btn-household"
        className={`btn btn-sm scope-tab-btn ${scope === 'household' ? 'btn-primary' : 'btn-ghost'}`}
        onClick={() => onChange('household')}
      >
        <Home size={15} style={{ flexShrink: 0 }} />
        <span>公帳</span>
      </button>
      <button
        type="button"
        id="scope-btn-personal"
        className={`btn btn-sm scope-tab-btn ${scope === 'personal' ? 'btn-primary' : 'btn-ghost'}`}
        onClick={() => onChange('personal')}
      >
        <Lock size={15} style={{ flexShrink: 0 }} />
        <span>私帳</span>
      </button>
    </div>
  )
}

