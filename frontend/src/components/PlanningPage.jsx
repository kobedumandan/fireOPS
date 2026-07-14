import { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/PlanningPage.css";
import { PANABO_CENTER, PANABO_ZOOM } from "../data/mapConfig";
import { fetchCoverageIsochrones, fetchCoverageGaps } from "../api";

const STATUS_COLOR = { covered: "#22c55e", partial: "#f59e0b", gap: "#ef4444" };
const STATUS_LABEL = { covered: "Covered", partial: "Partial", gap: "Gap" };
const MINUTE_OPTIONS = [3, 5, 8];
// Severity order for the Status column: worst (gap) first when ascending.
const STATUS_ORDER = { gap: 0, partial: 1, covered: 2 };

// Clickable, sort-aware table header cell (styled like the Incidents table).
function SortableTh({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey;
  const arrow = !active ? "↕" : sort.dir === "asc" ? "↑" : "↓";
  return (
    <th
      className={active ? "sort-active" : ""}
      onClick={() => onSort(sortKey)}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      {label} <span className="plan-sort-arrow">{arrow}</span>
    </th>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────
function UnfoldIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="plan-unfold-icon"
      fill="currentColor"
    >
      <path d="M480-120 300-300l58-58 122 122 122-122 58 58-180 180ZM358-598l-58-58 180-180 180 180-58 58-122-122-122 122Z" />
    </svg>
  );
}
function StationsKpiIcon() {
  return (
    <svg viewBox="0 -960 960 960" fill="currentColor" className="plan-kpi-icon-svg">
      <path d="M300-240v-360h360v360-360H300v360Zm-60 0h60v-360h360v360h60v-366L480-780 240-606v366Zm120-240h240v-60H360v60Zm120-160q17 0 28.5-11.5T520-680q0-17-11.5-28.5T480-720q-17 0-28.5 11.5T440-680q0 17 11.5 28.5T480-640ZM160-160v-400H39l441-320 440 320H800v400H600v-260H360v260H160Z" />
    </svg>
  );
}
function TargetKpiIcon() {
  return (
    <svg viewBox="0 -960 960 960" fill="currentColor" className="plan-kpi-icon-svg">
      <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-160q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-160Z" />
    </svg>
  );
}
function CheckKpiIcon() {
  return (
    <svg viewBox="0 -960 960 960" fill="currentColor" className="plan-kpi-icon-svg">
      <path d="m424-296 282-282-56-56-226 226-114-114-56 56 170 170ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
    </svg>
  );
}
function AlertKpiIcon() {
  return (
    <svg viewBox="0 -960 960 960" fill="currentColor" className="plan-kpi-icon-svg">
      <path d="M109-120q-11 0-20-5.5T75-140q-5-9-5.5-19.5T75-180l370-640q6-10 15.5-15t19.5-5q10 0 19.5 5t15.5 15l370 640q6 10 5.5 20.5T885-140q-5 9-14 14.5t-20 5.5H109Zm371-120q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm0-120q17 0 28.5-11.5T520-400v-120q0-17-11.5-28.5T480-560q-17 0-28.5 11.5T440-520v120q0 17 11.5 28.5T480-360Z" />
    </svg>
  );
}

function PlanKpi({ icon, label, value, accent = "blue", valueClass = "" }) {
  return (
    <div className="plan-kpi">
      <div className="plan-kpi-head">
        <div className="plan-kpi-label">{label}</div>
        <div className={`plan-kpi-icon plan-kpi-icon-${accent}`}>{icon}</div>
      </div>
      <div className={`plan-kpi-value ${valueClass}`}>{value}</div>
    </div>
  );
}

// Reachability bands, widest painted first so tighter (faster) bands read on top.
function CoverageIsochroneLayer({ features }) {
  const sorted = [...features].sort(
    (a, b) => (b.properties?.max_seconds || 0) - (a.properties?.max_seconds || 0)
  );
  return (
    <>
      {sorted.map((f, i) => {
        const color = f.properties?.color || "#22c55e";
        return (
          <GeoJSON
            key={`iso-${f.properties?.max_seconds ?? i}`}
            data={f}
            style={{
              color,
              weight: 1,
              opacity: 0.55,
              fillColor: color,
              fillOpacity: 0.2,
            }}
          />
        );
      })}
    </>
  );
}

// Fit the map to the coverage extent once it loads.
function FitBounds({ geojson }) {
  const map = useMap();
  useEffect(() => {
    if (!geojson?.features?.length) return;
    const bounds = L.geoJSON(geojson).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24] });
  }, [geojson, map]);
  return null;
}

