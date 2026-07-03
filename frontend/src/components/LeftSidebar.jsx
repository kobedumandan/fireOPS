import "../styles/LeftSidebar.css";

function TimeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="meta-icon"
      fill="currentColor"
    >
      <path d="m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z" />
    </svg>
  );
}

function DistanceIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="meta-icon"
      fill="currentColor"
    >
      <path d="M307-113.5Q240-147 240-200q0-24 14.5-44.5T295-280l63 59q-9 4-19.5 9T322-200q13 16 60 28t98 12q51 0 98.5-12t60.5-28q-7-8-18-13t-21-9l62-60q28 16 43 36.5t15 45.5q0 53-67 86.5T480-80q-106 0-173-33.5ZM481-300q99-73 149-146.5T680-594q0-102-65-154t-135-52q-70 0-135 52t-65 154q0 67 49 139.5T481-300Zm-1 100Q339-304 269.5-402T200-594q0-71 25.5-124.5T291-808q40-36 90-54t99-18q49 0 99 18t90 54q40 36 65.5 89.5T760-594q0 94-69.5 192T480-200Zm0-320q33 0 56.5-23.5T560-600q0-33-23.5-56.5T480-680q-33 0-56.5 23.5T400-600q0 33 23.5 56.5T480-520Zm0-80Z" />
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

function PersonnelGeneralIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className={className}
      fill="currentColor"
    >
      <path d="M234-276q51-39 114-61.5T480-360q69 0 132 22.5T726-276q35-41 54.5-93T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 59 19.5 111t54.5 93Zm146.5-204.5Q340-521 340-580t40.5-99.5Q421-720 480-720t99.5 40.5Q620-639 620-580t-40.5 99.5Q539-440 480-440t-99.5-40.5ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm100-95.5q47-15.5 86-44.5-39-29-86-44.5T480-280q-53 0-100 15.5T294-220q39 29 86 44.5T480-160q53 0 100-15.5ZM523-537q17-17 17-43t-17-43q-17-17-43-17t-43 17q-17 17-17 43t17 43q17 17 43 17t43-17Zm-43-43Zm0 360Z" />
    </svg>
  );
}

function LogIncIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="btn-icon"
      fill="currentColor"
    >
      <path d="M480-80Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880h20q10 0 20 2v81q-10-2-19.5-2.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186q122-112 181-203.5T720-552v-8h80v8q0 100-79.5 217.5T480-80Zm56.5-423.5Q560-527 560-560t-23.5-56.5Q513-640 480-640t-56.5 23.5Q400-593 400-560t23.5 56.5Q447-480 480-480t56.5-23.5ZM480-560Zm240-80h80v-120h120v-80H800v-120h-80v120H600v80h120v120Z" />
    </svg>
  );
}
function ReporrtIncIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="btn-icon"
      fill="currentColor"
    >
      <path d="M440-42v-80q-125-14-214.5-103.5T122-440H42v-80h80q14-125 103.5-214.5T440-838v-80h80v80q125 14 214.5 103.5T838-520h80v80h-80q-14 125-103.5 214.5T520-122v80h-80Zm238-240q82-82 82-198t-82-198q-82-82-198-82t-198 82q-82 82-82 198t82 198q82 82 198 82t198-82Zm-311-85q-47-47-47-113t47-113q47-47 113-47t113 47q47 47 47 113t-47 113q-47 47-113 47t-113-47Zm169.5-56.5Q560-447 560-480t-23.5-56.5Q513-560 480-560t-56.5 23.5Q400-513 400-480t23.5 56.5Q447-400 480-400t56.5-23.5ZM480-480Z" />
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

function SkeletonIncidentCard() {
  return (
    <div className="incident-card-wrap">
      <div
        className="incident-card skeleton-card"
        style={{ cursor: "default" }}
      >
        <div className="incident-top">
          <div
            className="skel"
            style={{ width: 60, height: 12, borderRadius: 3 }}
          />
          <div
            className="skel"
            style={{ width: 50, height: 14, borderRadius: 3 }}
          />
        </div>
        <div
          className="skel"
          style={{ width: "78%", height: 13, borderRadius: 3, marginBottom: 6 }}
        />
        <div className="incident-meta">
          <div
            className="skel"
            style={{ width: 42, height: 10, borderRadius: 3 }}
          />
          <div
            className="skel"
            style={{ width: 42, height: 10, borderRadius: 3 }}
          />
          <div
            className="skel"
            style={{ width: 36, height: 10, borderRadius: 3 }}
          />
        </div>
      </div>
    </div>
  );
}

