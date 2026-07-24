import os
from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery = Celery(
    "agrisense_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.satellite_tasks"]
)

# Custom configuration settings
celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=False,
    task_track_started=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_routes={
        "app.tasks.satellite_tasks.*": {"queue": "satellite_pipeline"},
    },
    task_default_queue="default",
)

# Schedule the pipeline scheduler daily at 6:00 AM IST
celery.conf.beat_schedule = {
    "daily-pipeline-scheduler": {
        "task": "app.tasks.satellite_tasks.pipeline_scheduler",
        "schedule": crontab(hour=6, minute=0),
    }
}

# Support synchronous task execution for testing/sandbox environments
if os.environ.get("CELERY_ALWAYS_EAGER") == "true" or os.environ.get("PYTEST_CURRENT_TEST"):
    celery.conf.update(
        task_always_eager=True,
        task_eager_propagates=True
    )
