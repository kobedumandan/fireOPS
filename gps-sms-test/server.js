require("dotenv").config();

const express = require("express");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "db.json");

const PHILSMS_API_TOKEN = (process.env.PHILSMS_API_TOKEN || "").trim();
const PHILSMS_SENDER_ID = process.env.PHILSMS_SENDER_ID || "PhilSMS";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
const SEND_SMS = process.env.SEND_SMS === "true";

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ requests: [] }, null, 2));
  }

  const raw = fs.readFileSync(DB_FILE, "utf8");
  return JSON.parse(raw);
}

function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function generateToken() {
  return crypto.randomBytes(8).toString("hex");
}

function nowISO() {
  return new Date().toISOString();
}

function addMinutes(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function normalizePhilippineNumber(input) {
  let number = String(input || "").trim();

  number = number.replace(/\s+/g, "");
  number = number.replace(/-/g, "");

  if (number.startsWith("+63")) {
    return number;
  }

  if (number.startsWith("63")) {
    return "+" + number;
  }

  if (number.startsWith("09") && number.length === 11) {
    return "+63" + number.slice(1);
  }

  throw new Error("Invalid Philippine number. Use format 09XXXXXXXXX or +639XXXXXXXXX.");
}

function findRequestByToken(token) {
  const db = readDB();
  const request = db.requests.find((item) => item.token === token);
  return { db, request };
}

async function sendPhilSms(recipient, message) {
  if (!PHILSMS_API_TOKEN || PHILSMS_API_TOKEN.includes("PASTE_")) {
    throw new Error("Missing PHILSMS_API_TOKEN in .env");
  }

  const tokenPreview = PHILSMS_API_TOKEN.slice(0, 6) + "..." + PHILSMS_API_TOKEN.slice(-4);
  console.log(`[PhilSMS] sending to ${recipient} using token ${tokenPreview} (length ${PHILSMS_API_TOKEN.length})`);

  const response = await fetch("https://dashboard.philsms.com/api/v3/sms/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${PHILSMS_API_TOKEN}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      recipient: recipient,
      sender_id: PHILSMS_SENDER_ID,
      type: "plain",
      message: message
    })
  });

  const rawBody = await response.text();
  let data = {};
  try { data = JSON.parse(rawBody); } catch (_) {}

  console.log(`[PhilSMS] status=${response.status} body=${rawBody}`);

  if (!response.ok || data.status === "error") {
    throw new Error(data.message || `PhilSMS request failed with status ${response.status}: ${rawBody}`);
  }

  return data;
}

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>GPS SMS Test</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 900px;
      margin: 30px auto;
      padding: 20px;
      background: #f7f7f7;
    }
    .card {
      background: white;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    input, textarea, button {
      width: 100%;
      padding: 12px;
      margin-top: 8px;
      margin-bottom: 14px;
      box-sizing: border-box;
      font-size: 16px;
    }
    button {
      background: #111827;
      color: white;
      border: 0;
      border-radius: 6px;
      cursor: pointer;
    }
    button:hover {
      background: #374151;
    }
    code {
      background: #eee;
      padding: 2px 5px;
      border-radius: 4px;
    }
    .muted {
      color: #666;
      font-size: 14px;
    }
    .warning {
      background: #fff7ed;
      border-left: 4px solid #f97316;
      padding: 12px;
      margin-bottom: 15px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>GPS SMS Test</h1>
    <p>This test generates a GPS confirmation link and optionally sends it using PhilSMS.</p>

    <div class="warning">
      Current mode: <b>${SEND_SMS ? "SEND_SMS=true, real SMS will be sent" : "SEND_SMS=false, no SMS will be sent"}</b>
      <br />
      Public base URL: <code>${PUBLIC_BASE_URL}</code>
    </div>

    <form method="POST" action="/api/location-request">
      <label>Receiver phone number</label>
      <input name="phone_number" placeholder="09XXXXXXXXX" required />

      <label>Purpose</label>
      <textarea name="purpose" rows="3" required>FireOPS is requesting your current location for emergency response verification.</textarea>

      <label>Expiry in minutes</label>
      <input name="expires_minutes" type="number" value="15" min="1" max="1440" required />

      <button type="submit">Generate Link / Send SMS</button>
    </form>

    <p class="muted">
      For phone testing, use an HTTPS public URL from ngrok, Cloudflare Tunnel, Vercel, Render, or Netlify.
    </p>
  </div>

  <div class="card">
    <h2>Saved Requests</h2>
    <p><a href="/admin/requests">View location requests</a></p>
  </div>
</body>
</html>
  `);
});

app.post("/api/location-request", async (req, res) => {
  try {
    const phoneNumber = normalizePhilippineNumber(req.body.phone_number);
    const purpose = String(req.body.purpose || "Location request").trim();
    const expiresMinutes = Number(req.body.expires_minutes || 15);

    const token = generateToken();
    const link = `${PUBLIC_BASE_URL}/l/${token}`;

    const smsMessage = `FireOPS: Tap to confirm and share location ${link}`;

    const requestRecord = {
      id: crypto.randomUUID(),
      token,
      phone_number: phoneNumber,
      purpose,
      link,
      sms_message: smsMessage,
      sms_sent: false,
      sms_response: null,
      status: "pending",
      latitude: null,
      longitude: null,
      accuracy: null,
      user_agent: null,
      ip_address: null,
      error_message: null,
      created_at: nowISO(),
      expires_at: addMinutes(expiresMinutes),
      opened_at: null,
      confirmed_at: null,
      denied_at: null
    };

    if (SEND_SMS) {
      const smsResponse = await sendPhilSms(phoneNumber, smsMessage);
      requestRecord.sms_sent = true;
      requestRecord.sms_response = smsResponse;
      requestRecord.status = "sms_sent";
    }

    const db = readDB();
    db.requests.unshift(requestRecord);
    writeDB(db);

    res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Location Request Created</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 900px;
      margin: 30px auto;
      padding: 20px;
      background: #f7f7f7;
    }
    .card {
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    input, textarea {
      width: 100%;
      padding: 12px;
      box-sizing: border-box;
      margin-top: 8px;
    }
    a.button {
      display: inline-block;
      background: #111827;
      color: white;
      padding: 12px 18px;
      border-radius: 6px;
      text-decoration: none;
      margin-top: 10px;
    }
    code {
      background: #eee;
      padding: 2px 5px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Location Request Created</h1>
    <p><b>Status:</b> ${requestRecord.status}</p>
    <p><b>SMS sent:</b> ${requestRecord.sms_sent ? "Yes" : "No, SEND_SMS=false"}</p>
    <p><b>Receiver:</b> ${requestRecord.phone_number}</p>

    <label>Generated Link</label>
    <input value="${link}" readonly onclick="this.select()" />

    <label>SMS Message</label>
    <textarea rows="3" readonly onclick="this.select()">${smsMessage}</textarea>

    <p>
      <a class="button" href="${link}" target="_blank">Open GPS Link</a>
      <a class="button" href="/admin/requests">View Requests</a>
      <a class="button" href="/">Create Another</a>
    </p>

    <p>
      If SEND_SMS=false, copy the link and manually send it through Messenger/SMS first.
    </p>
  </div>
</body>
</html>
    `);
  } catch (error) {
    res.status(400).send(`
      <h1>Error</h1>
      <p>${error.message}</p>
      <p><a href="/">Go back</a></p>
    `);
  }
});

