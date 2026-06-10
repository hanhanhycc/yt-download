"""In-process download runner.

Replaces Celery/Redis for the single-container build. Downloads run on a
bounded thread pool; jobs submitted beyond the limit queue until a slot
frees up. Cancellation is cooperative: the progress hook checks a flag.
"""
from __future__ import annotations

import logging
import threading
from concurrent.futures import ThreadPoolExecutor

from app.config import settings

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(
    max_workers=max(1, settings.DOWNLOAD_CONCURRENCY),
    thread_name_prefix="dl",
)

_cancel_lock = threading.Lock()
_canceled: set[int] = set()


def submit_download(job_id: int) -> None:
    """Queue a job for background download."""
    # Imported here to avoid a circular import at module load.
    from app.workers.tasks import run_download

    _executor.submit(run_download, job_id)


def request_cancel(job_id: int) -> None:
    with _cancel_lock:
        _canceled.add(job_id)


def is_canceled(job_id: int) -> bool:
    with _cancel_lock:
        return job_id in _canceled


def clear_cancel(job_id: int) -> None:
    with _cancel_lock:
        _canceled.discard(job_id)
