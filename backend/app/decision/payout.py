import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Crop insurance factors
CROP_FACTORS = {
    "Rice": 1.0,
    "Wheat": 0.9,
    "Cotton": 1.2,
    "Sugarcane": 1.1,
    "Maize": 1.0,
    "Mustard": 0.85,
    "Soybeans": 0.95
}

def calculate_parametric_payout(
    damage_probability: float,
    insured_value: float,
    crop_type: str,
    ndvi_drop_percent: float = 0.0,
    flood_index: float = 0.0,
    rainfall_anomaly_percent: float = 0.0
) -> Dict[str, Any]:
    """
    Computes parametric insurance payout based on:
    payout = damage_probability * insured_value * crop_factor.
    
    Triggers instant 100% payout if any parametric threshold is breached:
    - NDVI drop > 40%
    - Flood Index > 0.8
    - Rainfall anomaly < -60%
    """
    crop_factor = CROP_FACTORS.get(crop_type, 1.0)
    
    # 1. Check instant payout parametric triggers
    instant_trigger = False
    trigger_cause = None
    
    if ndvi_drop_percent > 40.0:
        instant_trigger = True
        trigger_cause = f"NDVI drop of {ndvi_drop_percent:.1f}% exceeded critical 40% threshold."
    elif flood_index > 0.8:
        instant_trigger = True
        trigger_cause = f"SAR flood index of {flood_index:.2f} exceeded extreme 0.8 saturation threshold."
    elif rainfall_anomaly_percent < -60.0:
        instant_trigger = True
        trigger_cause = f"Rainfall deficit of {rainfall_anomaly_percent:.1f}% exceeded severe -60% drought threshold."
        
    if instant_trigger:
        payout_amount = insured_value
        logger.info(f"Parametric trigger activated: {trigger_cause}. 100% payout approved.")
        return {
            "payout_amount": float(payout_amount),
            "crop_factor": crop_factor,
            "instant_payout_triggered": True,
            "trigger_reason": trigger_cause,
            "calculation_formula": "Parametric Instant Payout (100% Insured Value)"
        }
        
    # 2. Standard parametric formula
    payout_amount = damage_probability * insured_value * crop_factor
    # Cap payout at 100% of insured value
    payout_amount = min(insured_value, payout_amount)
    payout_amount = max(0.0, payout_amount)
    
    formula_desc = f"damage_probability ({damage_probability:.2f}) * insured_value ({insured_value}) * crop_factor ({crop_factor})"
    
    return {
        "payout_amount": float(payout_amount),
        "crop_factor": crop_factor,
        "instant_payout_triggered": False,
        "trigger_reason": None,
        "calculation_formula": formula_desc
    }
