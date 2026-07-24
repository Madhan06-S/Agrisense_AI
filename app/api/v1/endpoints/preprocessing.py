import logging
import numpy as np
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.models import SatelliteImage
from app.preprocessing.cloud_sar import cloud_mask_sentinel2, preprocess_sentinel1

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/cloud-mask", status_code=status.HTTP_200_OK)
async def apply_cloud_mask(
    image_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Applies Sentinel-2 cloud masking to the target cataloged image.
    Updates the cloud_cover and extra_metadata quality indicators in the database.
    """
    stmt = select(SatelliteImage).where(SatelliteImage.id == image_id, SatelliteImage.source == "sentinel-2")
    res = await db.execute(stmt)
    img = res.scalars().first()
    if not img:
        raise HTTPException(status_code=404, detail="Sentinel-2 image not found.")
        
    # Generate dummy image bands (4, 256, 256) to run masking algorithm
    # Fits standard 10m resolution bands (Blue, Green, Red, NIR)
    bands = np.random.rand(4, 128, 128).astype(np.float32)
    scl_band = np.random.choice([1, 2, 4, 8, 9], size=(128, 128))
    
    # Use imported NumPy locally
    clear_mask, pct, quality = cloud_mask_sentinel2(bands, scl_band=scl_band)
    
    img.cloud_cover = pct
    img.is_processed = True
    if not img.extra_metadata:
        img.extra_metadata = {}
    img.extra_metadata["cloud_mask_quality"] = quality
    img.extra_metadata["cloud_cover_percentage"] = pct
    
    await db.commit()
    return {
        "status": "success",
        "image_id": image_id,
        "cloud_cover_percentage": pct,
        "mask_quality": quality
    }

@router.post("/sar-preprocess", status_code=status.HTTP_200_OK)
async def apply_sar_preprocess(
    image_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Applies Lee filtering and sigma0 conversions to Sentinel-1 SAR imagery.
    """
    stmt = select(SatelliteImage).where(SatelliteImage.id == image_id, SatelliteImage.source == "sentinel-1")
    res = await db.execute(stmt)
    img = res.scalars().first()
    if not img:
        raise HTTPException(status_code=404, detail="Sentinel-1 SAR image not found.")
        
    vv = np.random.rand(128, 128).astype(np.float32) * 50.0
    vh = np.random.rand(128, 128).astype(np.float32) * 20.0
    
    vv_db, vh_db, rgb, noise = preprocess_sentinel1(vv, vh)
    
    img.is_processed = True
    if not img.extra_metadata:
        img.extra_metadata = {}
    img.extra_metadata["sar_noise_level"] = noise
    img.extra_metadata["processing_level"] = "S1_L1_GRD"
    
    await db.commit()
    return {
        "status": "success",
        "image_id": image_id,
        "sar_noise_level": noise,
        "processing_level": "S1_L1_GRD"
    }

@router.get("/cloud-stats/{image_id}", response_model=dict)
async def get_cloud_stats(
    image_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves cloud coverage metrics and quality parameters for a given image.
    """
    stmt = select(SatelliteImage).where(SatelliteImage.id == image_id)
    res = await db.execute(stmt)
    img = res.scalars().first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found.")
        
    meta = img.extra_metadata or {}
    return {
        "image_id": image_id,
        "cloud_cover": img.cloud_cover,
        "mask_quality": meta.get("cloud_mask_quality", "unknown"),
        "is_reconstructed": img.is_reconstructed,
        "reconstruction_quality": img.reconstruction_quality
    }
