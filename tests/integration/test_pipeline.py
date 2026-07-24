import pytest
import os
import asyncio
from unittest.mock import patch, MagicMock
from datetime import datetime, date, timedelta
from shapely.geometry import Polygon
from geoalchemy2.shape import from_shape
from sqlalchemy import select

from app.models.models import Farm, SatelliteImage, FeatureVector, DataPipelineRun
from app.pipeline.orchestrator import PipelineOrchestrator, PipelineStateError
from app.pipeline.retry_policy import GEEQuotaError, NetworkError, InvalidDataError
from app.pipeline.validators import validate_geojson, validate_date_range, validate_satellite_availability
from app.tasks.satellite_tasks import fetch_satellite_data, preprocess_images, reconstruct_cloudy_images, generate_feature_cube

@pytest.mark.asyncio
async def test_pipeline_state_transitions(db_session):
    # Test valid transitions: IDLE -> FETCHING -> PREPROCESSING -> RECONSTRUCTING -> FEATURE_ENGINEERING -> COMPLETED
    run = await PipelineOrchestrator.create_run(db_session, 1)
    assert run.status == "IDLE"
    
    run = await PipelineOrchestrator.transition_state(db_session, run.id, "FETCHING")
    assert run.status == "FETCHING"
    
    run = await PipelineOrchestrator.transition_state(db_session, run.id, "PREPROCESSING")
    assert run.status == "PREPROCESSING"
    
    run = await PipelineOrchestrator.transition_state(db_session, run.id, "RECONSTRUCTING")
    assert run.status == "RECONSTRUCTING"
    
    run = await PipelineOrchestrator.transition_state(db_session, run.id, "FEATURE_ENGINEERING")
    assert run.status == "FEATURE_ENGINEERING"
    
    run = await PipelineOrchestrator.transition_state(db_session, run.id, "COMPLETED")
    assert run.status == "COMPLETED"

    # Test invalid transition: can't skip states (e.g. IDLE -> FEATURE_ENGINEERING)
    run2 = await PipelineOrchestrator.create_run(db_session, 1)
    with pytest.raises(PipelineStateError):
        await PipelineOrchestrator.transition_state(db_session, run2.id, "FEATURE_ENGINEERING")

@pytest.mark.asyncio
async def test_pipeline_timeout_handling(db_session):
    # Create run that hung 40 mins ago
    hung_time = datetime.utcnow() - timedelta(minutes=40)
    
    run = DataPipelineRun(
        farm_id=1,
        run_type="pipeline",
        status="FETCHING",
        started_at=hung_time
    )
    db_session.add(run)
    await db_session.commit()
    
    # Run timeout checker using patched database session Local factory
    with patch("app.pipeline.orchestrator.AsyncSessionLocal") as mock_factory:
        # Define mock async session helper context manager
        class MockContextManager:
            async def __aenter__(self):
                return db_session
            async def __aexit__(self, exc_type, exc_val, exc_tb):
                pass
        mock_factory.return_value = MockContextManager()
        
        await PipelineOrchestrator.handle_timeouts()
    
    # Verify it transitioned to FAILED due to timeout
    res = await db_session.execute(select(DataPipelineRun).where(DataPipelineRun.id == run.id))
    run_loaded = res.scalars().first()
    assert run_loaded.status == "FAILED"
    assert "timed out" in run_loaded.error_log

def test_validators():
    # Valid GeoJSON
    valid_geojson = {
        "type": "Polygon",
        "coordinates": [
            [[76.96, 29.54], [76.98, 29.54], [76.98, 29.56], [76.96, 29.56], [76.96, 29.54]]
        ]
    }
    ok, err = validate_geojson(valid_geojson)
    assert ok, f"Expected validation success: {err}"

    # Invalid self-intersecting polygon
    invalid_geojson = {
        "type": "Polygon",
        "coordinates": [
            [[76.96, 29.54], [76.98, 29.56], [76.98, 29.54], [76.96, 29.56], [76.96, 29.54]]
        ]
    }
    ok, err = validate_geojson(invalid_geojson)
    assert not ok
    assert "self-intersecting" in err.lower()

    # Area too small
    small_geojson = {
        "type": "Polygon",
        "coordinates": [
            [[76.96, 29.5400], [76.9601, 29.5400], [76.9601, 29.5401], [76.96, 29.5401], [76.96, 29.5400]]
        ]
    }
    ok, err = validate_geojson(small_geojson)
    assert not ok
    assert "too small" in err

    # Valid dates
    today_str = date.today().strftime("%Y-%m-%d")
    yesterday_str = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
    ok, err = validate_date_range(yesterday_str, today_str)
    assert ok

    # Future date
    future_str = (date.today() + timedelta(days=5)).strftime("%Y-%m-%d")
    ok, err = validate_date_range(yesterday_str, future_str)
    assert not ok

    # Satellite launch limits
    ok, err = validate_satellite_availability("sentinel-2", "2014-01-01", "2014-02-01")
    assert not ok
    assert "available starting from" in err
