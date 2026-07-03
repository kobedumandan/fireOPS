import { useState, useMemo, useEffect } from "react";
import "../styles/PersonnelPage.css";
import AddPersonnelModal from "./AddPersonnelModal";
import EditPersonnelModal from "./EditPersonnelModal";
import ConfirmModal from "./ConfirmModal";
import { fetchPersonnel, createPersonnel, deletePersonnel } from "../api";
import { isOnCurrentShift } from "../utils/shift";

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

function BoltIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="bolt-icon"
      fill="currentColor"
    >
      <path d="m422-232 207-248H469l29-227-185 267h139l-30 208ZM320-80l40-280H160l360-520h80l-40 320h240L400-80h-80Zm151-390Z" />
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

const STATUS_TABS = ["all", "dispatched", "onscene", "standby", "offduty"];
const TAB_LABELS = {
  all: "All",
  dispatched: "Dispatched",
  onscene: "On Scene",
  standby: "Standby",
  offduty: "Off Duty",
};
const STATUS_AV = {
  dispatched: "av-dispatched",
  onscene: "av-onscene",
  standby: "av-standby",
  offduty: "av-offduty",
};
const STATUS_CAV = {
  dispatched: "cav-dispatched",
  onscene: "cav-onscene",
  standby: "cav-standby",
  offduty: "cav-offduty",
};
const STATUS_SP = {
  dispatched: "sp-dispatched",
  onscene: "sp-onscene",
  standby: "sp-standby",
  offduty: "sp-offduty",
};

function RankBadge({ rank }) {
  return <span className="per-badge in_table b-muted">{rank}</span>;
}

function StatusPill({ status }) {
  return (
    <span className={`per-status-pill ${STATUS_SP[status]}`}>
      {TAB_LABELS[status]}
    </span>
  );
}

function ShiftBadge({ name }) {
  if (!name || name === "—")
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  return <span className="per-badge b-muted">{name}</span>;
}

function IotBadge({ type }) {
  if (type === "online")
    return (
      <span className="per-iot iot-active">
        <span className="per-iot-dot" />
        Online
      </span>
    );
  if (type === "active")
    return (
      <span className="per-iot iot-active">
        <span className="per-iot-dot" />
        IoT
      </span>
    );
  if (type === "sms")
    return (
      <span className="per-iot iot-sms">
        <span className="per-iot-dot" />
        SMS
      </span>
    );
  return (
    <span className="per-iot iot-offline">
      <span className="per-iot-dot" />
      Offline
    </span>
  );
}

