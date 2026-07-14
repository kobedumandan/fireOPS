const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('bfp_token')

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': '1',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 401 && path !== '/api/auth/login') {
    localStorage.removeItem('bfp_token')
    localStorage.removeItem('bfp_user')
    window.location.reload()
  }

  return res
}

// ── Simple in-memory cache ────────────────────────────────────────────────────
const _cache = {}
const CACHE_TTL_MS = 2 * 60 * 1000  // 2 minutes

function _cacheGet(key) {
  const entry = _cache[key]
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) { delete _cache[key]; return null }
  return entry.data
}

function _cacheSet(key, data) {
  _cache[key] = { data, ts: Date.now() }
}

// ── Personnel ─────────────────────────────────────────────────────────────────
export async function fetchHeatmap() {
  const cached = _cacheGet('heatmap')
  if (cached) return cached

  const res = await apiFetch('/api/heatmap')
  if (!res.ok) throw new Error(`Failed to fetch heatmap data (${res.status})`)
  const data = await res.json()
  _cacheSet('heatmap', data)
  return data
}

export async function fetchPersonnel() {
  const cached = _cacheGet('personnel')
  if (cached) return cached

  const res = await apiFetch('/api/personnel')
  if (!res.ok) throw new Error(`Failed to fetch personnel (${res.status})`)
  const data = await res.json()
  _cacheSet('personnel', data)
  return data
}

// ── Barangay boundaries (Panabo) ─────────────────────────────────────────────
export async function fetchBarangays() {
  const cached = _cacheGet('barangays')
  if (cached) return cached

  const res = await apiFetch('/api/barangays')
  if (!res.ok) throw new Error(`Failed to fetch barangays (${res.status})`)
  const data = await res.json()
  _cacheSet('barangays', data)
  return data
}

// ── Stations ──────────────────────────────────────────────────────────────────
export async function fetchStations() {
  const cached = _cacheGet('stations')
  if (cached) return cached

  const res = await apiFetch('/api/stations')
  if (!res.ok) throw new Error(`Failed to fetch stations (${res.status})`)
  const data = await res.json()
  _cacheSet('stations', data)
  return data
}

export async function createPersonnel(body) {
  const res = await apiFetch('/api/personnel', { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to create personnel (${res.status})`)
  }
  delete _cache['personnel']
  return res.json()
}

export async function updatePersonnel(perId, body) {
  const res = await apiFetch(`/api/personnel/${perId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to update personnel (${res.status})`)
  }
  delete _cache['personnel']
  return res.json()
}

export async function deletePersonnel(perId) {
  const res = await apiFetch(`/api/personnel/${perId}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to delete personnel (${res.status})`)
  }
  delete _cache['personnel']
}

export async function updateStation(stationId, body) {
  const res = await apiFetch(`/api/stations/${stationId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to update station (${res.status})`)
  }
  delete _cache['stations']
  return res.json()
}

// ── Shifts ────────────────────────────────────────────────────────────────────
export async function fetchShifts() {
  const cached = _cacheGet('shifts')
  if (cached) return cached

  const res = await apiFetch('/api/shifts')
  if (!res.ok) throw new Error(`Failed to fetch shifts (${res.status})`)
  const data = await res.json()
  _cacheSet('shifts', data)
  return data
}

// ── Teams ─────────────────────────────────────────────────────────────────────
export async function fetchTeams() {
  const cached = _cacheGet('teams')
  if (cached) return cached

  const res = await apiFetch('/api/teams')
  if (!res.ok) throw new Error(`Failed to fetch teams (${res.status})`)
  const data = await res.json()
  _cacheSet('teams', data)
  return data
}

export async function createTeam(body) {
  const res = await apiFetch('/api/teams', { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to create team (${res.status})`)
  }
  delete _cache['teams']
  return res.json()
}

export async function updateTeam(teamId, body) {
  const res = await apiFetch(`/api/teams/${teamId}`, { method: 'PATCH', body: JSON.stringify(body) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to update team (${res.status})`)
  }
  delete _cache['teams']
  return res.json()
}

export async function deleteTeam(teamId) {
  const res = await apiFetch(`/api/teams/${teamId}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to delete team (${res.status})`)
  }
  delete _cache['teams']
}

export async function addTeamMember(teamId, body) {
  const res = await apiFetch(`/api/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to add member (${res.status})`)
  }
  delete _cache['teams']
  delete _cache['personnel']
  return res.json()
}

export async function updateTeamMember(teamId, perId, body) {
  const res = await apiFetch(`/api/teams/${teamId}/members/${perId}`, { method: 'PATCH', body: JSON.stringify(body) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to update member (${res.status})`)
  }
  delete _cache['teams']
  return res.json()
}

export async function removeTeamMember(teamId, perId) {
  const res = await apiFetch(`/api/teams/${teamId}/members/${perId}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to remove member (${res.status})`)
  }
  delete _cache['teams']
  delete _cache['personnel']
}

// ── Incidents ─────────────────────────────────────────────────────────────────
export async function fetchActiveIncidents() {
  const res = await apiFetch('/api/incidents/active')
  if (!res.ok) throw new Error(`Failed to fetch active incidents (${res.status})`)
  return res.json()
}

export async function fetchIncidents({ page = 1, pageSize = 15, period, status, search, sev, alarm, sortCol, sortDir } = {}) {
  const params = new URLSearchParams()
  if (page)     params.set('page',      page)
  if (pageSize) params.set('page_size', pageSize)
  if (period && period !== 'all') params.set('period', period)
  if (status && status !== 'all') params.set('status', status)
  if (search)   params.set('search',   search)
  if (sev)      params.set('sev',      sev)
  if (alarm)    params.set('alarm',    alarm)
  if (sortCol)  params.set('sort_col', sortCol)
  if (sortDir)  params.set('sort_dir', sortDir === -1 ? 'desc' : 'asc')

  const res = await apiFetch(`/api/incidents?${params}`)
  if (!res.ok) throw new Error(`Failed to fetch incidents (${res.status})`)
  return res.json()
}

export async function createIncident(body) {
  const res = await apiFetch('/api/incidents', { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to create incident (${res.status})`)
  }
  return res.json()
}

export async function updateIncident(fireId, body) {
  const res = await apiFetch(`/api/incidents/${fireId}`, { method: 'PATCH', body: JSON.stringify(body) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to update incident (${res.status})`)
  }
  return res.json()
}

export async function deleteIncident(fireId) {
  const res = await apiFetch(`/api/incidents/${fireId}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to delete incident (${res.status})`)
  }
}

