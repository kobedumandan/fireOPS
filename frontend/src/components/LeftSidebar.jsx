import "../styles/LeftSidebar.css";

const INCIDENTS = [
  {
    id: "INC-2026-084",
    severity: "critical",
    badge: "Critical",
    location: "Brgy. San Isidro, Quezon City",
    time: "08:42",
    distance: "2.1 km",
    units: 2,
  },
  {
    id: "INC-2026-083",
    severity: "moderate",
    badge: "Moderate",
    location: "Tandang Sora Ave., QC",
    time: "07:15",
    distance: "4.7 km",
    units: 1,
  },
  {
    id: "INC-2026-081",
    severity: "contained",
    badge: "Contained",
    location: "Batasan Hills, QC",
    time: "05:30",
    distance: "8.3 km",
    units: 3,
  },
];

const PERSONNEL = [
  {
    initials: "JD",
    name: "J. Dela Cruz",
    statusClass: "pa-dispatched",
    dotClass: "ps-dispatched",
    statusText: "En Route → INC-084",
    iot: "IoT ✓",
  },
  {
    initials: "MR",
    name: "M. Reyes",
    statusClass: "pa-dispatched",
    dotClass: "ps-dispatched",
    statusText: "En Route → INC-084",
    iot: "IoT ✓",
  },
  {
    initials: "AB",
    name: "A. Bautista",
    statusClass: "pa-onscene",
    dotClass: "ps-onscene",
    statusText: "On Scene → INC-083",
    iot: "IoT ✓",
  },
  {
    initials: "KS",
    name: "K. Santos",
    statusClass: "pa-standby",
    dotClass: "ps-standby",
    statusText: "Standby → Station 1",
    iot: "SMS",
  },
  {
    initials: "RL",
    name: "R. Lim",
    statusClass: "pa-standby",
    dotClass: "ps-standby",
    statusText: "Standby → Station 2",
    iot: "IoT ✓",
  },
  {
    initials: "FT",
    name: "F. Torres",
    statusClass: "pa-standby",
    dotClass: "ps-standby",
    statusText: "Standby → Station 1",
    iot: "IoT ✓",
  },
];

