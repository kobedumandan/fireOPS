import { useState, useEffect, useRef } from "react";
import "../styles/IncidentsPage.css";
import LogIncidentModal from "./LogIncidentModal";
import EditIncidentModal from "./EditIncidentModal";
import ConfirmModal from "./ConfirmModal";
import {
  fetchIncidents,
  createIncident,
  deleteIncident,
  fetchIncidentReport,
} from "../api";

function ExportIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="meta-icon"
      fill="currentColor"
    >
      <path d="m648-140 112-112v92h40v-160H640v40h92L620-168l28 28Zm-448 20q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v268q-19-9-39-15.5t-41-9.5v-243H200v560h242q3 22 9.5 42t15.5 38H200Zm0-120v40-560 243-3 280Zm80-40h163q3-21 9.5-41t14.5-39H280v80Zm0-160h244q32-30 71.5-50t84.5-27v-3H280v80Zm0-160h400v-80H280v80ZM720-40q-83 0-141.5-58.5T520-240q0-83 58.5-141.5T720-440q83 0 141.5 58.5T920-240q0 83-58.5 141.5T720-40Z" />
    </svg>
  );
}
function AddIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="meta-icon"
      fill="currentColor"
    >
      <path d="M440-120v-320H120v-80h320v-320h80v320h320v80H520v320h-80Z" />
    </svg>
  );
}

function FireGeneralIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className={className}
      fill="currentColor"
    >
      <path d="M240-400q0 52 21 98.5t60 81.5q-1-5-1-9v-9q0-32 12-60t35-51l113-111 113 111q23 23 35 51t12 60v9q0 4-1 9 39-35 60-81.5t21-98.5q0-50-18.5-94.5T648-574q-20 13-42 19.5t-45 6.5q-62 0-107.5-41T401-690q-39 33-69 68.5t-50.5 72Q261-513 250.5-475T240-400Zm240 52-57 56q-11 11-17 25t-6 29q0 32 23.5 55t56.5 23q33 0 56.5-23t23.5-55q0-16-6-29.5T537-292l-57-56Zm0-492v132q0 34 23.5 57t57.5 23q18 0 33.5-7.5T622-658l18-22q74 42 117 117t43 163q0 134-93 227T480-80q-134 0-227-93t-93-227q0-129 86.5-245T480-840Z" />
    </svg>
  );
}
function UnfoldIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="unfold_icon"
      fill="currentColor"
    >
      <path d="M480-120 300-300l58-58 122 122 122-122 58 58-180 180ZM358-598l-58-58 180-180 180 180-58 58-122-122-122 122Z" />
    </svg>
  );
}
function RemoveIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="action_icons"
      fill="currentColor"
    >
      <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="action_icons"
      fill="currentColor"
    >
      <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z" />
    </svg>
  );
}

