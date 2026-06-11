"""Admin-only user & invite-code management."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.api.deps import PUBLIC_USERNAME, get_current_admin
from app.core.retention import as_utc
from app.core.security import generate_invite_code, hash_password
from app.database import get_db
from app.models.invite import InviteCode
from app.models.job import DownloadJob
from app.models.user import User
from app.schemas.auth import (
    AdminResetPassword,
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
    return AdminUserRead(
        id=user.id,
        username=user.username,
        email=user.email,
        is_active=user.is_active,
        is_admin=user.is_admin,
        created_at=user.created_at,
        job_count=int(job_count),
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
