"""FastAPI application entry point (single-container build).

Serves the REST API and, in production, the statically-exported frontend
from the same origin. The database schema is created on startup (SQLite,
no migrations) and downloads run on an in-process thread pool.
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func

from app.api import auth, bot, files, jobs, metadata
from app.config import settings
from app.core.security import hash_password
from app.core.url_validator import ensure_dir
from app.database import Base, SessionLocal, engine
from app.models import job as _job_model  # noqa: F401  (register tables)
from app.models.user import User

logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)

WEB_DIR = os.environ.get("WEB_DIR", "/app/web")


def _init_db() -> None:
    # Make sure the SQLite file's directory exists, then create tables.
    db_url = settings.DATABASE_URL
    if db_url.startswith("sqlite"):
        path = db_url.split("sqlite:///", 1)[-1]
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)
    Base.metadata.create_all(bind=engine)


def _bootstrap_admin() -> None:
    """Ensure the configured admin user exists.

    Creates it from ADMIN_* env vars if missing, or resets its password
    from ADMIN_PASSWORD when ADMIN_RESET_ON_BOOT is true.
    """
    db = SessionLocal()
    try:
        admin = (
            db.query(User)
            .filter(func.lower(User.username) == settings.ADMIN_USERNAME.strip().lower())
            .first()
        )
        if admin is None:
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
        elif settings.ADMIN_RESET_ON_BOOT:
            admin.hashed_password = hash_password(settings.ADMIN_PASSWORD)
            admin.is_active = True
            admin.is_admin = True
            db.commit()
            logger.info(
                "Reset admin password for '%s' (ADMIN_RESET_ON_BOOT=true)",
                settings.ADMIN_USERNAME,
            )
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_dir(settings.DOWNLOAD_DIR)
    _init_db()
    try:
        _bootstrap_admin()
    except Exception as exc:  # pragma: no cover
        logger.warning("admin bootstrap skipped: %s", exc)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Self-hosted yt-dlp service (single-container build).",
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


@app.get("/api/config", tags=["meta"])
def public_config():
    """Public, unauthenticated UI config."""
    return {"auth_required": settings.AUTH_REQUIRED}


app.include_router(auth.router)
app.include_router(metadata.router)
app.include_router(jobs.router)
app.include_router(files.router)
app.include_router(bot.router)

# Serve the statically-exported frontend from the same origin. Mounted LAST
# so it only catches paths the API routers above didn't claim. html=True
# serves index.html for directory routes (/, /login/, /history/).
if os.path.isdir(WEB_DIR):
    app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
else:  # pragma: no cover - dev without a built frontend
    logger.warning("frontend dir %s not found; serving API only", WEB_DIR)
