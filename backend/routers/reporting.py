"""Reporter location sessions: the SMS link, the public page it opens, and
the position that page posts back to dispatch."""
import html as _html
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse

from config import PUBLIC_BASE_URL, SEND_SMS
from models import Users
from schemas import ReporterLocationBody, ReporterSmsBody
from security import get_current_user
from services.sms import _normalize_ph_number, _send_philsms
from state import manager, report_session_phones, report_sessions


router = APIRouter(tags=["reporting"])


@router.post("/api/report-sessions/{token}/location", status_code=204)
async def submit_reporter_location(token: str, body: ReporterLocationBody):
    """Called by the reporter page — no auth required."""
    phone = report_session_phones.get(token)
    report_sessions[token] = {
        "lat": body.lat,
        "lng": body.lng,
        "accuracy": body.accuracy,
        "phone": phone,
        "received_at": datetime.now(timezone.utc).isoformat(),
    }
    await manager.broadcast({
        "type": "reporter_location",
        "data": {
            "token":    token,
            "lat":      body.lat,
            "lng":      body.lng,
            "accuracy": body.accuracy,
            "phone":    phone,
        },
    })


@router.get("/api/report-sessions")
def list_report_sessions(_auth: Users = Depends(get_current_user)):
    """All reporter sessions with a received location — used to rehydrate map
    pins after a dashboard reload (WS only pushes new events)."""
    out = []
    for token, loc in report_sessions.items():
        if not loc:
            continue
        out.append({
            "token":       token,
            "coords":      [loc["lat"], loc["lng"]],
            "accuracy":    loc.get("accuracy"),
            "phone":       loc.get("phone"),
            "received_at": loc.get("received_at"),
        })
    return out


@router.get("/api/report-sessions/{token}")
def get_report_session(token: str, _auth: Users = Depends(get_current_user)):
    """Dispatch can poll this as a fallback if WS is unavailable."""
    if token not in report_sessions:
        raise HTTPException(status_code=404, detail="Session not found.")
    loc = report_sessions[token]
    return {
        "coords":      [loc["lat"], loc["lng"]] if loc else None,
        "accuracy":    loc["accuracy"] if loc else None,
        "received_at": loc["received_at"] if loc else None,
    }


@router.post("/api/report-sessions/{token}/send-sms")
async def send_reporter_sms(
    token: str,
    body: ReporterSmsBody,
    _auth: Users = Depends(get_current_user),
):
    """Text the reporter a link to the backend-served location page.

    The link points at PUBLIC_BASE_URL (the ngrok tunnel to this backend), so it
    opens on the reporter's phone. When SEND_SMS is false the SMS is not sent and
    the generated link is returned for manual sharing.
    """
    try:
        recipient = _normalize_ph_number(body.phone_number)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    link = f"{PUBLIC_BASE_URL}/report/{token}"
    message = (
        "BFP FireGIS: Please share your location to help emergency responders "
        f"reach you. Tap: {link}"
    )

    # Mark the session pending so the dispatcher poll-fallback doesn't 404,
    # and remember the phone so it can prefill the incident form later.
    report_sessions.setdefault(token, None)
    report_session_phones[token] = recipient

    if not SEND_SMS:
        return {"status": "not_sent", "sms_sent": False, "link": link,
                "phone_number": recipient, "detail": "SEND_SMS is disabled."}

    try:
        await _send_philsms(recipient, message)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return {"status": "sent", "sms_sent": True, "link": link, "phone_number": recipient}


