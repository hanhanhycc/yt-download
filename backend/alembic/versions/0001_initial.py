"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-09 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Recovery guard. Earlier broken runs of this initial migration could
    # fail mid-way WITHOUT stamping alembic_version, leaving stray objects
    # (e.g. the job_format enum) that made every re-run crash with
    # DuplicateObject. This is the first migration (down_revision=None), so
    # the target DB is meant to be empty — clear any leftovers to make the
    # migration safe to re-run on a partially-initialized database.
    op.execute("DROP TABLE IF EXISTS download_jobs CASCADE")
    op.execute("DROP TABLE IF EXISTS users CASCADE")
    op.execute("DROP TYPE IF EXISTS job_format")
    op.execute("DROP TYPE IF EXISTS job_status")

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(64), nullable=False, unique=True),
        sa.Column("email", sa.String(255), nullable=True, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("daily_job_quota", sa.Integer(), nullable=True),
        sa.Column("concurrent_jobs", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # create_type=False: we create the enum types explicitly below (with
    # checkfirst), so the later create_table() must NOT try to emit
    # CREATE TYPE again — otherwise it raises DuplicateObject even on a
    # fresh database.
    job_status = sa.Enum(
        "pending", "running", "completed", "failed", "canceled",
        name="job_status", create_type=False,
    )
    job_format = sa.Enum("mp4", "mp3", name="job_format", create_type=False)
    job_status.create(op.get_bind(), checkfirst=True)
    job_format.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "download_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source", sa.String(32), nullable=False, server_default="web"),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("format", job_format, nullable=False),
        sa.Column("quality", sa.String(32), nullable=True),
        sa.Column("format_id", sa.String(64), nullable=True),
        sa.Column("status", job_status, nullable=False, server_default="pending"),
        sa.Column("progress", sa.Float(), nullable=False, server_default="0"),
        sa.Column("eta_seconds", sa.Integer(), nullable=True),
        sa.Column("speed_bps", sa.BigInteger(), nullable=True),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("thumbnail", sa.Text(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("file_path", sa.Text(), nullable=True),
        sa.Column("file_size", sa.BigInteger(), nullable=True),
        sa.Column("download_token", sa.String(64), nullable=True, unique=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("celery_task_id", sa.String(64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_download_jobs_user_id", "download_jobs", ["user_id"])
    op.create_index("ix_download_jobs_status", "download_jobs", ["status"])
    op.create_index("ix_download_jobs_created_at", "download_jobs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_download_jobs_created_at", table_name="download_jobs")
    op.drop_index("ix_download_jobs_status", table_name="download_jobs")
    op.drop_index("ix_download_jobs_user_id", table_name="download_jobs")
    op.drop_table("download_jobs")
    sa.Enum(name="job_format").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="job_status").drop(op.get_bind(), checkfirst=True)
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
