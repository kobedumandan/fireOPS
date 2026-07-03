import { useState } from "react";
import { apiFetch } from "../api";
import "../styles/LoginPage.css";

function EmailIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="lp-meta-icon"
      fill="currentColor"
    >
      <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm320-280L160-640v400h640v-400L480-440Zm0-80 320-200H160l320 200ZM160-640v-80 480-400Z" />
    </svg>
  );
}
function PasswordIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="lp-meta-icon"
      fill="currentColor"
    >
      <path d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm0-80h480v-400H240v400Zm296.5-143.5Q560-327 560-360t-23.5-56.5Q513-440 480-440t-56.5 23.5Q400-393 400-360t23.5 56.5Q447-280 480-280t56.5-23.5ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80ZM240-160v-400 400Z" />
    </svg>
  );
}
function VisibilityOn() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="pw-toggle-icon"
      fill="currentColor"
    >
      <path d="M607.5-372.5Q660-425 660-500t-52.5-127.5Q555-680 480-680t-127.5 52.5Q300-575 300-500t52.5 127.5Q405-320 480-320t127.5-52.5Zm-204-51Q372-455 372-500t31.5-76.5Q435-608 480-608t76.5 31.5Q588-545 588-500t-31.5 76.5Q525-392 480-392t-76.5-31.5ZM214-281.5Q94-363 40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200q-146 0-266-81.5ZM480-500Zm207.5 160.5Q782-399 832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280q113 0 207.5-59.5Z" />
    </svg>
  );
}
function VisibilityOff() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="pw-toggle-icon"
      fill="currentColor"
    >
      <path d="m644-428-58-58q9-47-27-88t-93-32l-58-58q17-8 34.5-12t37.5-4q75 0 127.5 52.5T660-500q0 20-4 37.5T644-428Zm128 126-58-56q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-62-62q41-17 84-25.5t90-8.5q151 0 269 83.5T920-500q-23 59-60.5 109.5T772-302Zm20 246L624-222q-35 11-70.5 16.5T480-200q-151 0-269-83.5T40-500q21-53 53-98.5t73-81.5L56-792l56-56 736 736-56 56ZM222-624q-29 26-53 57t-41 67q50 101 143.5 160.5T480-280q20 0 39-2.5t39-5.5l-36-38q-11 3-21 4.5t-21 1.5q-75 0-127.5-52.5T300-500q0-11 1.5-21t4.5-21l-84-82Zm319 93Zm-151 75Z" />
    </svg>
  );
}

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remembered, setRemembered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState("");
  const [errors, setErrors] = useState({ email: false, password: false });

  function validate() {
    const e = {
      email: !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      password: !password,
    };
    setErrors(e);
    return !e.email && !e.password;
  }

  async function handleLogin() {
    setAlert("");
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("bfp_token", data.access_token);
        localStorage.setItem("bfp_user", JSON.stringify(data.user));
        onLogin(data.user);
      } else {
        setErrors({ email: true, password: true });
        setAlert("Invalid credentials. Please check your email and password.");
      }
    } catch {
      setAlert("Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleLogin();
  }

  return (
    <div className="lp-body" onKeyDown={handleKeyDown}>
      <div className="lp-wrapper">
        {/* LEFT: HERO */}
        <div className="lp-hero">
          <div className="lp-eyebrow">
            Panabo City | Bureau of Fire Protection
          </div>

          <div className="lp-title">
            <div className="lp-title-wrap">
              <div className="lp-title-logo-icon" />
              <div className="lp-title-logo-text">
                FIRE<span>OPS</span>
              </div>
            </div>
          </div>

          {/* <div className="lp-subtitle">GNN-Powered Geospatial Routing &amp; Dispatch</div>
          <div className="lp-rule" /> */}

          <div className="lp-features">
            {[
              {
                cls: "fi-fire",
                icon: "src/assets/svg_icons/fire_icon.svg",
                title: "Real-Time Incident Management",
                desc: "Monitor active fire incidents across all barangays with live severity tracking and alarm escalation.",
              },
              {
                cls: "fi-blue",
                icon: "src/assets/svg_icons/routing_icon.svg",
                title: "GNN-RL Routing Engine",
                desc: "Optimal routing computed by a Graph Neural Network.",
              },
              {
                cls: "fi-green",
                icon: "src/assets/svg_icons/location_tracking_icon.svg",
                title: "Personnel Tracking",
                desc: "Field unit locations tracked via GPS.",
              },
              {
                cls: "fi-amber",
                icon: "src/assets/svg_icons/fire_truck_icon.svg",
                title: "Multi-Station Dispatch",
                desc: "Coordinate response teams across main and sub-stations from a single command dashboard.",
              },
            ].map((f) => (
              <div className="lp-feature" key={f.title}>
                <div className={`lp-feature-icon ${f.cls}`}>
                  <img src={f.icon} alt="x" width="14px" />
                </div>
                <div>
                  <div className="lp-feature-title">{f.title}</div>
                  <div className="lp-feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* <div className="lp-stats">
            {[
              { val: "3", unit: "", label: "Main Stations" },
              { val: "14", unit: "", label: "Personnel" },
              { val: "8", unit: "", label: "Fire Units" },
              { val: "94", unit: "%", label: "Model Accuracy" },
            ].map((s) => (
              <div key={s.label}>
                <div className="lp-stat-val-wrapper">
                  <span className="lp-stat-val">{s.val}</span>
                  <span className="lp-stat-unit">{s.unit}</span>
                </div>
                <span className="lp-stat-label">{s.label}</span>
              </div>
            ))}
          </div> */}
        </div>

        {/* RIGHT: LOGIN CARD */}
        <div className="lp-card">
          <div className="lp-card-header">
            <div className="lp-logo-row">
              <div className="lp-logo-icon" />
              <div className="lp-logo-text">
                FIRE<span>OPS</span>
              </div>
            </div>
            <div className="lp-card-title">Sign In</div>
          </div>

          {/* <hr className="lp-divider" /> */}

          {alert && (
            <div className="lp-alert">
              <span>⚠</span>
              <span>{alert}</span>
            </div>
          )}

          {/* Email */}
          <div className="lp-field-group">
            <label className="lp-field-label">Email</label>
            <div className="lp-field-wrap">
              <EmailIcon />
              <input
                className={`lp-field-input${errors.email ? " error" : ""}`}
                type="email"
                placeholder="you@bfp.gov.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            {errors.email && (
              <div className="lp-field-error">
                Please enter a valid email address.
              </div>
            )}
          </div>

          {/* Password */}
          <div className="lp-field-group">
            <label className="lp-field-label">Password</label>
            <div className="lp-field-wrap">
              <PasswordIcon />
              <input
                className={`lp-field-input${errors.password ? " error" : ""}`}
                type={showPw ? "text" : "password"}
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                className="lp-pw-toggle"
                onClick={() => setShowPw((v) => !v)}
              >
                {showPw ? <VisibilityOn /> : <VisibilityOff />}
              </button>
              {/* <img
                className="lp-pw-toggle"
                src={
                  showPw
                    ? "src/assets/svg_icons/visibility_on.svg"
                    : "src/assets/svg_icons/visibility_off.svg"
                }
                alt={showPw ? "Hide password" : "Show password"}
                onClick={() => setShowPw((v) => !v)}
              /> */}
            </div>
            {errors.password && (
              <div className="lp-field-error">Password is required.</div>
            )}
          </div>

          {/* Meta row */}
          <div className="lp-meta-row">
            <div
              className="lp-remember-wrap"
              onClick={() => setRemembered((v) => !v)}
            >
              {/* <div className={`lp-remember-box${remembered ? " on" : ""}`}>
                ✓
              </div> */}
              {/* <span className="lp-remember-label">Remember me</span> */}
            </div>
              {/* <a className="lp-forgot" href="#">
                Forgot password
              </a> */}
          </div>

          <button
            type="button"
            className={`lp-btn-login${loading ? " loading" : ""}`}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="lp-spinner" />
                {/* Authenticating... */}
              </>
            ) : (
              "Sign In"
            )}
          </button>

          <div className="lp-card-footer">
            <div className="lp-online-row">
              <div className="lp-online-dot" />
              System Online
            </div>
            <div className="lp-copyright-wrap">
              <div className="lp-copyright">
                © 2026 FireGIS  |  Bureau of Fire Protection
              </div>
              <div className="lp-copyright">All rights reserved.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
