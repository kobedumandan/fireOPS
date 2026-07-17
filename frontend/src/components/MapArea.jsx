import { useState, useEffect, useMemo, useRef, memo, Fragment } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  GeoJSON,
  Tooltip,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import "../styles/MapArea.css";
import { PANABO_BOUNDARY } from "../data/panaboBoundary";
import { PANABO_CENTER, PANABO_ZOOM, TILE_OPTIONS } from "../data/mapConfig";
import {
  fetchHeatmap,
  fetchObstructions,
  createObstruction,
  deleteObstruction,
  fetchGnnConstraints,
  fetchConstraints,
  createConstraint,
  updateConstraint,
  deleteConstraint,
  fetchBarangays,
} from "../api";

function FireGeneralIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="sev-icon"
      fill="currentColor"
    >
      <path d="M240-400q0 52 21 98.5t60 81.5q-1-5-1-9v-9q0-32 12-60t35-51l113-111 113 111q23 23 35 51t12 60v9q0 4-1 9 39-35 60-81.5t21-98.5q0-50-18.5-94.5T648-574q-20 13-42 19.5t-45 6.5q-62 0-107.5-41T401-690q-39 33-69 68.5t-50.5 72Q261-513 250.5-475T240-400Zm240 52-57 56q-11 11-17 25t-6 29q0 32 23.5 55t56.5 23q33 0 56.5-23t23.5-55q0-16-6-29.5T537-292l-57-56Zm0-492v132q0 34 23.5 57t57.5 23q18 0 33.5-7.5T622-658l18-22q74 42 117 117t43 163q0 134-93 227T480-80q-134 0-227-93t-93-227q0-129 86.5-245T480-840Z" />
    </svg>
  );
}

const ZOOM = PANABO_ZOOM;
const PERSONNEL_MIN_ZOOM = 13;
// Hide personnel whose last known location is older than this (8 hours).
const PERSONNEL_STALE_HIDE_MINUTES = 8 * 60;
const BARANGAY_LABEL_MIN_ZOOM = 13;

const LAYER_LABELS = [
  "Incidents",
  "Personnel",
  "Stations",
  "Routes",
  "Heat Map",
  "GNN Constraints",
  "Barangay",
];

function toIconSeverity(inc) {
  if (inc.status === "contained") return "contained";
  const s = (inc.sev || "").toLowerCase();
  if (s === "critical") return "critical";
  if (s === "moderate") return "moderate";
  return "contained";
}

// ── Picking-mode helpers (must be inside MapContainer) ───────────────────────
function ZoomTracker({ onZoom }) {
  const map = useMapEvents({
    zoomend() {
      onZoom(map.getZoom());
    },
  });
  return null;
}

function MapClickHandler({
  active,
  onPick,
  onObstructionPick,
  obstructionActive,
}) {
  useMapEvents({
    click(e) {
      const latlng = [e.latlng.lat, e.latlng.lng];
      if (obstructionActive) onObstructionPick(latlng);
      else if (active) onPick(latlng);
    },
  });
  return null;
}

function CursorController({ active }) {
  const map = useMap();
  useEffect(() => {
    map.getContainer().classList.toggle("pick-cursor", active);
    return () => map.getContainer().classList.remove("pick-cursor");
  }, [active, map]);
  return null;
}

