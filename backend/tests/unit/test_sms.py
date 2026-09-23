import pytest
from app.services.sms_advisory import generate_sms_risk_advisory, generate_sms_copilot_response

class MockDB:
    async def execute(self, query):
        class DummyResult:
            def first(self):
                return ("Patel Rice Farm #1", "Rice")
        return DummyResult()

@pytest.mark.asyncio
async def test_sms_advisory_character_length_limit():
    """Verify that generated SMS advisories strictly respect character limits (<= 160 chars)."""
    db = MockDB()
    
    for lang in ["en-IN", "hi-IN", "ta-IN"]:
        res = await generate_sms_risk_advisory(
            mobile="+919876543210",
            farm_id=1,
            db=db,
            language=lang
        )
        assert res["status"] == "sent"
        assert len(res["message"]) <= 160, f"SMS message for {lang} exceeded 160 chars limit: {len(res['message'])}"

@pytest.mark.asyncio
async def test_sms_advisory_content_contains_ndvi_and_risk():
    """Verify that SMS advisory content includes key farm risk metrics (NDVI & weather rain)."""
    db = MockDB()
    res = await generate_sms_risk_advisory(
        mobile="+919876543210",
        farm_id=1,
        db=db,
        language="en-IN"
    )
    msg = res["message"]
    assert "NDVI" in msg
    assert "rain" in msg.lower() or "mm" in msg
    assert "AgriSense" in msg
