import { useState, useMemo } from 'react'
import '../styles/IncidentsPage.css'
import LogIncidentModal from './LogIncidentModal'

const INCIDENTS = [
  { id: 'INC-2026-084', loc: 'Brgy. San Isidro, QC',  addr: '123 Maharlika St.',     sev: 'Critical', status: 'active',    rep: 'Today 08:42 AM', units: 2, alarm: '2nd Alarm', structure: 'Residential 2-storey', casualties: 'Unconfirmed', reporter: 'BFP Hotline · 911', eta: '4 min' },
  { id: 'INC-2026-083', loc: 'Tandang Sora Ave., QC', addr: '456 Tandang Sora Ave.', sev: 'Moderate', status: 'enroute',   rep: 'Today 07:15 AM', units: 1, alarm: '1st Alarm', structure: 'Commercial',          casualties: 'None',        reporter: '911 Call',          eta: '9 min' },
  { id: 'INC-2026-081', loc: 'Batasan Hills, QC',     addr: '78 Batasan Rd.',        sev: 'Minor',    status: 'contained', rep: 'Today 05:30 AM', units: 3, alarm: '1st Alarm', structure: 'Residential',         casualties: 'None',        reporter: 'SMS Report',        eta: 'On scene' },
]

const SEV_ORDER  = { Critical: 0, Moderate: 1, Minor: 2 }
const STATUS_TABS = ['all', 'active', 'enroute', 'contained', 'closed']

function SeverityBadge({ sev }) {
  const cls = sev === 'Critical' ? 'badge-critical' : sev === 'Moderate' ? 'badge-moderate' : 'inc-badge-minor'
  return <span className={`inc-badge ${cls}`}>{sev}</span>
}

function StatusPill({ status }) {
  const map = {
    active:    ['sp-active',    'Active'],
    enroute:   ['sp-enroute',   'En Route'],
    contained: ['sp-contained', 'Contained'],
    closed:    ['sp-closed',    'Closed'],
  }
  const [cls, label] = map[status] || ['sp-closed', status]
  return <span className={`status-pill ${cls}`}>{label}</span>
}

