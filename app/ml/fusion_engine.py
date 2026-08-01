from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import DamageAssessment, Claim

async def run_fusion_pipeline(claim_id: int, db: AsyncSession):
    """Mock fusion pipeline for demo. Compatible with AsyncSession."""
    # Check if assessment already exists
    stmt = select(DamageAssessment).where(DamageAssessment.claim_id == claim_id)
    res = await db.execute(stmt)
    existing = res.scalars().first()
    if existing:
        return existing
    
    # Create mock assessment based on claim type
    stmt_claim = select(Claim).where(Claim.id == claim_id)
    res_claim = await db.execute(stmt_claim)
    claim = res_claim.scalars().first()
    if not claim:
        return None
    
    # Demo logic: Flood = high score, Pest = medium, Drought = variable
    if claim.claim_type == "flood":
        sat, img, wx, combined = 82, 88, 90, 85
    elif claim.claim_type == "drought":
        sat, img, wx, combined = 65, 45, 70, 58
    elif claim.claim_type == "pest":
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
