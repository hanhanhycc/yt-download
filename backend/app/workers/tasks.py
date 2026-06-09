"""Celery tasks: run yt-dlp downloads and stream progress back to DB + Redis."""
from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from celery.exceptions import SoftTimeLimitExceeded
from yt_dlp import YoutubeDL

from app.config import settings
from app.core.rate_limit import get_redis
from app.core.security import generate_download_token
from app.database import SessionLocal
from app.models.job import DownloadJob, JobStatus
from app.services.storage_service import user_dir
from app.services.ytdlp_service import build_ydl_opts
from app.workers.celery_app import celery

logger = logging.getLogger(__name__)


def _publish_progress(job_id: int, payload: dict) -> None:
    """Push a progress event to a Redis pub/sub channel (best-effort)."""
    r = get_redis()
    if r is None:
        return
    try:
        r.publish(f"job:{job_id}:progress", json.dumps(payload))
        r.setex(f"job:{job_id}:last", 300, json.dumps(payload))
    except Exception as exc:  # pragma: no cover
        logger.warning("redis publish failed: %s", exc)


def _make_progress_hook(job_id: int):
    last_update = [0.0]

    def hook(d: dict) -> None:
        now = time.time()
        status = d.get("status")
        if status == "downloading":
            # throttle to ~2 updates/sec
            if now - last_update[0] < 0.5:
                return
            last_update[0] = now
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes") or 0
            pct = (downloaded / total * 100) if total else 0.0
            payload = {
                "status": "running",
                "progress": round(pct, 2),
                "eta": d.get("eta"),
                "speed": d.get("speed"),
            }
            _publish_progress(job_id, payload)
            _update_job_progress(job_id, payload)
        elif status == "finished":
            payload = {"status": "running", "progress": 99.0, "eta": 0, "speed": None}
            _publish_progress(job_id, payload)
            _update_job_progress(job_id, payload)

    return hook


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


@celery.task(bind=True, name="app.workers.tasks.run_download")
def run_download(self, job_id: int) -> dict:
    db = SessionLocal()
    job: DownloadJob | None = db.get(DownloadJob, job_id)
    if job is None:
        return {"ok": False, "error": "job not found"}

    job.status = JobStatus.RUNNING
    job.started_at = datetime.now(timezone.utc)
    job.celery_task_id = self.request.id
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
        # Resolve final filename (after postprocessing for mp3)
        filename = _resolve_final_filename(info, opts)

        size = os.path.getsize(filename) if filename and os.path.exists(filename) else None
        token = generate_download_token()
        job.file_path = filename
        job.file_size = size
        job.title = info.get("title") or job.title
        job.thumbnail = info.get("thumbnail") or job.thumbnail
        job.duration_seconds = info.get("duration") or job.duration_seconds
        job.download_token = token
        job.token_expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=settings.DOWNLOAD_TOKEN_TTL_SECONDS
        )
        job.status = JobStatus.COMPLETED
        job.progress = 100.0
        job.finished_at = datetime.now(timezone.utc)
        db.commit()
        _publish_progress(job.id, {"status": "completed", "progress": 100.0})
        return {"ok": True, "file": filename, "token": token}

    except SoftTimeLimitExceeded:
        job.status = JobStatus.FAILED
        job.error = "job timed out"
        job.finished_at = datetime.now(timezone.utc)
        db.commit()
        _publish_progress(job.id, {"status": "failed", "error": job.error})
        return {"ok": False, "error": "timeout"}
    except Exception as exc:
        logger.exception("download failed for job %s", job.id)
        job.status = JobStatus.FAILED
        job.error = str(exc)[:2000]
        job.finished_at = datetime.now(timezone.utc)
        db.commit()
        _publish_progress(job.id, {"status": "failed", "error": job.error})
        return {"ok": False, "error": str(exc)}
    finally:
        db.close()


def _resolve_final_filename(info: dict, opts: dict) -> str | None:
    """Try to find the actual on-disk filename after yt-dlp finishes."""
    # yt-dlp puts the final path in 'requested_downloads' or 'filepath'
    rd = info.get("requested_downloads")
    if rd:
        fp = rd[0].get("filepath")
        if fp:
            # For mp3 post-processing, swap ext
            if opts.get("postprocessors"):
                pp = opts["postprocessors"][0]
                if pp.get("key") == "FFmpegExtractAudio":
                    p = Path(fp)
                    candidate = p.with_suffix(".mp3")
                    if candidate.exists():
                        return str(candidate)
            if Path(fp).exists():
                return fp
    # Fallback: best-effort glob from output template directory
    out_dir = Path(opts["outtmpl"]).parent
    if out_dir.exists():
        # newest file in dir
        files = sorted(out_dir.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True)
        if files:
            return str(files[0])
    return None
