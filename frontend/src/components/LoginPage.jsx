import { useState } from 'react'
import { apiFetch } from '../api'
import '../styles/LoginPage.css'


export default function LoginPage({ onLogin }) {
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [remembered, setRemembered] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [alert, setAlert]         = useState('')
  const [errors, setErrors]       = useState({ email: false, password: false })

  function validate() {
    const e = {
      email:    !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      password: !password,
    }
    setErrors(e)
    return !e.email && !e.password
  }

  async function handleLogin() {
    setAlert('')
    if (!validate()) return

    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      if (res.ok) {
        const data = await res.json()
        localStorage.setItem('bfp_token', data.access_token)
        localStorage.setItem('bfp_user', JSON.stringify(data.user))
        onLogin(data.user)
      } else {
        setErrors({ email: true, password: true })
        setAlert('Invalid credentials. Please check your email and password.')
      }
    } catch {
      setAlert('Unable to reach the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div className="lp-body" onKeyDown={handleKeyDown}>
      <div className="lp-wrapper">

        {/* LEFT: HERO */}
        <div className="lp-hero">
          <div className="lp-eyebrow">Panabo City · Bureau of Fire Protection</div>

          <div className="lp-title">
            <div className="lp-title-wrap">
              <div className="lp-title-logo-icon" />
              <div className="lp-title-logo-text">FIRE<span>OPS</span></div>
            </div>
          </div>

          <div className="lp-subtitle">GNN-Powered Geospatial Routing &amp; Dispatch</div>
          <div className="lp-rule" />

          <div className="lp-features">
            {[
              { cls: 'fi-fire', icon: 'src/assets/svg_icons/fire_icon.svg', title: 'Real-Time Incident Management',
                desc: 'Monitor active fire incidents across all barangays with live severity tracking and alarm escalation.' },
              { cls: 'fi-blue', icon: 'src/assets/svg_icons/routing_icon.svg', title: 'GNN-RL Routing Engine',
                desc: 'Optimal routing computed by a Graph Neural Network trained with reinforcement learning for dynamic road conditions.' },
              { cls: 'fi-green', icon: 'src/assets/svg_icons/location_tracking_icon.svg', title: 'IoT Personnel Tracking',
                desc: 'Field unit locations tracked via ESP32 GPS with SMS fallback for low-coverage areas.' },
              { cls: 'fi-amber', icon: 'src/assets/svg_icons/fire_truck_icon.svg', title: 'Multi-Station Dispatch',
                desc: 'Coordinate response teams across main and sub-stations from a single command dashboard.' },
            ].map(f => (
              <div className="lp-feature" key={f.title}>
                <div className={`lp-feature-icon ${f.cls}`}>
                  <img src={f.icon} alt='x' width='14px' />
                </div>
                <div>
                  <div className="lp-feature-title">{f.title}</div>
                  <div className="lp-feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="lp-stats">
            {[
              { val: '3',   unit: '',  label: 'Main Stations' },
              { val: '14',  unit: '',  label: 'Personnel' },
              { val: '8',   unit: '',  label: 'Fire Units' },
              { val: '94',  unit: '%',  label: 'Model Accuracy' },
            ].map(s => (
              <div key={s.label}>
                <div className="lp-stat-val-wrapper">
                  <span className="lp-stat-val">{s.val}</span>
                  <span className="lp-stat-unit">{s.unit}</span>
                </div>
                <span className="lp-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: LOGIN CARD */}
        <div className="lp-card">
          <div className="lp-card-header">
            <div className="lp-logo-row">
              <div className="lp-logo-icon" />
              <div className="lp-logo-text">FIRE<span>OPS</span></div>
            </div>
            <div className="lp-card-title">Administrator Sign In</div>
          </div>

          <hr className="lp-divider" />

          {alert && (
            <div className="lp-alert">
              <span>⚠</span>
              <span>{alert}</span>
            </div>
          )}

          {/* Email */}
          <div className="lp-field-group">
            <label className="lp-field-label">Email</label>
            <div className="lp-field-wrap">
              <img className="lp-field-icon" src="src/assets/svg_icons/email_icon.svg" alt="" />
              <input
                className={`lp-field-input${errors.email ? ' error' : ''}`}
                type="email"
                placeholder="you@bfp.gov.ph"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            {errors.email && (
              <div className="lp-field-error">Please enter a valid email address.</div>
            )}
          </div>

          {/* Password */}
          <div className="lp-field-group">
            <label className="lp-field-label">Password</label>
            <div className="lp-field-wrap">
              <img className="lp-field-icon" src="src/assets/svg_icons/lock_icon.svg" alt="" />
              <input
                className={`lp-field-input${errors.password ? ' error' : ''}`}
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <img
                className="lp-pw-toggle"
                src={showPw ? 'src/assets/svg_icons/visibility_on.svg' : 'src/assets/svg_icons/visibility_off.svg'}
                alt={showPw ? 'Hide password' : 'Show password'}
                onClick={() => setShowPw(v => !v)}
              />
            </div>
            {errors.password && (
              <div className="lp-field-error">Password is required.</div>
            )}
          </div>

          {/* Meta row */}
          <div className="lp-meta-row">
            <div className="lp-remember-wrap" onClick={() => setRemembered(v => !v)}>
              <div className={`lp-remember-box${remembered ? ' on' : ''}`}>✓</div>
              <span className="lp-remember-label">Remember me</span>
            </div>
            <a className="lp-forgot" href="#">Forgot password?</a>
          </div>

          <button
            type="button"
            className={`lp-btn-login${loading ? ' loading' : ''}`}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="lp-spinner" />
                Authenticating...
              </>
            ) : 'Sign In'}
          </button>

          <div className="lp-card-footer">
            <div className="lp-online-row">
              <div className="lp-online-dot" />
              System online · Authorized access only
            </div>
            <div className="lp-copyright">
              © 2026 FireGIS · Bureau of Fire Protection All rights reserved.
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
