import { useState, useEffect, useRef } from 'react'
import AppModal from './AppModal'
import { fetchStations, fetchPersonnel, fetchShifts, fetchTrucks, fetchTeams, updateTeam, addTeamMember, updateTeamMember, removeTeamMember } from '../api'

const STATUSES = ['standby', 'dispatched', 'inactive']
const MEMBER_ROLES = ['Team Leader', 'Firefighter', 'Driver', 'Medical Officer', 'Communications Officer']

export default function EditTeamModal({ team, onClose, onSubmit }) {
  const [form, setForm] = useState({
    team_name:   team.team_name   || '',
    team_code:   team.team_code   || '',
    team_status: team.team_status === 'active' ? 'dispatched' : (team.team_status || 'standby'),
    station_id:  team.station_id  || '',
    shift_id:    team.shift_id    || '',
    truck_id:    team.truck_id    || '',
  })
  const [stations, setStations]         = useState([])
  const [shifts, setShifts]             = useState([])
  const [trucks, setTrucks]             = useState([])
  const [teams, setTeams]               = useState([])
  const [allPersonnel, setAllPersonnel] = useState([])
  // members: [{ per_id, name, initials, rank, member_role, isNew }]
  const [members, setMembers]           = useState(
    (team.members || []).map(m => ({ ...m, isNew: false }))
  )
  const initialMembersRef               = useRef(
    (team.members || []).map(m => ({ per_id: m.per_id, member_role: m.member_role || '' }))
  )
  const [addSelect, setAddSelect]       = useState('')
  const [addRole, setAddRole]           = useState('')
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)

  useEffect(() => {
    fetchStations().then(setStations).catch(() => {})
    fetchShifts().then(setShifts).catch(() => {})
    fetchTrucks().then(setTrucks).catch(() => {})
    fetchTeams().then(setTeams).catch(() => {})
    fetchPersonnel().then(setAllPersonnel).catch(() => {})
  }, [])

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }))
    setError('')
  }

  // Changing the station invalidates a truck picked from the old station, so
  // clear the truck selection whenever the station changes.
  function setStation(val) {
    setForm(f => ({ ...f, station_id: val, truck_id: '' }))
    setError('')
  }

  function setMemberRole(perId, role) {
    setMembers(prev => prev.map(m => m.per_id === perId ? { ...m, member_role: role } : m))
  }

  function addMember() {
    const p = allPersonnel.find(p => p.per_id === Number(addSelect))
    if (!p) return
    setMembers(prev => [...prev, {
      per_id:      p.per_id,
      name:        p.name,
      initials:    p.initials,
      rank:        p.rank,
      member_role: addRole,
      isNew:       true,
    }])
    setAddSelect('')
    setAddRole('')
  }

  function removeMember(perId) {
    setMembers(prev => prev.filter(m => m.per_id !== perId))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.team_name.trim()) { setError('Team name is required.'); return }

    setLoading(true)
    try {
      const initialMap = new Map(initialMembersRef.current.map(m => [m.per_id, m.member_role]))
      const currentIds = new Set(members.map(m => m.per_id))
      const toRemove   = [...initialMap.keys()].filter(id => !currentIds.has(id))
      const toAdd      = members.filter(m => !initialMap.has(m.per_id))
      const toUpdate   = members.filter(m => initialMap.has(m.per_id) && initialMap.get(m.per_id) !== (m.member_role || ''))

      // Remove members first: the backend rejects a shift change while the team
      // still has members, so removals must land before updateTeam runs.
      await Promise.all(toRemove.map(id => removeTeamMember(team.team_id, id)))

      const updated = await updateTeam(team.team_id, {
        team_name:   form.team_name.trim(),
        team_code:   form.team_code.trim() || null,
        team_status: form.team_status,
        station_id:  form.station_id ? Number(form.station_id) : null,
        shift_id:    form.shift_id   ? Number(form.shift_id)   : null,
        truck_id:    form.truck_id   ? Number(form.truck_id)   : null,
      })

      // Add/update after the shift change so new members validate against the
      // team's new shift.
      await Promise.all([
        ...toAdd.map(m => addTeamMember(team.team_id, { per_id: m.per_id, member_role: m.member_role || null })),
        ...toUpdate.map(m => updateTeamMember(team.team_id, m.per_id, { member_role: m.member_role || null })),
      ])

      setLoading(false)
      onSubmit({ ...updated, member_count: members.length, members })
    } catch (err) {
      setLoading(false)
      setError(err.message)
    }
  }

  const teamShiftId = form.shift_id ? Number(form.shift_id) : null
  const stationId   = form.station_id ? Number(form.station_id) : null
  // Trucks already taken by another team on this team's shift — a truck can be
  // shared across shifts but not by two teams in the same shift.
  const takenTruckIds = new Set(
    teams
      .filter(t =>
        t.team_id !== team.team_id &&
        t.truck_id != null &&
        teamShiftId !== null &&
        t.shift_id === teamShiftId
      )
      .map(t => t.truck_id)
  )
  // Only trucks at the team's station, and not taken by a same-shift team.
  const stationTrucks = trucks.filter(t =>
    stationId !== null &&
    t.station_id === stationId &&
    !takenTruckIds.has(t.truck_id)
  )
  const shiftLocked = members.length > 0
  const available = allPersonnel.filter(p => {
    if (members.some(m => m.per_id === p.per_id)) return false
    // Hide personnel already assigned to a different team.
    if (p.team_id != null && p.team_id !== team.team_id) return false
    if (teamShiftId !== null && p.shift_id !== teamShiftId) return false
    return true
  })

  return (
    <AppModal eyebrow="TEAM MANAGEMENT" title="Edit Team" onClose={onClose} width={520}>
      <form onSubmit={handleSubmit}>
        <div className="apm-scroll">
          <div className="apm-body">

            <div className="apm-section-label">Team Information</div>

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
                <label>
                  Shift
                  {shiftLocked && (
                    <span className='etm-instructions'>
                      remove members to change
                    </span>
                  )}
                </label>
                <select
                  value={form.shift_id}
                  onChange={e => set('shift_id', e.target.value)}
                  disabled={shiftLocked || loading}
                >
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
                <select value={form.station_id} onChange={e => setStation(e.target.value)} disabled={loading}>
                  <option value="">Select station...</option>
                  {stations.map(s => (
                    <option key={s.station_id} value={s.station_id}>{s.station_name}</option>
                  ))}
                </select>
              </div>
              <div className="apm-field">
                <label>Assigned Truck</label>
                <select
                  value={form.truck_id}
                  onChange={e => set('truck_id', e.target.value)}
                  disabled={loading || stationId === null}
                >
                  <option value="">
                    {stationId === null
                      ? 'Select a station first'
                      : stationTrucks.length === 0
                        ? 'No available trucks at this station'
                        : 'No truck assigned'}
                  </option>
                  {stationTrucks.map(t => (
                    <option key={t.truck_id} value={t.truck_id}>
                      {t.truck_platenum}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="apm-section-label">Members</div>

            <div className="etm-members-list">
              {members.length === 0 && (
                <div className="etm-members-empty">No members assigned</div>
              )}
              {members.map(m => (
                <div key={m.per_id} className="etm-member-row">
                  <div className="etm-member-av">{m.initials}</div>
                  <div className="etm-member-info">
                    <div className="etm-member-name">{m.name}</div>
                    <div className="etm-member-rank">{m.rank !== '—' ? m.rank : ''}</div>
                  </div>
                  <select
                    className="etm-member-role-select"
                    value={m.member_role || ''}
                    onChange={e => setMemberRole(m.per_id, e.target.value)}
                    disabled={loading}
                  >
                    <option value="">No role</option>
                    {MEMBER_ROLES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="etm-member-rm"
                    onClick={() => removeMember(m.per_id)}
                    disabled={loading}
                  >✕</button>
                </div>
              ))}
            </div>

            {teamShiftId !== null && available.length === 0 && members.length === 0 && (
              <div className="apm-info" style={{ marginBottom: 8 }}>
                No available personnel on this team's shift.
              </div>
            )}

            <div className="etm-add-row">
              <select
                className="etm-add-select"
                value={addSelect}
                onChange={e => setAddSelect(e.target.value)}
                disabled={loading}
              >
                <option value="">Select personnel{teamShiftId !== null ? ' (shift-matched)' : ''}...</option>
                {available.map(p => (
                  <option key={p.per_id} value={p.per_id}>
                    {p.name}{p.rank && p.rank !== '—' ? ` · ${p.rank}` : ''}
                  </option>
                ))}
              </select>
              <select
                className="etm-add-role-select"
                value={addRole}
                onChange={e => setAddRole(e.target.value)}
                disabled={!addSelect || loading}
              >
                <option value="">No role</option>
                {MEMBER_ROLES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button
                type="button"
                className="etm-add-btn"
                onClick={addMember}
                disabled={!addSelect || loading}
              >Add</button>
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
