import logging
import numpy as np
from typing import List, Dict, Any, Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.models.models import Farm, SatelliteImage
from app.preprocessing.timeseries import align_time_series, interpolate_gaps

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/{farm_id}/alignment", response_model=dict)
async def get_timeseries_alignment(
    farm_id: int,
    start_date: date,
    end_date: date,
    frequency: str = "5D",
    db: AsyncSession = Depends(get_db)
):
    """
    Returns aligned date mappings for the farm between start_date and end_date.
    """
    # Fetch all satellite image dates for this farm in the range
    stmt = select(SatelliteImage.acquisition_date).where(
        SatelliteImage.farm_id == farm_id,
        SatelliteImage.acquisition_date >= start_date,
        SatelliteImage.acquisition_date <= end_date
    ).order_by(SatelliteImage.acquisition_date)
    
    res = await db.execute(stmt)
    available_dates = list(set(res.scalars().all()))
    
    grid_dates, aligned = align_time_series(available_dates, start_date, end_date, target_frequency=frequency)
    
    timeline = []
    for g, a in zip(grid_dates, aligned):
        timeline.append({
            "grid_date": g.strftime("%Y-%m-%d"),
            "matched_acquisition": a.strftime("%Y-%m-%d") if a else None,
            "status": "available" if a else "gap"
        })
        
    return {
        "farm_id": farm_id,
        "start_date": start_date,
        "end_date": end_date,
        "timeline": timeline
    }

@router.post("/{farm_id}/interpolate", response_model=dict)
async def trigger_gap_filling(
    farm_id: int,
    start_date: date,
    end_date: date,
    db: AsyncSession = Depends(get_db)
):
    """
    Triggers gap filling on the farm's timeseries satellite imagery data.
    """
    # Fetch the image dates
    stmt = select(SatelliteImage.acquisition_date).where(
        SatelliteImage.farm_id == farm_id,
        SatelliteImage.acquisition_date >= start_date,
        SatelliteImage.acquisition_date <= end_date
    ).order_by(SatelliteImage.acquisition_date)
    
    res = await db.execute(stmt)
    available_dates = list(set(res.scalars().all()))
    
    if not available_dates:
        raise HTTPException(status_code=404, detail="No satellite images found in the specified range.")
        
    grid_dates, aligned = align_time_series(available_dates, start_date, end_date)
    
    # Simulate reading band data: shape (T, 4, 4)
    t = len(grid_dates)
    band_data = np.zeros((t, 4, 4), dtype=np.float32)
    # Fill in valid dates with dummy values, leaving gaps as NaN
    for idx, matched in enumerate(aligned):
        if matched is None:
            band_data[idx] = np.nan
        else:
            band_data[idx] = np.random.rand(4, 4)
            
    # Run gap interpolations
    interpolated, metrics = interpolate_gaps(band_data, grid_dates, aligned)
    
    return {
        "farm_id": farm_id,
        "status": "completed",
        "interpolation_ratio": float(metrics["interpolation_ratio"]),
        "gap_count": int(metrics["gap_count"]),
        "temporal_coverage": float(metrics["temporal_coverage"])
    }

@router.get("/{farm_id}/gaps", response_model=dict)
async def list_time_series_gaps(
    farm_id: int,
    start_date: date,
    end_date: date,
    db: AsyncSession = Depends(get_db)
):
    """
    Lists all temporal data gaps and classifies their severity.
    """
    stmt = select(SatelliteImage.acquisition_date).where(
        SatelliteImage.farm_id == farm_id,
        SatelliteImage.acquisition_date >= start_date,
        SatelliteImage.acquisition_date <= end_date
    ).order_by(SatelliteImage.acquisition_date)
    
    res = await db.execute(stmt)
    available_dates = list(set(res.scalars().all()))
    
    grid_dates, aligned = align_time_series(available_dates, start_date, end_date)
    
    gaps = []
    current_gap_start = None
    
    import numpy as np
    for idx, matched in enumerate(aligned):
        if matched is None:
            if current_gap_start is None:
                current_gap_start = grid_dates[idx]
        else:
            if current_gap_start is not None:
                gap_end = grid_dates[idx - 1]
                duration_days = (gap_end - current_gap_start).days + 1
                severity = "severe" if duration_days > 30 else ("moderate" if duration_days >= 15 else "mild")
                gaps.append({
                    "start_date": current_gap_start.strftime("%Y-%m-%d"),
                    "end_date": gap_end.strftime("%Y-%m-%d"),
                    "duration_days": duration_days,
                    "severity": severity
                })
                current_gap_start = None
                
    if current_gap_start is not None:
        gap_end = grid_dates[-1]
        duration_days = (gap_end - current_gap_start).days + 1
        severity = "severe" if duration_days > 30 else ("moderate" if duration_days >= 15 else "mild")
        gaps.append({
            "start_date": current_gap_start.strftime("%Y-%m-%d"),
            "end_date": gap_end.strftime("%Y-%m-%d"),
            "duration_days": duration_days,
            "severity": severity
        })
        
    return {
        "farm_id": farm_id,
        "total_gaps": len(gaps),
        "gaps": gaps
    }
