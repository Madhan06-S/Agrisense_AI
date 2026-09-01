from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from app.models.claim import ClaimType, ClaimStatus


class ClaimCreate(BaseModel):
    farm_id: int
    claim_type: ClaimType
    description: Optional[str] = None


class ClaimImageOut(BaseModel):
    id: int
    image_url: str
    latitude: Optional[float]
    longitude: Optional[float]
    is_geo_tagged: bool
    captured_at: Optional[datetime]
    original_filename: Optional[str]

    model_config = {"from_attributes": True}


class DamageAssessmentOut(BaseModel):
    satellite_score: Optional[float]
    image_score: Optional[float]
    weather_score: Optional[float]
    combined_score: Optional[float]
    confidence: Optional[float]
    decision: Optional[str]
    explanation_json: Optional[Any]

    model_config = {"from_attributes": True}


class FraudFlagOut(BaseModel):
    id: int
    flag_type: str
    severity: str
    details_json: Optional[Any]
    is_reviewed: bool

    model_config = {"from_attributes": True}


class ClaimOut(BaseModel):
    id: int
    farm_id: int
    farmer_id: int
    claim_type: ClaimType
    description: Optional[str]
    status: ClaimStatus
    ai_damage_score: Optional[float]
    ai_decision: Optional[str]
    officer_remarks: Optional[str]
    submitted_at: datetime
    reviewed_at: Optional[datetime]
    resolved_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ClaimDetailOut(ClaimOut):
    images: List[ClaimImageOut] = []
    damage_assessment: Optional[DamageAssessmentOut] = None
    fraud_flags: List[FraudFlagOut] = []

    model_config = {"from_attributes": True}


class ClaimStatusUpdate(BaseModel):
    status: ClaimStatus
    officer_remarks: Optional[str] = None


class OfficerDecision(BaseModel):
    decision: str  # approve | reject | request_evidence | forward_inspector
    remarks: Optional[str] = None
    amount: Optional[float] = None  # approved payout amount