const STATUS_TABS = ["all", "pending", "dispatched", "contained", "closed"];
const PAGE_SIZE = 15;
const PERIODS = [
  { key: "all", label: "All Time" },
  { key: "day", label: "Today" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
];

function SeverityBadge({ sev }) {
  const cls =
    sev === "Critical"
      ? "badge-critical"
      : sev === "Moderate"
      ? "badge-moderate"
      : "inc-badge-minor";
  return (
    <span className={`inc-badge ${cls}`}>
      <FireGeneralIcon className={"sev-icon"} />
      {sev}
    </span>
  );
}

function StatusPill({ status }) {
  const map = {
    pending: ["sp-pending", "Pending"],
    dispatched: ["sp-dispatched", "Dispatched"],
    contained: ["sp-contained", "Contained"],
    closed: ["sp-closed", "Closed"],
  };
  const [cls, label] = map[status] || ["sp-closed", status];
  return <span className={`status-pill ${cls}`}>{label}</span>;
}

function formatReported(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (isToday) return `Today ${time}`;
  return (
    d.toLocaleDateString("en-PH", { month: "short", day: "numeric" }) +
    " " +
    time
  );
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    pending: 0,
    dispatched: 0,
    contained: 0,
    closed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [editingIncident, setEditingIncident] = useState(null);
  const [deletingIncident, setDeletingIncident] = useState(null);

  // raw search input — debounced before hitting the server
  const [search, setSearch] = useState("");
  const searchTimerRef = useRef(null);

  // all server query params in one atomic object so filter + page reset is one update
  const [query, setQuery] = useState({
    page: 1,
    period: "all",
    status: "all",
    search: "",
    sev: "",
    alarm: "",
    sortCol: "reported_at",
    sortDir: -1,
  });

  // debounce the search field: update query.search + reset to page 1 after 300 ms
  useEffect(() => {
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setQuery((prev) => ({ ...prev, search, page: 1 }));
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [search]);

  // update a filter key and reset to page 1 atomically
  function setFilter(key, value) {
    setQuery((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  function goToPage(p) {
    setQuery((prev) => ({
      ...prev,
      page: typeof p === "function" ? p(prev.page) : p,
    }));
  }

  // fetch whenever query changes; cancels in-flight requests on re-fire
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchIncidents({
      page: query.page,
      pageSize: PAGE_SIZE,
      period: query.period,
      status: query.status,
      search: query.search,
      sev: query.sev,
      alarm: query.alarm,
      sortCol: query.sortCol,
      sortDir: query.sortDir,
    })
      .then((data) => {
        if (cancelled) return;
        setIncidents(data.items);
        setTotal(data.total);
        setStats(data.stats);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginated = incidents;

  function pageNumbers() {
    const p = query.page;
    if (totalPages <= 7)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [];
    if (p <= 4) {
      pages.push(1, 2, 3, 4, 5, "…", totalPages);
    } else if (p >= totalPages - 3) {
      pages.push(
        1,
        "…",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages
      );
    } else {
      pages.push(1, "…", p - 1, p, p + 1, "…", totalPages);
    }
    return pages;
  }

  function handleSort(col) {
    if (query.sortCol === col) setFilter("sortDir", query.sortDir * -1);
    else setQuery((prev) => ({ ...prev, sortCol: col, sortDir: -1, page: 1 }));
  }

  function arrow(col) {
    if (query.sortCol !== col) return "↕";
    return query.sortDir === -1 ? "↓" : "↑";
  }

  async function handleLogSubmit(data) {
    try {
      await createIncident(data);
      setShowLogModal(false);
      // force a fresh fetch from page 1 (bump _seq so the effect fires even if page was already 1)
      setQuery((prev) => ({ ...prev, page: 1, _seq: (prev._seq ?? 0) + 1 }));
    } catch (e) {
      alert(e.message);
    }
  }

  function handleEditSubmit(updated) {
    setIncidents((prev) =>
      prev.map((i) => (i.fire_id === updated.fire_id ? updated : i))
    );
    setEditingIncident(null);
  }

  async function confirmDelete() {
    const target = deletingIncident;
    await deleteIncident(target.fire_id);
    setIncidents((prev) => prev.filter((i) => i.fire_id !== target.fire_id));
    setTotal((t) => Math.max(0, t - 1));
    if (selectedId === target.id) setSelectedId(null);
  }

  const selected = incidents.find((i) => i.id === selectedId) ?? null;

  // Load the after-action report (narrative + photos) when a closed incident is
  // selected. Other statuses don't have a report, so we skip the fetch.
  useEffect(() => {
    if (!selected || selected.status !== "closed") {
      setReport(null);
      setReportError(null);
      setReportLoading(false);
      return;
    }
    let cancelled = false;
    setReportLoading(true);
    setReportError(null);
    setReport(null);
    fetchIncidentReport(selected.fire_id)
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((e) => {
        if (!cancelled) setReportError(e.message);
      })
      .finally(() => {
        if (!cancelled) setReportLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.fire_id, selected?.status]);

  return (
    <div className="inc-page">
      {/* PAGE HEADER */}
      <div className="inc-header">
        <div className="inc-title-row">
          <div className="inc-title">
            Incidents
            <UnfoldIcon />
          </div>
          <div className="inc-header-actions">
            <button className="inc-btn-secondary">
              <ExportIcon />
              Export
            </button>
            <button
              className="inc-btn-log"
              onClick={() => setShowLogModal(true)}
            >
              {/* <AddIcon /> */}
              Log Incident
            </button>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="inc-body">
        <div className="inc-section-row">
          <div className="inc-section-label">Status Overview</div>
          <div className="inc-status-tabs">
            {STATUS_TABS.map((s) => (
              <button
                key={s}
                className={`inc-status-tab${
                  query.status === s ? " active" : ""
                }`}
                onClick={() => setFilter("status", s)}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* STAT CARDS */}
        <div className="inc-stat-row">
          {loading
            ? ["fire", "amber", "green", "blue"].map((cls) => (
                <div key={cls} className={`inc-stat-card ${cls}`}>
                  <div className="inc-stat-head">
                    <span
                      className="inc-sk"
                      style={{ width: 60, height: 10 }}
                    />
                    <span
                      className="inc-sk inc-sk-circle"
                      style={{ width: 32, height: 32 }}
                    />
                  </div>
                  <span className="inc-sk" style={{ width: 48, height: 24 }} />
                  <span className="inc-sk" style={{ width: 90, height: 8 }} />
                </div>
              ))
            : [
                {
                  cls: "fire",
                  icon: "local_fire_department",
                  label: "Pending",
                  value: stats.pending,
                  sub: "Awaiting Dispatch",
                },
                {
                  cls: "amber",
                  icon: "fire_truck",
                  label: "Dispatched",
                  value: stats.dispatched,
                  sub: "Units En Route",
                },
                {
                  cls: "green",
                  icon: "check_circle",
                  label: "Contained",
                  value: stats.contained,
                  sub: "Fire Suppressed",
                },
                {
                  cls: "blue",
                  icon: "inventory_2",
                  label: "Closed",
                  value: stats.closed,
                  sub: "This Period",
                },
              ].map((c) => (
                <div key={c.cls} className={`inc-stat-card ${c.cls}`}>
                  <div className="inc-stat-head">
                    <div className="inc-stat-label">{c.label}</div>
                    <div className="inc-stat-icon">
                      <span className="material-symbols-outlined">
                        {c.icon}
                      </span>
                    </div>
                  </div>
                  <div className="inc-stat-value">{c.value}</div>
                  <div className="inc-stat-sub">{c.sub}</div>
                </div>
              ))}
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="inc-toolbar">
        <div className="inc-search-wrap">
          <span className="inc-search-icon">⌕</span>
          <input
            type="text"
            placeholder="Search ID, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="inc-filter-select"
          value={query.sev}
          onChange={(e) => setFilter("sev", e.target.value)}
        >
          <option value="">All Severities</option>
          <option value="Critical">Critical</option>
          <option value="Moderate">Moderate</option>
          <option value="Minor">Minor</option>
        </select>
        <select
          className="inc-filter-select"
          value={query.alarm}
          onChange={(e) => setFilter("alarm", e.target.value)}
        >
          <option value="">All Alarm Levels</option>
          <option value="1st Alarm">1st Alarm</option>
          <option value="2nd Alarm">2nd Alarm</option>
          <option value="3rd Alarm">3rd Alarm</option>
        </select>

        {/* PERIOD FILTER */}
        <div className="inc-period-filter">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={`inc-period-btn${
                query.period === p.key ? " active" : ""
              }`}
              onClick={() => setFilter("period", p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="inc-toolbar-right">
          {loading ? (
            <span className="inc-result-count">LOADING…</span>
          ) : error ? (
            <span
              className="inc-result-count"
              style={{ color: "var(--accent-fire)" }}
            >
              ERROR
            </span>
          ) : (
            <span className="inc-result-count">
              {total} RECORD{total !== 1 ? "S" : ""}
            </span>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="content-wrap">
        <div className="inc-table-pagination-wrap">
          <div className="inc-table-wrap">
            <table className="inc-table">
              <thead>
                <tr>
                  {[
                    { col: "loc", label: "Location", w: 180 },
                    { col: "sev", label: "Severity", w: 100 },
                  ].map(({ col, label, w }) => (
                    <th
                      key={col}
                      style={{ width: w }}
                      className={query.sortCol === col ? "sort-active" : ""}
                      onClick={() => handleSort(col)}
                    >
                      {label}{" "}
                      <span className="inc-sort-arrow">{arrow(col)}</span>
                    </th>
                  ))}
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 100 }}>Alarm</th>
                  <th
                    style={{ width: 130 }}
                    className={
                      query.sortCol === "reported_at" ? "sort-active" : ""
                    }
                    onClick={() => handleSort("reported_at")}
                  >
                    Reported{" "}
                    <span className="inc-sort-arrow">
                      {arrow("reported_at")}
                    </span>
                  </th>
                  {/* <th
                    style={{ width: 70 }}
                    className={query.sortCol === "units" ? "sort-active" : ""}
                    onClick={() => handleSort("units")}
                  >
                    Units{" "}
                    <span className="inc-sort-arrow">{arrow("units")}</span>
                  </th> */}
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: PAGE_SIZE }, (_, i) => (
                      <tr key={i}>
                        <td>
                          <span
                            className="inc-sk"
                            style={{ width: 130, height: 13, marginBottom: 5 }}
                          />
                          <span
                            className="inc-sk"
                            style={{ width: 88, height: 10 }}
                          />
                        </td>
                        <td>
                          <span
                            className="inc-sk"
                            style={{ width: 58, height: 20, borderRadius: 3 }}
                          />
                        </td>
                        <td>
                          <span
                            className="inc-sk"
                            style={{ width: 72, height: 20, borderRadius: 20 }}
                          />
                        </td>
                        <td>
                          <span
                            className="inc-sk"
                            style={{ width: 68, height: 13 }}
                          />
                        </td>
                        <td>
                          <span
                            className="inc-sk"
                            style={{ width: 90, height: 12 }}
                          />
                        </td>
                        {/* <td>
                          <span
                            className="inc-sk"
                            style={{ width: 24, height: 16, margin: "0 auto" }}
                          />
                        </td> */}
                        <td>
                          <div className="inc-row-actions">
                            <span
                              className="inc-sk"
                              style={{ width: 44, height: 24, borderRadius: 3 }}
                            />
                            <span
                              className="inc-sk"
                              style={{ width: 36, height: 24, borderRadius: 3 }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  : paginated.map((inc) => (
                      <tr
                        key={inc.id}
                        className={selectedId === inc.id ? "selected" : ""}
                        onClick={() =>
                          setSelectedId(inc.id === selectedId ? null : inc.id)
                        }
                      >
                        <td>
                          <div className="inc-row-id">{inc.id}</div>
                          <div className="inc-row-loc">{inc.loc}</div>
                          {inc.addr && (
                            <div className="inc-row-addr">{inc.addr}</div>
                          )}
                        </td>
                        <td>
                          <SeverityBadge sev={inc.sev} />
                        </td>
                        <td>
                          <StatusPill status={inc.status} />
                        </td>
                        <td>
                          <span className="inc-alarm-text">{inc.alarm}</span>
                        </td>
                        <td>
                          <span className="inc-rep-time">
                            {formatReported(inc.reported_at)}
                          </span>
                        </td>
                        {/* <td>
                          <span className="inc-units-count">{inc.units}</span>
                        </td> */}
                        <td>
                          <div className="inc-row-actions">
                            <button
                              className="inc-btn-view"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(inc.id);
                              }}
                            >
                              View
                            </button>
                            <button
                              className="inc-btn-map"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingIncident(inc);
                              }}
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
            {!loading && paginated.length === 0 && (
              <div className="inc-empty-state">
                {error
                  ? `Failed to load incidents: ${error}`
                  : "No incidents match your filters"}
              </div>
            )}
          </div>
          {/* PAGINATION */}
          {!loading && total > 0 && (
            <div className="inc-pagination">
              <span className="inc-page-info">
                {(query.page - 1) * PAGE_SIZE + 1}–
                {Math.min(query.page * PAGE_SIZE, total)} of {total}
              </span>
              <div className="inc-page-controls">
                <button
                  className="inc-page-btn next-prev-btn"
                  onClick={() => goToPage((p) => p - 1)}
                  disabled={query.page === 1}
                >
                  ‹
                </button>
                {pageNumbers().map((n, i) =>
                  n === "…" ? (
                    <span key={`e${i}`} className="inc-page-ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      key={n}
                      className={`inc-page-btn${
                        query.page === n ? " active" : ""
                      }`}
                      onClick={() => goToPage(n)}
                    >
                      {n}
                    </button>
                  )
                )}
                <button
                  className="inc-page-btn next-prev-btn"
                  onClick={() => goToPage((p) => p + 1)}
                  disabled={query.page === totalPages}
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>

        {/* DETAILS PANEL */}
        <div className="inc-details">
          {selected ? (
            <div className="inc-details-inner">
              <div className="inc-details-top">
                <div>
                  <div className="inc-details-id">
                    {selected.id} · {selected.status.toUpperCase()}
                  </div>
                  <div className="inc-details-title">{selected.loc}</div>
                  <div className="inc-details-chips">
                    <SeverityBadge sev={selected.sev} />
                    <StatusPill status={selected.status} />
                    {/* <span
                      className="inc-badge"
                      style={{
                        background: "var(--accent-blue-dim)",
                        color: "var(--accent-blue)",
                        border: "1px solid rgba(30,144,255,0.3)",
                      }}
                    >
                      {selected.alarm}
                    </span> */}
                  </div>
                </div>
                {/* <button
                  className="inc-details-close"
                  onClick={() => setSelectedId(null)}
                >
                  ✕
                </button> */}
              </div>

              <div className="inc-details-actions">
                {selected.status !== "contained" &&
                  selected.status !== "closed" && (
                    <button className="inc-btn-dispatch-sm">
                      Dispatch Unit
                    </button>
                  )}
                {selected.status !== "closed" && (
                  <button className="inc-btn-sec-sm">View on Map</button>
                )}
                <button
                  className="inc-btn-sec-sm action_btn"
                  onClick={() => setEditingIncident(selected)}
                >
                  <EditIcon />
                </button>
                {/* <button className="inc-btn-sec-sm">Export</button> */}
                <button
                  className="inc-btn-sec-sm action_btn"
                  onClick={() => setDeletingIncident(selected)}
                >
                  <RemoveIcon />
                </button>
              </div>

              <div className="inc-details-section-title">Incident Details</div>
              <div className="inc-details-grid">
                {[
                  { label: "Address", value: selected.addr || "—" },
                  { label: "Structure", value: selected.structure || "—" },
                  { label: "Reported via", value: selected.reporter || "—" },
                  {
                    label: "Casualties",
                    value: selected.casualties || "—",
                    highlight:
                      selected.casualties !== "None" &&
                      selected.casualties !== "—" &&
                      selected.casualties,
                  },
                  {
                    label: "Units assigned",
                    value: `${selected.units} unit${
                      selected.units !== 1 ? "s" : ""
                    }`,
                  },
                  {
                    label: "Coordinates",
                    value: `${selected.latitude?.toFixed(
                      5
                    )}, ${selected.longitude?.toFixed(5)}`,
                  },
                  {
                    label: "Reported at",
                    value: formatReported(selected.reported_at),
                  },
                  { label: "Alarm level", value: selected.alarm || "—" },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className="inc-details-field">
                    <div className="inc-details-label">{label}</div>
                    <div
                      className="inc-details-value"
                      style={
                        highlight ? { color: "var(--accent-amber)" } : undefined
                      }
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {selected.status === "closed" && (
                <div className="inc-details-report">
                  <div className="inc-details-section-title">
                    Incident Report
                  </div>

                  {reportLoading ? (
                    <div className="inc-details-report-body">
                      Loading report…
                    </div>
                  ) : reportError ? (
                    <div
                      className="inc-details-report-body"
                      style={{ color: "var(--accent-fire)" }}
                    >
                      Failed to load report: {reportError}
                    </div>
                  ) : !report ? (
                    <div className="inc-details-report-body">
                      No report filed for this incident.
                    </div>
                  ) : (
                    <>
                      {(report.author || report.submitted_at) && (
                        <div className="inc-report-meta">
                          {report.author && (
                            <span>
                              Filed by{" "}
                              {report.author_rank
                                ? `${report.author_rank} `
                                : ""}
                              {report.author}
                            </span>
                          )}
                          {report.submitted_at && (
                            <span>{formatReported(report.submitted_at)}</span>
                          )}
                        </div>
                      )}

                      <div className="inc-details-grid">
                        {[
                          { label: "Cause", value: report.cause || "—" },
                          {
                            label: "Casualties",
                            value: report.casualties || "—",
                          },
                          {
                            label: "Damage estimate",
                            value: report.damage_estimate || "—",
                          },
                        ].map(({ label, value }) => (
                          <div key={label} className="inc-details-field">
                            <div className="inc-details-label">{label}</div>
                            <div className="inc-details-value inc-report">{value}</div>
                          </div>
                        ))}
                      </div>

                      <div className="inc-details-field">
                        <div className="inc-details-label">Narrative</div>
                        <div className="inc-details-report-body">
                          {report.narrative}
                        </div>
                      </div>

                      {report.recommendations && (
                        <div className="inc-details-field">
                          <div className="inc-details-label">
                            Recommendations
                          </div>
                          <div className="inc-details-report-body">
                            {report.recommendations}
                          </div>
                        </div>
                      )}

                      {report.photos?.length > 0 && (
                        <div className="inc-details-field">
                          <div className="inc-details-label">
                            Scene photos ({report.photos.length})
                          </div>
                          <div className="inc-report-photos">
                            {report.photos.map((url, i) => (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inc-report-photo"
                              >
                                <img
                                  src={url}
                                  alt={`Scene photo ${i + 1}`}
                                  loading="lazy"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="inc-details-empty">
              <FireGeneralIcon className={"sev-icon-normal"} />
              Select an incident to view details
            </div>
          )}
        </div>
      </div>

      {showLogModal && (
        <LogIncidentModal
          onClose={() => setShowLogModal(false)}
          onSubmit={handleLogSubmit}
        />
      )}
      {editingIncident && (
        <EditIncidentModal
          incident={editingIncident}
          onClose={() => setEditingIncident(null)}
          onSubmit={handleEditSubmit}
        />
      )}
      {deletingIncident && (
        <ConfirmModal
          eyebrow="DELETE INCIDENT"
          title={`Delete incident ${deletingIncident.id}?`}
          message={
            <>
              This will permanently remove incident{" "}
              <strong>{deletingIncident.id}</strong>
              {deletingIncident.loc ? (
                <>
                  {" "}
                  at <strong>{deletingIncident.loc}</strong>
                </>
              ) : null}
              , along with its dispatch records and routes. This action cannot
              be undone.
            </>
          }
          confirmLabel="Delete Incident"
          onConfirm={confirmDelete}
          onClose={() => setDeletingIncident(null)}
        />
      )}
    </div>
  );
}
