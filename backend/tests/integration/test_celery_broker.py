import pytest
import redis
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport
from datetime import datetime
from app.main import app
from app.core.config import settings
from app.models.models import DataPipelineRun

@pytest.mark.real_broker
def test_redis_real_broker_connection():
    """
    Integration test for real Celery/Redis broker connection.
    Executes ping against Redis URL. Skips gracefully if broker is unreachable.
    """
    try:
        r = redis.Redis.from_url(settings.REDIS_URL, socket_timeout=2)
        pong = r.ping()
        assert pong is True
    except Exception as exc:
        pytest.skip(f"Real Redis/Celery broker not accessible at {settings.REDIS_URL}: {exc}")

@pytest.mark.real_broker
def test_real_broker_queue_depth_inspection():
    """
    Verifies that satellite_pipeline and celery queue depth metrics can be queried.
    """
    try:
        r = redis.Redis.from_url(settings.REDIS_URL, socket_timeout=2)
        r.ping()
        depth_sat = r.llen("satellite_pipeline")
        depth_cel = r.llen("celery")
        assert depth_sat >= 0
        assert depth_cel >= 0
    except Exception as exc:
        pytest.skip(f"Real broker unavailable: {exc}")

@pytest.mark.anyio
async def test_pipeline_retry_broker_failure_handling(db_session):
    """
    Verifies that pipeline retry returns HTTP 503 when the Celery broker is unavailable
    and does NOT commit state changes to the database.
    """
    # 1. Create a failed run
    run = DataPipelineRun(
        farm_id=1,
        run_type="pipeline",
        status="FAILED",
        started_at=datetime.utcnow(),
        error_log="Initial GEE quota error"
    )
    db_session.add(run)
    await db_session.commit()
    await db_session.refresh(run)

    # 2. Patch Celery delay to simulate broker offline error
    with patch("app.api.v1.endpoints.pipeline.fetch_satellite_data.delay") as mock_delay:
        mock_delay.side_effect = Exception("ConnectionRefusedError: Celery broker offline")
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(f"/api/v1/pipeline/retry/{run.id}")
            assert res.status_code == 503
            assert "broker is currently unavailable" in res.json().get("detail", "")

    # 3. Reload run and verify status remained FAILED (no state mutation on broker failure)
    await db_session.refresh(run)
    assert run.status == "FAILED"
