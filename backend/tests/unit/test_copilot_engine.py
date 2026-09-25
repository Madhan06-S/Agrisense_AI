import pytest
from app.copilot.ml_models import (
    normalize_moisture_humidity,
    estimate_yield,
    forecast_pest_risk,
    schedule_irrigation,
    get_market_advisory,
    diagnose_leaf_disease
)
from app.copilot.advisor import AgronomyAdvisor

def test_moisture_normalization_bug_0_fix():
    # Decimal fraction case: 0.35 -> 35.0%
    assert normalize_moisture_humidity(0.35) == 35.0

    # Normal percentage case: 38.5 -> 38.5%
    assert normalize_moisture_humidity(38.5) == 38.5

    # Out of bounds high: 3500% -> 100.0%
    assert normalize_moisture_humidity(3500.0) == 100.0

    # Out of bounds negative: -10.0% -> 0.0%
    assert normalize_moisture_humidity(-10.0) == 0.0

    # Invalid input string -> default 45.0%
    assert normalize_moisture_humidity("invalid") == 45.0


def test_pest_risk_forecast_matrix():
    # High humidity + optimal temp + high rain -> HIGH risk
    high_risk = forecast_pest_risk("Rice", relative_humidity=80.0, temp_c=30.0, rain_mm=20.0)
    assert high_risk["risk_level"] == "HIGH"
    assert high_risk["pest_risk_score"] >= 70
    assert "Brown Plant Hopper (BPH)" in high_risk["top_likely_pests"]

    # Low humidity + low rain -> LOW risk
    low_risk = forecast_pest_risk("Rice", relative_humidity=40.0, temp_c=20.0, rain_mm=0.0)
    assert low_risk["risk_level"] == "LOW"


def test_irrigation_scheduler():
    # Rain forecast (30mm) >= Deficit (60 - (60% of 60) = 24mm) -> SKIP_IRRIGATION
    skip_res = schedule_irrigation("Rice", soil_moisture_pct=60.0, rain_forecast_7day_mm=30.0)
    assert skip_res["action"] == "SKIP_IRRIGATION"
    assert skip_res["recommended_volume_l_per_ha"] == 0

    # Dry soil + zero rain -> IRRIGATE_TODAY
    irrig_res = schedule_irrigation("Rice", soil_moisture_pct=25.0, rain_forecast_7day_mm=2.0)
    assert irrig_res["action"] == "IRRIGATE_TODAY"
    assert irrig_res["recommended_volume_l_per_ha"] > 0


def test_yield_estimate_sanity():
    res = estimate_yield(ndvi_history=[0.75, 0.78, 0.80], crop_type="Rice", area_hectares=2.0)
    assert res["estimated_yield_per_acre"] > 0
    assert res["area_acres"] == pytest.approx(4.94, abs=0.1)
    assert res["status"] in ["ABOVE_AVERAGE", "ON_PAR", "BELOW_AVERAGE"]


def test_market_advisory():
    rice_mkt = get_market_advisory("Rice")
    assert rice_mkt["msp_inr"] == 2300
    assert rice_mkt["recommendation"] in ["SELL_NOW", "HOLD_FOR_TARGET", "SELL_TO_GOVT_PROCUREMENT"]


def test_leaf_diagnose_fallback():
    diag = diagnose_leaf_disease(image_base64="", crop_type="Rice", openrouter_api_key="")
    assert "disease_name" in diag
    assert diag["confidence"] > 0.5
    assert "treatment_english" in diag


def test_et0_penman_monteith_sanity_bounds():
    from app.copilot.ml_models import et0_penman_monteith

    # Typical Indian conditions: 25°C, 60% RH, 1.5 m/s wind, 14.0 MJ/m2/day solar rad
    weather = {
        "temp_c": 25.0,
        "humidity_pct": 60.0,
        "wind_speed_m_s": 1.5,
        "solar_rad_mj_m2": 14.0
    }
    et0 = et0_penman_monteith(weather)
    # FAO-56 worked example target range for typical conditions: 3.5 - 4.5 mm/day
    assert 3.5 <= et0 <= 4.5, f"ET0 {et0} mm/day outside FAO-56 expected range 3.5-4.5"



def test_crop_kc_lookup():
    from app.copilot.ml_models import get_crop_kc
    assert get_crop_kc("Rice", "vegetative") == 1.20
    assert get_crop_kc("wheat", "flowering") == 1.15
    assert get_crop_kc("Cotton", "maturity") == 0.70
    assert get_crop_kc("unknown_crop", "vegetative") == 1.0


def test_irrigation_decision_boundary():
    from app.copilot.ml_models import schedule_irrigation

    # Field capacity = 60mm.
    # Deficit = 25.0mm -> moisture = 35mm -> moisture_pct = (35/60)*100 = 58.333%
    # Deficit <= 25mm -> WAIT_WITH_ESTIMATE
    res_wait = schedule_irrigation("Rice", soil_moisture_pct=58.333, rain_forecast_7day_mm=0.0)
    assert res_wait["deficit_mm"] == 25.0
    assert res_wait["action"] == "WAIT_WITH_ESTIMATE"

    # Deficit = 25.1mm -> moisture = 34.9mm -> moisture_pct = (34.9/60)*100 = 58.167%
    # Deficit > 25mm -> IRRIGATE_TODAY
    res_irrigate = schedule_irrigation("Rice", soil_moisture_pct=58.167, rain_forecast_7day_mm=0.0)
    assert res_irrigate["deficit_mm"] == 25.1
    assert res_irrigate["action"] == "IRRIGATE_TODAY"

