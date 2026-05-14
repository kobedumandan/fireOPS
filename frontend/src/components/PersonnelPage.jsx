import { useState, useMemo } from 'react'
import '../styles/PersonnelPage.css'
import AddPersonnelModal from './AddPersonnelModal'

const PERSONNEL = [
  { id: 'FU-001', name: 'Juan Dela Cruz',    initials: 'JD', rank: 'Fire Officer II',     status: 'dispatched', station: 'Station 1', incident: 'INC-2026-084', iot: 'active',  battery: 82, phone: '+63-917-111-0001', joined: 'Jan 2020' },
  { id: 'FU-002', name: 'Maria Reyes',       initials: 'MR', rank: 'Fire Officer I',      status: 'dispatched', station: 'Station 1', incident: 'INC-2026-084', iot: 'active',  battery: 67, phone: '+63-917-111-0002', joined: 'Mar 2021' },
  { id: 'FU-003', name: 'Antonio Bautista',  initials: 'AB', rank: 'Senior Fire Officer',  status: 'onscene',    station: 'Station 2', incident: 'INC-2026-083', iot: 'active',  battery: 45, phone: '+63-917-111-0003', joined: 'Jun 2018' },
  { id: 'FU-004', name: 'Karen Santos',      initials: 'KS', rank: 'Fire Officer III',    status: 'dispatched', station: 'Station 1', incident: 'INC-2026-081', iot: 'sms',     battery: 91, phone: '+63-917-111-0004', joined: 'Sep 2019' },
  { id: 'FU-005', name: 'Ramon Lim',         initials: 'RL', rank: 'Fire Officer I',      status: 'standby',    station: 'Station 2', incident: '—',            iot: 'active',  battery: 88, phone: '+63-917-111-0005', joined: 'Feb 2022' },
  { id: 'FU-006', name: 'Fe Torres',         initials: 'FT', rank: 'Fire Officer II',     status: 'standby',    station: 'Station 1', incident: '—',            iot: 'active',  battery: 95, phone: '+63-917-111-0006', joined: 'Nov 2021' },
  { id: 'FU-007', name: 'Benito Villanueva', initials: 'BV', rank: 'Fire Inspector',      status: 'onscene',    station: 'Station 3', incident: 'INC-2026-083', iot: 'active',  battery: 33, phone: '+63-917-111-0007', joined: 'Apr 2017' },
  { id: 'FU-008', name: 'Corazon Mendoza',   initials: 'CM', rank: 'Fire Officer I',      status: 'standby',    station: 'Station 2', incident: '—',            iot: 'sms',     battery: 72, phone: '+63-917-111-0008', joined: 'Jul 2023' },
  { id: 'FU-009', name: 'Danilo Cruz',       initials: 'DC', rank: 'Fire Officer III',    status: 'standby',    station: 'Station 3', incident: '—',            iot: 'active',  battery: 60, phone: '+63-917-111-0009', joined: 'May 2020' },
  { id: 'FU-010', name: 'Elvira Garcia',     initials: 'EG', rank: 'Senior Fire Officer',  status: 'standby',   station: 'Station 1', incident: '—',            iot: 'active',  battery: 78, phone: '+63-917-111-0010', joined: 'Aug 2016' },
  { id: 'FU-011', name: 'Fernando Pascual',  initials: 'FP', rank: 'Fire Officer II',     status: 'standby',    station: 'Station 2', incident: '—',            iot: 'offline', battery: 0,  phone: '+63-917-111-0011', joined: 'Oct 2022' },
  { id: 'FU-012', name: 'Gloria Navarro',    initials: 'GN', rank: 'Fire Officer I',      status: 'offduty',    station: 'Station 3', incident: '—',            iot: 'offline', battery: 0,  phone: '+63-917-111-0012', joined: 'Jan 2023' },
  { id: 'FU-013', name: 'Hernando Aquino',   initials: 'HA', rank: 'Fire Officer III',    status: 'offduty',    station: 'Station 1', incident: '—',            iot: 'offline', battery: 0,  phone: '+63-917-111-0013', joined: 'Mar 2019' },
  { id: 'FU-014', name: 'Imelda Soriano',    initials: 'IS', rank: 'Fire Inspector',      status: 'offduty',    station: 'Station 2', incident: '—',            iot: 'offline', battery: 0,  phone: '+63-917-111-0014', joined: 'Nov 2020' },
]

