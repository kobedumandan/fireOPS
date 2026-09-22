// Transient alerts, bottom-right.
//
// Rendered from App.jsx at top level rather than from inside TopBar: .topbar
// sets position: relative + z-index: var(--z-topbar), which opens a stacking
// context that would trap any descendant below the map's own layers no matter
// how large a z-index it asked for.
import { kindMeta, CloseIcon } from "./notificationUi";
import { formatLoginStamp } from "../utils/session";
import "../styles/Notifications.css";

export default function ToastStack({ toasts, onDismiss, onOpenPanel }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack">
      {toasts.map((n) => {
        const { Icon, accent, label } = kindMeta(n.kind);
        const critical = n.severity === "critical";
        return (
          <div
            key={n.id}
            className={`toast${critical ? " critical" : ""}`}
            style={{ "--n-accent": `var(--accent-${accent}-rgb)` }}
            /* Critical alerts interrupt a screen reader; the rest wait for a
               pause. Matches how adm-banner announces itself. */
            role={critical ? "alert" : "status"}
            aria-live={critical ? "assertive" : "polite"}
          >
            <div className="toast-icon">
              <Icon className="toast-icon-svg" />
            </div>
            <div className="toast-body">
              <div className="toast-kind">{label}</div>
              <div className="toast-title">{n.title}</div>
              {n.body && <div className="toast-sub">{n.body}</div>}
              <div className="toast-time">{formatLoginStamp(n.at)}</div>
            </div>
            <div className="toast-actions">
              <button
                type="button"
                className="toast-close"
                onClick={() => onDismiss(n.id)}
                aria-label="Dismiss alert"
              >
                <CloseIcon className="toast-close-svg" />
              </button>
              <button type="button" className="toast-link" onClick={onOpenPanel}>
                View all
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
