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
from app.core.retention import as_utc, delete_file_after_download, safe_delete_file
from app.database import SessionLocal, get_db
from app.models.job import DownloadJob, JobStatus
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/files", tags=["files"])


def _cleanup_after_download(job_id: int, file_path: str) -> None:
    """Remove the downloaded file and invalidate its token.

    Runs as a Starlette BackgroundTask *after* the response body is fully
    sent (or the client disconnects). Wrapped in broad try/except so a
    cleanup failure never bubbles back to the user — at worst it leaves
    a stray file behind to be removed manually.

    Only runs for anonymous/public downloads; members keep their file (and
    download link) until the 7-day retention sweep removes it.
    """
    if safe_delete_file(file_path):
        logger.info("deleted %s after download (job %s)", file_path, job_id)

    # Clear the DB references so the link/history no longer offers the file.
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
    expires_at = as_utc(job.token_expires_at)
    if expires_at is not None and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="download token expired")
    if not job.file_path:
        raise HTTPException(status_code=404, detail="file missing")

    path = Path(job.file_path)
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="file no longer on disk")

    # Anonymous/public downloads are one-shot: the file is deleted and the
    # token invalidated once the client finishes. Members keep their file and
    # link until the 7-day retention sweep, so they can re-download.
    owner = db.get(User, job.user_id)
    background = None
    if delete_file_after_download(owner):
        background = BackgroundTask(_cleanup_after_download, job.id, str(path))

    return FileResponse(
        path=str(path),
        filename=path.name,
        media_type="application/octet-stream",
        background=background,
    )
