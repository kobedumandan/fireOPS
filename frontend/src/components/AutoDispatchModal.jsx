import AppModal from "./AppModal";
import "../styles/AppModal.css";

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

// Human-friendly copy for each backend `reason` code returned when no team
// could be auto-dispatched (see auto_dispatch.select_best_team).
const REASON_COPY = {
  incident_missing_coordinates:
    "The incident has no map coordinates, so a route could not be computed.",
  no_teams_configured: "No response teams are configured in the system.",
  all_teams_active: "Every team is currently active on another incident.",
  no_team_on_shift: "No team is assigned to the currently active shift.",
  no_available_truck:
    "No station with an eligible team has an available truck.",
  no_team_on_standby:
    "No eligible team is fully on standby (all members available).",
};

const STAGE_LABELS = {
  total: "Teams configured",
  not_active: "Not already active",
  on_shift: "On current shift",
  has_truck: "Station has a truck",
  members_standby: "All members on standby",
};

function formatEta(minutes) {
  if (minutes == null) return "—";
  if (minutes < 1) return "< 1 min";
  return `${Math.round(minutes)} min`;
}

/**
 * Shows the outcome of an auto-dispatch attempt after an incident is logged.
 *
 * Props:
 *   incident – the incident dict returned by createIncident (has id/loc/sev
 *              plus the nested `auto_dispatch` payload)
 *   onClose  – dismiss the modal
 *   onViewDispatch – optional; called with the dispatch_id to jump to the
 *              dispatch on the map/sidebar (only shown on success)
 */
export default function AutoDispatchModal({ incident, onClose, onViewDispatch }) {
  const ad = incident?.auto_dispatch || {};
  const dispatched = ad.status === "dispatched";
  const candidates = ad.breakdown?.candidates || [];
  const winner = candidates[0] || null;

  return (
    <AppModal
      eyebrow="AUTO-DISPATCH"
      title={dispatched ? "Team Dispatched" : "No Team Available"}
      width={460}
      onClose={onClose}
    >
      <div className="apm-scroll">
        <div className="apm-body">
          {/* Incident summary strip */}
          <div className="dpm-incident-strip">
            <div className="dpm-strip-wrap">
              <div className="dpm-strip-id">{incident?.id}</div>
              <div className="dpm-strip-loc">{incident?.loc}</div>
            </div>
            <div
              className={`dpm-strip-sev dpm-sev-${(
                incident?.sev || ""
              ).toLowerCase()}`}
            >
              {incident?.sev}
            </div>
          </div>

          {dispatched ? (
            <>
              <div className="adm-banner adm-banner-ok" role="status">
                {/* <span className="adm-banner-dot" /> */}
                Nearest available team was dispatched automatically.
              </div>

              <div className="apm-section-label">Assigned Team</div>
              <div className="dpm-review-card">
                <div className="dpm-review-icon">
                  <div className="trk-av">
                    <FireTruckIcon />
                  </div>
                </div>
                <div className="dpm-review-info">
                  <div className="dpm-review-name">
                    {winner?.team_name || `Team #${ad.team_id}`}
                  </div>
                  <div className="dpm-review-station">
                    Station #{ad.station_id}
                  </div>
                </div>
                <div className="adm-eta">
                  <div className="adm-eta-val">{formatEta(ad.eta_minutes)}</div>
                  <div className="adm-eta-lbl">ETA</div>
                </div>
              </div>

              {candidates.length > 1 && (
                <>
                  <div className="apm-section-label">
                    Considered ({candidates.length})
                  </div>
                  <div className="adm-cand-list">
                    {candidates.map((c, i) => (
                      <div
                        key={c.team_id}
                        className={`adm-cand-row${
                          i === 0 ? " adm-cand-winner" : ""
                        }`}
                      >
                        <div className="adm-cand-rank">{i + 1}</div>
                        <div className="adm-cand-info">
                          <div className="adm-cand-name">{c.team_name}</div>
                          <div className="adm-cand-meta">
                            {(c.haversine_m / 1000).toFixed(1)} km
                            {c.eta_source === "haversine_fallback" && (
                              <span className="adm-cand-flag">
                                {" "}
                                · est. (routing offline)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="adm-cand-eta">
                          {formatEta(c.eta_seconds / 60)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="adm-banner adm-banner-warn" role="alert">
                <span className="adm-banner-dot" />
                The incident was logged, but no team could be auto-dispatched.
              </div>

              <div className="adm-reason">
                {REASON_COPY[ad.reason] ||
                  `Auto-dispatch was not possible (${ad.reason || "unknown"}).`}
              </div>

              {ad.breakdown?.stage_counts && (
                <>
                  <div className="apm-section-label">Eligibility Funnel</div>
                  <div className="adm-funnel">
                    {Object.entries(STAGE_LABELS).map(([key, label]) => (
                      <div className="adm-funnel-row" key={key}>
                        <span className="adm-funnel-lbl">{label}</span>
                        <span className="adm-funnel-val">
                          {ad.breakdown.stage_counts[key] ?? 0}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="adm-hint">
                You can dispatch a team manually from the incident view.
              </div>
            </>
          )}
        </div>
      </div>

      <div className="apm-actions">
        {dispatched && onViewDispatch ? (
          <>
            <button className="apm-btn-cancel" onClick={onClose}>
              Close
            </button>
            <button
              className="apm-btn-submit"
              onClick={() => onViewDispatch(ad.dispatch_id)}
            >
              View on Map
            </button>
          </>
        ) : (
          <button className="apm-btn-submit" onClick={onClose}>
            Got it
          </button>
        )}
      </div>
    </AppModal>
  );
}
