import { useState, useMemo, useEffect } from "react";
import "../styles/TeamsPage.css";
import { fetchTeams, deleteTeam } from "../api";
import { isOnCurrentShift } from "../utils/shift";
import AddTeamModal from "./AddTeamModal";
import EditTeamModal from "./EditTeamModal";
import ConfirmModal from "./ConfirmModal";

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
      className="meta-icon"
      fill="currentColor"
    >
      <path d="M440-120v-320H120v-80h320v-320h80v320h320v80H520v320h-80Z" />
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

const STATUS_TABS = ["all", "standby", "dispatched", "inactive"];
const TAB_LABELS = {
  all: "All",
  standby: "Standby",
  dispatched: "Dispatched",
  inactive: "Inactive",
};
const STATUS_ORDER = { standby: 0, dispatched: 1, active: 1, inactive: 2 };

function StatusPill({ status, offDuty }) {
  if (offDuty)
    return <span className="tea-status-pill tea-sp-offduty">off-duty</span>;
  const cls =
    status === "standby"
      ? "tea-sp-standby"
      : status === "dispatched" || status === "active"
      ? "tea-sp-dispatched"
      : "tea-sp-inactive";
  return <span className={`tea-status-pill ${cls}`}>{status}</span>;
}

function ShiftBadge({ name }) {
  if (!name || name === "—")
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  const cls =
    name === "Shift A" ? "b-blue" : name === "Shift B" ? "b-amber" : "b-muted";
  return <span className={`tea-badge ${cls}`}>{name}</span>;
}

function MemberAvatar({ initials }) {
  return (
    <div className="tea-member-av">
      <div className="tea-member-av-ring" />
      {initials}
    </div>
  );
}