export default function PlanningPage() {
  const [iso, setIso] = useState(null);
  const [minutes, setMinutes] = useState(5);
  const [gaps, setGaps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Default matches the backend order: least-covered barangays first.
  const [sort, setSort] = useState({ key: "covered_pct", dir: "asc" });

  useEffect(() => {
    // `loading` starts true, so the fetch only needs to clear it on settle.
    fetchCoverageIsochrones()
      .then((d) => {
        setIso(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e?.message || "Failed to load coverage.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchCoverageGaps(minutes)
      .then((r) => setGaps(r?.gaps || []))
      .catch(() => setGaps([]));
  }, [minutes]);

  const meta = iso?.meta || {};
  const features = useMemo(() => iso?.isochrones?.features || [], [iso]);
  const bands = useMemo(
    () =>
      [...features].sort(
        (a, b) => (a.properties?.max_seconds || 0) - (b.properties?.max_seconds || 0)
      ),
    [features]
  );

  const summary = useMemo(() => {
    if (!gaps?.length) return null;
    const n = gaps.length;
    const covered = gaps.filter((g) => g.status === "covered").length;
    const gapCount = gaps.filter((g) => g.status === "gap").length;
    const avg = gaps.reduce((s, g) => s + g.covered_pct, 0) / n;
    return { n, covered, gapCount, avg: Math.round(avg * 10) / 10 };
  }, [gaps]);

  const sortedGaps = useMemo(() => {
    if (!gaps) return gaps;
    const { key, dir } = sort;
    const factor = dir === "asc" ? 1 : -1;
    return [...gaps].sort((a, b) => {
      let cmp;
      if (key === "barangay") {
        cmp = a.barangay.localeCompare(b.barangay);
      } else if (key === "status") {
        cmp = (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0);
      } else {
        cmp = a.covered_pct - b.covered_pct;
      }
      // Stable tie-break by name so equal values keep a consistent order.
      return cmp !== 0 ? cmp * factor : a.barangay.localeCompare(b.barangay);
    });
  }, [gaps, sort]);

  function toggleSort(key) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    );
  }

  function exportCsv() {
    if (!sortedGaps?.length) return;
    const header = `Barangay,Coverage % within ${minutes} min,Status`;
    const lines = sortedGaps.map(
      (g) => `"${g.barangay}",${g.covered_pct},${STATUS_LABEL[g.status] || g.status}`
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coverage_gaps_${minutes}min.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="plan-page">
      <div className="plan-header">
        <div className="plan-title-row">
          <div className="plan-title">
            Planning
            <UnfoldIcon />
          </div>
        </div>
      </div>

      <div className="plan-body">
        {error && <div className="plan-error">{error}</div>}

        <div className="plan-kpi-row">
          <PlanKpi
            icon={<StationsKpiIcon />}
            label="Stations analysed"
            value={loading ? "…" : meta.sources ?? "—"}
            accent="blue"
          />
          <PlanKpi
            icon={<TargetKpiIcon />}
            label={`Avg. coverage ≤${minutes} min`}
            value={summary ? `${summary.avg}%` : "…"}
            accent="amber"
          />
          <PlanKpi
            icon={<CheckKpiIcon />}
            label="Well-covered barangays"
            value={summary ? `${summary.covered}/${summary.n}` : "…"}
            accent="green"
            valueClass="plan-kpi-good"
          />
          <PlanKpi
            icon={<AlertKpiIcon />}
            label="Coverage gaps"
            value={summary ? summary.gapCount : "…"}
            accent="fire"
            valueClass="plan-kpi-bad"
          />
        </div>

        <div className="plan-grid">
          {/* Coverage map */}
          <div className="plan-card plan-map-card">
            <div className="plan-card-head">
              <div className="plan-card-title">Response Coverage Map</div>
              <div className="plan-map-legend">
                {bands.map((f) => (
                  <span key={f.properties?.max_seconds} className="plan-legend-item">
                    <span
                      className="plan-legend-swatch"
                      style={{ background: f.properties?.color }}
                    />
                    {f.properties?.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="plan-map-wrap">
              {loading ? (
                <div className="plan-map-loading">Computing coverage…</div>
              ) : (
                <MapContainer
                  center={PANABO_CENTER}
                  zoom={PANABO_ZOOM}
                  className="plan-map"
                  attributionControl={false}
                  scrollWheelZoom
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    subdomains="abcd"
                  />
                  {features.length > 0 && (
                    <CoverageIsochroneLayer features={features} />
                  )}
                  <FitBounds geojson={iso?.isochrones} />
                </MapContainer>
              )}
            </div>
          </div>

          {/* Coverage gaps table */}
          <div className="plan-card plan-gaps-card">
            <div className="plan-card-head">
              <div className="plan-card-title">Coverage Gaps</div>
              <div className="plan-controls">
                <div className="plan-minutes">
                  {MINUTE_OPTIONS.map((m) => (
                    <button
                      key={m}
                      className={`plan-min-btn${minutes === m ? " active" : ""}`}
                      onClick={() => setMinutes(m)}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
                <button
                  className="plan-export-btn"
                  onClick={exportCsv}
                  disabled={!gaps?.length}
                >
                  Export CSV
                </button>
              </div>
            </div>
            <div className="plan-gaps-sub">
              Barangays reachable within {minutes} min, least-covered first
            </div>
            <div className="plan-table-wrap">
              <table className="plan-table">
                <thead>
                  <tr>
                    <SortableTh
                      label="Barangay"
                      sortKey="barangay"
                      sort={sort}
                      onSort={toggleSort}
                    />
                    <SortableTh
                      label="Coverage"
                      sortKey="covered_pct"
                      sort={sort}
                      onSort={toggleSort}
                    />
                    <SortableTh
                      label="Status"
                      sortKey="status"
                      sort={sort}
                      onSort={toggleSort}
                    />
                  </tr>
                </thead>
                <tbody>
                  {(sortedGaps || []).map((g) => (
                    <tr key={g.barangay}>
                      <td className="plan-td-name">{g.barangay}</td>
                      <td className="plan-td-pct">
                        <div className="plan-bar">
                          <div
                            className="plan-bar-fill"
                            style={{
                              width: `${g.covered_pct}%`,
                              background: STATUS_COLOR[g.status],
                            }}
                          />
                        </div>
                        <span className="plan-pct-num">{g.covered_pct}%</span>
                      </td>
                      <td>
                        <span
                          className="plan-status"
                          style={{ color: STATUS_COLOR[g.status] }}
                        >
                          ● {STATUS_LABEL[g.status] || g.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {gaps && gaps.length === 0 && (
                    <tr>
                      <td colSpan={3} className="plan-empty">
                        No barangay coverage data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
