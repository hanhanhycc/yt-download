"""Retention policy helpers shared by the worker, the file endpoint and the
background cleanup sweep.

Two tiers:

* **public/anonymous** — the single reserved public account owns every
  anonymous download. Its history rows live ``PUBLIC_HISTORY_RETENTION_HOURS``
  and its files are deleted as soon as the client finishes downloading.
* **member** — any registered user (admins included). History rows live
  ``MEMBER_HISTORY_RETENTION_DAYS`` and the download link/file survives for
  ``MEMBER_DOWNLOAD_TTL_DAYS`` so the member can re-download.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)


def is_public_user(user: User | None) -> bool:
    return bool(user is not None and getattr(user, "is_public", False))


def download_token_ttl(user: User | None) -> timedelta:
    """How long a freshly-minted download token stays valid for this user."""
    if is_public_user(user):
        return timedelta(hours=settings.PUBLIC_HISTORY_RETENTION_HOURS)
    return timedelta(days=settings.MEMBER_DOWNLOAD_TTL_DAYS)


def delete_file_after_download(user: User | None) -> bool:
    """Public downloads are wiped right after streaming; members keep theirs."""
    return is_public_user(user)


def as_utc(dt: datetime | None) -> datetime | None:
    """SQLite stores DateTime(timezone=True) as naïve UTC — normalize so we can
    compare against timezone-aware ``now`` without crashing."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def safe_delete_file(file_path: str | None) -> bool:
    """Delete a downloaded file, but only if it lives under DOWNLOAD_DIR.

    Returns True if a file was actually removed. Never raises — cleanup is
    best-effort.
    """
    if not file_path:
        return False
    try:
        path = Path(file_path).resolve()
        download_root = Path(settings.DOWNLOAD_DIR).resolve()
        try:
            path.relative_to(download_root)
        except ValueError:
            logger.warning("refusing to delete %s: outside DOWNLOAD_DIR", path)
            return False
        if path.is_file():
            path.unlink()
            return True
    except Exception as exc:  # pragma: no cover - best-effort
        logger.warning("file delete failed for %s: %s", file_path, exc)
    return False
