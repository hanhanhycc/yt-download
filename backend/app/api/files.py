"""Token-protected file download endpoint.

Uses a per-job random token (stored in DB, ttl-enforced) to authorize
downloads. This avoids exposing absolute filesystem paths and supports
shareable temporary links for bots/AI integrations.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.job import DownloadJob, JobStatus

router = APIRouter(prefix="/api/files", tags=["files"])


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
    )
