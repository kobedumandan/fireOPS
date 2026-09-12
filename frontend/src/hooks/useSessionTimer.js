import { useEffect, useMemo, useState } from 'react'
import { formatDuration, readSession } from '../utils/session'

/**
 * Live "time elapsed since login" plus the session's sign-in and expiry stamps,
 * ticking once a second.
 *
 * The elapsed value is recomputed from Date.now() on every tick rather than
 * incremented, so a throttled background tab or a sleeping machine can't make
 * the clock fall behind — it just jumps to the right value on the next tick.
 */
export function useSessionTimer() {
  // Read the token once per mount: it doesn't change without a re-login, and a
  // re-login remounts the dashboard.
  const session = useMemo(() => readSession(), [])

  const [mountedAt] = useState(() => Date.now())
  const [now, setNow] = useState(mountedAt)

  // A token minted before the backend stamped "iat" carries no start time; fall
  // back to mount so the row shows a running clock instead of nonsense.
  const startedAt = session.startedAt ?? mountedAt

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const expiresAt = session.expiresAt
  const timeFmt = { hour12: true, hour: '2-digit', minute: '2-digit' }

  return {
    timer: formatDuration((now - startedAt) / 1000),
    // Include the date once the cut-off lands on a later day, so an overnight
    // shift doesn't read as if the session expires earlier today.
    expiry: expiresAt
      ? new Date(expiresAt).toLocaleTimeString('en-US', {
          ...timeFmt,
          ...(new Date(expiresAt).toDateString() !== new Date(now).toDateString()
            ? { month: 'short', day: 'numeric' }
            : {}),
        })
      : '—',
    // Absolute sign-in stamp. Deliberately reads session.startedAt rather than
    // the mount fallback: an approximate elapsed clock is still useful, but a
    // wrong wall-clock time is worse than no time at all, so a token without
    // "iat" shows nothing here.
    signedInAt: session.startedAt
      ? new Date(session.startedAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          ...timeFmt,
        })
      : '—',
    // Whole hours the token is valid for, for the row's description.
    lifetimeHours:
      expiresAt && session.startedAt
        ? Math.round((expiresAt - session.startedAt) / 3_600_000)
        : null,
    expired: expiresAt ? now >= expiresAt : false,
  }
}
