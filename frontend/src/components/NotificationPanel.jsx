// The alert history behind the rail's bell. A toast is gone in seconds; this
// is what a dispatcher who looked away comes back to.
import { useEffect, useRef } from "react";
import { kindMeta, CloseIcon } from "./notificationUi";
import { formatLoginStamp } from "../utils/session";
import "../styles/Notifications.css";

export default function NotificationPanel({ items, onClose, onDismiss, onClear }) {
  const panelRef = useRef(null);

  // Close on Escape or on a click outside — the same dismissal grammar the
  // modals already use, minus the scrim, since this is a popover and the map
  // behind it stays live.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    function onDown(e) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        !e.target.closest(".topbar-alerts-btn")
      ) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  return (
    <div className="notif-panel" ref={panelRef} role="dialog" aria-label="Alerts">
      <div className="notif-panel-head">
        <div className="notif-panel-title">Alerts</div>
        <div className="notif-panel-head-actions">
          {items.length > 0 && (
            <button type="button" className="notif-clear" onClick={onClear}>
              Clear all
            </button>
          )}
          <button
            type="button"
            className="notif-panel-close"
            onClick={onClose}
            aria-label="Close alerts"
          >
            <CloseIcon className="notif-close-svg" />
          </button>
        </div>
      </div>

      <div className="notif-list">
        {items.length === 0 ? (
          <div className="notif-empty">No alerts yet.</div>
        ) : (
          items.map((n) => {
            const { Icon, accent, label } = kindMeta(n.kind);
            return (
              <div
                key={n.id}
                className={`notif-item${n.read ? "" : " unread"}`}
                style={{ "--n-accent": `var(--accent-${accent}-rgb)` }}
              >
                <div className="notif-item-icon">
                  <Icon className="notif-item-svg" />
                </div>
                <div className="notif-item-body">
                  <div className="notif-item-kind">{label}</div>
                  <div className="notif-item-title">{n.title}</div>
                  {n.body && <div className="notif-item-sub">{n.body}</div>}
                  <div className="notif-item-time">{formatLoginStamp(n.at)}</div>
                </div>
                <button
                  type="button"
                  className="notif-item-close"
                  onClick={() => onDismiss(n.id)}
                  aria-label="Remove alert"
                >
                  <CloseIcon className="notif-close-svg" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
