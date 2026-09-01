import logging
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from sqlalchemy import select, and_, func
from app.models.models import SatelliteImage, Farm, FeatureVector

logger = logging.getLogger(__name__)

async def register_image_metadata(db, image_id: int, metadata: Dict[str, Any]) -> bool:
    """Stores per-image metadata inside the extra_metadata JSON column."""
    try:
        stmt = select(SatelliteImage).where(SatelliteImage.id == image_id)
        res = await db.execute(stmt)
        img = res.scalars().first()
        if not img:
            logger.warning(f"Image {image_id} not found to register metadata.")
            return False

        # Load existing extra_metadata or create new dict
        extra = img.extra_metadata or {}
        # Merge properties
        extra.update(metadata)
        img.extra_metadata = extra
        
        # Sync standard fields if provided in metadata
        if "cloud_cover" in metadata:
            img.cloud_cover = float(metadata["cloud_cover"])
        if "resolution" in metadata:
            img.resolution = float(metadata["resolution"])
        if "crs" in metadata:
            img.crs = str(metadata["crs"])
            
        await db.commit()
        logger.info(f"Registered metadata for image {image_id}")
        return True
    except Exception as e:
        logger.error(f"Error registering image metadata: {e}")
        return False

async def update_farm_metadata(db, farm_id: int) -> Optional[Dict[str, Any]]:
    """
    Computes per-farm metadata dynamically:
    - total_images
    - date_range_coverage (start to end dates)
    - data_quality_score (average cloud-free quality score or composite score)
    - last_updated
    Saves it to the Farm.extra_metadata column and returns it.
    """
    try:
        # Get farm
        farm_stmt = select(Farm).where(Farm.id == farm_id)
        farm_res = await db.execute(farm_stmt)
        farm = farm_res.scalars().first()
        if not farm:
            return None

        # Count total images
        img_stmt = select(
            func.count(SatelliteImage.id).label("total"),
            func.min(SatelliteImage.acquisition_date).label("min_date"),
            func.max(SatelliteImage.acquisition_date).label("max_date"),
            func.avg(SatelliteImage.cloud_cover).label("avg_cloud")
        ).where(SatelliteImage.farm_id == farm_id)
        
        img_res = await db.execute(img_stmt)
        img_stats = img_res.first()
        
        total_images = img_stats.total if img_stats else 0
        min_date = img_stats.min_date.strftime("%Y-%m-%d") if img_stats and img_stats.min_date else None
        max_date = img_stats.max_date.strftime("%Y-%m-%d") if img_stats and img_stats.max_date else None
        
        # Calculate a simple quality score: 100 - avg_cloud_cover
        avg_cloud = img_stats.avg_cloud if img_stats and img_stats.avg_cloud is not None else 0.0
        data_quality_score = max(0.0, min(100.0, 100.0 - avg_cloud))

        farm_meta = {
            "total_images": total_images,
            "date_range_coverage": {
                "start": min_date,
                "end": max_date
            },
            "data_quality_score": round(data_quality_score, 2),
            "last_updated": datetime.utcnow().isoformat()
        }

        farm.extra_metadata = farm_meta
        await db.commit()
        return farm_meta
    except Exception as e:
        logger.error(f"Error updating farm metadata: {e}")
        return None

async def register_lineage(
    db, child_type: str, child_id: int, parent_type: str, parent_id: int
) -> bool:
    """
    Stores lineage link inside the child's extra_metadata:
    e.g., parent_image -> processed_image -> reconstructed_image -> feature_vector
    """
    try:
        if child_type == "processed_image" or child_type == "reconstructed_image":
            stmt = select(SatelliteImage).where(SatelliteImage.id == child_id)
            res = await db.execute(stmt)
            obj = res.scalars().first()
        elif child_type == "feature_vector":
            stmt = select(FeatureVector).where(FeatureVector.id == child_id)
            res = await db.execute(stmt)
            obj = res.scalars().first()
        else:
            raise ValueError(f"Unknown child type: {child_type}")

        if not obj:
            logger.warning(f"Child {child_id} ({child_type}) not found for lineage registration.")
            return False

        extra = obj.extra_metadata or {}
        lineage = extra.get("lineage", {})
        lineage[f"parent_{parent_type}_id"] = parent_id
        extra["lineage"] = lineage
        obj.extra_metadata = extra

        await db.commit()
        logger.info(f"Registered lineage link: parent_{parent_type}_id={parent_id} -> {child_type}={child_id}")
        return True
    except Exception as e:
        logger.error(f"Error registering lineage: {e}")
        return False

async def get_image_lineage(db, image_id: int) -> Dict[str, Any]:
    """Retrieves the full ancestry and descent of an image."""
    try:
        stmt = select(SatelliteImage).where(SatelliteImage.id == image_id)
        res = await db.execute(stmt)
        img = res.scalars().first()
        if not img:
            return {}

        extra = img.extra_metadata or {}
        lineage = extra.get("lineage", {})

        return {
            "image_id": image_id,
            "parents": {
                "parent_image_id": lineage.get("parent_image_id"),
                "parent_processed_image_id": lineage.get("parent_processed_image_id")
            },
            "properties": {
                "source": img.source,
                "acquisition_date": img.acquisition_date.strftime("%Y-%m-%d") if img.acquisition_date else None,
                "is_processed": img.is_processed,
                "is_reconstructed": img.is_reconstructed
            }
        }
    except Exception as e:
        logger.error(f"Error getting lineage: {e}")
        return {}

async def query_images_metadata(
    db,
    farm_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    satellite: Optional[str] = None,
    min_quality: Optional[float] = None
) -> List[Dict[str, Any]]:
    """Queries images by date range, satellite, quality threshold."""
    try:
        query = select(SatelliteImage)
        filters = []

        if farm_id is not None:
            filters.append(SatelliteImage.farm_id == farm_id)

        if start_date:
            filters.append(SatelliteImage.acquisition_date >= datetime.strptime(start_date, "%Y-%m-%d").date())
        if end_date:
            filters.append(SatelliteImage.acquisition_date <= datetime.strptime(end_date, "%Y-%m-%d").date())

        if satellite:
            filters.append(SatelliteImage.source == satellite.lower())

        if min_quality is not None:
            # We treat (100 - cloud_cover) as a proxy for quality if not reconstructed,
            # or use reconstruction_quality if reconstructed.
            # For simplicity, filter on cloud_cover <= (100 - min_quality)
            filters.append(SatelliteImage.cloud_cover <= (100.0 - min_quality))

        if filters:
            query = query.where(and_(*filters))

        res = await db.execute(query)
        images = res.scalars().all()

        results = []
        for img in images:
            results.append({
                "id": img.id,
                "farm_id": img.farm_id,
                "satellite": img.source,
                "acquisition_date": img.acquisition_date.strftime("%Y-%m-%d") if img.acquisition_date else None,
                "resolution": img.resolution,
                "cloud_cover": img.cloud_cover,
                "crs": img.crs,
                "file_path": img.file_path,
                "is_processed": img.is_processed,
                "is_reconstructed": img.is_reconstructed,
                "reconstruction_quality": img.reconstruction_quality,
                "metadata": img.extra_metadata or {}
            })
        return results
    except Exception as e:
        logger.error(f"Error querying images: {e}")
        return []
