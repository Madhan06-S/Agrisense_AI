import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import get_db


@pytest.mark.asyncio
async def test_insurance_schemes_endpoint(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/insurance/schemes")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        codes = [s["code"] for s in data]
        assert "PMFBY" in codes
        assert "RWBCIS" in codes


@pytest.mark.asyncio
async def test_farm_policy_endpoint(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/insurance/policies/farm/1")
        assert response.status_code == 200
        data = response.json()
        assert "policy_number" in data
        assert "scheme_code" in data


@pytest.mark.asyncio
async def test_agrisense_risk_endpoint(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/insurance/risk/1")
        assert response.status_code == 200
        data = response.json()
        assert "risk_assessment" in data
        assert "recommended_action" in data["risk_assessment"]


@pytest.mark.asyncio
async def test_parametric_evaluate_endpoint(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "farm_id": 1,
            "parameter": "rainfall"
        }
        response = await ac.post("/api/v1/insurance/parametric/evaluate", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["scheme"] == "RWBCIS"
        assert "status" in data
