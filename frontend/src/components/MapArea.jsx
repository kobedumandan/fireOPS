import { useState, useEffect, useMemo } from "react";
import "../styles/MapArea.css";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  GeoJSON,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { PANABO_BOUNDARY } from "../data/panaboBoundary";
import { PANABO_CENTER, PANABO_ZOOM, TILE_OPTIONS } from "../data/mapConfig";
import { fetchHeatmap } from "../api";

const ZOOM = PANABO_ZOOM;

const LAYER_LABELS = [
  "Incidents",
  "Personnel",
  "Stations",
  "Routes",
  "Heat Map",
];


// ── Coordinate data (inside Panabo City) ─────────────────────────────────────
const STATIONS = [
  { id: "s1", pos: [7.312, 125.684], label: "BFP Station 1 · Panabo City" },
  { id: "s2", pos: [7.292, 125.618], label: "BFP Station 2 · Sto. Niño" },
];

const INCIDENTS = [
  {
    id: "INC-2026-084",
    pos: [7.33, 125.667],
    severity: "critical",
    label: "🔥 Brgy. San Francisco",
    sub: "Critical · 2 units · ETA 4 min",
  },
  {
    id: "INC-2026-083",
    pos: [7.352, 125.648],
    severity: "moderate",
    label: "🔥 Brgy. New Visayas",
    sub: "Moderate · 1 unit",
  },
  {
    id: "INC-2026-081",
    pos: [7.295, 125.655],
    severity: "contained",
    label: "🔥 Brgy. Cagangohan",
    sub: "Contained · 3 units",
  },
];

const PERSONNEL = [
  {
    initials: "JD",
    pos: [7.32, 125.675],
    cssColor: "var(--accent-fire)",
    shadow: "rgba(255,77,26,0.5)",
  },
  {
    initials: "MR",
    pos: [7.3, 125.63],
    cssColor: "var(--accent-green)",
    shadow: "rgba(0,230,118,0.5)",
  },
  {
    initials: "AB",
    pos: [7.348, 125.651],
    cssColor: "var(--accent-amber)",
    shadow: "rgba(255,176,32,0.5)",
  },
];

const ROUTES = [
  {
    positions: [
      [7.312, 125.684],
      [7.33, 125.667],
    ],
    color: "#1e90ff",
    cls: "route-primary",
  },
  {
    positions: [
      [7.292, 125.618],
      [7.33, 125.667],
    ],
    color: "#00e676",
    cls: "route-secondary",
  },
];

