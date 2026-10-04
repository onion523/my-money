import React from 'react'
import { Globe, Home, Lock } from 'lucide-react'

export type LedgerScope = 'all' | 'household' | 'personal'

interface ScopeTabBarProps {
  scope: LedgerScope
  onChange: (scope: LedgerScope) => void
  label?: string
  className?: string
  style?: React.CSSProperties
}

export default function ScopeTabBar({ scope, onChange, label, className = '', style }: ScopeTabBarProps) {
  return (
    <div
      className={`scope-tab-bar ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: 4,
        background: 'var(--bg-surface-2)',
        borderRadius: 12,
        border: '1px solid var(--border-color)',
        ...style
      }}
    >
      {label && (
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', paddingLeft: 6, paddingRight: 4 }}>
          {label}
        </span>
      )}
      <button
        type="button"
        id="scope-btn-all"
        className={`btn btn-sm ${scope === 'all' ? 'btn-primary' : 'btn-ghost'}`}
        style={{
          borderRadius: 8,
          padding: '6px 14px',
          fontSize: '0.85rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5
        }}
        onClick={() => onChange('all')}
      >
        <Globe size={15} style={{ flexShrink: 0 }} />
        <span>全部</span>
      </button>
      <button
        type="button"
        id="scope-btn-household"
        className={`btn btn-sm ${scope === 'household' ? 'btn-primary' : 'btn-ghost'}`}
        style={{
          borderRadius: 8,
          padding: '6px 14px',
          fontSize: '0.85rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5
        }}
        onClick={() => onChange('household')}
      >
        <Home size={15} style={{ flexShrink: 0 }} />
        <span>公帳</span>
      </button>
      <button
        type="button"
        id="scope-btn-personal"
        className={`btn btn-sm ${scope === 'personal' ? 'btn-primary' : 'btn-ghost'}`}
        style={{
          borderRadius: 8,
          padding: '6px 14px',
          fontSize: '0.85rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5
        }}
        onClick={() => onChange('personal')}
      >
        <Lock size={15} style={{ flexShrink: 0 }} />
        <span>私帳</span>
      </button>
    </div>
  )
}
