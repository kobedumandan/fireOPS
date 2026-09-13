// Alert chime for critical notifications.
//
// Synthesised rather than loaded from an asset: two short oscillator notes are
// all this needs, and an .mp3 would be a binary in the repo plus a fetch that
// can fail at exactly the moment the sound matters.
//
// Browsers refuse to start an AudioContext until the page has had a user
// gesture, so on a freshly-reloaded dashboard the first alert is silent. That
// is accepted — the toast and the bell still fire — and the only hard
// requirement is that it must never throw, or a failed beep would take the
// notification with it.

let ctx = null

function getContext() {
  if (ctx) return ctx
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null
  ctx = new Ctor()
  return ctx
}

/** Schedule one note on the shared context. */
function note(ac, freq, startAt, duration) {
  const osc  = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, startAt)
  // Ramped rather than switched: a square-edged gain change on a sine clicks.
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain).connect(ac.destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.02)
}

/**
 * Two-tone alert beep. Silent and non-throwing when audio is unavailable or
 * still suspended for want of a user gesture.
 */
export function playChime() {
  try {
    const ac = getContext()
    if (!ac) return
    // resume() is a promise that rejects when there has been no gesture yet;
    // swallow that rather than letting it surface as an unhandled rejection.
    if (ac.state === 'suspended') ac.resume().catch(() => {})
    if (ac.state !== 'running') return
    const t = ac.currentTime
    note(ac, 880, t, 0.12)
    note(ac, 1320, t + 0.15, 0.16)
  } catch {
    /* no audio on this browser/profile — the visual alert still stands */
  }
}
