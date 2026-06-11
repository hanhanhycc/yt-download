"""Job CRUD + real-time progress (SSE) endpoints."""
from __future__ import annotations

import asyncio
import json
from typing import Annotated, AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, _user_from_token
from app.config import settings
from app.core.rate_limit import (
    check_rate_limit,
    get_client_ip,
    get_daily_quota,
    get_ip_daily_quota,
    get_redis,
    increment_daily_quota,
    increment_ip_daily_quota,
)
from app.core.url_validator import URLValidationError, validate_url
from app.database import get_db
from app.models.job import DownloadJob, JobFormat, JobStatus
from app.models.user import User
from app.schemas.job import JobCreate, JobList, JobRead
from app.workers.runner import request_cancel, submit_download

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _build_download_url(job: DownloadJob) -> str | None:
    if job.status != JobStatus.COMPLETED or not job.download_token:
        return None
    # Relative URL: the browser resolves it against whatever origin it used
    # (LAN IP or a public domain like yt.pfvn.net), so download links work
    # from both without depending on PUBLIC_BASE_URL.
    return f"/api/files/{job.id}?token={job.download_token}"


def _serialize(job: DownloadJob) -> JobRead:
    data = JobRead.model_validate(job)
    data.download_url = _build_download_url(job)
    return data


def _check_quotas(db: Session, user: User) -> None:
    # Per-minute rate limit on job creation
    allowed, _ = check_rate_limit(f"job:create:{user.id}", limit=10, window_seconds=60)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="job create rate limit"
        )

    # Daily quota
    daily_limit = user.daily_job_quota or settings.DEFAULT_DAILY_JOB_QUOTA
    if get_daily_quota(user.id) >= daily_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"daily job quota exceeded ({daily_limit})",
        )

    # Concurrent jobs limit
    concurrent_limit = user.concurrent_jobs or settings.DEFAULT_CONCURRENT_JOBS
    active = (
        db.query(func.count(DownloadJob.id))
        .filter(
            DownloadJob.user_id == user.id,
            DownloadJob.status.in_([JobStatus.PENDING, JobStatus.RUNNING]),
        )
        .scalar()
    )
    if active and int(active) >= concurrent_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"concurrent jobs limit reached ({concurrent_limit})",
        )


def create_job_for_user(
    db: Session,
    user: User,
    payload: JobCreate,
    source: str = "web",
    client_ip: str | None = None,
) -> DownloadJob:
    """Shared helper used by the web API and the bot API."""
    try:
        url = validate_url(str(payload.url))
    except URLValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    _check_quotas(db, user)

    job = DownloadJob(
        user_id=user.id,
        source=source,
        url=url,
        format=JobFormat(payload.format),
        quality=payload.quality,
        format_id=payload.format_id,
        status=JobStatus.PENDING,
        client_ip=client_ip,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    increment_daily_quota(user.id)
    # Hand off to the in-process download thread pool.
    submit_download(job.id)
    return job


@router.post(
    "",
    response_model=JobRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new download job",
)
def create_job(
    payload: JobCreate,
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    # Public-facing per-IP daily quota: anonymous abusers can't burn through
    # the NAS's bandwidth. Authenticated, non-admin users are still capped
    # by their per-user daily quota inside create_job_for_user; the IP cap
    # below is enforced for everyone except IPs in IP_QUOTA_EXEMPT.
    client_ip = get_client_ip(request)
    ip_limit = settings.IP_DAILY_DOWNLOAD_QUOTA
    if ip_limit and ip_limit > 0:
        if client_ip not in settings.ip_quota_exempt_list:
            used = get_ip_daily_quota(client_ip)
            if used >= ip_limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        f"You have reached the daily limit of {ip_limit} downloads "
                        f"for your IP. Please try again tomorrow."
                    ),
                )

    job = create_job_for_user(db, user, payload, source="web", client_ip=client_ip)

    # Only count successful job creations against the IP quota.
    if ip_limit and ip_limit > 0:
        if client_ip not in settings.ip_quota_exempt_list:
            increment_ip_daily_quota(client_ip)

    return _serialize(job)


@router.get("", response_model=JobList, summary="List jobs (history)")
def list_jobs(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status_filter: str | None = Query(None, alias="status"),
):
    q = db.query(DownloadJob).filter(DownloadJob.user_id == user.id)
    if status_filter:
        try:
            q = q.filter(DownloadJob.status == JobStatus(status_filter))
        except ValueError:
            raise HTTPException(status_code=400, detail="invalid status filter")
    total = q.count()
    items = q.order_by(desc(DownloadJob.created_at)).offset(offset).limit(limit).all()
    return JobList(total=total, items=[_serialize(j) for j in items])


@router.get("/{job_id}", response_model=JobRead, summary="Get a single job")
def get_job(
    job_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    job = db.get(DownloadJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="job not found")
    return _serialize(job)


@router.delete("/{job_id}", status_code=204, summary="Cancel or delete a job")
def delete_job(
    job_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    job = db.get(DownloadJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="job not found")
    if job.status in (JobStatus.PENDING, JobStatus.RUNNING):
        # Cooperative cancel: the running download checks this flag and stops.
        request_cancel(job.id)
        job.status = JobStatus.CANCELED
        db.commit()
    else:
        db.delete(job)
        db.commit()
    return None


@router.get("/{job_id}/events", summary="Server-Sent Events stream for progress")
async def job_events(
    job_id: int,
    db: Annotated[Session, Depends(get_db)],
    token: str = Query(..., description="JWT access token (EventSource cannot set headers)"),
):
    user = _user_from_token(token, db)
    job = db.get(DownloadJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="job not found")

    async def event_stream() -> AsyncIterator[bytes]:
        # Push current snapshot first
        snapshot = {
            "status": job.status.value,
            "progress": job.progress,
            "eta": job.eta_seconds,
            "speed": job.speed_bps,
        }
        yield f"data: {json.dumps(snapshot)}\n\n".encode()

        r = get_redis()
        if r is None:
            # Fallback: poll DB
            for _ in range(600):
                await asyncio.sleep(2)
                db.expire_all()
                j = db.get(DownloadJob, job_id)
                if not j:
                    return
                payload = {
                    "status": j.status.value,
                    "progress": j.progress,
                    "eta": j.eta_seconds,
                    "speed": j.speed_bps,
                    "error": j.error,
                }
                yield f"data: {json.dumps(payload)}\n\n".encode()
                if j.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELED):
                    return
            return

        pubsub = r.pubsub()
        pubsub.subscribe(f"job:{job_id}:progress")
        try:
            loop = asyncio.get_running_loop()
            terminal_states = {"completed", "failed", "canceled"}
            while True:
                msg = await loop.run_in_executor(
                    None, lambda: pubsub.get_message(timeout=15.0, ignore_subscribe_messages=True)
                )
                if msg is None:
                    # heartbeat to keep connection alive
                    yield b": ping\n\n"
                    continue
                data = msg.get("data")
                if isinstance(data, bytes):
                    data = data.decode()
                yield f"data: {data}\n\n".encode()
                try:
                    parsed = json.loads(data)
                    if parsed.get("status") in terminal_states:
                        break
                except Exception:
                    pass
        finally:
            try:
                pubsub.close()
            except Exception:
                pass

    return StreamingResponse(event_stream(), media_type="text/event-stream")
