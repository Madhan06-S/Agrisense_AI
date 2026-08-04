from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import DamageAssessment, Claim

async def run_fusion_pipeline(claim_id: int, db: AsyncSession):
    """
    Mock fusion pipeline for demo.
    Returns existing assessment if already created.
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
    
    # Score mapping by claim type
    scores = {
        "flood":    (82, 88, 90, 85),
        "drought":  (65, 45, 70, 58),
        "pest":     (30, 25, 40, 28),
        "cyclone":  (75, 70, 80, 72),
        "hailstorm":(60, 55, 65, 58),
    }
    
    sat, img, wx, combined = scores.get(claim.claim_type.lower(), (50, 50, 50, 50))
    
    assessment = DamageAssessment(
        claim_id=claim_id,
        satellite_score=sat,
        image_score=img,
        weather_score=wx,
        combined_score=combined,
        confidence=0.92,
        explanation_json={
            "satellite_contribution": 0.35,
            "image_contribution": 0.35,
            "weather_contribution": 0.30,
            "key_factors": [
                f"NDVI drop detected: {sat}%",
                f"Image analysis confidence: {img}%",
                f"Weather validation: {wx}%"
            ]
        }
    )
    
    db.add(assessment)
    await db.commit()
    await db.refresh(assessment)
    return assessment