// The after-action report filed for a closed incident (with photo URLs).
// Returns null when no report has been filed yet.
export async function fetchIncidentReport(fireId) {
  const res = await apiFetch(`/api/incidents/${fireId}/report`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to fetch incident report (${res.status})`)
  }
  const data = await res.json()
  const report = data.report
  // Photo URLs come back pointing at PUBLIC_BASE_URL (the ngrok tunnel, for the
  // mobile app). The dashboard can't pass ngrok's skip-warning header on a plain
  // <img>, so rewrite each URL onto our own BASE_URL — same /uploads/... path,
  // served directly with no interstitial.
  if (report?.photos?.length) {
    report.photos = report.photos.map((url) => {
      try {
        return `${BASE_URL}${new URL(url).pathname}`
      } catch {
        return url
      }
    })
  }
  return report
}

// ── Dispatch ──────────────────────────────────────────────────────────────────
export async function fetchDispatches() {
  const res = await apiFetch('/api/dispatch')
  if (!res.ok) throw new Error(`Failed to fetch dispatches (${res.status})`)
  return res.json()
}

export async function fetchIncidentRoutes(fireId) {
  const res = await apiFetch(`/api/incidents/${fireId}/routes`)
  if (!res.ok) throw new Error(`Failed to fetch routes (${res.status})`)
  return res.json()
}

export async function selectRoute(dispatchId, routeId) {
  const res = await apiFetch(`/api/dispatch/${dispatchId}/select-route`, {
    method: 'PATCH',
    body: JSON.stringify({ route_id: routeId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to select route (${res.status})`)
  }
  return res.json()
}

export async function createDispatch(body) {
  const res = await apiFetch('/api/dispatch', { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to create dispatch (${res.status})`)
  }
  return res.json()
}

export async function fetchPersonnelLocations() {
  const res = await apiFetch('/api/personnel/locations')
  if (!res.ok) throw new Error(`Failed to fetch personnel locations (${res.status})`)
  return res.json()
}

export async function fullReroute(dispatchId) {
  const res = await apiFetch(`/api/dispatch/${dispatchId}/full-reroute`, { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Full reroute failed (${res.status})`)
  }
  return res.json()
}

// ── Road Obstructions ────────────────────────────────────────────────────────
export async function fetchObstructions() {
  const res = await apiFetch('/api/obstructions')
  if (!res.ok) throw new Error(`Failed to fetch obstructions (${res.status})`)
  return res.json()
}

