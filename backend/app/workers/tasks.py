"""Download worker: run yt-dlp and stream progress back to the DB.

In the single-container build this runs on an in-process thread pool (see
runner.py) instead of Celery. Progress is written to the DB; the SSE
endpoint reads it by polling (no Redis).
"""
from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from yt_dlp import YoutubeDL

from app.config import settings
from app.core.security import generate_download_token
from app.database import SessionLocal
from app.models.job import DownloadJob, JobStatus
from app.services.storage_service import user_dir
from app.services.ytdlp_service import build_ydl_opts
from app.workers.runner import clear_cancel, is_canceled

logger = logging.getLogger(__name__)


class _Canceled(Exception):
    pass


def _update_job_progress(job_id: int, payload: dict) -> None:
    db = SessionLocal()
    try:
        job = db.get(DownloadJob, job_id)
        if not job:
            return
        if "progress" in payload:
            job.progress = float(payload["progress"])
        if "eta" in payload:
            job.eta_seconds = payload.get("eta")
        if "speed" in payload:
            job.speed_bps = int(payload["speed"]) if payload.get("speed") else None
        db.commit()
    except Exception as exc:  # pragma: no cover
        logger.warning("progress update failed: %s", exc)
        db.rollback()
    finally:
        db.close()


def _make_progress_hook(job_id: int):
    last_update = [0.0]

    def hook(d: dict) -> None:
        if is_canceled(job_id):
            raise _Canceled()
        now = time.time()
        status = d.get("status")
        if status == "downloading":
            if now - last_update[0] < 0.5:
                return
            last_update[0] = now
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes") or 0
            pct = (downloaded / total * 100) if total else 0.0
            _update_job_progress(
                job_id,
                {"progress": round(pct, 2), "eta": d.get("eta"), "speed": d.get("speed")},
            )
        elif status == "finished":
            _update_job_progress(job_id, {"progress": 99.0, "eta": 0, "speed": None})

    return hook


def run_download(job_id: int) -> None:
    db = SessionLocal()
    try:
        job: DownloadJob | None = db.get(DownloadJob, job_id)
        if job is None:
            return

        if is_canceled(job_id):
            job.status = JobStatus.CANCELED
            job.finished_at = datetime.now(timezone.utc)
            db.commit()
            clear_cancel(job_id)
            return

        job.status = JobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc)
        db.commit()

        out_dir = user_dir(job.user_id)
        opts = build_ydl_opts(
            output_dir=str(out_dir),
            fmt=job.format.value if hasattr(job.format, "value") else str(job.format),
            quality=job.quality,
            format_id=job.format_id,
            progress_hook=_make_progress_hook(job.id),
        )

        try:
            with YoutubeDL(opts) as ydl:
                info = ydl.extract_info(job.url, download=True)
            filename = _resolve_final_filename(info, opts)
            size = os.path.getsize(filename) if filename and os.path.exists(filename) else None

            job.file_path = filename
            job.file_size = size
            job.title = info.get("title") or job.title
            job.thumbnail = info.get("thumbnail") or job.thumbnail
            job.duration_seconds = info.get("duration") or job.duration_seconds
            job.download_token = generate_download_token()
            job.token_expires_at = datetime.now(timezone.utc) + timedelta(
                seconds=settings.DOWNLOAD_TOKEN_TTL_SECONDS
            )
            job.status = JobStatus.COMPLETED
            job.progress = 100.0
            job.finished_at = datetime.now(timezone.utc)
            db.commit()
        except _Canceled:
            job.status = JobStatus.CANCELED
            job.finished_at = datetime.now(timezone.utc)
            db.commit()
        except Exception as exc:
            logger.exception("download failed for job %s", job_id)
            job.status = JobStatus.FAILED
            job.error = str(exc)[:2000]
            job.finished_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        clear_cancel(job_id)
        db.close()


def _resolve_final_filename(info: dict, opts: dict) -> str | None:
    """Try to find the actual on-disk filename after yt-dlp finishes."""
    rd = info.get("requested_downloads")
    if rd:
        fp = rd[0].get("filepath")
        if fp:
            if opts.get("postprocessors"):
                pp = opts["postprocessors"][0]
                if pp.get("key") == "FFmpegExtractAudio":
                    candidate = Path(fp).with_suffix(".mp3")
                    if candidate.exists():
                        return str(candidate)
            if Path(fp).exists():
                return fp
    out_dir = Path(opts["outtmpl"]).parent
    if out_dir.exists():
        files = sorted(out_dir.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True)
        if files:
            return str(files[0])
    return None
