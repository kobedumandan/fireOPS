import { useState, useMemo, useEffect } from "react";
import "../styles/TrucksPage.css";
import AddTruckModal from "./AddTruckModal";
import EditTruckModal from "./EditTruckModal";
import ConfirmModal from "./ConfirmModal";
import { fetchTrucks, createTruck, deleteTruck } from "../api";

const STATUS_OPTIONS = ["available", "dispatched", "maintenance", "unavailable"];
const STATUS_TABS = ["all", ...STATUS_OPTIONS];
const TAB_LABELS = {
  all: "All",
  available: "Available",
  dispatched: "Dispatched",
  maintenance: "Maintenance",
  unavailable: "Unavailable",
};
const STATUS_SP = {
  available: "trk-sp-available",
  dispatched: "trk-sp-dispatched",
  maintenance: "trk-sp-maintenance",
  unavailable: "trk-sp-unavailable",
};
const STATUS_AV = {
  available: "trk-av-available",
  dispatched: "trk-av-dispatched",
  maintenance: "trk-av-maintenance",
  unavailable: "trk-av-unavailable",
};
const STATUS_CAV = {
  available: "trk-cav-available",
  dispatched: "trk-cav-dispatched",
  maintenance: "trk-cav-maintenance",
  unavailable: "trk-cav-unavailable",
};

function ExportIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="trk-meta-icon"
      fill="currentColor"
    >
      <path d="m648-140 112-112v92h40v-160H640v40h92L620-168l28 28Zm-448 20q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v268q-19-9-39-15.5t-41-9.5v-243H200v560h242q3 22 9.5 42t15.5 38H200Zm0-120v40-560 243-3 280Zm80-40h163q3-21 9.5-41t14.5-39H280v80Zm0-160h244q32-30 71.5-50t84.5-27v-3H280v80Zm0-160h400v-80H280v80ZM720-40q-83 0-141.5-58.5T520-240q0-83 58.5-141.5T720-440q83 0 141.5 58.5T920-240q0 83-58.5 141.5T720-40Z" />
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

function AddIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="trk-meta-icon"
      fill="currentColor"
    >
      <path d="M440-120v-320H120v-80h320v-320h80v320h320v80H520v320h-80Z" />
    </svg>
  );
}

function FireTruckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="trk-av-svg"
      fill="currentColor"
    >
      <path d="M195-155q-35-35-35-85h-40q-33 0-56.5-23.5T40-320v-200h440v-160q0-33 23.5-56.5T560-760h80v-40q0-17 11.5-28.5T680-840h40q17 0 28.5 11.5T760-800v40h22q26 0 47 15t29 40l58 172q2 6 3 12.5t1 13.5v267H800q0 50-35 85t-85 35q-50 0-85-35t-35-85H400q0 50-35 85t-85 35q-50 0-85-35Zm113.5-56.5Q320-223 320-240t-11.5-28.5Q297-280 280-280t-28.5 11.5Q240-257 240-240t11.5 28.5Q263-200 280-200t28.5-11.5Zm400 0Q720-223 720-240t-11.5-28.5Q697-280 680-280t-28.5 11.5Q640-257 640-240t11.5 28.5Q663-200 680-200t28.5-11.5ZM120-440v120h71q17-19 40-29.5t49-10.5q26 0 49 10.5t40 29.5h111v-120H120Zm440 120h31q17-19 40-29.5t49-10.5q26 0 49 10.5t40 29.5h71v-120H560v120Zm0-200h276l-54-160H560v160ZM40-560v-60h40v-80H40v-60h400v60h-40v80h40v60H40Zm100-60h70v-80h-70v80Zm130 0h70v-80h-70v80Zm210 180H120h360Zm80 0h280-280Z" />
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

function StatusPill({ status }) {
  return (
    <span className={`trk-status-pill ${STATUS_SP[status]}`}>
      {TAB_LABELS[status]}
    </span>
  );
}

