import { useState } from 'react'
import '../styles/ReporterPage.css'

export default function ReporterPage({ token }) {
  const [phase, setPhase]   = useState('idle') // idle | requesting | success | error
  const [coords, setCoords] = useState(null)
  const [errMsg, setErrMsg] = useState('')

  function requestLocation() {
    if (!navigator.geolocation) {
      setPhase('error')
      setErrMsg('Geolocation is not supported on this device.')
      return
    }

    setPhase('requesting')

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords
        setCoords({ lat, lng, accuracy })

        try {
          const res = await fetch(`http://localhost:8000/api/report-sessions/${token}/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng, accuracy }),
          })
          if (!res.ok) throw new Error(`Server responded ${res.status}`)
          setPhase('success')
        } catch {
          setPhase('error')
          setErrMsg('Location captured but could not be sent to dispatch. Please try again.')
        }
      },
      err => {
        setPhase('error')
        const msgs = {
          1: 'Location access was denied. Please allow location access in your browser settings and try again.',
          2: 'Your location could not be determined. Check that GPS is enabled.',
          3: 'Location request timed out. Please try again.',
        }
        setErrMsg(msgs[err.code] || 'An unknown error occurred.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  return (
    <div className="rp-root">
      <div className="rp-card">

        {/* Header */}
        <div className="rp-brand">
          <div className="logo-icon" style={{ width: 32, height: 32 }} />
          <div className="logo-text" style={{ fontSize: 22 }}>FIRE<span>GIS</span></div>
        </div>
        <div className="rp-org">Bureau of Fire Protection</div>

        {/* ── IDLE ── */}
        {phase === 'idle' && (
          <>
            <div className="rp-icon-wrap rp-icon-idle">📍</div>
            <div className="rp-heading">Emergency Location Request</div>
            <div className="rp-body">
              BFP dispatch has requested your location for emergency response
              coordination. Sharing your location helps responders reach you faster.
            </div>
            <div className="rp-session-chip">Session&nbsp;·&nbsp;{token}</div>
            <button className="rp-cta" onClick={requestLocation}>
              Share My Location
            </button>
            <div className="rp-privacy">
              Your location is shared only with BFP dispatch and is not stored permanently.
            </div>
          </>
        )}

        {/* ── REQUESTING ── */}
        {phase === 'requesting' && (
          <>
            <div className="rp-spinner" />
            <div className="rp-heading">Getting Your Location…</div>
            <div className="rp-body">
              Please allow location access when your browser prompts you.
            </div>
          </>
        )}

        {/* ── SUCCESS ── */}
        {phase === 'success' && (
          <>
            <div className="rp-icon-wrap rp-icon-success">✓</div>
            <div className="rp-heading rp-heading-success">Location Sent</div>
            <div className="rp-body">
              Your location has been shared with BFP dispatch. You may close this tab.
            </div>
            {coords && (
              <div className="rp-coords-card">
                {[
                  ['Latitude',  coords.lat.toFixed(6)],
                  ['Longitude', coords.lng.toFixed(6)],
                  ['Accuracy',  `±${Math.round(coords.accuracy)} m`],
                ].map(([label, value]) => (
                  <div key={label} className="rp-coords-row">
                    <span>{label}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="rp-privacy">Thank you for cooperating with BFP.</div>
          </>
        )}

        {/* ── ERROR ── */}
        {phase === 'error' && (
          <>
            <div className="rp-icon-wrap rp-icon-error">!</div>
            <div className="rp-heading rp-heading-error">Could Not Share Location</div>
            <div className="rp-body">{errMsg}</div>
            <button className="rp-cta rp-cta-retry" onClick={() => setPhase('idle')}>
              Try Again
            </button>
          </>
        )}

      </div>
    </div>
  )
}
