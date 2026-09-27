// Transient alerts, bottom-right.
//
// Rendered from App.jsx at top level rather than from inside TopBar: .topbar
// sets position: relative + z-index: var(--z-topbar), which opens a stacking
// context that would trap any descendant below the map's own layers no matter
// how large a z-index it asked for.
import { kindMeta, CloseIcon } from "./notificationUi";
import { TOAST_MS } from "../hooks/useNotifications";
import "../styles/Notifications.css";

export default function ToastStack({
  toasts,
  onDismiss,
  onOpenPanel,
  onOpenIncident,
  activeFireIds,
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack">
      {toasts.map((n) => {
        const { Icon, accent, label } = kindMeta(n.kind);
        const critical = n.severity === "critical";
        const openable = Boolean(
          onOpenIncident && n.fireId != null && activeFireIds?.has(n.fireId),
        );
        return (
          <div
            key={n.id}
            className={`toast${critical ? " critical" : ""}`}
            style={{
              "--n-accent": `var(--accent-${accent}-rgb)`,
              "--toast-ms": `${TOAST_MS}ms`,
            }}
            /* Critical alerts interrupt a screen reader; the rest wait for a
               pause. Matches how adm-banner announces itself. */
            role={critical ? "alert" : "status"}
            aria-live={critical ? "assertive" : "polite"}
          >
            <div className="toast-icon">
              <Icon className="toast-icon-svg" />
            </div>
            <div className="toast-body">
              <div className="toast-meta">
                <span className="toast-kind">{label}</span>
                {critical && <span className="toast-crit">Critical</span>}
                <span className="toast-time">Just now</span>
              </div>
              <div className="toast-title">{n.title}</div>
              {n.body && <div className="toast-sub">{n.body}</div>}
              <div className="toast-actions">
                {openable && (
                  <button
                    type="button"
                    className="toast-btn toast-btn-primary"
                    onClick={() => {
                      onDismiss(n.id);
                      onOpenIncident(n.fireId);
                    }}
                  >
                    View on map
                  </button>
                )}
                <button type="button" className="toast-btn" onClick={onOpenPanel}>
                  All alerts
                </button>
              </div>
            </div>
            <button
              type="button"
              className="toast-close"
              onClick={() => onDismiss(n.id)}
              aria-label="Dismiss alert"
            >
              <CloseIcon className="toast-close-svg" />
            </button>
            {/* Critical toasts stay until dismissed, so only the rest get a
                countdown. */}
            {!critical && <div className="toast-timer" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}
