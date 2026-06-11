"""Background retention sweep.

Runs on a daemon thread (no Celery/cron in the single-container build) and
enforces the two retention tiers:

* **public/anonymous** — delete job rows (and any leftover files) older than
  ``PUBLIC_HISTORY_RETENTION_HOURS``.
* **member** — delete job rows older than ``MEMBER_HISTORY_RETENTION_DAYS``;
  for rows still within that window, expire the download (delete file + clear
  token) once ``MEMBER_DOWNLOAD_TTL_DAYS`` has passed.
"""
from __future__ import annotations

import logging
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import settings
from app.core.retention import as_utc, safe_delete_file
from app.database import SessionLocal
from app.models.job import DownloadJob
from app.models.user import User

logger = logging.getLogger(__name__)

_stop = threading.Event()
_thread: threading.Thread | None = None


def run_cleanup_once(db: Session) -> dict[str, int]:
    """Run a single retention sweep. Returns counts for logging/testing."""
    now = datetime.now(timezone.utc)
    public_cutoff = now - timedelta(hours=settings.PUBLIC_HISTORY_RETENTION_HOURS)
    member_cutoff = now - timedelta(days=settings.MEMBER_HISTORY_RETENTION_DAYS)

    # Which user ids are public (anonymous bucket)?
    public_ids = {
        uid for (uid,) in db.query(User.id).filter(User.is_public.is_(True)).all()
    }

    rows_deleted = 0
    files_deleted = 0
    links_expired = 0

    jobs = db.query(DownloadJob).all()
    for job in jobs:
        created = as_utc(job.created_at) or now
        is_public = job.user_id in public_ids
        cutoff = public_cutoff if is_public else member_cutoff

        if created < cutoff:
            # History entry has aged out entirely — remove the file and the row.
            if safe_delete_file(job.file_path):
                files_deleted += 1
            db.delete(job)
            rows_deleted += 1
            continue

        # Row still within its history window. For members, expire the download
        # link/file once the token TTL has passed (public files are already
        # deleted on download, but handle stragglers too).
        if job.download_token:
            expires_at = as_utc(job.token_expires_at)
            if expires_at is not None and expires_at < now:
                if safe_delete_file(job.file_path):
                    files_deleted += 1
                job.file_path = None
                job.download_token = None
                job.token_expires_at = None
                links_expired += 1

    if rows_deleted or files_deleted or links_expired:
        db.commit()
    else:
        db.rollback()

    # After per-job cleanup, sweep any file on disk that no surviving job
    # references (failed/canceled downloads, leftover .part files, or a
    # delete-on-download that failed and nulled file_path but left the file).
    orphans_deleted = _sweep_orphan_files(db, now)

    if rows_deleted or files_deleted or links_expired or orphans_deleted:
        logger.info(
            "cleanup: removed %d rows, %d files, expired %d links, %d orphan files",
            rows_deleted,
            files_deleted,
            links_expired,
            orphans_deleted,
        )

    return {
        "rows_deleted": rows_deleted,
        "files_deleted": files_deleted,
        "links_expired": links_expired,
        "orphans_deleted": orphans_deleted,
    }


def _sweep_orphan_files(db: Session, now: datetime) -> int:
    """Delete files under DOWNLOAD_DIR that no job references and that are
    older than the grace window (so an in-progress download is never hit).
    """
    root = Path(settings.DOWNLOAD_DIR)
    if not root.exists():
        return 0

    # Absolute paths still referenced by some job row.
    referenced: set[Path] = set()
    for (fp,) in db.query(DownloadJob.file_path).filter(DownloadJob.file_path.isnot(None)).all():
        if fp:
            try:
                referenced.add(Path(fp).resolve())
            except Exception:
                continue

    grace = timedelta(hours=max(0, settings.ORPHAN_FILE_GRACE_HOURS))
    deleted = 0
    try:
        candidates = list(root.rglob("*"))
    except Exception as exc:  # pragma: no cover - infra
        logger.warning("orphan sweep: could not list %s: %s", root, exc)
        return 0

    for path in candidates:
        try:
            if not path.is_file():
                continue
            if path.resolve() in referenced:
                continue
            mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
            if now - mtime < grace:
                # Recently written — likely an active download. Leave it.
                continue
            path.unlink()
            deleted += 1
            logger.info("orphan sweep: deleted untracked file %s", path)
        except Exception as exc:  # pragma: no cover - best-effort
            logger.warning("orphan sweep: could not handle %s: %s", path, exc)

    return deleted


def _loop() -> None:
    interval = max(60, settings.CLEANUP_INTERVAL_SECONDS)
    # Run once shortly after boot, then on the interval.
    while not _stop.wait(5):
        db = SessionLocal()
        try:
            run_cleanup_once(db)
        except Exception as exc:  # pragma: no cover - best-effort
            logger.warning("cleanup sweep failed: %s", exc)
            db.rollback()
        finally:
            db.close()
        if _stop.wait(interval):
            break


def start_cleanup_thread() -> None:
    global _thread
    if _thread is not None and _thread.is_alive():
        return
    _stop.clear()
    _thread = threading.Thread(target=_loop, name="retention-cleanup", daemon=True)
    _thread.start()
    logger.info(
        "retention cleanup thread started (interval=%ds)", settings.CLEANUP_INTERVAL_SECONDS
    )


def stop_cleanup_thread() -> None:
    _stop.set()
