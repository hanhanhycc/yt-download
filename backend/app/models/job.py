import enum
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"


class JobFormat(str, enum.Enum):
    MP4 = "mp4"
    MP3 = "mp3"


class DownloadJob(Base):
    __tablename__ = "download_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    source: Mapped[str] = mapped_column(String(32), default="web", nullable=False)  # web|bot|api

    url: Mapped[str] = mapped_column(Text, nullable=False)
    format: Mapped[JobFormat] = mapped_column(
        SAEnum(JobFormat, name="job_format"), nullable=False
    )
    quality: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # For mp4: format_id from yt-dlp when client picked a specific one
    format_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    status: Mapped[JobStatus] = mapped_column(
        SAEnum(JobStatus, name="job_status"), default=JobStatus.PENDING, nullable=False, index=True
    )
    progress: Mapped[float] = mapped_column(default=0.0, nullable=False)
    eta_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    speed_bps: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    download_token: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    celery_task_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="jobs")
