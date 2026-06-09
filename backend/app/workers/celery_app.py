from celery import Celery

from app.config import settings

celery = Celery(
    "ytdownload",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.tasks"],
)

celery.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_time_limit=settings.JOB_TIMEOUT_SECONDS + 60,
    task_soft_time_limit=settings.JOB_TIMEOUT_SECONDS,
    worker_max_tasks_per_child=50,
    broker_connection_retry_on_startup=True,
    task_default_queue="downloads",
)
