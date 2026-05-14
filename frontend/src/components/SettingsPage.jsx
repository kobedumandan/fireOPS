import { useState, useEffect, useRef } from 'react'
import '../styles/SettingsPage.css'
import iconAccount       from '../assets/settings_page_icons/account_settings.svg'
import iconSecurity      from '../assets/settings_page_icons/security_settings.svg'
import iconSession       from '../assets/settings_page_icons/session_settings.svg'
import iconAppearance    from '../assets/settings_page_icons/appearance_settings.svg'
import iconNotifications from '../assets/settings_page_icons/notifications_settings.svg'
import iconMapDisplay    from '../assets/settings_page_icons/map_display_settings.svg'
import iconAbout         from '../assets/settings_page_icons/about_settings.svg'
import iconLogout        from '../assets/settings_page_icons/logout_settings.svg'

const SIDEBAR_ITEMS = [
  { section: 'account', label: 'Account', items: [
    { id: 'profile',       icon: iconAccount,       label: 'Profile' },
    { id: 'security',      icon: iconSecurity,      label: 'Security' },
    { id: 'session',       icon: iconSession,       label: 'Session' },
  ]},
  { section: 'preferences', label: 'Preferences', items: [
    { id: 'appearance',    icon: iconAppearance,    label: 'Appearance' },
    { id: 'notifications', icon: iconNotifications, label: 'Notifications' },
    { id: 'display',       icon: iconMapDisplay,    label: 'Map Display' },
  ]},
  { section: 'system', label: 'System', items: [
    { id: 'about',         icon: iconAbout,         label: 'About' },
  ]},
]

function Toggle({ id, defaultOn = false }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="toggle-wrap">
      <div className={`toggle${on ? ' on' : ''}`} onClick={() => setOn(v => !v)}>
        <div className="toggle-knob" />
      </div>
      <span className="toggle-label">{on ? 'ON' : 'OFF'}</span>
    </div>
  )
}

function EditableRow({ label, sub, value: initialValue }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialValue)
  const [draft, setDraft] = useState(initialValue)
  const inputRef = useRef()

  function startEdit() {
    setDraft(value)
    setEditing(true)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 0)
  }

  function save() {
    setValue(draft || value)
    setEditing(false)
  }

  return (
    <div className="block-row">
      <div className="row-left">
        <div className="row-label">{label}</div>
        <div className="row-sub">{sub}</div>
      </div>
      <div className="row-right">
        {editing ? (
          <>
            <input
              ref={inputRef}
              className="inline-input"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            />
            <button className="btn-save" onClick={save}>Save</button>
          </>
        ) : (
          <>
            <span className="row-value">{value}</span>
            <button className="btn-edit" onClick={startEdit}>Edit</button>
          </>
        )}
      </div>
    </div>
  )
}

function SessionTimer() {
  const startRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  const h = String(Math.floor(elapsed / 3600)).padStart(2, '0')
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')
  const s = String(elapsed % 60).padStart(2, '0')
  const expiry = new Date(startRef.current + 8 * 3600 * 1000)
    .toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' })

  return { timer: `${h}:${m}:${s}`, expiry }
}

// ── SECTIONS ─────────────────────────────────────────────────────────────────

