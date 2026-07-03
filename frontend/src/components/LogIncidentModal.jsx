import { useState, useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, GeoJSON, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { PANABO_CENTER, PANABO_ZOOM, TILE_OPTIONS, withinPanabo } from '../data/mapConfig'
import { PANABO_BOUNDARY } from '../data/panaboBoundary'
import { fetchTeams } from '../api'
import '../styles/AppModal.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function PickerMap({ lat, lng, onChange, onBoundsError }) {
  const [tileId, setTileId] = useState('satellite')
  const tile = TILE_OPTIONS.find(t => t.id === tileId)

  const maskFeature = useMemo(() => ({
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [[-180, -90], [-180, 90], [180, 90], [180, -90], [-180, -90]],
        PANABO_BOUNDARY,
      ],
    },
  }), [])

  const boundaryFeature = useMemo(() => ({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [PANABO_BOUNDARY] },
  }), [])

  function ClickHandler() {
    useMapEvents({
      click(e) {
        const { lat: la, lng: lo } = e.latlng
        if (!withinPanabo(la, lo)) {
          onBoundsError('Selected point is outside Panabo City.')
          return
        }
        onBoundsError(null)
        onChange(la, lo)
      },
    })
    return null
  }

  return (
    <div className="asm-map-wrap">
      <MapContainer
        center={lat && lng ? [lat, lng] : PANABO_CENTER}
        zoom={PANABO_ZOOM + 1}
        style={{ width: '100%', height: '220px', borderRadius: '6px', cursor: 'crosshair' }}
        scrollWheelZoom
        zoomControl
      >
        {tile.layers.map((l, i) => <TileLayer key={`${tileId}-${i}`} {...l} />)}
        <GeoJSON key="mask" data={maskFeature} style={() => ({ fillColor: '#060810', fillOpacity: 0.72, stroke: false })} />
        <GeoJSON key="boundary" data={boundaryFeature} style={() => ({ fill: false, stroke: true, color: '#1e90ff', weight: 2, opacity: 0.85 })} />
        <ClickHandler />
        {lat && lng && <Marker position={[lat, lng]} />}
      </MapContainer>
      <div className="asm-tile-switcher">
        {TILE_OPTIONS.map(opt => (
          <button key={opt.id} type="button" className={`asm-tile-btn${tileId === opt.id ? ' active' : ''}`} onClick={() => setTileId(opt.id)}>
            <img src={opt.thumb} alt={opt.label} draggable={false} />
          </button>
        ))}
      </div>
    </div>
  )
}

const EMPTY = {
  fire_location_name:    '',
  fire_address:          '',
  fire_latitude:         '',
  fire_longitude:        '',
  fire_severity:         'Minor',
  fire_status:           'pending',
  fire_alarm_level:      '1st Alarm',
  fire_structure_type:   'Residential',
  fire_casualties:       'None',
  fire_units_assigned:   0,
  fire_reporter_name:    '',
  fire_reporter_contact: '',
  fire_location_source:  'manual',
  fire_remarks:          '',
}

