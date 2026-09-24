import logging
import time
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.copilot.advisor import AgronomyAdvisor, ADVISORY_HISTORY
from app.copilot.feedback import submit_feedback, log_advisory_adoption, get_prevention_metrics
from app.copilot.delivery import dispatch_push_notification, dispatch_sms_alert
from app.api.v1.endpoints.features import get_farm_fused_vector
from app.models.copilot_log import CopilotLog

logger = logging.getLogger(__name__)
router = APIRouter()

# Instantiate global advisor
advisor = AgronomyAdvisor()


# Schemas
class AdviseRequest(BaseModel):
    farm_id: int
    prompt: Optional[str] = None
    language: Optional[str] = "en-IN"


class FeedbackRequest(BaseModel):
    advisory_id: str
    rating: str  # thumbs_up or thumbs_down
    comment: str = ""
    followed: bool = False


@router.post("/advise", response_model=Dict[str, Any])
async def generate_farm_advisory(payload: AdviseRequest, db: AsyncSession = Depends(get_db)):
    """
    Generates actionable advisory alerts for the farm using LLM Prompting or rule heuristics.
    Retrieves farm profile, latest features, and logs telemetry to CopilotLog table.
    """
    start_time = time.time()
    try:
        # 1. Fetch farm details
        from sqlalchemy import text
        farm_res = await db.execute(text(f"SELECT id, name, crop_type, area_hectares, farmer_id FROM farms WHERE id = {payload.farm_id}"))
        farm = farm_res.first()
        if not farm:
            farm_profile = {"id": payload.farm_id, "name": f"Farm #{payload.farm_id}", "crop_type": "Rice", "area_hectares": 2.5, "farmer_id": 1}
        else:
            farm_profile = {"id": farm[0], "name": farm[1], "crop_type": farm[2], "area_hectares": farm[3], "farmer_id": farm[4]}
        
        # 2. Fetch fused feature vector
        try:
            fused_res = await get_farm_fused_vector(payload.farm_id, db)
            vector = fused_res["vector"]
        except Exception:
            vector = [0.28] + [0.0] * 20
        
        # 3. Weather forecast and historical damage
        weather = {"precip_probability": 0.82, "temp_c": 31.0}
        historical = [{"date": "2025-07-28", "damage_type": "flood"}]
        
        # 4. Evaluate advice via advisor (passes user query & language)
        res = advisor.generate_advisory(
            farm_profile=farm_profile,
            latest_vector=vector,
            weather_forecast=weather,
            historical_damage=historical,
            user_query=payload.prompt,
            language=payload.language or "en-IN"
        )

        latency_ms = round((time.time() - start_time) * 1000.0, 2)
        top_advisory_text = res["advisories"][0]["english"] if res["advisories"] else "Advisory processed."
        
        # Save to history
        adv_id = f"ADV-{int(time.time())}-{payload.farm_id}"
        advisory_record = {
            "advisory_id": adv_id,
            "farm_id": payload.farm_id,
            "timestamp": time.time(),
            "crop": farm_profile["crop_type"],
            "advisories": res["advisories"],
            "source": res["source"],
            "is_heuristic": res.get("is_heuristic", False),
            "is_rate_limited": res.get("is_rate_limited", False),
            "latency_ms": latency_ms
        }
        
        if payload.farm_id not in ADVISORY_HISTORY:
            ADVISORY_HISTORY[payload.farm_id] = []
        ADVISORY_HISTORY[payload.farm_id].append(advisory_record)

        # 5. Log telemetry to CopilotLog table
        try:
            mode_str = "heuristic" if res.get("is_heuristic") else "llm"
            log_entry = CopilotLog(
                farmer_id=farm_profile.get("farmer_id", 1),
                farm_id=payload.farm_id,
                query_text=payload.prompt or "System Auto-Advisory",
                mode=mode_str,
                response_text=top_advisory_text,
                tokens_used=res.get("tokens_used", 0),
                latency_ms=latency_ms,
                language=payload.language or "en-IN"
            )
            db.add(log_entry)
            await db.commit()
        except Exception as log_err:
            logger.warning(f"Failed to save CopilotLog: {log_err}")
            await db.rollback()
        
        # Dispatch SMS and Push alerts asynchronously
        sms_text = f"AgriSense Alert for {farm_profile['name']}: {top_advisory_text}"
        dispatch_sms_alert("+919876543210", sms_text)
        dispatch_push_notification(payload.farm_id, "New Crop Health Advisory", sms_text[:60])
        
        return advisory_record
    except Exception as e:
        logger.error(f"Error generating advisory: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/logs", response_model=List[Dict[str, Any]])
async def list_copilot_logs(limit: int = Query(50, le=200), db: AsyncSession = Depends(get_db)):
    """
    Returns recent AI Copilot observability logs (Officer/Admin audit endpoint).
    """
    result = await db.execute(
        select(CopilotLog).order_by(CopilotLog.id.desc()).limit(limit)
    )
    logs = result.scalars().all()
    return [
        {
            "id": l.id,
            "farmer_id": l.farmer_id,
            "farm_id": l.farm_id,
            "query_text": l.query_text,
            "mode": l.mode,
            "response_text": l.response_text,
            "tokens_used": l.tokens_used,
            "latency_ms": l.latency_ms,
            "language": l.language,
            "created_at": l.created_at.isoformat() if l.created_at else None
        }
        for l in logs
    ]


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
