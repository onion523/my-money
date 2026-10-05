import React, { useState, useRef, useEffect, useCallback, useId } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

interface FormulaTooltipProps {
  formula: string
  calculation: string
  note?: string
  label?: string
}

const TOOLTIP_OPEN_EVENT = 'mm:formula-tooltip-open'

export default function FormulaTooltip({
  formula,
  calculation,
  note,
  label = '檢視計算公式',
}: FormulaTooltipProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean }>({
    top: 0,
    left: 12,
    placeAbove: false,
  })
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const tooltipId = useId()

  const updatePosition = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const maxPopoverWidth = Math.min(300, vw - 24)
    const desiredLeft = rect.left + rect.width / 2 - maxPopoverWidth / 2
    const clampedLeft = Math.max(12, Math.min(desiredLeft, vw - maxPopoverWidth - 12))
    const placeAbove = rect.bottom + 150 > vh && rect.top > 150
    const top = placeAbove ? rect.top - 8 : rect.bottom + 8
    setCoords({ top, left: clampedLeft, placeAbove })
  }, [])

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!open) {
      window.dispatchEvent(new CustomEvent(TOOLTIP_OPEN_EVENT, { detail: tooltipId }))
      updatePosition()
      setOpen(true)
    } else {
      setOpen(false)
    }
  }

  useEffect(() => {
    const onOtherOpen = (e: Event) => {
      const customEv = e as CustomEvent<string>
      if (customEv.detail !== tooltipId) {
        setOpen(false)
      }
    }
    window.addEventListener(TOOLTIP_OPEN_EVENT, onOtherOpen)
    return () => window.removeEventListener(TOOLTIP_OPEN_EVENT, onOtherOpen)
  }, [tooltipId])

  useEffect(() => {
    if (!open) return
    updatePosition()

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null
      if (
        target &&
        !btnRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onScrollOrResize = () => {
      updatePosition()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, updatePosition])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`formula-info-btn ${open ? 'active' : ''}`}
        onClick={handleToggle}
        aria-label={label}
        aria-expanded={open}
        title={label}
      >
        <Info size={14} />
      </button>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="tooltip"
            className={`formula-tooltip-popover ${coords.placeAbove ? 'place-above' : ''}`}
            style={{
              top: coords.top,
              left: coords.left,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="formula-tooltip-section">
              <div className="formula-tooltip-tag">計算公式</div>
              <div className="formula-tooltip-text">{formula}</div>
            </div>
            <div className="formula-tooltip-divider" />
            <div className="formula-tooltip-section">
              <div className="formula-tooltip-tag calc">目前試算</div>
              <div className="formula-tooltip-calc">{calculation}</div>
            </div>
            {note && <div className="formula-tooltip-note">{note}</div>}
          </div>,
          document.body
        )}
    </>
  )
}
