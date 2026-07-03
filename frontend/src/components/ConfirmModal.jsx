import { useState } from 'react'
import AppModal from './AppModal'
import '../styles/ConfirmModal.css'

/**
 * Reusable confirmation dialog built on AppModal.
 *
 * Props:
 *   eyebrow      – small mono label above the title (default "CONFIRM")
 *   title        – heading text
 *   message      – body text / node describing the consequence
 *   confirmLabel – danger button text (default "Delete")
 *   cancelLabel  – cancel button text (default "Cancel")
 *   onConfirm    – async fn run when confirmed; may throw to show an inline error
 *   onClose      – fn to dismiss the dialog
 */
export default function ConfirmModal({
  eyebrow = 'CONFIRM',
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onClose,
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setBusy(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError(err?.message || 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <AppModal
      eyebrow={eyebrow}
      title={title}
      width={420}
      onClose={busy ? () => {} : onClose}
    >
      <div className="apm-body cfm-body">
        {error && <div className="apm-error">{error}</div>}
        <p className="cfm-message">{message}</p>
      </div>
      <div className="apm-actions">
        <button className="apm-btn-cancel" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </button>
        <button className="cfm-btn-danger" onClick={handleConfirm} disabled={busy}>
          {busy ? <span className="apm-spinner" /> : confirmLabel}
        </button>
      </div>
    </AppModal>
  )
}
