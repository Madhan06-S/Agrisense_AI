from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.core.database import get_db
from app.catalog.metadata_store import query_images_metadata, get_image_lineage, update_farm_metadata
from app.catalog.versioning import create_version, rollback_to_version
from app.catalog.search import search_farms_catalog
from app.models.models import DatasetVersion, SatelliteImage
from sqlalchemy import select

router = APIRouter()

@router.get("/images")
async def get_images(
    farm_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    satellite: Optional[str] = None,
    min_quality: Optional[float] = None,
    db: AsyncSession = Depends(get_db)
):
    """Finds images matching dates, satellites, and quality thresholds."""
    return await query_images_metadata(db, farm_id, start_date, end_date, satellite, min_quality)

@router.get("/images/{image_id}/metadata")
async def get_image_metadata(image_id: int, db: AsyncSession = Depends(get_db)):
    """Retrieves full metadata associated with a single image ID."""
    result = await db.execute(select(SatelliteImage).where(SatelliteImage.id == image_id))
    img = result.scalars().first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found.")
    return {
        "image_id": img.id,
        "satellite": img.source,
        "acquisition_date": img.acquisition_date.strftime("%Y-%m-%d") if img.acquisition_date else None,
        "cloud_cover": img.cloud_cover,
        "resolution": img.resolution,
        "crs": img.crs,
        "file_path": img.file_path,
        "extra_metadata": img.extra_metadata or {}
    }

@router.get("/images/{image_id}/lineage")
async def get_image_lineage_endpoint(image_id: int, db: AsyncSession = Depends(get_db)):
    """Retrieves standard processing lineage links for an image."""
    return await get_image_lineage(db, image_id)

@router.get("/farms/{farm_id}/coverage")
async def get_farm_coverage(farm_id: int, db: AsyncSession = Depends(get_db)):
    """Triggers dynamic recalculation of farm image coverage metrics."""
    meta = await update_farm_metadata(db, farm_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Farm not found.")
    return meta

@router.get("/versions")
async def list_versions(db: AsyncSession = Depends(get_db)):
    """Retrieves list of all dataset versions recorded in the database."""
    result = await db.execute(select(DatasetVersion).order_by(DatasetVersion.timestamp.desc()))
    versions = result.scalars().all()
    return [{
        "id": v.id,
        "version": v.version,
        "timestamp": v.timestamp.isoformat(),
        "commit_hash": v.commit_hash,
        "schema_version": v.schema_version,
        "checksum": v.checksum
    } for v in versions]

@router.post("/versions")
async def create_new_version(
    version_tag: str = Query(...),
    commit_hash: str = Query(...),
    schema_version: str = "1.0",
    db: AsyncSession = Depends(get_db)
):
    """Tags current database snapshot with a new semantic version."""
    ver = await create_version(db, version_tag, commit_hash, schema_version)
    if not ver:
        raise HTTPException(status_code=400, detail="Failed to create version. Tag may already exist.")
    return {"status": "created", "version": ver.version}

@router.post("/versions/{version_id}/rollback")
async def rollback_to_dataset_version(version_id: str, db: AsyncSession = Depends(get_db)):
    """Restores database collections to match a target version state."""
    success = await rollback_to_version(db, version_id)
    if not success:
        raise HTTPException(status_code=400, detail="Rollback failed. Verify the version tag.")
    return {"status": "success", "message": f"Rolled back to version {version_id}"}

@router.get("/search")
async def search_catalog(
    q: str = Query("", description="Query keyword"),
    state: Optional[str] = None,
    district: Optional[str] = None,
    crop_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Faceted text search matching farm profile metadata."""
    return await search_farms_catalog(db, q, state, district, crop_type)
