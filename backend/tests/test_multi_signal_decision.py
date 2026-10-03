import pytest
from app.decision.engine import evaluate_traffic_light, TrafficLight


@pytest.mark.asyncio
async def test_decision_all_agree_red_flood():
    """Flood claim: SAR flood + rain evidence both agree -> RED."""
    override_signals = {
        "optical": {"value": 0.50, "provenance": "live", "indicates_damage": False},
        "flood_sar": {"value": 0.85, "provenance": "live", "indicates_damage": True},
        "thermal_lst": {"value": 26.0, "provenance": "live", "indicates_damage": False},
        "soil_moisture": {"value": 92.0, "provenance": "live", "indicates_damage": True},
        "weather": {"value": 110.0, "provenance": "live", "indicates_damage": True},
        "ground_sensor": {"value": 94.0, "provenance": "live", "indicates_damage": True}
    }

    res = await evaluate_traffic_light(
        claim_id=1,
        db=None,
        override_signals=override_signals,
        claim_type_override="flood"
    )

    assert res["light"] == TrafficLight.RED.value
    assert res["auto_action"] == "auto_approve"
    assert "ai_evidence" in res
    assert res["ai_evidence"]["signals"]["flood_sar"]["provenance"] == "live"


@pytest.mark.asyncio
async def test_decision_all_agree_red_drought():
    """Drought claim: Optical + Thermal + Soil Moisture all agree -> RED."""
    override_signals = {
        "optical": {"value": 0.24, "baseline": 0.60, "provenance": "live", "indicates_damage": True},
        "flood_sar": {"value": 0.10, "provenance": "live", "indicates_damage": False},
        "thermal_lst": {"value": 41.5, "anomaly": 4.5, "provenance": "live", "indicates_damage": True},
        "soil_moisture": {"value": 12.0, "provenance": "live", "indicates_damage": True},
        "weather": {"value": 0.0, "air_temp": 41.5, "provenance": "live", "indicates_damage": True},
        "ground_sensor": {"value": 12.5, "provenance": "live", "indicates_damage": True}
    }

    res = await evaluate_traffic_light(
        claim_id=1,
        db=None,
        override_signals=override_signals,
        claim_type_override="drought"
    )

    assert res["light"] == TrafficLight.RED.value
    assert res["auto_action"] == "auto_approve"
    assert res["ai_evidence"]["signals"]["optical"]["agree"] is True
    assert res["ai_evidence"]["signals"]["thermal_lst"]["agree"] is True
    assert res["ai_evidence"]["signals"]["soil_moisture"]["agree"] is True


@pytest.mark.asyncio
async def test_decision_disagree_yellow():
    """Signals disagree (Optical indicates drought but Soil Moisture is normal) -> YELLOW."""
    override_signals = {
        "optical": {"value": 0.24, "baseline": 0.60, "provenance": "live", "indicates_damage": True},
        "flood_sar": {"value": 0.10, "provenance": "live", "indicates_damage": False},
        "thermal_lst": {"value": 27.0, "anomaly": 0.2, "provenance": "live", "indicates_damage": False},
        "soil_moisture": {"value": 45.0, "provenance": "live", "indicates_damage": False},
        "weather": {"value": 10.0, "air_temp": 28.0, "provenance": "live", "indicates_damage": False},
        "ground_sensor": {"value": 45.0, "provenance": "live", "indicates_damage": False}
    }

    res = await evaluate_traffic_light(
        claim_id=1,
        db=None,
        override_signals=override_signals,
        claim_type_override="drought"
    )

    assert res["light"] == TrafficLight.YELLOW.value
    assert res["auto_action"] == "field_visit_required"
    assert "signals disagree" in res["message"]


