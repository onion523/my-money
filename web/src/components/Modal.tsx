import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  maxWidth?: number
}

export default function Modal({ title, onClose, children, maxWidth = 480 }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth }}>
        <div className="modal-drag-handle" aria-hidden="true" />
        <div className="modal-header">
          <h2 className="text-xl">{title}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm modal-close-btn"
            onClick={onClose}
            aria-label="關閉視窗"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}