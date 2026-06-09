"""Local storage helpers. The storage root is configurable; per-user
sub-directories isolate files and make later multi-user cleanup easier.
"""
from __future__ import annotations

from pathlib import Path

from app.config import settings
from app.core.url_validator import ensure_dir, safe_join


def user_dir(user_id: int) -> Path:
    """Return (and create) the storage directory for a user."""
    base = ensure_dir(settings.DOWNLOAD_DIR)
    p = base / f"user_{user_id}"
    p.mkdir(parents=True, exist_ok=True)
    return p


def resolve_file(user_id: int, filename: str) -> Path:
    """Resolve a file path under a user's directory, blocking traversal."""
    return safe_join(str(user_dir(user_id)), filename)