export default function LogIncidentModal({ onClose, onSubmit }) {
  const [form, setForm]       = useState(EMPTY)
  const [mapError, setMapError] = useState(null)
  const [error, setError]     = useState(null)
  const [saving, setSaving]   = useState(false)

  const [allTeams, setAllTeams]   = useState([])
  const [units, setUnits]         = useState([])   // array of team objects
  const [unitSelect, setUnitSelect] = useState('')

  useEffect(() => {
    fetchTeams().then(setAllTeams).catch(() => {})
  }, [])

  const showUnits      = form.fire_status === 'contained' || form.fire_status === 'closed'
  const showCasualties = form.fire_status === 'closed'
  const showRemarks    = form.fire_status === 'closed'

  function set(field, value) {
    setError(null)
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleStatusChange(value) {
    setError(null)
    setForm(prev => ({
      ...prev,
      fire_status: value,
      ...(value === 'pending' || value === 'active' ? { fire_casualties: 'None', fire_remarks: '' } : {}),
      ...(value === 'contained' ? { fire_casualties: 'None', fire_remarks: '' } : {}),
    }))
    if (value === 'pending' || value === 'active') setUnits([])
  }

  function addUnit() {
    const team = allTeams.find(t => t.team_id === Number(unitSelect))
    if (!team) return
    setUnits(prev => [...prev, team])
    setUnitSelect('')
  }

  function removeUnit(teamId) {
    setUnits(prev => prev.filter(t => t.team_id !== teamId))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.fire_latitude || !form.fire_longitude) {
      setError('Please pick the incident location on the map.')
      return
    }
    if (!form.fire_location_name.trim()) {
      setError('Area / Barangay name is required.')
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        ...form,
        fire_latitude:       parseFloat(form.fire_latitude),
        fire_longitude:      parseFloat(form.fire_longitude),
        fire_units_assigned: showUnits ? units.length : 0,
        fire_casualties:     showCasualties ? form.fire_casualties : 'None',
        fire_remarks:        showRemarks ? form.fire_remarks : '',
      })
    } catch (ex) {
      setError(ex.message)
      setSaving(false)
    }
  }

  return (
    <div className="apm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="apm-panel lim-panel">

        <div className="apm-header">
          <div>
            <div className="apm-eyebrow">INCIDENTS</div>
            <div className="apm-title">New Incident</div>
          </div>
          <button className="apm-close" onClick={onClose}>✕</button>
        </div>

        <div className="apm-scroll">
          <form id="lim-form" className="apm-body" onSubmit={handleSubmit}>

            <div className="apm-section-label">Incident Location</div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Area / Barangay <span className="apm-required">*</span></label>
                <input
                  placeholder="e.g. Brgy. Kakar, Panabo"
                  value={form.fire_location_name}
                  onChange={e => set('fire_location_name', e.target.value)}
                />
              </div>
              <div className="apm-field">
                <label>Street Address</label>
                <input
                  placeholder="e.g. 12 Rizal St."
                  value={form.fire_address}
                  onChange={e => set('fire_address', e.target.value)}
                />
              </div>
            </div>

            <div className="asm-map-section">
              <PickerMap
                lat={form.fire_latitude}
                lng={form.fire_longitude}
                onChange={(lat, lng) => { set('fire_latitude', lat); set('fire_longitude', lng) }}
                onBoundsError={setMapError}
              />
              {mapError
                ? <div className="apm-error">{mapError}</div>
                : <div className="asm-coords-display">
                    {form.fire_latitude && form.fire_longitude
                      ? <>Lat <strong>{Number(form.fire_latitude).toFixed(6)}</strong>&nbsp; Lng <strong>{Number(form.fire_longitude).toFixed(6)}</strong></>
                      : 'No location selected — click the map to mark the incident'
                    }
                  </div>
              }
            </div>

            <div className="apm-section-label">Incident Details</div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Severity <span className="apm-required">*</span></label>
                <select value={form.fire_severity} onChange={e => set('fire_severity', e.target.value)}>
                  <option value="Minor">Minor</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div className="apm-field">
                <label>Status <span className="apm-required">*</span></label>
                <select value={form.fire_status} onChange={e => handleStatusChange(e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="contained">Contained</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Alarm Level</label>
                <select value={form.fire_alarm_level} onChange={e => set('fire_alarm_level', e.target.value)}>
                  <option value="1st Alarm">1st Alarm</option>
                  <option value="2nd Alarm">2nd Alarm</option>
                  <option value="3rd Alarm">3rd Alarm</option>
                </select>
              </div>
              <div className="apm-field">
                <label>Structure Type</label>
                <select value={form.fire_structure_type} onChange={e => set('fire_structure_type', e.target.value)}>
                  <option value="Residential">Residential</option>
                  <option value="Residential 2-storey">Residential 2-storey</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Industrial">Industrial</option>
                  <option value="Institutional">Institutional</option>
                  <option value="Informal Settlement">Informal Settlement</option>
                  <option value="Vegetation">Vegetation</option>
                  <option value="Vehicle">Vehicle</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {showUnits && (<>
              <div className="apm-section-label">Units Assigned</div>

              <div className="etm-members-list">
                {units.length === 0 && (
                  <div className="etm-members-empty">No units added yet</div>
                )}
                {units.map(t => (
                  <div key={t.team_id} className="etm-member-row">
                    <div className="etm-member-av lim-unit-av">🚒</div>
                    <div className="etm-member-info">
                      <div className="etm-member-name">{t.team_name}{t.team_code ? ` · ${t.team_code}` : ''}</div>
                      <div className="etm-member-rank">{t.station_name !== '—' ? t.station_name : ''}</div>
                    </div>
                    <button
                      type="button"
                      className="etm-member-rm"
                      onClick={() => removeUnit(t.team_id)}
                    >✕</button>
                  </div>
                ))}
              </div>

              <div className="etm-add-row">
                <select
                  className="etm-add-select"
                  value={unitSelect}
                  onChange={e => setUnitSelect(e.target.value)}
                >
                  <option value="">Select team to assign...</option>
                  {allTeams
                    .filter(t => !units.some(u => u.team_id === t.team_id))
                    .map(t => (
                      <option key={t.team_id} value={t.team_id}>
                        {t.team_name}{t.team_code ? ` · ${t.team_code}` : ''}{t.station_name !== '—' ? ` (${t.station_name})` : ''}
                      </option>
                    ))
                  }
                </select>
                <button
                  type="button"
                  className="etm-add-btn"
                  onClick={addUnit}
                  disabled={!unitSelect}
                >Add</button>
              </div>

              {showCasualties && (
                <div className="apm-field">
                  <label>Casualties</label>
                  <select value={form.fire_casualties} onChange={e => set('fire_casualties', e.target.value)}>
                    <option value="None">None</option>
                    <option value="Unconfirmed">Unconfirmed</option>
                    <option value="Minor Injuries">Minor Injuries</option>
                    <option value="Serious Injuries">Serious Injuries</option>
                    <option value="Fatalities">Fatalities</option>
                  </select>
                </div>
              )}
            </>)}

            {showRemarks && (
              <div className="apm-field">
                <label>Remarks / Report</label>
                <textarea
                  placeholder="Add incident notes, investigation findings, or post-incident report..."
                  value={form.fire_remarks}
                  onChange={e => set('fire_remarks', e.target.value)}
                  rows={3}
                />
              </div>
            )}

            <div className="apm-section-label">Reporter Information</div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Reported By</label>
                <input
                  placeholder="e.g. BFP Hotline · 911"
                  value={form.fire_reporter_name}
                  onChange={e => set('fire_reporter_name', e.target.value)}
                />
              </div>
              <div className="apm-field">
                <label>Reporter Contact</label>
                <input
                  placeholder="e.g. 09XX-XXX-XXXX"
                  value={form.fire_reporter_contact}
                  onChange={e => set('fire_reporter_contact', e.target.value)}
                />
              </div>
            </div>

            {error && <div className="apm-error">{error}</div>}

          </form>
        </div>

        <div className="apm-actions">
          <button type="button" className="apm-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="lim-form" className="apm-btn-submit" disabled={saving}>
            {saving ? <span className="apm-spinner" /> : 'Log Incident'}
          </button>
        </div>

      </div>
    </div>
  )
}
