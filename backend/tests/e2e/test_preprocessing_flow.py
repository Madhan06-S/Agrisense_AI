import pytest
import httpx
from httpx import AsyncClient
from datetime import date
from app.main import app
from app.core.database import get_db
from app.models.models import Farm, SatelliteImage, DataPipelineRun
from sqlalchemy import select

@pytest.mark.asyncio
async def test_full_preprocessing_e2e_flow(db_session):
    # Override database injection
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db

    transport = httpx.ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        
        # 1. Register farm boundary
        payload = {
            "name": "E2E Preprocessing Farm",
            "crop_type": "Maize",
            "sowing_date": "2026-06-10",
            "insurance_policy_number": "POL-PRE-88",
            "khasra_number": "142/2",
            "state": "Punjab",
            "district": "Patiala",
            "taluka": "Patiala",
            "village": "Sanaur",
            "boundary": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [76.35, 30.25],
                        [76.37, 30.25],
                        [76.37, 30.27],
                        [76.35, 30.27],
                        [76.35, 30.25]
                    ]
                ]
            }
        }
        
        reg_res = await ac.post("/api/v1/farms/", json=payload)
        assert reg_res.status_code == 201
        farm_data = reg_res.json()
        farm_id = farm_data["id"]

        # 2. Add an unprocessed S2 and S1 image to DB
        s2_img = SatelliteImage(
            farm_id=farm_id,
            source="sentinel-2",
            acquisition_date=date(2026, 7, 5),
            file_path="farm-1/s2/cloudy.tif",
            cloud_cover=82.0,
            resolution=10.0,
            crs="EPSG:4326",
            is_processed=False
        )
        db_session.add(s2_img)
        
        s1_img = SatelliteImage(
            farm_id=farm_id,
            source="sentinel-1",
            acquisition_date=date(2026, 7, 6),
            file_path="farm-1/s1/sar.tif",
            cloud_cover=0.0,
            resolution=10.0,
            crs="EPSG:4326",
            is_processed=False
        )
        db_session.add(s1_img)
        await db_session.commit()
        await db_session.refresh(s2_img)
        await db_session.refresh(s1_img)

        # 3. Call cloud-masking endpoint
        mask_res = await ac.post(f"/api/v1/preprocessing/cloud-mask?image_id={s2_img.id}")
        assert mask_res.status_code == 200
        assert mask_res.json()["status"] == "success"

        # 4. Call SAR preprocess endpoint
        sar_res = await ac.post(f"/api/v1/preprocessing/sar-preprocess?image_id={s1_img.id}")
        assert sar_res.status_code == 200
        assert sar_res.json()["status"] == "success"

        # 5. Call timeseries gap-filling interpolation endpoint
        interp_res = await ac.post(
            f"/api/v1/timeseries/{farm_id}/interpolate?start_date=2026-06-01&end_date=2026-07-24"
        )
        assert interp_res.status_code == 200
        assert interp_res.json()["status"] == "completed"
        assert "interpolation_ratio" in interp_res.json()

        # 6. Call gaps retrieval endpoint
        gaps_res = await ac.get(
            f"/api/v1/timeseries/{farm_id}/gaps?start_date=2026-06-01&end_date=2026-07-24"
        )
        assert gaps_res.status_code == 200
        assert gaps_res.json()["total_gaps"] >= 0

    app.dependency_overrides.clear()
