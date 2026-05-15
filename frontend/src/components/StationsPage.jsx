import { useState, useMemo, useEffect, useCallback } from "react";
import "../styles/StationsPage.css";
import { fetchStations, createStation } from "../api";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  PANABO_CENTER,
  PANABO_ZOOM,
  TILE_OPTIONS,
  withinPanabo,
} from "../data/mapConfig";

// Fix default marker icons broken by bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function PickerMap({ lat, lng, onChange, onBoundsError }) {
  const [tileId, setTileId] = useState("satellite");
  const tile = TILE_OPTIONS.find((t) => t.id === tileId);

  function ClickHandler() {
    useMapEvents({
      click(e) {
        const { lat: la, lng: lo } = e.latlng;
        if (!withinPanabo(la, lo)) {
          onBoundsError(
            "Selected point is outside Panabo City. Please pick a location within the city boundary."
          );
          return;
        }
        onBoundsError(null);
        onChange(la, lo);
      },
    });
    return null;
  }

  return (
    <div className="asm-map-wrap">
      <MapContainer
        center={lat && lng ? [lat, lng] : PANABO_CENTER}
        zoom={PANABO_ZOOM + 1}
        style={{
          width: "100%",
          height: "260px",
          borderRadius: "6px",
          cursor: "crosshair",
        }}
        scrollWheelZoom
        zoomControl
      >
        {tile.layers.map((l, i) => (
          <TileLayer key={`${tileId}-${i}`} {...l} />
        ))}
        <ClickHandler />
        {lat && lng && <Marker position={[lat, lng]} />}
      </MapContainer>

      {/* Tile switcher — mirrors MapArea style */}
      <div className="asm-tile-switcher">
        {TILE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`asm-tile-btn${tileId === opt.id ? " active" : ""}`}
            onClick={() => setTileId(opt.id)}
            title={opt.label}
          >
            <img src={opt.thumb} alt={opt.label} draggable={false} />
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function dbToStation(s) {
  const parentId = s.parent_station_id
    ? `STA-${String(s.parent_station_id).padStart(3, "0")}`
    : null;
  return {
    id: `STA-${String(s.station_id).padStart(3, "0")}`,
    code: `BFP-${s.station_id}`,
    name: s.station_name,
    type: s.station_type || "main",
    parent: parentId,
    district: s.station_barangay || "—",
    address: s.station_address || "—",
    status: s.station_status || "operational",
    personnel: 0,
    units: 0,
    activeUnits: 0,
    contact: s.station_contact || "—",
    commander: "—",
    established: s.created_at
      ? new Date(s.created_at).getFullYear().toString()
      : "—",
    coverage: s.station_barangay || "—",
    capacity: 0,
    capUsed: 0,
    incident: "—",
    subs: [],
    personnelList: [],
  };
}

const EMPTY_FORM = {
  station_name: "",
  station_type: "main",
  parent_station_id: "",
  station_address: "",
  station_barangay: "",
  station_latitude: "",
  station_longitude: "",
  station_contact: "",
  station_status: "operational",
};

function validateForm(form) {
  const required = [
    "station_name",
    "station_address",
    "station_barangay",
    "station_latitude",
    "station_longitude",
    "station_contact",
  ];
  for (const key of required) {
    if (!form[key].toString().trim()) return "All fields are required.";
  }
  if (form.station_type === "sub" && !form.parent_station_id) {
    return "A sub-station must have a parent (main) station selected.";
  }

  if (!form.station_latitude || !form.station_longitude)
    return "Please pick a location on the map.";

  // Philippine phone: +63XXXXXXXXXX or 09XXXXXXXXX, digits/hyphens/spaces only
  const digits = form.station_contact.replace(/[\s\-]/g, "");
  if (/[a-zA-Z]/.test(form.station_contact))
    return "Contact number must not contain letters.";
  if (
    !/^(\+639\d{9}|09\d{9}|(\+63|0)\d{1,2}[\s\-]?\d{3,4}[\s\-]?\d{4})$/.test(
      digits.replace(/\-/g, "")
    )
  ) {
    return "Contact number must be a valid Philippine phone number (e.g. +63-917-000-0000 or 09170000000).";
  }

  return null;
}

function AddStationModal({ onClose, onAdd, stations }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [mapError, setMapError] = useState(null);
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setError(null);
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const err = validateForm(form);
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    try {
      await onAdd({
        ...form,
        station_latitude: parseFloat(form.station_latitude),
        station_longitude: parseFloat(form.station_longitude),
        parent_station_id:
          form.station_type === "sub" && form.parent_station_id
            ? parseInt(form.parent_station_id, 10)
            : null,
      });
      onClose();
    } catch (ex) {
      setError(ex.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="asm-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="asm-panel">
        <div className="asm-header">
          <div>
            <div className="asm-eyebrow">BFP · STATIONS</div>
            <div className="asm-title">Add New Station</div>
          </div>
          <button className="asm-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="asm-form" onSubmit={handleSubmit}>
          <div className="apm-section-label">Station Information</div>

          <div className="asm-field">
            <label>
              Station Name <span className="asm-required">*</span>
            </label>
            <input
              required
              placeholder="e.g. Station 4 – Cubao"
              value={form.station_name}
              onChange={(e) => set("station_name", e.target.value)}
            />
          </div>

          <div className="asm-row">
            <div className="asm-field">
              <label>
                Station Type <span className="asm-required">*</span>
              </label>
              <select
                value={form.station_type}
                onChange={(e) => {
                  set("station_type", e.target.value);
                  if (e.target.value === "main") set("parent_station_id", "");
                }}
              >
                <option value="main">Main Station</option>
                <option value="sub">Sub-Station</option>
              </select>
            </div>
            <div className="asm-field">
              <label>
                Parent Station{" "}
                {form.station_type === "sub" && (
                  <span className="asm-required">*</span>
                )}
              </label>
              <select
                value={form.parent_station_id}
                onChange={(e) => set("parent_station_id", e.target.value)}
                disabled={form.station_type === "main"}
              >
                <option value="">— Select main station —</option>
                {stations
                  .filter((s) => s.type === "main")
                  .map((s) => (
                    <option key={s.id} value={s.id.replace("STA-", "")}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="asm-row">
            <div className="asm-field">
              <label>Address</label>
              <input
                placeholder="Street, City"
                value={form.station_address}
                onChange={(e) => set("station_address", e.target.value)}
              />
            </div>
            <div className="asm-field">
              <label>Barangay</label>
              <input
                placeholder="Barangay name"
                value={form.station_barangay}
                onChange={(e) => set("station_barangay", e.target.value)}
              />
            </div>
          </div>

          <div className="asm-row">
            <div className="asm-field">
              <label>Contact Number</label>
              <input
                placeholder="+63-2-8123-0000"
                value={form.station_contact}
                onChange={(e) => set("station_contact", e.target.value)}
              />
            </div>
            <div className="asm-field">
              <label>Status</label>
              <select
                value={form.station_status}
                onChange={(e) => set("station_status", e.target.value)}
              >
                <option value="operational">Operational</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="asm-map-section">
            <div className="apm-section-label">Station Location</div>
            <PickerMap
              lat={form.station_latitude}
              lng={form.station_longitude}
              onChange={(lat, lng) => {
                set("station_latitude", lat);
                set("station_longitude", lng);
              }}
              onBoundsError={setMapError}
            />
            {mapError ? (
              <div className="asm-error">{mapError}</div>
            ) : (
              <div className="asm-coords-display">
                {form.station_latitude && form.station_longitude ? (
                  <>
                    Lat{" "}
                    <strong>{Number(form.station_latitude).toFixed(6)}</strong>{" "}
                    &nbsp; Lng{" "}
                    <strong>{Number(form.station_longitude).toFixed(6)}</strong>
                  </>
                ) : (
                  "No location selected — click the map to set one"
                )}
              </div>
            )}
          </div>

          {error && <div className="asm-error">{error}</div>}

          <div className="asm-actions">
            <button
              type="button"
              className="asm-btn-cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="asm-btn-submit" disabled={saving}>
              {saving ? "Saving…" : "+ Add Station"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const TABS = ["all", "main", "sub"];
const TAB_LABELS = {
  all: "All Stations",
  main: "Main Stations",
  sub: "Sub-Stations",
};

const P_STATUS_MAP = {
  dispatched: { cls: "sta-hb-fire", label: "Dispatched" },
  onscene: { cls: "sta-hb-amber", label: "On Scene" },
  standby: { cls: "sta-hb-blue", label: "Standby" },
  offduty: { cls: "sta-hb-muted", label: "Off Duty" },
};

function StatusBadge({ status }) {
  if (status === "operational")
    return <span className="sta-hbadge sta-hb-green">Operational</span>;
  if (status === "standby")
    return <span className="sta-hbadge sta-hb-amber">Standby</span>;
  return <span className="sta-hbadge sta-hb-muted">{status}</span>;
}

function PStatusPill({ status }) {
  const { cls, label } = P_STATUS_MAP[status] || {
    cls: "sta-hb-muted",
    label: status,
  };
  return <span className={`sta-hbadge ${cls}`}>{label}</span>;
}

function CapBar({ used, capacity }) {
  const pct = capacity > 0 ? Math.round((used / capacity) * 100) : 0;
  const cls = pct >= 80 ? "cap-fire" : pct >= 50 ? "cap-amber" : "cap-green";
  return (
    <div className="sta-cap-wrap">
      <div className="sta-cap-bar">
        <div className={`sta-cap-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="sta-cap-pct">{pct}%</span>
    </div>
  );
}

function StationListItem({ s, stations, selected, onSelect }) {
  const isMain = s.type === "main";
  const parent = !isMain && stations.find((x) => x.id === s.parent);

  return (
    <div
      className={`sta-item ${isMain ? "sta-item-main" : "sta-item-sub"}${
        selected ? " selected" : ""
      }`}
      onClick={() => onSelect(s.id)}
    >
      <div className="sta-item-top">
        <div className="sta-item-name-wrap">
          <div className={isMain ? "sta-icon-main" : "sta-icon-sub"}>
            {isMain ? "🏠" : "🏡"}
          </div>
          <div>
            <div className="sta-item-name">{s.name}</div>
            <div className="sta-item-code">{s.code}</div>
          </div>
        </div>
        <span
          className={`sta-type-tag ${isMain ? "sta-tt-main" : "sta-tt-sub"}`}
        >
          {isMain ? "Main" : "Sub"}
        </span>
      </div>
      <div className="sta-item-meta">
        <div className="sta-meta-chip">
          <div
            className={`sta-meta-dot ${
              s.activeUnits > 0 ? "md-fire" : isMain ? "md-green" : "md-muted"
            }`}
          />
          {isMain
            ? `${s.personnel} personnel`
            : `${s.units} unit${s.units > 1 ? "s" : ""}`}
        </div>
        <div className="sta-meta-chip">
          <div className="sta-meta-dot md-amber" />
          {s.units} units
        </div>
        <div className="sta-meta-chip">
          <div className="sta-meta-dot md-muted" />
          {s.district}
        </div>
      </div>
      {parent && <div className="sta-item-parent">▲ Under {parent.name}</div>}
    </div>
  );
}

function StationDetail({ s, stations, onSelectStation }) {
  if (!s) {
    return (
      <div className="sta-no-selection">
        <div className="sta-no-sel-icon">🏠</div>
        <div className="sta-no-sel-text">Select a station to view details</div>
      </div>
    );
  }

  const isMain = s.type === "main";

  const subData = isMain
    ? s.subs.map((sid) => stations.find((x) => x.id === sid)).filter(Boolean)
    : [];
  const parentStation =
    !isMain && s.parent ? stations.find((x) => x.id === s.parent) : null;

  return (
    <div className="sta-detail-scroll">
      {/* Hero */}
      <div className={`sta-detail-hero ${isMain ? "hero-main" : "hero-sub"}`}>
        <div className="sta-hero-top">
          <div className="sta-hero-left">
            <div
              className={isMain ? "sta-hero-icon-main" : "sta-hero-icon-sub"}
            >
              {isMain ? "🏠" : "🏡"}
            </div>
            <div>
              <div
                className={`sta-hero-tag ${
                  isMain ? "hero-tag-main" : "hero-tag-sub"
                }`}
              >
                <div
                  className={isMain ? "sta-hero-crown" : "sta-hero-subicon"}
                />
                {isMain
                  ? "Main Station · Command Hub"
                  : "Sub-Station · Satellite Unit"}
              </div>
              <div className="sta-hero-name">{s.name}</div>
              <div className="sta-hero-code">
                {s.code} · {s.district}
              </div>
            </div>
          </div>
          <div className="sta-hero-badges">
            <StatusBadge status={s.status} />
            {s.incident !== "—" && (
              <span className="sta-hbadge sta-hb-fire">{s.incident}</span>
            )}
            <span
              className={`sta-hbadge ${isMain ? "sta-hb-gold" : "sta-hb-blue"}`}
            >
              {isMain ? "Command" : "Satellite"}
            </span>
          </div>
        </div>

        <div className="sta-detail-grid">
          <div className="sta-detail-stat">
            <div className="sta-ds-label">Personnel</div>
            <div className="sta-ds-value">{s.personnel}</div>
            <div className="sta-ds-sub">ASSIGNED</div>
          </div>
          <div className="sta-detail-stat">
            <div className="sta-ds-label">Fire Units</div>
            <div className="sta-ds-value">{s.units}</div>
            <div className="sta-ds-sub">{s.activeUnits} DEPLOYED</div>
          </div>
          <div className="sta-detail-stat">
            <div className="sta-ds-label">Capacity</div>
            <div className="sta-ds-value">
              {s.capUsed}/{s.capacity}
            </div>
            <CapBar used={s.capUsed} capacity={s.capacity} />
          </div>
          <div className="sta-detail-stat">
            <div className="sta-ds-label">
              {isMain ? "Sub-Stations" : "Parent"}
            </div>
            <div className="sta-ds-value">{isMain ? s.subs.length : 1}</div>
            <div className="sta-ds-sub">
              {isMain ? "UNDER COMMAND" : "REPORTING TO"}
            </div>
          </div>
        </div>
      </div>

      {/* Station Info */}
      <div className="sta-info-section">
        <div className="sta-info-title">Station Information</div>
        <div className="sta-info-grid">
          {[
            { label: "Address", value: s.address },
            { label: "Contact", value: s.contact, mono: true },
            { label: "Commander", value: s.commander },
            { label: "Established", value: s.established },
            { label: "Coverage Area", value: s.coverage },
            { label: "District", value: s.district },
          ].map(({ label, value, mono }) => (
            <div key={label} className="sta-info-row">
              <span className="sta-info-label">{label}</span>
              <span
                className="sta-info-value"
                style={
                  mono
                    ? { fontFamily: "var(--font-mono)", fontSize: 11 }
                    : undefined
                }
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-stations panel (main only) */}
      {isMain && subData.length > 0 && (
        <div className="sta-info-section">
          <div className="sta-info-title">Sub-Stations under this command</div>
          <div className="sta-subs-grid">
            {subData.map((sub) => (
              <div
                key={sub.id}
                className="sta-sub-card"
                onClick={() => onSelectStation(sub.id)}
              >
                <div className="sta-smc-name">{sub.name}</div>
                <div className="sta-smc-code">{sub.code}</div>
                <div className="sta-smc-row">
                  <span className="sta-smc-label">Status</span>
                  <span className="sta-smc-val">{sub.status}</span>
                </div>
                <div className="sta-smc-row">
                  <span className="sta-smc-label">District</span>
                  <span className="sta-smc-val">{sub.district}</span>
                </div>
                <div className="sta-smc-row">
                  <span className="sta-smc-label">Units</span>
                  <span className="sta-smc-val">{sub.units}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parent station panel (sub only) */}
      {!isMain && parentStation && (
        <div className="sta-info-section">
          <div className="sta-info-title">Parent Station</div>
          <div
            className="sta-sub-card"
            style={{ borderLeftColor: "var(--accent-gold)" }}
            onClick={() => onSelectStation(parentStation.id)}
          >
            <div className="sta-smc-name">{parentStation.name}</div>
            <div className="sta-smc-code">
              {parentStation.code} · Main Station
            </div>
            <div className="sta-smc-row">
              <span className="sta-smc-label">Commander</span>
              <span className="sta-smc-val">{parentStation.commander}</span>
            </div>
            <div className="sta-smc-row">
              <span className="sta-smc-label">Contact</span>
              <span className="sta-smc-val">{parentStation.contact}</span>
            </div>
          </div>
        </div>
      )}

      {/* Personnel */}
      {s.personnelList.length > 0 && (
        <div className="sta-info-section">
          <div className="sta-info-title">Assigned Personnel</div>
          <div className="sta-personnel-list">
            {s.personnelList.map((p, i) => (
              <div key={i} className="sta-p-row">
                <div
                  className={`sta-p-av ${
                    p.status === "dispatched"
                      ? "pav-fire"
                      : p.status === "onscene"
                      ? "pav-amber"
                      : "pav-blue"
                  }`}
                >
                  {p.initials}
                </div>
                <div className="sta-p-info">
                  <div className="sta-p-name">{p.name}</div>
                  <div className="sta-p-rank">{p.rank}</div>
                </div>
                <PStatusPill status={p.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="sta-detail-actions">
        <button className="sta-btn-dispatch">
          ▶ Dispatch From This Station
        </button>
        <button className="sta-btn-sec">⊙ View on Map</button>
        <button className="sta-btn-sec">✎ Edit Station</button>
        <button className="sta-btn-sec">↻ Incident History</button>
      </div>
    </div>
  );
}

export default function StationsPage() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadStations = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await fetchStations();
      const mapped = data.map(dbToStation);
      // populate subs arrays from parent references
      mapped.forEach((s) => {
        if (s.type === "sub" && s.parent) {
          const parentStation = mapped.find((x) => x.id === s.parent);
          if (parentStation) parentStation.subs.push(s.id);
        }
      });
      setStations(mapped);
      if (!selectedId && mapped.length > 0) setSelectedId(mapped[0].id);
    } catch (ex) {
      setFetchError(ex.message);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadStations();
  }, [loadStations]);

  async function handleAddStation(body) {
    await createStation(body);
    await loadStations();
  }

  const stats = useMemo(
    () => ({
      main: stations.filter((s) => s.type === "main").length,
      sub: stations.filter((s) => s.type === "sub").length,
      personnel: stations.reduce((acc, s) => acc + s.personnel, 0),
    }),
    [stations]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return stations.filter((s) => {
      const mq =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q);
      const md = !districtFilter || s.district === districtFilter;
      const mt =
        activeTab === "all" ||
        (activeTab === "main" && s.type === "main") ||
        (activeTab === "sub" && s.type === "sub");
      return mq && md && mt;
    });
  }, [stations, search, districtFilter, activeTab]);

  const selected = stations.find((s) => s.id === selectedId) || null;

  function handleSelectStation(id) {
    setSelectedId(id);
  }

  return (
    <div className="sta-page">
      {/* PAGE HEADER */}
      <div className="sta-header">
        <div className="sta-title-row">
          <div className="sta-title">
            Stations
            <span>↳ {stations.length} TOTAL</span>
          </div>
          <div className="sta-header-actions">
            <button className="sta-btn-secondary">⬇ Export</button>
            <button
              className="sta-btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              + Add Station
            </button>
          </div>
        </div>

        {/* STAT CARDS — 3 cards: Main, Sub, Personnel */}
        <div className="sta-stat-row">
          <div className="sta-stat-card gold">
            <div className="sta-stat-label">Main Stations</div>
            <div className="sta-stat-value">{stats.main}</div>
            <div className="sta-stat-sub">COMMAND HUBS</div>
          </div>
          <div className="sta-stat-card blue">
            <div className="sta-stat-label">Sub-Stations</div>
            <div className="sta-stat-value">{stats.sub}</div>
            <div className="sta-stat-sub">SATELLITE UNITS</div>
          </div>
          <div className="sta-stat-card amber">
            <div className="sta-stat-label">Total Personnel</div>
            <div className="sta-stat-value">{stats.personnel}</div>
            <div className="sta-stat-sub">ACROSS ALL STATIONS</div>
          </div>
        </div>

        {/* STATUS TABS */}
        <div className="sta-status-tabs">
          {TABS.map((t) => (
            <button
              key={t}
              className={`sta-status-tab${activeTab === t ? " active" : ""}`}
              onClick={() => setActiveTab(t)}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="sta-toolbar">
        <div className="sta-search-wrap">
          <span className="sta-search-icon">⌕</span>
          <input
            type="text"
            placeholder="Search station name, code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="sta-filter-select"
          value={districtFilter}
          onChange={(e) => setDistrictFilter(e.target.value)}
        >
          <option value="">All Districts</option>
          <option value="District 1">District 1</option>
          <option value="District 2">District 2</option>
        </select>
        <div className="sta-legend">
          <div className="sta-legend-item">
            <div className="sta-legend-line ll-gold" />
            Main station
          </div>
          <div className="sta-legend-item">
            <div className="sta-legend-line ll-blue" />
            Sub-station
          </div>
        </div>
        <span className="sta-result-count">
          SHOWING {filtered.length} STATION{filtered.length !== 1 ? "S" : ""}
        </span>
      </div>

      {/* CONTENT AREA */}
      <div className="sta-content">
        {/* LEFT: Station List */}
        <div className="sta-list">
          {loading ? (
            <div className="sta-list-empty">Loading stations…</div>
          ) : fetchError ? (
            <div className="sta-list-empty" style={{ color: "var(--fire)" }}>
              {fetchError}
            </div>
          ) : filtered.length === 0 ? (
            <div className="sta-list-empty">No stations match your filters</div>
          ) : (
            filtered.map((s) => (
              <StationListItem
                key={s.id}
                s={s}
                stations={stations}
                selected={selectedId === s.id}
                onSelect={handleSelectStation}
              />
            ))
          )}
        </div>

        {/* RIGHT: Station Detail */}
        <div className="sta-detail">
          <StationDetail
            s={selected}
            stations={stations}
            onSelectStation={handleSelectStation}
          />
        </div>
      </div>

      {showAddModal && (
        <AddStationModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddStation}
          stations={stations}
        />
      )}
    </div>
  );
}
