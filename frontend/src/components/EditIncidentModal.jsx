import { useState } from 'react'
import { updateIncident } from '../api'
import '../styles/AppModal.css'

const STATUSES   = ['pending', 'dispatched', 'contained', 'closed']
const SEVERITIES = ['Minor', 'Moderate', 'Critical']
const ALARMS     = ['1st Alarm', '2nd Alarm', '3rd Alarm']
const STRUCTURES = [
  'Residential', 'Residential 2-storey', 'Commercial', 'Industrial',
  'Institutional', 'Informal Settlement', 'Vegetation', 'Vehicle', 'Other',
]
const CASUALTIES = ['None', 'Unconfirmed', 'Minor Injuries', 'Serious Injuries', 'Fatalities']

export default function EditIncidentModal({ incident, onClose, onSubmit }) {
  const [form, setForm] = useState({
    fire_location_name:    incident.loc        || '',
    fire_address:          incident.addr       || '',
    fire_severity:         incident.sev        || 'Minor',
    fire_status:           incident.status     || 'pending',
    fire_alarm_level:      incident.alarm      || '1st Alarm',
    fire_structure_type:   incident.structure  || 'Residential',
    fire_casualties:       incident.casualties || 'None',
    fire_units_assigned:   incident.units      ?? 0,
    fire_reporter_name:    incident.reporter && incident.reporter !== '—' ? incident.reporter : '',
    fire_reporter_contact: '',
    fire_remarks:          incident.remarks    || '',
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const showCasualties = form.fire_status === 'closed' || form.fire_status === 'contained'
  const showRemarks    = form.fire_status === 'closed'

  function set(field, value) {
    setError(null)
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.fire_location_name.trim()) {
      setError('Area / Barangay name is required.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        fire_units_assigned: Number(form.fire_units_assigned) || 0,
        fire_casualties:     showCasualties ? form.fire_casualties : 'None',
        fire_remarks:        showRemarks ? form.fire_remarks : '',
      }
      const updated = await updateIncident(incident.fire_id, payload)
      onSubmit(updated)
    } catch (ex) {
      setError(ex.message)
      setSaving(false)
    }
  }

  return (
    <div className="apm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="apm-panel lim-panel">

        <div className="apm-header">
          <div>
            <div className="apm-eyebrow">INCIDENT · {incident.id}</div>
            <div className="apm-title">Edit Incident</div>
          </div>
          <button className="apm-close" onClick={onClose}>✕</button>
        </div>

        <div className="apm-scroll">
          <form id="eim-form" className="apm-body" onSubmit={handleSubmit}>

            <div className="apm-section-label">Incident Location</div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Area / Barangay <span className="apm-required">*</span></label>
                <input
                  placeholder="e.g. Brgy. Kakar, Panabo"
                  value={form.fire_location_name}
                  onChange={e => set('fire_location_name', e.target.value)}
                />
              </div>
              <div className="apm-field">
                <label>Street Address</label>
                <input
                  placeholder="e.g. 12 Rizal St."
                  value={form.fire_address}
                  onChange={e => set('fire_address', e.target.value)}
                />
              </div>
            </div>

            <div className="asm-coords-display">
              Lat <strong>{Number(incident.latitude).toFixed(6)}</strong>&nbsp;
              Lng <strong>{Number(incident.longitude).toFixed(6)}</strong>
              &nbsp;·&nbsp;<span style={{ opacity: 0.7 }}>Location coordinates are not editable</span>
            </div>

            <div className="apm-section-label">Incident Details</div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Severity <span className="apm-required">*</span></label>
                <select value={form.fire_severity} onChange={e => set('fire_severity', e.target.value)}>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="apm-field">
                <label>Status <span className="apm-required">*</span></label>
                <select value={form.fire_status} onChange={e => set('fire_status', e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
            </div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Alarm Level</label>
                <select value={form.fire_alarm_level} onChange={e => set('fire_alarm_level', e.target.value)}>
                  {ALARMS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="apm-field">
                <label>Structure Type</label>
                <select value={form.fire_structure_type} onChange={e => set('fire_structure_type', e.target.value)}>
                  {STRUCTURES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Units Assigned</label>
                <input
                  type="number"
                  min={0}
                  value={form.fire_units_assigned}
                  onChange={e => set('fire_units_assigned', e.target.value)}
                />
              </div>
              {showCasualties && (
                <div className="apm-field">
                  <label>Casualties</label>
                  <select value={form.fire_casualties} onChange={e => set('fire_casualties', e.target.value)}>
                    {CASUALTIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
            </div>

            {showRemarks && (
              <div className="apm-field">
                <label>Remarks / Report</label>
                <textarea
                  placeholder="Add incident notes, investigation findings, or post-incident report..."
                  value={form.fire_remarks}
                  onChange={e => set('fire_remarks', e.target.value)}
                  rows={3}
                />
              </div>
            )}

            <div className="apm-section-label">Reporter Information</div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Reported By</label>
                <input
                  placeholder="e.g. BFP Hotline · 911"
                  value={form.fire_reporter_name}
                  onChange={e => set('fire_reporter_name', e.target.value)}
                />
              </div>
              <div className="apm-field">
                <label>Reporter Contact</label>
                <input
                  placeholder="e.g. 09XX-XXX-XXXX"
                  value={form.fire_reporter_contact}
                  onChange={e => set('fire_reporter_contact', e.target.value)}
                />
              </div>
            </div>

            {error && <div className="apm-error">{error}</div>}

          </form>
        </div>

        <div className="apm-actions">
          <button type="button" className="apm-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="eim-form" className="apm-btn-submit" disabled={saving}>
            {saving ? <span className="apm-spinner" /> : 'Save Changes'}
          </button>
        </div>

      </div>
    </div>
  )
}
