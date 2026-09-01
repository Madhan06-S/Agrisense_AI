import pytest
from unittest.mock import patch, MagicMock
import ee
from app.services.gee_auth import initialize_gee, check_gee_health, GEEAuthError

@pytest.mark.asyncio
async def test_gee_auth_success():
    with patch("ee.Initialize") as mock_init:
        res = await initialize_gee()
        assert res is True
        mock_init.assert_called_once()

@pytest.mark.asyncio
async def test_gee_auth_retry_on_network_timeout():
    call_count = 0
    
    def mock_ee_init(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count < 2:
            # Emulate transient network failure
            raise ee.EEException("connection timed out")
        return True

    with patch("ee.Initialize", side_effect=mock_ee_init):
        # We patch tenacity's sleep to speed up the tests
        with patch("tenacity.nap.time.sleep", return_value=None):
            res = await initialize_gee()
            assert res is True
            assert call_count == 2

@pytest.mark.asyncio
async def test_gee_health_check_healthy():
    with patch("ee.Image") as mock_image:
        mock_image.return_value.getInfo.return_value = {"type": "Image", "bands": []}
        health = await check_gee_health()
        assert health["status"] == "healthy"
        assert "Successfully connected" in health["details"]

@pytest.mark.asyncio
async def test_gee_health_check_unhealthy():
    with patch("ee.Image") as mock_image:
        mock_image.return_value.getInfo.side_effect = ee.EEException("Quota exceeded")
        health = await check_gee_health()
        assert health["status"] == "unhealthy"
        assert "Quota exceeded" in health["error"]
