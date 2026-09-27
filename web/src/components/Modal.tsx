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
        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
          <h2 className="text-xl">{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}