import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Forage regression calibration parameters
FORAGE_REGRESSION_CONFIG: Dict[str, Any] = {
    "a": 4800.0,
    "b": -960.0,
    "label": "estimate, calibrate with field clipping data",
    "daily_intake_tlu_kg": 6.25,
    "intake_label": "6.25 kg DM per tropical livestock unit per day",
    "default_grazing_days": 30,
    "vci_threshold": 35.0
}


def estimate_forage_biomass(ndvi: float) -> float:
    """
    Estimates forage biomass dry matter (kg DM/ha) from satellite NDVI.
    Uses regression formula: DM (kg/ha) = max(0, a * NDVI + b).
    Labeled: "estimate, calibrate with field clipping data".
    """
    a = FORAGE_REGRESSION_CONFIG["a"]
    b = FORAGE_REGRESSION_CONFIG["b"]
    raw_dm = (a * max(0.0, min(1.0, float(ndvi)))) + b
    return round(max(0.0, raw_dm), 1)


def compute_required_dm_per_ha(
    livestock_count: int,
    area_ha: float = 100.0,
    daily_intake_kg: float = 6.25,
    grazing_days: int = 30
) -> float:
    """
    Computes required DM/ha survival baseline:
    Required DM/ha = (livestock_count * daily_intake_kg * grazing_days) / area_ha.
    """
    effective_area = max(0.1, float(area_ha))
    total_dm_needed = float(livestock_count) * float(daily_intake_kg) * float(grazing_days)
    required_dm_ha = total_dm_needed / effective_area
    return round(required_dm_ha, 1)


def compute_vci_trend_and_projection(
    vci_history: List[Tuple[datetime, float]],
    current_vci: float,
    threshold_vci: float = 35.0
) -> Tuple[float, Optional[int]]:
    """
    Computes VCI trend (change in VCI points per day) over the last 4-6 acquisitions
    and projects days remaining until the threshold is crossed.

    Returns:
    - dVCI_per_day (float)
    - days_to_breach (int or None if stable/improving or already breached)
    """
    if current_vci < threshold_vci:
        return 0.0, 0

    if not vci_history or len(vci_history) < 2:
        return 0.0, None

    # Sort history chronologically
    sorted_history = sorted(vci_history, key=lambda x: x[0])
    recent = sorted_history[-6:]  # last 4-6 acquisitions

    t_start = recent[0][0]
    t_end = recent[-1][0]

    days_diff = (t_end - t_start).total_seconds() / 86400.0
    vci_diff = recent[-1][1] - recent[0][1]

    if days_diff <= 0:
        return 0.0, None

    dvci_per_day = vci_diff / days_diff

    if dvci_per_day < 0:
        # Declining trend: project days to reach threshold_vci
        gap = current_vci - threshold_vci
        days_to_breach = int(round(gap / abs(dvci_per_day)))
        return round(dvci_per_day, 3), max(0, days_to_breach)
    else:
        # Improving or stable trend
        return round(dvci_per_day, 3), None


def determine_afii_zone_status(
    current_vci: float,
    threshold_vci: float,
    dm_available: float,
    dm_required: float,
    days_to_breach: Optional[int]
) -> Tuple[str, bool, str]:
    """
    Determines early warning zone state:
    - 'Triggered': VCI < 35% OR DM available < DM required.
    - 'Watch': Not triggered, but projected breach within 30 days.
    - 'Normal': Otherwise.

    Returns:
    - status ('Normal' | 'Watch' | 'Triggered')
    - is_breached (bool)
    - status_reason (str)
    """
    vci_breach = current_vci < threshold_vci
    dm_breach = dm_available < dm_required

    if vci_breach or dm_breach:
        is_breached = True
        status = "Triggered"
        if vci_breach and dm_breach:
            reason = f"Dual breach: VCI {current_vci:.1f}% < {threshold_vci:.1f}% & DM/ha {dm_available:.0f} < required {dm_required:.0f} kg/ha"
        elif vci_breach:
            reason = f"VCI breach: {current_vci:.1f}% < {threshold_vci:.1f}% threshold"
        else:
            reason = f"Biomass shortfall breach: DM/ha {dm_available:.0f} < required {dm_required:.0f} kg DM/ha"
        return status, is_breached, reason

    # Check Watch pre-alert condition: projected breach within 30 days
    if days_to_breach is not None and days_to_breach <= 30:
        status = "Watch"
        reason = f"Watch pre-alert: Projected VCI breach in {days_to_breach} days (SMS & officer alert dispatched)"
        return status, False, reason

    status = "Normal"
    reason = f"Normal: VCI {current_vci:.1f}% & DM/ha {dm_available:.0f} kg/ha healthy"
    return status, False, reason
