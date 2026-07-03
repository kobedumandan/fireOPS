import { useState, useEffect } from "react";
import { fetchTeams, createDispatch } from "../api";
import { getCurrentShift } from "../utils/shift";
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

export default function DispatchModal({ incident, onClose, onDispatched }) {
  const [teams, setTeams] = useState([]);
  const [selected, setSelected] = useState(null); // full team object
  const [step, setStep] = useState(1); // 1 = pick team, 2 = review
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTeams()
      .then(setTeams)
      .catch(() => {});
  }, []);

  function handleSelectTeam(team) {
    setSelected(team);
    setStep(2);
  }

  async function handleDispatch() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const result = await createDispatch({
        fire_id: incident.fire_id,
        team_id: selected.team_id,
      });
      onDispatched({
        team: selected,
        dispatchId: result.dispatch_id,
        routes: result.routes ?? [],
      });
    } catch (ex) {
      setError(ex.message);
      setSaving(false);
    }
  }

  // Only teams on the currently active A/B shift are dispatchable.
  const currentShiftName = `Shift ${getCurrentShift().letter}`;
  const availableTeams = teams.filter(
    (t) => t.team_status === "standby" && t.shift_name === currentShiftName
  );

  return (
    <div
      className="apm-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="apm-panel" style={{ width: 480 }}>
        <div className="apm-header">
          <div>
            <div className="apm-eyebrow">DISPATCH</div>
            <div className="apm-title">
              {step === 1 ? "Select Response Team" : "Confirm Dispatch"}
            </div>
          </div>
          <button className="apm-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="apm-scroll">
          <div className="apm-body">
            {/* Incident summary strip */}
            <div className="dpm-incident-strip">
              <div className="dpm-strip-wrap">
                <div className="dpm-strip-id">{incident.id}</div>
                <div className="dpm-strip-loc">{incident.loc}</div>
              </div>
              <div
                className={`dpm-strip-sev dpm-sev-${(
                  incident.sev || ""
                ).toLowerCase()}`}
              >
                {incident.sev}
              </div>
            </div>

            {step === 1 && (
              <>
                <div className="apm-section-label">Available Teams</div>
                {availableTeams.length === 0 && (
                  <div className="dpm-empty">No standby teams available</div>
                )}
                <div className="dpm-team-list">
                  {availableTeams.map((team) => {
                    const leader = (team.members || []).find(
                      (m) => m.member_role === "Team Leader"
                    );
                    return (
                      <button
                        key={team.team_id}
                        className="dpm-team-card"
                        onClick={() => handleSelectTeam(team)}
                      >
                        <div className="dpm-team-icon">
                          <div className="trk-av">
                            <FireTruckIcon />
                          </div>
                        </div>
                        <div className="dpm-team-info">
                          <div className="dpm-team-name">
                            {team.team_name}
                            {team.team_code ? (
                              <span className="dpm-team-code">
                                {" "}
                                {team.team_code}
                              </span>
                            ) : null}
                          </div>
                          <div className="dpm-team-station">
                            {leader ? (
                              <span className="dpm-team-leader">
                                {leader.name}
                              </span>
                            ) : team.station_name !== "—" ? (
                              team.station_name
                            ) : (
                              "No station assigned"
                            )}
                            {!leader && team.station_latitude ? " · GPS ✓" : ""}
                          </div>
                          {leader && (
                            <div className="dpm-team-station">
                              {team.station_name !== "—"
                                ? team.station_name
                                : "No station assigned"}
                              {team.station_latitude ? " · GPS ✓" : ""}
                            </div>
                          )}
                        </div>
                        <div className="dpm-team-count">
                          {team.member_count} members
                        </div>
                        <div className="dpm-team-arrow">›</div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {step === 2 && selected && (
              <>
                <div className="apm-section-label">Selected Team</div>
                <div className="dpm-review-card">
                  <div className="dpm-review-icon">
                    <div className="trk-av">
                      <FireTruckIcon />
                    </div>
                  </div>
                  <div className="dpm-review-info">
                    <div className="dpm-review-name">
                      {selected.team_name}
                      {selected.team_code ? (
                        <span className="dpm-team-code">
                          {selected.team_code}
                        </span>
                      ) : null}
                    </div>
                    <div className="dpm-review-station">
                      {selected.station_name !== "—"
                        ? selected.station_name
                        : "No station assigned"}
                    </div>
                  </div>
                </div>

                <div className="apm-section-label">
                  Personnel ({selected.members?.length || 0})
                </div>
                <div className="dpm-members-list">
                  {(!selected.members || selected.members.length === 0) && (
                    <div className="dpm-empty">
                      No personnel assigned to this team
                    </div>
                  )}
                  {[...(selected.members || [])]
                    .sort((a, b) =>
                      a.member_role === "Team Leader"
                        ? -1
                        : b.member_role === "Team Leader"
                        ? 1
                        : 0
                    )
                    .map((p) => {
                      const isLeader = p.member_role === "Team Leader";
                      return (
                        <div
                          key={p.per_id}
                          className={`dpm-member-row${
                            isLeader ? " dpm-member-leader" : ""
                          }`}
                        >
                          <div className="dpm-member-av">{p.initials}</div>
                          <div className="dpm-member-info">
                            <div className="dpm-member-name">
                              {isLeader && (
                                <span className="dpm-leader-star">★</span>
                              )}
                              {p.name}
                            </div>
                            <div className="dpm-member-rank">
                              {p.rank}
                              {p.member_role ? (
                                <span
                                  className={`dpm-member-role${
                                    isLeader ? " dpm-role-leader" : ""
                                  }`}
                                >
                                  {p.member_role}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {selected.station_latitude && selected.station_longitude ? (
                  <div className="dpm-route-note">
                    Route will be drawn from{" "}
                    <strong>{selected.station_name}</strong> to the incident
                    site.
                  </div>
                ) : (
                  <div className="dpm-route-warn">
                    No GPS coordinates for this team's station — route will not
                    be drawn on the map.
                  </div>
                )}

                {error && <div className="apm-error">{error}</div>}
              </>
            )}
          </div>
        </div>

        <div className="apm-actions">
          {step === 1 ? (
            <button className="apm-btn-cancel" onClick={onClose}>
              Cancel
            </button>
          ) : (
            <>
              <button
                className="apm-btn-cancel"
                onClick={() => {
                  setStep(1);
                  setError(null);
                }}
                disabled={saving}
              >
                Back
              </button>
              <button
                className="apm-btn-submit dpm-btn-dispatch"
                onClick={handleDispatch}
                disabled={saving}
              >
                {saving ? <span className="apm-spinner" /> : "Dispatch Team"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
