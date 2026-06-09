from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # General
    PROJECT_NAME: str = "yt-download"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # Security
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Public URL (used to build download links returned to clients/bots)
    PUBLIC_BASE_URL: str = "http://localhost:8000"

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"

    # Admin bootstrap
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin"
    ADMIN_EMAIL: str = "admin@example.com"

    # Database
    DATABASE_URL: str = "postgresql+psycopg2://ytdl:ytdl@db:5432/ytdl"

    # Redis / Celery
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # Storage / job limits
    DOWNLOAD_DIR: str = "/data/downloads"
    MAX_FILE_SIZE_MB: int = 2048
    JOB_TIMEOUT_SECONDS: int = 3600

    # Quotas
    DEFAULT_DAILY_JOB_QUOTA: int = 50
    DEFAULT_CONCURRENT_JOBS: int = 3
    DOWNLOAD_TOKEN_TTL_SECONDS: int = 86400

    # URL filtering
    ALLOWED_DOMAINS: str = ""
    BLOCKED_DOMAINS: str = "localhost,127.0.0.1,0.0.0.0,169.254.169.254"

    # Bot
    BOT_API_KEY: str = "change-me-bot-key"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def allowed_domains_list(self) -> List[str]:
        return [d.strip().lower() for d in self.ALLOWED_DOMAINS.split(",") if d.strip()]

    @property
    def blocked_domains_list(self) -> List[str]:
        return [d.strip().lower() for d in self.BLOCKED_DOMAINS.split(",") if d.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
