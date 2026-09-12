// Reads the login session window out of the stored access token.
//
// The token is the only thing that actually knows when this session began:
// "iat" is stamped by the backend at sign-in and "exp" is the hard cut-off, so
// both survive a page reload, a re-render and switching between dashboard tabs.

/**
 * Decode a JWT's payload. No signature check — this is display-only data, the
 * backend is still the one that validates the token on every request.
 * Returns null for anything that isn't a readable JWT.
 */
export function decodeJwt(token) {
  if (!token) return null
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    // base64url → base64, then pad to a multiple of 4.
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='))
    // Percent-escape the bytes so multi-byte UTF-8 in the payload survives.
    const text = decodeURIComponent(
      json
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    )
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * { startedAt, expiresAt, jti } in epoch-ms for the current session, reading
 * the stored token. Either timestamp is null when the token doesn't carry it —
 * an "iat"-less token predates that claim, so callers need a fallback.
 */
export function readSession(token = localStorage.getItem('bfp_token')) {
  const claims = decodeJwt(token)
  const toMs = (v) => (typeof v === 'number' ? v * 1000 : null)
  return {
    startedAt: toMs(claims?.iat),
    expiresAt: toMs(claims?.exp),
    jti: claims?.jti ?? null,
  }
}

/** Seconds → "HH:MM:SS", hours uncapped. */
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

/**
 * Turn a raw User-Agent string into something a station officer can read, e.g.
 * "Chrome · Windows 11". Deliberately coarse: this is a recognition aid on the
 * Security tab ("was that me?"), not analytics, so an unknown agent degrades to
 * the raw string rather than guessing.
 */
export function describeUserAgent(ua) {
  if (!ua) return '—'

  // Order matters: Edge and Opera both also claim "Chrome", and Chrome claims
  // "Safari", so the more specific brands have to be tested first.
  const browser =
    /\bEdg[A-Z]?\//.test(ua)    ? 'Edge'
    : /\bOPR\/|\bOpera\//.test(ua) ? 'Opera'
    : /\bChrome\//.test(ua)     ? 'Chrome'
    : /\bFirefox\//.test(ua)    ? 'Firefox'
    : /\bSafari\//.test(ua)     ? 'Safari'
    : null

  let os = null
  if (/Windows NT 10\.0/.test(ua)) {
    // Windows 11 reports itself as NT 10.0 and is indistinguishable here, so
    // say "Windows" rather than name the wrong version.
    os = 'Windows'
  } else if (/Windows/.test(ua))        os = 'Windows'
  else if (/Android/.test(ua))          os = 'Android'
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS'
  else if (/Mac OS X/.test(ua))         os = 'macOS'
  else if (/Linux/.test(ua))            os = 'Linux'

  if (browser && os) return `${browser} · ${os}`
  if (browser || os) return browser || os
  return ua.length > 40 ? `${ua.slice(0, 40)}…` : ua
}

/** "Today, 08:31 AM" style stamp for a login-history timestamp. */
export function formatLoginStamp(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const time = d.toLocaleTimeString('en-US', {
    hour12: true, hour: '2-digit', minute: '2-digit',
  })
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`
  return `${d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })}, ${time}`
}
