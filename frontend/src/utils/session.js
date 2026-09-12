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
