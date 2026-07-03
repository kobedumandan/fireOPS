import { useState, useEffect, useRef } from "react";
import "../styles/SettingsPage.css";
import AppModal from "./AppModal";

function IcoAccount({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      fill="currentColor"
    >
      <path d="M200-246q54-53 125.5-83.5T480-360q83 0 154.5 30.5T760-246v-514H200v514Zm379-235q41-41 41-99t-41-99q-41-41-99-41t-99 41q-41 41-41 99t41 99q41 41 99 41t99-41ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm69-80h422q-44-39-99.5-59.5T480-280q-56 0-112.5 20.5T269-200Zm168.5-337.5Q420-555 420-580t17.5-42.5Q455-640 480-640t42.5 17.5Q540-605 540-580t-17.5 42.5Q505-520 480-520t-42.5-17.5ZM480-503Z" />
    </svg>
  );
}

function IcoSecurity({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      fill="currentColor"
    >
      <path d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm0-80h480v-400H240v400Zm296.5-143.5Q560-327 560-360t-23.5-56.5Q513-440 480-440t-56.5 23.5Q400-393 400-360t23.5 56.5Q447-280 480-280t56.5-23.5ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80ZM240-160v-400 400Z" />
    </svg>
  );
}

function IcoSession({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      fill="currentColor"
    >
      <path d="M360-840v-80h240v80H360Zm80 440h80v-240h-80v240Zm-99.5 291.5Q275-137 226-186t-77.5-114.5Q120-366 120-440t28.5-139.5Q177-645 226-694t114.5-77.5Q406-800 480-800q62 0 119 20t107 58l56-56 56 56-56 56q38 50 58 107t20 119q0 74-28.5 139.5T734-186q-49 49-114.5 77.5T480-80q-74 0-139.5-28.5ZM678-242q82-82 82-198t-82-198q-82-82-198-82t-198 82q-82 82-82 198t82 198q82 82 198 82t198-82ZM480-440Z" />
    </svg>
  );
}

function IcoAppearance({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      fill="currentColor"
    >
      <path d="M480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 32.5-156t88-127Q256-817 330-848.5T488-880q80 0 151 27.5t124.5 76q53.5 48.5 85 115T880-518q0 115-70 176.5T640-280h-74q-9 0-12.5 5t-3.5 11q0 12 15 34.5t15 51.5q0 50-27.5 74T480-80Zm0-400Zm-177 23q17-17 17-43t-17-43q-17-17-43-17t-43 17q-17 17-17 43t17 43q17 17 43 17t43-17Zm120-160q17-17 17-43t-17-43q-17-17-43-17t-43 17q-17 17-17 43t17 43q17 17 43 17t43-17Zm200 0q17-17 17-43t-17-43q-17-17-43-17t-43 17q-17 17-17 43t17 43q17 17 43 17t43-17Zm120 160q17-17 17-43t-17-43q-17-17-43-17t-43 17q-17 17-17 43t17 43q17 17 43 17t43-17ZM480-160q9 0 14.5-5t5.5-13q0-14-15-33t-15-57q0-42 29-67t71-25h70q66 0 113-38.5T800-518q0-121-92.5-201.5T488-800q-136 0-232 93t-96 227q0 133 93.5 226.5T480-160Z" />
    </svg>
  );
}

function IcoNotifications({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      fill="currentColor"
    >
      <path d="M160-200v-80h80v-280q0-83 50-147.5T420-792v-28q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820v28q80 20 130 84.5T720-560v280h80v80H160Zm320-300Zm0 420q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM320-280h320v-280q0-66-47-113t-113-47q-66 0-113 47t-47 113v280Z" />
    </svg>
  );
}

function IcoMapDisplay({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      fill="currentColor"
    >
      <path d="m600-120-240-84-186 72q-20 8-37-4.5T120-170v-560q0-13 7.5-23t20.5-15l212-72 240 84 186-72q20-8 37 4.5t17 33.5v560q0 13-7.5 23T812-192l-212 72Zm-40-98v-468l-160-56v468l160 56Zm80 0 120-40v-474l-120 46v468Zm-440-10 120-46v-468l-120 40v474Zm440-458v468-468Zm-320-56v468-468Z" />
    </svg>
  );
}

