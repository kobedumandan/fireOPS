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

function FeatureFireIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="lp-feature-glyph"
      fill="currentColor"
    >
      <path d="M240-400q0 52 21 98.5t60 81.5q-1-5-1-9v-9q0-32 12-60t35-51l113-111 113 111q23 23 35 51t12 60v9q0 4-1 9 39-35 60-81.5t21-98.5q0-50-18.5-94.5T648-574q-20 13-42 19.5t-45 6.5q-62 0-107.5-41T401-690q-39 33-69 68.5t-50.5 72Q261-513 250.5-475T240-400Zm240 52-57 56q-11 11-17 25t-6 29q0 32 23.5 55t56.5 23q33 0 56.5-23t23.5-55q0-16-6-29.5T537-292l-57-56Zm0-492v132q0 34 23.5 57t57.5 23q18 0 33.5-7.5T622-658l18-22q74 42 117 117t43 163q0 134-93 227T480-80q-134 0-227-93t-93-227q0-129 86.5-245T480-840Z" />
    </svg>
  );
}
function FeatureRoutingIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="lp-feature-glyph"
      fill="currentColor"
    >
      <path d="M247-167q-47-47-47-113v-327q-35-13-57.5-43.5T120-720q0-50 35-85t85-35q50 0 85 35t35 85q0 39-22.5 69.5T280-607v327q0 33 23.5 56.5T360-200q33 0 56.5-23.5T440-280v-400q0-66 47-113t113-47q66 0 113 47t47 113v327q35 13 57.5 43.5T840-240q0 50-35 85t-85 35q-50 0-85-35t-35-85q0-39 22.5-70t57.5-43v-327q0-33-23.5-56.5T600-760q-33 0-56.5 23.5T520-680v400q0 66-47 113t-113 47q-66 0-113-47Zm-7-513q17 0 28.5-11.5T280-720q0-17-11.5-28.5T240-760q-17 0-28.5 11.5T200-720q0 17 11.5 28.5T240-680Zm480 480q17 0 28.5-11.5T760-240q0-17-11.5-28.5T720-280q-17 0-28.5 11.5T680-240q0 17 11.5 28.5T720-200ZM240-720Zm480 480Z" />
    </svg>
  );
}
function FeatureTrackingIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="lp-feature-glyph"
      fill="currentColor"
    >
      <path d="M440-42v-80q-125-14-214.5-103.5T122-440H42v-80h80q14-125 103.5-214.5T440-838v-80h80v80q125 14 214.5 103.5T838-520h80v80h-80q-14 125-103.5 214.5T520-122v80h-80Zm238-240q82-82 82-198t-82-198q-82-82-198-82t-198 82q-82 82-82 198t82 198q82 82 198 82t198-82Zm-311-85q-47-47-47-113t47-113q47-47 113-47t113 47q47 47 47 113t-47 113q-47 47-113 47t-113-47Zm169.5-56.5Q560-447 560-480t-23.5-56.5Q513-560 480-560t-56.5 23.5Q400-513 400-480t23.5 56.5Q447-400 480-400t56.5-23.5ZM480-480Z" />
    </svg>
  );
}
function FeatureTruckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      className="lp-feature-glyph"
      fill="currentColor"
    >
      <path d="M195-155q-35-35-35-85h-40q-33 0-56.5-23.5T40-320v-200h440v-160q0-33 23.5-56.5T560-760h80v-40q0-17 11.5-28.5T680-840h40q17 0 28.5 11.5T760-800v40h22q26 0 47 15t29 40l58 172q2 6 3 12.5t1 13.5v267H800q0 50-35 85t-85 35q-50 0-85-35t-35-85H400q0 50-35 85t-85 35q-50 0-85-35Zm113.5-56.5Q320-223 320-240t-11.5-28.5Q297-280 280-280t-28.5 11.5Q240-257 240-240t11.5 28.5Q263-200 280-200t28.5-11.5Zm400 0Q720-223 720-240t-11.5-28.5Q697-280 680-280t-28.5 11.5Q640-257 640-240t11.5 28.5Q663-200 680-200t28.5-11.5ZM120-440v120h71q17-19 40-29.5t49-10.5q26 0 49 10.5t40 29.5h111v-120H120Zm440 120h31q17-19 40-29.5t49-10.5q26 0 49 10.5t40 29.5h71v-120H560v120Zm0-200h276l-54-160H560v160ZM40-560v-60h40v-80H40v-60h400v60h-40v80h40v60H40Zm100-60h70v-80h-70v80Zm130 0h70v-80h-70v80Zm210 180H120h360Zm80 0h280-280Z" />
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
                Icon: FeatureFireIcon,
                title: "Real-Time Incident Management",
                desc: "Monitor active fire incidents across all barangays with live severity tracking and alarm escalation.",
              },
              {
                cls: "fi-blue",
                Icon: FeatureRoutingIcon,
                title: "GNN-RL Routing Engine",
                desc: "Optimal routing computed by a Graph Neural Network.",
              },
              {
                cls: "fi-green",
                Icon: FeatureTrackingIcon,
                title: "Personnel Tracking",
                desc: "Field unit locations tracked via GPS.",
              },
              {
                cls: "fi-amber",
                Icon: FeatureTruckIcon,
                title: "Multi-Station Dispatch",
                desc: "Coordinate response teams across main and sub-stations from a single command dashboard.",
              },
            ].map((f) => (
              <div className="lp-feature" key={f.title}>
                <div className={`lp-feature-icon ${f.cls}`}>
                  <f.Icon />
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
