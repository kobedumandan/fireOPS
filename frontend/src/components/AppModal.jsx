import { useEffect } from 'react'
import '../styles/AppModal.css'

export default function AppModal({ eyebrow, title, onClose, children, width = 520 }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="apm-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="apm-panel" style={{ width }}>
        <div className="apm-header">
          <div>
            {eyebrow && <div className="apm-eyebrow">{eyebrow}</div>}
            <div className="apm-title">{title}</div>
          </div>
          <button className="apm-close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
