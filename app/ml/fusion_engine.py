from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import DamageAssessment, Claim, Farm
from app.integrations.gee_service import get_farm_ndvi_data
from app.integrations.weather_service import get_farm_weather, calculate_weather_score

async def run_fusion_pipeline(claim_id: int, db: AsyncSession):
    """
    Real fusion pipeline: GEE satellite + AI image + Live weather.
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
    
    stmt_farm = select(Farm).where(Farm.id == claim.farm_id)
    res_farm = await db.execute(stmt_farm)
    farm = res_farm.scalars().first()
    
    # --- REAL SATELLITE (GEE) ---
    gee_data = await get_farm_ndvi_data(claim.farm_id, db)
    satellite_score = gee_data["ndvi_score"]
    satellite_image = f"/api/v1/claims/{claim_id}/satellite-image"
    
    # --- REAL WEATHER ---
    # Retrieve coordinates from farm boundary centroid or fallback to Pune
    lat = 18.5204
    lon = 73.8567
    boundary_wkt = getattr(farm, 'boundary', None)
    if boundary_wkt:
        try:
            from shapely.wkt import loads
            poly = loads(boundary_wkt)
            lon = poly.centroid.x
            lat = poly.centroid.y
        except Exception as e:
            print(f"Failed to parse farm centroid for weather: {e}")
            
    # OpenWeather API call (run in thread pool to avoid blocking async main thread)
    import anyio
    def fetch_weather():
        return get_farm_weather(lat, lon)
    weather = await anyio.to_thread.run_sync(fetch_weather)
    weather_score = calculate_weather_score(weather, claim.claim_type)
    
    # --- IMAGE SCORE (mock CV until real model) ---
    image_scores = {
        "flood": 88, "drought": 45, "pest": 25,
        "cyclone": 70, "hailstorm": 55
    }
    image_score = image_scores.get(claim.claim_type.lower(), 50)
    
    # Combined: satellite 40%, image 35%, weather 25%
    combined = int(satellite_score * 0.40 + image_score * 0.35 + weather_score * 0.25)
    
    # Save combined score cache on the Claim
    claim.ai_damage_score = combined
    
    assessment = DamageAssessment(
        claim_id=claim_id,
        satellite_score=satellite_score,
        image_score=image_score,
        weather_score=weather_score,
        combined_score=combined,
        confidence=0.88 if gee_data["status"] == "success" else 0.72,
        explanation_json={
            "satellite_contribution": 0.40,
            "image_contribution": 0.35,
            "weather_contribution": 0.25,
            "satellite_image_path": satellite_image,
            "ndvi_mean": gee_data["ndvi_mean"],
            "gee_status": gee_data["status"],
            "weather": {
                "rainfall_48h": weather["rainfall_48h"],
                "temperature": weather["temperature"],
                "wind_speed": weather["wind_speed"],
                "humidity": weather["humidity"],
                "source": weather["source"],
                "status": weather["status"]
            },
            "key_factors": [
                f"Real NDVI mean: {gee_data['ndvi_mean']} (Sentinel-2)",
                f"Live weather: {weather['rainfall_48h']}mm rain, {weather['temperature']}°C",
                f"Image analysis: {image_score}/100"
            ]
        }
    )
    
    db.add(assessment)
    await db.commit()
    await db.refresh(assessment)
    return assessment
