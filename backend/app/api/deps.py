from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import func
from sqlalchemy.orm import Session


def _admin_user(db: Session) -> Optional["User"]:
    return (
        db.query(User)
        .filter(func.lower(User.username) == settings.ADMIN_USERNAME.strip().lower())
        .first()
    )

from app.config import settings
from app.core.security import decode_token
from app.database import get_db
from app.models.user import User


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def _user_from_token(token: str, db: Session) -> User:
    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.get(User, int(sub))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user")
    return user


def get_current_user(
    token: Annotated[Optional[str], Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    # Open mode (AUTH_REQUIRED=false): no login needed; act as the admin user.
    if not settings.AUTH_REQUIRED:
        admin = _admin_user(db)
        if admin is not None:
            return admin
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _user_from_token(token, db)


def get_current_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin required")
    return user


def get_bot_user(
    db: Annotated[Session, Depends(get_db)],
    x_bot_api_key: Annotated[Optional[str], Header(alias="X-Bot-API-Key")] = None,
    x_bot_user: Annotated[Optional[str], Header(alias="X-Bot-User")] = None,
) -> User:
    """Authenticate a bot using a shared API key, optionally acting as
    a specific user via X-Bot-User (username). Defaults to admin.
    """
    if not x_bot_api_key or x_bot_api_key != settings.BOT_API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bot key")
    username = (x_bot_user or settings.ADMIN_USERNAME).strip().lower()
    user = db.query(User).filter(func.lower(User.username) == username).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bot user not found")
    return user