app.get("/l/:token", (req, res) => {
  const { token } = req.params;
  const { db, request } = findRequestByToken(token);

  if (!request) {
    return res.status(404).send(`
      <h1>Invalid Link</h1>
      <p>This location request does not exist.</p>
    `);
  }

  const expired = new Date(request.expires_at).getTime() < Date.now();

  if (expired) {
    request.status = "expired";
    writeDB(db);

    return res.status(410).send(`
      <h1>Expired Link</h1>
      <p>This location request has expired.</p>
    `);
  }

  if (!request.opened_at) {
    request.opened_at = nowISO();
    if (request.status === "pending" || request.status === "sms_sent") {
      request.status = "opened";
    }
    writeDB(db);
  }

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Share Location</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 700px;
      margin: 30px auto;
      padding: 20px;
      background: #f7f7f7;
    }
    .card {
      background: white;
      padding: 22px;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    button {
      width: 100%;
      padding: 14px;
      margin-top: 12px;
      font-size: 16px;
      border: 0;
      border-radius: 6px;
      cursor: pointer;
    }
    .primary {
      background: #166534;
      color: white;
    }
    .secondary {
      background: #991b1b;
      color: white;
    }
    .status {
      margin-top: 15px;
      padding: 12px;
      background: #eef2ff;
      border-radius: 6px;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Location Confirmation</h1>

    <p>${request.purpose}</p>

    <p>
      By tapping the button below, you allow this system to get your current GPS location
      and save it for this specific request.
    </p>

    <button class="primary" onclick="shareLocation()">I Agree, Share My Location</button>
    <button class="secondary" onclick="denyLocation()">Do Not Share</button>

    <div id="status" class="status">Waiting for your action...</div>
  </div>

  <script>
    const token = ${JSON.stringify(token)};

    function setStatus(message) {
      document.getElementById("status").innerText = message;
    }

    async function shareLocation() {
      if (!navigator.geolocation) {
        setStatus("Geolocation is not supported by this browser.");
        return;
      }

      setStatus("Requesting GPS permission... Please tap Allow if your browser asks.");

      navigator.geolocation.getCurrentPosition(
        async function(position) {
          const payload = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
          };

          setStatus("Location received. Sending to server...");

          try {
            const response = await fetch("/api/location/" + token, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.message || "Failed to save location.");
            }

            setStatus(
              "Location confirmed and saved. Thank you.\\n\\n" +
              "Latitude: " + payload.latitude + "\\n" +
              "Longitude: " + payload.longitude + "\\n" +
              "Accuracy: " + Math.round(payload.accuracy) + " meters"
            );
          } catch (error) {
            setStatus("Error saving location: " + error.message);
          }
        },
        async function(error) {
          let message = "Location permission failed.";

          if (error.code === error.PERMISSION_DENIED) {
            message = "You denied location permission.";
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            message = "Location information is unavailable.";
          } else if (error.code === error.TIMEOUT) {
            message = "Location request timed out.";
          }

          setStatus(message);

          await fetch("/api/location/" + token + "/denied", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: message })
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0
        }
      );
    }

    async function denyLocation() {
      setStatus("You chose not to share your location.");

      await fetch("/api/location/" + token + "/denied", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "User clicked Do Not Share" })
      });
    }
  </script>
