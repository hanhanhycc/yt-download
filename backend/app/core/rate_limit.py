"""Lightweight Redis-backed rate limiter and quota helpers.

Used to throttle expensive endpoints (metadata, job creation) and to
enforce per-user daily job quotas. Designed to be cheap and best-effort:
if Redis is unavailable, calls fall open (logged warning) so the app
keeps working for the personal-use MVP case.
"""
from __future__ import annotations

import logging
import time
from typing import Optional

import redis

from app.config import settings

logger = logging.getLogger(__name__)

_redis_client: Optional[redis.Redis] = None


def get_redis() -> Optional[redis.Redis]:
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
            _redis_client.ping()
        except Exception as exc:  # pragma: no cover - infra failure
            logger.warning("redis unavailable: %s", exc)
            _redis_client = None
    return _redis_client


def check_rate_limit(key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
    """Sliding-fixed-window limiter. Returns (allowed, remaining)."""
    r = get_redis()
    if r is None:
        return True, limit
    bucket = int(time.time()) // window_seconds
    redis_key = f"rl:{key}:{bucket}"
    try:
        count = r.incr(redis_key)
        if count == 1:
            r.expire(redis_key, window_seconds)
        remaining = max(0, limit - int(count))
        return int(count) <= limit, remaining
    except Exception as exc:  # pragma: no cover
        logger.warning("rate limit failure: %s", exc)
        return True, limit


def increment_daily_quota(user_id: int) -> int:
    """Increment today's job counter for the user. Returns new count."""
    r = get_redis()
    if r is None:
        return 0
    day = time.strftime("%Y%m%d", time.gmtime())
    key = f"quota:daily:{user_id}:{day}"
    try:
        count = r.incr(key)
        if count == 1:
            r.expire(key, 60 * 60 * 26)
        return int(count)
    except Exception as exc:  # pragma: no cover
        logger.warning("quota incr failure: %s", exc)
        return 0


def get_daily_quota(user_id: int) -> int:
    r = get_redis()
    if r is None:
        return 0
    day = time.strftime("%Y%m%d", time.gmtime())
    key = f"quota:daily:{user_id}:{day}"
    try:
        val = r.get(key)
        return int(val) if val else 0
    except Exception:  # pragma: no cover
        return 0
