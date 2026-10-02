---
name: security-audit
description: Performs a structured security audit of the FireTrackr codebase (FastAPI backend, React/Vite dashboard, Expo mobile app, Supabase Postgres) — auth/authorization, injection, secrets, public endpoints, uploads, WebSockets, dependencies — and produces a verified, severity-ranked report with fixes. Use when the user asks for a security audit, security check, vulnerability scan, pentest-style review, "is this secure", or before a release/deployment/defense demo. Accepts a scope: full (default), a path, or "diff" for uncommitted/branch changes.
---

# Security Audit

Find **real, exploitable** issues, verify each one against the code, and report them ranked by severity with concrete fixes. Signal over noise: a short list of confirmed findings beats a long list of maybes.

## Scope

Parse the argument:
- *(none)* / `full` → whole repo: `backend/`, `frontend/`, and `../bfp_capstone_mobile` if present.
- `diff` → `git diff HEAD` + `git diff main...HEAD`; audit changed code, but follow data flow into unchanged code when needed.
- a path → that file/dir, plus whatever it calls or is called by.

Skip `venv/`, `node_modules/`, `dist/`, `__pycache__/`, `cache/`, notebooks, and generated data (`*.gpkg`, `*.geojson`).

**Read-only by default.** Don't modify code, rotate secrets, or install tools unless the user asks. Don't send code or secrets to external services.

## Process

1. **Map the attack surface** (brief, for your own use):
   - List every route: grep `@router.(get|post|put|patch|delete|websocket)` and `app.(get|post|mount|websocket)` in `backend/`. For each, note its auth dependency (`get_current_user`, `require_admin`, none).
   - Identify public/unauthenticated entry points: login, `/report/{token}` + reporter assets (exposed via ngrok), `/api/routing/status`, WebSocket, static/upload mounts, any webhook.
   - Identify trust boundaries: dashboard (admin), mobile app (personnel), anonymous reporter phone, SMS provider, Supabase DB.