@pytest.mark.asyncio
async def test_decision_fallback_only_yellow():
    """Archive fallback provenance -> YELLOW ('insufficient live data')."""
    override_signals = {
        "optical": {"value": 0.24, "baseline": 0.60, "provenance": "archive", "indicates_damage": True},
        "flood_sar": {"value": 0.85, "provenance": "archive", "indicates_damage": True},
        "thermal_lst": {"value": 41.5, "provenance": "archive", "indicates_damage": True},
        "soil_moisture": {"value": 12.0, "provenance": "archive", "indicates_damage": True},
        "weather": {"value": 0.0, "provenance": "archive", "indicates_damage": True},
        "ground_sensor": {"value": 12.5, "provenance": "archive", "indicates_damage": True}
    }

    res = await evaluate_traffic_light(
        claim_id=1,
        db=None,
        override_signals=override_signals,
        claim_type_override="drought"
    )

    assert res["light"] == TrafficLight.YELLOW.value
    assert "insufficient live data" in res["message"]
    assert res["ai_evidence"]["provenance_overall"] == "archive"


@pytest.mark.asyncio
async def test_decision_normal_green():
    """All signals normal -> GREEN auto-close."""
    override_signals = {
        "optical": {"value": 0.62, "baseline": 0.60, "provenance": "live", "indicates_damage": False},
        "flood_sar": {"value": 0.08, "provenance": "live", "indicates_damage": False},
        "thermal_lst": {"value": 26.0, "provenance": "live", "indicates_damage": False},
        "soil_moisture": {"value": 48.0, "provenance": "live", "indicates_damage": False},
        "weather": {"value": 5.0, "air_temp": 27.0, "provenance": "live", "indicates_damage": False},
        "ground_sensor": {"value": 48.0, "provenance": "live", "indicates_damage": False}
    }

    res = await evaluate_traffic_light(
        claim_id=1,
        db=None,
        override_signals=override_signals,
        claim_type_override="drought"
    )

    assert res["light"] == TrafficLight.GREEN.value
    assert res["auto_action"] == "auto_close"


@pytest.mark.asyncio
async def test_fraud_checks():
    """Tests EXIF, unmatched date, duplicate claim, and fraud flag interaction rules."""
    # Fraud flag on normal signals -> GREEN (auto-close with fraud audit log)
    normal_signals = {
        "optical": {"value": 0.65, "provenance": "live", "indicates_damage": False},
        "flood_sar": {"value": 0.05, "provenance": "live", "indicates_damage": False},
        "thermal_lst": {"value": 25.0, "provenance": "live", "indicates_damage": False},
        "soil_moisture": {"value": 50.0, "provenance": "live", "indicates_damage": False},
        "weather": {"value": 2.0, "provenance": "live", "indicates_damage": False},
        "ground_sensor": {"value": 50.0, "provenance": "live", "indicates_damage": False}
    }

    fraud_override = {
        "exif_gps_outside": True,
        "exif_timestamp_expired": True,
        "flags": ["Photo EXIF GPS is outside farm polygon", "EXIF timestamp > 48h"]
    }

    res_normal_fraud = await evaluate_traffic_light(
        claim_id=1,
        db=None,
        override_signals=normal_signals,
        override_fraud_checks=fraud_override,
        claim_type_override="drought"
    )

    assert res_normal_fraud["light"] == TrafficLight.GREEN.value
    assert res_normal_fraud["auto_action"] == "auto_close"
    assert "fraud flag logged" in res_normal_fraud["message"].lower()

    # Fraud flag on damage signals -> Override to YELLOW for officer field verification
    drought_signals = {
        "optical": {"value": 0.20, "baseline": 0.60, "provenance": "live", "indicates_damage": True},
        "flood_sar": {"value": 0.05, "provenance": "live", "indicates_damage": False},
        "thermal_lst": {"value": 42.0, "anomaly": 5.0, "provenance": "live", "indicates_damage": True},
        "soil_moisture": {"value": 10.0, "provenance": "live", "indicates_damage": True},
        "weather": {"value": 0.0, "air_temp": 42.0, "provenance": "live", "indicates_damage": True},
        "ground_sensor": {"value": 10.0, "provenance": "live", "indicates_damage": True}
    }

    res_damage_fraud = await evaluate_traffic_light(
        claim_id=1,
        db=None,
        override_signals=drought_signals,
        override_fraud_checks=fraud_override,
        claim_type_override="drought"
    )

    assert res_damage_fraud["light"] == TrafficLight.YELLOW.value
    assert res_damage_fraud["auto_action"] == "field_visit_required"
    assert "Fraud flag requires officer field verification" in res_damage_fraud["message"]
