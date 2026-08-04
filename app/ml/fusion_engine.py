from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import DamageAssessment, Claim
from app.integrations.gee_service import get_farm_ndvi_data

async def run_fusion_pipeline(claim_id: int, db: AsyncSession):
    """
    Real fusion pipeline with GEE satellite data + mock image/weather.
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
    
    # --- REAL SATELLITE DATA FROM GEE ---
    gee_result = await get_farm_ndvi_data(claim.farm_id, db)
    satellite_score = gee_result["ndvi_score"]
    satellite_image = f"/api/v1/claims/{claim_id}/satellite-image"
    ndvi_mean = gee_result["ndvi_mean"]
    
    # --- MOCK IMAGE & WEATHER (replace with real CV later) ---
    image_scores = {
        "flood": 88, "drought": 45, "pest": 25,
        "cyclone": 70, "hailstorm": 55
    }
    image_score = image_scores.get(claim.claim_type.lower(), 50)
    
    weather_scores = {
        "flood": 90, "drought": 70, "pest": 40,
        "cyclone": 80, "hailstorm": 65
    }
    weather_score = weather_scores.get(claim.claim_type.lower(), 50)
    
    # Combined: weighted average
    combined = int(satellite_score * 0.40 + image_score * 0.35 + weather_score * 0.25)
    
    # Also save the computed combined score on the Claim itself as cache/reference
    claim.ai_damage_score = combined
    
    assessment = DamageAssessment(
        claim_id=claim_id,
        satellite_score=satellite_score,
        image_score=image_score,
        weather_score=weather_score,
        combined_score=combined,
        confidence=0.88 if gee_result["status"] == "success" else 0.65,
        explanation_json={
            "satellite_contribution": 0.40,
            "image_contribution": 0.35,
            "weather_contribution": 0.25,
            "satellite_image_path": satellite_image,
            "ndvi_mean": ndvi_mean,
            "gee_status": gee_result["status"],
            "key_factors": [
                f"Real NDVI mean: {ndvi_mean} (Sentinel-2)",
                f"Image analysis: {image_score}/100",
                f"Weather validation: {weather_score}/100"
            ]
        }
    )
    
    db.add(assessment)
    await db.commit()
    await db.refresh(assessment)
    return assessment
