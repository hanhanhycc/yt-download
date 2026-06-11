from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # The single reserved account that owns all anonymous/public downloads.
    # Public jobs get the short (4h) retention tier; everyone else is a member.
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Per-user quota overrides (nullable -> use system defaults)
    daily_job_quota: Mapped[int | None] = mapped_column(Integer, nullable=True)
    concurrent_jobs: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    jobs = relationship("DownloadJob", back_populates="user", cascade="all, delete-orphan")