export async function createObstruction(body) {
  const res = await apiFetch('/api/obstructions', { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to create obstruction (${res.status})`)
  }
  return res.json()
}

// ── GNN Constraints ─────────────────────────────────────────────────────────
export async function fetchGnnConstraints() {
  const cached = _cacheGet('gnn-constraints')
  if (cached) return cached

  const res = await apiFetch('/api/routing/gnn-constraints')
  if (!res.ok) throw new Error(`Failed to fetch GNN constraints (${res.status})`)
  const data = await res.json()
  _cacheSet('gnn-constraints', data)
  return data
}

// ── Response Coverage (reachability isochrones) ─────────────────────────────
export async function fetchCoverageIsochrones() {
  const cached = _cacheGet('coverage-isochrones')
  if (cached) return cached

  const res = await apiFetch('/api/coverage/isochrones')
  if (!res.ok) throw new Error(`Failed to fetch coverage isochrones (${res.status})`)
  const data = await res.json()
  _cacheSet('coverage-isochrones', data)
  return data
}

export async function fetchCoverageGaps(minutes = 5) {
  const key = `coverage-gaps-${minutes}`
  const cached = _cacheGet(key)
  if (cached) return cached

  const res = await apiFetch(`/api/coverage/gaps?minutes=${minutes}`)
  if (!res.ok) throw new Error(`Failed to fetch coverage gaps (${res.status})`)
  const data = await res.json()
  _cacheSet(key, data)
  return data
}

export async function deleteObstruction(id) {
  const res = await apiFetch(`/api/obstructions/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to delete obstruction (${res.status})`)
  }
}

// ── Reporter location requests ──────────────────────────────────────────────
export async function fetchReporterSessions() {
  const res = await apiFetch('/api/report-sessions')
  if (!res.ok) throw new Error(`Failed to fetch reporter sessions (${res.status})`)
  return res.json()
}

export async function sendReporterSms(token, phoneNumber) {
  const res = await apiFetch(`/api/report-sessions/${token}/send-sms`, {
    method: 'POST',
    body: JSON.stringify({ phone_number: phoneNumber }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to send SMS (${res.status})`)
  }
  return res.json()
}

// ── Custom GNN Constraints ──────────────────────────────────────────────────
export async function fetchConstraints() {
  const res = await apiFetch('/api/constraints')
  if (!res.ok) throw new Error(`Failed to fetch constraints (${res.status})`)
  return res.json()
}

export async function createConstraint(body) {
  const res = await apiFetch('/api/constraints', { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to create constraint (${res.status})`)
  }
  delete _cache['gnn-constraints']
  return res.json()
}

export async function updateConstraint(id, body) {
  const res = await apiFetch(`/api/constraints/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to update constraint (${res.status})`)
  }
  delete _cache['gnn-constraints']
  return res.json()
}

export async function deleteConstraint(id) {
  const res = await apiFetch(`/api/constraints/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to delete constraint (${res.status})`)
  }
  delete _cache['gnn-constraints']
}

// ── Trucks ───────────────────────────────────────────────────────────────────
export async function fetchTrucks() {
  const cached = _cacheGet('trucks')
  if (cached) return cached

  const res = await apiFetch('/api/trucks')
  if (!res.ok) throw new Error(`Failed to fetch trucks (${res.status})`)
  const data = await res.json()
  _cacheSet('trucks', data)
  return data
}

export async function createTruck(body) {
  const res = await apiFetch('/api/trucks', { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to create truck (${res.status})`)
  }
  delete _cache['trucks']
  return res.json()
}

export async function updateTruck(truckId, body) {
  const res = await apiFetch(`/api/trucks/${truckId}`, { method: 'PATCH', body: JSON.stringify(body) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to update truck (${res.status})`)
  }
  delete _cache['trucks']
  return res.json()
}

export async function deleteTruck(truckId) {
  const res = await apiFetch(`/api/trucks/${truckId}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to delete truck (${res.status})`)
  }
  delete _cache['trucks']
}

export async function createStation(body) {
  const res = await apiFetch('/api/stations', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to create station (${res.status})`)
  }
  delete _cache['stations']   // invalidate so next fetch hits the DB
  return res.json()
}

export async function deleteStation(stationId) {
  const res = await apiFetch(`/api/stations/${stationId}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to delete station (${res.status})`)
  }
  delete _cache['stations']
}
