"""FastAPI application entry point."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, bot, files, jobs, metadata
from app.config import settings
from app.core.security import hash_password
from app.core.url_validator import ensure_dir
from app.database import SessionLocal
from app.models.user import User

logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


def _bootstrap_admin() -> None:
    """Create the initial admin user if no users exist."""
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            return
        admin = User(
            username=settings.ADMIN_USERNAME,
            email=settings.ADMIN_EMAIL,
            hashed_password=hash_password(settings.ADMIN_PASSWORD),
            is_active=True,
            is_admin=True,
        )
        db.add(admin)
        db.commit()
        logger.info("Created bootstrap admin user '%s'", settings.ADMIN_USERNAME)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_dir(settings.DOWNLOAD_DIR)
    try:
        _bootstrap_admin()
    except Exception as exc:  # pragma: no cover - DB not ready on first boot
        logger.warning("admin bootstrap skipped: %s", exc)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    description=(
        "Self-hosted yt-dlp service. Provides a REST API for media downloads "
        "(MP4/MP3), real-time progress, user accounts, and a bot/AI integration "
        "interface."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "service": settings.PROJECT_NAME}


app.include_router(auth.router)
app.include_router(metadata.router)
app.include_router(jobs.router)
app.include_router(files.router)
app.include_router(bot.router)
