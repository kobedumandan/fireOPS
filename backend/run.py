"""
Production launcher for the BFP Capstone API.

Runs Uvicorn with a configurable number of worker processes so CPU-bound work
(GNN route rebuilds triggered by deviations) can run in parallel instead of
serializing behind Python's GIL in a single process.

    python run.py                      # 1 worker (dev default, WS-safe)
    WEB_CONCURRENCY=4 python run.py    # 4 workers

IMPORTANT — before setting WEB_CONCURRENCY > 1 in production:
  Some state is per-process and will NOT be shared across workers:
    * the WebSocket ConnectionManager  -> a dashboard connected to worker A
      won't receive broadcasts emitted by worker B;
    * the in-memory reporter-location sessions (state.report_sessions).
  The stale-driver watchdog is already guarded by a Postgres advisory lock, so
  only one worker runs it. The remaining per-process state needs a shared
  pub/sub backend (e.g. Redis, or Postgres LISTEN/NOTIFY) before multi-worker is
  correct for the real-time features. The DB-backed request endpoints
  (including /api/location/update) are worker-safe today.
"""
import os
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        workers=int(os.getenv("WEB_CONCURRENCY", "1")),
    )
