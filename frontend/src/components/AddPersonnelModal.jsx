import { useState } from 'react'
import AppModal from './AppModal'
import visibilityOn  from '../assets/svg_icons/visibility_on.svg'
import visibilityOff from '../assets/svg_icons/visibility_off.svg'

const RANKS = [
  'Fire Officer I',
  'Fire Officer II',
  'Fire Officer III',
  'Senior Fire Officer',
  'Fire Inspector',
]

export default function AddPersonnelModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    per_firstname:    '',
    per_lastname:     '',
    per_contact:      '',
    per_rank:         '',
    per_designation:  '',
    user_email:       '',
    user_password:    '',
    confirm_password: '',
  })
  const [error, setError]       = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [showConf, setShowConf] = useState(false)

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
    onSubmit({
      per_firstname:   form.per_firstname.trim(),
      per_lastname:    form.per_lastname.trim(),
      per_contact:     form.per_contact.trim(),
      per_rank:        form.per_rank,
      per_designation: form.per_designation.trim(),
      user_email:      form.user_email.trim(),
      user_password:   form.user_password,
      user_role:       'personnel',
    })
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
                <input
                  placeholder="e.g. Station Commander"
                  value={form.per_designation}
                  onChange={e => set('per_designation', e.target.value)}
                />
              </div>
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
                  <button type="button" className="apm-eye" onClick={() => setShowPwd(v => !v)}>
                    <img src={showPwd ? visibilityOff : visibilityOn} alt="" />
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
                  <button type="button" className="apm-eye" onClick={() => setShowConf(v => !v)}>
                    <img src={showConf ? visibilityOff : visibilityOn} alt="" />
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
