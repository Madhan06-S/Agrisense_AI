import pytest
import httpx
from httpx import AsyncClient
from app.main import app
from app.core.database import get_db
from app.models.farm import Farm
from app.core.security import get_current_user
from app.models.user import User

@pytest.mark.asyncio
async def test_telemetry_and_copilot_consistency(db_session):
    """
    Test that GET /api/v1/farms/{farm_id}/telemetry and POST /api/v1/copilot/advise
    return 100% consistent telemetry values (NDVI and humidity).
    """
    async def override_get_db():
        yield db_session

    mock_user = User(id=1, phone="9876543210", role="farmer", full_name="Test Farmer")

    async def override_get_current_user():
        return mock_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    # Seed a farm in test DB
    farm = Farm(
        id=1,
        farmer_id=1,
        name="Test Telemetry Farm",
        crop_type="Rice",
        area_hectares=2.5
    )
    db_session.add(farm)
    await db_session.commit()

    transport = httpx.ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Fetch Unified Telemetry
        telemetry_res = await ac.get(f"/api/v1/farms/{farm.id}/telemetry")
        assert telemetry_res.status_code == 200
        telemetry_data = telemetry_res.json()
        
        card_ndvi = telemetry_data["satellite"]["ndvi"]
        card_humidity = telemetry_data["weather"]["humidity"]
        
        # 2. Fetch Copilot Advisory
        copilot_res = await ac.post("/api/v1/copilot/advise", json={"farm_id": farm.id, "prompt": "Check crop status"})
        assert copilot_res.status_code == 200
        copilot_data = copilot_res.json()
        
        context_summary = copilot_data.get("context_summary", "")
        top_advisory = copilot_data.get("advisories", [{}])[0].get("english", "")
        raw_text = copilot_data.get("raw_text", "")

        # The copilot summary/advisory prompt must reflect the exact same NDVI and humidity
        combined_copilot_text = f"{context_summary} {top_advisory} {raw_text}"
        
        # Verify exact numerical match or representation
        assert str(card_ndvi) in combined_copilot_text or f"NDVI: {card_ndvi}" in combined_copilot_text, (
            f"Mismatch! Telemetry card has NDVI={card_ndvi}, but copilot output lacks it: {combined_copilot_text}"
        )
        assert str(card_humidity) in combined_copilot_text or f"{card_humidity}%" in combined_copilot_text, (
            f"Mismatch! Telemetry card has humidity={card_humidity}, but copilot output lacks it: {combined_copilot_text}"
        )

    app.dependency_overrides.clear()