export default function IncidentsPage() {
  const [activeStatus, setActiveStatus] = useState('all')
  const [search, setSearch]             = useState('')
  const [sevFilter, setSevFilter]       = useState('')
  const [alarmFilter, setAlarmFilter]   = useState('')
  const [sortCol, setSortCol]           = useState('id')
  const [sortDir, setSortDir]           = useState(-1)
  const [selectedId, setSelectedId]     = useState(null)
  const [showLogModal, setShowLogModal] = useState(false)

  const stats = useMemo(() => ({
    active:    INCIDENTS.filter(i => i.status === 'active').length,
    enroute:   INCIDENTS.filter(i => i.status === 'enroute').length,
    contained: INCIDENTS.filter(i => i.status === 'contained').length,
    closed:    INCIDENTS.filter(i => i.status === 'closed').length,
  }), [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let rows = INCIDENTS.filter(i => {
      const mq  = !q          || i.id.toLowerCase().includes(q) || i.loc.toLowerCase().includes(q) || i.addr.toLowerCase().includes(q)
      const ms  = !sevFilter  || i.sev   === sevFilter
      const ma  = !alarmFilter|| i.alarm === alarmFilter
      const mst = activeStatus === 'all' || i.status === activeStatus
      return mq && ms && ma && mst
    })

    rows.sort((a, b) => {
      let av, bv
      if (sortCol === 'id')    { av = a.id;    bv = b.id }
      if (sortCol === 'loc')   { av = a.loc;   bv = b.loc }
      if (sortCol === 'sev')   { av = SEV_ORDER[a.sev]; bv = SEV_ORDER[b.sev] }
      if (sortCol === 'rep')   { av = a.rep;   bv = b.rep }
      if (sortCol === 'units') { av = a.units; bv = b.units }
      if (av < bv) return -1 * sortDir
      if (av > bv) return  1 * sortDir
      return 0
    })

    return rows
  }, [search, sevFilter, alarmFilter, activeStatus, sortCol, sortDir])

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d * -1)
    else { setSortCol(col); setSortDir(-1) }
  }

  function arrow(col) {
    if (sortCol !== col) return '↕'
    return sortDir === -1 ? '↓' : '↑'
  }

  const selected = INCIDENTS.find(i => i.id === selectedId)

  return (
    <div className="inc-page">

      {/* PAGE HEADER */}
      <div className="inc-header">
        <div className="inc-title-row">
          <div className="inc-title">
            Incidents
            <span>↳ {INCIDENTS.length} TOTAL</span>
          </div>
          <button className="inc-btn-log" onClick={() => setShowLogModal(true)}>+ Log Incident</button>
        </div>

        {/* STAT CARDS */}
        <div className="inc-stat-row">
          <div className="inc-stat-card fire">
            <div className="inc-stat-label">Active</div>
            <div className="inc-stat-value">{stats.active}</div>
            <div className="inc-stat-sub">ONGOING RIGHT NOW</div>
          </div>
          <div className="inc-stat-card amber">
            <div className="inc-stat-label">En Route</div>
            <div className="inc-stat-value">{stats.enroute}</div>
            <div className="inc-stat-sub">UNITS DISPATCHED</div>
          </div>
          <div className="inc-stat-card green">
            <div className="inc-stat-label">Contained</div>
            <div className="inc-stat-value">{stats.contained}</div>
            <div className="inc-stat-sub">FIRE SUPPRESSED</div>
          </div>
          <div className="inc-stat-card blue">
            <div className="inc-stat-label">Closed</div>
            <div className="inc-stat-value">{stats.closed}</div>
            <div className="inc-stat-sub">THIS MONTH</div>
          </div>
        </div>

        {/* STATUS TABS */}
        <div className="inc-status-tabs">
          {STATUS_TABS.map(s => (
            <button
              key={s}
              className={`inc-status-tab${activeStatus === s ? ' active' : ''}`}
              onClick={() => setActiveStatus(s)}
            >
              {s === 'all' ? 'All' : s === 'enroute' ? 'En Route' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="inc-toolbar">
        <div className="inc-search-wrap">
          <span className="inc-search-icon">⌕</span>
          <input
            type="text"
            placeholder="Search ID, location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="inc-filter-select" value={sevFilter} onChange={e => setSevFilter(e.target.value)}>
          <option value="">All Severities</option>
          <option value="Critical">Critical</option>
          <option value="Moderate">Moderate</option>
          <option value="Minor">Minor</option>
        </select>
        <select className="inc-filter-select" value={alarmFilter} onChange={e => setAlarmFilter(e.target.value)}>
          <option value="">All Alarm Levels</option>
          <option value="1st Alarm">1st Alarm</option>
          <option value="2nd Alarm">2nd Alarm</option>
          <option value="3rd Alarm">3rd Alarm</option>
        </select>
        <div className="inc-toolbar-right">
          <span className="inc-result-count">SHOWING {filtered.length} RECORD{filtered.length !== 1 ? 'S' : ''}</span>
        </div>
      </div>

      {/* TABLE */}
      <div className="inc-table-wrap">
        <table className="inc-table">
          <thead>
            <tr>
              {[
                { col: 'id',    label: 'Incident ID',  w: 130 },
                { col: 'loc',   label: 'Location',     w: 200 },
                { col: 'sev',   label: 'Severity',     w: 100 },
              ].map(({ col, label, w }) => (
                <th
                  key={col}
                  style={{ width: w }}
                  className={sortCol === col ? 'sort-active' : ''}
                  onClick={() => handleSort(col)}
                >
                  {label} <span className="inc-sort-arrow">{arrow(col)}</span>
                </th>
              ))}
              <th style={{ width: 110 }}>Status</th>
              <th
                style={{ width: 130 }}
                className={sortCol === 'rep' ? 'sort-active' : ''}
                onClick={() => handleSort('rep')}
              >
                Reported <span className="inc-sort-arrow">{arrow('rep')}</span>
              </th>
              <th
                style={{ width: 70 }}
                className={sortCol === 'units' ? 'sort-active' : ''}
                onClick={() => handleSort('units')}
              >
                Units <span className="inc-sort-arrow">{arrow('units')}</span>
              </th>
              <th style={{ width: 100 }}>Alarm</th>
              <th style={{ width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(inc => (
              <tr
                key={inc.id}
                className={selectedId === inc.id ? 'selected' : ''}
                onClick={() => setSelectedId(inc.id === selectedId ? null : inc.id)}
              >
                <td><span className="inc-row-id">{inc.id}</span></td>
                <td>
                  <div className="inc-row-loc">{inc.loc}</div>
                  <div className="inc-row-addr">{inc.addr}</div>
                </td>
                <td><SeverityBadge sev={inc.sev} /></td>
                <td><StatusPill status={inc.status} /></td>
                <td><span className="inc-rep-time">{inc.rep}</span></td>
                <td><span className="inc-units-count">{inc.units}</span></td>
                <td><span className="inc-alarm-text">{inc.alarm}</span></td>
                <td>
                  <div className="inc-row-actions">
                    <button className="inc-btn-view" onClick={e => { e.stopPropagation(); setSelectedId(inc.id) }}>View</button>
                    <button className="inc-btn-map"  onClick={e => e.stopPropagation()}>Map</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="inc-empty-state">No incidents match your filters</div>
        )}
      </div>

      {/* DETAIL DRAWER */}
      <div className={`inc-drawer${selected ? ' open' : ''}`}>
        {selected && (
          <div className="inc-drawer-inner">
            <div className="inc-drawer-header">
              <div>
                <div className="inc-drawer-id">{selected.id} · {selected.status.toUpperCase()}</div>
                <div className="inc-drawer-title">{selected.loc}</div>
                <div className="inc-drawer-chips">
                  <SeverityBadge sev={selected.sev} />
                  <StatusPill status={selected.status} />
                  <span className="inc-badge" style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', border: '1px solid rgba(30,144,255,0.3)' }}>
                    {selected.alarm}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div className="inc-drawer-actions">
                  <button className="inc-btn-dispatch-sm">▶ Dispatch Unit</button>
                  <button className="inc-btn-sec-sm">⊙ View on Map</button>
                  <button className="inc-btn-sec-sm">✎ Edit</button>
                  <button className="inc-btn-sec-sm">⬇ Export</button>
                </div>
                <button className="inc-btn-close" onClick={() => setSelectedId(null)}>✕ Close</button>
              </div>
            </div>
            <div className="inc-drawer-grid">
              {[
                { label: 'Address',        value: selected.addr },
                { label: 'Structure',      value: selected.structure },
                { label: 'Reported via',   value: selected.reporter },
                { label: 'Casualties',     value: selected.casualties, highlight: selected.casualties !== 'None' },
                { label: 'Units assigned', value: `${selected.units} unit${selected.units > 1 ? 's' : ''}` },
                { label: 'ETA / Status',   value: selected.eta },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="inc-drawer-field">
                  <div className="inc-drawer-label">{label}</div>
                  <div
                    className="inc-drawer-value"
                    style={highlight ? { color: 'var(--accent-amber)' } : undefined}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showLogModal && (
        <LogIncidentModal
          onClose={() => setShowLogModal(false)}
          onSubmit={data => {
            console.log('Log incident:', data)
            setShowLogModal(false)
          }}
        />
      )}

    </div>
  )
}
