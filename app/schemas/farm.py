from pydantic import BaseModel, field_validator
from typing import Optional, Any
from datetime import date, datetime


class FarmCreate(BaseModel):
    name: str
    crop_type: str
    sowing_date: Optional[date] = None
    insurance_policy_number: Optional[str] = None
    # GeoJSON polygon from Leaflet draw
    boundary_geojson: Optional[dict] = None


class FarmUpdate(BaseModel):
    name: Optional[str] = None
    crop_type: Optional[str] = None
    sowing_date: Optional[date] = None
    insurance_policy_number: Optional[str] = None
    boundary_geojson: Optional[dict] = None


class FarmOut(BaseModel):
    id: int
    farmer_id: int
    name: str
    crop_type: str
    area_hectares: Optional[float]
    sowing_date: Optional[date]
    insurance_policy_number: Optional[str]
    boundary_geojson: Optional[dict] = None  # populated by endpoint
    created_at: datetime

    model_config = {"from_attributes": True}


class FarmListOut(BaseModel):
    id: int
    name: str
    crop_type: str
    area_hectares: Optional[float]
    created_at: datetime

    model_config = {"from_attributes": True}
