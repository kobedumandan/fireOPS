import { useState, useMemo, useEffect, useCallback } from "react";
import "../styles/StationsPage.css";
import { fetchStations, createStation, deleteStation, fetchPersonnel, fetchTeams, fetchTrucks } from "../api";
import AddStationModal from "./AddStationModal";
import EditStationModal from "./EditStationModal";
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

function FireTruckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="sta-truck-svg"
      fill="currentColor"
    >
      <path d="M195-155q-35-35-35-85h-40q-33 0-56.5-23.5T40-320v-200h440v-160q0-33 23.5-56.5T560-760h80v-40q0-17 11.5-28.5T680-840h40q17 0 28.5 11.5T760-800v40h22q26 0 47 15t29 40l58 172q2 6 3 12.5t1 13.5v267H800q0 50-35 85t-85 35q-50 0-85-35t-35-85H400q0 50-35 85t-85 35q-50 0-85-35Zm113.5-56.5Q320-223 320-240t-11.5-28.5Q297-280 280-280t-28.5 11.5Q240-257 240-240t11.5 28.5Q263-200 280-200t28.5-11.5Zm400 0Q720-223 720-240t-11.5-28.5Q697-280 680-280t-28.5 11.5Q640-257 640-240t11.5 28.5Q663-200 680-200t28.5-11.5ZM120-440v120h71q17-19 40-29.5t49-10.5q26 0 49 10.5t40 29.5h111v-120H120Zm440 120h31q17-19 40-29.5t49-10.5q26 0 49 10.5t40 29.5h71v-120H560v120Zm0-200h276l-54-160H560v160ZM40-560v-60h40v-80H40v-60h400v60h-40v80h40v60H40Zm100-60h70v-80h-70v80Zm130 0h70v-80h-70v80Zm210 180H120h360Zm80 0h280-280Z" />
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
    commanderId: s.station_commander_id || null,
    commander: s.commander_name || "—",
    established: s.created_at
      ? new Date(s.created_at).getFullYear().toString()
      : "—",
    coverage: s.station_barangay || "—",
    capacity: 0,
    capUsed: 0,
    incident: "—",
    subs: [],
    personnelList: [],
    teamsList: [],
    trucksList: [],
  };
}

const TABS = ["all", "main", "sub"];
const TAB_LABELS = {
  all: "All",
  main: "Main Stations",
  sub: "Substations",
};

const P_STATUS_MAP = {
  dispatched: { cls: "sta-hb-amber", label: "Dispatched" },
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
  return (
    <span className={`sta-hbadge ${cls}`}>
      {status === "dispatched" && <span className="sta-blink-dot" />}
      {label}
    </span>
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
            <span className="material-symbols-outlined">
              {isMain ? "apartment" : "location_on"}
            </span>
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
        {/* <div className="sta-meta-chip">
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
        </div> */}
        <div className="sta-meta-chip">
          {/* <div className="sta-meta-dot md-muted" /> */}
          {s.district}
        </div>
      </div>
      <div className="sta-item-parent" style={{ visibility: parent ? 'visible' : 'hidden' }}>
        {parent ? `↑ Under ${parent.name}` : '↑'}
      </div>
    </div>
  );
}