@router.get("/report/{token}", response_class=HTMLResponse)
def reporter_page(token: str):
    """Self-contained reporter location page served over the public tunnel.

    The reporter opens this on their phone, taps to share GPS, and the page
    POSTs to /api/report-sessions/{token}/location (same origin), which
    broadcasts the position to the dispatch dashboard over WebSocket.
    """
    token_js = json.dumps(token)
    token_safe = _html.escape(token)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>BFP FireGIS — Share Location</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      margin: 0; min-height: 100vh; display: flex; align-items: center;
      justify-content: center; background: #0f1115; color: #e8eaed; padding: 20px; }}
    .card {{ width: 100%; max-width: 420px; background: #181b22; border: 1px solid #2a2e37;
      border-radius: 16px; padding: 28px 24px; text-align: center; }}
    .org {{ font-size: 13px; letter-spacing: .5px; color: #9aa0aa; margin-bottom: 18px; }}
    .brand {{ font-size: 24px; font-weight: 800; margin-bottom: 4px; }}
    .brand span {{ color: #ff5a4d; }}
    .icon {{ font-size: 46px; margin: 14px 0 6px; }}
    h1 {{ font-size: 19px; margin: 8px 0; }}
    p {{ font-size: 14px; line-height: 1.5; color: #c4c8d0; }}
    .chip {{ display: inline-block; margin: 14px 0; padding: 6px 12px; border-radius: 999px;
      background: #21262f; font-size: 12px; color: #9aa0aa; }}
    button {{ width: 100%; padding: 15px; font-size: 16px; font-weight: 700; border: 0;
      border-radius: 10px; cursor: pointer; margin-top: 10px; }}
    .cta {{ background: #00c853; color: #04210f; }}
    .cta:disabled {{ opacity: .6; }}
    .retry {{ background: #2a2e37; color: #e8eaed; }}
    .privacy {{ font-size: 12px; color: #777d88; margin-top: 16px; }}
    .coords {{ text-align: left; background: #11141a; border: 1px solid #2a2e37;
      border-radius: 10px; padding: 12px 14px; margin-top: 16px; font-size: 13px; }}
    .coords div {{ display: flex; justify-content: space-between; padding: 3px 0; }}
    .hidden {{ display: none; }}
    .spinner {{ width: 38px; height: 38px; border: 4px solid #2a2e37; border-top-color: #00c853;
      border-radius: 50%; margin: 14px auto; animation: spin 1s linear infinite; }}
    @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
    .ok {{ color: #00c853; }} .err {{ color: #ff5a4d; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">FIRE<span>GIS</span></div>
    <div class="org">Bureau of Fire Protection</div>

    <div id="idle">
      <div class="icon">📍</div>
      <h1>Emergency Location Request</h1>
      <p>BFP dispatch has requested your location for emergency response coordination.
         Sharing your location helps responders reach you faster.</p>
      <div class="chip">Session · {token_safe}</div>
      <button class="cta" id="shareBtn" onclick="shareLocation()">Share My Location</button>
      <div class="privacy">Your location is shared only with BFP dispatch and is not stored permanently.</div>
    </div>

    <div id="requesting" class="hidden">
      <div class="spinner"></div>
      <h1>Getting Your Location…</h1>
      <p>Please allow location access when your browser prompts you.</p>
    </div>

    <div id="success" class="hidden">
      <div class="icon ok">✓</div>
      <h1 class="ok">Location Sent</h1>
      <p>Your location has been shared with BFP dispatch. You may close this tab.</p>
      <div class="coords" id="coords"></div>
      <div class="privacy">Thank you for cooperating with BFP.</div>
    </div>

    <div id="error" class="hidden">
      <div class="icon err">!</div>
      <h1 class="err">Could Not Share Location</h1>
      <p id="errMsg"></p>
      <button class="retry" onclick="show('idle')">Try Again</button>
    </div>
  </div>

  <script>
    const token = {token_js};
    function show(id) {{
      for (const s of ['idle','requesting','success','error'])
        document.getElementById(s).classList.toggle('hidden', s !== id);
    }}
    function shareLocation() {{
      if (!navigator.geolocation) {{
        document.getElementById('errMsg').textContent = 'Geolocation is not supported on this device.';
        return show('error');
      }}
      show('requesting');
      navigator.geolocation.getCurrentPosition(async (pos) => {{
        const {{ latitude: lat, longitude: lng, accuracy }} = pos.coords;
        try {{
          const res = await fetch('/api/report-sessions/' + encodeURIComponent(token) + '/location', {{
            method: 'POST',
            headers: {{ 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }},
            body: JSON.stringify({{ lat, lng, accuracy }}),
          }});
          if (!res.ok) throw new Error('Server responded ' + res.status);
          document.getElementById('coords').innerHTML =
            '<div><span>Latitude</span><span>' + lat.toFixed(6) + '</span></div>' +
            '<div><span>Longitude</span><span>' + lng.toFixed(6) + '</span></div>' +
            '<div><span>Accuracy</span><span>±' + Math.round(accuracy) + ' m</span></div>';
          show('success');
        }} catch (e) {{
          document.getElementById('errMsg').textContent =
            'Location captured but could not be sent to dispatch. Please try again.';
          show('error');
        }}
      }}, (err) => {{
        const msgs = {{
          1: 'Location access was denied. Please allow location access and try again.',
          2: 'Your location could not be determined. Check that GPS is enabled.',
          3: 'Location request timed out. Please try again.',
        }};
        document.getElementById('errMsg').textContent = msgs[err.code] || 'An unknown error occurred.';
        show('error');
      }}, {{ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }});
    }}
  </script>
</body>
</html>"""
