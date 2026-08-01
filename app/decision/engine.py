import logging
import time
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# In-memory audit trail and stats store
DECISION_AUDIT_TRAIL: Dict[int, List[Dict[str, Any]]] = {}
DECISION_STATS = {
    "total_evaluated": 0,
    "auto_approved_green": 0,
    "human_review_yellow": 0, # maintained for backward compat key but unused
    "deep_inspect_red": 0,
    "overridden_claims": 0
}

class OverrideRequest(BaseModel):
    claim_id: int
    official_id: int
    original_color: str
    new_color: str
    reason: str

def evaluate_routing_rules_pillar5(
    ndvi: float,
    vci: float,
    rainfall_anomaly: float,
    flood_index: float,
    moisture_drop: float,
    ndvi_drop_2w: float,
    vci_consecutive_low: bool = False,
    num_cows: int = 5
) -> Dict[str, Any]:
    """
    Evaluates claims using the Pillar 5 Binary De-Risking rules (Green vs Red only):
    
    - GREEN (Auto-Close):
      NDVI > 0.6 AND VCI > 60 AND no rainfall anomaly AND no flood index trigger.
      Claim Closed as "No Damage Detected".
      
    - RED (Instant Micro-Payout):
      ANY of:
        - VCI < 40 for 3+ consecutive weeks (or vci_consecutive_low)
        - Flood index > 0.8
        - Historic moisture drop > 60%
        - NDVI drop > 50% in 2 weeks
      Claim Approved as "Instant Micro-Payout".
    """
    is_red = (
        (vci < 40) or 
        vci_consecutive_low or 
        (flood_index > 0.8) or 
        (moisture_drop > 60.0) or 
        (ndvi_drop_2w > 50.0)
    )
    
    is_green = (
        not is_red and
        (ndvi > 0.6) and
        (vci > 60.0) and
        (rainfall_anomaly >= -20.0) and
        (flood_index <= 0.8)
    )
    
    # If not strictly green, fall back to RED for protective de-risking
    if is_green:
        color = "GREEN"
        status = "CLAIM_CLOSED_NO_DAMAGE"
        message = "Your pasture is healthy. No insurance payout needed."
        payout_amount = 0.0
    else:
        color = "RED"
        status = "INSTANT_MICRO_PAYOUT"
        
        # Calculate severity multiplier between 1.0 and 2.0
        if flood_index > 0.8:
            multiplier = 2.0
        elif moisture_drop > 60.0:
            multiplier = 1.8
        elif ndvi_drop_2w > 50.0:
            multiplier = 1.5
        else:
            multiplier = 1.2
            
        payout_amount = float(num_cows * 5000 * multiplier)
        message = f"Disaster detected. ₹{payout_amount:,.2f} transferred to your digital wallet."
        
    return {
        "color": color,
        "status": status,
        "payout_amount": payout_amount,
        "message": message,
        "description": f"Automated Verification concluded color status: {color}."
    }

def record_override(claim_id: int, official_id: int, original_color: str, new_color: str, reason: str) -> Dict[str, Any]:
    """Applies and audits an official override of the AI decision."""
    audit_entry = {
        "timestamp": time.time(),
        "official_id": official_id,
        "original_color": original_color,
        "new_color": new_color,
        "reason": reason,
        "type": "override"
    }
    
    if claim_id not in DECISION_AUDIT_TRAIL:
        DECISION_AUDIT_TRAIL[claim_id] = []
        
    DECISION_AUDIT_TRAIL[claim_id].append(audit_entry)
    DECISION_STATS["overridden_claims"] += 1
    
    logger.info(f"Official {official_id} overrode Claim {claim_id} from {original_color} to {new_color}")
    return audit_entry