function StationDetail({ s, stations, onSelectStation, onEdit, onDelete }) {
  if (!s) {
    return (
      <div className="sta-no-selection">
        <div className="sta-no-sel-icon">
          <span className="material-symbols-outlined">apartment</span>
        </div>
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
              <span className="material-symbols-outlined">
                {isMain ? "apartment" : "location_on"}
              </span>
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
            {/* <span
              className={`sta-hbadge ${isMain ? "sta-hb-gold" : "sta-hb-blue"}`}
            >
              {isMain ? "Command" : "Satellite"}
            </span> */}
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
            <div className="sta-ds-label">Fire Trucks</div>
            <div className="sta-ds-value">{s.trucksList.length}</div>
            <div className="sta-ds-sub">{s.activeUnits} DEPLOYED</div>
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

      {/* Teams */}
      {s.teamsList.length > 0 && (
        <div className="sta-info-section">
          <div className="sta-info-title">Response Teams</div>
          <div className="sta-teams-list">
            {s.teamsList.map((t) => (
              <div key={t.team_id} className="sta-team-row">
                <div className="sta-team-icon">
                  <span className="material-symbols-outlined">flag</span>
                </div>
                <div className="sta-team-info">
                  <div className="sta-team-name">{t.name}</div>
                  <div className="sta-team-code">{t.code || "—"}</div>
                </div>
                <div className="sta-team-meta">
                  <div className="sta-team-chip">
                    <span className="sta-team-chip-val">{t.members}</span>
                    <span className="sta-team-chip-label">Members</span>
                  </div>
                  <div className="sta-team-chip">
                    <span className={`sta-hbadge ${
                      t.status === "dispatched"   ? "sta-hb-amber" :
                      t.status === "standby"  ? "sta-hb-blue"  :
                      t.status === "inactive" ? "sta-hb-muted"  : "sta-hb-muted"
                    }`}>
                      {t.status === "dispatched" && (
                        <span className="sta-blink-dot" />
                      )}
                      {t.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trucks */}
      {s.trucksList.length > 0 && (
        <div className="sta-info-section">
          <div className="sta-info-title">Fire Trucks</div>
          <div className="sta-teams-list">
            {s.trucksList.map((t) => {
              const chipCls =
                t.status === "available"   ? "sta-hb-green" :
                t.status === "dispatched"  ? "sta-hb-amber" :
                t.status === "maintenance" ? "sta-hb-muted" :
                                             "sta-hb-muted";
              return (
                <div key={t.truck_id} className="sta-team-row">
                  <div className="sta-team-icon">
                  <span className="material-symbols-outlined">fire_truck</span>
                  </div>
                  <div className="sta-team-info">
                    <div className="sta-team-name">{t.plate}</div>
                  </div>
                  <div className="sta-team-meta">
                    <span className={`sta-hbadge ${chipCls}`}>
                      {t.status === "dispatched" && (
                        <span className="sta-blink-dot" />
                      )}
                      {t.status}
                    </span>
                  </div>
                </div>
              );
            })}
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
                      ? "pav-amber"
                      : p.status === "onscene"
                      ? "pav-amber"
                      : "pav-normal"
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
        {/* <button className="sta-btn-dispatch">Dispatch From This Station</button> */}
        <button className="sta-btn-sec">View on Map</button>
        <button className="sta-btn-sec">Incident History</button>
        <button className="sta-btn-sec action_btn" onClick={onEdit}>
          <EditIcon />
        </button>
        <button className="sta-btn-sec action_btn" onClick={onDelete}>
          <RemoveIcon />
        </button>
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const loadStations = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [data, personnel, teams, trucks] = await Promise.all([fetchStations(), fetchPersonnel(), fetchTeams(), fetchTrucks()]);
      const mapped = data.map(dbToStation);

      // populate subs arrays from parent references
      mapped.forEach((s) => {
        if (s.type === "sub" && s.parent) {
          const parentStation = mapped.find((x) => x.id === s.parent);
          if (parentStation) parentStation.subs.push(s.id);
        }
      });

      // populate teamsList from fetched teams
      teams.forEach((t) => {
        if (!t.station_id) return;
        const station = mapped.find((s) => {
          const rawId = parseInt(s.id.replace("STA-", ""), 10);
          return rawId === t.station_id;
        });
        if (station) {
          station.teamsList.push({
            team_id:    t.team_id,
            name:       t.team_name,
            code:       t.team_code,
            status:     t.team_status,
            members:    t.member_count,
          });
        }
      });

      // populate trucksList from fetched trucks
      trucks.forEach((t) => {
        if (!t.station_id) return;
        const station = mapped.find((s) => {
          const rawId = parseInt(s.id.replace("STA-", ""), 10);
          return rawId === t.station_id;
        });
        if (station) {
          station.trucksList.push({
            truck_id: t.truck_id,
            plate:    t.truck_platenum,
            status:   t.truck_status,
          });
          station.units = station.trucksList.length;
          if (t.truck_status === "dispatched") station.activeUnits += 1;
        }
      });

      // populate personnelList and personnel count from fetched personnel
      personnel.forEach((p) => {
        if (!p.station_id) return;
        const station = mapped.find((s) => {
          const rawId = parseInt(s.id.replace("STA-", ""), 10);
          return rawId === p.station_id;
        });
        if (station) {
          const first = (p.name || "").split(" ")[0] || "";
          const last  = (p.name || "").split(" ").slice(1).join(" ");
          station.personnelList.push({
            per_id:   p.per_id,
            name:     p.name,
            initials: ((first[0] || "") + (last[0] || "")).toUpperCase() || "??",
            rank:     p.rank,
            status:   p.status,
          });
          station.personnel = station.personnelList.length;
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

  async function confirmDelete() {
    const stationId = parseInt(deleting.id.replace("STA-", ""), 10);
    await deleteStation(stationId);
    if (selectedId === deleting.id) setSelectedId(null);
    await loadStations();
  }

  return (
    <div className="sta-page">
      {/* PAGE HEADER */}
      <div className="sta-header">
        <div className="sta-title-row">
          <div className="sta-title">
            Stations
            <UnfoldIcon />
          </div>
          <div className="sta-header-actions">
            <button className="sta-btn-secondary">
              <ExportIcon />
              Export
            </button>
            <button
              className="sta-btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              <AddIcon />
              Add Station
            </button>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="sta-body">
        <div className="sta-section-row">
          <div className="sta-section-label">Overview</div>
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

        {/* STAT CARDS — 3 cards: Main, Sub, Personnel */}
        <div className="sta-stat-row">
          {loading ? (
            ['amber', 'blue', 'purple'].map(cls => (
              <div key={cls} className={`sta-stat-card ${cls}`}>
                <div className="sta-stat-content" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="sta-skel" style={{ width: 80, height: 10 }} />
                  <div className="sta-skel" style={{ width: 50, height: 26 }} />
                  <div className="sta-skel" style={{ width: 100, height: 8 }} />
                </div>
                <div className="sta-stat-icon">
                  <div className="sta-skel" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                </div>
              </div>
            ))
          ) : (
            <>
              <div className="sta-stat-card amber">
                <div className="sta-stat-content">
                  <div className="sta-stat-label">Main Stations</div>
                  <div className="sta-stat-value">{stats.main}</div>
                  <div className="sta-stat-sub">Command Hubs</div>
                </div>
                <div className="sta-stat-icon">
                  <span className="material-symbols-outlined">apartment</span>
                </div>
              </div>
              <div className="sta-stat-card blue">
                <div className="sta-stat-content">
                  <div className="sta-stat-label">Sub-Stations</div>
                  <div className="sta-stat-value">{stats.sub}</div>
                  <div className="sta-stat-sub">Satellite Units</div>
                </div>
                <div className="sta-stat-icon">
                  <span className="material-symbols-outlined">location_on</span>
                </div>
              </div>
              <div className="sta-stat-card purple">
                <div className="sta-stat-content">
                  <div className="sta-stat-label">Total Personnel</div>
                  <div className="sta-stat-value">{stats.personnel}</div>
                  <div className="sta-stat-sub">Across All Stations</div>
                </div>
                <div className="sta-stat-icon">
                  <span className="material-symbols-outlined">groups</span>
                </div>
              </div>
            </>
          )}
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
        <span className="sta-result-count">
          Showing {filtered.length} Station{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* CONTENT AREA */}
      <div className="sta-content">
        {/* LEFT: Station List */}
        <div className="sta-list">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`sta-item ${i % 3 === 0 ? 'sta-item-sub' : 'sta-item-main'}`} style={{ cursor: 'default' }}>
                <div className="sta-item-top">
                  <div className="sta-item-name-wrap">
                    <div className="sta-skel" style={{ width: 30, height: 30, borderRadius: 4, flexShrink: 0 }} />
                    <div>
                      <div className="sta-skel" style={{ width: 130, height: 13, marginBottom: 5 }} />
                      <div className="sta-skel" style={{ width: 60, height: 9 }} />
                    </div>
                  </div>
                  <div className="sta-skel" style={{ width: 30, height: 16, borderRadius: 2 }} />
                </div>
                <div className="sta-item-meta">
                  <div className="sta-skel" style={{ width: 80, height: 10 }} />
                  <div className="sta-skel" style={{ width: 55, height: 10 }} />
                  <div className="sta-skel" style={{ width: 65, height: 10 }} />
                </div>
                <div className="sta-item-parent">
                  <div className="sta-skel" style={{ width: 100, height: 9 }} />
                </div>
              </div>
            ))
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
            onEdit={() => setShowEditModal(true)}
            onDelete={() => setDeleting(selected)}
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

      {showEditModal && selected && (
        <EditStationModal
          station={selected}
          stations={stations}
          onClose={() => setShowEditModal(false)}
          onSaved={loadStations}
        />
      )}

      {deleting && (
        <ConfirmModal
          eyebrow="DELETE STATION"
          title={`Delete ${deleting.name}?`}
          message={
            <>
              This will permanently remove station{" "}
              <strong>{deleting.name}</strong>. Personnel, trucks, or teams
              assigned to it must be reassigned first. This action cannot be
              undone.
            </>
          }
          confirmLabel="Delete Station"
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
