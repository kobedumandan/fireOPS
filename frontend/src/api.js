const BASE_URL = 'http://localhost:8000'

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('bfp_token')

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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
