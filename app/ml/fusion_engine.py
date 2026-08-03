from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging
from app.models.models import Claim, DamageAssessment

logger = logging.getLogger(__name__)

async def run_fusion_pipeline(claim_id: int, db: AsyncSession):
    """
    Mock fusion pipeline for Day 2.
    """
    stmt_da = select(DamageAssessment).where(DamageAssessment.claim_id == claim_id)
    res_da = await db.execute(stmt_da)
    existing = res_da.scalars().first()
    if existing:
        return existing
        
    stmt_claim = select(Claim).where(Claim.id == claim_id)
    res_claim = await db.execute(stmt_claim)
    claim = res_claim.scalars().first()
    if not claim:
        return None
        
    ct = (claim.claim_type or "").lower()
    if ct == "flood":
        sat, img, wx, combined = 82, 88, 90, 85
    elif ct == "drought":
        sat, img, wx, combined = 65, 45, 70, 58
    elif ct == "pest":
        sat, img, wx, combined = 30, 25, 40, 28
    else:
        sat, img, wx, combined = 50, 50, 50, 50
        
    assessment = DamageAssessment(
        claim_id=claim_id,
        satellite_score=sat,
        image_score=img,
        weather_score=wx,
        combined_score=combined,
        confidence=0.92,
        explanation_json={
            "key_factors": [
                f"Satellite analysis score: {sat}/100",
                f"Farmer photos assessment: {img}/100",
                f"Weather validation indices: {wx}/100"
            ]
        }
    )
    
    db.add(assessment)
    await db.commit()
    await db.refresh(assessment)
    logger.info(f"Generated DamageAssessment for Claim {claim_id}: {combined_score_info(combined)}")
    return assessment

def combined_score_info(score):
    return f"Combined Score: {score}/100"