function SectionProfile({ user }) {
  const firstName = user?.first_name ?? ''
  const lastName  = user?.last_name  ?? ''
  const initials  = `${firstName[0] ?? '?'}${lastName[0] ?? ''}`.toUpperCase()
  const fullName  = [firstName, lastName].filter(Boolean).join(' ') || '—'
  const email     = user?.email ?? '—'
  const contact   = user?.contact ?? '—'
  const role      = user?.role ?? '—'
  const designation = user?.designation ?? (role === 'admin' ? 'Administrator' : '—')
  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  return (
    <>
      <div className="section-title">Profile</div>
      <div className="section-desc">Your account information and identity details.</div>

      <div className="settings-block">
        <div className="block-header"><div className="block-title">Identity</div></div>
        <div className="avatar-block">
          <div className="big-avatar">
            {initials}
            <div className="avatar-online" />
          </div>
          <div>
            <div className="avatar-name">{fullName}</div>
            <div className="avatar-email">{email}</div>
            <span className="val-badge vb-blue">{role}</span>
          </div>
        </div>
        <EditableRow label="First Name"      sub="Your given name on record"    value={firstName || '—'} />
        <EditableRow label="Last Name"       sub="Your surname on record"       value={lastName  || '—'} />
        <EditableRow label="Contact Number"  sub="Primary contact for dispatch" value={contact} />
      </div>

      <div className="settings-block">
        <div className="block-header"><div className="block-title">Role & Access</div></div>
        <div className="block-row">
          <div className="row-left"><div className="row-label">User Role</div><div className="row-sub">Assigned system access level</div></div>
          <div className="row-right"><span className="val-badge vb-blue">{role}</span></div>
        </div>
        <div className="block-row">
          <div className="row-left"><div className="row-label">Designation</div><div className="row-sub">Position within the command structure</div></div>
          <div className="row-right"><span className="row-value">{designation}</span></div>
        </div>
        <div className="block-row">
          <div className="row-left"><div className="row-label">Assigned Station</div><div className="row-sub">Primary reporting station</div></div>
          <div className="row-right"><span className="row-value blue">Station 1 – Panabo</span></div>
        </div>
        <div className="block-row">
          <div className="row-left"><div className="row-label">Account Created</div><div className="row-sub">Date this account was provisioned</div></div>
          <div className="row-right"><span className="row-value">{createdAt}</span></div>
        </div>
      </div>
    </>
  )
}

function SectionSecurity({ user }) {
  return (
    <>
      <div className="section-title">Security</div>
      <div className="section-desc">Manage your password and login credentials.</div>

      <div className="settings-block">
        <div className="block-header"><div className="block-title">Credentials</div></div>
        <EditableRow label="Email Address" sub="Used for system login and alerts" value={user?.email ?? '—'} />
        <div className="block-row">
          <div className="row-left"><div className="row-label">Password</div><div className="row-sub">Last changed 45 days ago</div></div>
          <div className="row-right">
            <span className="row-value">••••••••••••</span>
            <button className="btn-edit">Change</button>
          </div>
        </div>
      </div>

      <div className="settings-block">
        <div className="block-header"><div className="block-title">Login History</div></div>
        <div className="block-row">
          <div className="row-left"><div className="row-label">Last Login</div><div className="row-sub">Most recent successful authentication</div></div>
          <div className="row-right"><span className="row-value highlight">Today, 08:31 AM</span></div>
        </div>
        <div className="block-row">
          <div className="row-left"><div className="row-label">Login Device</div><div className="row-sub">Browser and operating system</div></div>
          <div className="row-right"><span className="row-value">Chrome · Windows 11</span></div>
        </div>
        <div className="block-row">
          <div className="row-left"><div className="row-label">IP Address</div><div className="row-sub">Network address at time of login</div></div>
          <div className="row-right"><span className="row-value">192.168.1.45</span></div>
        </div>
      </div>
    </>
  )
}

function SectionSession({ onLogout }) {
  const { timer, expiry } = SessionTimer()

  return (
    <>
      <div className="section-title">Session</div>
      <div className="section-desc">Current login session details and activity.</div>

      <div className="settings-block">
        <div className="block-header"><div className="block-title">Active Session</div></div>
        <div className="block-row">
          <div className="row-left"><div className="row-label">Session Status</div><div className="row-sub">Current authentication state</div></div>
          <div className="row-right"><span className="val-badge vb-green">Active</span></div>
        </div>
        <div className="block-row">
          <div className="row-left"><div className="row-label">Session Duration</div><div className="row-sub">Time elapsed since login</div></div>
          <div className="row-right">
            <div className="session-timer">
              <div className="timer-dot" />
              <span>{timer}</span>
            </div>
          </div>
        </div>
        <div className="block-row">
          <div className="row-left"><div className="row-label">Session Expires</div><div className="row-sub">Auto-logout after 8 hours of inactivity</div></div>
          <div className="row-right"><span className="row-value">{expiry}</span></div>
        </div>
        <div className="block-row">
          <div className="row-left"><div className="row-label">Session Token</div><div className="row-sub">Current authentication token ID</div></div>
          <div className="row-right"><span className="row-value" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>bfp-sess-0042f8a1</span></div>
        </div>
      </div>

      <div className="danger-block">
        <div className="block-header"><div className="block-title">End Session</div></div>
        <div className="block-row">
          <div className="row-left"><div className="row-label">Sign Out</div><div className="row-sub">Terminate this session and return to login</div></div>
          <div className="row-right"><button className="btn-logout" onClick={onLogout}>Sign Out</button></div>
        </div>
      </div>
    </>
  )
}