const STATUS_TABS = ['all', 'dispatched', 'onscene', 'standby', 'offduty']
const TAB_LABELS  = { all: 'All', dispatched: 'Dispatched', onscene: 'On Scene', standby: 'Standby', offduty: 'Off Duty' }
const STATUS_AV   = { dispatched: 'av-dispatched', onscene: 'av-onscene', standby: 'av-standby', offduty: 'av-offduty' }
const STATUS_CAV  = { dispatched: 'cav-dispatched', onscene: 'cav-onscene', standby: 'cav-standby', offduty: 'cav-offduty' }
const STATUS_SP   = { dispatched: 'sp-dispatched', onscene: 'sp-onscene', standby: 'sp-standby', offduty: 'sp-offduty' }

function RankBadge({ rank }) {
  const cls = (rank.includes('Senior') || rank.includes('Inspector'))
    ? 'b-purple'
    : rank === 'Fire Officer III' ? 'b-amber'
    : rank === 'Fire Officer II'  ? 'b-blue'
    : 'b-muted'
  return <span className={`per-badge ${cls}`}>{rank}</span>
}

function StatusPill({ status }) {
  return (
    <span className={`per-status-pill ${STATUS_SP[status]}`}>
      {TAB_LABELS[status]}
    </span>
  )
}

function IotBadge({ type }) {
  if (type === 'active')  return <span className="per-iot iot-active"><span className="per-iot-dot" />IoT</span>
  if (type === 'sms')     return <span className="per-iot iot-sms"><span className="per-iot-dot" />SMS</span>
  return <span className="per-iot iot-offline"><span className="per-iot-dot" />Offline</span>
}