function IcoAbout({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      fill="currentColor"
    >
      <path d="M440-280h80v-240h-80v240Zm68.5-331.5Q520-623 520-640t-11.5-28.5Q497-680 480-680t-28.5 11.5Q440-657 440-640t11.5 28.5Q463-600 480-600t28.5-11.5ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />
    </svg>
  );
}

const SIDEBAR_ITEMS = [
  {
    section: "account",
    label: "Account",
    items: [
      { id: "profile", Icon: IcoAccount, label: "Profile" },
      { id: "security", Icon: IcoSecurity, label: "Security" },
      { id: "session", Icon: IcoSession, label: "Session" },
    ],
  },
  {
    section: "preferences",
    label: "Preferences",
    items: [
      { id: "appearance", Icon: IcoAppearance, label: "Appearance" },
      { id: "notifications", Icon: IcoNotifications, label: "Notifications" },
      { id: "display", Icon: IcoMapDisplay, label: "Map Display" },
    ],
  },
  {
    section: "system",
    label: "System",
    items: [{ id: "about", Icon: IcoAbout, label: "About" }],
  },
];

function Toggle({ id, defaultOn = false }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="toggle-wrap">
      <div
        className={`toggle${on ? " on" : ""}`}
        onClick={() => setOn((v) => !v)}
      >
        <div className="toggle-knob" />
      </div>
      <span className="toggle-label">{on ? "ON" : "OFF"}</span>
    </div>
  );
}

function EditableRow({ label, sub, value: initialValue }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [draft, setDraft] = useState(initialValue);
  const inputRef = useRef();

  function startEdit() {
    setDraft(value);
    setEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }

  function save() {
    setValue(draft || value);
    setEditing(false);
  }

  return (
    <div className="block-row">
      <div className="row-left">
        <div className="row-label">{label}</div>
        <div className="row-sub">{sub}</div>
      </div>
      <div className="row-right">
        {editing ? (
          <>
            <input
              ref={inputRef}
              className="inline-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
            />
            <button className="btn-save" onClick={save}>
              Save
            </button>
          </>
        ) : (
          <>
            <span className="row-value">{value}</span>
            <button className="btn-edit" onClick={startEdit}>
              Edit
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SessionTimer() {
  const startRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
      1000
    );
    return () => clearInterval(id);
  }, []);

  const h = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const s = String(elapsed % 60).padStart(2, "0");
  const expiry = new Date(
    startRef.current + 8 * 3600 * 1000
  ).toLocaleTimeString("en-US", {
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
  });

  return { timer: `${h}:${m}:${s}`, expiry };
}

// ── SECTIONS ─────────────────────────────────────────────────────────────────

function SectionProfile({ user }) {
  const firstName = user?.first_name ?? "";
  const lastName = user?.last_name ?? "";
  const initials = `${firstName[0] ?? "?"}${lastName[0] ?? ""}`.toUpperCase();
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "—";
  const email = user?.email ?? "—";
  const contact = user?.contact ?? "—";
  const role = user?.role ?? "—";
  const designation =
    user?.designation ?? (role === "admin" ? "Administrator" : "—");
  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <>
      <div className="settings-section-title">Profile</div>
      <div className="section-desc">
        Your account information and identity details.
      </div>

      <div className="settings-block">
        <div className="block-header">
          <div className="block-title">Identity</div>
        </div>
        <div className="avatar-block">
          <div className="big-avatar">
            {initials}
            <div className="avatar-online" />
          </div>
          <div className="name-wrapper">
            <div className="avatar-name">{fullName}</div>
            <div className="avatar-email">{email}</div>
            <span className="val-badge vb-fire">{role}</span>
          </div>
        </div>
        <EditableRow
          label="First Name"
          sub="Your given name on record"
          value={firstName || "—"}
        />
        <EditableRow
          label="Last Name"
          sub="Your surname on record"
          value={lastName || "—"}
        />
        <EditableRow
          label="Contact Number"
          sub="Primary contact for dispatch"
          value={contact}
        />
      </div>

      <div className="settings-block">
        <div className="block-header">
          <div className="block-title">Role & Access</div>
        </div>
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">User Role</div>
            <div className="row-sub">Assigned system access level</div>
          </div>
          <div className="row-right">
            <span className="val-badge vb-fire">{role}</span>
          </div>
        </div>
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">Designation</div>
            <div className="row-sub">Position within the command structure</div>
          </div>
          <div className="row-right">
            <span className="row-value">{designation}</span>
          </div>
        </div>
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">Assigned Station</div>
            <div className="row-sub">Primary reporting station</div>
          </div>
          <div className="row-right">
            <span className="row-value">BFP Panabo City Main Station</span>
          </div>
        </div>
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">Account Created</div>
            <div className="row-sub">Date this account was provisioned</div>
          </div>
          <div className="row-right">
            <span className="row-value">{createdAt}</span>
          </div>
        </div>
      </div>
    </>
  );
}

