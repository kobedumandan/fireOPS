import { useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, GeoJSON, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { PANABO_CENTER, PANABO_ZOOM, TILE_OPTIONS, withinPanabo } from '../data/mapConfig'
import { PANABO_BOUNDARY } from '../data/panaboBoundary'
import { updateStation } from '../api'
import '../styles/AppModal.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function PickerMap({ lat, lng, onChange, onBoundsError }) {
  const [tileId, setTileId] = useState('satellite')
  const tile = TILE_OPTIONS.find((t) => t.id === tileId)

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
          onBoundsError('Selected point is outside Panabo City. Please pick a location within the city boundary.')
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
        style={{ width: '100%', height: '260px', borderRadius: '6px', cursor: 'crosshair' }}
        scrollWheelZoom
        zoomControl
      >
        {tile.layers.map((l, i) => (
          <TileLayer key={`${tileId}-${i}`} {...l} />
        ))}
        <GeoJSON
          key="mask"
          data={maskFeature}
          style={() => ({ fillColor: '#060810', fillOpacity: 0.72, stroke: false })}
        />
        <GeoJSON
          key="boundary"
          data={boundaryFeature}
          style={() => ({ fill: false, stroke: true, color: '#1e90ff', weight: 2, opacity: 0.85 })}
        />
        <ClickHandler />
        {lat && lng && <Marker position={[lat, lng]} />}
      </MapContainer>

      <div className="asm-tile-switcher">
        {TILE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`asm-tile-btn${tileId === opt.id ? ' active' : ''}`}
            onClick={() => setTileId(opt.id)}
            title={opt.label}
          >
            <img src={opt.thumb} alt={opt.label} draggable={false} />
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function validateForm(form) {
  const required = ['station_name', 'station_address', 'station_barangay', 'station_contact']
  for (const key of required) {
    if (!form[key].toString().trim()) return 'All required fields must be filled.'
  }
  if (form.station_type === 'sub' && !form.parent_station_id) {
    return 'A sub-station must have a parent (main) station selected.'
  }
  const digits = form.station_contact.replace(/[\s\-]/g, '')
  if (/[a-zA-Z]/.test(form.station_contact)) return 'Contact number must not contain letters.'
  if (!/^(\+639\d{9}|09\d{9}|(\+63|0)\d{1,2}[\s\-]?\d{3,4}[\s\-]?\d{4})$/.test(digits.replace(/\-/g, ''))) {
    return 'Contact number must be a valid Philippine phone number (e.g. +63-917-000-0000 or 09170000000).'
  }
  return null
}

export default function EditStationModal({ station, onClose, onSaved, stations }) {
  const numericId = parseInt(station.id.replace('STA-', ''), 10)
  const parentNumericId = station.parent
    ? parseInt(station.parent.replace('STA-', ''), 10).toString()
    : ''

  const [form, setForm] = useState({
    station_name: station.name,
    station_type: station.type,
    parent_station_id: parentNumericId,
    station_address: station.address === '—' ? '' : station.address,
    station_barangay: station.district === '—' ? '' : station.district,
    station_latitude: '',
    station_longitude: '',
    station_contact: station.contact === '—' ? '' : station.contact,
    station_status: station.status,
    station_commander_id: station.commanderId ? String(station.commanderId) : '',
  })
  const [error, setError] = useState(null)
  const [mapError, setMapError] = useState(null)
  const [saving, setSaving] = useState(false)

  function set(field, value) {
    setError(null)
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validateForm(form)
    if (err) { setError(err); return }
    setSaving(true)
    try {
      const body = {
        station_name: form.station_name.trim(),
        station_type: form.station_type,
        station_address: form.station_address.trim(),
        station_barangay: form.station_barangay.trim(),
        station_contact: form.station_contact.trim(),
        station_status: form.station_status,
        parent_station_id:
          form.station_type === 'sub' && form.parent_station_id
            ? parseInt(form.parent_station_id, 10)
            : null,
        station_commander_id: form.station_commander_id
          ? parseInt(form.station_commander_id, 10)
          : null,
      }
      if (form.station_latitude && form.station_longitude) {
        body.station_latitude = parseFloat(form.station_latitude)
        body.station_longitude = parseFloat(form.station_longitude)
      }
      await updateStation(numericId, body)
      onSaved()
      onClose()
    } catch (ex) {
      setError(ex.message)
    } finally {
      setSaving(false)
    }
  }

  const mainStations = stations.filter((s) => s.type === 'main' && s.id !== station.id)

  return (
    <div className="apm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="apm-panel lim-panel">
        <div className="apm-header">
          <div>
            <div className="apm-eyebrow">BFP · STATIONS</div>
            <div className="apm-title">Edit Station</div>
          </div>
          <button className="apm-close" onClick={onClose}>✕</button>
        </div>

        <div className="apm-scroll">
          <form id="esm-edit-form" className="apm-body" onSubmit={handleSubmit}>
            <div className="apm-section-label">Station Information</div>

            <div className="apm-field">
              <label>Station Name <span className="apm-required">*</span></label>
              <input
                required
                value={form.station_name}
                onChange={(e) => set('station_name', e.target.value)}
              />
            </div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Station Type <span className="apm-required">*</span></label>
                <select
                  value={form.station_type}
                  onChange={(e) => {
                    set('station_type', e.target.value)
                    if (e.target.value === 'main') set('parent_station_id', '')
                  }}
                >
                  <option value="main">Main Station</option>
                  <option value="sub">Sub-Station</option>
                </select>
              </div>
              <div className="apm-field">
                <label>
                  Parent Station{' '}
                  {form.station_type === 'sub' && <span className="apm-required">*</span>}
                </label>
                <select
                  value={form.parent_station_id}
                  onChange={(e) => set('parent_station_id', e.target.value)}
                  disabled={form.station_type === 'main'}
                >
                  <option value="">— Select main station —</option>
                  {mainStations.map((s) => (
                    <option key={s.id} value={s.id.replace('STA-', '')}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Address <span className="apm-required">*</span></label>
                <input
                  placeholder="Street, City"
                  value={form.station_address}
                  onChange={(e) => set('station_address', e.target.value)}
                />
              </div>
              <div className="apm-field">
                <label>Barangay <span className="apm-required">*</span></label>
                <input
                  placeholder="Barangay name"
                  value={form.station_barangay}
                  onChange={(e) => set('station_barangay', e.target.value)}
                />
              </div>
            </div>

            <div className="apm-row">
              <div className="apm-field">
                <label>Contact Number <span className="apm-required">*</span></label>
                <input
                  placeholder="+63-2-8123-0000"
                  value={form.station_contact}
                  onChange={(e) => set('station_contact', e.target.value)}
                />
              </div>
              <div className="apm-field">
                <label>Status</label>
                <select
                  value={form.station_status}
                  onChange={(e) => set('station_status', e.target.value)}
                >
                  <option value="operational">Operational</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="apm-section-label">Head of Command</div>

            <div className="apm-field">
              <label>Station Commander</label>
              {station.personnelList.length === 0 ? (
                <div className="esm-no-personnel">
                  No personnel assigned to this station yet. Assign personnel first to set a commander.
                </div>
              ) : (
                <select
                  value={form.station_commander_id}
                  onChange={(e) => set('station_commander_id', e.target.value)}
                >
                  <option value="">No commander assigned</option>
                  {station.personnelList.map((p) => (
                    <option key={p.per_id} value={String(p.per_id)}>
                      {p.rank && p.rank !== '—' ? `${p.rank} - ` : ''}{p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {form.station_commander_id && (() => {
              const p = station.personnelList.find((x) => String(x.per_id) === form.station_commander_id)
              return p ? (
                <div className="esm-commander-preview">
                  <div className="esm-cmd-av">{p.initials}</div>
                  <div className="esm-cmd-info">
                    <div className="esm-cmd-name">{p.name}</div>
                    <div className="esm-cmd-rank">{p.rank}</div>
                  </div>
                  <span className="esm-cmd-badge">Commander</span>
                </div>
              ) : null
            })()}

            <div className="apm-section-label">Update Location (optional)</div>

            <div className="asm-map-section">
              <PickerMap
                lat={form.station_latitude || null}
                lng={form.station_longitude || null}
                onChange={(lat, lng) => {
                  set('station_latitude', lat)
                  set('station_longitude', lng)
                }}
                onBoundsError={setMapError}
              />
              {mapError ? (
                <div className="apm-error">{mapError}</div>
              ) : (
                <div className="asm-coords-display">
                  {form.station_latitude && form.station_longitude ? (
                    <>
                      Lat <strong>{Number(form.station_latitude).toFixed(6)}</strong>
                      &nbsp; Lng <strong>{Number(form.station_longitude).toFixed(6)}</strong>
                    </>
                  ) : (
                    'Leave blank to keep current location — click map to change'
                  )}
                </div>
              )}
            </div>

            {error && <div className="apm-error">{error}</div>}
          </form>
        </div>

        <div className="apm-actions">
          <button type="button" className="apm-btn-cancel" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="esm-edit-form" className="apm-btn-submit" disabled={saving}>
            {saving ? <span className="apm-spinner" /> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
