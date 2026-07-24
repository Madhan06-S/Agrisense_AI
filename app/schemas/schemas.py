from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import List, Dict, Any, Optional

class UserRead(BaseModel):
    id: int
    email: str
    phone: str
    aadhaar_number: str
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True

# Farm Schemas
class FarmBase(BaseModel):
    name: str
    crop_type: str
    sowing_date: date
    insurance_policy_number: str
    state: str
    district: str
    taluka: str
    village: str
    soil_ph: Optional[float] = None
    soil_moisture: Optional[float] = None
    soil_type: Optional[str] = None
    khasra_number: str

class FarmCreate(FarmBase):
    boundary: Dict[str, Any]  # Expects standard GeoJSON (Polygon)

class FarmRead(FarmBase):
    id: int
    owner_id: int
    boundary: Dict[str, Any]  # Serialized GeoJSON Polygon dict
    area_hectares: float
    is_deleted: bool

    class Config:
        from_attributes = True

# SatelliteImage Schemas
class SatelliteImageRead(BaseModel):
    id: int
    farm_id: int
    source: str
    acquisition_date: date
    red: Optional[str] = None
    green: Optional[str] = None
    blue: Optional[str] = None
    nir: Optional[str] = None
    cloud_cover: float
    resolution: float
    crs: str
    file_path: str
    is_processed: bool
    is_reconstructed: bool
    reconstruction_quality: Optional[float] = None

    class Config:
        from_attributes = True

# FeatureVector Schemas
class FeatureVectorRead(BaseModel):
    id: int
    farm_id: int
    date: date
    ndvi: Optional[float] = None
    ndwi: Optional[float] = None
    evi: Optional[float] = None
    savi: Optional[float] = None
    gndvi: Optional[float] = None
    ndre: Optional[float] = None
    msi: Optional[float] = None
    ndbi: Optional[float] = None
    nbr: Optional[float] = None
    gci: Optional[float] = None
    ndvi_trend: Optional[float] = None
    rainfall_anomaly: Optional[float] = None
    temperature_stress: Optional[float] = None
    is_valid: bool
    outlier_flags: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

# DataPipelineRun Schemas
class DataPipelineRunRead(BaseModel):
    id: int
    farm_id: int
    run_type: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    tasks_completed: int
    tasks_failed: int
    error_log: Optional[str] = None

    class Config:
        from_attributes = True