function BatteryBar({ pct }) {
  if (pct === 0) return <span className="per-mono-sm" style={{ color: 'var(--text-muted)' }}>—</span>
  const cls = pct >= 60 ? 'bat-high' : pct >= 30 ? 'bat-med' : 'bat-low'
  return (
    <div className="per-bat-wrap">
      <div className="per-bat-bar">
        <div className={`per-bat-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="per-bat-pct">{pct}%</span>
    </div>
  )
}

export default function PersonnelPage() {
  const [activeStatus, setActiveStatus] = useState('all')
  const [search, setSearch]             = useState('')
  const [stationFilter, setStationFilter] = useState('')
  const [rankFilter, setRankFilter]     = useState('')
  const [sortCol, setSortCol]           = useState('id')
  const [sortDir, setSortDir]           = useState(-1)
  const [selectedId, setSelectedId]     = useState(null)
  const [view, setView]                 = useState('list')
  const [showAddModal, setShowAddModal] = useState(false)

  const stats = useMemo(() => ({
    dispatched: PERSONNEL.filter(p => p.status === 'dispatched').length,
    onscene:    PERSONNEL.filter(p => p.status === 'onscene').length,
    standby:    PERSONNEL.filter(p => p.status === 'standby').length,
    offduty:    PERSONNEL.filter(p => p.status === 'offduty').length,
    iot:        PERSONNEL.filter(p => p.iot === 'active').length,
  }), [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let rows = PERSONNEL.filter(p => {
      const mq  = !q             || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.rank.toLowerCase().includes(q)
      const ms  = !stationFilter || p.station === stationFilter
      const mr  = !rankFilter    || p.rank    === rankFilter
      const mst = activeStatus === 'all' || p.status === activeStatus
      return mq && ms && mr && mst
    })

    rows.sort((a, b) => {
      let av, bv
      if (sortCol === 'id')      { av = a.id;      bv = b.id }
      if (sortCol === 'name')    { av = a.name;    bv = b.name }
      if (sortCol === 'rank')    { av = a.rank;    bv = b.rank }
      if (sortCol === 'station') { av = a.station; bv = b.station }
      if (sortCol === 'battery') { av = a.battery; bv = b.battery }
      if (av < bv) return -1 * sortDir
      if (av > bv) return  1 * sortDir
      return 0
    })

    return rows
  }, [search, stationFilter, rankFilter, activeStatus, sortCol, sortDir])

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d * -1)
    else { setSortCol(col); setSortDir(-1) }
  }

  function arrow(col) {
    if (sortCol !== col) return '↕'
    return sortDir === -1 ? '↓' : '↑'
  }

  function openDrawer(id) {
    setSelectedId(prev => prev === id ? null : id)
  }

  const selected = PERSONNEL.find(p => p.id === selectedId)

  return (
    <>
    <div className="per-page">

      {/* PAGE HEADER */}
      <div className="per-header">
        <div className="per-title-row">
          <div className="per-title">
            Personnel
            <span>↳ {PERSONNEL.length} TOTAL</span>
          </div>
          <div className="per-header-actions">
            <button className="per-btn-secondary">⬇ Export</button>
            <button className="per-btn-primary" onClick={() => setShowAddModal(true)}>+ Add Personnel</button>
          </div>
        </div>

        {/* STAT CARDS */}
        <div className="per-stat-row">
          <div className="per-stat-card fire">
            <div className="per-stat-label">Dispatched</div>
            <div className="per-stat-value">{stats.dispatched}</div>
            <div className="per-stat-sub">EN ROUTE NOW</div>
          </div>
          <div className="per-stat-card amber">
            <div className="per-stat-label">On Scene</div>
            <div className="per-stat-value">{stats.onscene}</div>
            <div className="per-stat-sub">AT INCIDENT SITE</div>
          </div>
          <div className="per-stat-card blue">
            <div className="per-stat-label">Standby</div>
            <div className="per-stat-value">{stats.standby}</div>
            <div className="per-stat-sub">READY TO DEPLOY</div>
          </div>
          <div className="per-stat-card purple">
            <div className="per-stat-label">Off Duty</div>
            <div className="per-stat-value">{stats.offduty}</div>
            <div className="per-stat-sub">NOT AVAILABLE</div>
          </div>
          <div className="per-stat-card green">
            <div className="per-stat-label">IoT Active</div>
            <div className="per-stat-value">{stats.iot}</div>
            <div className="per-stat-sub">DEVICES ONLINE</div>
          </div>
        </div>

        {/* STATUS TABS */}
        <div className="per-status-tabs">
          {STATUS_TABS.map(s => (
            <button
              key={s}
              className={`per-status-tab${activeStatus === s ? ' active' : ''}`}
              onClick={() => setActiveStatus(s)}
            >
              {TAB_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="per-toolbar">
        <div className="per-search-wrap">
          <span className="per-search-icon">⌕</span>
          <input
            type="text"
            placeholder="Search name, ID, rank..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="per-filter-select" value={stationFilter} onChange={e => setStationFilter(e.target.value)}>
          <option value="">All Stations</option>
          <option value="Station 1">Station 1</option>
          <option value="Station 2">Station 2</option>
          <option value="Station 3">Station 3</option>
        </select>
        <select className="per-filter-select" value={rankFilter} onChange={e => setRankFilter(e.target.value)}>
          <option value="">All Ranks</option>
          <option value="Fire Officer I">Fire Officer I</option>
          <option value="Fire Officer II">Fire Officer II</option>
          <option value="Fire Officer III">Fire Officer III</option>
          <option value="Senior Fire Officer">Senior Fire Officer</option>
          <option value="Fire Inspector">Fire Inspector</option>
        </select>
        <span className="per-result-count">SHOWING {filtered.length} RECORD{filtered.length !== 1 ? 'S' : ''}</span>
        <div className="per-view-toggle">
          <button
            className={`per-view-btn${view === 'list' ? ' active' : ''}`}
            onClick={() => setView('list')}
            title="List view"
          >☰</button>
          <button
            className={`per-view-btn${view === 'grid' ? ' active' : ''}`}
            onClick={() => setView('grid')}
            title="Grid view"
          >⊞</button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="per-content">

        {/* TABLE VIEW */}
        {view === 'list' && (
          <div className="per-table-wrap">
            <table className="per-table">
              <thead>
                <tr>
                  <th style={{ width: 190 }} className={sortCol === 'name' ? 'sort-active' : ''} onClick={() => handleSort('name')}>
                    Name <span className="per-sort-arrow">{arrow('name')}</span>
                  </th>
                  <th style={{ width: 110 }} className={sortCol === 'id' ? 'sort-active' : ''} onClick={() => handleSort('id')}>
                    Personnel ID <span className="per-sort-arrow">{arrow('id')}</span>
                  </th>
                  <th style={{ width: 150 }} className={sortCol === 'rank' ? 'sort-active' : ''} onClick={() => handleSort('rank')}>
                    Rank <span className="per-sort-arrow">{arrow('rank')}</span>
                  </th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 120 }} className={sortCol === 'station' ? 'sort-active' : ''} onClick={() => handleSort('station')}>
                    Station <span className="per-sort-arrow">{arrow('station')}</span>
                  </th>
                  <th style={{ width: 130 }}>Incident</th>
                  <th style={{ width: 90 }}>IoT</th>
                  <th style={{ width: 100 }} className={sortCol === 'battery' ? 'sort-active' : ''} onClick={() => handleSort('battery')}>
                    Battery <span className="per-sort-arrow">{arrow('battery')}</span>
                  </th>
                  <th style={{ width: 110 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr
                    key={p.id}
                    className={selectedId === p.id ? 'selected' : ''}
                    onClick={() => openDrawer(p.id)}
                  >
                    <td>
                      <div className="per-av-wrap">
                        <div className={`per-av ${STATUS_AV[p.status]}`}>
                          <div className="per-av-ring" />
                          {p.initials}
                        </div>
                        <div>
                          <div className="per-name-full">{p.name}</div>
                          <div className="per-name-sub">{p.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="per-mono-sm" style={{ color: 'var(--accent-blue)' }}>{p.id}</span></td>
                    <td><RankBadge rank={p.rank} /></td>
                    <td><StatusPill status={p.status} /></td>
                    <td><span className="per-mono-sm">{p.station}</span></td>
                    <td>
                      <span className="per-mono-sm" style={{ color: p.incident !== '—' ? 'var(--accent-fire)' : 'var(--text-muted)' }}>
                        {p.incident}
                      </span>
                    </td>
                    <td><IotBadge type={p.iot} /></td>
                    <td><BatteryBar pct={p.battery} /></td>
                    <td>
                      <div className="per-row-actions">
                        <button className="per-btn-view" onClick={e => { e.stopPropagation(); openDrawer(p.id) }}>View</button>
                        <button className="per-btn-map"  onClick={e => e.stopPropagation()}>Map</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="per-empty">No personnel match your filters</div>}
          </div>
        )}

        {/* GRID VIEW */}
        {view === 'grid' && (
          <div className="per-grid-wrap">
            {filtered.length === 0 ? (
              <div className="per-empty">No personnel match your filters</div>
            ) : (
              <div className="per-grid">
                {filtered.map(p => (
                  <div
                    key={p.id}
                    className={`per-card ${p.status}${selectedId === p.id ? ' selected' : ''}`}
                    onClick={() => openDrawer(p.id)}
                  >
                    <div className="per-card-top">
                      <div className={`per-card-av ${STATUS_CAV[p.status]}`}>
                        <div className="per-card-av-ring" />
                        {p.initials}
                      </div>
                      <StatusPill status={p.status} />
                    </div>
                    <div className="per-card-name">{p.name}</div>
                    <div className="per-card-rank">{p.rank}</div>
                    <div className="per-card-id">{p.id}</div>
                    <hr className="per-card-divider" />
                    <div className="per-card-row">
                      <span className="per-card-field-label">Station</span>
                      <span className="per-card-field-val">{p.station}</span>
                    </div>
                    <div className="per-card-row">
                      <span className="per-card-field-label">Incident</span>
                      <span className="per-card-field-val" style={{ color: p.incident !== '—' ? 'var(--accent-fire)' : 'var(--text-muted)' }}>
                        {p.incident}
                      </span>
                    </div>
                    <div className="per-card-bottom">
                      <IotBadge type={p.iot} />
                      {p.battery > 0 && <span className="per-card-bat-text">{p.battery}%</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* DETAIL DRAWER */}
      <div className={`per-drawer${selected ? ' open' : ''}`}>
        {selected && (
          <div className="per-drawer-inner">
            <div className="per-drawer-header">
              <div className="per-drawer-left">
                <div className={`per-drawer-av ${STATUS_CAV[selected.status]}`}>
                  <div className="per-drawer-av-ring" />
                  {selected.initials}
                </div>
                <div>
                  <div className="per-drawer-pid">{selected.id} · {selected.station}</div>
                  <div className="per-drawer-name">{selected.name}</div>
                  <div className="per-drawer-chips">
                    <RankBadge rank={selected.rank} />
                    <StatusPill status={selected.status} />
                    {selected.incident !== '—' && (
                      <span className="per-badge b-fire">{selected.incident}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="per-drawer-right">
                <button className="per-btn-close" onClick={() => setSelectedId(null)}>✕ Close</button>
                <div className="per-drawer-actions">
                  {selected.status === 'standby' && (
                    <button className="per-btn-dispatch">▶ Dispatch</button>
                  )}
                  {(selected.status === 'dispatched' || selected.status === 'onscene') && (
                    <button className="per-btn-dispatch">⬛ Recall</button>
                  )}
                  <button className="per-btn-sec">⊙ Track on Map</button>
                  <button className="per-btn-sec">✎ Edit Profile</button>
                  <button className="per-btn-sec">↻ View History</button>
                </div>
              </div>
            </div>

            <div className="per-drawer-grid">
              {[
                { label: 'Phone',     value: selected.phone,                                     mono: true },
                { label: 'Station',   value: selected.station },
                { label: 'Incident',  value: selected.incident, fire: selected.incident !== '—' },
                { label: 'IoT Device', value: null, iot: selected.iot },
                { label: 'Battery',   value: selected.battery > 0 ? `${selected.battery}%` : '—' },
                { label: 'Joined',    value: selected.joined },
                { label: 'Last Ping', value: selected.iot !== 'offline' ? '2 min ago' : '—', mono: true },
              ].map(({ label, value, mono, fire, iot }) => (
                <div key={label} className="per-drawer-field">
                  <div className="per-drawer-label">{label}</div>
                  <div
                    className="per-drawer-value"
                    style={{
                      ...(mono  ? { fontFamily: 'var(--font-mono)', fontSize: 11 } : {}),
                      ...(fire  ? { color: 'var(--accent-fire)' } : {}),
                    }}
                  >
                    {iot ? <IotBadge type={iot} /> : value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>

    {showAddModal && (
      <AddPersonnelModal
        onClose={() => setShowAddModal(false)}
        onSubmit={data => {
          console.log('New personnel:', data)
          setShowAddModal(false)
        }}
      />
    )}
    </>
  )
}
