"""Admin-only user & invite-code management."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session

from app.api.deps import PUBLIC_USERNAME, get_current_admin
from app.core.retention import as_utc
from app.core.security import generate_invite_code, hash_password
from app.database import get_db
from app.models.invite import InviteCode
from app.models.job import DownloadJob, JobStatus
from app.models.user import User
from app.schemas.auth import (
    AdminJobList,
    AdminJobRead,
    AdminResetPassword,
    AdminStats,
    AdminUserCreate,
    AdminUserRead,
    InviteCreate,
    InviteRead,
)

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(get_current_admin)])


def _serialize_user(db: Session, user: User) -> AdminUserRead:
    job_count = (
        db.query(func.count(DownloadJob.id))
        .filter(DownloadJob.user_id == user.id)
        .scalar()
    ) or 0
    last_dl = (
        db.query(func.max(DownloadJob.created_at))
        .filter(DownloadJob.user_id == user.id)
        .scalar()
    )
    return AdminUserRead(
        id=user.id,
        username=user.username,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        is_active=user.is_active,
        is_admin=user.is_admin,
        created_at=user.created_at,
        job_count=int(job_count),
        last_download_at=last_dl,
    )


# ----- Users -----

@router.get("/users", response_model=List[AdminUserRead], summary="List members")
def list_users(db: Annotated[Session, Depends(get_db)]):
    users = (
        db.query(User)
        .filter(User.username != PUBLIC_USERNAME)
        .order_by(desc(User.is_admin), User.username)
        .all()
    )
    return [_serialize_user(db, u) for u in users]


@router.post("/users", response_model=AdminUserRead, status_code=201, summary="Create a member")
def create_user(payload: AdminUserCreate, db: Annotated[Session, Depends(get_db)]):
    username = payload.username.strip()
    if username.lower() == PUBLIC_USERNAME.lower():
        raise HTTPException(status_code=400, detail="Username not allowed")
    existing = db.query(User).filter(func.lower(User.username) == username.lower()).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Username already taken")
    user = User(
        username=username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        is_active=True,
        is_admin=payload.is_admin,
        is_public=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _serialize_user(db, user)


@router.post(
    "/users/{user_id}/reset-password",
    status_code=204,
    summary="Reset a member's password",
)
def reset_password(
    user_id: int,
    payload: AdminResetPassword,
    db: Annotated[Session, Depends(get_db)],
):
    user = db.get(User, user_id)
    if not user or user.is_public:
        raise HTTPException(status_code=404, detail="user not found")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return None


@router.post("/users/{user_id}/active", response_model=AdminUserRead, summary="Enable/disable a member")
def set_active(
    user_id: int,
    active: bool,
    admin: Annotated[User, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    user = db.get(User, user_id)
    if not user or user.is_public:
        raise HTTPException(status_code=404, detail="user not found")
    if user.id == admin.id and not active:
        raise HTTPException(status_code=400, detail="You can't disable your own account")
    user.is_active = active
    db.commit()
    db.refresh(user)
    return _serialize_user(db, user)


@router.post("/users/{user_id}/role", response_model=AdminUserRead, summary="Grant/revoke admin")
def set_role(
    user_id: int,
    is_admin: bool,
    admin: Annotated[User, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    user = db.get(User, user_id)
    if not user or user.is_public:
        raise HTTPException(status_code=404, detail="user not found")
    if user.id == admin.id and not is_admin:
        raise HTTPException(status_code=400, detail="You can't revoke your own admin role")
    user.is_admin = is_admin
    db.commit()
    db.refresh(user)
    return _serialize_user(db, user)


@router.delete("/users/{user_id}", status_code=204, summary="Delete a member (and their jobs)")
def delete_user(
    user_id: int,
    admin: Annotated[User, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    user = db.get(User, user_id)
    if not user or user.is_public:
        raise HTTPException(status_code=404, detail="user not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You can't delete your own account")
    # Their jobs cascade-delete; the next cleanup sweep removes any leftover
    # files now that no row references them.
    db.delete(user)
    db.commit()
    return None


# ----- Invite codes -----

def _serialize_invite(inv: InviteCode) -> InviteRead:
    return InviteRead(
        id=inv.id,
        code=inv.code,
        max_uses=inv.max_uses,
        used_count=inv.used_count,
        expires_at=inv.expires_at,
        created_at=inv.created_at,
        is_exhausted=inv.used_count >= inv.max_uses,
    )


@router.get("/invites", response_model=List[InviteRead], summary="List invite codes")
def list_invites(db: Annotated[Session, Depends(get_db)]):
    invites = db.query(InviteCode).order_by(desc(InviteCode.created_at)).all()
    return [_serialize_invite(i) for i in invites]


@router.post("/invites", response_model=InviteRead, status_code=201, summary="Create an invite code")
def create_invite(
    payload: InviteCreate,
    admin: Annotated[User, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    # Retry a couple of times in the (extremely unlikely) event of a collision.
    code = generate_invite_code()
    for _ in range(5):
        if db.query(InviteCode).filter(InviteCode.code == code).first() is None:
            break
        code = generate_invite_code()

    expires_at = None
    if payload.expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)

    invite = InviteCode(
        code=code,
        created_by=admin.id,
        max_uses=payload.max_uses,
        used_count=0,
        expires_at=expires_at,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return _serialize_invite(invite)


@router.delete("/invites/{invite_id}", status_code=204, summary="Delete an invite code")
def delete_invite(invite_id: int, db: Annotated[Session, Depends(get_db)]):
    invite = db.get(InviteCode, invite_id)
    if invite is None:
        raise HTTPException(status_code=404, detail="invite not found")
    db.delete(invite)
    db.commit()
    return None


# ----- All download history (across every user, with requesting IP) -----

@router.get("/jobs", response_model=AdminJobList, summary="All downloads (any user) + IP")
def list_all_jobs(
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = Query(None, description="match URL, title, IP or username"),
):
    q = db.query(DownloadJob, User).join(User, DownloadJob.user_id == User.id)

    if status_filter:
        try:
            q = q.filter(DownloadJob.status == JobStatus(status_filter))
        except ValueError:
            raise HTTPException(status_code=400, detail="invalid status filter")

    if search:
        like = f"%{search.strip()}%"
        q = q.filter(
            or_(
                DownloadJob.url.ilike(like),
                DownloadJob.title.ilike(like),
                DownloadJob.client_ip.ilike(like),
                User.username.ilike(like),
            )
        )

    total = q.count()
    rows = q.order_by(desc(DownloadJob.created_at)).offset(offset).limit(limit).all()

    items = [
        AdminJobRead(
            id=job.id,
            username=user.username,
            is_public=user.is_public,
            source=job.source,
            client_ip=job.client_ip,
            url=job.url,
            title=job.title,
            format=job.format.value if hasattr(job.format, "value") else str(job.format),
            quality=job.quality,
            status=job.status.value if hasattr(job.status, "value") else str(job.status),
            file_size=job.file_size,
            created_at=job.created_at,
            finished_at=job.finished_at,
        )
        for job, user in rows
    ]
    return AdminJobList(total=total, items=items)


# ----- Dashboard stats -----

@router.get("/stats", response_model=AdminStats, summary="Dashboard overview metrics")
def stats(db: Annotated[Session, Depends(get_db)]):
    members = (
        db.query(func.count(User.id))
        .filter(User.is_public.is_(False), User.is_admin.is_(False))
        .scalar()
    ) or 0
    admins = (
        db.query(func.count(User.id)).filter(User.is_admin.is_(True)).scalar()
    ) or 0

    invites_active = 0
    for inv in db.query(InviteCode).all():
        if inv.used_count >= inv.max_uses:
            continue
        expires_at = as_utc(inv.expires_at)
        if expires_at is not None and expires_at < datetime.now(timezone.utc):
            continue
        invites_active += 1

    downloads_total = db.query(func.count(DownloadJob.id)).scalar() or 0

    # "Today" = since UTC midnight.
    now = datetime.now(timezone.utc)
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    downloads_today = (
        db.query(func.count(DownloadJob.id))
        .filter(DownloadJob.created_at >= midnight.replace(tzinfo=None))
        .scalar()
    ) or 0

    status_breakdown: dict[str, int] = {}
    for st, cnt in (
        db.query(DownloadJob.status, func.count(DownloadJob.id))
        .group_by(DownloadJob.status)
        .all()
    ):
        key = st.value if hasattr(st, "value") else str(st)
        status_breakdown[key] = int(cnt)

    active = status_breakdown.get("pending", 0) + status_breakdown.get("running", 0)
    failed = status_breakdown.get("failed", 0)

    storage_bytes = (
        db.query(func.coalesce(func.sum(DownloadJob.file_size), 0))
        .filter(DownloadJob.file_path.isnot(None))
        .scalar()
    ) or 0

    return AdminStats(
        total_members=int(members),
        total_admins=int(admins),
        total_invites_active=invites_active,
        downloads_total=int(downloads_total),
        downloads_today=int(downloads_today),
        downloads_active=int(active),
        downloads_failed=int(failed),
        storage_bytes=int(storage_bytes),
        status_breakdown=status_breakdown,
    )
