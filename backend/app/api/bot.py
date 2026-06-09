"""Bot / AI integration API.

Authenticated via a static `X-Bot-API-Key` header (configurable via env).
Intentionally minimal and stateless so any bot (Telegram, Discord, an
LLM tool layer, etc.) can act as a thin client. Each bot call can act
on behalf of a specific user via `X-Bot-User: <username>`; if omitted
it acts as the admin user. The bot layer is **not** baked into the
core backend — these endpoints are an interface, not an implementation.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_bot_user
from app.api.jobs import _serialize, create_job_for_user
from app.core.url_validator import URLValidationError, validate_url
from app.database import get_db
from app.models.job import DownloadJob
from app.models.user import User
from app.schemas.job import JobCreate, JobRead, MetadataRequest, MetadataResponse
from app.services.ytdlp_service import extract_metadata

router = APIRouter(prefix="/api/bot", tags=["bot"])


@router.post(
    "/metadata",
    response_model=MetadataResponse,
    summary="(Bot) Inspect a URL before queuing",
)
def bot_metadata(
    payload: MetadataRequest,
    _user: Annotated[User, Depends(get_bot_user)],
):
    try:
        url = validate_url(str(payload.url))
    except URLValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    try:
        return MetadataResponse(**extract_metadata(url))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"yt-dlp error: {exc}") from exc


@router.post(
    "/jobs",
    response_model=JobRead,
    status_code=201,
    summary="(Bot) Submit a download job (MP3/MP4)",
)
def bot_create_job(
    payload: JobCreate,
    user: Annotated[User, Depends(get_bot_user)],
    db: Annotated[Session, Depends(get_db)],
):
    job = create_job_for_user(db, user, payload, source="bot")
    return _serialize(job)


@router.get(
    "/jobs/{job_id}",
    response_model=JobRead,
    summary="(Bot) Poll job status / get download link",
)
def bot_get_job(
    job_id: int,
    user: Annotated[User, Depends(get_bot_user)],
    db: Annotated[Session, Depends(get_db)],
):
    job = db.get(DownloadJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="job not found")
    return _serialize(job)
