import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import '../styles/AppModal.css'
import { Icon } from './incidentForm'
import { ICON_CLOSE } from './incidentFormOptions'

/**
 * Shared modal shell: overlay, panel, and the same header the incident and
 * dispatch modals use (eyebrow, title, optional subtitle, icon close button).
 * Children supply the body and footer.
 *
 *   subtitle – optional muted line under the title (string or node)
 *   width    – panel width in px (capped to the viewport by .apm-panel)
 *   className – extra panel classes (e.g. "eim-panel" for the modern form styles)
 *   dismissible – false while saving or while a nested review step owns Esc;
 *                 blocks both Esc and backdrop clicks
 */
export default function AppModal({
  eyebrow, title, subtitle, onClose, children, width = 520, className = '', dismissible = true,
}) {
  const titleId = useId()

  useEffect(() => {
    if (!dismissible) return
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, dismissible])

  return createPortal(
    <div className="apm-overlay" onMouseDown={e => dismissible && e.target === e.currentTarget && onClose()}>
      <div
        className={`apm-panel apm-shell ${className}`}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="eim-header">
          <div className="eim-header-main">
            {eyebrow && <div className="apm-eyebrow">{eyebrow}</div>}
            <div id={titleId} className="eim-title">{title}</div>
            {subtitle && <div className="apm-subtitle">{subtitle}</div>}
          </div>
          <button type="button" className="eim-close" onClick={onClose} aria-label="Close" disabled={!dismissible}>
            <Icon d={ICON_CLOSE} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}
