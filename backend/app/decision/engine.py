from enum import Enum
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Claim, DamageAssessment

class TrafficLight(str, Enum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"

async def evaluate_traffic_light(claim_id: int, db: AsyncSession) -> Dict[str, Any]:
    stmt = select(DamageAssessment).where(DamageAssessment.claim_id == claim_id)
    res = await db.execute(stmt)
    assessment = res.scalars().first()
    
    if not assessment:
        return {
            "light": TrafficLight.YELLOW,
            "score": 0,
            "confidence": 0,
            "message": "AI assessment pending. Routed to manual review.",
            "auto_action": None,
            "breakdown": {"satellite": 0, "image": 0, "weather": 0}
        }
    
    score = assessment.combined_score or 0
    confidence = assessment.confidence or 0.5
    
    if score < 25:
        light = TrafficLight.GREEN
        message = "Low damage detected. Claim eligible for auto-closure."
        auto_action = "auto_reject"
    elif score < 70:
        light = TrafficLight.YELLOW
        message = "Moderate damage. Officer review required."
        auto_action = None
    else:
        light = TrafficLight.RED
        message = "Severe damage confirmed. Eligible for auto-approval."
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

async def apply_traffic_light_decision(claim_id: int, db: AsyncSession) -> None:
    """
    Auto-apply ONLY for Green (approve) and Red (reject).
    Yellow does NOTHING — leaves as submitted/under_review for officer.
    """
    result = await evaluate_traffic_light(claim_id, db)
    stmt = select(Claim).where(Claim.id == claim_id)
    res = await db.execute(stmt)
    claim = res.scalars().first()
    if not claim:
        return
    
    # CRITICAL: Only auto-act on extremes. Yellow stays for officer.
    if result["light"] == "green":
        claim.status = "approved"
        claim.officer_remarks = "Auto-approved: AI confirmed severe damage."
        claim.ai_damage_score = result["score"]
    elif result["light"] == "red":
        claim.status = "rejected"
        claim.officer_remarks = "Auto-rejected: AI damage assessment too low."
        claim.ai_damage_score = result["score"]
    # else: yellow — do nothing, leave status as-is
    
    await db.commit()