export default function TrucksPage() {
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilter] = useState("all");
  const [stationFilter, setStationFilter] = useState("");
  const [sortCol, setSortCol] = useState("truck_platenum");
  const [sortDir, setSortDir] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState("list");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    fetchTrucks()
      .then((t) => {
        setTrucks(t);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const stats = useMemo(
    () => ({
      total: trucks.length,
      available: trucks.filter((t) => t.truck_status === "available").length,
      dispatched: trucks.filter((t) => t.truck_status === "dispatched").length,
      maintenance: trucks.filter((t) => t.truck_status === "maintenance")
        .length,
    }),
    [trucks]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const rows = trucks.filter((t) => {
      const matchSearch =
        !q ||
        t.truck_platenum.toLowerCase().includes(q) ||
        (t.station_name || "").toLowerCase().includes(q);
      const matchStatus =
        filterStatus === "all" || t.truck_status === filterStatus;
      const matchStation =
        !stationFilter || t.station_name === stationFilter;
      return matchSearch && matchStatus && matchStation;
    });
    rows.sort((a, b) => {
      let av, bv;
      if (sortCol === "truck_platenum") {
        av = a.truck_platenum;
        bv = b.truck_platenum;
      } else if (sortCol === "truck_status") {
        av = a.truck_status;
        bv = b.truck_status;
      } else if (sortCol === "station_name") {
        av = a.station_name || "";
        bv = b.station_name || "";
      } else if (sortCol === "truck_id") {
        av = a.truck_id;
        bv = b.truck_id;
      } else {
        av = a.truck_platenum;
        bv = b.truck_platenum;
      }
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      return 0;
    });
    return rows;
  }, [trucks, search, filterStatus, stationFilter, sortCol, sortDir]);

  function handleSort(col) {
    if (sortCol === col) setSortDir((d) => d * -1);
    else {
      setSortCol(col);
      setSortDir(1);
    }
  }

  function arrow(col) {
    if (sortCol !== col) return "↕";
    return sortDir === 1 ? "↑" : "↓";
  }

  function openDrawer(id) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  async function confirmDelete() {
    const truck = deleting;
    await deleteTruck(truck.truck_id);
    setTrucks((prev) => prev.filter((t) => t.truck_id !== truck.truck_id));
    if (selectedId === truck.truck_id) setSelectedId(null);
  }

  const selected = trucks.find((t) => t.truck_id === selectedId);

  const uniqueStations = useMemo(() => {
    const names = [...new Set(trucks.map((t) => t.station_name).filter(Boolean))];
    names.sort();
    return names;
  }, [trucks]);

  return (
    <>
      <div className="trk-page">
        {/* PAGE HEADER */}
        <div className="trk-header">
          <div className="trk-title-row">
            <div className="trk-title">
              Trucks
              <UnfoldIcon />
            </div>
            <div className="trk-header-actions">
              <button className="trk-btn-secondary">
                <ExportIcon />
                Export
              </button>
              <button
                className="trk-btn-primary"
                onClick={() => setShowAdd(true)}
              >
                <AddIcon />
                Add Truck
              </button>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="trk-body">
          <div className="trk-section-row">
            <div className="trk-section-label">Overview</div>
            <div className="trk-status-tabs">
              {STATUS_TABS.map((s) => (
                <button
                  key={s}
                  className={`trk-status-tab${
                    filterStatus === s ? " active" : ""
                  }`}
                  onClick={() => setFilter(s)}
                >
                  {TAB_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* STAT CARDS */}
          <div className="trk-stat-row">
            {loading ? (
              ["blue", "green", "amber", "fire"].map((cls) => (
                <div key={cls} className={`trk-stat-card ${cls}`}>
                  <div className="trk-stat-icon">
                    <div
                      className="trk-skel"
                      style={{ width: 28, height: 28, borderRadius: "50%" }}
                    />
                  </div>
                  <div
                    className="trk-stat-content"
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 6,
                    }}
                  >
                    <div
                      className="trk-skel"
                      style={{ width: 52, height: 10 }}
                    />
                    <div
                      className="trk-skel"
                      style={{ width: 36, height: 28 }}
                    />
                    <div
                      className="trk-skel"
                      style={{ width: 80, height: 8 }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="trk-stat-card blue">
                  <div className="trk-stat-icon">
                    <span className="material-symbols-outlined">
                      local_shipping
                    </span>
                  </div>
                  <div className="trk-stat-content">
                    <div className="trk-stat-label">Total</div>
                    <div className="trk-stat-value">{stats.total}</div>
                    <div className="trk-stat-sub">Fleet Size</div>
                  </div>
                </div>
                <div className="trk-stat-card green">
                  <div className="trk-stat-icon">
                    <span className="material-symbols-outlined">
                      check_circle
                    </span>
                  </div>
                  <div className="trk-stat-content">
                    <div className="trk-stat-label">Available</div>
                    <div className="trk-stat-value">{stats.available}</div>
                    <div className="trk-stat-sub">Ready to Deploy</div>
                  </div>
                </div>
                <div className="trk-stat-card amber">
                  <div className="trk-stat-icon">
                    <span className="material-symbols-outlined">
                      local_fire_department
                    </span>
                  </div>
                  <div className="trk-stat-content">
                    <div className="trk-stat-label">Dispatched</div>
                    <div className="trk-stat-value">{stats.dispatched}</div>
                    <div className="trk-stat-sub">En Route Now</div>
                  </div>
                </div>
                <div className="trk-stat-card fire">
                  <div className="trk-stat-icon">
                    <span className="material-symbols-outlined">build</span>
                  </div>
                  <div className="trk-stat-content">
                    <div className="trk-stat-label">Maintenance</div>
                    <div className="trk-stat-value">{stats.maintenance}</div>
                    <div className="trk-stat-sub">Under Repair</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="trk-toolbar">
          <div className="trk-search-wrap">
            <span className="trk-search-icon">⌕</span>
            <input
              type="text"
              placeholder="Search plate number, station..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="trk-filter-select"
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
          >
            <option value="">All Stations</option>
            {uniqueStations.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <span className="trk-result-count">
            Showing {filtered.length} Record
            {filtered.length !== 1 ? "s" : ""}
          </span>
          <div className="trk-view-toggle">
            <button
              className={`trk-view-btn${view === "list" ? " active" : ""}`}
              onClick={() => setView("list")}
              title="List view"
            >
              ☰
            </button>
            <button
              className={`trk-view-btn${view === "grid" ? " active" : ""}`}
              onClick={() => setView("grid")}
              title="Grid view"
            >
              ⊞
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="trk-content">
          <div className="trk-table-pagination-wrap">
            {/* TABLE VIEW */}
            {view === "list" && (
              <div className="trk-table-wrap">
                <table className="trk-table">
                  <thead>
                    <tr>
                      <th
                        style={{ width: 190 }}
                        className={
                          sortCol === "truck_platenum" ? "sort-active" : ""
                        }
                        onClick={() => handleSort("truck_platenum")}
                      >
                        Truck{" "}
                        <span className="trk-sort-arrow">
                          {arrow("truck_platenum")}
                        </span>
                      </th>
                      <th style={{ width: 110 }}>Status</th>
                      <th
                        style={{ width: 150 }}
                        className={
                          sortCol === "station_name" ? "sort-active" : ""
                        }
                        onClick={() => handleSort("station_name")}
                      >
                        Station{" "}
                        <span className="trk-sort-arrow">
                          {arrow("station_name")}
                        </span>
                      </th>
                      <th style={{ width: 160 }}>Last Updated</th>
                      <th style={{ width: 140 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 8 }).map((_, i) => (
                          <tr key={i}>
                            <td>
                              <div className="trk-av-wrap">
                                <div
                                  className="trk-skel"
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: "50%",
                                    flexShrink: 0,
                                  }}
                                />
                                <div>
                                  <div
                                    className="trk-skel"
                                    style={{
                                      width: 110,
                                      height: 12,
                                      marginBottom: 6,
                                    }}
                                  />
                                  <div
                                    className="trk-skel"
                                    style={{ width: 76, height: 10 }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td>
                              <div
                                className="trk-skel"
                                style={{ width: 62, height: 18 }}
                              />
                            </td>
                            <td>
                              <div
                                className="trk-skel"
                                style={{ width: 58, height: 12 }}
                              />
                            </td>
                            <td>
                              <div
                                className="trk-skel"
                                style={{ width: 100, height: 12 }}
                              />
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: 4 }}>
                                <div
                                  className="trk-skel"
                                  style={{ width: 38, height: 24 }}
                                />
                                <div
                                  className="trk-skel"
                                  style={{ width: 38, height: 24 }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))
                      : filtered.map((t) => (
                          <tr
                            key={t.truck_id}
                            className={
                              selectedId === t.truck_id ? "selected" : ""
                            }
                            onClick={() => openDrawer(t.truck_id)}
                          >
                            <td>
                              <div className="trk-av-wrap">
                                <div
                                  className={`trk-av ${STATUS_AV[t.truck_status]}`}
                                >
                                  <FireTruckIcon />
                                </div>
                                <div>
                                  <span
                                    className="trk-mono-sm"
                                    style={{ color: "var(--text-secondary)" }}
                                  >
                                    #{t.truck_id}
                                  </span>
                                  <div className="trk-name-full">
                                    {t.truck_platenum}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <StatusPill status={t.truck_status} />
                            </td>
                            <td>
                              <span className="trk-mono-sm">
                                {t.station_name || (
                                  <span style={{ color: "var(--text-muted)" }}>
                                    —
                                  </span>
                                )}
                              </span>
                            </td>
                            <td>
                              <span
                                className="trk-mono-sm"
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: 10,
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {t.truck_last_updated
                                  ? new Date(
                                      t.truck_last_updated
                                    ).toLocaleString()
                                  : "—"}
                              </span>
                            </td>
                            <td>
                              <div
                                className="trk-row-actions"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  className="trk-btn-edit"
                                  onClick={() => openDrawer(t.truck_id)}
                                >
                                  View
                                </button>
                                <button
                                  className="trk-btn-delete"
                                  onClick={() => setEditing(t)}
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
                {!loading && filtered.length === 0 && (
                  <div className="trk-empty">No trucks match your filters</div>
                )}
              </div>
            )}

            {/* GRID VIEW */}
            {view === "grid" && (
              <div className="trk-grid-wrap">
                {loading ? (
                  <div className="trk-grid">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="trk-card available"
                        style={{ cursor: "default" }}
                      >
                        <div className="trk-card-top">
                          <div
                            className="trk-skel"
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: "50%",
                            }}
                          />
                          <div
                            className="trk-skel"
                            style={{ width: 60, height: 18 }}
                          />
                        </div>
                        <div
                          className="trk-skel"
                          style={{ width: "80%", height: 13, marginBottom: 5 }}
                        />
                        <div
                          className="trk-skel"
                          style={{ width: "60%", height: 10, marginBottom: 8 }}
                        />
                        <hr className="trk-card-divider" />
                        <div className="trk-card-row">
                          <div
                            className="trk-skel"
                            style={{ width: 40, height: 10 }}
                          />
                          <div
                            className="trk-skel"
                            style={{ width: 60, height: 10 }}
                          />
                        </div>
                        <div className="trk-card-row">
                          <div
                            className="trk-skel"
                            style={{ width: 40, height: 10 }}
                          />
                          <div
                            className="trk-skel"
                            style={{ width: 60, height: 10 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="trk-empty">No trucks match your filters</div>
                ) : (
                  <div className="trk-grid">
                    {filtered.map((t) => (
                      <div
                        key={t.truck_id}
                        className={`trk-card ${t.truck_status}${
                          selectedId === t.truck_id ? " selected" : ""
                        }`}
                        onClick={() => openDrawer(t.truck_id)}
                      >
                        <div className="trk-card-top">
                          <div
                            className={`trk-card-av ${STATUS_CAV[t.truck_status]}`}
                          >
                            <div className="trk-card-av-ring" />
                            {t.truck_platenum
                              .replace(/[^A-Za-z]/g, "")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <StatusPill status={t.truck_status} />
                        </div>
                        <div className="trk-card-name">
                          {t.truck_platenum}
                        </div>
                        <div className="trk-card-id">#{t.truck_id}</div>
                        <hr className="trk-card-divider" />
                        <div className="trk-card-row">
                          <span className="trk-card-field-label">Station</span>
                          <span className="trk-card-field-val">
                            {t.station_name || "—"}
                          </span>
                        </div>
                        <div className="trk-card-row">
                          <span className="trk-card-field-label">Updated</span>
                          <span className="trk-card-field-val">
                            {t.truck_last_updated
                              ? new Date(
                                  t.truck_last_updated
                                ).toLocaleDateString()
                              : "—"}
                          </span>
                        </div>
                        <div className="trk-card-bottom">
                          <div
                            className="trk-row-actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="trk-btn-edit"
                              onClick={() => setEditing(t)}
                            >
                              Edit
                            </button>
                            <button
                              className="trk-btn-delete"
                              onClick={() => setDeleting(t)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* DETAILS PANEL */}
          <div className="trk-details">
            {selected ? (
              <div className="trk-details-inner">
                <div className="trk-details-top">
                  {/* <div
                    className={`trk-details-av ${STATUS_CAV[selected.truck_status]}`}
                  >
                    <div className="trk-details-av-ring" />
                    {selected.truck_platenum
                      .replace(/[^A-Za-z]/g, "")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div> */}
                  <div>
                    <div className="trk-details-pid">
                      #{selected.truck_id} · {selected.station_name || "—"}
                    </div>
                    <div className="trk-details-name">
                      {selected.truck_platenum}
                    </div>
                    <div className="trk-details-chips">
                      <StatusPill status={selected.truck_status} />
                    </div>
                  </div>
                </div>

                <div className="trk-details-actions">
                  <button className="trk-btn-sec">Track on Map</button>
                  <button
                    className="trk-btn-sec action_btn"
                    onClick={() => setEditing(selected)}
                  >
                    <EditIcon />
                  </button>
                  <button
                    className="trk-btn-sec action_btn"
                    onClick={() => setDeleting(selected)}
                  >
                    <RemoveIcon />
                  </button>
                </div>

                <div className="trk-details-section-title">Truck Details</div>
                <div className="trk-details-grid">
                  {[
                    {
                      label: "Plate Number",
                      value: selected.truck_platenum,
                      mono: true,
                    },
                    {
                      label: "Station",
                      value: selected.station_name || "—",
                    },
                    {
                      label: "Latitude",
                      value: selected.truck_latitude ?? "—",
                      mono: true,
                    },
                    {
                      label: "Longitude",
                      value: selected.truck_longitude ?? "—",
                      mono: true,
                    },
                    {
                      label: "Last Updated",
                      value: selected.truck_last_updated
                        ? new Date(
                            selected.truck_last_updated
                          ).toLocaleString()
                        : "—",
                      mono: true,
                    },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="trk-details-field">
                      <div className="trk-details-label">{label}</div>
                      <div
                        className="trk-details-value"
                        style={
                          mono
                            ? { fontFamily: "var(--font-mono)", fontSize: 11 }
                            : {}
                        }
                      >
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="trk-details-empty">
                Select a truck to view details
              </div>
            )}
          </div>
        </div>
      </div>

      {showAdd && (
        <AddTruckModal
          onClose={() => setShowAdd(false)}
          onSubmit={async (data) => {
            const newTruck = await createTruck(data);
            setTrucks((prev) => [...prev, newTruck]);
            setShowAdd(false);
          }}
        />
      )}
      {editing && (
        <EditTruckModal
          truck={editing}
          onClose={() => setEditing(null)}
          onSubmit={(updated) => {
            setTrucks((prev) =>
              prev.map((t) => (t.truck_id === updated.truck_id ? updated : t))
            );
            setEditing(null);
            setSelectedId(null);
            fetchTrucks().then((data) => setTrucks(data));
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          eyebrow="DELETE TRUCK"
          title={`Delete ${deleting.truck_platenum}?`}
          message={
            <>
              This will permanently remove truck{" "}
              <strong>{deleting.truck_platenum}</strong> from the fleet. This
              action cannot be undone.
            </>
          }
          confirmLabel="Delete Truck"
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
