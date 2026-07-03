import { useState, useEffect } from 'react'
import AppModal from './AppModal'
import { fetchStations, fetchShifts, fetchTrucks, createTeam } from '../api'

const STATUSES = ['standby', 'dispatched', 'inactive']

export default function AddTeamModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    team_name:   '',
    team_code:   '',
    team_status: 'standby',
    station_id:  '',
    shift_id:    '',
    truck_id:    '',
  })
  const [stations, setStations] = useState([])
  const [shifts, setShifts]     = useState([])
  const [trucks, setTrucks]     = useState([])
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    fetchStations().then(setStations).catch(() => {})
    fetchShifts().then(setShifts).catch(() => {})
    fetchTrucks().then(setTrucks).catch(() => {})
  }, [])

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }))
    setError('')
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.team_name.trim()) { setError('Team name is required.'); return }

    setLoading(true)
    createTeam({
      team_name:   form.team_name.trim(),
      team_code:   form.team_code.trim() || null,
      team_status: form.team_status,
      station_id:  form.station_id ? Number(form.station_id) : null,
      shift_id:    form.shift_id   ? Number(form.shift_id)   : null,
      truck_id:    form.truck_id   ? Number(form.truck_id)   : null,
    })
      .then(team => { setLoading(false); onSubmit(team) })
      .catch(err => { setLoading(false); setError(err.message) })
  }

  return (
    <AppModal eyebrow="TEAM MANAGEMENT" title="Add New Team" onClose={onClose} width={480}>
      <form onSubmit={handleSubmit}>
        <div className="apm-scroll">
          <div className="apm-body">

            <div className="apm-row">
              <div className="apm-field">
                <label>Team Name <span className="apm-required">*</span></label>
                <input
                  placeholder="e.g. Alpha Response Team"
                  value={form.team_name}
                  onChange={e => set('team_name', e.target.value)}
                  autoFocus
                />
              </div>
              <div className="apm-field">
                <label>Team Code</label>
                <input
                  placeholder="e.g. TM-A1"
                  value={form.team_code}
                  onChange={e => set('team_code', e.target.value)}
                />
              </div>
            </div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Status</label>
                <select value={form.team_status} onChange={e => set('team_status', e.target.value)}>
                  {STATUSES.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="apm-field">
                <label>Shift</label>
                <select value={form.shift_id} onChange={e => set('shift_id', e.target.value)}>
                  <option value="">No shift assigned</option>
                  {shifts.map(s => (
                    <option key={s.shift_id} value={s.shift_id}>{s.shift_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Assigned Station</label>
                <select value={form.station_id} onChange={e => set('station_id', e.target.value)}>
                  <option value="">Select station...</option>
                  {stations.map(s => (
                    <option key={s.station_id} value={s.station_id}>{s.station_name}</option>
                  ))}
                </select>
              </div>
              <div className="apm-field">
                <label>Assigned Truck</label>
                <select value={form.truck_id} onChange={e => set('truck_id', e.target.value)}>
                  <option value="">No truck assigned</option>
                  {trucks.map(t => (
                    <option key={t.truck_id} value={t.truck_id}>
                      {t.truck_platenum}{t.station_name ? ` · ${t.station_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && <div className="apm-error">{error}</div>}

          </div>
        </div>

        <div className="apm-actions">
          <button type="button" className="apm-btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="submit" className="apm-btn-submit" disabled={loading}>
            {loading ? <span className="apm-spinner" /> : 'Create Team'}
          </button>
        </div>
      </form>
    </AppModal>
  )
}
