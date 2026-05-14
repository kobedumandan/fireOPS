import { useState, useEffect } from "react";
import "../styles/TopBar.css";

const NAV_ITEMS = ["Dashboard", "Incidents", "Personnel", "Stations"];

export default function TopBar({
  activeNav,
  onNavChange,
  theme,
  onThemeToggle,
  onOpenSettings,
  showingSettings,
  user,
}) {
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="topbar">
      <div className="topbar-logo">
        <div className="logo-icon" />
        <div className="logo-text">
          FIRE<span>OPS</span>
        </div>
      </div>

      <div className="topbar-divider" />

      <nav className="topbar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item}
            className={`nav-btn${
              !showingSettings && activeNav === item ? " active" : ""
            }`}
            onClick={() => onNavChange(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      <div className="topbar-right">
        <div className="alert-badge">2 ACTIVE</div>
        <div className="status-dot" />
        <button
          className="theme-toggle"
          onClick={onThemeToggle}
          title="Toggle theme"
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
        <div className="system-time">{clock}</div>
        <div className="topbar-divider" />
        <div
          className={`user-chip${showingSettings ? " active" : ""}`}
          onClick={onOpenSettings}
          style={{ cursor: "pointer" }}
        >
          <div className="user-avatar">
            {`${user?.first_name?.[0] ?? ""}${
              user?.last_name?.[0] ?? ""
            }`.toUpperCase() || "??"}
          </div>
          {user?.first_name
            ? `${user.first_name[0]}. ${user.last_name ?? ""}`.trim()
            : user?.email ?? "—"}
        </div>
      </div>
    </div>
  );
}
