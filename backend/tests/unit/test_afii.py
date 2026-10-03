import pytest
from datetime import datetime, timedelta
from app.services.forage import (
    estimate_forage_biomass,
    compute_required_dm_per_ha,
    compute_vci_trend_and_projection,
    determine_afii_zone_status,
    FORAGE_REGRESSION_CONFIG
)


def test_forage_biomass_estimation_calibration():
    """Tests forage biomass regression function and configuration label."""
    assert FORAGE_REGRESSION_CONFIG["label"] == "estimate, calibrate with field clipping data"
    assert FORAGE_REGRESSION_CONFIG["daily_intake_tlu_kg"] == 6.25

    # NDVI 0.60 -> 4800 * 0.60 - 960 = 1920 kg DM/ha
    dm_high = estimate_forage_biomass(0.60)
    assert dm_high == 1920.0

    # NDVI 0.20 -> 4800 * 0.20 - 960 = 0 kg DM/ha
    dm_low = estimate_forage_biomass(0.20)
    assert dm_low == 0.0


def test_survival_baseline_required_dm():
    """Tests survival baseline calculation (livestock_count * 6.25 * 30 / area_ha)."""
    # 850 livestock, 100 ha, 30 days -> (850 * 6.25 * 30) / 100 = 1593.8 kg DM/ha
    req_dm = compute_required_dm_per_ha(livestock_count=850, area_ha=100.0, daily_intake_kg=6.25, grazing_days=30)
    assert req_dm == 1593.8


def test_dm_shortfall_trigger():
    """Tests DM/ha shortfall trigger when DM available < DM required even if VCI >= 35%."""
    vci = 42.0  # Above 35% VCI threshold
    threshold_vci = 35.0
    dm_available = 1200.0  # DM available
    dm_required = 1593.8   # DM required -> Shortfall breach!

    status, is_breached, reason = determine_afii_zone_status(
        current_vci=vci,
        threshold_vci=threshold_vci,
        dm_available=dm_available,
        dm_required=dm_required,
        days_to_breach=5
    )

    assert status == "Triggered"
    assert is_breached is True
    assert "Biomass shortfall breach" in reason


def test_vci_trend_projection():
    """Tests VCI trend calculation (dVCI/dt) and projected days to breach."""
    now = datetime.now()
    history = [
        (now - timedelta(days=20), 55.0),
        (now - timedelta(days=15), 50.0),
        (now - timedelta(days=10), 45.0),
        (now - timedelta(days=5), 40.0),
        (now, 38.0)
    ]

    # Trend = (38 - 55) / 20 = -0.85 VCI points / day
    # Gap = 38 - 35 = 3 points. Days to breach = 3 / 0.85 ~ 4 days
    dvci_per_day, days_to_breach = compute_vci_trend_and_projection(history, current_vci=38.0, threshold_vci=35.0)

    assert dvci_per_day < 0
    assert days_to_breach is not None
    assert 3 <= days_to_breach <= 5


def test_watch_to_triggered_state_transition():
    """Tests state transition from Normal -> Watch (days_to_breach <= 30) -> Triggered (breached)."""
    threshold_vci = 35.0
    dm_required = 1000.0

    # 1. Normal state: VCI = 60%, DM = 1800, no imminent breach
    st_normal, breach_n, _ = determine_afii_zone_status(
        current_vci=60.0, threshold_vci=threshold_vci,
        dm_available=1800.0, dm_required=dm_required,
        days_to_breach=45
    )
    assert st_normal == "Normal"
    assert breach_n is False

    # 2. Watch state: VCI = 38%, DM = 1200, days to breach = 12 (<= 30 days)
    st_watch, breach_w, reason_w = determine_afii_zone_status(
        current_vci=38.0, threshold_vci=threshold_vci,
        dm_available=1200.0, dm_required=dm_required,
        days_to_breach=12
    )
    assert st_watch == "Watch"
    assert breach_w is False
    assert "Watch pre-alert" in reason_w

    # 3. Triggered state: VCI drops to 32% (< 35% threshold)
    st_triggered, breach_t, reason_t = determine_afii_zone_status(
        current_vci=32.0, threshold_vci=threshold_vci,
        dm_available=1200.0, dm_required=dm_required,
        days_to_breach=0
    )
    assert st_triggered == "Triggered"
    assert breach_t is True
    assert "VCI breach" in reason_t
