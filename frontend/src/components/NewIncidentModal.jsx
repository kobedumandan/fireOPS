import { useState, useEffect } from 'react'
import '../styles/AppModal.css'

export default function NewIncidentModal({ location, initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({
    locationName: '',
    address:      '',
    severity:     'Moderate',
    alarm:        '1st Alarm',
    structure:    'Residential',
    reporter:     '911 Call',
    mobile:       '',
    autoDispatch: true,
    locationSource: 'manual',
    ...(initial || {}),
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); setError(null) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.locationName.trim()) return
    setSaving(true)
    try {
      await onSubmit({
        locationName: form.locationName.trim(),
        address:      form.address.trim(),
        severity:     form.severity,
        alarm:        form.alarm,
        structure:    form.structure,
        reporter:     form.reporter,
        mobile:       form.mobile.trim(),
        coords:       location,
        autoDispatch: form.autoDispatch,
        locationSource: form.locationSource,
        reporterToken: form.reporterToken,
      })
    } catch (err) {
      setError(err.message || 'Failed to log incident')
      setSaving(false)
    }
  }

  const sevColor = { Critical: 'var(--accent-fire)', Moderate: 'var(--accent-amber)', Minor: 'var(--accent-green)' }

  return (
    <div className="apm-overlay" onMouseDown={e => e.target === e.currentTarget && onCancel()}>
      <div className="apm-panel lim-panel">

        <div className="apm-header">
          <div>
            <div className="apm-eyebrow">NEW INCIDENT</div>
            <div className="apm-title">Log Incident</div>
          </div>
          <button className="apm-close" onClick={onCancel}>✕</button>
        </div>

        <div className="apm-scroll">
          <form id="nim-form" className="apm-body" onSubmit={handleSubmit}>

            <div className="asm-coords-display" style={{ marginBottom: 12 }}>
              <span>PIN</span>
              <strong>{location[0].toFixed(5)}, {location[1].toFixed(5)}</strong>
              <span style={{ marginLeft: 'auto', opacity: 0.6 }}>Click map to reposition</span>
            </div>

            <div className="apm-section-label">Incident Location</div>

            <div className="apm-field">
              <label>Location Name <span className="apm-required">*</span></label>
              <input
                placeholder="e.g. Brgy. San Francisco, Panabo City"
                value={form.locationName}
                onChange={e => set('locationName', e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="apm-field">
              <label>Street / Landmark</label>
              <input
                placeholder="e.g. 123 Rizal St., near the church"
                value={form.address}
                onChange={e => set('address', e.target.value)}
              />
            </div>

            <div className="apm-section-label">Incident Details</div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Severity</label>
                <select
                  value={form.severity}
                  onChange={e => set('severity', e.target.value)}
                  style={{ color: sevColor[form.severity] }}
                >
                  <option value="Critical">Critical</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Minor">Minor</option>
                </select>
              </div>
              <div className="apm-field">
                <label>Alarm Level</label>
                <select value={form.alarm} onChange={e => set('alarm', e.target.value)}>
                  <option>1st Alarm</option>
                  <option>2nd Alarm</option>
                  <option>3rd Alarm</option>
                </select>
              </div>
            </div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Structure Type</label>
                <select value={form.structure} onChange={e => set('structure', e.target.value)}>
                  <option>Residential</option>
                  <option>Residential 2-storey</option>
                  <option>Commercial</option>
                  <option>Industrial</option>
                  <option>Institutional</option>
                  <option>Informal Settlement</option>
                  <option>Vegetation</option>
                  <option>Vehicle</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="apm-field">
                <label>Reported Via</label>
                <select value={form.reporter} onChange={e => set('reporter', e.target.value)}>
                  <option>911 Call</option>
                  <option>BFP Hotline</option>
                  <option>SMS Report</option>
                  <option>Walk-in</option>
                  <option>Dispatcher</option>
                </select>
              </div>
            </div>

            <div className="apm-section-label">Reporter Information</div>

            <div className="apm-field">
              <label>Reporter Mobile #</label>
              <input
                placeholder="e.g. 09XX-XXX-XXXX"
                value={form.mobile}
                onChange={e => set('mobile', e.target.value)}
              />
            </div>

            <div className="apm-field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', fontSize: '11px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.autoDispatch}
                  onChange={e => set('autoDispatch', e.target.checked)}
                  style={{ width: 'auto', margin: 0 }}
                />
                <span>Auto-dispatch nearest available team</span>
              </label>
            </div>

            {error && <div className="apm-error">{error}</div>}
          </form>
        </div>

        <div className="apm-actions">
          <button type="button" className="apm-btn-cancel" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="submit" form="nim-form" className="apm-btn-submit" disabled={saving}>
            {saving ? <span className="apm-spinner" /> : 'Log Incident'}
          </button>
        </div>

      </div>
    </div>
  )
}
