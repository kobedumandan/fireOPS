import "./DetailsLayout.css";

function BackIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="dl-back-icon"
      fill="currentColor"
    >
      <path d="M400-80 0-480l400-400 71 71-329 329 329 329-71 71Z" />
    </svg>
  );
}

/**
 * Generic full-page details layout.
 *
 * Owns only chrome — header, back affordance, scrolling body, optional aside.
 * The caller supplies every piece of content, so any page (personnel, teams,
 * stations…) can reuse this shell for its own record view.
 *
 * Props:
 *   eyebrow   – small mono line above the title (e.g. "FIRE-001 · CLOSED")
 *   title     – main heading
 *   chips     – node rendered under the title (badges, pills)
 *   actions   – node rendered on the header's right (buttons)
 *   onBack    – when set, renders the back button
 *   backLabel – back button text (default "Back")
 *   aside     – optional node pinned in a right column beside the body
 *   wide      – skip the readable max-width cap so content spans full width
 */
export default function DetailsLayout({
  eyebrow,
  title,
  chips,
  actions,
  onBack,
  backLabel = "Back",
  aside,
  wide = false,
  children,
}) {
  const containerCls = `dl-container${wide ? " wide" : ""}`;

  return (
    <div className="dl-page">
      <div className="dl-header">
        <div className={containerCls}>
          {onBack && (
            <button className="dl-back" onClick={onBack}>
              <BackIcon />
              {backLabel}
            </button>
          )}
          {(eyebrow || title || chips || actions) && (
            <div className="dl-header-main">
              <div className="dl-heading">
                {eyebrow && <div className="dl-eyebrow">{eyebrow}</div>}
                {title && <div className="dl-title">{title}</div>}
                {chips && <div className="dl-chips">{chips}</div>}
              </div>
              {actions && <div className="dl-actions">{actions}</div>}
            </div>
          )}
        </div>
      </div>

      <div className="dl-body">
        <div className={containerCls}>
          <div className={`dl-layout${aside ? " has-aside" : ""}`}>
            <div className="dl-content">{children}</div>
            {aside && <div className="dl-aside">{aside}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A titled block within the details body — label sits above the card. */
export function DetailsSection({ title, actions, children }) {
  return (
    <section className="dl-section">
      {(title || actions) && (
        <div className="dl-section-head">
          {title && <div className="dl-section-title">{title}</div>}
          {actions && <div className="dl-section-actions">{actions}</div>}
        </div>
      )}
      <div className="dl-section-card">{children}</div>
    </section>
  );
}

/** Responsive label/value grid. `min` tunes the column width floor. */
export function DetailsGrid({ children, min = 180 }) {
  return (
    <div
      className="dl-grid"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` }}
    >
      {children}
    </div>
  );
}

/** One label/value pair. Pass `children` instead of `value` for custom nodes. */
export function DetailsField({ label, value, highlight, children }) {
  return (
    <div className="dl-field">
      <div className="dl-label">{label}</div>
      {children ?? (
        <div className={`dl-value${highlight ? " highlight" : ""}`}>{value}</div>
      )}
    </div>
  );
}

/** Long-form text block (narratives, remarks) — preserves line breaks. */
export function DetailsProse({ children, tone }) {
  return (
    <div className={`dl-prose${tone ? ` ${tone}` : ""}`}>{children}</div>
  );
}
