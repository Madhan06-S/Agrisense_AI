import json
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, Any, List
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


async def evaluate_traffic_light(claim_id: int, db: AsyncSession) -> Dict[str, Any]:
    stmt = select(DamageAssessment).where(DamageAssessment.claim_id == claim_id)
    res = await db.execute(stmt)
    assessment = res.scalars().first()

    if not assessment:
        return {
            "light": TrafficLight.YELLOW.value,
            "score": 0,
            "confidence": 0,
            "message": "AI assessment pending. Routed for human officer field visit.",
            "auto_action": "field_visit_required",
            "breakdown": {"satellite": 0, "image": 0, "weather": 0}
        }

    score = assessment.combined_score or 0
    confidence = assessment.confidence or 0.5

    if score < 25:
        light = TrafficLight.GREEN
        message = "Low damage detected (NDVI normal). Claim auto-closed with no damage."
        auto_action = "auto_close"
    elif score < 70:
        light = TrafficLight.YELLOW
        message = "Moderate damage detected. Routed for human officer field visit with GPS dispatch."
        auto_action = "field_visit_required"
    else:
        light = TrafficLight.RED
        message = "Severe vegetation drop confirmed. Auto-approved for instant payout trigger."
        auto_action = "auto_approve"

    return {
        "light": light.value,
        "score": round(score, 1),
        "confidence": round(confidence, 2),
        "message": message,
        "auto_action": auto_action,
        "breakdown": {
            "satellite": assessment.satellite_score,
            "image": assessment.image_score,
            "weather": assessment.weather_score
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
