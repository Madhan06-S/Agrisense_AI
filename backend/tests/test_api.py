import pytest
import httpx
from httpx import AsyncClient
from datetime import date
from app.main import app
from app.core.database import get_db

@pytest.mark.asyncio
async def test_farms_api_crud_workflow(db_session):
    # Override get_db dependency to point to SQLite in-memory db_session
    async def override_get_db():
        yield db_session
        
    app.dependency_overrides[get_db] = override_get_db
    
    # Configure ASGI transport for newer HTTPX compatibility
    transport = httpx.ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Post a new farm polygon
        payload = {
            "name": "Test Paddy Fields",
            "crop_type": "Rice",
            "sowing_date": "2026-06-15",
            "insurance_policy_number": "INS-772819",
            "khasra_number": "223/4",
            "state": "Haryana",
            "district": "Karnal",
            "taluka": "Gharaunda",
            "village": "Basdhara",
            "boundary": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [76.96, 29.54],
                        [76.98, 29.54],
                        [76.98, 29.56],
                        [76.96, 29.56],
                        [76.96, 29.54]
                    ]
                ]
            }
        }
        
        response = await ac.post("/api/v1/farms/", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Paddy Fields"
        # Verify the area was calculated successfully and is positive
        assert data["area_hectares"] > 0
        farm_id = data["id"]
        
        # 2. Get farm details by ID
        response = await ac.get(f"/api/v1/farms/{farm_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Test Paddy Fields"
        
        # 3. List all farms
        response = await ac.get("/api/v1/farms/")
        assert response.status_code == 200
        assert len(response.json()) >= 1
        
        # 4. Search nearby farms
        response = await ac.get("/api/v1/farms/nearby?lat=29.55&lon=76.97")
        assert response.status_code == 200
        
        # 5. Delete farm
        response = await ac.delete(f"/api/v1/farms/{farm_id}")
        assert response.status_code == 204
        
    app.dependency_overrides.clear()
