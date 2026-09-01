import logging
import time
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.copilot.advisor import AgronomyAdvisor, ADVISORY_HISTORY
from app.copilot.feedback import submit_feedback, log_advisory_adoption, get_prevention_metrics
from app.copilot.delivery import dispatch_push_notification, dispatch_sms_alert
from app.api.v1.endpoints.features import get_farm_fused_vector

logger = logging.getLogger(__name__)
router = APIRouter()

# Instantiate global advisor
advisor = AgronomyAdvisor()

# Schemas
class AdviseRequest(BaseModel):
    farm_id: int

class FeedbackRequest(BaseModel):
    advisory_id: str
    rating: str # thumbs_up or thumbs_down
    comment: str = ""
    followed: bool = False

@router.post("/advise", response_model=Dict[str, Any])
async def generate_farm_advisory(payload: AdviseRequest, db: AsyncSession = Depends(get_db)):
    """
    Generates actionable advisory alerts for the farm using LLM Prompting.
    Retrieves farm profile, latest features, and historical metadata.
    """
    try:
        # 1. Fetch farm details
        from sqlalchemy import text
        farm_res = await db.execute(text(f"SELECT id, name, crop_type, area_hectares FROM farms WHERE id = {payload.farm_id}"))
        farm = farm_res.first()
        if not farm:
            raise HTTPException(status_code=404, detail="Farm not found.")
            
        farm_profile = {"id": farm[0], "name": farm[1], "crop_type": farm[2], "area_hectares": farm[3]}
        
        # 2. Fetch fused feature vector
        fused_res = await get_farm_fused_vector(payload.farm_id, db)
        vector = fused_res["vector"]
        
        # 3. Simulate weather forecast and historical damage
        weather = {"precip_probability": 0.82, "temp_c": 31.0}
        historical = [{"date": "2025-07-28", "damage_type": "flood"}]
        
        # 4. Evaluate advice via advisor
        res = advisor.generate_advisory(farm_profile, vector, weather, historical)
        
        # Save to history
        adv_id = f"ADV-{int(time.time())}-{payload.farm_id}"
        advisory_record = {
            "advisory_id": adv_id,
            "farm_id": payload.farm_id,
            "timestamp": time.time(),
            "crop": farm_profile["crop_type"],
            "advisories": res["advisories"],
            "source": res["source"]
        }
        
        if payload.farm_id not in ADVISORY_HISTORY:
            ADVISORY_HISTORY[payload.farm_id] = []
        ADVISORY_HISTORY[payload.farm_id].append(advisory_record)
        
        # Dispatch SMS and Push alerts
        sms_text = f"AgriSense Alert for {farm_profile['name']}: {res['advisories'][0]['english']}"
        dispatch_sms_alert("+919876543210", sms_text)
        dispatch_push_notification(payload.farm_id, "New Crop Health Advisory", sms_text[:60])
        
        return advisory_record
    except Exception as e:
        logger.error(f"Error generating advisory: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/advisories/{farm_id}", response_model=List[Dict[str, Any]])
async def get_advisory_history(farm_id: int):
    """Retrieves chronological agronomic advisor history for the farm."""
    return ADVISORY_HISTORY.get(farm_id, [])

@router.post("/feedback", response_model=Dict[str, Any])
async def submit_advisory_feedback(payload: FeedbackRequest):
    """Submits farmer ratings and adoption logs."""
    try:
        submit_feedback(payload.advisory_id, payload.rating, payload.comment)
        log_advisory_adoption(payload.advisory_id, payload.followed)
        return {"status": "success", "message": "Feedback recorded."}
    except Exception as e:
        logger.error(f"Error submitting advisory feedback: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/insights", response_model=Dict[str, Any])
async def get_regional_insights():
    """Returns aggregated satisfaction and adoption statistics."""
    metrics = get_prevention_metrics()
    return {
        "status": "success",
        "regional_metrics": metrics
    }