// ── Picking-mode helpers (must be inside MapContainer) ───────────────────────
function MapClickHandler({ active, onPick }) {
  useMapEvents({
    click(e) {
      if (active) onPick([e.latlng.lat, e.latlng.lng]);
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

function reporterIcon() {
  return L.divIcon({
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<div class="reporter-pin">
             <div class="reporter-pin-ring"></div>
             <div class="reporter-pin-core">R</div>
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
function fireIcon(severity) {
  const color =
    severity === "critical"
      ? "#ff4d1a"
      : severity === "moderate"
      ? "#ffb020"
      : "#2a5a3a";
  const shadow =
    severity === "critical"
      ? "rgba(255,77,26,0.6)"
      : severity === "moderate"
      ? "rgba(255,176,32,0.5)"
      : "rgba(0,230,118,0.3)";
  const opacity = severity === "contained" ? "0.5" : "1";
  const pulse = severity === "critical";

  return L.divIcon({
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `
      <div class="fire-marker" style="opacity:${opacity}">
        ${pulse ? '<div class="fire-pulse-ring"></div>' : ""}
        <div class="fire-marker-inner" style="background:${color};box-shadow:0 0 16px ${shadow}"></div>
      </div>`,
  });
}

function personnelIcon(initials, color, shadow) {
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div class="personnel-marker" style="border-color:${color};color:${color};box-shadow:0 0 10px ${shadow}">${initials}</div>`,
  });
}

function stationIcon() {
  return L.divIcon({
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `<div class="station-marker">🚒</div>`,
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
      <GeoJSON
        key="mask-dark"
        data={maskFeature}
        style={() => ({
          fillColor: "#060810",
          fillOpacity: 0.72,
          stroke: false,
        })}
      />

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
          color: "#1e90ff",
          weight: 2,
          opacity: 0.85,
        })}
      />
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

    console.log('Heatmap density range:',
      Math.min(...data.map(d => d[2])),
      'to',
      Math.max(...data.map(d => d[2]))
    );
    console.log('Sample points:', data.slice(0, 5));

    const layer = L.heatLayer(data, {
      radius:     25,
      blur:       18,
      minOpacity: 0.35,
      maxZoom:    17,
      max:        5.0,
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

// ── Main component ────────────────────────────────────────────────────────────
export default function MapArea({
  pickingMode = false,
  onLocationPicked,
  pickedLocation,
  newIncidents = [],
  reporterLocations = [],
  leftCollapsed = false,
}) {
  const leftOffset = leftCollapsed ? 52 + 12 : 280 + 12;
  const [activeLayers, setActiveLayers] = useState(
    new Set(["Incidents", "Personnel", "Stations", "Routes"])
  );
  const [tileMode, setTileMode] = useState("satellite");
  const [heatPoints, setHeatPoints] = useState([]);

  useEffect(() => {
    if (!activeLayers.has("Heat Map") || heatPoints.length) return;
    fetchHeatmap()
      .then(setHeatPoints)
      .catch(err => console.error("Heatmap fetch failed:", err));
  }, [activeLayers, heatPoints.length]);

  function toggleLayer(label) {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  return (
    <div className="map-area">
      {/* Picking-mode banner */}
      {pickingMode && (
        <div className="map-pick-banner">
          {pickedLocation
            ? `📍 ${pickedLocation[0].toFixed(4)}, ${pickedLocation[1].toFixed(
                4
              )}  ·  Click elsewhere to reposition`
            : "🎯 Click on the map to mark the incident location  ·  ESC to cancel"}
        </div>
      )}

      <MapContainer
        center={PANABO_CENTER}
        zoom={ZOOM}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={true}
      >
        {TILE_OPTIONS.find((t) => t.id === tileMode).layers.map((layer, i) => (
          <TileLayer key={`${tileMode}-${i}`} {...layer} />
        ))}

        {/* Picking-mode handlers */}
        <MapClickHandler active={pickingMode} onPick={onLocationPicked} />
        <CursorController active={pickingMode} />

        {/* Coverage mask + jurisdiction boundary */}
        <CoverageLayers />

        {/* Weighted KDE heatmap */}
        {activeLayers.has("Heat Map") && <HeatmapLayer points={heatPoints} />}

        {/* GNN routes */}
        {activeLayers.has("Routes") &&
          ROUTES.map((r) => (
            <Polyline
              key={r.cls}
              positions={r.positions}
              className={r.cls}
              pathOptions={{
                color: r.color,
                weight: 3,
                dashArray: "10 6",
                opacity: 0.9,
              }}
            />
          ))}

        {/* Fire stations */}
        {activeLayers.has("Stations") &&
          STATIONS.map((s) => (
            <Marker key={s.id} position={s.pos} icon={stationIcon()}>
              <Tooltip direction="top" className="leaflet-dark-tooltip">
                {s.label}
              </Tooltip>
            </Marker>
          ))}

        {/* Incident markers */}
        {activeLayers.has("Incidents") &&
          INCIDENTS.map((inc) => (
            <Marker
              key={inc.id}
              position={inc.pos}
              icon={fireIcon(inc.severity)}
            >
              <Tooltip
                permanent={inc.id === "INC-2026-084"}
                direction="top"
                className="leaflet-dark-tooltip"
              >
                <div className="tooltip-id">{inc.id}</div>
                <div className="tooltip-name">{inc.label}</div>
                <div className="tooltip-sub">{inc.sub}</div>
              </Tooltip>
            </Marker>
          ))}

        {/* Personnel markers */}
        {activeLayers.has("Personnel") &&
          PERSONNEL.map((p) => (
            <Marker
              key={p.initials}
              position={p.pos}
              icon={personnelIcon(p.initials, p.cssColor, p.shadow)}
            />
          ))}

        {/* Newly logged incidents */}
        {newIncidents.map((inc) => (
          <Marker
            key={inc.id}
            position={inc.coords}
            icon={fireIcon("critical")}
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
              <div className="tooltip-id">{r.token}</div>
              <div className="tooltip-name">📱 Reporter Location</div>
              <div className="tooltip-sub">
                {r.coords[0].toFixed(5)}, {r.coords[1].toFixed(5)}
              </div>
            </Tooltip>
          </Marker>
        ))}

        {/* Picked location preview pin */}
        {pickedLocation && (
          <Marker position={pickedLocation} icon={newIncidentIcon()} />
        )}
      </MapContainer>

      {/* Tile switcher — bottom-left, Google Maps style */}
      <div className="tile-switcher" style={{ left: leftOffset, transition: 'left 0.2s ease' }}>
        {TILE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            className={`tile-option${tileMode === opt.id ? " active" : ""}`}
            onClick={() => setTileMode(opt.id)}
            title={opt.label}
          >
            <img
              src={opt.thumb}
              alt={opt.label}
              className="tile-option-thumb"
              draggable={false}
            />
            <span className="tile-option-label">{opt.label}</span>
          </button>
        ))}
      </div>

      {/* Layer toggles */}
      <div className="map-layers" style={{ left: leftOffset, transition: 'left 0.2s ease' }}>
        {LAYER_LABELS.map((label) => (
          <button
            key={label}
            className={`layer-toggle${
              activeLayers.has(label) ? " active" : ""
            }`}
            onClick={() => toggleLayer(label)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