2. **Run the checklist** below against that surface. Read the code; don't guess from names.
3. **Dependencies** (only if the tool is already available — don't install without asking):
   - `cd frontend && npm audit --omit=dev`
   - `pip-audit -r backend/requirements.txt` (or `backend/venv/Scripts/pip-audit`)
   - Report only high/critical, or anything reachable from our code.
4. **Verify every candidate finding.** Trace from the entry point to the sink. Confirm there is no upstream check (dependency, middleware, schema validation, ORM parameterisation) that neutralises it. Drop anything you can't substantiate, or mark it `PLAUSIBLE` with what would confirm it.
5. **Report** (format below).

## Checklist

### Authentication & sessions (`backend/security.py`, `routers/auth.py`)
- JWT: secret has no weak default in production (`JWT_SECRET` fallback `"change-me"` must fail closed or be overridden); algorithm pinned in `decode(algorithms=[...])`; `exp` enforced; blacklist/`jti` checked on every authenticated path incl. WebSocket.
- Password hashing: strong KDF + iterations, **constant-time comparison** (`hmac.compare_digest`, not `==`), per-user salt.
- Login: rate limiting / lockout, no user enumeration via different errors or timing, role check (admin-only on dashboard login).
- Token storage on clients: `localStorage` on web (XSS impact), `expo-secure-store` vs `AsyncStorage` on mobile.
- Logout actually revokes; password change invalidates other sessions.

### Authorization
- Every dashboard route uses `require_admin` — reads included. Flag any route with no auth dependency that isn't intentionally public.
- Personnel endpoints: **IDOR** — can personnel A act on/read personnel B's dispatch, location, profile, truck? Object ownership must be checked server-side, not trusted from the body.
- Role/ID never taken from client input (`user_role`, `user_id`, `personnel_id` in request bodies).
- Mass assignment: Pydantic update schemas shouldn't expose `role`, `is_active`, ownership fields.

### Public reporter flow (`/report/{token}`, `routers/reporting.py`)
- Token entropy (`secrets.token_urlsafe` ≥ 16 bytes), expiry, single-use or bounded use, not guessable/sequential.
- Location POST: validate lat/lon ranges, rate-limit, reject after expiry.
- HTML template: token and any user data escaped for HTML **and** inline JS contexts.
- Asset route whitelists files — no path traversal.
- SMS send endpoint (`send-sms`): admin-only, phone number validated, can't be abused as an SMS relay (cost/spam).

### Injection
- SQL: any `text()`, f-string, `%`/`.format()` inside SQL or `ST_*` PostGIS calls → must use bound params. Check `order_by`/sort/filter params built from query strings.
- Command injection: `subprocess`, `os.system`, SUMO invocations with user input.
- Path traversal: uploads, file downloads, `FileResponse`, `open()` with user-supplied names.
- Unsafe deserialisation: `pickle`, `torch.load` (without `weights_only=True`), `yaml.load`, `eval`/`exec` on anything not shipped with the repo.
- SSRF: server-side HTTP calls (OSM/Overpass, PhilSMS, push) with user-controlled URLs.

### Frontend (React/Vite)
- `dangerouslySetInnerHTML`, `innerHTML`, Leaflet/Mapbox popups built from HTML strings with user data (incident notes, reporter names, addresses) → XSS.
- `href`/`src` from user data (`javascript:` URLs).
- Secrets in `VITE_*` env vars or source (anything in `import.meta.env` ships to the browser).
- Export features (PDF/DOCX/CSV): **CSV formula injection** — cells starting with `= + - @` must be prefixed/escaped.

### Mobile (Expo)
- API base URL/ngrok URL and keys hardcoded; tokens in `AsyncStorage`; cleartext HTTP; background location data sent without auth.

### Transport, config & infra
- CORS: explicit origins, no `*` with credentials; production origins not left as `localhost` only (or vice-versa, not wide open).
- Security headers on HTML responses (reporter page): CSP, `X-Content-Type-Options`, `Referrer-Policy` (token in URL!).
- Debug/`reload`, verbose tracebacks, or `/docs`/`/openapi.json` exposed publicly via ngrok.
- Secrets: grep for committed keys (`git log -p -S` on suspicious strings, `.env` tracked?, keys in `config.py`/`app.json`/`eas.json`). Supabase connection string, PhilSMS token, Expo push token, JWT secret.
- DB: least-privilege role, SSL to Supabase, no service-role creds in clients.

### Uploads & files (`backend/uploads/`)
- Type validated by content not just extension, size limit, randomised stored names, not served from a path that allows HTML/SVG execution on the API origin.

### WebSocket
- Auth on connect (token validated + blacklist), per-user message authorization, no broadcast of admin-only data (phone numbers, contacts) to personnel sockets.

### Availability / abuse
- Unbounded pagination (`limit` without max), expensive routing/coverage endpoints without auth or rate limit, large request bodies, regex DoS.

### Data exposure
- Responses/serializers leaking `password_hash`, reporter phone numbers, personnel contacts to roles that shouldn't see them.
- Logs containing tokens, passwords, phone numbers or precise locations.

## Severity

| Level | Meaning |
|---|---|
| **Critical** | Unauthenticated RCE, auth bypass, full DB read/write, leaked prod secret |
| **High** | Privilege escalation (personnel → admin), IDOR on sensitive data, stored XSS in admin dashboard, SQLi behind auth |
| **Medium** | Missing rate limits on login/SMS, weak token handling, reflected XSS, info leaks of PII |
| **Low** | Missing headers, verbose errors, hardening gaps with no direct exploit |
| **Info** | Good-practice notes; list briefly or omit |

Rate by *realistic* impact in this deployment (public ngrok tunnel, Supabase, field personnel app), not theoretical worst case.

## Report format

Start with a 2–3 line summary: scope audited, counts per severity, the single most urgent fix.

Then one entry per finding, most severe first:

```
### [HIGH] Personnel can read any other personnel's dispatches
**Where:** backend/routers/mobile.py:142 (`get_dispatch`)
**Status:** CONFIRMED
**Issue:** dispatch_id comes from the path and is fetched without checking it belongs to current_user.
**Exploit:** Log in as any responder, GET /api/mobile/dispatch/{n} for n=1..N → other teams' incident addresses and reporter phone numbers.
**Fix:** Filter by the caller's team/personnel id; return 404 if not owned.
    (short code snippet if it helps)
```

Use clickable `path:line` references. End with:
- **Dependency results** (or "not run — tool unavailable").
- **Not covered / needs manual check** (e.g. Supabase dashboard settings, ngrok config, prod env vars).

If the user asks to fix findings afterwards, fix highest severity first, one finding at a time, and re-verify each. Commit fixes with the `commit-writer` conventions (`fix(security|auth|...)`).
