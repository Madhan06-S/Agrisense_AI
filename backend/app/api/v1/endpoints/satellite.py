import logging
from typing import List, Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.models.models import SatelliteImage, FeatureVector, DataPipelineRun, Farm
from app.schemas.schemas import SatelliteImageRead, FeatureVectorRead, DataPipelineRunRead
# Import Celery tasks
from app.tasks.satellite_tasks import fetch_satellite_data, preprocess_images

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/fetch", response_model=dict, status_code=status.HTTP_202_ACCEPTED)
async def trigger_satellite_fetch(
    farm_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Triggers satellite ingestion pipeline asynchronously.
    Queues a Celery task and returns the pipeline run state.
    """
    # Verify farm exists
    farm_result = await db.execute(select(Farm).where(Farm.id == farm_id, Farm.is_deleted == False))
    farm = farm_result.scalars().first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found.")

    # Defaults
    if not start_date:
        # Default to farm sowing date or 30 days ago
        start_date = max(farm.sowing_date, date.today() - timedelta(days=30))
    if not end_date:
        end_date = date.today()

    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")

    # Create Pipeline Run record
    run = DataPipelineRun(
        farm_id=farm_id,
        run_type="fetch",
        status="pending"
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    # Queue background task via Celery
    task = fetch_satellite_data.delay(farm_id, start_str, end_str)

    return {
        "message": "Satellite imagery ingestion queued successfully.",
        "pipeline_run_id": run.id,
        "celery_task_id": task.id,
        "status": "pending"
    }

@router.get("/{farm_id}/images", response_model=List[SatelliteImageRead])
async def list_images(
    farm_id: int,
    source: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Lists all cataloged images for a farm."""
    query = select(SatelliteImage).where(SatelliteImage.farm_id == farm_id)
    if source:
        query = query.where(SatelliteImage.source == source)
    
    query = query.order_by(desc(SatelliteImage.acquisition_date))
    result = await db.execute(query)
    images = result.scalars().all()
    return images

@router.get("/{farm_id}/latest", response_model=SatelliteImageRead)
async def get_latest_image(farm_id: int, db: AsyncSession = Depends(get_db)):
    """Retrieves the single most recent satellite image metadata for a farm."""
    query = (
        select(SatelliteImage)
        .where(SatelliteImage.farm_id == farm_id)
        .order_by(desc(SatelliteImage.acquisition_date))
        .limit(1)
    )
    result = await db.execute(query)
    img = result.scalars().first()
    if not img:
        raise HTTPException(status_code=404, detail="No satellite images found for this farm.")
    return img

@router.get("/{farm_id}/timeline", response_model=dict)
async def get_image_timeline(farm_id: int, db: AsyncSession = Depends(get_db)):
    """
    Returns a summarized availability timeline (dates and satellite sources)
    for dashboard plotting.
    """
    query = (
        select(SatelliteImage.acquisition_date, SatelliteImage.source, SatelliteImage.is_processed)
        .where(SatelliteImage.farm_id == farm_id)
        .order_by(SatelliteImage.acquisition_date)
    )
    result = await db.execute(query)
    rows = result.all()
    
    timeline = []
    for row in rows:
        timeline.append({
            "date": row[0].strftime("%Y-%m-%d"),
            "satellite": row[1],
            "is_processed": row[2]
        })
        
    return {
        "farm_id": farm_id,
        "total_records": len(timeline),
        "timeline": timeline
    }

@router.post("/process", response_model=dict, status_code=status.HTTP_202_ACCEPTED)
async def trigger_preprocessing(
    farm_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Manually triggers image preprocessing for all unprocessed imagery of a farm.
    """
    # Check if there are unprocessed images
    query = select(SatelliteImage).where(
        SatelliteImage.farm_id == farm_id,
        SatelliteImage.is_processed == False
    )
    result = await db.execute(query)
    unprocessed = result.scalars().all()
    if not unprocessed:
        return {"message": "All images are already processed. No action required."}

    # Create run record
    run = DataPipelineRun(
        farm_id=farm_id,
        run_type="preprocess",
        status="pending"
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    # Queue celery task
    task = preprocess_images.delay(farm_id, run.id)

    return {
        "message": "Preprocessing pipeline triggered.",
        "pipeline_run_id": run.id,
        "celery_task_id": task.id,
        "status": "pending"
    }

@router.get("/{farm_id}/features", response_model=List[FeatureVectorRead])
async def get_feature_timeline(
    farm_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves the timeseries vegetation indices and trend feature vectors for a farm.
    Used by charting dashboards.
    """
    query = select(FeatureVector).where(FeatureVector.farm_id == farm_id)
    if start_date:
        query = query.where(FeatureVector.date >= start_date)
    if end_date:
        query = query.where(FeatureVector.date <= end_date)
        
    query = query.order_by(FeatureVector.date)
    result = await db.execute(query)
    features = result.scalars().all()
    return features