function SectionSecurity({ user }) {
  return (
    <>
      <div className="section-title">Security</div>
      <div className="section-desc">
        Manage your password and login credentials.
      </div>

      <div className="settings-block">
        <div className="block-header">
          <div className="block-title">Credentials</div>
        </div>
        <EditableRow
          label="Email Address"
          sub="Used for system login and alerts"
          value={user?.email ?? "—"}
        />
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">Password</div>
            <div className="row-sub">Last changed 45 days ago</div>
          </div>
          <div className="row-right">
            <span className="row-value">••••••••••••</span>
            <button className="btn-edit">Change</button>
          </div>
        </div>
      </div>

      <div className="settings-block">
        <div className="block-header">
          <div className="block-title">Login History</div>
        </div>
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">Last Login</div>
            <div className="row-sub">Most recent successful authentication</div>
          </div>
          <div className="row-right">
            <span className="row-value highlight">Today, 08:31 AM</span>
          </div>
        </div>
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">Login Device</div>
            <div className="row-sub">Browser and operating system</div>
          </div>
          <div className="row-right">
            <span className="row-value">Chrome · Windows 11</span>
          </div>
        </div>
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">IP Address</div>
            <div className="row-sub">Network address at time of login</div>
          </div>
          <div className="row-right">
            <span className="row-value">192.168.1.45</span>
          </div>
        </div>
      </div>
    </>
  );
}

