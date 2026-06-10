"""Thin wrapper around yt-dlp.

Provides:
- `extract_metadata(url)`: returns a normalized metadata dict with formats.
- `build_ydl_opts(...)`: builds yt-dlp options for an actual download run.
"""
from __future__ import annotations

import base64
import logging
import os
from typing import Any, Callable

from yt_dlp import YoutubeDL

from app.config import settings

logger = logging.getLogger(__name__)

_COOKIES_PATH = "/tmp/yt_cookies.txt"


def _cookies_file() -> str | None:
    """Return a path to a Netscape cookies.txt for yt-dlp, or None.

    Lets us get past YouTube's "Sign in to confirm you're not a bot" on
    datacenter IPs. Priority: an explicit mounted file, then base64 env,
    then raw env content (written to a temp file).
    """
    explicit = settings.YTDLP_COOKIES_FILE.strip()
    if explicit and os.path.exists(explicit):
        return explicit

    b64 = settings.YTDLP_COOKIES_B64.strip()
    if b64:
        try:
            with open(_COOKIES_PATH, "wb") as fh:
                fh.write(base64.b64decode(b64))
            return _COOKIES_PATH
        except Exception as exc:  # pragma: no cover - bad input
            logger.warning("could not decode YTDLP_COOKIES_B64: %s", exc)

    content = settings.YTDLP_COOKIES_CONTENT
    if content.strip():
        try:
            with open(_COOKIES_PATH, "w", encoding="utf-8") as fh:
                fh.write(content)
            return _COOKIES_PATH
        except OSError as exc:  # pragma: no cover
            logger.warning("could not write YTDLP_COOKIES_CONTENT: %s", exc)

    return None


_QUALITY_TO_HEIGHT = {
    "best": None,
    "2160": 2160,
    "1440": 1440,
    "1080": 1080,
    "720": 720,
    "480": 480,
    "360": 360,
    "240": 240,
}

_MP3_BITRATES = {"320", "256", "192", "128", "96"}


def _format_filter(quality: str | None) -> str:
    """Build a yt-dlp format selector for MP4 with quality cap."""
    if not quality or quality == "best":
        return "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best"
    height = _QUALITY_TO_HEIGHT.get(str(quality))
    if height is None:
        return "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best"
    return (
        f"bv*[ext=mp4][height<={height}]+ba[ext=m4a]/"
        f"b[ext=mp4][height<={height}]/best[height<={height}]"
    )


def extract_metadata(url: str) -> dict[str, Any]:
    """Probe a URL with yt-dlp and return normalized metadata."""
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "extract_flat": False,
        "socket_timeout": 30,
    }
    cookies = _cookies_file()
    if cookies:
        ydl_opts["cookiefile"] = cookies
    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    if not info:
        raise RuntimeError("yt-dlp returned no metadata")

    formats = []
    for f in info.get("formats", []) or []:
        # only include playable formats
        if f.get("vcodec") == "none" and f.get("acodec") == "none":
            continue
        formats.append(
            {
                "format_id": str(f.get("format_id", "")),
                "ext": f.get("ext", ""),
                "resolution": f.get("resolution")
                or (f"{f.get('width')}x{f.get('height')}" if f.get("height") else None),
                "fps": f.get("fps"),
                "vcodec": f.get("vcodec"),
                "acodec": f.get("acodec"),
                "filesize": f.get("filesize") or f.get("filesize_approx"),
                "tbr": f.get("tbr"),
                "note": f.get("format_note"),
            }
        )

    return {
        "url": url,
        "title": info.get("title"),
        "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration"),
        "uploader": info.get("uploader") or info.get("channel"),
        "formats": formats,
    }


def build_ydl_opts(
    *,
    output_dir: str,
    fmt: str,
    quality: str | None,
    format_id: str | None,
    progress_hook: Callable[[dict[str, Any]], None] | None = None,
) -> dict[str, Any]:
    """Build a yt-dlp options dict for a download run."""
    common: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "restrictfilenames": True,
        "outtmpl": f"{output_dir}/%(title).200B-%(id)s.%(ext)s",
        "max_filesize": settings.MAX_FILE_SIZE_MB * 1024 * 1024,
        "socket_timeout": 30,
        "retries": 3,
        "fragment_retries": 3,
        "concurrent_fragment_downloads": 4,
        "progress_hooks": [progress_hook] if progress_hook else [],
    }

    cookies = _cookies_file()
    if cookies:
        common["cookiefile"] = cookies

    if fmt == "mp3":
        bitrate = quality if quality in _MP3_BITRATES else "192"
        common.update(
            {
                "format": "bestaudio/best",
                "postprocessors": [
                    {
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": "mp3",
                        "preferredquality": bitrate,
                    }
                ],
            }
        )
    else:
        # mp4
        if format_id:
            common["format"] = f"{format_id}+bestaudio/best"
        else:
            common["format"] = _format_filter(quality)
        common["merge_output_format"] = "mp4"

    return common
