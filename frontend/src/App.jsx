import { useState, useEffect, useRef } from 'react'
import TopBar from './components/TopBar'
import LeftSidebar from './components/LeftSidebar'
import MapArea from './components/MapArea'
import MapActions from './components/MapActions'
import RightSidebar from './components/RightSidebar'
import StatusBar from './components/StatusBar'
import IncidentsPage from './components/IncidentsPage'
import PersonnelPage from './components/PersonnelPage'
import NewIncidentModal from './components/NewIncidentModal'
import AutoDispatchModal from './components/AutoDispatchModal'
import LocationRequestModal from './components/LocationRequestModal'
import ReporterPage from './components/ReporterPage'
import StationsPage from './components/StationsPage'
import TeamsPage from './components/TeamsPage'
import TrucksPage from './components/TrucksPage'
import MetricsPage from './components/MetricsPage'
import PlanningPage from './components/PlanningPage'
import SettingsPage from './components/SettingsPage'
import LoginPage from './components/LoginPage'
import { fetchActiveIncidents, fetchPersonnel, fetchStations, fetchDispatches, selectRoute, fetchPersonnelLocations, fullReroute, createIncident, fetchReporterSessions } from './api'
import './App.css'

const ACTIVE_STATUSES = new Set(['pending', 'active', 'dispatched', 'contained'])
// Dispatch statuses whose routes are still relevant on the map. A closed
// incident's dispatch is "completed", so its routes are excluded on (re)load.
const ACTIVE_DISPATCH_STATUSES = new Set(['dispatched', 'en_route', 'on_scene'])
const WS_URL = 'ws://localhost:8000/ws'

function getInitialRoute() {
  const hash = window.location.hash
  if (hash.startsWith('#/report/')) {
    return { view: 'reporter', token: hash.slice('#/report/'.length) }
  }
  const token = localStorage.getItem('bfp_token')
  const user  = localStorage.getItem('bfp_user')
  if (token && user) {
    return { view: 'dashboard', user: JSON.parse(user) }
  }
  return { view: 'login' }
}

