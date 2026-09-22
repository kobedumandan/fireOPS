# Make the Notifications tab real

> Status: **implemented (2026-09-13).** All eight sections built as specified;
> the verification steps below still need a run against a live backend.
> Paths below are relative to the repo root (`bfp_capstone/`).

## Context

All five toggles on the Notifications tab are `<Toggle defaultOn={…} />` with no `on`,
no `onChange` — pure local state that resets on tab switch
([SettingsPage.jsx:849-925](frontend/src/pages/SettingsPage.jsx#L849)).

But the dead toggles are the smaller half of the problem: **there is no notification
surface anywhere in this app.** No toast, no bell, no notification centre, no sound. The
only `banner` classes are scoped inside modals (`adm-banner`) and the map
(`map-pick-banner`). Unlike the Appearance tab — where the CSS already existed and only
needed a switch wired to it — there is nothing here for a toggle to gate. So this task
is "build the delivery mechanism, then wire the toggles to it", not "wire the toggles".

What *does* exist is a solid event backbone. The persistent WebSocket at
[App.jsx:219-320](frontend/src/App.jsx#L219) already carries almost everything needed,
so no polling and no second socket:

| Toggle | Source | Availability |
|---|---|---|
| New Incident Reports | WS `incident_created` | already handled in the switch |
| Alarm Escalations | WS `incident_updated`, diff `alarm` vs previous | derivable |
| Incident Resolution | WS `incident_updated` leaving `ACTIVE_STATUSES` | condition already written at [App.jsx:254](frontend/src/App.jsx#L254) |
| IoT Device Offline | `is_stale` from the 10s poll ([personnel.py:132](backend/routers/personnel.py#L132), >15 min) | derivable, edge-detect |
| Dispatch Confirmations | — | **no such data exists** |

Two findings drove the decisions below:

1. **"Notify when a unit acknowledges dispatch" describes an event the system cannot
   produce.** `dispatch_status` is only ever written to `"on_scene"`
   ([dispatch.py:291](backend/routers/dispatch.py#L291)); the `"en_route"` value in the
   column comment is never assigned by any code path. No ack column, no ack endpoint.
2. **`auto_dispatch_failed` is broadcast and silently dropped.**
   [incidents.py:172](backend/routers/incidents.py#L172) fires when auto-dispatch finds
   no available team — meaning nobody is en route to a logged fire — and the dashboard
   says nothing at all. Likewise `mark_arrived` commits with no broadcast, so the
   dashboard never learns a unit arrived.

Outcome: seven toggles that each gate a real alert, surviving reload.

## Decisions taken

- **Toasts *and* a history panel.** Transient-only loses information permanently if the
  dispatcher looked away; panel-only never grabs attention for a new fire.
- **"Dispatch Confirmations" is repointed to arrival**, relabelled *Unit On Scene*. This
  needs one added broadcast, which also closes the gap where arrival is invisible to the
  dashboard.
- **Auto-dispatch failure becomes a sixth notification** under its own toggle.
- **Sound is synthesised, not an asset.** A short WebAudio two-tone beep — no audio file
  to add to the repo. Browsers block audio until the page has had a user gesture, so the
  chime fails silently until the dispatcher has clicked once; that is accepted, and the
  code must not throw when it happens.
- **Per-browser, not per-account** — one `localStorage` JSON blob, matching
  `fireops-compact-nav` / `fireops-animations`. No backend, no migration.
- **Reuse the existing socket.** Translation happens inside the WS branches already in
  `App.jsx`; no new connection, no duplicated reconnect logic.

## 1. Preference state — `frontend/src/App.jsx`

One object rather than seven `useState`s:

```js
const NOTIF_DEFAULTS = {
  newIncident: true, escalation: true, resolution: false,
  onScene: true, deviceOffline: true, autoDispatchFailed: true,
  sound: false,   // intrusive, and inert until a user gesture
}
const [notifPrefs, setNotifPrefs] = useState(() => {
  try { return { ...NOTIF_DEFAULTS, ...JSON.parse(localStorage.getItem('fireops-notif-prefs') || '{}') } }
  catch { return NOTIF_DEFAULTS }
})
```

One effect persists it. `setNotifPref(key, value)` is passed to `SettingsPage`.
`resolution` defaults `false` to preserve today's `defaultOn={false}`.

## 2. Notification store — new `frontend/src/hooks/useNotifications.js`

`useNotifications(prefs)` → `{ items, unreadCount, push, dismiss, markAllRead, clear }`.

- `push(kind, { title, body, fireId, severity })` **returns early if `prefs[kind]` is
  false** — so every call site stays dumb and the gating lives in one place. Prefs come
  in as an argument (not read from `localStorage`) so a toggle flip applies immediately
  without a reload.
- Items: `{ id, kind, title, body, at, fireId, severity, read }`, newest first, list
  capped at 50.
- Toast visibility is a separate short-lived subset; `severity: 'critical'` items
  (new incident, escalation, auto-dispatch failure) do not auto-dismiss.
- Plays the chime when `prefs.sound` and `severity === 'critical'`.

## 3. Chime — new `frontend/src/utils/chime.js`

Lazily-created shared `AudioContext`, two short oscillator notes. `resume()` on first
use; wrap everything in try/catch and return silently if the context is suspended or
unavailable. No asset, no dependency.

## 4. Event → notification wiring — `frontend/src/App.jsx`

**Critical:** do not call `push()` inside a `setActiveIncidents(prev => …)` updater —
that is a side effect in a reducer and React will double-invoke it in StrictMode (the
same `react-hooks/purity` class of problem hit on the Security tab). Instead keep a
`useRef` map of `fire_id → { alarm, status }`, compare in the handler body *before*
calling `setState`, then update the ref.

- `incident_created` → `push('newIncident', …)` using `loc`, `sev`, `alarm` from
  `_incident_dict` ([serializers.py:87](backend/serializers.py#L87)).
- `incident_updated` → compare against the ref: alarm increased → `push('escalation')`;
  status left `ACTIVE_STATUSES` → `push('resolution')`.
- `auto_dispatch_failed` → new branch. Its payload is only `{ fire_id, reason }`, so
  resolve the location from `activeIncidents` (`incident_created` always precedes it).
- `dispatch_arrived` → new branch, `push('onScene', …)`.
- **Device offline** in the 10s poll: a `useRef` set of already-stale `per_id`s, fire
  only on `false → true`. Seed the ref from the first poll **without** alerting, so a
  tracker that was already offline before login doesn't produce a burst on mount.

## 5. Surfaces — new `ToastStack.jsx`, `NotificationPanel.jsx`, `Notifications.css`

Both are rendered from `App.jsx` alongside the modals, **not** inside `TopBar`.
`.topbar` sets `position: relative; z-index: var(--z-topbar)` (100), which creates a
stacking context that would cap any descendant below the map's `--z-map-label` (1500) —
rendering at top level avoids that trap without needing a portal.

- `ToastStack`: fixed bottom-right, `z-index: calc(var(--z-modal) + 1)` (precedent at
  [index.css:320](frontend/src/index.css#L320)) so a new-fire toast is never buried by
  an open modal. `aria-live="assertive"` + `role="alert"` for critical kinds,
  `role="status"` otherwise — matching the existing `adm-banner` usage.
- `NotificationPanel`: fixed, anchored beside the rail, `--z-popover`; grouped by
  relative time, per-item dismiss and a Clear all. Reuse `formatLoginStamp` from
  [utils/session.js](frontend/src/utils/session.js) for the timestamps rather than
  writing new formatting.
- Styling from the existing tokens only (`--bg-card`, `--border`, `--accent-fire`,
  `--accent-fire-dim`, the `*-rgb` triplets for tints) — no colour literals.
- Entry animation needs no special handling: the `data-motion="off"` kill-switch at
  [index.css:574](frontend/src/index.css#L574) already covers it, since toasts are
  outside the Leaflet exemption.

## 6. Bell in the rail — `frontend/src/components/TopBar.jsx` + `styles/TopBar.css`

A bell `<button className="nav-btn topbar-alerts-btn" data-label="Alerts">` with an
unread-count badge, placed in `.topbar-bottom` above Current Shift. Taking `data-label`
and `.nav-btn` means the compact-rail tooltip and the 34×34 square sizing already apply
with no new compact rules; only the badge needs a compact position tweak. Inline SVG
component in the file's existing icon style — never an `<img>`.

## 7. Arrival broadcast — `backend/routers/dispatch.py`

`mark_arrived` is a **sync** `def` ([dispatch.py:265](backend/routers/dispatch.py#L265)),
so it cannot `await manager.broadcast`. Add a `background_tasks: BackgroundTasks`
parameter and use `background_tasks.add_task(manager.broadcast, payload)` — the pattern
already used at [dispatch.py:391](backend/routers/dispatch.py#L391) and
[mobile.py:263](backend/routers/mobile.py#L263). Adding the parameter is non-breaking;
FastAPI injects it.

Payload `{ type: 'dispatch_arrived', data: { dispatch_id, fire_id, team_id, team_name,
arrived_at } }`, team name resolved via the existing `dispatch.team` relationship with
the id as fallback. No schema change, no migration.

## 8. Settings rows — `frontend/src/pages/SettingsPage.jsx`

`SectionNotifications` takes `prefs` / `onPrefChange`; all toggles become controlled.
Relabel *Dispatch Confirmations* → **Unit On Scene** ("Alert when a unit marks arrival
at the scene"). Add **Auto-Dispatch Failures** ("Alert when no unit could be
auto-dispatched to a fire") to the Personnel & Dispatch block, and an **Alert Sound**
row noting it needs a click on the page first.

## Out of scope (unchanged, still dead)

The six Map Display toggles, and the remaining unhandled broadcasts — `route_updated`,
`incident_deleted`, `constraint_created/updated/deleted`, `obstruction_created/deleted`.

## Verification

1. `cd frontend && npx eslint src` clean — in particular no `set-state-in-effect` or
   `purity` errors from the new ref-diffing; `npx vite build` clean.
2. **Each alert, toggle on then off.** Log an incident → toast + bell increments.
   Escalate it via EscalateAlarmModal → escalation alert. Close it → resolution alert
   (remember it defaults OFF, so turn it on first). Toggle each off and repeat the same
   action → nothing appears, and the bell count does not move.
3. **Arrival:** with a dispatch active, `PATCH /api/dispatch/{id}/arrived` as a
   personnel account → *Unit On Scene* alert on the dashboard. Confirm a non-personnel
   caller still gets 403 and that the response body is unchanged.
4. **Auto-dispatch failure:** log an incident with `auto_dispatch: true` while no team
   is available → alert names the barangay, not just a fire id.
5. **Device offline:** confirm no burst of alerts on login when a tracker is already
   stale, then let a live one pass 15 min (or backdate `current_location.recorded_at`)
   → one alert, and not repeated on every subsequent 10s poll.
6. **Persistence + interaction:** reload → all seven prefs survive. With Animations off,
   toasts appear instantly without sliding. Open a modal and trigger a new incident →
   toast sits above it. Flip Compact Sidebar → bell is a centred square with a working
   hover label and the badge still legible.
7. **Sound:** with the toggle on, reload and trigger an incident *without clicking
   anything* → no console error, no crash, silent. Click once, trigger again → beep.
