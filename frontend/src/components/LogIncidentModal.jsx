import { useState } from 'react'
import AppModal from './AppModal'

const PANABO_BOUNDS = { latMin: 7.15, latMax: 7.50, lngMin: 125.50, lngMax: 125.90 }

const EMPTY_FORM = {
  fire_reporter_contact:  '',
  fire_location_source:   'manual',
  fire_latitude:          '',
  fire_longitude:         '',
  fire_severity:          '',
  fire_status:            'active',
  fire_incident_datetime: new Date().toISOString().slice(0, 16),
}

function validate(form) {
  if (!form.fire_severity)
    return 'Severity is required.'

  if (!form.fire_latitude.toString().trim() || !form.fire_longitude.toString().trim())
    return 'Latitude and longitude are required.'

  const lat = parseFloat(form.fire_latitude)
  const lng = parseFloat(form.fire_longitude)

  if (isNaN(lat) || isNaN(lng))
    return 'Latitude and longitude must be valid numbers.'

  if (lat < PANABO_BOUNDS.latMin || lat > PANABO_BOUNDS.latMax ||
      lng < PANABO_BOUNDS.lngMin || lng > PANABO_BOUNDS.lngMax)
    return `Coordinates must be within Panabo City bounds (lat ${PANABO_BOUNDS.latMin}–${PANABO_BOUNDS.latMax}, lng ${PANABO_BOUNDS.lngMin}–${PANABO_BOUNDS.lngMax}).`

  if (!form.fire_incident_datetime)
    return 'Incident date and time are required.'

  return null
}

function NumSpinner({ value, onChange, placeholder }) {
  function step(delta) {
    onChange(((parseFloat(value || 0) + delta)).toFixed(4))
  }
  return (
    <div className="apm-num-wrap">
      <input
        type="number"
        step="0.0001"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <div className="apm-spin">
        <button type="button" onClick={() => step(+0.0001)}>▲</button>
        <button type="button" onClick={() => step(-0.0001)}>▼</button>
      </div>
    </div>
  )
}

export default function LogIncidentModal({ onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  function set(field, val) {
    setError('')
    setForm(f => ({ ...f, [field]: val }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const err = validate(form)
    if (err) { setError(err); return }
    onSubmit({
      ...form,
      fire_latitude:  parseFloat(form.fire_latitude),
      fire_longitude: parseFloat(form.fire_longitude),
    })
  }

  return (
    <AppModal eyebrow="BFP · INCIDENTS" title="Log New Incident" onClose={onClose} width={540}>
      <form onSubmit={handleSubmit}>
        <div className="apm-scroll">
          <div className="apm-body">

            <div className="apm-section-label">Incident Details</div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Severity <span className="apm-required">*</span></label>
                <select value={form.fire_severity} onChange={e => set('fire_severity', e.target.value)}>
                  <option value="">Select severity...</option>
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="apm-field">
                <label>Status</label>
                <select value={form.fire_status} onChange={e => set('fire_status', e.target.value)}>
                  <option value="active">Active</option>
                  <option value="contained">Contained</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Date &amp; Time <span className="apm-required">*</span></label>
                <input
                  type="datetime-local"
                  value={form.fire_incident_datetime}
                  onChange={e => set('fire_incident_datetime', e.target.value)}
                />
              </div>
              <div className="apm-field">
                <label>Location Source</label>
                <select value={form.fire_location_source} onChange={e => set('fire_location_source', e.target.value)}>
                  <option value="manual">Manual Entry</option>
                  <option value="gps">GPS</option>
                  <option value="report">Report</option>
                </select>
              </div>
            </div>

            <div className="apm-section-label">Coordinates</div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Latitude <span className="apm-required">*</span></label>
                <NumSpinner
                  value={form.fire_latitude}
                  placeholder="7.3083"
                  onChange={val => set('fire_latitude', val)}
                />
              </div>
              <div className="apm-field">
                <label>Longitude <span className="apm-required">*</span></label>
                <NumSpinner
                  value={form.fire_longitude}
                  placeholder="125.6833"
                  onChange={val => set('fire_longitude', val)}
                />
              </div>
            </div>

            <div className="apm-section-label">Reporter</div>

            <div className="apm-field">
              <label>Reporter Contact</label>
              <input
                placeholder="e.g. +63-917-000-0000 or BFP Hotline"
                value={form.fire_reporter_contact}
                onChange={e => set('fire_reporter_contact', e.target.value)}
              />
            </div>

            {error && <div className="apm-error">{error}</div>}

          </div>
        </div>

        <div className="apm-actions">
          <button type="button" className="apm-btn-cancel" onClick={onClose}>Cancel</button>
          <button type="submit" className="apm-btn-submit">+ Log Incident</button>
        </div>
      </form>
    </AppModal>
  )
}