function SectionAppearance({ theme, onThemeToggle }) {
  return (
    <>
      <div className="section-title">Appearance</div>
      <div className="section-desc">Customize how the FireGIS interface looks.</div>

      <div className="settings-block">
        <div className="block-header"><div className="block-title">Theme</div></div>
        <div className="block-row">
          <div className="row-left"><div className="row-label">Color Mode</div><div className="row-sub">Switch between dark and light interface theme</div></div>
          <div className="row-right">
            <div className="theme-options">
              <div className={`theme-opt${theme === 'dark' ? ' selected' : ''}`} onClick={() => theme !== 'dark' && onThemeToggle()}>
                <div className={`theme-preview tp-dark${theme === 'dark' ? ' selected' : ''}`} />
                <span className="theme-name">Dark</span>
              </div>
              <div className={`theme-opt${theme === 'light' ? ' selected' : ''}`} onClick={() => theme !== 'light' && onThemeToggle()}>
                <div className={`theme-preview tp-light${theme === 'light' ? ' selected' : ''}`} />
                <span className="theme-name">Light</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-block">
        <div className="block-header"><div className="block-title">Interface</div></div>
        <div className="block-row">
          <div className="row-left"><div className="row-label">Compact Sidebar</div><div className="row-sub">Show icons only in the sidebar panel</div></div>
          <div className="row-right"><Toggle id="compact" defaultOn={false} /></div>
        </div>
        <div className="block-row">
          <div className="row-left"><div className="row-label">Animations</div><div className="row-sub">Enable UI motion and transitions</div></div>
          <div className="row-right"><Toggle id="anim" defaultOn={true} /></div>
        </div>
      </div>
    </>
  )
}

function SectionNotifications() {
  return (
    <>
      <div className="section-title">Notifications</div>
      <div className="section-desc">Control how and when you receive system alerts.</div>

      <div className="settings-block">
        <div className="block-header"><div className="block-title">Incident Alerts</div></div>
        <div className="block-row">
          <div className="row-left"><div className="row-label">New Incident Reports</div><div className="row-sub">Alert when a new fire incident is logged</div></div>
          <div className="row-right"><Toggle id="inc" defaultOn={true} /></div>
        </div>
        <div className="block-row">
          <div className="row-left"><div className="row-label">Alarm Escalations</div><div className="row-sub">Notify on alarm level upgrades</div></div>
          <div className="row-right"><Toggle id="esc" defaultOn={true} /></div>
        </div>
        <div className="block-row">
          <div className="row-left"><div className="row-label">Incident Resolution</div><div className="row-sub">Alert when an incident is closed</div></div>
          <div className="row-right"><Toggle id="res" defaultOn={false} /></div>
        </div>
      </div>

      <div className="settings-block">
        <div className="block-header"><div className="block-title">Personnel & Dispatch</div></div>
        <div className="block-row">
          <div className="row-left"><div className="row-label">Dispatch Confirmations</div><div className="row-sub">Notify when a unit acknowledges dispatch</div></div>
          <div className="row-right"><Toggle id="disp" defaultOn={true} /></div>
        </div>
        <div className="block-row">
          <div className="row-left"><div className="row-label">IoT Device Offline</div><div className="row-sub">Alert when a personnel tracker goes offline</div></div>
          <div className="row-right"><Toggle id="iot" defaultOn={true} /></div>
        </div>
      </div>
    </>
  )
}

