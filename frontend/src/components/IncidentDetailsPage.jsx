import { useState, useEffect } from "react";
import DetailsLayout, {
  DetailsSection,
  DetailsGrid,
  DetailsField,
  DetailsProse,
} from "../layout/DetailsLayout";
import {
  SeverityBadge,
  StatusPill,
  EditIcon,
  RemoveIcon,
  formatReported,
} from "./incidentUi";
import { fetchIncidentReport } from "../api";

/**
 * Full-page view of a single incident, built on the shared DetailsLayout.
 *
 * @param incident    the incident row to display
 * @param onBack      return to the list
 * @param onEdit      open the edit modal for this incident
 * @param onDelete    open the delete confirmation for this incident
 */
export default function IncidentDetailsPage({
  incident,
  onBack,
  onEdit,
  onDelete,
}) {
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);

  // Load the after-action report (narrative + photos) for a closed incident.
  // Other statuses don't have a report, so we skip the fetch.
  useEffect(() => {
    if (!incident || incident.status !== "closed") {
      setReport(null);
      setReportError(null);
      setReportLoading(false);
      return;
    }
    let cancelled = false;
    setReportLoading(true);
    setReportError(null);
    setReport(null);
    fetchIncidentReport(incident.fire_id)
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
  }, [incident?.fire_id, incident?.status]);

  if (!incident) return null;

  const fields = [
    { label: "Address", value: incident.addr || "—" },
    { label: "Structure", value: incident.structure || "—" },
    { label: "Reported via", value: incident.reporter || "—" },
    {
      label: "Casualties",
      value: incident.casualties || "—",
      highlight:
        incident.casualties !== "None" &&
        incident.casualties !== "—" &&
        !!incident.casualties,
    },
    {
      label: "Units assigned",
      value: `${incident.units} unit${incident.units !== 1 ? "s" : ""}`,
    },
    {
      label: "Coordinates",
      value: `${incident.latitude?.toFixed(5)}, ${incident.longitude?.toFixed(
        5
      )}`,
    },
    { label: "Reported at", value: formatReported(incident.reported_at) },
    { label: "Alarm level", value: incident.alarm || "—" },
  ];

  const actions = (
    <>
      {incident.status !== "contained" && incident.status !== "closed" && (
        <button className="inc-btn-dispatch-sm">Dispatch Unit</button>
      )}
      {incident.status !== "closed" && (
        <button className="inc-btn-sec-sm">View on Map</button>
      )}
      <button
        className="inc-btn-sec-sm action_btn"
        onClick={() => onEdit?.(incident)}
      >
        <EditIcon />
      </button>
      <button
        className="inc-btn-sec-sm action_btn"
        onClick={() => onDelete?.(incident)}
      >
        <RemoveIcon />
      </button>
    </>
  );

  return (
    <DetailsLayout
      onBack={onBack}
      backLabel="Incidents"
      eyebrow={`${incident.id} · ${incident.status.toUpperCase()}`}
      title={incident.loc}
      chips={
        <>
          <SeverityBadge sev={incident.sev} />
          <StatusPill status={incident.status} />
        </>
      }
      actions={actions}
    >
      <DetailsSection title="Incident Details">
        <DetailsGrid>
          {fields.map(({ label, value, highlight }) => (
            <DetailsField
              key={label}
              label={label}
              value={value}
              highlight={highlight}
            />
          ))}
        </DetailsGrid>
      </DetailsSection>

      {incident.status === "closed" && (
        <DetailsSection title="Incident Report">
          {reportLoading ? (
            <DetailsProse tone="muted">Loading report…</DetailsProse>
          ) : reportError ? (
            <DetailsProse tone="danger">
              Failed to load report: {reportError}
            </DetailsProse>
          ) : !report ? (
            <DetailsProse tone="muted">
              No report filed for this incident.
            </DetailsProse>
          ) : (
            <>
              {(report.author || report.submitted_at) && (
                <div className="dl-meta-row">
                  {report.author && (
                    <span>
                      Filed by{" "}
                      {report.author_rank ? `${report.author_rank} ` : ""}
                      {report.author}
                    </span>
                  )}
                  {report.submitted_at && (
                    <span>{formatReported(report.submitted_at)}</span>
                  )}
                </div>
              )}

              <DetailsGrid>
                {[
                  { label: "Cause", value: report.cause || "—" },
                  { label: "Casualties", value: report.casualties || "—" },
                  {
                    label: "Damage estimate",
                    value: report.damage_estimate || "—",
                  },
                ].map(({ label, value }) => (
                  <DetailsField key={label} label={label} value={value} />
                ))}
              </DetailsGrid>

              <DetailsField label="Narrative">
                <DetailsProse>{report.narrative}</DetailsProse>
              </DetailsField>

              {report.recommendations && (
                <DetailsField label="Recommendations">
                  <DetailsProse>{report.recommendations}</DetailsProse>
                </DetailsField>
              )}

              {report.photos?.length > 0 && (
                <DetailsField label={`Scene photos (${report.photos.length})`}>
                  <div className="dl-photo-grid">
                    {report.photos.map((url, i) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="dl-photo"
                      >
                        <img
                          src={url}
                          alt={`Scene photo ${i + 1}`}
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                </DetailsField>
              )}
            </>
          )}
        </DetailsSection>
      )}
    </DetailsLayout>
  );
}
