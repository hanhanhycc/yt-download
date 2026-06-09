"""URL and filesystem path validation helpers.

Used to prevent SSRF (no localhost/private IPs unless explicitly allowed),
enforce allow/block lists, and prevent path traversal when serving files.
"""
from __future__ import annotations

import ipaddress
import os
from pathlib import Path
from urllib.parse import urlparse

from app.config import settings


class URLValidationError(ValueError):
    pass


_PRIVATE_HOST_NAMES = {"localhost", "ip6-localhost", "ip6-loopback"}


def _host_is_private(host: str) -> bool:
    host = host.strip().lower()
    if not host:
        return True
    if host in _PRIVATE_HOST_NAMES:
        return True
    # Try parse as IP
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def validate_url(raw_url: str) -> str:
    """Validate a user-submitted URL. Returns the normalized URL string.

    Raises URLValidationError on rejection.
    """
    if not raw_url or len(raw_url) > 2048:
        raise URLValidationError("URL is empty or too long")

    parsed = urlparse(raw_url.strip())
    if parsed.scheme not in {"http", "https"}:
        raise URLValidationError("Only http(s) URLs are allowed")
    if not parsed.netloc:
        raise URLValidationError("URL has no host")

    host = (parsed.hostname or "").lower()
    if not host:
        raise URLValidationError("URL has no host")

    if _host_is_private(host):
        raise URLValidationError("Private/loopback hosts are not allowed")

    blocked = settings.blocked_domains_list
    for b in blocked:
        if host == b or host.endswith("." + b):
            raise URLValidationError(f"Domain '{host}' is blocked")

    allowed = settings.allowed_domains_list
    if allowed:
        if not any(host == a or host.endswith("." + a) for a in allowed):
            raise URLValidationError(f"Domain '{host}' is not in allow list")

    return parsed.geturl()


def safe_join(base_dir: str, *paths: str) -> Path:
    """Join `paths` to `base_dir` ensuring the result stays inside base_dir.

    Prevents path-traversal attacks (..).
    """
    base = Path(base_dir).resolve()
    target = base.joinpath(*paths).resolve()
    try:
        target.relative_to(base)
    except ValueError as exc:
        raise URLValidationError("path traversal detected") from exc
    return target


def ensure_dir(path: str | os.PathLike) -> Path:
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p
