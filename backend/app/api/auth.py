from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import PUBLIC_USERNAME, get_current_member
from app.config import settings
from app.core.retention import as_utc
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models.invite import InviteCode
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    ProfileUpdate,
    RegisterRequest,
    Token,
    UserRead,
)
from datetime import datetime, timezone

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _find_user_ci(db: Session, username: str) -> User | None:
    return (
        db.query(User)
        .filter(func.lower(User.username) == username.strip().lower())
        .first()
    )


@router.post("/login", response_model=Token, summary="Log in (OAuth2 password flow)")
def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
):
    # Username match is case-insensitive so "Admin" and "admin" both work.
    user = _find_user_ci(db, form.username)
    if not user or user.is_public or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    token = create_access_token(subject=user.id)
    return Token(access_token=token)


@router.post(
    "/register",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    summary="Self-register a member account (invite code required)",
)
def register(
    payload: RegisterRequest,
    db: Annotated[Session, Depends(get_db)],
):
    if not settings.REGISTRATION_ENABLED:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Registration is disabled")

    username = payload.username.strip()
    if username.lower() == PUBLIC_USERNAME.lower():
        raise HTTPException(status_code=400, detail="Username not allowed")

    invite: InviteCode | None = None
    if settings.REGISTRATION_REQUIRE_INVITE:
        code = (payload.invite_code or "").strip()
        if not code:
            raise HTTPException(status_code=400, detail="An invite code is required")
        invite = db.query(InviteCode).filter(func.upper(InviteCode.code) == code.upper()).first()
        if invite is None:
            raise HTTPException(status_code=400, detail="Invalid invite code")
        if invite.used_count >= invite.max_uses:
            raise HTTPException(status_code=400, detail="Invite code already used up")
        expires_at = as_utc(invite.expires_at)
        if expires_at is not None and expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Invite code has expired")

    if _find_user_ci(db, username) is not None:
        raise HTTPException(status_code=409, detail="Username already taken")
    if payload.email:
        existing_email = db.query(User).filter(func.lower(User.email) == payload.email.lower()).first()
        if existing_email is not None:
            raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        username=username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        is_active=True,
        is_admin=False,
        is_public=False,
    )
    db.add(user)
    if invite is not None:
        invite.used_count += 1
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.id)
    return Token(access_token=token)


@router.get("/me", response_model=UserRead, summary="Current authenticated user")
def me(user: Annotated[User, Depends(get_current_member)]):
    return user


@router.patch("/me", response_model=UserRead, summary="Update your profile")
def update_profile(
    payload: ProfileUpdate,
    user: Annotated[User, Depends(get_current_member)],
    db: Annotated[Session, Depends(get_db)],
):
    data = payload.model_dump(exclude_unset=True)

    if "email" in data:
        email = data["email"]
        if email:
            clash = (
                db.query(User)
                .filter(func.lower(User.email) == email.lower(), User.id != user.id)
                .first()
            )
            if clash is not None:
                raise HTTPException(status_code=409, detail="Email already in use")
        user.email = email or None

    if "first_name" in data:
        fn = (data["first_name"] or "").strip()
        user.first_name = fn or None
    if "last_name" in data:
        ln = (data["last_name"] or "").strip()
        user.last_name = ln or None

    db.commit()
    db.refresh(user)
    return user


@router.post("/change-password", status_code=204, summary="Change your own password")
def change_password(
    payload: ChangePasswordRequest,
    user: Annotated[User, Depends(get_current_member)],
    db: Annotated[Session, Depends(get_db)],
):
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return None