export default function LeftSidebar({
  selectedId,
  onSelectIncident,
  newIncidents = [],
  onStartPicking,
  pickingMode = false,
  onOpenLocationRequest,
  reporterCount = 0,
  collapsed = false,
  onToggleCollapse,
}) {
  const allIncidents = [
    ...INCIDENTS,
    ...newIncidents.map((n) => ({
      id: n.id,
      severity: n.severity.toLowerCase(),
      badge: n.severity,
      location: n.locationName,
      time: n.time,
      distance: "— km",
      units: 0,
    })),
  ];

  const criticalCount = allIncidents.filter(
    (i) => i.severity === "critical"
  ).length;
  const activePersonnel = PERSONNEL.filter(
    (p) => p.statusClass !== "pa-standby"
  ).length;

  if (collapsed) {
    return (
      <div className="sidebar-left collapsed">
        {/* Expand */}
        <div className="slc-expand-btn-wrap">
          <button
            className="slc-icon-btn"
            onClick={onToggleCollapse}
            title="Expand sidebar"
          >
            ›
          </button>
        </div>

        {/* Incidents */}
        <div className="sidebar-section">
          <div className="slc-expand-btn-wrap">
            <button
              className="slc-section-btn"
              onClick={onToggleCollapse}
              title={`${allIncidents.length} Active Incidents`}
            >
              <img src="src\assets\svg_icons\fire_icon.svg" alt="" />
              <span className="slc-badge slc-badge--fire">
                {allIncidents.length}
              </span>
              {criticalCount > 0 && (
                <span className="slc-dot slc-dot--critical" />
              )}
            </button>
          </div>
          {/* <div className="incident-list">
            {allIncidents.map((inc) => (
              <div
                key={inc.id}
                className={`slc-inc-strip ${inc.severity}${
                  selectedId === inc.id ? " selected" : ""
                }`}
                title={`${inc.id} · ${inc.location}`}
                onClick={() => onSelectIncident(inc.id)}
              />
            ))}
          </div> */}
        </div>

        {/* Personnel */}
        <div className="sidebar-section-last">
          <div className="slc-expand-btn-wrap">
            <button
              className="slc-section-btn"
              onClick={onToggleCollapse}
              title={`${PERSONNEL.length} Field Personnel`}
            >
              <img src="src/assets/svg_icons/account_icon.svg" alt="" />
              <span className="slc-badge slc-badge--blue">{activePersonnel}</span>
            </button>
          </div>
          <div className="incident-list">
            {PERSONNEL.map((p) => (
              <div
                key={p.initials}
                className="slc-avatar-wrap"
                title={`${p.name} · ${p.statusText}`}
              >
                <div className={`personnel-avatar ${p.statusClass}`}>
                  <div className="status-ring" />
                  {p.initials}
                </div>
              </div>
            ))}
          </div>
        </div>
{/* 
        <div className="slc-divider" /> */}

        {/* Actions */}
        <div className="slc-action-btn-wrap">
          <button
            className="slc-action-btn fire"
            onClick={onStartPicking}
            title="Log New Incident"
            disabled={pickingMode}
          >
            {pickingMode ? <span className="slt-picking-dot" /> : <img src="src/assets/svg_icons/action_fire.svg" alt="" />}
          </button>
          <button
            className="slc-action-btn blue"
            onClick={onOpenLocationRequest}
            title="Request Location"
            disabled={pickingMode}
          >
            <img src="src/assets/svg_icons/action_blue.svg" alt="" />
            {reporterCount > 0 && (
              <span className="slc-badge slc-badge--blue">{reporterCount}</span>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar-left">
      {/* Incidents */}
      <div className="sidebar-section">
        <div className="section-header">
          <span className="section-title">Active Incidents</span>
          <div className="section-count-collapse-wrap">
            <span className="section-count">{allIncidents.length} TOTAL</span>
            <button
              className="slc-collapse-inline-btn"
              onClick={onToggleCollapse}
              title="Collapse"
            >
              ‹
            </button>
          </div>
        </div>
        <div className="incident-list">
          {allIncidents.map((inc) => (
            <div
              key={inc.id}
              className={`incident-card ${inc.severity}${
                selectedId === inc.id ? " selected" : ""
              }`}
              onClick={() => onSelectIncident(inc.id)}
            >
              <div className="incident-top">
                <span className="incident-id">{inc.id}</span>
                <span className={`incident-badge badge-${inc.severity}`}>
                  {inc.badge}
                </span>
              </div>
              <div className="incident-location">{inc.location}</div>
              <div className="incident-meta">
                <span>⏱ {inc.time}</span>
                <span>📍 {inc.distance}</span>
                <span>{inc.units} units</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Personnel */}
      <div className="sidebar-section-last">
        <div className="section-header">
          <span className="section-title">Field Personnel</span>
          <span className="section-count">6 ACTIVE</span>
        </div>
        <div className="incident-list">
          {PERSONNEL.map((p) => (
            <div key={p.initials} className="personnel-item">
              <div className={`personnel-avatar ${p.statusClass}`}>
                <div className="status-ring" />
                {p.initials}
              </div>
              <div className="personnel-info">
                <div className="personnel-name">{p.name}</div>
                <div className="personnel-status">
                  <div className={`pstatus-dot ${p.dotClass}`} />
                  {p.statusText}
                </div>
              </div>
              <div
                className="personnel-iot"
                style={p.iot === "SMS" ? { color: "var(--text-muted)" } : {}}
              >
                {p.iot}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Log incident toolbar */}
      <div className="sidebar-log-toolbar">
        {pickingMode ? (
          <div className="slt-picking-state">
            <div className="slt-picking-dot" />
            <span>Picking location on map…</span>
          </div>
        ) : (
          <button className="slt-log-btn" onClick={onStartPicking}>
            <img src="src/assets/svg_icons/action_fire.svg" alt="" />
            Log New Incident
          </button>
        )}
        <button
          className="slt-req-btn"
          onClick={onOpenLocationRequest}
          disabled={pickingMode}
        >
          <img src="src/assets/svg_icons/action_blue.svg" alt="" />
          Request Location
          {reporterCount > 0 && (
            <span className="slt-reporter-badge">{reporterCount}</span>
          )}
        </button>
      </div>
    </div>
  );
}
