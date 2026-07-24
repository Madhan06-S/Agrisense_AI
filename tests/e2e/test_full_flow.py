import pytest
import httpx
from httpx import AsyncClient
from datetime import date
from unittest.mock import patch, MagicMock
from app.main import app
from app.core.database import get_db
from app.models.models import Farm, SatelliteImage, FeatureVector, DataPipelineRun, DatasetVersion
from app.pipeline.orchestrator import PipelineOrchestrator
from app.catalog.versioning import create_version, rollback_to_version
from app.catalog.metadata_store import query_images_metadata
from sqlalchemy import select

@pytest.mark.asyncio
async def test_full_e2e_pipeline_and_catalog_flow(db_session):
    # Override get_db to point to local testing session
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db

    transport = httpx.ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        
        # 1. Farmer registers a farm boundary (Polygon, closed, area > 0.1 ha)
        payload = {
            "name": "E2E Punjab Farm",
            "crop_type": "Wheat",
            "sowing_date": "2026-06-01",
            "insurance_policy_number": "POL-999111",
            "khasra_number": "812/5",
            "state": "Punjab",
            "district": "Patiala",
            "taluka": "Nabha",
            "village": "Alohran",
            "boundary": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [76.10, 30.35],
                        [76.12, 30.35],
                        [76.12, 30.37],
                        [76.10, 30.37],
                        [76.10, 30.35]
                    ]
                ]
            }
        }
        
        reg_response = await ac.post("/api/v1/farms/", json=payload)
        assert reg_response.status_code == 201, reg_response.text
        farm_data = reg_response.json()
        farm_id = farm_data["id"]
        assert farm_data["area_hectares"] > 0.1

        # 2. Trigger Satellite Fetch pipeline (initiates state machine IDLE -> FETCHING)
        fetch_response = await ac.post(
            f"/api/v1/satellite/fetch?farm_id={farm_id}&start_date=2026-07-01&end_date=2026-07-24"
        )
        assert fetch_response.status_code == 202
        fetch_data = fetch_response.json()
        run_id = fetch_data["pipeline_run_id"]
        
        # Verify run is registered in DB in pending/fetching
        stmt = select(DataPipelineRun).where(DataPipelineRun.id == run_id)
        res = await db_session.execute(stmt)
        run_record = res.scalars().first()
        assert run_record is not None
        assert run_record.farm_id == farm_id

        # 3. Simulate Pipeline Executions (Fetch -> Preprocess -> Reconstruct -> Features)
        # Verify state machine transitions
        await PipelineOrchestrator.transition_state(db_session, run_id, "FETCHING")
        await PipelineOrchestrator.transition_state(db_session, run_id, "PREPROCESSING")
        await PipelineOrchestrator.transition_state(db_session, run_id, "RECONSTRUCTING")
        await PipelineOrchestrator.transition_state(db_session, run_id, "FEATURE_ENGINEERING")
        await PipelineOrchestrator.transition_state(db_session, run_id, "COMPLETED")
        
        # Add a mock processed image to the database
        db_img = SatelliteImage(
            farm_id=farm_id,
            source="sentinel-2",
            acquisition_date=date(2026, 7, 15),
            file_path="farm-1/sentinel-2/2026-07-15/bands_processed.tif",
            cloud_cover=12.0,
            resolution=10.0,
            crs="EPSG:4326",
            is_processed=True,
            extra_metadata={
                "processing_level": "L2A",
                "quality_metrics": {
                    "composite": 88.0,
                    "geometric": 100.0,
                    "radiometric": 100.0,
                    "cloud": 88.0,
                    "temporal": 100.0
                }
            }
        )
        db_session.add(db_img)
        await db_session.commit()
        await db_session.refresh(db_img)

        # 4. Check image metadata catalog and quality trend API
        catalog_response = await ac.get(f"/api/v1/catalog/images?farm_id={farm_id}")
        assert catalog_response.status_code == 200
        images_list = catalog_response.json()
        assert len(images_list) >= 1
        assert images_list[0]["satellite"] == "sentinel-2"

        quality_response = await ac.get(f"/api/v1/quality/{farm_id}/score")
        assert quality_response.status_code == 200
        quality_data = quality_response.json()
        assert len(quality_data) >= 1
        assert quality_data[0]["quality_score"] == 88.0

        # 5. Check semantic data versioning snapshot & rollback
        ver_create_response = await ac.post("/api/v1/catalog/versions?version_tag=v1.0.0&commit_hash=abcdef123")
        assert ver_create_response.status_code == 200
        
        # Verify version is saved
        ver_list_res = await ac.get("/api/v1/catalog/versions")
        assert ver_list_res.status_code == 200
        versions = ver_list_res.json()
        assert len(versions) == 1
        assert versions[0]["version"] == "v1.0.0"

        # Rollback check
        rollback_response = await ac.post("/api/v1/catalog/versions/v1.0.0/rollback")
        assert rollback_response.status_code == 200
        assert rollback_response.json()["status"] == "success"

    app.dependency_overrides.clear()
