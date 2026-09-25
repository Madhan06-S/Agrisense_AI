import json
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from shapely.geometry import shape

from app.models import Claim, DamageAssessment, Farm
from app.decision.payout import calculate_parametric_payout

logger = logging.getLogger(__name__)

DECISION_AUDIT_TRAIL: Dict[int, List[Dict[str, Any]]] = {}


class TrafficLight(str, Enum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"


def _get_farm_centroid(farm: Farm) -> tuple[float, float]:
    """Helper to extract (latitude, longitude) centroid from farm boundary."""
    default_lat, default_lng = 11.7384, 78.9639
    if not farm or not farm.boundary:
        return default_lat, default_lng

    try:
        raw_boundary = farm.boundary
        if isinstance(raw_boundary, str):
            boundary_dict = json.loads(raw_boundary)
        elif hasattr(raw_boundary, "__geo_interface__"):
            boundary_dict = raw_boundary.__geo_interface__
        elif isinstance(raw_boundary, dict):
            boundary_dict = raw_boundary
        else:
            boundary_dict = json.loads(str(raw_boundary))

        poly = shape(boundary_dict)
        centroid = poly.centroid
        return round(float(centroid.y), 6), round(float(centroid.x), 6)
    except Exception as e:
        logger.warning(f"Could not compute centroid for farm {farm.id if farm else 'unknown'}: {e}")
        return default_lat, default_lng


def evaluate_routing_rules_pillar5(
    ndvi: float = 0.7,
    vci: float = 70.0,
    rainfall_anomaly: float = 0.0,
    flood_index: float = 0.0,
    moisture_drop: float = 0.0,
    ndvi_drop_2w: float = 0.0,
    num_cows: int = 5
) -> Dict[str, Any]:
    """Pure helper function for Pillar 5 parametric routing rules."""
    base_payout = num_cows * 5000.0

    if vci < 40.0:
        return {
            "color": "RED",
            "status": "INSTANT_MICRO_PAYOUT",
            "payout_amount": base_payout * 1.2,
            "message": f"Drought trigger: VCI {vci:.1f}% below 40.0 baseline."
        }

    if flood_index > 0.8:
        return {
            "color": "RED",
            "status": "INSTANT_MICRO_PAYOUT",
            "payout_amount": base_payout * 2.0,
            "message": f"Flood trigger: SAR flood index {flood_index:.2f} > 0.8."
        }

    if moisture_drop > 60.0:
        return {
            "color": "RED",
            "status": "INSTANT_MICRO_PAYOUT",
            "payout_amount": base_payout * 1.8,
            "message": f"Moisture deficit trigger: Soil moisture drop {moisture_drop:.1f}% > 60%."
        }

    if ndvi_drop_2w > 50.0:
        return {
            "color": "RED",
            "status": "INSTANT_MICRO_PAYOUT",
            "payout_amount": base_payout * 1.5,
            "message": f"NDVI drop trigger: 2-week drop {ndvi_drop_2w:.1f}% > 50%."
        }

    if ndvi > 0.6 and vci > 60.0 and rainfall_anomaly >= -20.0 and flood_index <= 0.8:
        return {
            "color": "GREEN",
            "status": "CLAIM_CLOSED_NO_DAMAGE",
            "payout_amount": 0.0,
            "message": "Pasture is healthy. Auto-closed with no damage."
        }

    return {
        "color": "YELLOW",
        "status": "OFFICER_FIELD_VISIT",
        "payout_amount": 0.0,
        "message": "Moderate vegetation anomaly. Routed to human officer field visit."
    }


def record_override(claim_id: int, official_id: int, original_color: str, new_color: str, reason: str) -> Dict[str, Any]:
    """Records manual officer override into audit trail."""
    entry = {
        "claim_id": claim_id,
        "official_id": official_id,
        "original_color": original_color,
        "new_color": new_color,
        "reason": reason,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    if claim_id not in DECISION_AUDIT_TRAIL:
        DECISION_AUDIT_TRAIL[claim_id] = []
    DECISION_AUDIT_TRAIL[claim_id].append(entry)
    return entry


async def evaluate_traffic_light(
    claim_id: int,
    db: AsyncSession,
    model_probs: Optional[Dict[str, float]] = None,
    model_available: Optional[bool] = None
) -> Dict[str, Any]:
    """
    Traffic light evaluation driven by XGBoost class probabilities:
    - GREEN: p_severe < 0.15 AND p_moderate < 0.35
    - RED: p_severe >= 0.60
    - YELLOW: otherwise
    Falls back to combined score thresholds (<25 GREEN, <70 YELLOW) only if model is unavailable.
    """
    if db is not None:
        stmt = select(DamageAssessment).where(DamageAssessment.claim_id == claim_id)
        res = await db.execute(stmt)
        assessment = res.scalars().first()
    else:
        assessment = None

    # Check model health status if not explicitly specified
    if model_available is None:
        try:
            from app.ml.xgboost.inference import get_model_status
            status = get_model_status()
            model_available = status.get("model_loaded", False) and not status.get("fallback_active", True)
        except Exception as e:
            logger.warning(f"Could not query XGBoost model status: {e}")
            model_available = False

    p_no_damage = 0.0
    p_moderate = 0.0
    p_severe = 0.0
    has_explicit_probs = False

    if model_probs is not None:
        p_no_damage = float(model_probs.get("p_no_damage", model_probs.get("no_damage", 0.0)))
        p_moderate = float(model_probs.get("p_moderate", model_probs.get("moderate_damage", 0.0)))
        p_severe = float(model_probs.get("p_severe", model_probs.get("severe_damage", 0.0)))
        has_explicit_probs = True
    elif assessment and assessment.explanation_json and isinstance(assessment.explanation_json, dict):
        exp = assessment.explanation_json
        if "damage_probabilities" in exp and isinstance(exp["damage_probabilities"], list) and len(exp["damage_probabilities"]) >= 3:
            p_no_damage = float(exp["damage_probabilities"][0])
            p_moderate = float(exp["damage_probabilities"][1])
            p_severe = float(exp["damage_probabilities"][2])
            has_explicit_probs = True

    # Apply XGBoost Probability Decision Rule
    if (model_available or has_explicit_probs) and (p_no_damage > 0 or p_moderate > 0 or p_severe > 0):
        basis = "xgboost_probs"
        if p_severe >= 0.60:
            light = TrafficLight.RED
            message = f"Severe damage confirmed by XGBoost model (p_severe={p_severe:.2f} >= 0.60). Auto-approved."
            auto_action = "auto_approve"
        elif p_severe < 0.15 and p_moderate < 0.35:
            light = TrafficLight.GREEN
            message = f"Low damage confirmed by XGBoost model (p_severe={p_severe:.2f} < 0.15, p_moderate={p_moderate:.2f} < 0.35). Auto-closed."
            auto_action = "auto_close"
        else:
            light = TrafficLight.YELLOW
            message = f"Moderate damage flagged by XGBoost model (p_severe={p_severe:.2f}, p_moderate={p_moderate:.2f}). Field visit required."
            auto_action = "field_visit_required"
    else:
        # Fallback path: combined score thresholds (<25 GREEN, <70 YELLOW, else RED)
        basis = "score_fallback"
        score = assessment.combined_score if assessment else 0
        if score < 25:
            light = TrafficLight.GREEN
            p_no_damage, p_moderate, p_severe = 0.85, 0.10, 0.05
            message = "Low damage detected (score < 25). Claim auto-closed with no damage."
            auto_action = "auto_close"
        elif score < 70:
            light = TrafficLight.YELLOW
            p_no_damage, p_moderate, p_severe = 0.20, 0.65, 0.15
            message = "Moderate damage detected (score < 70). Routed for officer field visit."
            auto_action = "field_visit_required"
        else:
            light = TrafficLight.RED
            p_no_damage, p_moderate, p_severe = 0.05, 0.25, 0.70
            message = "Severe vegetation drop confirmed (score >= 70). Auto-approved."
            auto_action = "auto_approve"

    score_val = assessment.combined_score if assessment else 0.0
    conf_val = assessment.confidence if assessment else 0.85

    return {
        "light": light.value,
        "score": round(score_val or 0.0, 1),
        "confidence": round(conf_val or 0.85, 2),
        "message": message,
        "auto_action": auto_action,
        "basis": basis,
        "p_no_damage": round(p_no_damage, 3),
        "p_moderate": round(p_moderate, 3),
        "p_severe": round(p_severe, 3),
        "breakdown": {
            "satellite": assessment.satellite_score if assessment else 0,
            "image": assessment.image_score if assessment else 0,
            "weather": assessment.weather_score if assessment else 0
        }
    }


async def apply_traffic_light_decision(claim_id: int, db: AsyncSession) -> Dict[str, Any]:
    """
    Traffic light verification logic:
    - GREEN (low damage / NDVI normal) -> claim.status = "closed_no_damage"
    - YELLOW (moderate) -> claim.status = "field_visit_required" and attach GPS coordinates from farm boundary centroid for officer dispatch
    - RED (severe vegetation drop) -> claim.status = "approved" and trigger payout
    """
    result = await evaluate_traffic_light(claim_id, db)

    stmt = select(Claim, Farm).join(Farm, Claim.farm_id == Farm.id).where(Claim.id == claim_id)
    res = await db.execute(stmt)
    row = res.first()

    if not row:
        return result

    claim, farm = row
    claim.ai_damage_score = result["score"]
    claim.ai_decision = result["light"]

    if result["light"] == "green":
        claim.status = "closed_no_damage"
        claim.officer_remarks = "Auto-closed: Satellite imagery confirms normal NDVI vegetation levels (no damage)."

    elif result["light"] == "yellow":
        claim.status = "field_visit_required"
        lat, lng = _get_farm_centroid(farm)
        claim.officer_remarks = f"Field visit required: Moderate damage flagged. Dispatched field agent to Farm Centroid GPS ({lat}, {lng})."

    elif result["light"] == "red":
        claim.status = "approved"
        claim.officer_remarks = "Auto-approved: Satellite imagery confirms severe vegetation drop anomaly."

        # Calculate and trigger payout
        insured_val = claim.sum_insured or 50000.0
        crop = farm.crop_type if farm else "Rice"
        payout_res = calculate_parametric_payout(
            damage_probability=min(1.0, (result["score"] or 80.0) / 100.0),
            insured_value=insured_val,
            crop_type=crop
        )
        claim.payout_amount = payout_res.get("payout_amount", insured_val)
        claim.status = "payout_processed"

    await db.commit()
    return result
