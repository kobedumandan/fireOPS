import { useState, useEffect } from 'react'
import AppModal from './AppModal'
import { fetchStations } from '../api'

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

function VisibilityIcon({ off }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="apm-eye-icon"
      fill="currentColor"
    >
      <path d={off ? "m644-428-58-58q9-47-27-88t-93-32l-58-58q17-8 34.5-12t37.5-4q75 0 127.5 52.5T660-500q0 20-4 37.5T644-428Zm128 126-58-56q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-62-62q41-17 84-25.5t90-8.5q151 0 269 83.5T920-500q-23 59-60.5 109.5T772-302Zm20 246L624-222q-35 11-70.5 16.5T480-200q-151 0-269-83.5T40-500q21-53 53-98.5t73-81.5L56-792l56-56 736 736-56 56ZM222-624q-29 26-53 57t-41 67q50 101 143.5 160.5T480-280q20 0 39-2.5t39-5.5l-36-38q-11 3-21 4.5t-21 1.5q-75 0-127.5-52.5T300-500q0-11 1.5-21t4.5-21l-84-82Zm319 93Zm-151 75Z" : "M607.5-372.5Q660-425 660-500t-52.5-127.5Q555-680 480-680t-127.5 52.5Q300-575 300-500t52.5 127.5Q405-320 480-320t127.5-52.5Zm-204-51Q372-455 372-500t31.5-76.5Q435-608 480-608t76.5 31.5Q588-545 588-500t-31.5 76.5Q525-392 480-392t-76.5-31.5ZM214-281.5Q94-363 40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200q-146 0-266-81.5ZM480-500Zm207.5 160.5Q782-399 832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280q113 0 207.5-59.5Z"} />
    </svg>
  );
}

export default function AddPersonnelModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    per_firstname:    '',
    per_lastname:     '',
    per_contact:      '',
    per_rank:         '',
    per_designation:  '',
    station_id:       '',
    user_email:       '',
    user_password:    '',
    confirm_password: '',
  })
  const [error, setError]       = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [showConf, setShowConf] = useState(false)
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

    if (!form.user_email.trim()) {
      setError('Email address is required.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.user_email.trim())) {
      setError('Email address is not valid.')
      return
    }

    if (form.user_password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (form.user_password !== form.confirm_password) {
      setError('Passwords do not match.')
      return
    }
    try {
      await onSubmit({
        per_firstname:   form.per_firstname.trim(),
        per_lastname:    form.per_lastname.trim(),
        per_contact:     form.per_contact.trim(),
        per_rank:        form.per_rank,
        per_designation: form.per_designation.trim(),
        station_id:      form.station_id || null,
        user_email:      form.user_email.trim(),
        user_password:   form.user_password,
        user_role:       'personnel',
      })
    } catch (ex) {
      // Server-side rejection (duplicate email, validation): show it in the
      // same .apm-error the client-side checks above use.
      setError(ex.message || 'Could not save. Please try again.')
    }
  }

  return (
    <AppModal eyebrow="PERSONNEL MANAGEMENT" title="Add New Personnel" onClose={onClose} width={560}>
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

            <div className="apm-section-label">Account Credentials</div>

            <div className="apm-field">
              <label>Email Address <span className="apm-required">*</span></label>
              <input
                type="email"
                placeholder="email@bfp.gov.ph"
                value={form.user_email}
                onChange={e => set('user_email', e.target.value)}
              />
            </div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Password <span className="apm-required">*</span></label>
                <div className="apm-input-wrap">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    value={form.user_password}
                    onChange={e => set('user_password', e.target.value)}
                  />
                  <button type="button" className="apm-eye" aria-label={showPwd ? "Hide password" : "Show password"} onClick={() => setShowPwd(v => !v)}>
                    <VisibilityIcon off={showPwd} />
                  </button>
                </div>
              </div>
              <div className="apm-field">
                <label>Confirm Password <span className="apm-required">*</span></label>
                <div className="apm-input-wrap">
                  <input
                    type={showConf ? 'text' : 'password'}
                    placeholder="Repeat password"
                    value={form.confirm_password}
                    onChange={e => set('confirm_password', e.target.value)}
                  />
                  <button type="button" className="apm-eye" aria-label={showConf ? "Hide password" : "Show password"} onClick={() => setShowConf(v => !v)}>
                    <VisibilityIcon off={showConf} />
                  </button>
                </div>
              </div>
            </div>

            {error && <div className="apm-error">{error}</div>}

          </div>
        </div>

        <div className="apm-actions">
          <button type="button" className="apm-btn-cancel" onClick={onClose}>Cancel</button>
          <button type="submit" className="apm-btn-submit">+ Add Personnel</button>
        </div>
      </form>
    </AppModal>
  )
}
