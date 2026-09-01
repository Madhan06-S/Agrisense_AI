import logging
from typing import List, Dict, Any, Optional
from datetime import date, timedelta
import numpy as np
import random
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.models.models import Farm, FeatureVector
from app.schemas.schemas import FeatureVectorRead
from app.features.indices import compute_all_indices
from app.features.fusion import (
    fuse_features,
    fuse_dataset,
    impute_missing,
    normalize_zscore,
    rank_features,
    FEATURE_NAMES
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Request Schemas
class ComputeRequest(BaseModel):
    red: float
    green: float
    blue: float
    nir: float
    rededge: Optional[float] = None
    swir1: float = 0.0
    swir2: float = 0.0
    historical_ndvi: Optional[List[float]] = None
    current_rainfall: Optional[float] = None
    mean_rainfall: Optional[float] = None
    temperature: Optional[float] = None

class FuseRequest(BaseModel):
    optical: List[Dict[str, float]]
    sar: List[Dict[str, float]]
    weather: List[Dict[str, float]]
    soil: List[Dict[str, float]]
    target: List[float]

# Helper to generate mock feature vector
def generate_mock_feature_vector(farm_id: int, target_date: date, time_step_index: int = 2) -> FeatureVector:
    # Simulates growing season progression: peak health in mid-season, stressed or damaged towards end or early start
    # time_step_index ranges from 0 to 4 (matching dates from June 1 to July 24)
    # NDVI peaks around step 2 (late June)
    base_ndvi = 0.65 - 0.2 * abs(2 - time_step_index)
    ndvi = max(0.15, min(0.85, base_ndvi + random.uniform(-0.05, 0.05)))
    
    # NDWI is inverse to NDVI (stressed plants have lower moisture, standing water is high positive)
    ndwi = max(-0.5, min(0.3, -0.4 * ndvi + random.uniform(-0.1, 0.1)))
    
    evi = max(0.1, min(0.8, 0.9 * ndvi - 0.05 + random.uniform(-0.05, 0.05)))
    savi = max(0.1, min(0.8, 0.85 * ndvi + random.uniform(-0.05, 0.05)))
    gndvi = max(0.1, min(0.8, 0.8 * ndvi + random.uniform(-0.05, 0.05)))
    ndre = max(0.05, min(0.6, 0.6 * ndvi + random.uniform(-0.05, 0.05)))
    
    msi = max(0.2, min(2.0, 1.2 - 0.8 * ndvi + random.uniform(-0.1, 0.1)))
    ndbi = max(-0.8, min(0.2, -0.6 * ndvi + random.uniform(-0.1, 0.1)))
    nbr = max(-0.3, min(0.8, 0.7 * ndvi + random.uniform(-0.1, 0.1)))
    gci = max(0.5, min(5.0, 4.0 * ndvi + random.uniform(-0.2, 0.2)))
    
    # Trends and stress
    ndvi_trend = -0.1 if time_step_index > 2 else (0.1 if time_step_index < 2 else 0.0)
    ndvi_trend += random.uniform(-0.02, 0.02)
    
    rainfall_anomaly = float(random.uniform(-15.0, 25.0))
    temperature_stress = float(max(0.0, random.uniform(28.0, 34.0) - 30.0))

    return FeatureVector(
        farm_id=farm_id,
        date=target_date,
        ndvi=round(ndvi, 4),
        ndwi=round(ndwi, 4),
        evi=round(evi, 4),
        savi=round(savi, 4),
        gndvi=round(gndvi, 4),
        ndre=round(ndre, 4),
        msi=round(msi, 4),
        ndbi=round(ndbi, 4),
        nbr=round(nbr, 4),
        gci=round(gci, 4),
        ndvi_trend=round(ndvi_trend, 4),
        rainfall_anomaly=round(rainfall_anomaly, 2),
        temperature_stress=round(temperature_stress, 2),
        is_valid=True
    )

@router.post("/compute", response_model=Dict[str, float])
async def compute_features(payload: ComputeRequest):
    """
    Computes all 10 indices and derived metrics from cleaned band values.
    """
    try:
        results = compute_all_indices(
            red=payload.red,
            green=payload.green,
            blue=payload.blue,
            nir=payload.nir,
            rededge=payload.rededge,
            swir1=payload.swir1,
            swir2=payload.swir2,
            historical_ndvi=payload.historical_ndvi,
            current_rainfall=payload.current_rainfall,
            mean_rainfall=payload.mean_rainfall,
            temperature=payload.temperature
        )
        return results
    except Exception as e:
        logger.error(f"Error computing indices: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to compute indices: {e}"
        )

@router.get("/{farm_id}/latest", response_model=FeatureVectorRead)
async def get_latest_features(farm_id: int, db: AsyncSession = Depends(get_db)):
    """
    Retrieves the latest computed vegetation indices for the farm.
    If no record exists, generates a simulated one, saves it, and returns it.
    """
    stmt = select(FeatureVector).where(
        FeatureVector.farm_id == farm_id,
        FeatureVector.is_valid == True
    ).order_by(desc(FeatureVector.date)).limit(1)
    
    res = await db.execute(stmt)
    feat = res.scalars().first()
    
    if not feat:
        logger.info(f"No FeatureVector found for farm {farm_id}. Generating mock latest data.")
        # Check if the farm exists
        farm_stmt = select(Farm).where(Farm.id == farm_id)
        farm_res = await db.execute(farm_stmt)
        farm = farm_res.scalars().first()
        if not farm:
            raise HTTPException(status_code=404, detail="Farm not found.")
            
        # Generate and save mock vector
        feat = generate_mock_feature_vector(farm_id, date.today(), 4)
        db.add(feat)
        await db.commit()
        await db.refresh(feat)
        
    return feat

@router.get("/{farm_id}/timeseries", response_model=List[FeatureVectorRead])
async def get_timeseries_features(farm_id: int, db: AsyncSession = Depends(get_db)):
    """
    Retrieves timeseries vegetation indices for the farm.
    If empty, generates a growing season timeseries (June - July 2026), saves it, and returns it.
    """
    stmt = select(FeatureVector).where(
        FeatureVector.farm_id == farm_id,
        FeatureVector.is_valid == True
    ).order_by(FeatureVector.date)
    
    res = await db.execute(stmt)
    feats = list(res.scalars().all())
    
    if not feats:
        logger.info(f"No FeatureVectors found for farm {farm_id}. Generating mock growing season timeseries.")
        farm_stmt = select(Farm).where(Farm.id == farm_id)
        farm_res = await db.execute(farm_stmt)
        farm = farm_res.scalars().first()
        if not farm:
            raise HTTPException(status_code=404, detail="Farm not found.")
            
        # Dates matching the slider in FarmTerrain3D
        dates = [
            date(2026, 6, 1),
            date(2026, 6, 15),
            date(2026, 7, 1),
            date(2026, 7, 15),
            date(2026, 7, 24)
        ]
        
        feats = []
        for idx, d in enumerate(dates):
            f = generate_mock_feature_vector(farm_id, d, idx)
            db.add(f)
            feats.append(f)
            
        await db.commit()
        for f in feats:
            await db.refresh(f)
            
    return feats

@router.post("/fuse", response_model=Dict[str, Any])
async def fuse_sensor_data(payload: FuseRequest):
    """
    Performs early fusion, median imputation, z-score normalization,
    and ranks features using mutual information with a target.
    """
    try:
        # 1. Perform early fusion to generate [N, 22] matrix
        matrix = fuse_dataset(payload.optical, payload.sar, payload.weather, payload.soil)
        if matrix.shape[0] == 0:
            raise ValueError("Empty dataset list. Check input dimensions.")
            
        # 2. Impute missing data
        imputed = impute_missing(matrix)
        
        # 3. Z-score normalize
        normalized = normalize_zscore(imputed)
        
        # 4. Rank features based on target vector
        target_arr = np.array(payload.target, dtype=np.float32)
        rankings = rank_features(normalized, target_arr)
        
        return {
            "status": "success",
            "fused_vector_count": len(normalized),
            "rankings": rankings
        }
    except Exception as e:
        logger.error(f"Error performing sensor fusion: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sensor fusion failed: {e}"
        )

@router.get("/{farm_id}/vector", response_model=Dict[str, Any])
async def get_farm_fused_vector(farm_id: int, db: AsyncSession = Depends(get_db)):
    """
    Retrieves the 22-dimensional fused feature vector for the given farm.
    Synthesizes current weather, soil, and SAR data to return a complete fused response.
    """
    # 1. Get latest FeatureVector (optical)
    latest_stmt = select(FeatureVector).where(
        FeatureVector.farm_id == farm_id
    ).order_by(desc(FeatureVector.date)).limit(1)
    res = await db.execute(latest_stmt)
    opt = res.scalars().first()
    
    if not opt:
        # Check farm exists
        farm_stmt = select(Farm).where(Farm.id == farm_id)
        farm_res = await db.execute(farm_stmt)
        farm = farm_res.scalars().first()
        if not farm:
            raise HTTPException(status_code=404, detail="Farm not found.")
        # Generate mock features
        opt = generate_mock_feature_vector(farm_id, date.today(), 4)
        db.add(opt)
        await db.commit()
        await db.refresh(opt)

    # 2. Synthesize SAR, Weather, Soil values
    optical_dict = {name: getattr(opt, name, np.nan) for name in ["ndvi", "ndwi", "evi", "savi", "gndvi", "ndre", "msi", "ndbi", "nbr", "gci"]}
    
    # Mock SAR
    sar_dict = {
        "vv": -12.4,
        "vh": -18.2,
        "sar_ratio": -12.4 / -18.2
    }
    
    # Mock Weather
    weather_dict = {
        "temp": 32.5,
        "precip": 4.5,
        "humidity": 65.0,
        "wind_speed": 12.0,
        "solar_rad": 220.0
    }
    
    # Mock Soil
    soil_dict = {
        "soil_moisture": 35.0,
        "soil_ph": 6.8,
        "soil_n": 45.0,
        "soil_p": 25.0
    }
    
    # 3. Fuse
    vector = fuse_features(optical_dict, sar_dict, weather_dict, soil_dict)
    
    # Convert numpy float32 array to list
    vector_list = [float(x) if not np.isnan(x) else None for x in vector]
    
    return {
        "farm_id": farm_id,
        "date": opt.date.strftime("%Y-%m-%d"),
        "features": {name: vector_list[idx] for idx, name in enumerate(FEATURE_NAMES)},
        "vector": vector_list
    }
