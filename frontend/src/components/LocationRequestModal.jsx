import { useState, useEffect } from "react";
import { sendReporterSms } from "../api";
import "../styles/AppModal.css";
import "../styles/LocationRequestModal.css";

// Public tunnel to the backend that serves the reporter page (/report/{token}).
// Must be reachable from the reporter's phone — defaults to the mobile ngrok URL.
const PUBLIC_BASE_URL =
  import.meta.env.VITE_PUBLIC_BASE_URL ??
  "https://deacon-overcook-heftiness.ngrok-free.dev";

function generateToken() {
  return `RPT-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

export default function LocationRequestModal({
  onClose,
  onLocationReceived,
  onTokenGenerated,
  receivedData,
}) {
  const [token] = useState(generateToken);
  const [urlCopied, setUrlCopied] = useState(false);
  const [smsCopied, setSmsCopied] = useState(false);
  const [reqStatus, setReqStatus] = useState("awaiting"); // awaiting | received

  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState(null); // null | {ok, msg}

  const reportUrl = `${PUBLIC_BASE_URL.replace(/\/$/, "")}/report/${token}`;
  const smsText = `BFP FireOPS: Please share your location to help emergency responders reach you. Tap: ${reportUrl}`;

  async function handleSendSms() {
    if (!phone.trim() || sending) return;
    setSending(true);
    setSendStatus(null);
    try {
      const res = await sendReporterSms(token, phone.trim());
      setSendStatus(
        res.sms_sent
          ? { ok: true, msg: `SMS sent to ${res.phone_number}` }
          : {
              ok: true,
              msg: "SMS disabled on server — copy the link and send it manually.",
            }
      );
    } catch (err) {
      setSendStatus({ ok: false, msg: err.message || "Failed to send SMS." });
    } finally {
      setSending(false);
    }
  }

  // Notify parent of our session token so it can match incoming WS events
  useEffect(() => {
    onTokenGenerated?.(token);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the parent signals that a location was received for our token, update status
  useEffect(() => {
    if (!receivedData) return;
    setReqStatus("received");
    onLocationReceived({ token, coords: [receivedData.lat, receivedData.lng] });
  }, [receivedData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy(text, setCopied) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div
      className="apm-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="apm-panel" style={{ width: 480 }}>
        <div className="apm-header">
          <div>
            <div className="apm-eyebrow">REPORTER LINK</div>
            <div className="apm-title">Request Location from Reporter</div>
          </div>
          <button className="apm-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="apm-scroll">
          <div className="apm-body">
            <p className="lrm-desc">
              Send this link to the reporter. When they open it and allow
              location access, their GPS coordinates will appear on your map.
            </p>

            <div className="lrm-token-row">
              <span className="lrm-token-label">SESSION</span>
              <span className="lrm-token">{token}</span>
            </div>

            <div className="apm-section-label">Shareable Link</div>
            <div className="lrm-block">
              <div className="lrm-url-row">
                <span className="lrm-url">{reportUrl}</span>
                <button
                  className={`lrm-copy-btn${urlCopied ? " lrm-copied" : ""}`}
                  onClick={() => copy(reportUrl, setUrlCopied)}
                >
                  {urlCopied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div className="apm-section-label">Template</div>
            <div className="lrm-block">
              <div className="lrm-sms-text">
                {smsText}
                <button
                  className={`lrm-copy-btn lrm-sms-copy-btn${
                    smsCopied ? " lrm-copied" : ""
                  }`}
                  onClick={() => copy(smsText, setSmsCopied)}
                >
                  {smsCopied ? "Copied" : "Copy Message"}
                </button>
              </div>
            </div>

            <div className="apm-section-label">Send via SMS</div>
            <div className="lrm-block">
              <div className="lrm-url-row">
                <input
                  className="lrm-phone-input"
                  type="tel"
                  inputMode="tel"
                  placeholder="09XXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendSms()}
                />
                <button
                  className="lrm-copy-btn"
                  onClick={handleSendSms}
                  disabled={sending || !phone.trim()}
                >
                  {sending ? "Sending…" : "Send SMS"}
                </button>
              </div>
              {sendStatus && (
                <div
                  className={`lrm-send-status${
                    sendStatus.ok ? "" : " lrm-send-error"
                  }`}
                >
                  {/* {sendStatus.ok ? "✓ " : "✕ "} */}
                  {sendStatus.msg}
                </div>
              )}
            </div>

            <div className={`lrm-status lrm-status-${reqStatus}`}>
              <div className={`lrm-status-dot lrm-sd-${reqStatus}`} />
              {reqStatus === "awaiting"
                ? "Awaiting reporter response…"
                : "Location received; Marker added to Map"}
            </div>
          </div>
        </div>

        <div className="apm-actions">
          <button className="apm-btn-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
