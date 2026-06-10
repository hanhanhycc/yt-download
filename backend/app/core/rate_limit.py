"""In-process rate limiting and daily quota counters.

The single-container build has no Redis. These counters live in memory
(fine for a personal/NAS deployment running one process). They reset when
the container restarts. `get_redis()` is kept and always returns None so
the SSE endpoint transparently falls back to DB polling.
"""
from __future__ import annotations

import threading
import time
from typing import Optional

_lock = threading.Lock()
# key -> (window_bucket, count)
_rate_buckets: dict[str, tuple[int, int]] = {}
# (user_id, day) -> count
_daily: dict[tuple[int, str], int] = {}


def get_redis() -> Optional[object]:
    """No Redis in the single-container build (SSE falls back to polling)."""
    return None


def check_rate_limit(key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
    """Fixed-window limiter. Returns (allowed, remaining)."""
    bucket = int(time.time()) // window_seconds
    with _lock:
        cur_bucket, count = _rate_buckets.get(key, (bucket, 0))
        if cur_bucket != bucket:
            count = 0
        count += 1
        _rate_buckets[key] = (bucket, count)
    remaining = max(0, limit - count)
    return count <= limit, remaining


def _day() -> str:
    return time.strftime("%Y%m%d", time.gmtime())


def increment_daily_quota(user_id: int) -> int:
    key = (user_id, _day())
    with _lock:
        count = _daily.get(key, 0) + 1
        _daily[key] = count
    return count


def get_daily_quota(user_id: int) -> int:
    with _lock:
        return _daily.get((user_id, _day()), 0)
