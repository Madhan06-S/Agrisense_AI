from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from fastapi import APIRouter, Response
import logging

logger = logging.getLogger(__name__)

# Counters
TOTAL_FETCHES = Counter(
    "pipeline_fetches_total",
    "Total count of satellite fetches",
    ["satellite", "status"]  # status: success, failed
)

# Histograms
FETCH_DURATION = Histogram(
    "pipeline_fetch_duration_seconds",
    "Time taken to fetch satellite data from GEE in seconds"
)
PREPROCESS_DURATION = Histogram(
    "pipeline_preprocessing_duration_seconds",
    "Time taken to preprocess satellite images in seconds"
)

# Gauges
QUEUE_DEPTH = Gauge(
    "pipeline_queue_depth",
    "Current depth of the Celery task pipeline queue"
)
ACTIVE_WORKERS = Gauge(
    "pipeline_active_workers",
    "Number of active Celery workers processing tasks"
)

def update_celery_gauges():
    """Dynamically queries Redis and Celery to update queue metrics."""
    try:
        from app.tasks.celery_app import celery
        inspector = celery.control.inspect()
        active = inspector.active()
        if active:
            ACTIVE_WORKERS.set(sum(len(tasks) for tasks in active.values()))
        else:
            ACTIVE_WORKERS.set(0)
    except Exception as e:
        logger.warning(f"Could not inspect Celery active workers: {e}")

    try:
        import redis
        from app.core.config import settings
        r = redis.Redis.from_url(settings.REDIS_URL)
        # Check depth of the default Celery queue
        depth = r.llen("celery")
        QUEUE_DEPTH.set(depth)
    except Exception as e:
        logger.warning(f"Could not check Redis queue depth: {e}")

def get_metrics_data() -> bytes:
    update_celery_gauges()
    return generate_latest()

router = APIRouter()

@router.get("/metrics")
async def metrics_endpoint():
    return Response(content=get_metrics_data(), media_type=CONTENT_TYPE_LATEST)
