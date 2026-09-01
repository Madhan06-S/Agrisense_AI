import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.agronomy.prevention import evaluate_prevention_warnings
from app.agronomy.education import get_educational_materials
from app.agronomy.trust import generate_trust_explanation
from app.api.v1.endpoints.features import get_farm_fused_vector

logger = logging.getLogger(__name__)
router = APIRouter()

# Schemas
class AdviseRequest(BaseModel):
    farm_id: int
    vci_history: List[float]
    flood_index: float

class TrustRequest(BaseModel):
    farm_id: int
    decision_result: str # GREEN or RED
    rules_applied: List[str]
    current_ndvi: float
    baseline_ndvi: float
    change_percent: float

@router.post("/advise", response_model=Dict[str, Any])
async def generate_preventive_advice(payload: AdviseRequest):
    """Generates preventive advisory warnings based on VCI and flood indexes."""
    warning = evaluate_prevention_warnings(payload.vci_history, payload.flood_index)
    if not warning:
        return {
            "status": "stable",
            "message": "Pasture is currently healthy. No alerts active."
        }
    return {
        "status": "warning_active",
        "warning": warning
    }

@router.get("/education/{topic}", response_model=Dict[str, Any])
async def get_educational_topic(topic: str):
    """Retrieves agronomy education content in multi-format (SMS, Hindi/Tamil Voice, 3D)."""
    try:
        content = get_educational_materials(topic)
        return content
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/trust-explain", response_model=Dict[str, Any])
async def explain_ai_decision_trust(payload: TrustRequest):
    """Explains claim verification decisions with satellite baselines for farmer trust."""
    stats = {
        "baseline_ndvi": payload.baseline_ndvi,
        "current_ndvi": payload.current_ndvi,
        "change_percent": payload.change_percent
    }
    explanation = generate_trust_explanation(
        payload.farm_id,
        payload.decision_result,
        payload.rules_applied,
        stats
    )
    return explanation

@router.get("/early-warning/{farm_id}", response_model=Dict[str, Any])
async def check_early_warning_status(farm_id: int, db: AsyncSession = Depends(get_db)):
    """Checks if farm index values warrant early risk warn triggers."""
    try:
        fused_res = await get_farm_fused_vector(farm_id, db)
        vector = fused_res["vector"]
        # VCI is typically index 18, flood index is index 21
        vci = float(vector[18] * 100.0) # Scale moisture as VCI percentage
        flood = float(vector[20])
        
        warning = evaluate_prevention_warnings([vci], flood)
        return {
            "farm_id": farm_id,
            "vci": vci,
            "flood_index": flood,
            "warning_triggered": warning is not None,
            "details": warning
        }
    except Exception as e:
        logger.error(f"Error checking early warning: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/trust/{farm_id}", response_model=Dict[str, Any])
async def get_farmer_trust_profile(farm_id: int):
    """Returns the Digital Trust Verification profile for a farmer."""
    from app.agronomy.trust import get_trust_profile
    profile = get_trust_profile(farm_id)
    return profile

@router.post("/trust/{farm_id}/claim-outcome", response_model=Dict[str, Any])
async def record_farmer_claim_outcome(farm_id: int, claim_id: str, outcome: str, payout_amount: float = 0.0):
    """Records a claim outcome to the farmer's trust ledger."""
    from app.agronomy.trust import record_claim_outcome
    return record_claim_outcome(farm_id, claim_id, outcome, payout_amount)
