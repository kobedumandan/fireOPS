import { useState, useEffect } from "react";
import { sendReporterSms } from "../api";
import "../styles/AppModal.css";
import "../styles/LocationRequestModal.css";
import { ICON_CLOSE, ICON_COPY, ICON_CHECK, ICON_SEND, ICON_LINK, ICON_PIN } from "./incidentFormOptions";
import { Icon, SectionHead } from "./incidentForm";

// Public tunnel to the backend that serves the reporter page (/report/{token}).
// Must be reachable from the reporter's phone — defaults to the mobile ngrok URL.
const PUBLIC_BASE_URL =
  import.meta.env.VITE_PUBLIC_BASE_URL ??
  "https://deacon-overcook-heftiness.ngrok-free.dev";

function generateToken() {
  return `RPT-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" className={`lrm-btn ${copied ? "done" : ""}`} onClick={copy}>
      <Icon d={copied ? ICON_CHECK : ICON_COPY} />
      {copied ? "Copied" : label}
    </button>
  );
}

/**
 * onLogIncident(coords, mobile, token) – optional; shown once the location
 * arrives, opens the Log Incident form pinned at the reporter's position.
 */
export default function LocationRequestModal({
  onClose,
  onLocationReceived,
  onTokenGenerated,
  onLogIncident,
  receivedData,
}) {
  const [token] = useState(generateToken);
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState(null); // null | {ok, msg}

  const received = !!receivedData;
  const reportUrl = `${PUBLIC_BASE_URL.replace(/\/$/, "")}/report/${token}`;
  const smsText = `BFP FireOPS: Please share your location to help emergency responders reach you. Tap: ${reportUrl}`;

  async function handleSendSms(e) {
    e.preventDefault();
    if (!phone.trim() || sending) return;
    setSending(true);
    setSendStatus(null);
    try {
      const res = await sendReporterSms(token, phone.trim());
      setSendStatus(
        res.sms_sent
          ? { ok: true, msg: `Sent to ${res.phone_number}. Waiting for them to open it.` }
          : { ok: false, msg: "SMS is turned off on the server. Copy the message below and send it yourself." }
      );
    } catch (err) {
      setSendStatus({ ok: false, msg: err.message || "Couldn't send the SMS. Try again or share the link manually." });
    } finally {
      setSending(false);
    }
  }

  // Notify parent of our session token so it can match incoming WS events
  useEffect(() => {
    onTokenGenerated?.(token);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the parent signals that a location was received for our token, pass it on
  useEffect(() => {
    if (!receivedData) return;
    onLocationReceived({ token, coords: [receivedData.lat, receivedData.lng] });
  }, [receivedData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="apm-overlay lrm-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="apm-panel eim-panel lrm-panel" role="dialog" aria-modal="true" aria-labelledby="lrm-title">
        <div className="eim-header">
          <div className="eim-header-main">
            <div className="apm-eyebrow">REPORTER LINK</div>
            <div id="lrm-title" className="eim-title">Request the reporter&apos;s location</div>
          </div>
          <button className="eim-close" onClick={onClose} aria-label="Close">
            <Icon d={ICON_CLOSE} />
          </button>
        </div>

        <div className="eim-body">
          {/* ── Live status: the thing the dispatcher is watching ── */}
          <div className={`lrm-status ${received ? "received" : "awaiting"}`} role="status" aria-live="polite">
            <span className="lrm-status-icon">
              {received ? <Icon d={ICON_PIN} /> : <span className="lrm-pulse" />}
            </span>
            <span className="lrm-status-text">
              <span className="lrm-status-title">
                {received ? "Location received" : "Waiting for the reporter"}
              </span>
              <span className="lrm-status-desc">
                {received
                  ? `Pinned on the map at ${Number(receivedData.lat).toFixed(5)}, ${Number(receivedData.lng).toFixed(5)}.`
                  : "Their GPS pin appears on your map once they open the link and allow location access."}
              </span>
            </span>
          </div>

          {!received && (
            <>
              {/* ── Send by SMS ── */}
              <section className="eim-section">
                <SectionHead title="Send by SMS" desc="Fastest. We text the link for you." />
                <form className="lrm-send" onSubmit={handleSendSms}>
                  <input
                    type="tel"
                    inputMode="tel"
                    placeholder="09XX XXX XXXX"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setSendStatus(null); }}
                    aria-label="Reporter mobile number"
                    autoFocus
                  />
                  <button type="submit" className="apm-btn-submit lrm-send-btn" disabled={sending || !phone.trim()}>
                    {sending ? <span className="apm-spinner" /> : <><Icon d={ICON_SEND} /> Send</>}
                  </button>
                </form>
                {sendStatus && (
                  <div className={`lrm-send-status ${sendStatus.ok ? "ok" : "err"}`}>
                    {sendStatus.ok && <Icon d={ICON_CHECK} />}
                    {sendStatus.msg}
                  </div>
                )}
              </section>

              {/* ── Share manually ── */}
              <section className="eim-section">
                <SectionHead title="Or share it yourself" desc="Paste into Messenger, Viber or any chat." />
                <div className="lrm-link">
                  <Icon d={ICON_LINK} />
                  <span className="lrm-link-url" title={reportUrl}>{reportUrl}</span>
                  <CopyButton text={reportUrl} label="Copy link" />
                </div>
                <div className="lrm-message">
                  <p>{smsText}</p>
                  <CopyButton text={smsText} label="Copy message" />
                </div>
              </section>
            </>
          )}
        </div>

        <div className="eim-footer">
          <span className="lrm-session">
            Session <span className="lrm-session-code">{token}</span>
          </span>
          <div className="eim-footer-actions">
            {received && onLogIncident ? (
              <>
                <button className="apm-btn-cancel" onClick={onClose}>Close</button>
                <button
                  className="apm-btn-submit"
                  onClick={() => onLogIncident([receivedData.lat, receivedData.lng], receivedData.phone || phone.trim(), token)}
                >
                  Log incident here
                </button>
              </>
            ) : (
              <button className="apm-btn-cancel" onClick={onClose}>{received ? "Done" : "Close"}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
