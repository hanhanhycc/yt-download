"""Token-protected file download endpoint.

Uses a per-job random token (stored in DB, ttl-enforced) to authorize
downloads. This avoids exposing absolute filesystem paths and supports
shareable temporary links for bots/AI integrations.

Once a download finishes streaming to the client, the file is deleted
from disk and its token is invalidated — the NAS doesn't keep copies.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask

from app.config import settings
from app.database import SessionLocal, get_db
from app.models.job import DownloadJob, JobStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/files", tags=["files"])


def _cleanup_after_download(job_id: int, file_path: str) -> None:
    """Remove the downloaded file and invalidate its token.

    Runs as a Starlette BackgroundTask *after* the response body is fully
    sent (or the client disconnects). Wrapped in broad try/except so a
    cleanup failure never bubbles back to the user — at worst it leaves
    a stray file behind to be removed manually.
    """
    try:
        path = Path(file_path).resolve()
        # Safety: only delete files that live inside the configured
        # download root, never anywhere else on disk.
        download_root = Path(settings.DOWNLOAD_DIR).resolve()
        try:
            path.relative_to(download_root)
        except ValueError:
            logger.warning("refusing to delete %s: outside DOWNLOAD_DIR", path)
        else:
            if path.is_file():
                path.unlink()
                logger.info("deleted %s after download (job %s)", path, job_id)
    except Exception as exc:  # pragma: no cover - best-effort cleanup
        logger.warning("file cleanup failed for job %s: %s", job_id, exc)

    # Always clear the DB references so the link/history no longer offers
    # the file for download.
    db = SessionLocal()
    try:
        job = db.get(DownloadJob, job_id)
        if job is not None:
            job.file_path = None
            job.download_token = None
            job.token_expires_at = None
            db.commit()
    except Exception as exc:  # pragma: no cover
        logger.warning("clearing job refs failed for %s: %s", job_id, exc)
        db.rollback()
    finally:
        db.close()


@router.get("/{job_id}", summary="Download the result of a completed job (token-protected)")
def download_file(
    job_id: int,
    db: Annotated[Session, Depends(get_db)],
    token: str = Query(..., min_length=10, max_length=128),
):
    job = db.get(DownloadJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=409, detail="job not completed")
    if not job.download_token or token != job.download_token:
        raise HTTPException(status_code=403, detail="invalid token")
    # SQLite stores DateTime(timezone=True) as naïve UTC; normalize before
    # comparing so we don't crash with "can't compare offset-naive and
    # offset-aware datetimes" (which surfaces as a 500 to the client).
    expires_at = job.token_expires_at
    if expires_at is not None:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="download token expired")
    if not job.file_path:
        raise HTTPException(status_code=404, detail="file missing")

    path = Path(job.file_path)
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="file no longer on disk")

    return FileResponse(
        path=str(path),
        filename=path.name,
        media_type="application/octet-stream",
        # Delete the file from the NAS and invalidate the token once the
        # client has finished downloading (or has disconnected). The job
        # row stays in history; the download link just becomes inactive.
        background=BackgroundTask(_cleanup_after_download, job.id, str(path)),
    )