function SectionSession({ onLogout }) {
  const { timer, expiry } = SessionTimer();

  return (
    <>
      <div className="section-title">Session</div>
      <div className="section-desc">
        Current login session details and activity.
      </div>

      <div className="settings-block">
        <div className="block-header">
          <div className="block-title">Active Session</div>
        </div>
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">Session Status</div>
            <div className="row-sub">Current authentication state</div>
          </div>
          <div className="row-right">
            <span className="val-badge vb-green">Active</span>
          </div>
        </div>
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">Session Duration</div>
            <div className="row-sub">Time elapsed since login</div>
          </div>
          <div className="row-right">
            <div className="session-timer">
              <div className="timer-dot" />
              <span>{timer}</span>
            </div>
          </div>
        </div>
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">Session Expires</div>
            <div className="row-sub">
              Auto-logout after 8 hours of inactivity
            </div>
          </div>
          <div className="row-right">
            <span className="row-value">{expiry}</span>
          </div>
        </div>
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">Session Token</div>
            <div className="row-sub">Current authentication token ID</div>
          </div>
          <div className="row-right">
            <span
              className="row-value"
              style={{ fontSize: "10px", letterSpacing: "0.5px" }}
            >
              bfp-sess-0042f8a1
            </span>
          </div>
        </div>
      </div>

      <div className="danger-block">
        <div className="block-header">
          <div className="block-title">End Session</div>
        </div>
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">Sign Out</div>
            <div className="row-sub">
              Terminate this session and return to login
            </div>
          </div>
          <div className="row-right">
            <button className="btn-logout" onClick={onLogout}>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function SectionAppearance({ theme, onThemeToggle }) {
  return (
    <>
      <div className="section-title">Appearance</div>
      <div className="section-desc">
        Customize how the FireGIS interface looks.
      </div>

      <div className="settings-block">
        <div className="block-header">
          <div className="block-title">Theme</div>
        </div>
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">Color Mode</div>
            <div className="row-sub">
              Switch between dark and light interface theme
            </div>
          </div>
          <div className="row-right">
            <div className="theme-options">
              <div
                className={`theme-opt${theme === "dark" ? " selected" : ""}`}
                onClick={() => theme !== "dark" && onThemeToggle()}
              >
                <div
                  className={`theme-preview tp-dark${
                    theme === "dark" ? " selected" : ""
                  }`}
                />
                <span className="theme-name">Dark</span>
              </div>
              <div
                className={`theme-opt${theme === "light" ? " selected" : ""}`}
                onClick={() => theme !== "light" && onThemeToggle()}
              >
                <div
                  className={`theme-preview tp-light${
                    theme === "light" ? " selected" : ""
                  }`}
                />
                <span className="theme-name">Light</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-block">
        <div className="block-header">
          <div className="block-title">Interface</div>
        </div>
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">Compact Sidebar</div>
            <div className="row-sub">Show icons only in the sidebar panel</div>
          </div>
          <div className="row-right">
            <Toggle id="compact" defaultOn={false} />
          </div>
        </div>
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">Animations</div>
            <div className="row-sub">Enable UI motion and transitions</div>
          </div>
          <div className="row-right">
            <Toggle id="anim" defaultOn={true} />
          </div>
        </div>
      </div>
    </>
  );
}

function SectionNotifications() {
  return (
    <>
      <div className="section-title">Notifications</div>
      <div className="section-desc">
        Control how and when you receive system alerts.
      </div>

      <div className="settings-block">
        <div className="block-header">
          <div className="block-title">Incident Alerts</div>
        </div>
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">New Incident Reports</div>
            <div className="row-sub">
              Alert when a new fire incident is logged
            </div>
          </div>
          <div className="row-right">
            <Toggle id="inc" defaultOn={true} />
          </div>
        </div>
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">Alarm Escalations</div>
            <div className="row-sub">Notify on alarm level upgrades</div>
          </div>
          <div className="row-right">
            <Toggle id="esc" defaultOn={true} />
          </div>
        </div>
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">Incident Resolution</div>
            <div className="row-sub">Alert when an incident is closed</div>
          </div>
          <div className="row-right">
            <Toggle id="res" defaultOn={false} />
          </div>
        </div>
      </div>

      <div className="settings-block">
        <div className="block-header">
          <div className="block-title">Personnel & Dispatch</div>
        </div>
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">Dispatch Confirmations</div>
            <div className="row-sub">
              Notify when a unit acknowledges dispatch
            </div>
          </div>
          <div className="row-right">
            <Toggle id="disp" defaultOn={true} />
          </div>
        </div>
        <div className="block-row">
          <div className="row-left">
            <div className="row-label">IoT Device Offline</div>
            <div className="row-sub">
              Alert when a personnel tracker goes offline
            </div>
          </div>
          <div className="row-right">
            <Toggle id="iot" defaultOn={true} />
          </div>
        </div>
      </div>
    </>
  );
}

function SectionMapDisplay() {
  return (
    <>
      <div className="section-title">Map Display</div>
      <div className="section-desc">
        Configure what is shown on the GIS command map.
      </div>

      <div className="settings-block">
        <div className="block-header">
          <div className="block-title">Map Layers</div>
        </div>
        {[
          {
            id: "ml1",
            label: "Show Incident Markers",
            sub: "Display fire incident pins on the map",
            on: true,
          },
          {
            id: "ml2",
            label: "Show Personnel Markers",
            sub: "Display real-time field unit locations",
            on: true,
          },
          {
            id: "ml3",
            label: "Show GNN Route Overlays",
            sub: "Display computed dispatch routes",
            on: true,
          },
          {
            id: "ml4",
            label: "Show Heat Map Layer",
            sub: "Visualize historical incident density",
            on: false,
          },
          {
            id: "ml5",
            label: "Show Purok Boundaries",
            sub: "Display barangay and purok polygon overlays",
            on: false,
          },
        ].map((row) => (
          <div className="block-row" key={row.id}>
            <div className="row-left">
              <div className="row-label">{row.label}</div>
              <div className="row-sub">{row.sub}</div>
            </div>
            <div className="row-right">
              <Toggle id={row.id} defaultOn={row.on} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function SectionAbout() {
  return (
    <>
      <div className="section-title">About</div>
      <div className="section-desc">
        System information and version details.
      </div>

      <div className="settings-block">
        <div className="block-header">
          <div className="block-title">FireGIS Platform</div>
        </div>
        {[
          {
            label: "System Name",
            value: "FireOPS Administrator Dashboard",
            badge: null,
            cls: "",
          },
          {
            label: "Version",
            value: "v1.0.0-beta",
            badge: "vb-green",
            cls: "",
          },
          {
            label: "GNN Model",
            value: "GNN-RL v2.1 · Online",
            badge: null,
            cls: "highlight",
          },
          {
            label: "Database",
            value: "PostgreSQL + PostGIS",
            badge: null,
            cls: "",
          },
          {
            label: "Backend",
            value: "FastAPI · Python 3.12",
            badge: null,
            cls: "",
          },
          {
            label: "Organization",
            value: "Bureau of Fire Protection – Panabo City",
            badge: null,
            cls: "",
          },
          {
            label: "Copyright",
            value: "© 2026 FireOPS · All rights reserved.",
            badge: null,
            cls: "",
          },
        ].map((row) => (
          <div className="block-row" key={row.label}>
            <div className="row-left">
              <div className="row-label">{row.label}</div>
            </div>
            <div className="row-right">
              {row.badge ? (
                <span className={`val-badge ${row.badge}`}>{row.value}</span>
              ) : (
                <span className={`row-value ${row.cls}`}>{row.value}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function SettingsPage({ user, theme, onThemeToggle, onLogout }) {
  const [activeId, setActiveId] = useState("profile");
  const [confirmLogout, setConfirmLogout] = useState(false);

  function renderContent() {
    switch (activeId) {
      case "profile":
        return <SectionProfile user={user} />;
      case "security":
        return <SectionSecurity user={user} />;
      case "session":
        return <SectionSession onLogout={() => setConfirmLogout(true)} />;
      case "appearance":
        return (
          <SectionAppearance theme={theme} onThemeToggle={onThemeToggle} />
        );
      case "notifications":
        return <SectionNotifications />;
      case "display":
        return <SectionMapDisplay />;
      case "about":
        return <SectionAbout />;
      default:
        return null;
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-body">
        <div className="settings-sidebar">
          {SIDEBAR_ITEMS.map(({ section, label, items }) => (
            <div key={section}>
              <div className="sidebar-section-label">{label}</div>
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`settings-sidebar-item${
                    activeId === item.id ? " active" : ""
                  }`}
                  onClick={() => setActiveId(item.id)}
                >
                  <item.Icon className="sidebar-item-icon" />
                  {item.label}
                </div>
              ))}
              <div className="sidebar-gap" />
              {section === "system" ? null : <hr className="sidebar-divider" />}
            </div>
          ))}
        </div>

        <div className="settings-content">{renderContent()}</div>
      </div>

      {confirmLogout && (
        <AppModal
          eyebrow="SESSION"
          title="Sign Out"
          onClose={() => setConfirmLogout(false)}
          width={400}
        >
          <div className="apm-body" style={{ paddingBottom: 18 }}>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "var(--text-secondary)",
                lineHeight: 1.6,
              }}
            >
              You are about to end your current session. Any unsaved changes
              will be lost. Are you sure you want to sign out?
            </p>
          </div>
          <div className="apm-actions">
            <button
              className="apm-btn-cancel"
              onClick={() => setConfirmLogout(false)}
            >
              Cancel
            </button>
            <button className="apm-btn-submit" onClick={onLogout}>
              Sign Out
            </button>
          </div>
        </AppModal>
      )}
    </div>
  );
}