</body>
</html>
  `);
});

app.post("/api/location/:token", (req, res) => {
  const { token } = req.params;
  const { db, request } = findRequestByToken(token);

  if (!request) {
    return res.status(404).json({
      success: false,
      message: "Invalid token"
    });
  }

  const expired = new Date(request.expires_at).getTime() < Date.now();

  if (expired) {
    request.status = "expired";
    writeDB(db);

    return res.status(410).json({
      success: false,
      message: "This location request has expired."
    });
  }

  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  const accuracy = Number(req.body.accuracy);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({
      success: false,
      message: "Invalid latitude or longitude"
    });
  }

  request.status = "confirmed";
  request.latitude = latitude;
  request.longitude = longitude;
  request.accuracy = Number.isFinite(accuracy) ? accuracy : null;
  request.altitude = req.body.altitude ?? null;
  request.heading = req.body.heading ?? null;
  request.speed = req.body.speed ?? null;
  request.browser_timestamp = req.body.timestamp ?? null;
  request.confirmed_at = nowISO();
  request.user_agent = req.headers["user-agent"] || null;
  request.ip_address = req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;

  writeDB(db);

  res.json({
    success: true,
    message: "Location saved",
    data: {
      latitude: request.latitude,
      longitude: request.longitude,
      accuracy: request.accuracy,
      status: request.status
    }
  });
});

app.post("/api/location/:token/denied", (req, res) => {
  const { token } = req.params;
  const { db, request } = findRequestByToken(token);

  if (!request) {
    return res.status(404).json({
      success: false,
      message: "Invalid token"
    });
  }

  request.status = "denied";
  request.denied_at = nowISO();
  request.error_message = req.body.reason || "User denied location permission";
  request.user_agent = req.headers["user-agent"] || null;
  request.ip_address = req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;

  writeDB(db);

  res.json({
    success: true,
    message: "Location request marked as denied"
  });
});

app.get("/admin/requests", (req, res) => {
  const db = readDB();

  const rows = db.requests.map((item) => {
    const mapsLink = item.latitude && item.longitude
      ? `<a href="https://www.google.com/maps?q=${item.latitude},${item.longitude}" target="_blank">Open Map</a>`
      : "No GPS yet";

    return `
      <tr>
        <td>${item.created_at}</td>
        <td>${item.phone_number}</td>
        <td>${item.status}</td>
        <td>${item.sms_sent ? "Yes" : "No"}</td>
        <td>${item.latitude || ""}</td>
        <td>${item.longitude || ""}</td>
        <td>${item.accuracy ? Math.round(item.accuracy) + "m" : ""}</td>
        <td>${mapsLink}</td>
        <td><a href="${item.link}" target="_blank">Open Link</a></td>
      </tr>
    `;
  }).join("");

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Location Requests</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="5" />
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 1200px;
      margin: 30px auto;
      padding: 20px;
      background: #f7f7f7;
    }
    .card {
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      overflow-x: auto;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      background: white;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      font-size: 14px;
      text-align: left;
    }
    th {
      background: #111827;
      color: white;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Location Requests</h1>
    <p><a href="/">Create new request</a></p>
    <p>This page auto-refreshes every 5 seconds.</p>

    <table>
      <thead>
        <tr>
          <th>Created</th>
          <th>Phone</th>
          <th>Status</th>
          <th>SMS Sent</th>
          <th>Latitude</th>
          <th>Longitude</th>
          <th>Accuracy</th>
          <th>Map</th>
          <th>Link</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="9">No requests yet.</td></tr>`}
      </tbody>
    </table>
  </div>
</body>
</html>
  `);
});

app.get("/api/requests", (req, res) => {
  const db = readDB();
  res.json(db.requests);
});

app.listen(PORT, () => {
  console.log(`GPS SMS test server running at http://localhost:${PORT}`);
  console.log(`SEND_SMS=${SEND_SMS}`);
  console.log(`PUBLIC_BASE_URL=${PUBLIC_BASE_URL}`);
});