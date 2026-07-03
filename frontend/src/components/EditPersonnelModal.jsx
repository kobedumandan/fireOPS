import { useState, useEffect } from 'react'
import AppModal from './AppModal'
import visibilityOn  from '../assets/svg_icons/visibility_on.svg'
import visibilityOff from '../assets/svg_icons/visibility_off.svg'
import { fetchStations, fetchTeams, fetchShifts, updatePersonnel } from '../api'

const RANKS = [
  'Fire Officer I',
  'Fire Officer II',
  'Fire Officer III',
  'Senior Fire Officer',
  'Fire Inspector',
]

const DESIGNATIONS = [
  'Station Commander',
  'Deputy Station Commander',
  'Chief of Operations',
  'Administrative Officer',
  'Suppression Personnel',
  'Driver / Operator',
  'Rescue Personnel',
  'Investigation Officer',
  'Training Officer',
]

export default function EditPersonnelModal({ personnel, onClose, onSubmit }) {
  const nameParts  = (personnel.name || '').split(' ')
  const firstName  = nameParts[0] || ''
  const lastName   = nameParts.slice(1).join(' ')

  const [form, setForm] = useState({
    per_firstname:    firstName,
    per_lastname:     lastName,
    per_contact:      personnel.phone        || '',
    per_rank:         personnel.rank         || '',
    per_designation:  personnel.designation  || '',
    station_id:       personnel.station_id   || '',
    team_id:          personnel.team_id      || '',
    shift_id:         personnel.shift_id     || '',
    user_email:       personnel.email        || '',
  })
  const [pwd, setPwd]               = useState({ password: '', confirm: '' })
  const [showPwd, setShowPwd]       = useState(false)
  const [showConf, setShowConf]     = useState(false)
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [stations, setStations] = useState([])
  const [teams, setTeams]       = useState([])
  const [shifts, setShifts]     = useState([])

  useEffect(() => {
    fetchStations().then(setStations).catch(() => {})
    fetchTeams().then(setTeams).catch(() => {})
    fetchShifts().then(setShifts).catch(() => {})
  }, [])

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }))
    setError('')
  }

  function handleSubmit(e) {
    e.preventDefault()

    if (!form.per_firstname.trim() || !form.per_lastname.trim()) {
      setError('First and last name are required.')
      return
    }
    if (!form.per_rank) {
      setError('Please select a rank.')
      return
    }
    if (form.per_contact.trim()) {
      if (/[a-zA-Z]/.test(form.per_contact)) {
        setError('Contact number must not contain letters.')
        return
      }
      const digits = form.per_contact.replace(/[\s\-]/g, '')
      if (!/^(\+639\d{9}|09\d{9}|(\+63|0)\d{1,2}\d{7,8})$/.test(digits)) {
        setError('Contact number must be a valid Philippine phone number (e.g. +63-917-000-0000 or 09170000000).')
        return
      }
    }
    if (form.user_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.user_email.trim())) {
      setError('Email address is not valid.')
      return
    }
    if (pwd.password || pwd.confirm) {
      if (pwd.password.length < 8) {
        setError('New password must be at least 8 characters.')
        return
      }
      if (pwd.password !== pwd.confirm) {
        setError('Passwords do not match.')
        return
      }
    }

    const payload = {
      per_firstname:   form.per_firstname.trim(),
      per_lastname:    form.per_lastname.trim(),
      per_contact:     form.per_contact.trim(),
      per_rank:        form.per_rank,
      per_designation: form.per_designation.trim(),
      station_id:      form.station_id ? Number(form.station_id) : null,
      team_id:         form.team_id    ? Number(form.team_id)    : null,
      shift_id:        form.shift_id   ? Number(form.shift_id)   : null,
      user_email:      form.user_email.trim(),
    }
    if (pwd.password) payload.user_password = pwd.password

    setLoading(true)
    updatePersonnel(personnel.per_id, payload)
      .then(updated => { setLoading(false); onSubmit(updated) })
      .catch(err    => { setLoading(false); setError(err.message) })
  }

  return (
    <AppModal eyebrow="PERSONNEL MANAGEMENT" title="Edit Personnel Profile" onClose={onClose} width={560}>
      <form onSubmit={handleSubmit}>
        <div className="apm-scroll">
          <div className="apm-body">

            <div className="apm-section-label">Personal Information</div>

            <div className="apm-row">
              <div className="apm-field">
                <label>First Name <span className="apm-required">*</span></label>
                <input
                  placeholder="e.g. Juan"
                  value={form.per_firstname}
                  onChange={e => set('per_firstname', e.target.value)}
                  autoFocus
                />
              </div>
              <div className="apm-field">
                <label>Last Name <span className="apm-required">*</span></label>
                <input
                  placeholder="e.g. Dela Cruz"
                  value={form.per_lastname}
                  onChange={e => set('per_lastname', e.target.value)}
                />
              </div>
            </div>

            <div className="apm-field">
              <label>Contact Number</label>
              <input
                type="tel"
                placeholder="+63-917-000-0000"
                value={form.per_contact}
                onChange={e => set('per_contact', e.target.value)}
              />
            </div>

            <div className="apm-section-label">Service Details</div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Rank <span className="apm-required">*</span></label>
                <select value={form.per_rank} onChange={e => set('per_rank', e.target.value)}>
                  <option value="">Select rank...</option>
                  {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="apm-field">
                <label>Designation</label>
                <select value={form.per_designation} onChange={e => set('per_designation', e.target.value)}>
                  <option value="">Select designation...</option>
                  {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
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

            <div className="apm-row">
              <div className="apm-field">
                <label>Team</label>
                <select value={form.team_id} onChange={e => set('team_id', e.target.value)}>
                  <option value="">Select team...</option>
                  {teams.map(t => (
                    <option key={t.team_id} value={t.team_id}>
                      {t.team_code ? `${t.team_code} — ` : ''}{t.team_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="apm-field">
                <label>Shift</label>
                <select value={form.shift_id} onChange={e => set('shift_id', e.target.value)}>
                  <option value="">Select shift...</option>
                  {shifts.map(s => (
                    <option key={s.shift_id} value={s.shift_id}>{s.shift_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="apm-section-label">Account Credentials</div>

            <div className="apm-field">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="email@bfp.gov.ph"
                value={form.user_email}
                onChange={e => set('user_email', e.target.value)}
              />
            </div>

            <div className="apm-section-label">Change Password</div>

            <div className="apm-row">
              <div className="apm-field">
                <label>New Password</label>
                <div className="apm-input-wrap">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    value={pwd.password}
                    onChange={e => { setPwd(p => ({ ...p, password: e.target.value })); setError('') }}
                  />
                  <button type="button" className="apm-eye" onClick={() => setShowPwd(v => !v)}>
                    <img src={showPwd ? visibilityOff : visibilityOn} alt="" />
                  </button>
                </div>
              </div>
              <div className="apm-field">
                <label>Confirm Password</label>
                <div className="apm-input-wrap">
                  <input
                    type={showConf ? 'text' : 'password'}
                    placeholder="Repeat password"
                    value={pwd.confirm}
                    onChange={e => { setPwd(p => ({ ...p, confirm: e.target.value })); setError('') }}
                  />
                  <button type="button" className="apm-eye" onClick={() => setShowConf(v => !v)}>
                    <img src={showConf ? visibilityOff : visibilityOn} alt="" />
                  </button>
                </div>
              </div>
            </div>

            <div className="apm-pwd-disclaimer">
              Leave both fields empty to keep the current password unchanged.
            </div>

            {error && <div className="apm-error">{error}</div>}

          </div>
        </div>

        <div className="apm-actions">
          <button type="button" className="apm-btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="submit" className="apm-btn-submit" disabled={loading}>
            {loading ? <span className="apm-spinner" /> : 'Save Changes'}
          </button>
        </div>
      </form>
    </AppModal>
  )
}
