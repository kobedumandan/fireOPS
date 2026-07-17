"""
ETA validation harness — predicted route ETA vs. observed arrival times.

INERT ON PURPOSE. Nothing imports this module and no endpoint exposes it.
Real dispatches are not happening yet, so there is nothing to measure; this
exists so that the measurement is ready the moment they start. It is written to
run and report "insufficient_data" rather than to be commented out, so it stays
importable and testable in the meantime.

Wire it up (an admin-only endpoint in main.py) once `status` comes back "ok":

    from eta_validation import validate_eta
    @app.get("/api/metrics/eta-validation")
    def eta_validation(db: Session = Depends(get_db), _auth=Depends(get_current_user)):
        return validate_eta(db)

──────────────────────────────────────────────────────────────────────────────
What this measures, and what it does NOT
──────────────────────────────────────────────────────────────────────────────
Two different quantities are being compared, and conflating them is the main
way this analysis goes wrong:

    observed  = dispatch_arrived_at - dispatch_at     -> RESPONSE time
              = turnout (crew reaching the truck) + travel

    predicted = Route.route_est_minutes               -> TRAVEL time only

`DispatchRecord.dispatch_status` has an "en_route" value, but nothing in main.py
ever writes it — dispatches go straight from "dispatched" to "on_scene". So the
turnout/travel boundary is not recorded anywhere and the two cannot currently be
separated. Everything here is therefore reported as RESPONSE time, never as
travel time, and `bias_s` will absorb turnout.

That has a direct consequence for calibration: fitting the routing multipliers
against `bias_s` as it stands would inflate them until road penalties silently
absorb the crew's turnout delay. To calibrate honestly you need either:

  (a) a `dispatch_en_route_at` timestamp, so travel can be isolated; or
  (b) an intercept term fitted separately from the multiplicative factors, so
      turnout is modelled rather than smeared into the road penalties.

Prefer (a). It is one column and one status transition, and it turns an
unidentifiable model into an identifiable one.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from statistics import median
from typing import Any, Dict, List, Tuple

from sqlalchemy.orm import Session

from models import DispatchRecord

logger = logging.getLogger(__name__)

# Below this many usable samples, no metrics are reported. A mean absolute error
# over a handful of trips is noise with a decimal point on it, and a number on a
# slide is harder to retract than a blank. Raise rather than lower this.
MIN_SAMPLES = 30

# Guards against clock skew and dispatches left open for hours/days. Excluded
# rows are counted and surfaced, never dropped silently.
MIN_PLAUSIBLE_S = 30.0
MAX_PLAUSIBLE_S = 2 * 60 * 60.0


@dataclass(frozen=True)
class Sample:
    """One dispatch with both a predicted travel time and an observed response."""

    dispatch_id: int
    predicted_s: float          # travel only
    observed_s: float           # turnout + travel

    @property
    def error_s(self) -> float:
        """Signed error. Negative => predicted faster than reality."""
        return self.predicted_s - self.observed_s

    @property
    def abs_error_s(self) -> float:
        return abs(self.error_s)


def collect_samples(db: Session) -> Tuple[List[Sample], Dict[str, int]]:
    """Pull every dispatch that can be scored, with a tally of what was skipped.

    The tally is part of the output, not debug noise: when `status` is
    "insufficient_data" it is the only way to tell "no dispatches yet" apart
    from "dispatches happening but routes aren't being recorded".
    """
    rows = (
        db.query(DispatchRecord)
        .filter(DispatchRecord.dispatch_arrived_at.isnot(None))
        .filter(DispatchRecord.dispatch_at.isnot(None))
        .all()
    )

    samples: List[Sample] = []
    skipped = {
        "no_route": 0,
        "no_estimate": 0,
        "implausible_duration": 0,
    }

    for d in rows:
        route = d.route
        if route is None:
            skipped["no_route"] += 1
            continue
        if route.route_est_minutes is None:
            skipped["no_estimate"] += 1
            continue

        observed_s = (d.dispatch_arrived_at - d.dispatch_at).total_seconds()
        if not (MIN_PLAUSIBLE_S <= observed_s <= MAX_PLAUSIBLE_S):
            skipped["implausible_duration"] += 1
            continue

        samples.append(
            Sample(
                dispatch_id=d.dispatch_id,
                predicted_s=float(route.route_est_minutes) * 60.0,
                observed_s=observed_s,
            )
        )

    return samples, skipped


def _summarize(samples: List[Sample]) -> Dict[str, Any]:
    n = len(samples)
    abs_errors = [s.abs_error_s for s in samples]
    errors = [s.error_s for s in samples]

    return {
        "n": n,
        # Headline accuracy: average size of the miss, ignoring direction.
        "mae_s": round(sum(abs_errors) / n, 1),
        # Robust to the one dispatch that sat in traffic behind a parade.
        "median_ae_s": round(median(abs_errors), 1),
        # The calibration signal. Systematically negative => predictions are
        # optimistic. Note this includes turnout (see module docstring), so it
        # is NOT a pure measure of routing error.
        "bias_s": round(sum(errors) / n, 1),
        "mape_pct": round(
            sum(s.abs_error_s / s.observed_s for s in samples) / n * 100.0, 1
        ),
        "observed_mean_s": round(sum(s.observed_s for s in samples) / n, 1),
        "predicted_mean_s": round(sum(s.predicted_s for s in samples) / n, 1),
    }


def validate_eta(db: Session) -> Dict[str, Any]:
    """Score predicted travel time against observed response time.

    Returns either:
        {"status": "insufficient_data", "n": int, "needed": int, "skipped": {...}}
        {"status": "ok", "metrics": {...}, "skipped": {...}, "caveats": [...]}

    Never returns metrics computed from fewer than MIN_SAMPLES samples.
    """
    samples, skipped = collect_samples(db)

    if len(samples) < MIN_SAMPLES:
        return {
            "status": "insufficient_data",
            "n": len(samples),
            "needed": MIN_SAMPLES,
            "skipped": skipped,
            "message": (
                f"{len(samples)} scoreable dispatch(es); need {MIN_SAMPLES}. "
                "No accuracy figure is reported until then."
            ),
        }

    return {
        "status": "ok",
        "metrics": _summarize(samples),
        "skipped": skipped,
        "caveats": [
            "Observed values are RESPONSE time (turnout + travel); predicted "
            "values are TRAVEL time only. bias_s therefore includes crew "
            "turnout and overstates routing error.",
            "Record dispatch_en_route_at to separate turnout from travel before "
            "using bias_s to calibrate routing multipliers.",
        ],
    }