function PersonnelFocuser({ focusedPersonnel, livePersonnelLocations }) {
  const map = useMap();
  useEffect(() => {
    if (!focusedPersonnel?.per_id) return;
    const p = livePersonnelLocations.find(
      (x) => x.per_id === focusedPersonnel.per_id
    );
    if (p?.latitude != null && p?.longitude != null) {
      map.flyTo([p.latitude, p.longitude], Math.max(map.getZoom(), 16), {
        duration: 0.9,
      });
    }
    // Re-fires whenever the user clicks Map again (nonce changes).
  }, [focusedPersonnel?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function reporterIcon() {
  return L.divIcon({
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<div class="reporter-pin">
             <div class="reporter-pin-ring"></div>
             <div class="reporter-pin-core"></div>
           </div>`,
  });
}

function newIncidentIcon() {
  return L.divIcon({
    className: "",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `<div class="new-inc-pin">
             <div class="new-inc-ring"></div>
             <div class="new-inc-core">+</div>
           </div>`,
  });
}

// ── Icon factories ────────────────────────────────────────────────────────────
// Incident severity → marker/route colors. Shared so a dispatch route is drawn
// in the same color as the incident pin it leads to.
const SEVERITY_COLORS = {
  critical:  { color: "#ff4d1a", shadow: "rgba(255,77,26,0.6)" },
  moderate:  { color: "#ffb020", shadow: "rgba(255,176,32,0.5)" },
  contained: { color: "#00e676", shadow: "rgba(0,160,75,0.7)" },
};

function severityColor(inc) {
  return (SEVERITY_COLORS[toIconSeverity(inc)] || SEVERITY_COLORS.contained).color;
}

function fireIcon(severity, selected = false, isNew = false) {
  const sc = SEVERITY_COLORS[severity] || SEVERITY_COLORS.contained;
  const color = sc.color;
  const shadow = sc.shadow;
  const opacity = "1";
  const pulse = severity === "critical";

  return L.divIcon({
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `
      <div class="fire-marker" style="opacity:${opacity}">
        ${
          selected
            ? `<div class="fire-ripple" style="border-color:${color}"></div>`
            : ""
        }
        ${
          pulse
            ? `<div class="fire-pulse-ring" style="border-color:${color}"></div>`
            : ""
        }
        ${
          isNew
            ? `<div class="fire-new-ring" style="border-color:${color}"></div><div class="fire-new-ring fire-new-ring-delay" style="border-color:${color}"></div>`
            : ""
        }
        <div class="fire-marker-inner" style="background:${color};box-shadow:0 0 16px ${shadow}"></div>
      </div>`,
  });
}

function personnelIcon(initials, color, shadow, deviated = false) {
  const badge = deviated
    ? `<div style="position:absolute;top:-6px;right:-6px;width:14px;height:14px;border-radius:50%;background:#ffb020;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:bold;color:#000;border:1.5px solid #0a0c0f;">!</div>`
    : "";
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="position:relative;display:inline-block">
             <div class="personnel-marker" style="border-color:${color};color:${color};box-shadow:0 0 10px ${shadow}">${initials}</div>
             ${badge}
           </div>`,
  });
}

function stationIcon() {
  return L.divIcon({
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `<div class="station-marker">
    <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="var(--accent-green)"><path d="M300-240v-360h360v360-360H300v360Zm-60 0h60v-360h360v360h60v-366L480-780 240-606v366Zm120-240h240v-60H360v60Zm120-160q17 0 28.5-11.5T520-680q0-17-11.5-28.5T480-720q-17 0-28.5 11.5T440-680q0 17 11.5 28.5T480-640ZM160-160v-400H39l441-320 440 320H800v400H600v-260H360v260H160Z"/>
    </svg></div>`,
  });
}

// ── Road obstruction types & icon ────────────────────────────────────────────
const OBSTRUCTION_TYPES = [
  { id: "repair", label: "Repair", color: "#facc15", symbol: "🔧" },
  { id: "blockade", label: "Blockade", color: "#ef4444", symbol: "⛔" },
  { id: "flood", label: "Flood", color: "#38bdf8", symbol: "🌊" },
  { id: "accident", label: "Accident", color: "#fb923c", symbol: "⚠️" },
];

function obstructionIcon(type) {
  const info =
    OBSTRUCTION_TYPES.find((t) => t.id === type) || OBSTRUCTION_TYPES[0];
  return L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div class="obstruction-marker" style="border-color:${info.color};box-shadow:0 0 10px ${info.color}44">
             <span style="font-size:14px;line-height:1">${info.symbol}</span>
           </div>`,
  });
}

// ── Coverage mask + boundary ──────────────────────────────────────────────────
// Must be rendered inside MapContainer (uses useMap hook)
function CoverageLayers() {
  const map = useMap();

  useEffect(() => {
    // Inject diagonal hatch pattern into the Leaflet SVG overlay pane
    const svg = map.getPanes().overlayPane.querySelector("svg");
    if (!svg || svg.querySelector("#cov-hatch")) return;

    const NS = "http://www.w3.org/2000/svg";
    const defs = document.createElementNS(NS, "defs");
    const pattern = document.createElementNS(NS, "pattern");
    const line = document.createElementNS(NS, "line");

    Object.entries({
      id: "cov-hatch",
      patternUnits: "userSpaceOnUse",
      width: "10",
      height: "10",
      patternTransform: "rotate(45 0 0)",
    }).forEach(([k, v]) => pattern.setAttribute(k, v));

    Object.entries({
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "10",
      stroke: "rgba(30,144,255,0.15)",
      "stroke-width": "1.5",
    }).forEach(([k, v]) => line.setAttribute(k, v));

    pattern.appendChild(line);
    defs.appendChild(pattern);
    svg.insertBefore(defs, svg.firstChild);
  }, [map]);

  // World polygon with Panabo City cut out as a hole
  const maskFeature = useMemo(
    () => ({
      type: "Feature",
      geometry: {
        type: "Polygon",
        // GeoJSON: outer ring CCW, inner ring (hole) CW
        // evenodd fill-rule used by Leaflet handles both orientations correctly
        coordinates: [
          [
            [-180, -90],
            [-180, 90],
            [180, 90],
            [180, -90],
            [-180, -90],
          ],
          PANABO_BOUNDARY,
        ],
      },
    }),
    []
  );

  // Panabo City outline only (no fill)
  const boundaryFeature = useMemo(
    () => ({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [PANABO_BOUNDARY] },
    }),
    []
  );

  return (
    <>
      {/* Dark semi-transparent overlay outside Panabo City */}
      {/* <GeoJSON
        key="mask-dark"
        data={maskFeature}
        style={() => ({
          fillColor: "rgba(232, 57, 13, 0.07)",
          fillOpacity: 0.75,
          stroke: false,
        })}
      /> */}

      {/* Diagonal hatch overlay — fill applied via CSS (overrides SVG attribute) */}
      <GeoJSON
        key="mask-hatch"
        data={maskFeature}
        style={() => ({
          className: "cov-hatch-path",
          fillOpacity: 1,
          stroke: false,
        })}
      />

      {/* Jurisdiction boundary — glowing blue outline */}
      <GeoJSON
        key="boundary"
        data={boundaryFeature}
        style={() => ({
          fill: false,
          stroke: true,
          color: "#e8390d",
          weight: 2,
          opacity: 0.35,
        })}
      />
    </>
  );
}

// ── Barangay boundary overlay ────────────────────────────────────────────────
function barangayLabelIcon(name, population) {
  const popText =
    population != null
      ? Number(population).toLocaleString("en-US")
      : "—";
  return L.divIcon({
    className: "",
    iconSize: [140, 40],
    iconAnchor: [70, 20],
    html: `<div class="brgy-label">
             <div class="brgy-label-name">${name}</div>
             <div class="brgy-label-pop">Est. pop: ${popText}</div>
           </div>`,
  });
}

function BarangayLayer({ featureCollection, showLabels = true }) {
  if (!featureCollection?.features?.length) return null;

  const style = () => ({
    color: "#38bdf8",
    weight: 1.5,
    opacity: 0.9,
    fillColor: "#38bdf8",
    fillOpacity: 0.08,
  });

  const labels = featureCollection.features.map((f) => {
    const layer = L.geoJSON(f);
    const center = layer.getBounds().getCenter();
    const { brgy_id, brgy_name, brgy_estpopulation } = f.properties || {};
    return {
      id: brgy_id ?? brgy_name,
      name: brgy_name || "Unnamed",
      population: brgy_estpopulation,
      lat: center.lat,
      lng: center.lng,
    };
  });

  return (
    <>
      <GeoJSON
        key={`brgy-${featureCollection.features.length}`}
        data={featureCollection}
        style={style}
      />
      {showLabels &&
        labels.map((l) => (
          <Marker
            key={`brgy-label-${l.id}`}
            position={[l.lat, l.lng]}
            icon={barangayLabelIcon(l.name, l.population)}
            interactive={false}
            keyboard={false}
          />
        ))}
    </>
  );
}

// ── Weighted KDE heatmap layer (leaflet.heat) ─────────────────────────────────
function HeatmapLayer({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;

    // points: [{lat, lng, weight}] — weight is heatmap_density_value (0.10–5.0)
    const data = points.map((p) => [p.lat, p.lng, p.weight]);

    console.log(
      "Heatmap density range:",
      Math.min(...data.map((d) => d[2])),
      "to",
      Math.max(...data.map((d) => d[2]))
    );
    console.log("Sample points:", data.slice(0, 5));

    const layer = L.heatLayer(data, {
      radius: 25,
      blur: 18,
      minOpacity: 0.35,
      maxZoom: 17,
      max: 5.0,
      gradient: {
        0.0: "#0000ff",
        0.2: "#00ffff",
        0.4: "#00ff00",
        0.6: "#ffff00",
        0.8: "#ff8000",
        1.0: "#ff0000",
      },
    }).addTo(map);

    return () => map.removeLayer(layer);
  }, [map, points]);

  return null;
}

// ── GNN constraint colours ───────────────────────────────────────────────────
// Fallbacks for the custom-constraint draw tools and any feature missing a
// per-feature map_color. Live styling comes from the GAT style_config / the
// map_color baked onto each predicted-constraint feature.
const NARROW_ROAD_COLOR = "#E53935"; // red — narrow roads
const TRAFFIC_AREA_COLOR = "#FFD54F"; // amber — traffic-crowded areas
const NORMAL_ROAD_COLOR = "#B0BEC5"; // dim grey — unconstrained roads

// Render every predicted-constraint feature using its own baked-in style
// (map_color / map_weight / map_opacity). Normal roads are drawn first as a
// faint backdrop so the constrained roads read on top.
const GnnConstraintsLayer = memo(function GnnConstraintsLayer({ data }) {
  // One shared canvas surface for the whole layer. Leaflet's default SVG
  // renderer creates a <path> DOM node per feature; at ~3.6k features that is
  // what makes pan/zoom stutter. Scoped to this layer via pathOptions so every
  // other vector layer keeps its SVG rendering (and its CSS styling).
  const renderer = useMemo(() => L.canvas({ padding: 0.5 }), []);

  // Sorting and projecting ~3.6k features is far too expensive to redo on every
  // parent render, and MapArea re-renders on every drawing/dispatch/picking
  // state change. Keyed on `data`, which only changes on refetch.
  const ordered = useMemo(() => {
    const features = data?.constraints?.features;
    if (!features?.length) return [];
    return [...features]
      .sort((a, b) => {
        const an = a.properties?.display_constraint_type === "normal" ? 0 : 1;
        const bn = b.properties?.display_constraint_type === "normal" ? 0 : 1;
        return an - bn;
      })
      .map((f, i) => {
        const props = f.properties || {};
        return {
          key: `gc-${props.road_id ?? i}-${i}`,
          props,
          isNormal: props.display_constraint_type === "normal",
          positions: f.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
        };
      });
  }, [data]);

  if (!ordered.length) return null;

  return (
    <>
      {ordered.map(({ key, props, isNormal, positions }) => {
        const color = props.map_color || NORMAL_ROAD_COLOR;
        const weight = props.map_weight || 2;
        const opacity = props.map_opacity ?? 0.85;

        // The ~1.9k unconstrained roads are a faint backdrop over a basemap
        // that already draws them. Their tooltip would only ever read
        // "normal · Avoidance ×1", so skip the tooltip and the hit-testing.
        if (isNormal) {
          return (
            <Polyline
              key={key}
              positions={positions}
              pathOptions={{
                color,
                weight,
                opacity,
                renderer,
                interactive: false,
              }}
            />
          );
        }

        const confidence =
          props.hover_confidence_text ||
          (props.final_display_confidence_pct != null
            ? `Confidence ${props.final_display_confidence_pct.toFixed(0)}%`
            : null);

        return (
          <Polyline
            key={key}
            positions={positions}
            pathOptions={{ color, weight, opacity, renderer }}
          >
            <Tooltip sticky className="leaflet-dark-tooltip">
              <div className="tooltip-id" style={{ color }}>
                {props.display_label || props.display_constraint_type}
              </div>
              {(props.name || props.barangay) && (
                <div className="tooltip-sub">
                  {[props.name, props.barangay].filter(Boolean).join(" · ")}
                </div>
              )}
              <div className="tooltip-sub">
                Avoidance ×{props.routing_multiplier ?? 1}
                {confidence ? ` · ${confidence}` : ""}
                {props.custom ? " · custom" : ""}
              </div>
            </Tooltip>
          </Polyline>
        );
      })}
    </>
  );
});

// Legend driven by the server-built meta.legend (already sorted, and covering
// the GAT-only prediction buckets the style config doesn't define). Normal
// roads are the faint backdrop and are omitted from the legend.
function GnnLegend({ data }) {
  const items = (data?.meta?.legend || []).filter((it) => it.type !== "normal");

  return (
    <div className="gnn-legend">
      <div className="gnn-legend-title">
        {data?.meta?.model || "GAT"} Predicted Constraints
      </div>
      {items.map((it) => (
        <div key={it.type} className="gnn-legend-item">
          <span className="gnn-legend-swatch" style={{ background: it.color }} />
          {it.label} ({it.count})
        </div>
      ))}
      <div className="gnn-legend-count">
        {data?.meta?.constrained ?? 0} / {data?.meta?.total ?? 0} roads constrained
      </div>
    </div>
  );
}

// ── Constraint types ─────────────────────────────────────────────────────────
const CONSTRAINT_TYPES = [
  {
    id: "narrow_road",
    label: "Narrow Road",
    color: NARROW_ROAD_COLOR,
    symbol: "⊘",
  },
  {
    id: "traffic_area",
    label: "Traffic Crowded Area",
    color: TRAFFIC_AREA_COLOR,
    symbol: "◈",
  },
];

// ── Draw-mode click handler (multi-click polyline) ──────────────────────────
function DrawClickHandler({ active, onPoint }) {
  useMapEvents({
    click(e) {
      if (active) onPoint([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

// ── Live preview polyline while drawing ─────────────────────────────────────
function DrawPreview({ points, color }) {
  if (points.length < 1) return null;
  return (
    <>
      <Polyline
        positions={points}
        pathOptions={{ color, weight: 4, opacity: 0.9, dashArray: "8 6" }}
      />
      {points.map((p, i) => (
        <Marker
          key={`draw-pt-${i}`}
          position={p}
          icon={L.divIcon({
            className: "",
            iconSize: [12, 12],
            iconAnchor: [6, 6],
            html: `<div class="draw-vertex" style="border-color:${color}"></div>`,
          })}
        />
      ))}
    </>
  );
}

// ── Constraint editor panel (appears when GNN Constraints layer is active) ──
function ConstraintEditorPanel({
  drawingType,
  onStartDraw,
  onCancelDraw,
  customConstraints,
  onDelete,
  onEdit,
}) {
  return (
    <div className="constraint-editor">
      <div className="constraint-editor-title">Constraint Editor</div>

      {!drawingType && (
        <div className="constraint-editor-types">
          {CONSTRAINT_TYPES.map((t) => (
            <button
              key={t.id}
              className="constraint-draw-btn"
              onClick={() => onStartDraw(t.id)}
            >
              {/* <span className="constraint-draw-symbol">{t.symbol}</span> */}
              Draw {t.label}
            </button>
          ))}
        </div>
      )}

      {drawingType && (
        <div className="constraint-drawing-hint">
          Click on map to draw points.
          <br />
          Press <strong>Enter</strong> to save, <strong>Esc</strong> to cancel.
        </div>
      )}

      {customConstraints.length > 0 && !drawingType && (
        <div className="constraint-list">
          <div className="constraint-list-title">
            Custom ({customConstraints.length})
          </div>
          {customConstraints.map((c) => {
            const info =
              CONSTRAINT_TYPES.find((t) => t.id === c.constraint_type) ||
              CONSTRAINT_TYPES[0];
            return (
              <div key={c.id} className="constraint-list-item">
                <span
                  className="constraint-item-swatch"
                  style={{ background: info.color }}
                />
                <span className="constraint-item-name">
                  {c.name || "Unnamed"}
                </span>
                <button
                  className="constraint-item-btn"
                  title="Edit"
                  onClick={() => onEdit(c)}
                >
                  ✎
                </button>
                <button
                  className="constraint-item-btn constraint-item-btn--del"
                  title="Delete"
                  onClick={() => onDelete(c.id)}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Save dialog after drawing is complete ───────────────────────────────────
function ConstraintSaveDialog({
  constraintType,
  onSave,
  onCancel,
  editingConstraint,
}) {
  const [name, setName] = useState(editingConstraint?.name || "");
  const [highway, setHighway] = useState(editingConstraint?.highway || "");
  const [surface, setSurface] = useState(editingConstraint?.surface || "");
  const [maxspeed, setMaxspeed] = useState(editingConstraint?.maxspeed || "");
  const info =
    CONSTRAINT_TYPES.find((t) => t.id === constraintType) ||
    CONSTRAINT_TYPES[0];

  return (
    <div className="constraint-save-dialog">
      <div className="constraint-save-title" style={{ color: info.color }}>
        {info.symbol} {editingConstraint ? "Edit" : "Save"} {info.label}
      </div>
      <label className="constraint-field">
        <span>Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Rizal Ave segment"
        />
      </label>
      <label className="constraint-field">
        <span>Highway type</span>
        <input
          value={highway}
          onChange={(e) => setHighway(e.target.value)}
          placeholder="e.g. residential"
        />
      </label>
      <label className="constraint-field">
        <span>Surface</span>
        <input
          value={surface}
          onChange={(e) => setSurface(e.target.value)}
          placeholder="e.g. asphalt"
        />
      </label>
      <label className="constraint-field">
        <span>Max speed (km/h)</span>
        <input
          value={maxspeed}
          onChange={(e) => setMaxspeed(e.target.value)}
          placeholder="e.g. 30"
        />
      </label>
      <div className="constraint-save-actions">
        <button
          className="constraint-save-btn"
          onClick={() => onSave({ name, highway, surface, maxspeed })}
        >
          {editingConstraint ? "Update" : "Save"}
        </button>
        <button className="constraint-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function personnelStatusColor(status) {
  if (status === "dispatched")
    return { color: "var(--accent-amber)", shadow: "rgba(255,176,32,0.5)" };
  if (status === "onscene")
    return { color: "var(--accent-fire)", shadow: "rgba(255,77,26,0.5)" };
  return { color: "var(--accent-green)", shadow: "rgba(0,230,118,0.5)" };
}

// Splits a [lat, lon] polyline at the point nearest `pt` ([lat, lon]) so the
// dispatcher can see truck progress: the part behind the truck (traveled) and
// the part still ahead (remaining). Projection is done in a local planar frame
// (metres) — accurate at city scale. Mirrors the mobile updateRouteProgress
// guard: if the truck is more than 60 m from the line (off route) the whole
// path is returned as `remaining` so it stays fully visible until they rejoin.
function splitRouteAtPoint(line, pt) {
  if (!line || line.length < 2 || !pt) {
    return { traveled: [], remaining: line || [] };
  }
  const D2R = Math.PI / 180;
  const lat0 = pt[0] * D2R;
  const mx = (lon) => lon * D2R * Math.cos(lat0) * 6371000;
  const my = (lat) => lat * D2R * 6371000;
  const px = mx(pt[1]);
  const py = my(pt[0]);

  let best = { i: 0, point: line[0], d: Infinity };
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const ax = mx(a[1]);
    const ay = my(a[0]);
    const dx = mx(b[1]) - ax;
    const dy = my(b[0]) - ay;
    const L2 = dx * dx + dy * dy;
    let t = L2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / L2;
    t = Math.max(0, Math.min(1, t));
    const ex = px - (ax + dx * t);
    const ey = py - (ay + dy * t);
    const d = Math.sqrt(ex * ex + ey * ey);
    if (d < best.d) {
      const point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      best = { i, point, d };
    }
  }

  if (best.d > 60) return { traveled: [], remaining: line };
  return {
    traveled: [...line.slice(0, best.i + 1), best.point],
    remaining: [best.point, ...line.slice(best.i + 1)],
  };
}

// Picks the live location for a dispatch that is furthest along the route, so a
// multi-person crew on one truck trims from the lead position rather than a
// straggler. Returns the [lat, lon] to split at, or null when none is on route.
// Stale positions are ignored — an outdated fix (e.g. a crew that was already
// near the incident) shouldn't trim the route; it falls back to the full
// station→incident line instead.
function truckProgressPoint(line, dispatchId, liveLocations) {
  const candidates = liveLocations.filter(
    (p) =>
      p.dispatch_id === dispatchId &&
      !p.is_stale &&
      p.latitude != null &&
      p.longitude != null
  );
  if (!candidates.length) return null;

  let best = null;
  for (const p of candidates) {
    const pt = [p.latitude, p.longitude];
    const { traveled } = splitRouteAtPoint(line, pt);
    if (!best || traveled.length > best.progress) {
      best = { pt, progress: traveled.length };
    }
  }
  // progress <= 1 means no segment was consumed (truck off route / at start).
  return best && best.progress > 1 ? best.pt : null;
}

export default function MapArea({
  pickingMode = false,
  onLocationPicked,
  pickedLocation,
  onLogIncidentHere,
  activeIncidents = [],
  newIncidents = [],
  reporterLocations = [],
  stations = [],
  personnel = [],
  livePersonnelLocations = [],
  dispatchRoutes = [],
  dispatches = [],
  focusedIncidentId = null,
  ripplingIncidentId = null,
  onIncidentClick,
  leftCollapsed = false,
  rightCollapsed = false,
  viewMode = "normal",
  focusedPersonnel = null,
}) {
  const leftOffset = leftCollapsed ? 52 + 12 : 280 + 12;
  const rightOffset = rightCollapsed ? 32 + 12 : 300 + 12;
  const activeLayers =
    viewMode === "gnn"
      ? new Set(["GNN Constraints"])
      : viewMode === "heatmap"
      ? new Set(["Heat Map"])
      : viewMode === "barangay"
      ? new Set(["Barangay"])
      : new Set(["Incidents", "Personnel", "Stations", "Routes"]);
  const [tileMode, setTileMode] = useState(
    () => localStorage.getItem("tileMode") ?? "dark"
  );
  const [heatPoints, setHeatPoints] = useState([]);

  // ── GNN constraints ────────────────────────────────────────────────────────
  const [gnnData, setGnnData] = useState(null);

  useEffect(() => {
    if (!activeLayers.has("GNN Constraints") || gnnData) return;
    fetchGnnConstraints()
      .then(setGnnData)
      .catch((err) => console.error("GNN constraints fetch failed:", err));
  }, [activeLayers, gnnData]);

  // ── Custom constraint drawing ─────────────────────────────────────────────
  const [customConstraints, setCustomConstraints] = useState([]);
  const [drawingType, setDrawingType] = useState(null); // "narrow_road" | "traffic_area" | null
  const [drawPoints, setDrawPoints] = useState([]); // [[lat, lon], ...]
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [editingConstraint, setEditingConstraint] = useState(null);

  useEffect(() => {
    if (!activeLayers.has("GNN Constraints")) return;
    fetchConstraints()
      .then(setCustomConstraints)
      .catch((err) => console.error("Custom constraints fetch failed:", err));
  }, [activeLayers]);

  // Keyboard: Enter to finish drawing, Esc to cancel
  useEffect(() => {
    if (!drawingType) return;
    function handleKey(e) {
      if (e.key === "Enter" && drawPoints.length >= 2) {
        setShowSaveDialog(true);
      } else if (e.key === "Escape") {
        setDrawingType(null);
        setDrawPoints([]);
        setEditingConstraint(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [drawingType, drawPoints]);

  function handleDrawPoint(latlng) {
    if (!drawingType || showSaveDialog) return;
    setDrawPoints((prev) => [...prev, latlng]);
  }

  async function handleSaveConstraint(fields) {
    const coords = drawPoints.map(([lat, lon]) => [lon, lat]); // GeoJSON is [lon, lat]
    const body = {
      constraint_type: drawingType,
      coordinates: coords,
      ...fields,
    };
    try {
      if (editingConstraint) {
        const updated = await updateConstraint(editingConstraint.id, body);
        setCustomConstraints((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
      } else {
        const saved = await createConstraint(body);
        setCustomConstraints((prev) => [saved, ...prev]);
      }
      setGnnData(null); // force refetch to include the new constraint
    } catch (err) {
      console.error("Save constraint failed:", err);
    }
    setDrawingType(null);
    setDrawPoints([]);
    setShowSaveDialog(false);
    setEditingConstraint(null);
  }

  async function handleDeleteConstraint(id) {
    try {
      await deleteConstraint(id);
      setCustomConstraints((prev) => prev.filter((c) => c.id !== id));
      setGnnData(null);
    } catch (err) {
      console.error("Delete constraint failed:", err);
    }
  }

  function handleEditConstraint(c) {
    setEditingConstraint(c);
    setDrawingType(c.constraint_type);
    setDrawPoints(c.coordinates.map(([lon, lat]) => [lat, lon]));
  }

  const isDrawing = !!drawingType && !showSaveDialog;
  const drawColor =
    CONSTRAINT_TYPES.find((t) => t.id === drawingType)?.color || "#fff";

  // ── Road obstructions ──────────────────────────────────────────────────────
  const [obstructions, setObstructions] = useState([]);
  const [placingType, setPlacingType] = useState(null);
  const [showObstructions, setShowObstructions] = useState(true);

  useEffect(() => {
    fetchObstructions()
      .then(setObstructions)
      .catch(() => {});
  }, []);

  function handleObstructionPlace(latlng) {
    if (!placingType) return;
    const temp = {
      id: `local-${Date.now()}`,
      type: placingType,
      latitude: latlng[0],
      longitude: latlng[1],
      description: "",
      created_at: new Date().toISOString(),
    };
    setObstructions((prev) => [...prev, temp]);
    createObstruction({
      type: placingType,
      latitude: latlng[0],
      longitude: latlng[1],
    })
      .then((saved) => {
        setObstructions((prev) =>
          prev.map((o) => (o.id === temp.id ? { ...temp, ...saved } : o))
        );
      })
      .catch(() => {});
    setPlacingType(null);
  }

  function handleObstructionDelete(id) {
    setObstructions((prev) => prev.filter((o) => o.id !== id));
    deleteObstruction(id).catch(() => {});
  }

  // Briefly raise the z-index of a personnel marker whenever its live
  // location changes, so the updated marker pops above its neighbors.
  const [mapZoom, setMapZoom] = useState(ZOOM);
  const [recentlyUpdatedIds, setRecentlyUpdatedIds] = useState(() => new Set());
  const prevLiveRef = useRef(new Map());
  useEffect(() => {
    const prev = prevLiveRef.current;
    const changed = [];
    for (const p of livePersonnelLocations) {
      const prior = prev.get(p.per_id);
      if (
        !prior ||
        prior.latitude !== p.latitude ||
        prior.longitude !== p.longitude
      ) {
        changed.push(p.per_id);
      }
    }
    prevLiveRef.current = new Map(
      livePersonnelLocations.map((p) => [p.per_id, p])
    );
    if (changed.length === 0) return;
    setRecentlyUpdatedIds((s) => {
      const next = new Set(s);
      changed.forEach((id) => next.add(id));
      return next;
    });
    const timers = changed.map((id) =>
      setTimeout(() => {
        setRecentlyUpdatedIds((s) => {
          if (!s.has(id)) return s;
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }, 2500)
    );
    return () => timers.forEach(clearTimeout);
  }, [livePersonnelLocations]);

  useEffect(() => {
    if (!activeLayers.has("Heat Map") || heatPoints.length) return;
    fetchHeatmap()
      .then(setHeatPoints)
      .catch((err) => console.error("Heatmap fetch failed:", err));
  }, [activeLayers, heatPoints.length]);

  // ── Barangay boundaries ────────────────────────────────────────────────────
  const [barangays, setBarangays] = useState(null);
  useEffect(() => {
    if (!activeLayers.has("Barangay") || barangays) return;
    fetchBarangays()
      .then(setBarangays)
      .catch((err) => console.error("Barangay fetch failed:", err));
  }, [activeLayers, barangays]);

  return (
    <div className="map-area">
      {/* Picking-mode banner */}
      {pickingMode && (
        <div className="map-pick-banner">
          {pickedLocation
            ? `${pickedLocation[0].toFixed(4)}, ${pickedLocation[1].toFixed(
                4
              )}  ·  Click elsewhere to reposition`
            : "Click on the map to mark the Incident location  -  ESC to cancel"}
        </div>
      )}

      {/* Constraint drawing banner */}
      {isDrawing && !pickingMode && (
        <div
          className="map-pick-banner constraint-draw-banner"
          style={{ borderColor: drawColor }}
        >
          {CONSTRAINT_TYPES.find((t) => t.id === drawingType)?.symbol} Drawing{" "}
          {CONSTRAINT_TYPES.find((t) => t.id === drawingType)?.label}
          {" · "}
          {drawPoints.length} point{drawPoints.length !== 1 ? "s" : ""}
          {drawPoints.length >= 2
            ? " · Press Enter to save"
            : " · Click to add points"}
          {drawPoints.length > 0 && (
            <>
              {"  ·  "}
              <span
                className="banner-action"
                onClick={() => setDrawPoints((p) => p.slice(0, -1))}
              >
                Undo
              </span>
            </>
          )}
          {"  ·  "}
          <span
            className="banner-action"
            onClick={() => {
              setDrawingType(null);
              setDrawPoints([]);
              setEditingConstraint(null);
            }}
          >
            Cancel
          </span>
        </div>
      )}

      {/* Obstruction placement banner */}
      {placingType && !pickingMode && (
        <div
          className="map-pick-banner"
          style={{
            borderColor: OBSTRUCTION_TYPES.find((t) => t.id === placingType)
              ?.color,
          }}
        >
          {OBSTRUCTION_TYPES.find((t) => t.id === placingType)?.symbol} Click on
          the map to place{" "}
          {OBSTRUCTION_TYPES.find(
            (t) => t.id === placingType
          )?.label.toLowerCase()}
          {"  ·  "}
          <span
            style={{ cursor: "pointer", textDecoration: "underline" }}
            onClick={() => setPlacingType(null)}
          >
            Cancel
          </span>
        </div>
      )}

      <MapContainer
        center={PANABO_CENTER}
        zoom={ZOOM}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        {TILE_OPTIONS.find((t) => t.id === tileMode).layers.map((layer, i) => (
          <TileLayer key={`${tileMode}-${i}`} {...layer} />
        ))}

        {/* Picking-mode handlers */}
        <MapClickHandler
          active={pickingMode}
          onPick={onLocationPicked}
          obstructionActive={!!placingType}
          onObstructionPick={handleObstructionPlace}
        />
        <DrawClickHandler active={isDrawing} onPoint={handleDrawPoint} />
        <CursorController active={pickingMode || !!placingType || isDrawing} />

        <PersonnelFocuser
          focusedPersonnel={focusedPersonnel}
          livePersonnelLocations={livePersonnelLocations}
        />

        {/* Live preview of constraint being drawn */}
        {isDrawing && <DrawPreview points={drawPoints} color={drawColor} />}

        {/* Coverage mask + jurisdiction boundary */}
        {viewMode !== "barangay" && <CoverageLayers />}

        {/* Weighted KDE heatmap */}
        {activeLayers.has("Heat Map") && <HeatmapLayer points={heatPoints} />}

        {/* GNN constraint overlays (road network, narrow roads, traffic areas) */}
        {activeLayers.has("GNN Constraints") && gnnData && (
          <GnnConstraintsLayer data={gnnData} />
        )}

        {/* Barangay boundary overlay with centered labels */}
        {activeLayers.has("Barangay") && barangays && (
          <BarangayLayer
            featureCollection={barangays}
            showLabels={mapZoom >= BARANGAY_LABEL_MIN_ZOOM}
          />
        )}

        {/* Connector paths — amber dashed lines for deviated personnel.
            Rendered BEFORE dispatch routes so the route always paints on top.
            Only render for personnel dispatched to the focused incident,
            mirroring the dispatch-route visibility rules. */}
        {activeLayers.has("Personnel") &&
          (() => {
            const focusedDispatchIds =
              focusedIncidentId != null
                ? new Set(
                    dispatches
                      .filter((d) => d.fire_id === focusedIncidentId)
                      .map((d) => d.dispatch_id)
                  )
                : null;
            return livePersonnelLocations
              .filter(
                (p) =>
                  p.is_deviated &&
                  p.connector_geojson?.coordinates?.length >= 2 &&
                  (focusedDispatchIds === null ||
                    focusedDispatchIds.has(p.dispatch_id))
              )
              .map((p) => {
                const positions = p.connector_geojson.coordinates.map(
                  ([lon, lat]) => [lat, lon]
                );
                return (
                  <Polyline
                    key={`connector-${p.per_id}`}
                    positions={positions}
                    pathOptions={{
                      color: "#ffb020",
                      weight: 1,
                      dashArray: "10 6",
                      opacity: 0.95,
                    }}
                  >
                    <Tooltip sticky className="leaflet-dark-tooltip">
                      <div className="tooltip-id">Connector · {p.name}</div>
                      <div className="tooltip-sub">
                        Follow amber path to rejoin route
                      </div>
                    </Tooltip>
                  </Polyline>
                );
              });
          })()}

        {/* Dispatch routes — only show routes for the selected incident.
            Selected route gets a palette color; alternatives render in gray behind it. */}
        {activeLayers.has("Routes") &&
          (() => {
            const ROUTE_COLORS = [
              "#22c55e",
              "#38bdf8",
              "#f472b6",
              "#a78bfa",
              "#fb923c",
              "#34d399",
              "#facc15",
              "#60a5fa",
            ];
            const visible =
              focusedIncidentId != null
                ? dispatchRoutes.filter((r) => r.fire_id === focusedIncidentId)
                : dispatchRoutes;

            // Unique dispatch IDs in original order for color assignment
            const dispatchIds = [
              ...new Set(dispatchRoutes.map((r) => r.dispatch_id)),
            ];

            // Map fire_id → incident so a route matches its incident-pin color
            const incById = new Map(activeIncidents.map((i) => [i.fire_id, i]));

            // Alternatives first so selected paints on top
            const sorted = [...visible].sort((a, b) =>
              a.isSelected === b.isSelected ? 0 : a.isSelected ? 1 : -1
            );

            return sorted.map((dr) => {
              // Route color matches its incident's pin (by severity); fall back
              // to the palette if the incident isn't in the active list.
              const inc = incById.get(dr.fire_id);
              const colorIdx = dispatchIds.indexOf(dr.dispatch_id);
              const color = inc
                ? severityColor(inc)
                : ROUTE_COLORS[colorIdx % ROUTE_COLORS.length];
              const isAlt = !dr.isSelected;

              const mainStyle = dr.isGnn
                ? { color, weight: 5, opacity: 0.8 }
                : { color, weight: 4, dashArray: "8 5", opacity: 0.8 };

              const tooltip = (
                <Tooltip sticky className="leaflet-dark-tooltip">
                  <div className="tooltip-id">
                    {isAlt
                      ? `Alt Route (Rank ${dr.rank})`
                      : dr.isGnn
                      ? "GNN Route"
                      : "Dispatch Route"}
                  </div>
                  <div className="tooltip-sub">{dr.teamName}</div>
                  {dr.etaMinutes && (
                    <div className="tooltip-sub">ETA ~{dr.etaMinutes} min</div>
                  )}
                </Tooltip>
              );

              // Alternatives are not being driven — always show the full path.
              if (isAlt) {
                return (
                  <Polyline
                    key={dr.id}
                    positions={dr.positions}
                    pathOptions={{ color: "#888", weight: 2, opacity: 0.5 }}
                  >
                    {tooltip}
                  </Polyline>
                );
              }

              // Selected route: trim at the truck's live position so the line
              // shrinks as the crew makes progress. Traveled part stays as a
              // faint ghost for context; remaining part keeps the full style.
              const truckPt = truckProgressPoint(
                dr.positions,
                dr.dispatch_id,
                livePersonnelLocations
              );
              const { traveled, remaining } = splitRouteAtPoint(
                dr.positions,
                truckPt
              );

              return (
                <Fragment key={dr.id}>
                  {traveled.length >= 2 && (
                    <Polyline
                      positions={traveled}
                      pathOptions={{
                        color,
                        weight: 3,
                        opacity: 0.25,
                        dashArray: "4 6",
                      }}
                    />
                  )}
                  <Polyline positions={remaining} pathOptions={mainStyle}>
                    {tooltip}
                  </Polyline>
                </Fragment>
              );
            });
          })()}

        {/* Fire stations */}
        {activeLayers.has("Stations") &&
          stations
            .filter((s) => s.station_latitude && s.station_longitude)
            .map((s) => (
              <Marker
                key={s.station_id}
                position={[s.station_latitude, s.station_longitude]}
                icon={stationIcon()}
              >
                <Tooltip direction="top" className="leaflet-dark-tooltip">
                  {s.station_name}
                  {s.station_barangay ? ` · ${s.station_barangay}` : ""}
                </Tooltip>
              </Marker>
            ))}

        {/* Incident markers — live (active / en route / contained) */}
        {activeLayers.has("Incidents") &&
          activeIncidents.map((inc) => (
            <Marker
              key={`${inc.fire_id}-${inc.fire_id === ripplingIncidentId}`}
              position={[inc.latitude, inc.longitude]}
              icon={fireIcon(
                toIconSeverity(inc),
                inc.fire_id === ripplingIncidentId
              )}
              eventHandlers={{
                click: () => onIncidentClick?.(inc.id),
              }}
            >
              <Tooltip
                permanent={
                  inc.status === "active" &&
                  inc.sev?.toLowerCase() === "critical"
                }
                direction="top"
                className="leaflet-dark-tooltip"
              >
                <div className="tooltip-id">
                  {inc.id} · {inc.status.toUpperCase()}
                </div>
                <div className="tooltip-name">🔥 {inc.loc}</div>
                <div className="tooltip-sub">
                  {inc.sev} · {inc.alarm} · {inc.units} unit
                  {inc.units !== 1 ? "s" : ""}
                </div>
              </Tooltip>
            </Marker>
          ))}

        <ZoomTracker onZoom={setMapZoom} />

        {/* Personnel markers — prefer live locations from polling; fall back to personnel list */}
        {activeLayers.has("Personnel") &&
          mapZoom >= PERSONNEL_MIN_ZOOM &&
          (() => {
            // Build a lookup from per_id → live location entry
            const liveById = Object.fromEntries(
              livePersonnelLocations.map((p) => [p.per_id, p])
            );

            return personnel
              .map((p) => {
                const live = liveById[p.per_id];
                // Don't render personnel whose last known location is older
                // than 8 hours — treat them as no longer on the map.
                if (
                  live?.age_minutes != null &&
                  live.age_minutes >= PERSONNEL_STALE_HIDE_MINUTES
                ) {
                  return null;
                }
                const lat = live?.latitude ?? p.latitude;
                const lon = live?.longitude ?? p.longitude;
                if (!lat || !lon) return null;
                const { color, shadow } = personnelStatusColor(p.status);
                const deviated = live?.is_deviated ?? false;
                const stale = live?.is_stale ?? false;
                const ageText = live ? `${live.age_minutes} min ago` : null;
                return (
                  <Marker
                    key={p.per_id}
                    position={[lat, lon]}
                    icon={personnelIcon(
                      p.initials,
                      stale ? "#555" : color,
                      stale ? "rgba(80,80,80,0.3)" : shadow,
                      deviated
                    )}
                    zIndexOffset={recentlyUpdatedIds.has(p.per_id) ? 1000 : 0}
                  >
                    <Tooltip direction="top" className="leaflet-dark-tooltip">
                      <div className="tooltip-id">
                        {p.name} · {p.rank}
                        {deviated ? " · ⚠ Off Route" : ""}
                      </div>
                      <div className="tooltip-sub">{p.station}</div>
                      {ageText && (
                        <div
                          className="tooltip-sub"
                          style={stale ? { color: "#ff6b6b" } : {}}
                        >
                          Last seen {ageText}
                          {stale ? " (stale)" : ""}
                        </div>
                      )}
                    </Tooltip>
                  </Marker>
                );
              })
              .filter(Boolean);
          })()}

        {/* Newly logged incidents */}
        {newIncidents.map((inc) => (
          <Marker
            key={inc.id}
            position={inc.coords}
            icon={fireIcon(inc.severity || "critical", false, true)}
            eventHandlers={{
              click: () => onIncidentClick?.(inc.id),
            }}
          >
            <Tooltip direction="top" className="leaflet-dark-tooltip">
              <div className="tooltip-id">{inc.id} · NEW</div>
              <div className="tooltip-name">🔥 {inc.locationName}</div>
              <div className="tooltip-sub">
                {inc.severity} · {inc.alarm}
              </div>
            </Tooltip>
          </Marker>
        ))}

        {/* Reporter location markers */}
        {reporterLocations.map((r) => (
          <Marker key={r.token} position={r.coords} icon={reporterIcon()}>
            <Tooltip direction="top" className="leaflet-dark-tooltip">
              <div className="tooltip-id request-token">{r.token}</div>
              <div className="tooltip-name">Reporter Location</div>
              <div className="tooltip-sub">
                {r.coords[0].toFixed(5)}, {r.coords[1].toFixed(5)}
              </div>
              <div className="tooltip-sub">Click to log incident</div>
            </Tooltip>
            <Popup className="reporter-popup">
              <div className="reporter-popup-inner">
                <div className="reporter-popup-header">
                  {/* <span>📱</span> */}
                  <strong>Reporter Location</strong>
                </div>
                <div className="reporter-popup-coords">
                  {r.coords[0].toFixed(5)}, {r.coords[1].toFixed(5)}
                </div>
                {r.mobile && (
                  <div className="reporter-popup-phone">{r.mobile}</div>
                )}
                <button
                  className="reporter-log-btn"
                  onClick={() => onLogIncidentHere?.(r.coords, r.mobile, r.token)}
                >
                  Log Incident
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Picked location preview pin */}
        {pickedLocation && (
          <Marker position={pickedLocation} icon={newIncidentIcon()} />
        )}

        {/* Road obstructions */}
        {showObstructions &&
          obstructions.map((obs) => {
            const info =
              OBSTRUCTION_TYPES.find((t) => t.id === obs.type) ||
              OBSTRUCTION_TYPES[0];
            return (
              <Marker
                key={obs.id}
                position={[obs.latitude, obs.longitude]}
                icon={obstructionIcon(obs.type)}
              >
                <Popup className="obstruction-popup">
                  <div className="obstruction-popup-inner">
                    <div className="obstruction-popup-header">
                      <span>{info.symbol}</span>
                      <strong style={{ color: info.color }}>
                        {info.label}
                      </strong>
                    </div>
                    <div className="obstruction-popup-coords">
                      {obs.latitude.toFixed(5)}, {obs.longitude.toFixed(5)}
                    </div>
                    {obs.description && (
                      <div className="obstruction-popup-desc">
                        {obs.description}
                      </div>
                    )}
                    <button
                      className="obstruction-remove-btn"
                      onClick={() => handleObstructionDelete(obs.id)}
                    >
                      Remove
                    </button>
                  </div>
                </Popup>
                <Tooltip direction="top" className="leaflet-dark-tooltip">
                  <div className="tooltip-id">
                    {info.symbol} {info.label}
                  </div>
                  <div className="tooltip-sub">Click for details</div>
                </Tooltip>
              </Marker>
            );
          })}
      </MapContainer>

      {/* GNN legend */}
      {activeLayers.has("GNN Constraints") && gnnData && (
        <GnnLegend data={gnnData} />
      )}

      {/* Constraint save dialog */}
      {showSaveDialog && (
        <ConstraintSaveDialog
          constraintType={drawingType}
          editingConstraint={editingConstraint}
          onSave={handleSaveConstraint}
          onCancel={() => {
            setShowSaveDialog(false);
            setDrawingType(null);
            setDrawPoints([]);
            setEditingConstraint(null);
          }}
        />
      )}

      {/* Bottom-right area: constraint editor (GNN mode) OR obstacles (normal mode) */}
      <div
        className="tile-switcher tile-switcher--right"
        style={{ right: rightOffset, transition: "right 0.2s ease" }}
      >
        {activeLayers.has("GNN Constraints") ? (
          <ConstraintEditorPanel
            drawingType={drawingType}
            onStartDraw={(type) => {
              setDrawingType(type);
              setDrawPoints([]);
              setEditingConstraint(null);
            }}
            onCancelDraw={() => {
              setDrawingType(null);
              setDrawPoints([]);
              setEditingConstraint(null);
            }}
            customConstraints={customConstraints}
            onDelete={handleDeleteConstraint}
            onEdit={handleEditConstraint}
          />
        ) : null}
      </div>
    </div>
  );
}
