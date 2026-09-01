import logging
from typing import Dict, Any, List, Tuple
from sqlalchemy import select
from app.models.models import SatelliteImage
from app.quality.checks import (
    check_geometric_integrity,
    check_radiometric_ranges,
    check_cloud_properties,
    check_temporal_duplicates
)

logger = logging.getLogger(__name__)

def calculate_image_quality_score(
    crs: str,
    resolution: float,
    bands_stats: List[Dict[str, Any]],
    cloud_cover: float,
    is_duplicate: bool = False
) -> Tuple[float, Dict[str, Any], bool]:
    """
    Computes a composite quality score (0-100) based on the formula:
      Score = geometric(25%) + radiometric(25%) + cloud(30%) + temporal(20%)
      
    Flags the image for manual review if composite score < 60.
    """
    # 1. Geometric Check (25%)
    geom_ok, _ = check_geometric_integrity(crs, resolution)
    geom_score = 100.0 if geom_ok else 0.0
    
    # 2. Radiometric Check (25%)
    radio_ok, _ = check_radiometric_ranges(bands_stats)
    radio_score = 100.0 if radio_ok else 0.0
    
    # 3. Cloud Check (30%)
    # Inverse of cloud cover percent (0% cloud -> 100 score, 100% cloud -> 0 score)
    cloud_score = max(0.0, min(100.0, 100.0 - cloud_cover))
    
    # 4. Temporal Check (20%)
    temporal_score = 0.0 if is_duplicate else 100.0
    
    # Calculate composite weighted score
    composite_score = (
        (geom_score * 0.25) +
        (radio_score * 0.25) +
        (cloud_score * 0.30) +
        (temporal_score * 0.20)
    )
    
    composite_score = round(composite_score, 2)
    
    # Flag for manual review if score < 60
    flag_for_review = composite_score < 60.0
    
    breakdown = {
        "geometric": geom_score,
        "radiometric": radio_score,
        "cloud": cloud_score,
        "temporal": temporal_score,
        "composite": composite_score
    }
    
    return composite_score, breakdown, flag_for_review

async def get_farm_quality_trends(db, farm_id: int) -> List[Dict[str, Any]]:
    """
    Retrieves the quality score trend over time for a specific farm.
    """
    try:
        stmt = select(SatelliteImage).where(
            SatelliteImage.farm_id == farm_id
        ).order_by(SatelliteImage.acquisition_date.asc())
        
        res = await db.execute(stmt)
        images = res.scalars().all()
        
        trends = []
        for img in images:
            # Reconstruct or pull metadata
            extra = img.extra_metadata or {}
            q_score = extra.get("quality_metrics", {}).get("composite")
            
            # If not calculated, compute on the fly
            if q_score is None:
                # Mock stats if not available
                bands_stats = extra.get("bands_stats", [{"name": "B2", "min": 100, "max": 8000}])
                q_score, breakdown, _ = calculate_image_quality_score(
                    img.crs, img.resolution, bands_stats, img.cloud_cover
                )
                
            trends.append({
                "image_id": img.id,
                "date": img.acquisition_date.strftime("%Y-%m-%d") if img.acquisition_date else None,
                "satellite": img.source,
                "quality_score": q_score
            })
        return trends
    except Exception as e:
        logger.error(f"Error fetching quality trends for farm {farm_id}: {e}")
        return []
