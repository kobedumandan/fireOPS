"""Token-blacklist reaper and its single-worker advisory lock.

`POST /api/auth/logout` writes the token's `jti` into `token_blacklist` so the
rest of that token's lifetime can be refused (a JWT can't be recalled once
issued). The row only has to outlive the token: past its `exp`, `jwt.decode`
rejects the token on expiry alone, so the row no longer changes any outcome.

Without a reaper the table grows by one row per logout and never shrinks, and
every authenticated request pays for it — `get_current_user` hits this table on
each call, so it's on the hot path for the whole API.

Exactly one worker process runs the loop, guarded by a Postgres advisory lock,
mirroring services/watchdog.py.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from config import (
    BLACKLIST_REAPER_GRACE_MINUTES, BLACKLIST_REAPER_INTERVAL_SECONDS,
    _BLACKLIST_REAPER_LOCK_KEY,
)
from database import SessionLocal, engine
from models import TokenBlacklist

logger = logging.getLogger(__name__)
_reaper_lock_conn = None


def _acquire_reaper_lock() -> bool:
    """Try to claim the singleton reaper role for this worker process."""
    global _reaper_lock_conn
    try:
        conn = engine.raw_connection()
        cur = conn.cursor()
        cur.execute("SELECT pg_try_advisory_lock(%s)", (_BLACKLIST_REAPER_LOCK_KEY,))
        got = bool(cur.fetchone()[0])
        cur.close()
        if got:
            _reaper_lock_conn = conn  # keep open to hold the session-level lock
            return True
        conn.close()
        return False
    except Exception as exc:
        logger.warning("Reaper lock acquire failed (%s); running reaper anyway.", exc)
        return True  # single-worker fallback: don't lose the reaper on lock error


def _release_reaper_lock() -> None:
    global _reaper_lock_conn
    if _reaper_lock_conn is not None:
        try:
            _reaper_lock_conn.close()  # closing the session releases the lock
        except Exception:
            pass
        _reaper_lock_conn = None


def prune_expired_tokens(db: Session) -> int:
    """
    Delete blacklist rows whose token has already expired on its own. Returns
    the number of rows removed.

    Safe because the only reader, security.get_current_user, decodes the token
    before consulting this table: an expired token is already rejected there, so
    a row deleted after `exp` can't let anything back in. The grace period keeps
    rows slightly longer than strictly needed to absorb clock skew.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=BLACKLIST_REAPER_GRACE_MINUTES)
    removed = (
        db.query(TokenBlacklist)
        .filter(TokenBlacklist.expires_at < cutoff)
        .delete(synchronize_session=False)
    )
    db.commit()
    return removed


def prune_once() -> int:
    """Run one prune on its own session. Returns the number of rows removed."""
    db = SessionLocal()
    try:
        return prune_expired_tokens(db)
    finally:
        db.close()


async def _token_blacklist_reaper():
    """
    Periodically drop blacklist rows for tokens that have expired anyway.

    Runs once on entry so a backlog left by an earlier deployment clears at
    startup instead of waiting out a full interval.
    """
    while True:
        try:
            removed = await asyncio.to_thread(prune_once)
            if removed:
                logger.info("Token-blacklist reaper removed %s expired row(s).", removed)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("Token-blacklist reaper iteration failed: %s", exc)
        await asyncio.sleep(BLACKLIST_REAPER_INTERVAL_SECONDS)