function SectionMapDisplay() {
  return (
    <>
      <div className="section-title">Map Display</div>
      <div className="section-desc">Configure what is shown on the GIS command map.</div>

      <div className="settings-block">
        <div className="block-header"><div className="block-title">Map Layers</div></div>
        {[
          { id: 'ml1', label: 'Show Incident Markers',     sub: 'Display fire incident pins on the map',          on: true  },
          { id: 'ml2', label: 'Show Personnel Markers',    sub: 'Display real-time field unit locations',         on: true  },
          { id: 'ml3', label: 'Show GNN Route Overlays',   sub: 'Display computed dispatch routes',               on: true  },
          { id: 'ml4', label: 'Show Heat Map Layer',       sub: 'Visualize historical incident density',          on: false },
          { id: 'ml5', label: 'Show Purok Boundaries',     sub: 'Display barangay and purok polygon overlays',    on: false },
        ].map(row => (
          <div className="block-row" key={row.id}>
            <div className="row-left"><div className="row-label">{row.label}</div><div className="row-sub">{row.sub}</div></div>
            <div className="row-right"><Toggle id={row.id} defaultOn={row.on} /></div>
          </div>
        ))}
      </div>
    </>
  )
}

function SectionAbout() {
  return (
    <>
      <div className="section-title">About</div>
      <div className="section-desc">System information and version details.</div>

      <div className="settings-block">
        <div className="block-header"><div className="block-title">FireGIS Platform</div></div>
        {[
          { label: 'System Name',   value: 'FireGIS Command System',         badge: null,           cls: '' },
          { label: 'Version',       value: 'v1.0.0-beta',                   badge: 'vb-green',     cls: '' },
          { label: 'GNN Model',     value: 'GNN-RL v2.1 · Online',          badge: null,           cls: 'highlight' },
          { label: 'Database',      value: 'PostgreSQL + PostGIS',           badge: null,           cls: '' },
          { label: 'Backend',       value: 'FastAPI · Python 3.11',          badge: null,           cls: '' },
          { label: 'Organization',  value: 'Bureau of Fire Protection – QC', badge: null,          cls: '' },
          { label: 'Copyright',     value: '© 2026 FireGIS · All rights reserved.', badge: null,   cls: '' },
        ].map(row => (
          <div className="block-row" key={row.label}>
            <div className="row-left"><div className="row-label">{row.label}</div></div>
            <div className="row-right">
              {row.badge
                ? <span className={`val-badge ${row.badge}`}>{row.value}</span>
                : <span className={`row-value ${row.cls}`}>{row.value}</span>
              }
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function SettingsPage({ user, theme, onThemeToggle, onLogout }) {
  const [activeId, setActiveId] = useState('profile')

  function renderContent() {
    switch (activeId) {
      case 'profile':       return <SectionProfile user={user} />
      case 'security':      return <SectionSecurity user={user} />
      case 'session':       return <SectionSession onLogout={onLogout} />
      case 'appearance':    return <SectionAppearance theme={theme} onThemeToggle={onThemeToggle} />
      case 'notifications': return <SectionNotifications />
      case 'display':       return <SectionMapDisplay />
      case 'about':         return <SectionAbout />
      default:              return null
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-body">
        <div className="settings-sidebar">
          {SIDEBAR_ITEMS.map(({ section, label, items }) => (
            <div key={section}>
              <div className="sidebar-section-label">{label}</div>
              {items.map(item => (
                <div
                  key={item.id}
                  className={`settings-sidebar-item${activeId === item.id ? ' active' : ''}`}
                  onClick={() => setActiveId(item.id)}
                >
                  <img className="sidebar-item-icon" src={item.icon} alt="" />
                  {item.label}
                </div>
              ))}
              <div className="sidebar-gap" />
              <hr className="sidebar-divider" />
            </div>
          ))}

          <div className="settings-sidebar-item logout" onClick={onLogout}>
            <img className="sidebar-item-icon" src={iconLogout} alt="" />
            Sign Out
          </div>
        </div>

        <div className="settings-content">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
