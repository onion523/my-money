interface ProgressBarProps {
  value: number   // 0-100
  max?: number
  variant?: 'default' | 'safe' | 'over'
  showLabel?: boolean
  height?: number
}

export default function ProgressBar({ value, max = 100, variant, showLabel = false, height = 8 }: ProgressBarProps) {
  const pct = Math.min((value / max) * 100, 100)
  const cls = variant || (pct >= 100 ? 'over' : pct >= 80 ? 'default' : 'safe')
  return (
    <div>
      {showLabel && (
        <div className="flex justify-between text-sm" style={{ marginBottom: 4 }}>
          <span style={{ color: 'var(--text-muted)' }}>{value.toLocaleString()} / {max.toLocaleString()}</span>
          <span style={{ color: pct >= 100 ? 'var(--color-danger)' : 'var(--text-muted)' }}>{pct.toFixed(0)}%</span>
        </div>
      )}
      <div className="progress-bar" style={{ height }}>
        <div className={`progress-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}