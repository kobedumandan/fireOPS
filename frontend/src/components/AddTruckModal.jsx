import { useState, useEffect } from 'react'
import AppModal from './AppModal'
import { fetchStations } from '../api'

const STATUS_OPTIONS = ['available', 'dispatched', 'maintenance', 'unavailable']

export default function AddTruckModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    truck_platenum: '',
    truck_status:   'available',
    station_id:     '',
  })
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [stations, setStations] = useState([])

  useEffect(() => {
    fetchStations().then(setStations).catch(() => {})
  }, [])

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.truck_platenum.trim()) {
      setError('Plate number is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit({
        truck_platenum: form.truck_platenum.trim(),
        truck_status:   form.truck_status,
        station_id:     form.station_id ? Number(form.station_id) : null,
      })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <AppModal eyebrow="FLEET MANAGEMENT" title="Add New Truck" onClose={onClose} width={480}>
      <form onSubmit={handleSubmit}>
        <div className="apm-scroll">
          <div className="apm-body">

            <div className="apm-section-label">Truck Information</div>

            <div className="apm-field">
              <label>Plate Number <span className="apm-required">*</span></label>
              <input
                placeholder="e.g. ABC-1234"
                value={form.truck_platenum}
                onChange={e => set('truck_platenum', e.target.value)}
                autoFocus
              />
            </div>

            <div className="apm-field">
              <label>Status</label>
              <select value={form.truck_status} onChange={e => set('truck_status', e.target.value)}>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>

            <div className="apm-field">
              <label>Assigned Station</label>
              <select value={form.station_id} onChange={e => set('station_id', e.target.value)}>
                <option value="">Select station...</option>
                {stations.map(s => (
                  <option key={s.station_id} value={s.station_id}>{s.station_name}</option>
                ))}
              </select>
            </div>

            {error && <div className="apm-error">{error}</div>}

          </div>
        </div>

        <div className="apm-actions">
          <button type="button" className="apm-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="apm-btn-submit" disabled={saving}>
            {saving ? <span className="apm-spinner" /> : '+ Add Truck'}
          </button>
        </div>
      </form>
    </AppModal>
  )
}
