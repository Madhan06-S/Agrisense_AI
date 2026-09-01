from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, List, Optional
import tempfile
import uuid
import os
import logging
from app.core.database import get_db
from app.models.models import Farm, SatelliteImage
from app.quality.scoring import get_farm_quality_trends, calculate_image_quality_score
from app.quality.reporter import generate_monthly_pdf_report, check_consecutive_drops
from sqlalchemy import select

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/{farm_id}/score")
async def get_farm_score_trend(farm_id: int, db: AsyncSession = Depends(get_db)):
    """Returns composite quality score trend over time for a farm."""
    trends = await get_farm_quality_trends(db, farm_id)
    if not trends:
        # Check if farm exists
        result = await db.execute(select(Farm).where(Farm.id == farm_id))
        if not result.scalars().first():
            raise HTTPException(status_code=404, detail="Farm not found.")
    return trends

@router.get("/{farm_id}/report")
async def get_monthly_report(
    farm_id: int,
    month: str = Query(..., description="Month name (e.g. July)"),
    year: int = Query(..., description="Year (e.g. 2026)"),
    db: AsyncSession = Depends(get_db)
):
    """Generates and serves the monthly farm data quality report in PDF format."""
    # Find farm
    result = await db.execute(select(Farm).where(Farm.id == farm_id))
    farm = result.scalars().first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found.")

    months = {
        "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
        "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12
    }
    m_num = months.get(month.lower())
    if not m_num:
        raise HTTPException(status_code=400, detail="Invalid month name.")

    # Select all images for the month/year
    stmt = select(SatelliteImage).where(SatelliteImage.farm_id == farm_id)
    img_res = await db.execute(stmt)
    images = img_res.scalars().all()
    
    acquisitions = []
    for img in images:
        if img.acquisition_date.month == m_num and img.acquisition_date.year == year:
            extra = img.extra_metadata or {}
            metrics = extra.get("quality_metrics", {})
            score = metrics.get("composite")
            if score is None:
                score = 100.0 - img.cloud_cover
            acquisitions.append({
                "date": img.acquisition_date.strftime("%Y-%m-%d"),
                "satellite": img.source,
                "cloud_cover": img.cloud_cover,
                "quality_score": score
            })

    if not acquisitions:
        raise HTTPException(status_code=404, detail="No acquisitions found for this period.")

    # Generate PDF in a temporary folder
    temp_dir = tempfile.mkdtemp()
    pdf_path = os.path.join(temp_dir, f"farm_{farm_id}_report.pdf")
    
    generate_monthly_pdf_report(
        farm.name,
        farm.crop_type,
        farm.district,
        farm.state,
        month,
        year,
        acquisitions,
        pdf_path
    )

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"AgriSense_Report_Farm_{farm_id}_{month}_{year}.pdf"
    )

@router.get("/{image_id}/checks")
async def get_image_checks(image_id: int, db: AsyncSession = Depends(get_db)):
    """Retrieves breakdown metrics of geometric, cloud, and radiometric checks for an image."""
    result = await db.execute(select(SatelliteImage).where(SatelliteImage.id == image_id))
    img = result.scalars().first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found.")
        
    extra = img.extra_metadata or {}
    metrics = extra.get("quality_metrics")
    if not metrics:
        # Calculate
        score, breakdown, review = calculate_image_quality_score(
            img.crs, img.resolution, [], img.cloud_cover
        )
        metrics = breakdown
        metrics["review_required"] = review
        metrics["composite"] = score

    return {
        "image_id": img.id,
        "satellite": img.source,
        "cloud_cover": img.cloud_cover,
        "resolution": img.resolution,
        "crs": img.crs,
        "quality_score": metrics.get("composite", 100.0 - img.cloud_cover),
        "breakdown": metrics
    }

# Background jobs dictionary
BATCH_JOBS: Dict[str, Dict[str, Any]] = {}

async def run_batch_quality_check(job_id: str, image_ids: List[int], db_session_factory):
    BATCH_JOBS[job_id] = {"status": "running", "progress": 0, "processed": 0, "total": len(image_ids)}
    
    async with db_session_factory() as db:
        processed = 0
        for img_id in image_ids:
            try:
                result = await db.execute(select(SatelliteImage).where(SatelliteImage.id == img_id))
                img = result.scalars().first()
                if img:
                    score, breakdown, review = calculate_image_quality_score(
                        img.crs, img.resolution, [], img.cloud_cover
                    )
                    extra = img.extra_metadata or {}
                    extra["quality_metrics"] = {
                        "composite": score,
                        "breakdown": breakdown,
                        "review_required": review
                    }
                    img.extra_metadata = extra
                    await db.commit()
                    
                    # Check consecutive drops
                    await check_consecutive_drops(db, img.farm_id)
            except Exception as e:
                logger.error(f"Error checking image {img_id} in batch quality run: {e}")
                
            processed += 1
            BATCH_JOBS[job_id]["processed"] = processed
            BATCH_JOBS[job_id]["progress"] = int((processed / len(image_ids)) * 100)
            
        BATCH_JOBS[job_id]["status"] = "success"

@router.post("/batch-check")
async def trigger_batch_check(
    image_ids: List[int],
    background_tasks: BackgroundTasks
):
    """Asynchronously triggers a quality review batch job."""
    from app.core.database import AsyncSessionLocal
    job_id = str(uuid.uuid4())
    BATCH_JOBS[job_id] = {"status": "pending", "progress": 0, "processed": 0, "total": len(image_ids)}
    background_tasks.add_task(run_batch_quality_check, job_id, image_ids, AsyncSessionLocal)
    return {"job_id": job_id, "status": "pending"}

@router.get("/batch-check/{job_id}")
async def get_batch_check_status(job_id: str):
    """Retrieves status and progress parameters of a triggered batch check job."""
    job = BATCH_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job