function SkeletonPersonnelItem() {
  return (
    <div className="personnel-item-wrap">
      <div className="personnel-item" style={{ cursor: "default" }}>
        <div
          className="skel"
          style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }}
        />
        <div className="personnel-info">
          <div
            className="skel"
            style={{
              width: "58%",
              height: 13,
              borderRadius: 3,
              marginBottom: 4,
            }}
          />
          <div
            className="skel"
            style={{
              width: "42%",
              height: 18,
              borderRadius: 10,
              marginBottom: 4,
            }}
          />
          <div
            className="skel"
            style={{ width: "35%", height: 9, borderRadius: 3 }}
          />
        </div>
        <div
          className="skel"
          style={{ width: 28, height: 10, borderRadius: 3 }}
        />
      </div>
    </div>
  );
}

function fmtTime(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function sevToKey(sev) {
  const s = (sev || "").toLowerCase();
  if (s === "critical") return "critical";
  if (s === "moderate") return "moderate";
  return "contained";
}

function statusToCss(status) {
  if (status === "dispatched") return "pa-dispatched";
  if (status === "onscene") return "pa-onscene";
  if (status === "offduty") return "pa-offduty";
  return "pa-standby";
}

function statusToDot(status) {
  if (status === "dispatched") return "ps-dispatched";
  if (status === "onscene") return "ps-onscene";
  if (status === "offduty") return "ps-offduty";
  return "ps-standby";
}

function statusText(p) {
  if (p.status === "dispatched") return "Dispatched";
  if (p.status === "onscene") return "On Scene";
  if (p.status === "offduty") return "Off Duty";
  return "Standby";
}

function iotLabel(iot) {
  if (iot === "active") return "IoT ✓";
  if (iot === "sms") return "SMS";
  return "Offline";
}

export default function LeftSidebar({
  selectedId,
  onSelectIncident,
  activeIncidents = [],
  newIncidents = [],
  personnel = [],
  loadingIncidents = false,
  loadingPersonnel = false,
  onStartPicking,
  pickingMode = false,
  onOpenLocationRequest,
  reporterCount = 0,
  collapsed = false,
  onToggleCollapse,
  dispatches = [],
  dispatchRoutes = [],
}) {
  const dbIncidents = activeIncidents.map((inc) => {
    const incDispatches = dispatches.filter((d) => d.fire_id === inc.fire_id);
    const selectedRoutes = dispatchRoutes.filter(
      (r) => r.fire_id === inc.fire_id && r.isSelected && r.distanceKm != null
    );
    const minDist =
      selectedRoutes.length > 0
        ? Math.min(...selectedRoutes.map((r) => r.distanceKm))
        : null;
    return {
      id: inc.id,
      severity: sevToKey(inc.sev),
      badge: inc.sev || "Minor",
      location: inc.loc || "Unknown Location",
      time: fmtTime(inc.reported_at),
      distance: minDist != null ? `${minDist.toFixed(1)} km` : "— km",
      units: incDispatches.length,
    };
  });

  const allIncidents = [
    ...dbIncidents,
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
  const activePersonnelCount = personnel.filter(
    (p) => p.status !== "standby" && p.status !== "offduty"
  ).length;

  if (collapsed) {
    return (
      <div className="sidebar-left collapsed">
        <div className="slc-expand-btn-wrap">
          <button
            className="slc-icon-btn"
            onClick={onToggleCollapse}
            title="Expand sidebar"
          >
            ›
          </button>
        </div>

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
        </div>

        <div className="sidebar-section-last">
          <div className="slc-expand-btn-wrap">
            <button
              className="slc-section-btn"
              onClick={onToggleCollapse}
              title={`${personnel.length} Field Personnel`}
            >
              <img src="src/assets/svg_icons/account_icon.svg" alt="" />
              <span className="slc-badge slc-badge--blue">
                {activePersonnelCount}
              </span>
            </button>
          </div>
          <div className="incident-list">
            {personnel.map((p) => (
              <div
                key={p.per_id}
                className="slc-avatar-wrap"
                title={`${p.name} · ${statusText(p)}`}
              >
                <div className={`personnel-avatar ${statusToCss(p.status)}`}>
                  <div className="status-ring" />
                  {p.initials}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="slc-action-btn-wrap">
          <button
            className="slc-action-btn fire"
            onClick={onStartPicking}
            title="Log New Incident"
            disabled={pickingMode}
          >
            {pickingMode ? (
              <span className="slt-picking-dot" />
            ) : (
              <img src="src/assets/svg_icons/action_fire.svg" alt="" />
            )}
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
          {loadingIncidents ? (
            [1, 2, 3].map((n) => <SkeletonIncidentCard key={n} />)
          ) : (
            <>
              {allIncidents.length === 0 && (
                <div className="incident-empty">
                  <FireGeneralIcon className={"no_active_icon"} />
                  No Active Incidents
                </div>
              )}
              {allIncidents.map((inc) => (
                <div key={inc.id} className="incident-card-wrap">
                  <div
                    className={`incident-card ${inc.severity}${
                      selectedId === inc.id ? " selected" : ""
                    }`}
                    onClick={() => onSelectIncident(inc.id)}
                  >
                    <div className="incident-top">
                      <span className="incident-id">{inc.id}</span>
                      <span className={`incident-badge badge-${inc.severity}`}>
                        <FireGeneralIcon className={"sev-icon"} />
                        {inc.badge}
                      </span>
                    </div>
                    <div className="incident-location">{inc.location}</div>
                    <div className="incident-meta">
                      <span>
                        <TimeIcon />
                        {inc.time}
                      </span>
                      <span>
                        <DistanceIcon />
                        {inc.distance}
                      </span>
                      <span>{inc.units} units</span>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="sidebar-section-last">
        <div className="section-header">
          <span className="section-title">Field Personnel</span>
          <span className="section-count">{personnel.length} TOTAL</span>
        </div>
        <div className="incident-list">
          {loadingPersonnel ? (
            [1, 2, 3, 4].map((n) => <SkeletonPersonnelItem key={n} />)
          ) : (
            <>
              {personnel.length === 0 && (
                <div className="incident-empty">
                  <PersonnelGeneralIcon className={"no_active_icon"} />
                  No Active Personnels
                </div>
              )}
              {personnel.map((p) => (
                <div className="personnel-item-wrap">
                  <div key={p.per_id} className="personnel-item">
                    <div
                      className={`personnel-avatar ${statusToCss(p.status)}`}
                    >
                      <div className="status-ring" />
                      {p.initials}
                    </div>
                    <div className="personnel-info">
                      <div className="personnel-name">{p.name}</div>
                      <div className="personnel-status">
                        <div
                          className={`pstatus-dot ${statusToDot(p.status)}`}
                        />
                        <div>{statusText(p)}</div>
                      </div>
                      <div className="personnel-station">{p.station}</div>
                    </div>
                    <div
                      className="personnel-iot"
                      style={
                        p.iot !== "active"
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
                              background: "var(--accent-green-dim)",
                              borderRadius: "8px",
                              padding: "2px 5px",
                              gap: "2px",
                            }
                      }
                    >
                      <BoltIcon
                        style={
                          p.iot !== "active"
                            ? { fill: "var(--text-muted)" }
                            : { fill: "var(--accent-green)" }
                        }
                      />
                      {iotLabel(p.iot)}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="sidebar-log-toolbar">
        {pickingMode ? (
          <div className="slt-picking-state">
            <div className="slt-picking-dot" />
            <span>Picking location on map…</span>
          </div>
        ) : (
          <button className="slt-log-btn" onClick={onStartPicking}>
            <LogIncIcon />
            Log New Incident
          </button>
        )}
        <button
          className="slt-req-btn"
          onClick={onOpenLocationRequest}
          disabled={pickingMode}
        >
          <ReporrtIncIcon/>
          Request Location
          {reporterCount > 0 && (
            <span className="slt-reporter-badge">{reporterCount}</span>
          )}
        </button>
      </div>
    </div>
  );
}