export default function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState("team_name");
  const [sortDir, setSortDir] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState("list");

  useEffect(() => {
    fetchTeams()
      .then((data) => {
        setTeams(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const stats = useMemo(
    () => ({
      total: teams.length,
      dispatched: teams.filter(
        (t) => t.team_status === "dispatched" || t.team_status === "active"
      ).length,
      standby: teams.filter((t) => t.team_status === "standby").length,
      inactive: teams.filter((t) => t.team_status === "inactive").length,
    }),
    [teams]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const rows = teams.filter((t) => {
      const matchSearch =
        !q ||
        t.team_name.toLowerCase().includes(q) ||
        (t.team_code || "").toLowerCase().includes(q) ||
        (t.station_name || "").toLowerCase().includes(q);
      const matchStatus =
        activeStatus === "all" || t.team_status === activeStatus;
      return matchSearch && matchStatus;
    });
    rows.sort((a, b) => {
      let av, bv;
      if (sortCol === "team_name") {
        av = a.team_name;
        bv = b.team_name;
      }
      if (sortCol === "team_code") {
        av = a.team_code || "";
        bv = b.team_code || "";
      }
      if (sortCol === "team_status") {
        av = STATUS_ORDER[a.team_status] ?? 9;
        bv = STATUS_ORDER[b.team_status] ?? 9;
      }
      if (sortCol === "station") {
        av = a.station_name || "";
        bv = b.station_name || "";
      }
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      return 0;
    });
    return rows;
  }, [teams, search, activeStatus, sortCol, sortDir]);

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

  function handleAdded(team) {
    setTeams((prev) => [...prev, team]);
    setShowAdd(false);
  }

  function handleUpdated(updated) {
    setTeams((prev) =>
      prev.map((t) => (t.team_id === updated.team_id ? updated : t))
    );
    setEditing(null);
  }

  async function confirmDelete() {
    const team = deleting;
    await deleteTeam(team.team_id);
    setTeams((prev) => prev.filter((t) => t.team_id !== team.team_id));
    if (selectedId === team.team_id) setSelectedId(null);
  }

  const selected = teams.find((t) => t.team_id === selectedId);

  return (
    <>
      <div className="tea-page">
        {/* HEADER */}
        <div className="tea-header">
          <div className="tea-title-row">
            <div className="tea-title">
              Response Teams
              <UnfoldIcon />
            </div>
            <div className="tea-header-actions">
              <button className="tea-btn-secondary">
                <ExportIcon />
                Export
              </button>
              <button
                className="tea-btn-primary"
                onClick={() => setShowAdd(true)}
              >
                <AddIcon />
                Add Team
              </button>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="tea-body">
          <div className="tea-section-row">
            <div className="tea-section-label">Overview</div>
            <div className="tea-status-tabs">
              {STATUS_TABS.map((s) => (
                <button
                  key={s}
                  className={`tea-status-tab${
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
          <div className="tea-stat-row">
            {loading ? (
              ["blue", "green", "amber", "muted"].map((cls) => (
                <div key={cls} className={`tea-stat-card ${cls}`}>
                  <div className="tea-stat-icon">
                    <div
                      className="tea-skel"
                      style={{ width: 28, height: 28, borderRadius: "50%" }}
                    />
                  </div>
                  <div
                    className="tea-stat-content"
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 6,
                    }}
                  >
                    <div
                      className="tea-skel"
                      style={{ width: 52, height: 10 }}
                    />
                    <div
                      className="tea-skel"
                      style={{ width: 36, height: 28 }}
                    />
                    <div
                      className="tea-skel"
                      style={{ width: 80, height: 8 }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="tea-stat-card blue">
                  <div className="tea-stat-icon">
                    <span className="material-symbols-outlined">groups</span>
                  </div>
                  <div className="tea-stat-content">
                    <div className="tea-stat-label">Total Teams</div>
                    <div className="tea-stat-value">{stats.total}</div>
                    <div className="tea-stat-sub">All Teams</div>
                  </div>
                </div>
                <div className="tea-stat-card blue">
                  <div className="tea-stat-icon">
                    <span className="material-symbols-outlined">
                      pause_circle
                    </span>
                  </div>
                  <div className="tea-stat-content">
                    <div className="tea-stat-label">Standby</div>
                    <div className="tea-stat-value">{stats.standby}</div>
                    <div className="tea-stat-sub">Ready</div>
                  </div>
                </div>
                <div className="tea-stat-card amber">
                  <div className="tea-stat-icon">
                    <span className="material-symbols-outlined">
                      local_shipping
                    </span>
                  </div>
                  <div className="tea-stat-content">
                    <div className="tea-stat-label">Dispatched</div>
                    <div className="tea-stat-value">{stats.dispatched}</div>
                    <div className="tea-stat-sub">In Field</div>
                  </div>
                </div>
                <div className="tea-stat-card muted">
                  <div className="tea-stat-icon">
                    <span className="material-symbols-outlined">block</span>
                  </div>
                  <div className="tea-stat-content">
                    <div className="tea-stat-label">Inactive</div>
                    <div className="tea-stat-value">{stats.inactive}</div>
                    <div className="tea-stat-sub">Disabled</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="tea-toolbar">
          <div className="tea-search-wrap">
            <span className="tea-search-icon">⌕</span>
            <input
              placeholder="Search team, code, station..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="tea-result-count">
            Showing {filtered.length} Result{filtered.length !== 1 ? "s" : ""}
          </span>
          <div className="tea-view-toggle">
            <button
              className={`tea-view-btn${view === "list" ? " active" : ""}`}
              onClick={() => setView("list")}
              title="List view"
            >
              ☰
            </button>
            <button
              className={`tea-view-btn${view === "grid" ? " active" : ""}`}
              onClick={() => setView("grid")}
              title="Grid view"
            >
              ⊞
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="tea-content">
          <div className="tea-table-pagination-wrap">
            {/* TABLE VIEW */}
            {view === "list" && (
              <div className="tea-table-wrap">
                <table className="tea-table">
                  <thead>
                    <tr>
                      {/* <th
                        style={{ width: 160 }}
                        className={sortCol === "team_code" ? "sort-active" : ""}
                        onClick={() => handleSort("team_code")}
                      >
                        Code{" "}
                        <span className="tea-sort-arrow">
                          {arrow("team_code")}
                        </span>
                      </th> */}
                      <th
                        style={{ width: 170 }}
                        className={sortCol === "team_name" ? "sort-active" : ""}
                        onClick={() => handleSort("team_name")}
                      >
                        Team{" "}
                        <span className="tea-sort-arrow">
                          {arrow("team_name")}
                        </span>
                      </th>
                      <th
                        style={{ width: 100 }}
                        className={
                          sortCol === "team_status" ? "sort-active" : ""
                        }
                        onClick={() => handleSort("team_status")}
                      >
                        Status{" "}
                        <span className="tea-sort-arrow">
                          {arrow("team_status")}
                        </span>
                      </th>
                      <th style={{ width: 80 }}>Shift</th>
                      <th
                        style={{ width: 150 }}
                        className={sortCol === "station" ? "sort-active" : ""}
                        onClick={() => handleSort("station")}
                      >
                        Station{" "}
                        <span className="tea-sort-arrow">
                          {arrow("station")}
                        </span>
                      </th>
                      <th style={{ width: 60 }}>Members</th>
                      <th style={{ width: 140 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 6 }).map((_, i) => (
                          <tr key={i}>
                            {/* <td>
                              <div
                                className="tea-skel"
                                style={{ width: 80, height: 20 }}
                              />
                            </td> */}
                            <td>
                              <div
                                className="tea-skel"
                                style={{ width: 140, height: 13 }}
                              />
                            </td>
                            <td>
                              <div
                                className="tea-skel"
                                style={{ width: 62, height: 18 }}
                              />
                            </td>
                            <td>
                              <div
                                className="tea-skel"
                                style={{ width: 58, height: 18 }}
                              />
                            </td>
                            <td>
                              <div
                                className="tea-skel"
                                style={{ width: 120, height: 12 }}
                              />
                            </td>
                            <td>
                              <div
                                className="tea-skel"
                                style={{ width: 28, height: 12 }}
                              />
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: 4 }}>
                                <div
                                  className="tea-skel"
                                  style={{ width: 38, height: 24 }}
                                />
                                <div
                                  className="tea-skel"
                                  style={{ width: 46, height: 24 }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))
                      : filtered.map((team) => (
                          <tr
                            key={team.team_id}
                            className={
                              selectedId === team.team_id ? "selected" : ""
                            }
                            onClick={() => openDrawer(team.team_id)}
                          >
                            {/* <td>
                              {team.team_code ? (
                                <span className="tea-code">
                                  {team.team_code}
                                </span>
                              ) : (
                                <span style={{ color: "var(--text-muted)" }}>
                                  —
                                </span>
                              )}
                            </td> */}
                            <td>
                              <div className="team-code-wrap">
                                {team.team_code ? (
                                  <span className="tea-code">
                                    {team.team_code}
                                  </span>
                                ) : (
                                  <span style={{ color: "var(--text-muted)" }}>
                                    —
                                  </span>
                                )}
                                <div className="team-name-wrap">
                                  {team.team_name}
                                </div>
                              </div>
                            </td>
                            <td>
                              <StatusPill
                                status={team.team_status}
                                offDuty={!isOnCurrentShift(team.shift_name)}
                              />
                            </td>
                            <td>
                              <ShiftBadge name={team.shift_name} />
                            </td>
                            <td>
                              <span className="tea-mono-sm">
                                {team.station_name || "—"}
                              </span>
                            </td>
                            <td
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 11,
                              }}
                            >
                              {team.member_count}
                            </td>
                            <td>
                              <div className="tea-row-actions">
                                <button
                                  className="tea-btn-view"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDrawer(team.team_id);
                                  }}
                                >
                                  View
                                </button>
                                <button
                                  className="tea-btn-edit"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditing(team);
                                  }}
                                >
                                  Edit
                                </button>
                                {/* <button
                                  className="tea-btn-delete"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleting(team);
                                  }}
                                >
                                  Delete
                                </button> */}
                              </div>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
                {!loading && filtered.length === 0 && (
                  <div className="tea-empty">No teams match your filters</div>
                )}
              </div>
            )}

            {/* GRID VIEW */}
            {view === "grid" && (
              <div className="tea-grid-wrap">
                {loading ? (
                  <div className="tea-grid">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="tea-card"
                        style={{ cursor: "default" }}
                      >
                        <div className="tea-card-top">
                          <div
                            className="tea-skel"
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: "50%",
                            }}
                          />
                          <div
                            className="tea-skel"
                            style={{ width: 60, height: 18 }}
                          />
                        </div>
                        <div
                          className="tea-skel"
                          style={{ width: "80%", height: 13, marginBottom: 5 }}
                        />
                        <div
                          className="tea-skel"
                          style={{ width: "60%", height: 10, marginBottom: 4 }}
                        />
                        <div
                          className="tea-skel"
                          style={{ width: "40%", height: 10, marginBottom: 8 }}
                        />
                        <hr className="tea-card-divider" />
                        <div className="tea-card-row">
                          <div
                            className="tea-skel"
                            style={{ width: 40, height: 10 }}
                          />
                          <div
                            className="tea-skel"
                            style={{ width: 60, height: 10 }}
                          />
                        </div>
                        <div className="tea-card-row">
                          <div
                            className="tea-skel"
                            style={{ width: 40, height: 10 }}
                          />
                          <div
                            className="tea-skel"
                            style={{ width: 60, height: 10 }}
                          />
                        </div>
                        <div className="tea-card-row">
                          <div
                            className="tea-skel"
                            style={{ width: 40, height: 10 }}
                          />
                          <div
                            className="tea-skel"
                            style={{ width: 60, height: 10 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="tea-empty">No teams match your filters</div>
                ) : (
                  <div className="tea-grid">
                    {filtered.map((team) => (
                      <div
                        key={team.team_id}
                        className={`tea-card ${team.team_status}${
                          selectedId === team.team_id ? " selected" : ""
                        }`}
                        onClick={() => openDrawer(team.team_id)}
                      >
                        <div className="tea-card-top">
                          <div
                            className={`tea-card-av tea-cav-${
                              team.team_status === "active"
                                ? "dispatched"
                                : team.team_status
                            }`}
                          >
                            <div className="tea-card-av-ring" />
                            {(team.team_name || "")
                              .split(" ")
                              .map((w) => w[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <StatusPill
                            status={team.team_status}
                            offDuty={!isOnCurrentShift(team.shift_name)}
                          />
                        </div>
                        <div className="tea-card-name">{team.team_name}</div>
                        <div className="tea-card-code">
                          {team.team_code || "—"}
                        </div>
                        <hr className="tea-card-divider" />
                        <div className="tea-card-row">
                          <span className="tea-card-field-label">Station</span>
                          <span className="tea-card-field-val">
                            {team.station_name || "—"}
                          </span>
                        </div>
                        <div className="tea-card-row">
                          <span className="tea-card-field-label">Shift</span>
                          <span
                            className="tea-card-field-val"
                            style={{
                              color:
                                team.shift_name && team.shift_name !== "—"
                                  ? "var(--accent-blue)"
                                  : "var(--text-muted)",
                            }}
                          >
                            {team.shift_name || "—"}
                          </span>
                        </div>
                        <div className="tea-card-row">
                          <span className="tea-card-field-label">Members</span>
                          <span className="tea-card-field-val">
                            {team.member_count}
                          </span>
                        </div>
                        <div className="tea-card-bottom">
                          <div className="tea-card-members-row">
                            {(team.members || []).slice(0, 4).map((m) => (
                              <MemberAvatar
                                key={m.per_id}
                                initials={m.initials}
                              />
                            ))}
                            {(team.members || []).length > 4 && (
                              <span className="tea-card-more">
                                +{team.members.length - 4}
                              </span>
                            )}
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
          <div className="tea-details">
            {selected ? (
              <div className="tea-details-inner">
                <div className="tea-details-top">
                  {/* <div
                    className={`tea-details-av tea-cav-${selected.team_status}`}
                  >
                    <div className="tea-details-av-ring" />
                    {(selected.team_name || "")
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div> */}
                  <div>
                    <div className="tea-details-code">
                      {selected.team_code || "—"} ·{" "}
                      {selected.station_name || "—"}
                    </div>
                    <div className="tea-details-name">{selected.team_name}</div>
                    <div className="tea-details-chips">
                      <StatusPill
                        status={selected.team_status}
                        offDuty={!isOnCurrentShift(selected.shift_name)}
                      />
                      <ShiftBadge name={selected.shift_name} />
                    </div>
                  </div>
                </div>

                <div className="tea-details-actions">
                  <button
                    className="tea-btn-sec action_btn"
                    onClick={() => setEditing(selected)}
                  >
                    <EditIcon/>
                  </button>
                  <button
                    className="tea-btn-sec action_btn"
                    onClick={() => setDeleting(selected)}
                  >
                    <RemoveIcon/>
                  </button>
                </div>

                <div className="tea-details-section-title">Team Details</div>
                <div className="tea-details-grid">
                  {[
                    { label: "Code", value: selected.team_code || "—" },
                    {
                      label: "Status",
                      value: isOnCurrentShift(selected.shift_name)
                        ? selected.team_status
                        : "off-duty",
                    },
                    { label: "Station", value: selected.station_name || "—" },
                    { label: "Shift", value: null, shift: selected.shift_name },
                    { label: "Members", value: String(selected.member_count) },
                    {
                      label: "Created",
                      value: selected.created_at
                        ? new Date(selected.created_at).toLocaleDateString()
                        : "—",
                    },
                  ].map(({ label, value, shift }) => (
                    <div key={label} className="tea-details-field">
                      <div className="tea-details-label">{label}</div>
                      <div className="tea-details-value">
                        {shift !== undefined ? (
                          <ShiftBadge name={shift} />
                        ) : (
                          value
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="tea-details-section-title">
                  Members ({(selected.members || []).length})
                </div>
                <div className="tea-details-members">
                  {(selected.members || []).length === 0 ? (
                    <div className="tea-details-members-empty">
                      No members assigned
                    </div>
                  ) : (
                    (selected.members || []).map((m) => (
                      <div key={m.per_id} className="tea-details-member-row">
                        <MemberAvatar initials={m.initials} />
                        <div className="tea-details-member-info">
                          <div className="tea-details-member-name">
                            {m.name}
                          </div>
                          <div className="tea-details-member-rank">
                            {m.rank !== "—" ? m.rank : ""}
                          </div>
                        </div>
                        {m.member_role && (
                          <span
                            className="tea-badge b-muted"
                            style={{ fontSize: 8, marginLeft: "auto" }}
                          >
                            {m.member_role}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="tea-details-empty">
                Select a team to view details
              </div>
            )}
          </div>
        </div>
      </div>

      {showAdd && (
        <AddTeamModal
          onClose={() => setShowAdd(false)}
          onSubmit={handleAdded}
        />
      )}
      {editing && (
        <EditTeamModal
          team={editing}
          onClose={() => setEditing(null)}
          onSubmit={handleUpdated}
        />
      )}
      {deleting && (
        <ConfirmModal
          eyebrow="DELETE TEAM"
          title={`Delete ${deleting.team_name}?`}
          message={
            <>
              This will permanently remove team{" "}
              <strong>{deleting.team_name}</strong> and its member assignments.
              This action cannot be undone.
            </>
          }
          confirmLabel="Delete Team"
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