function BatteryBar({ pct }) {
  if (pct === 0)
    return (
      <span className="per-mono-sm" style={{ color: "var(--text-muted)" }}>
        —
      </span>
    );
  const cls = pct >= 60 ? "bat-high" : pct >= 30 ? "bat-med" : "bat-low";
  return (
    <div className="per-bat-wrap">
      <div className="per-bat-bar">
        <div className={`per-bat-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="per-bat-pct">{pct}%</span>
    </div>
  );
}

export default function PersonnelPage({ onShowOnMap, livePersonnelLocations = [] }) {
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeStatus, setActiveStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [stationFilter, setStationFilter] = useState("");
  const [rankFilter, setRankFilter] = useState("");
  const [sortCol, setSortCol] = useState("id");
  const [sortDir, setSortDir] = useState(-1);
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState("list");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    fetchPersonnel()
      .then((data) => {
        setPersonnel(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Latest live location per personnel, keyed by per_id.
  const locByPerId = useMemo(() => {
    const m = new Map();
    for (const loc of livePersonnelLocations) m.set(loc.per_id, loc);
    return m;
  }, [livePersonnelLocations]);

  // Personnel actively streaming a fresh (non-stale) location are "online",
  // regardless of their IoT device_status.
  const onlineSet = useMemo(() => {
    const s = new Set();
    for (const loc of livePersonnelLocations) {
      if (!loc.is_stale) s.add(loc.per_id);
    }
    return s;
  }, [livePersonnelLocations]);

  // Resolve the tracking badge type for a row: "online" wins, else IoT status.
  const trackingType = (p) => (onlineSet.has(p.per_id) ? "online" : p.iot);

  // Human-readable "last ping" from the live location's age, or "—" if none.
  function lastPing(perId) {
    const loc = locByPerId.get(perId);
    if (!loc || loc.age_minutes == null) return "—";
    const mins = loc.age_minutes;
    if (mins < 1) return "just now";
    if (mins < 60) return `${Math.round(mins)} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr${hrs !== 1 ? "s" : ""} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  }

  // Personnel whose assigned shift isn't the currently active A/B shift are
  // shown as off-duty (gray), regardless of their stored status.
  const shiftedPersonnel = useMemo(
    () =>
      personnel.map((p) =>
        isOnCurrentShift(p.shift_name) ? p : { ...p, status: "offduty" }
      ),
    [personnel]
  );

  const stats = useMemo(
    () => ({
      dispatched: shiftedPersonnel.filter((p) => p.status === "dispatched").length,
      onscene: shiftedPersonnel.filter((p) => p.status === "onscene").length,
      standby: shiftedPersonnel.filter((p) => p.status === "standby").length,
      offduty: shiftedPersonnel.filter((p) => p.status === "offduty").length,
      iot: shiftedPersonnel.filter(
        (p) => p.iot === "active" || onlineSet.has(p.per_id)
      ).length,
    }),
    [shiftedPersonnel, onlineSet]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let rows = shiftedPersonnel.filter((p) => {
      const mq =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.rank.toLowerCase().includes(q);
      const ms = !stationFilter || p.station === stationFilter;
      const mr = !rankFilter || p.rank === rankFilter;
      const mst = activeStatus === "all" || p.status === activeStatus;
      return mq && ms && mr && mst;
    });

    rows.sort((a, b) => {
      let av, bv;
      if (sortCol === "id") {
        av = a.id;
        bv = b.id;
      }
      if (sortCol === "name") {
        av = a.name;
        bv = b.name;
      }
      if (sortCol === "rank") {
        av = a.rank;
        bv = b.rank;
      }
      if (sortCol === "station") {
        av = a.station;
        bv = b.station;
      }
      if (sortCol === "battery") {
        av = a.battery;
        bv = b.battery;
      }
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      return 0;
    });

    return rows;
  }, [
    shiftedPersonnel,
    search,
    stationFilter,
    rankFilter,
    activeStatus,
    sortCol,
    sortDir,
  ]);

  function handleSort(col) {
    if (sortCol === col) setSortDir((d) => d * -1);
    else {
      setSortCol(col);
      setSortDir(-1);
    }
  }

  function arrow(col) {
    if (sortCol !== col) return "↕";
    return sortDir === -1 ? "↓" : "↑";
  }

  function openDrawer(id) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  async function confirmDelete() {
    const target = deleting;
    await deletePersonnel(target.per_id);
    setPersonnel((prev) => prev.filter((p) => p.per_id !== target.per_id));
    if (selectedId === target.id) setSelectedId(null);
  }

  const selected = shiftedPersonnel.find((p) => p.id === selectedId);

  if (error)
    return (
      <div
        className="per-page"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--accent-fire)",
          fontFamily: "var(--font-condensed)",
          letterSpacing: 2,
          fontSize: 13,
        }}
      >
        ERROR: {error}
      </div>
    );

  return (
    <>
      <div className="per-page">
        {/* PAGE HEADER */}
        <div className="per-header">
          <div className="per-title-row">
            <div className="per-title">
              Personnel
              <UnfoldIcon />
            </div>
            <div className="per-header-actions">
              <button className="per-btn-secondary">
                <ExportIcon />
                Export
              </button>
              <button
                className="per-btn-primary"
                onClick={() => setShowAddModal(true)}
              >
                Add Personnel
              </button>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="per-body">
          <div className="per-section-row">
            <div className="per-section-label">Overview</div>
            <div className="per-status-tabs">
              {STATUS_TABS.map((s) => (
                <button
                  key={s}
                  className={`per-status-tab${
                    activeStatus === s ? " active" : ""
                  }`}
                  onClick={() => setActiveStatus(s)}
                >
                  {TAB_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* STAT CARDS */}
          <div className="per-stat-row">
            {loading ? (
              ["fire", "amber", "blue", "purple", "green"].map((cls) => (
                <div key={cls} className={`per-stat-card ${cls}`}>
                  <div className="per-stat-icon">
                    <div
                      className="per-skel"
                      style={{ width: 28, height: 28, borderRadius: "50%" }}
                    />
                  </div>
                  <div
                    className="per-stat-content"
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 6,
                    }}
                  >
                    <div
                      className="per-skel"
                      style={{ width: 52, height: 10 }}
                    />
                    <div
                      className="per-skel"
                      style={{ width: 36, height: 28 }}
                    />
                    <div
                      className="per-skel"
                      style={{ width: 80, height: 8 }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="per-stat-card fire">
                  <div className="per-stat-icon">
                    <span className="material-symbols-outlined">
                      local_fire_department
                    </span>
                  </div>
                  <div className="per-stat-content">
                    <div className="per-stat-label">Dispatched</div>
                    <div className="per-stat-value">{stats.dispatched}</div>
                    <div className="per-stat-sub">En Route Now</div>
                  </div>
                </div>
                <div className="per-stat-card amber">
                  <div className="per-stat-icon">
                    <span className="material-symbols-outlined">
                      location_on
                    </span>
                  </div>
                  <div className="per-stat-content">
                    <div className="per-stat-label">On Scene</div>
                    <div className="per-stat-value">{stats.onscene}</div>
                    <div className="per-stat-sub">At Incident Site</div>
                  </div>
                </div>
                <div className="per-stat-card blue">
                  <div className="per-stat-icon">
                    <span className="material-symbols-outlined">shield</span>
                  </div>
                  <div className="per-stat-content">
                    <div className="per-stat-label">Standby</div>
                    <div className="per-stat-value">{stats.standby}</div>
                    <div className="per-stat-sub">Ready to Deploy</div>
                  </div>
                </div>
                <div className="per-stat-card purple">
                  <div className="per-stat-icon">
                    <span className="material-symbols-outlined">bedtime</span>
                  </div>
                  <div className="per-stat-content">
                    <div className="per-stat-label">Off Duty</div>
                    <div className="per-stat-value">{stats.offduty}</div>
                    <div className="per-stat-sub">Not Available</div>
                  </div>
                </div>
                <div className="per-stat-card green">
                  <div className="per-stat-icon">
                    <span className="material-symbols-outlined">sensors</span>
                  </div>
                  <div className="per-stat-content">
                    <div className="per-stat-label">Live Tracking</div>
                    <div className="per-stat-value">{stats.iot}</div>
                    <div className="per-stat-sub">Online</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="per-toolbar">
          <div className="per-search-wrap">
            <span className="per-search-icon">⌕</span>
            <input
              type="text"
              placeholder="Search name, ID, rank..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="per-filter-select"
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
          >
            <option value="">All Stations</option>
            <option value="Station 1">Station 1</option>
            <option value="Station 2">Station 2</option>
            <option value="Station 3">Station 3</option>
          </select>
          <select
            className="per-filter-select"
            value={rankFilter}
            onChange={(e) => setRankFilter(e.target.value)}
          >
            <option value="">All Ranks</option>
            <option value="Fire Officer I">Fire Officer I</option>
            <option value="Fire Officer II">Fire Officer II</option>
            <option value="Fire Officer III">Fire Officer III</option>
            <option value="Senior Fire Officer">Senior Fire Officer</option>
            <option value="Fire Inspector">Fire Inspector</option>
          </select>
          <span className="per-result-count">
            Showing {filtered.length} Record{filtered.length !== 1 ? "s" : ""}
          </span>
          <div className="per-view-toggle">
            <button
              className={`per-view-btn${view === "list" ? " active" : ""}`}
              onClick={() => setView("list")}
              title="List view"
            >
              ☰
            </button>
            <button
              className={`per-view-btn${view === "grid" ? " active" : ""}`}
              onClick={() => setView("grid")}
              title="Grid view"
            >
              ⊞
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="per-content">
          <div className="per-table-pagination-wrap">
            {/* TABLE VIEW */}
            {view === "list" && (
              <div className="per-table-wrap">
                <table className="per-table">
                  <thead>
                    <tr>
                      <th
                        style={{ width: 190 }}
                        className={sortCol === "name" ? "sort-active" : ""}
                        onClick={() => handleSort("name")}
                      >
                        Personnel{" "}
                        <span className="per-sort-arrow">{arrow("name")}</span>
                      </th>
                      {/* <th
                        style={{ width: 110 }}
                        className={sortCol === "id" ? "sort-active" : ""}
                        onClick={() => handleSort("id")}
                      >
                        Personnel ID{" "}
                        <span className="per-sort-arrow">{arrow("id")}</span>
                      </th> */}
                      {/* <th
                        style={{ width: 150 }}
                        className={sortCol === "rank" ? "sort-active" : ""}
                        onClick={() => handleSort("rank")}
                      >
                        Rank{" "}
                        <span className="per-sort-arrow">{arrow("rank")}</span>
                      </th> */}
                      <th style={{ width: 110 }}>Status</th>
                      <th
                        style={{ width: 120 }}
                        className={sortCol === "station" ? "sort-active" : ""}
                        onClick={() => handleSort("station")}
                      >
                        Station{" "}
                        <span className="per-sort-arrow">
                          {arrow("station")}
                        </span>
                      </th>
                      <th style={{ width: 130 }}>Incident</th>
                      <th style={{ width: 90 }}>Tracking</th>
                      {/* <th
                        style={{ width: 100 }}
                        className={sortCol === "battery" ? "sort-active" : ""}
                        onClick={() => handleSort("battery")}
                      >
                        Battery{" "}
                        <span className="per-sort-arrow">
                          {arrow("battery")}
                        </span>
                      </th> */}
                      <th style={{ width: 110 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 8 }).map((_, i) => (
                          <tr key={i}>
                            <td>
                              <div className="per-av-wrap">
                                <div
                                  className="per-skel"
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: "50%",
                                    flexShrink: 0,
                                  }}
                                />
                                <div>
                                  <div
                                    className="per-skel"
                                    style={{
                                      width: 110,
                                      height: 12,
                                      marginBottom: 6,
                                    }}
                                  />
                                  <div
                                    className="per-skel"
                                    style={{ width: 76, height: 10 }}
                                  />
                                </div>
                              </div>
                            </td>
                            {/* <td>
                              <div
                                className="per-skel"
                                style={{ width: 70, height: 12 }}
                              />
                            </td> */}
                            {/* <td>
                              <div
                                className="per-skel"
                                style={{ width: 92, height: 18 }}
                              />
                            </td> */}
                            <td>
                              <div
                                className="per-skel"
                                style={{ width: 62, height: 18 }}
                              />
                            </td>
                            <td>
                              <div
                                className="per-skel"
                                style={{ width: 58, height: 12 }}
                              />
                            </td>
                            <td>
                              <div
                                className="per-skel"
                                style={{ width: 62, height: 12 }}
                              />
                            </td>
                            <td>
                              <div
                                className="per-skel"
                                style={{ width: 38, height: 18 }}
                              />
                            </td>
                            {/* <td>
                              <div
                                className="per-skel"
                                style={{ width: 72, height: 10 }}
                              />
                            </td> */}
                            <td>
                              <div style={{ display: "flex", gap: 4 }}>
                                <div
                                  className="per-skel"
                                  style={{ width: 38, height: 24 }}
                                />
                                <div
                                  className="per-skel"
                                  style={{ width: 38, height: 24 }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))
                      : filtered.map((p) => (
                          <tr
                            key={p.id}
                            className={selectedId === p.id ? "selected" : ""}
                            onClick={() => openDrawer(p.id)}
                          >
                            <td>
                              <div className="per-av-wrap">
                                <div
                                  className={`per-av ${STATUS_AV[p.status]}`}
                                >
                                  <div className="per-av-ring" />
                                  {p.initials}
                                </div>
                                <div>
                                  <span
                                    className="per-mono-sm per-id-span" 
                                    style={{ color: "var(--text-secondary)" }}
                                  >
                                    {p.id}
                                  </span>
                                  <div className="per-name-full">{p.name}</div>
                                  <RankBadge rank={p.rank} />
                                </div>
                              </div>
                            </td>
                            {/* <td>
                              <span
                                className="per-mono-sm"
                                style={{ color: "var(--accent-blue)" }}
                              >
                                {p.id}
                              </span>
                            </td> */}
                            {/* <td>
                              <RankBadge rank={p.rank} />
                            </td> */}
                            <td>
                              <StatusPill status={p.status} />
                            </td>
                            <td>
                              <span className="per-mono-sm">{p.station}</span>
                            </td>
                            <td>
                              <span
                                className="per-mono-sm"
                                // style={{
                                //   color:
                                //     p.incident !== "—"
                                //       ? "var(--accent-fire)"
                                //       : "var(--text-muted)",
                                // }}
                              >
                                {p.incident}
                              </span>
                            </td>
                            <td>
                              {(() => {
                                const tt = trackingType(p);
                                const live = tt === "online" || tt === "active";
                                return (
                                  <div
                                    className="tracking"
                                    style={
                                      !live
                                        ? {
                                            color: "var(--text-muted)",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "2px",
                                          }
                                        : {
                                            color: "var(--accent-green)",
                                            display: "flex",
                                            alignItems: "center",
                                            background:
                                              "var(--accent-green-dim)",
                                            borderRadius: "8px",
                                            padding: "2px 5px",
                                            gap: "2px",
                                          }
                                    }
                                  >
                                    <BoltIcon
                                      style={
                                        !live
                                          ? { fill: "var(--text-muted)" }
                                          : { fill: "var(--accent-green)" }
                                      }
                                    />
                                    <IotBadge type={tt} />
                                  </div>
                                );
                              })()}
                            </td>
                            {/* <td>
                              <BatteryBar pct={p.battery} />
                            </td> */}
                            <td>
                              <div className="per-row-actions">
                                <button
                                  className="per-btn-view"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDrawer(p.id);
                                  }}
                                >
                                  View
                                </button>
                                <button
                                  className="per-btn-map"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onShowOnMap?.(p.per_id);
                                  }}
                                >
                                  Map
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
                {!loading && filtered.length === 0 && (
                  <div className="per-empty">
                    No personnel match your filters
                  </div>
                )}
              </div>
            )}

            {/* GRID VIEW */}
            {view === "grid" && (
              <div className="per-grid-wrap">
                {loading ? (
                  <div className="per-grid">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="per-card standby"
                        style={{ cursor: "default" }}
                      >
                        <div className="per-card-top">
                          <div
                            className="per-skel"
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: "50%",
                            }}
                          />
                          <div
                            className="per-skel"
                            style={{ width: 60, height: 18 }}
                          />
                        </div>
                        <div
                          className="per-skel"
                          style={{ width: "80%", height: 13, marginBottom: 5 }}
                        />
                        <div
                          className="per-skel"
                          style={{ width: "60%", height: 10, marginBottom: 4 }}
                        />
                        <div
                          className="per-skel"
                          style={{ width: "40%", height: 10, marginBottom: 8 }}
                        />
                        <hr className="per-card-divider" />
                        <div className="per-card-row">
                          <div
                            className="per-skel"
                            style={{ width: 40, height: 10 }}
                          />
                          <div
                            className="per-skel"
                            style={{ width: 60, height: 10 }}
                          />
                        </div>
                        <div className="per-card-row">
                          <div
                            className="per-skel"
                            style={{ width: 40, height: 10 }}
                          />
                          <div
                            className="per-skel"
                            style={{ width: 60, height: 10 }}
                          />
                        </div>
                        <div className="per-card-row">
                          <div
                            className="per-skel"
                            style={{ width: 40, height: 10 }}
                          />
                          <div
                            className="per-skel"
                            style={{ width: 60, height: 10 }}
                          />
                        </div>
                        <div className="per-card-bottom">
                          <div
                            className="per-skel"
                            style={{ width: 55, height: 18 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="per-empty">
                    No personnel match your filters
                  </div>
                ) : (
                  <div className="per-grid">
                    {filtered.map((p) => (
                      <div
                        key={p.id}
                        className={`per-card ${p.status}${
                          selectedId === p.id ? " selected" : ""
                        }`}
                        onClick={() => openDrawer(p.id)}
                      >
                        <div className="per-card-top">
                          <div
                            className={`per-card-av ${STATUS_CAV[p.status]}`}
                          >
                            <div className="per-card-av-ring" />
                            {p.initials}
                          </div>
                          <StatusPill status={p.status} />
                        </div>
                        <div className="per-card-name">{p.name}</div>
                        <div className="per-card-rank">{p.rank}</div>
                        <div className="per-card-id">{p.id}</div>
                        <hr className="per-card-divider" />
                        <div className="per-card-row">
                          <span className="per-card-field-label">Station</span>
                          <span className="per-card-field-val">
                            {p.station}
                          </span>
                        </div>
                        <div className="per-card-row">
                          <span className="per-card-field-label">Team</span>
                          <span
                            className="per-card-field-val"
                            style={{
                              color:
                                p.team_name && p.team_name !== "—"
                                  ? "var(--accent-blue)"
                                  : "var(--text-muted)",
                            }}
                          >
                            {p.team_name || "—"}
                          </span>
                        </div>
                        <div className="per-card-row">
                          <span className="per-card-field-label">Incident</span>
                          <span
                            className="per-card-field-val"
                            style={{
                              color:
                                p.incident !== "—"
                                  ? "var(--accent-fire)"
                                  : "var(--text-muted)",
                            }}
                          >
                            {p.incident}
                          </span>
                        </div>
                        <div className="per-card-bottom">
                          <IotBadge type={trackingType(p)} />
                          {p.battery > 0 && (
                            <span className="per-card-bat-text">
                              {p.battery}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* DETAILS PANEL */}
          <div className="per-details">
            {selected ? (
              <div className="per-details-inner">
                <div className="per-details-top">
                  <div
                    className={`per-details-av ${STATUS_CAV[selected.status]}`}
                  >
                    <div className="per-details-av-ring" />
                    {selected.initials}
                  </div>
                  <div>
                    <div className="per-details-pid">
                      {selected.id}
                    </div>
                    <div className="per-details-name">{selected.name}</div>
                    <div className="per-details-chips">
                      <RankBadge rank={selected.rank} />
                      <StatusPill status={selected.status} />
                    </div>
                  </div>
                </div>

                <div className="per-details-actions">
                  {/* {selected.status === "standby" && (
                    <button className="per-btn-dispatch">▶ Dispatch</button>
                  )} */}
                  {(selected.status === "dispatched" ||
                    selected.status === "onscene") && (
                    <button className="per-btn-dispatch">Recall</button>
                  )}
                  <button
                    className="per-btn-sec"
                    onClick={() => onShowOnMap?.(selected.per_id)}
                  >
                    Track on Map
                  </button>
                  <button
                    className="per-btn-sec action_btn"
                    onClick={() => setEditTarget(selected)}
                  >
                    <EditIcon/>
                  </button>
                  {/* <button className="per-btn-sec">View History</button> */}
                  <button
                    className="per-btn-sec action_btn"
                    onClick={() => setDeleting(selected)}
                  >
                    <RemoveIcon/>
                  </button>
                </div>

                <div className="per-details-section-title">
                  Personnel Details
                </div>
                <div className="per-details-grid">
                  {[
                    { label: "Phone", value: selected.phone, mono: true },
                    { label: "Station", value: selected.station },
                    { label: "Team", value: selected.team_name || "—" },
                    { label: "Shift", value: null, shift: selected.shift_name },
                    {
                      label: "Incident",
                      value: selected.incident,
                      fire: selected.incident !== "—",
                    },
                    {
                      label: "Tracking",
                      value: {
                        online: "Online",
                        active: "IoT",
                        sms: "SMS",
                        offline: "Offline",
                      }[trackingType(selected)],
                    },
                    { label: "Joined", value: selected.joined },
                    {
                      label: "Last Ping",
                      value: lastPing(selected.per_id),
                      mono: true,
                    },
                  ].map(({ label, value, mono, fire, iot, shift }) => (
                    <div key={label} className="per-details-field">
                      <div className="per-details-label">{label}</div>
                      <div
                        className="per-details-value"
                        style={{
                          ...(mono
                            ? { fontFamily: "var(--font-mono)", fontSize: 11 }
                            : {}),
                          // ...(fire ? { color: "var(--accent-fire)" } : {}),
                        }}
                      >
                        {iot ? (
                          <IotBadge type={iot} />
                        ) : shift !== undefined ? (
                          <ShiftBadge name={shift} />
                        ) : (
                          value
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="per-details-empty">
                Select a person to view details
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddPersonnelModal
          onClose={() => setShowAddModal(false)}
          onSubmit={async (data) => {
            try {
              const newPerson = await createPersonnel(data);
              setPersonnel((prev) => [...prev, newPerson]);
              setShowAddModal(false);
            } catch (err) {
              alert(err.message);
            }
          }}
        />
      )}

      {editTarget && (
        <EditPersonnelModal
          personnel={editTarget}
          onClose={() => setEditTarget(null)}
          onSubmit={() => {
            setEditTarget(null);
            setSelectedId(null);
            fetchPersonnel().then((data) => setPersonnel(data));
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          eyebrow="DELETE PERSONNEL"
          title={`Delete ${deleting.name}?`}
          message={
            <>
              This will permanently remove personnel{" "}
              <strong>{deleting.name}</strong>, their login account, devices,
              and team assignments. This action cannot be undone.
            </>
          }
          confirmLabel="Delete Personnel"
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
