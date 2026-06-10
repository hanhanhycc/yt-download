from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # General
    PROJECT_NAME: str = "yt-download"
    ENVIRONMENT: str = "production"
    LOG_LEVEL: str = "INFO"

    # Security
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # When false (default), the app is open — no login needed and all
    # actions run as the admin user. Set true to require login (recommended
    # if you expose the app to the internet).
    AUTH_REQUIRED: bool = False

    # Public URL (used to build download links returned to clients/bots).
    # For a NAS this is typically http://<nas-ip>:8000.
    PUBLIC_BASE_URL: str = "http://localhost:8000"

    # CORS — single-container serves the UI from the same origin, so this is
    # only relevant for external API/bot clients. Empty => allow any.
    CORS_ORIGINS: str = ""

    # Admin bootstrap
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin"
    ADMIN_EMAIL: str = "admin@example.com"
    # When true, the configured admin's password is reset from ADMIN_PASSWORD
    # on every boot (recover a lost password with just env + restart).
    ADMIN_RESET_ON_BOOT: bool = False

    # Database — SQLite file inside the data volume. No external DB needed.
    DATABASE_URL: str = "sqlite:////data/app.db"

    # Storage / job limits
    DOWNLOAD_DIR: str = "/data/downloads"
    MAX_FILE_SIZE_MB: int = 4096
    JOB_TIMEOUT_SECONDS: int = 3600
    # How many downloads run at once (in-process thread pool).
    DOWNLOAD_CONCURRENCY: int = 2

    # Quotas
    DEFAULT_DAILY_JOB_QUOTA: int = 1000
    DEFAULT_CONCURRENT_JOBS: int = 3
    DOWNLOAD_TOKEN_TTL_SECONDS: int = 86400

    # URL filtering
    ALLOWED_DOMAINS: str = ""
    BLOCKED_DOMAINS: str = "localhost,127.0.0.1,0.0.0.0,169.254.169.254"

    # Bot
    BOT_API_KEY: str = "change-me-bot-key"

    # yt-dlp cookies — used to get past YouTube's "Sign in to confirm you're
    # not a bot" on datacenter/NAS IPs. Provide ONE of:
    #   YTDLP_COOKIES_FILE    path to a mounted Netscape cookies.txt
    #   YTDLP_COOKIES_B64     base64 of a cookies.txt (robust through env vars)
    #   YTDLP_COOKIES_CONTENT raw cookies.txt text (needs a multiline env var)
    YTDLP_COOKIES_FILE: str = ""
    YTDLP_COOKIES_B64: str = ""
    YTDLP_COOKIES_CONTENT: str = ""

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