export default function App() {
  const [route, setRoute] = useState(getInitialRoute)

  // ── Dashboard-only state ───────────────────────────────────────────────────
  const [activeNav, setActiveNav]                 = useState('Command')
  const [showSettings, setShowSettings]           = useState(false)
  const [selectedIncident, setSelectedIncident]   = useState(null)
  const [theme, setTheme]                         = useState('dark')
  const [leftCollapsed, setLeftCollapsed]         = useState(false)
  // Start collapsed; the Incident View only auto-opens once there's an active
  // incident to show (see the effect below).
  const [rightCollapsed, setRightCollapsed]       = useState(true)
  const [viewMode, setViewMode]                   = useState("normal")
  const [pickingMode, setPickingMode]             = useState(false)
  const [pickedLocation, setPickedLocation]       = useState(null)
  const [incidentDefaults, setIncidentDefaults]   = useState(null) // prefill for NewIncidentModal
  const [autoDispatchResult, setAutoDispatchResult] = useState(null) // incident dict for AutoDispatchModal
  const [loggedIncidents, setLoggedIncidents]     = useState([])
  const [ripplingId, setRipplingId]               = useState(null)
  const [incidentFocusNonce, setIncidentFocusNonce] = useState(0)
  const [focusedPersonnel, setFocusedPersonnel]   = useState(null) // { per_id, nonce }
  const [showLocationRequest, setShowLocationRequest] = useState(false)
  const [reporterLocations, setReporterLocations] = useState([])
  const [activeIncidents, setActiveIncidents]     = useState([])
  const [loadingIncidents, setLoadingIncidents]   = useState(true)
  const [loadingPersonnel, setLoadingPersonnel]   = useState(true)
  const [personnel, setPersonnel]               = useState([])
  const [stations, setStations]                 = useState([])
  const [dispatchRoutes, setDispatchRoutes]           = useState([])
  const [dispatches, setDispatches]                   = useState([])
  const [livePersonnelLocations, setLivePersonnelLocations] = useState([])
  const [pendingReporterToken, setPendingReporterToken] = useState(null)
  const [reporterReceivedData, setReporterReceivedData] = useState(null)
  const wsRef                  = useRef(null)
  const wsDestroyRef           = useRef(false)
  const pendingReporterTokenRef = useRef(null)

  // Keep ref in sync so the WS onmessage handler never reads a stale value
  useEffect(() => { pendingReporterTokenRef.current = pendingReporterToken }, [pendingReporterToken])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') cancelPicking() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Auto-select the first incident when the list loads or changes
  useEffect(() => {
    const all = [...activeIncidents, ...loggedIncidents]
    if (all.length === 0) return
    setSelectedIncident(prev => {
      const stillExists = all.some(i => i.id === prev || i.fire_id === prev)
      return stillExists ? prev : (all[0].id || all[0].fire_id)
    })
  }, [activeIncidents, loggedIncidents])

  // Auto-open the Incident View when active incidents exist, and auto-collapse
  // it when there are none — but only on that transition, so a manual collapse/
  // expand during the same has/has-not state is preserved.
  const hadActiveIncidentsRef = useRef(null)
  useEffect(() => {
    const hasActive = activeIncidents.length > 0
    if (hadActiveIncidentsRef.current === hasActive) return
    hadActiveIncidentsRef.current = hasActive
    setRightCollapsed(!hasActive)
  }, [activeIncidents])

  // ── Initial dashboard data load (runs once on login) ─────────────────────
  useEffect(() => {
    if (route.view !== 'dashboard') return

    setLoadingIncidents(true)
    setLoadingPersonnel(true)

    fetchActiveIncidents()
      .then(data => { setActiveIncidents(data.filter(i => ACTIVE_STATUSES.has(i.status))); setLoadingIncidents(false) })
      .catch(() => { setLoadingIncidents(false) })

    fetchPersonnel()
      .then(data => { setPersonnel(data); setLoadingPersonnel(false) })
      .catch(() => { setLoadingPersonnel(false) })
    fetchStations().then(setStations).catch(() => {})

    // Rehydrate reporter pins (WS only pushes new events, so a reload would
    // otherwise lose already-received locations).
    fetchReporterSessions()
      .then(sessions => setReporterLocations(
        sessions.map(s => ({ token: s.token, coords: s.coords, mobile: s.phone || '' }))
      ))
      .catch(() => {})

    fetchDispatches().then(rows => {
      setDispatches(rows)
      const routes = rows.flatMap(r => {
        // Skip completed/cancelled dispatches (e.g. closed incidents) so their
        // routes don't reappear on the map after a page reload.
        if (!ACTIVE_DISPATCH_STATUSES.has(r.dispatch_status)) return []
        if (r.routes && r.routes.length > 0) {
          return r.routes.flatMap(rt => {
            const match = rt.route_wkt?.match(/LINESTRING\s*\(([^)]+)\)/)
            if (!match) return []
            const positions = match[1].split(',').map(pair => {
              const [lon, lat] = pair.trim().split(' ').map(Number)
              return [lat, lon]
            })
            return [{
              id: `${r.dispatch_id}_${rt.route_id}`,
              route_id: rt.route_id,
              dispatch_id: r.dispatch_id,
              fire_id: r.fire_id,
              positions,
              teamName: r.team_name,
              isGnn: true,
              isSelected: rt.is_selected,
              rank: rt.rank,
              routeType: rt.route_type,
              etaMinutes: rt.eta_minutes,
              distanceKm: rt.distance_meters != null ? rt.distance_meters / 1000 : null,
            }]
          })
        }
        if (r.station_latitude && r.station_longitude && r.incident_latitude && r.incident_longitude) {
          return [{
            id: `${r.dispatch_id}_fallback`,
            route_id: null,
            dispatch_id: r.dispatch_id,
            fire_id: r.fire_id,
            positions: [
              [r.station_latitude, r.station_longitude],
              [r.incident_latitude, r.incident_longitude],
            ],
            teamName: r.team_name,
            isGnn: false,
            isSelected: true,
            rank: 1,
            routeType: 'fallback',
            etaMinutes: null,
          }]
        }
        return []
      })
      setDispatchRoutes(routes)
    }).catch(() => {})
  }, [route.view]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persistent WebSocket — connects on login, closes only on logout ───────
  useEffect(() => {
    if (route.view !== 'dashboard') return

    const token = localStorage.getItem('bfp_token')
    wsDestroyRef.current = false
    let pingId = null

    function connect() {
      if (wsDestroyRef.current) return
      const ws = new WebSocket(`${WS_URL}?token=${token}`)
      wsRef.current = ws

      ws.onopen = () => {
        pingId = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send('ping')
        }, 30_000)
      }

      ws.onmessage = e => {
        if (e.data === 'pong') return
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'incident_created') {
            const inc = msg.data
            if (ACTIVE_STATUSES.has(inc.status)) {
              setActiveIncidents(prev => [inc, ...prev])
            }
          } else if (msg.type === 'incident_updated') {
            const inc = msg.data
            setActiveIncidents(prev => {
              const rest = prev.filter(i => i.fire_id !== inc.fire_id)
              return ACTIVE_STATUSES.has(inc.status) ? [inc, ...rest] : rest
            })
            // Once an incident leaves the active set (e.g. closed), drop its
            // dispatch routes too — otherwise the route lines linger on the map
            // after the incident pin is gone.
            if (!ACTIVE_STATUSES.has(inc.status)) {
              setDispatchRoutes(prev => prev.filter(r => r.fire_id !== inc.fire_id))
            }
          } else if (msg.type === 'reporter_location') {
            const { token: t, lat, lng, phone } = msg.data
            handleReporterLocationReceived({ token: t, coords: [lat, lng], mobile: phone || '' })
            if (t === pendingReporterTokenRef.current) {
              setReporterReceivedData(msg.data)
            }
          } else if (msg.type === 'reporter_cleared') {
            const { token: t } = msg.data
            setReporterLocations(prev => prev.filter(r => r.token !== t))
          } else if (msg.type === 'personnel_location') {
            const row = msg.data
            setLivePersonnelLocations(prev => {
              const idx = prev.findIndex(p => p.per_id === row.per_id)
              if (idx === -1) return [...prev, row]
              const next = prev.slice()
              next[idx] = row
              return next
            })
          } else if (msg.type === 'dispatch_rerouted') {
            const { dispatch_id, fire_id, routes = [] } = msg.data
            setDispatchRoutes(prev => {
              const kept = prev.filter(r => r.dispatch_id !== dispatch_id)
              const teamName = prev.find(p => p.dispatch_id === dispatch_id)?.teamName ?? ''
              const replacements = routes.flatMap(r => {
                const positions = _parseWkt(r.route_wkt)
                if (!positions) return []
                return [{
                  id: `${dispatch_id}_${r.route_id}`,
                  route_id: r.route_id,
                  dispatch_id,
                  fire_id,
                  positions,
                  teamName,
                  isGnn: true,
                  isSelected: r.is_selected,
                  rank: r.rank,
                  routeType: r.route_type,
                  etaMinutes: r.eta_minutes,
                  distanceKm: r.distance_meters != null ? r.distance_meters / 1000 : null,
                }]
              })
              return [...kept, ...replacements]
            })
          }
        } catch {}
      }

      ws.onclose = () => {
        clearInterval(pingId)
        if (!wsDestroyRef.current) setTimeout(connect, 3_000)
      }

      ws.onerror = () => ws.close()
    }

    connect()

    // Cleanup only runs when route.view leaves 'dashboard' (i.e. logout)
    // — navigating between inner pages (activeNav) never triggers this
    return () => {
      wsDestroyRef.current = true
      clearInterval(pingId)
      wsRef.current?.close()
    }
  }, [route.view]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 10-second live-location poll (TODO: replace with WebSocket push when scaling requires it) ──
  useEffect(() => {
    if (route.view !== 'dashboard') return
    let cancelled = false

    async function poll() {
      try {
        const rows = await fetchPersonnelLocations()
        if (!cancelled) setLivePersonnelLocations(rows)
      } catch { /* non-fatal */ }
    }

    poll()
    const id = setInterval(poll, 10_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [route.view]) // eslint-disable-line react-hooks/exhaustive-deps

  function _parseWkt(wkt) {
    if (!wkt) return null
    const match = wkt.match(/LINESTRING\s*\(([^)]+)\)/)
    if (!match) return null
    return match[1].split(',').map(pair => {
      const [lon, lat] = pair.trim().split(' ').map(Number)
      return [lat, lon]
    })
  }

  function handleDispatched({ team, dispatchId, routes }) {
    const fireId = selectedInc?.fire_id ?? null
    const teamName = team.team_name
    setDispatches(prev => [...prev, {
      dispatch_id:     dispatchId,
      fire_id:         fireId,
      team_id:         team.team_id,
      team_name:       teamName,
      team_code:       team.team_code,
      dispatch_status: 'dispatched',
      dispatch_at:     new Date().toISOString(),
      station_name:    team.station_name,
      members:         team.members || [],
    }])

    if (routes && routes.length > 0) {
      // GNN routes — add all variants
      const newRoutes = routes.flatMap(r => {
        const positions = _parseWkt(r.route_wkt)
        if (!positions) return []
        return [{
          id: `${dispatchId}_${r.route_id}`,
          route_id: r.route_id,
          dispatch_id: dispatchId,
          fire_id: fireId,
          positions,
          teamName,
          isGnn: true,
          isSelected: r.is_selected,
          rank: r.rank,
          routeType: r.route_type,
          etaMinutes: r.eta_minutes,
          distanceKm: r.distance_meters != null ? r.distance_meters / 1000 : null,
        }]
      })
      setDispatchRoutes(prev => [...prev, ...newRoutes])
    } else if (team.station_latitude && team.station_longitude && selectedInc) {
      // Fallback straight-line
      setDispatchRoutes(prev => [...prev, {
        id: `${dispatchId}_fallback`,
        route_id: null,
        dispatch_id: dispatchId,
        fire_id: fireId,
        positions: [
          [team.station_latitude, team.station_longitude],
          [selectedInc.latitude, selectedInc.longitude],
        ],
        teamName,
        isGnn: false,
        isSelected: true,
        rank: 1,
        routeType: 'fallback',
        etaMinutes: null,
      }])
    }
  }

  function handleSelectRoute(dispatchId, routeId) {
    selectRoute(dispatchId, routeId).then(() => {
      setDispatchRoutes(prev => prev.map(r => {
        if (r.dispatch_id !== dispatchId) return r
        return { ...r, isSelected: r.route_id === routeId }
      }))
    }).catch(console.error)
  }

  function handleFullReroute(dispatchId) {
    fullReroute(dispatchId).then(result => {
      // Replace all routes for this dispatch with the newly computed ones
      setDispatchRoutes(prev => {
        const kept = prev.filter(r => r.dispatch_id !== dispatchId)
        const newRoutes = (result.routes ?? []).flatMap(r => {
          const positions = _parseWkt(r.route_wkt)
          if (!positions) return []
          const fireId = prev.find(p => p.dispatch_id === dispatchId)?.fire_id ?? null
          return [{
            id: `${dispatchId}_${r.route_id}`,
            route_id: r.route_id,
            dispatch_id: dispatchId,
            fire_id: fireId,
            positions,
            teamName: prev.find(p => p.dispatch_id === dispatchId)?.teamName ?? '',
            isGnn: true,
            isSelected: r.is_selected,
            rank: r.rank,
            routeType: r.route_type,
            etaMinutes: r.eta_minutes,
            distanceKm: null,
          }]
        })
        return [...kept, ...newRoutes]
      })
    }).catch(console.error)
  }

  function handleSelectIncident(id) {
    setSelectedIncident(id)
    setRightCollapsed(false)
    setIncidentFocusNonce(n => n + 1)
    const inc = activeIncidents.find(i => i.id === id)
    if (inc) {
      setRipplingId(inc.fire_id)
      setTimeout(() => setRipplingId(null), 950)
    }
  }

  function toggleTheme() { setTheme(t => t === 'dark' ? 'light' : 'dark') }

  function startPicking() { setPickingMode(true); setPickedLocation(null); setIncidentDefaults(null) }
  function cancelPicking() { setPickingMode(false); setPickedLocation(null); setIncidentDefaults(null) }

  function handleLocationPicked(coords) { setPickedLocation(coords) }

  // Open the Log Incident modal pre-filled at a reporter's shared location.
  function logIncidentAtReporter(coords, mobile, token) {
    setIncidentDefaults({
      reporter: 'SMS Report',
      locationSource: 'report',
      ...(mobile ? { mobile } : {}),
      ...(token ? { reporterToken: token } : {}),
    })
    setPickingMode(true)
    setPickedLocation(coords)
  }

  async function handleIncidentSubmit(formData) {
    const result = await createIncident({
      fire_location_name:    formData.locationName,
      fire_address:          formData.address,
      fire_latitude:         formData.coords[0],
      fire_longitude:        formData.coords[1],
      fire_severity:         formData.severity,
      fire_status:           'pending',
      fire_alarm_level:      formData.alarm,
      fire_structure_type:   formData.structure,
      fire_casualties:       'None',
      fire_units_assigned:   0,
      fire_reporter_name:    formData.reporter,
      fire_reporter_contact: formData.mobile || '',
      fire_location_source:  formData.locationSource || 'manual',
      fire_remarks:          '',
      auto_dispatch:         !!formData.autoDispatch,
      reporter_token:        formData.reporterToken || null,
    })
    cancelPicking()
    fetchActiveIncidents()
      .then(data => setActiveIncidents(data.filter(i => ACTIVE_STATUSES.has(i.status))))
      .catch(() => {})

    const ad = result?.auto_dispatch
    if (ad?.status === 'dispatched') {
      fetchDispatches().then(rows => {
        setDispatches(rows)
        const routes = rows.flatMap(r => {
          // Skip completed/cancelled dispatches (e.g. closed incidents) so their
          // routes don't reappear on the map after a page reload.
          if (!ACTIVE_DISPATCH_STATUSES.has(r.dispatch_status)) return []
          if (r.routes && r.routes.length > 0) {
            return r.routes.flatMap(rt => {
              const match = rt.route_wkt?.match(/LINESTRING\s*\(([^)]+)\)/)
              if (!match) return []
              const positions = match[1].split(',').map(pair => {
                const [lng, lat] = pair.trim().split(/\s+/).map(Number)
                return [lat, lng]
              })
              return [{
                id: `${r.dispatch_id}_${rt.route_id}`,
                route_id: rt.route_id,
                dispatch_id: r.dispatch_id,
                fire_id: r.fire_id,
                teamName: r.team_name ?? '',
                positions,
                isSelected: rt.is_selected,
                rank: rt.rank,
                routeType: rt.route_type,
                etaMinutes: rt.eta_minutes,
                distanceKm: rt.distance_meters != null ? rt.distance_meters / 1000 : null,
              }]
            })
          }
          return []
        })
        setDispatchRoutes(routes)
      }).catch(() => {})
      setAutoDispatchResult(result)
    } else if (ad?.status === 'no_team_available') {
      setAutoDispatchResult(result)
    }
  }

  function handleReporterLocationReceived(data) {
    // data: { token, coords: [lat, lng], receivedAt }
    setReporterLocations(prev => {
      const exists = prev.find(r => r.token === data.token)
      if (exists) return prev.map(r => r.token === data.token ? { ...r, ...data } : r)
      return [...prev, data]
    })
  }

  function handleLogin(user) {
    setRoute({ view: 'dashboard', user })
  }

  function handleLogout() {
    localStorage.removeItem('bfp_token')
    localStorage.removeItem('bfp_user')
    setRoute({ view: 'login' })
  }

  // ── Login page ────────────────────────────────────────────────────────────
  if (route.view === 'login') {
    return <LoginPage onLogin={handleLogin} />
  }

  // ── Reporter page — render in isolation, no chrome ───────────────────────
  if (route.view === 'reporter') {
    return <ReporterPage token={route.token} />
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  const selectedInc = activeIncidents.find(i => i.id === selectedIncident) || null

  return (
    <>
      <TopBar
        activeNav={activeNav}
        onNavChange={nav => { setActiveNav(nav); setShowSettings(false); setFocusedPersonnel(null) }}
        theme={theme}
        onThemeToggle={toggleTheme}
        onOpenSettings={() => setShowSettings(s => !s)}
        showingSettings={showSettings}
        user={route.user}
        onLogout={handleLogout}
      />
      <div className="app-content">
      {showSettings ? (
        <SettingsPage
          user={route.user}
          theme={theme}
          onThemeToggle={toggleTheme}
          onLogout={handleLogout}
        />
      ) : activeNav === 'Metrics' ? (
        <MetricsPage />
      ) : activeNav === 'Planning' ? (
        <PlanningPage />
      ) : activeNav === 'Incidents' ? (
        <IncidentsPage />
      ) : activeNav === 'Personnel' ? (
        <PersonnelPage
          livePersonnelLocations={livePersonnelLocations}
          onShowOnMap={(perId) => {
            setActiveNav('Command')
            setFocusedPersonnel({ per_id: perId, nonce: Date.now() })
          }}
        />
      ) : activeNav === 'Teams' ? (
        <TeamsPage />
      ) : activeNav === 'Stations' ? (
        <StationsPage />
      ) : activeNav === 'Trucks' ? (
        <TrucksPage />
      ) : (
        <div className="main">
          <MapArea
            pickingMode={pickingMode}
            onLocationPicked={handleLocationPicked}
            pickedLocation={pickedLocation}
            onLogIncidentHere={logIncidentAtReporter}
            activeIncidents={activeIncidents}
            newIncidents={loggedIncidents}
            reporterLocations={reporterLocations}
            stations={stations}
            personnel={personnel}
            livePersonnelLocations={livePersonnelLocations}
            dispatchRoutes={dispatchRoutes}
            dispatches={dispatches}
            focusedIncidentId={selectedInc?.fire_id ?? null}
            ripplingIncidentId={ripplingId}
            onIncidentClick={handleSelectIncident}
            leftCollapsed={leftCollapsed}
            rightCollapsed={rightCollapsed}
            viewMode={viewMode}
            focusedPersonnel={focusedPersonnel}
          />
          <MapActions
            pickingMode={pickingMode}
            onStartPicking={startPicking}
            onOpenLocationRequest={() => setShowLocationRequest(true)}
            reporterCount={reporterLocations.length}
          />
          <RightSidebar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            incident={selectedInc}
            incidentRoutes={dispatchRoutes.filter(r => r.fire_id === (selectedInc?.fire_id ?? null))}
            incidentDispatches={dispatches.filter(d => d.fire_id === (selectedInc?.fire_id ?? null))}
            livePersonnelLocations={livePersonnelLocations}
            onSelectRoute={handleSelectRoute}
            onFullReroute={handleFullReroute}
            loading={loadingIncidents}
            collapsed={rightCollapsed}
            onToggleCollapse={() => setRightCollapsed(c => !c)}
            focusNonce={incidentFocusNonce}
            onDispatched={handleDispatched}
          />
        </div>
      )}
      </div>

      {pickedLocation && (
        <NewIncidentModal
          location={pickedLocation}
          initial={incidentDefaults}
          onSubmit={handleIncidentSubmit}
          onCancel={cancelPicking}
        />
      )}

      {showLocationRequest && (
        <LocationRequestModal
          onClose={() => { setShowLocationRequest(false); setPendingReporterToken(null); setReporterReceivedData(null) }}
          onLocationReceived={handleReporterLocationReceived}
          onTokenGenerated={setPendingReporterToken}
          receivedData={reporterReceivedData}
        />
      )}

      {autoDispatchResult && (
        <AutoDispatchModal
          incident={autoDispatchResult}
          onClose={() => setAutoDispatchResult(null)}
          onViewDispatch={() => {
            handleSelectIncident(autoDispatchResult.id)
            setAutoDispatchResult(null)
          }}
        />
      )}
    </>
  )
}
