from pydantic import BaseModel
from typing import Optional, Any, List, Dict
from datetime import date, datetime


class FarmCreate(BaseModel):
    name: str
    crop_type: str
    sowing_date: Optional[date] = None
    insurance_policy_number: Optional[str] = None
    khasra_number: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    taluka: Optional[str] = None
    village: Optional[str] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    gps_accuracy_meters: Optional[float] = None
    center_pin_latitude: Optional[float] = None
    center_pin_longitude: Optional[float] = None
    overlap_status: Optional[str] = "NONE"
    boundary_geojson: Optional[dict] = None


class FarmUpdate(BaseModel):
    name: Optional[str] = None
    crop_type: Optional[str] = None
    sowing_date: Optional[date] = None
    insurance_policy_number: Optional[str] = None
    khasra_number: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    taluka: Optional[str] = None
    village: Optional[str] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    gps_accuracy_meters: Optional[float] = None
    center_pin_latitude: Optional[float] = None
    center_pin_longitude: Optional[float] = None
    overlap_status: Optional[str] = None
    change_reason: Optional[str] = "Boundary edit by user"
    boundary_geojson: Optional[dict] = None


class FarmOut(BaseModel):
    id: int
    farmer_id: int
    name: str
    crop_type: str
    area_hectares: Optional[float]
    sowing_date: Optional[date]
    insurance_policy_number: Optional[str]
    khasra_number: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    taluka: Optional[str] = None
    village: Optional[str] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    gps_accuracy_meters: Optional[float] = None
    center_pin_latitude: Optional[float] = None
    center_pin_longitude: Optional[float] = None
    verification_status: Optional[str] = "PENDING_OFFICIAL_VERIFICATION"
    overlap_status: Optional[str] = "NONE"
    current_version: Optional[int] = 1
    boundary_geojson: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class FarmListOut(BaseModel):
    id: int
    name: str
    crop_type: str
    area_hectares: Optional[float]
    verification_status: Optional[str] = "PENDING_OFFICIAL_VERIFICATION"
    created_at: datetime

    model_config = {"from_attributes": True}
