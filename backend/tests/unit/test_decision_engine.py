import pytest
from app.decision.engine import evaluate_traffic_light, TrafficLight


@pytest.mark.asyncio
async def test_traffic_light_multi_signal_red():
    # All drought signals agree -> RED
    override_signals = {
        "optical": {"value": 0.25, "baseline": 0.60, "indicates_damage": True, "provenance": "live"},
        "thermal_lst": {"value": 42.0, "anomaly": 4.0, "indicates_damage": True, "provenance": "live"},
        "soil_moisture": {"value": 15.0, "indicates_damage": True, "provenance": "live"},
        "ground_sensor": {"value": 14.0, "indicates_damage": True, "provenance": "live"},
    }
    res = await evaluate_traffic_light(
        claim_id=999,
        db=None,
        override_signals=override_signals,
        claim_type_override="drought"
    )
    assert res["light"] == TrafficLight.RED.value
    assert res["basis"] == "multi_signal_fusion"


@pytest.mark.asyncio
async def test_traffic_light_multi_signal_disagree_yellow():
    # Signals disagree -> YELLOW
    override_signals = {
        "optical": {"value": 0.25, "baseline": 0.60, "indicates_damage": True, "provenance": "live"},
        "thermal_lst": {"value": 28.0, "anomaly": 0.5, "indicates_damage": False, "provenance": "live"},
        "soil_moisture": {"value": 45.0, "indicates_damage": False, "provenance": "live"},
    }
    res = await evaluate_traffic_light(
        claim_id=999,
        db=None,
        override_signals=override_signals,
        claim_type_override="drought"
    )
    assert res["light"] == TrafficLight.YELLOW.value
    assert res["basis"] == "multi_signal_fusion"


@pytest.mark.asyncio
async def test_traffic_light_multi_signal_normal_green():
    # All signals normal -> GREEN
    override_signals = {
        "optical": {"value": 0.65, "baseline": 0.60, "indicates_damage": False, "provenance": "live"},
        "thermal_lst": {"value": 28.0, "anomaly": 0.2, "indicates_damage": False, "provenance": "live"},
        "soil_moisture": {"value": 50.0, "indicates_damage": False, "provenance": "live"},
        "flood_sar": {"value": 0.05, "indicates_damage": False, "provenance": "live"},
        "weather": {"value": 10.0, "air_temp": 28.0, "indicates_damage": False, "provenance": "live"},
    }
    res = await evaluate_traffic_light(
        claim_id=999,
        db=None,
        override_signals=override_signals,
        claim_type_override="drought"
    )
    assert res["light"] == TrafficLight.GREEN.value
    assert res["basis"] == "multi_signal_fusion"
