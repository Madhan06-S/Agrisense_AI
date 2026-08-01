import logging
import time
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.v1.endpoints.features import get_farm_fused_vector
from app.ml.xgboost.inference import predict_single
from app.decision.engine import (
    evaluate_routing_rules_pillar5,
    record_override,
    DECISION_AUDIT_TRAIL,
    DECISION_STATS,
    OverrideRequest
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Requests
class EvaluateRequest(BaseModel):
    farm_id: int
    ndvi: float = 0.65
    vci: float = 65.0
    rainfall_anomaly_percent: float = 0.0
    flood_index: float = 0.0
    moisture_drop: float = 0.0
    ndvi_drop_2w: float = 0.0
    vci_consecutive_low: bool = False
    num_cows: int = 5

@router.post("/evaluate", response_model=Dict[str, Any])
async def evaluate_claim(payload: EvaluateRequest, db: AsyncSession = Depends(get_db)):
    """
    Evaluates de-risking status using the Pillar 5 Automated Verification rules:
    GREEN (Auto-Close) / RED (Instant Micro-Payout).
    """
    try:
        # 1. Fetch farm details
        from sqlalchemy import text
        farm_res = await db.execute(text(f"SELECT id, name, crop_type FROM farms WHERE id = {payload.farm_id}"))
        farm = farm_res.first()
        if not farm:
            raise HTTPException(status_code=404, detail="Farm not found.")
            
        crop_type = farm[2]
        
        # 2. Fetch fused vector
        fused_res = await get_farm_fused_vector(payload.farm_id, db)
        vector = fused_res["vector"]
        
        # 3. Predict damage using XGBoost classifier
        pred = predict_single(vector, payload.farm_id)
        damage_prob = pred["damage_probability"]
        confidence = pred["confidence"]
        
        # 4. Evaluate de-risking traffic light rules
        routing = evaluate_routing_rules_pillar5(
            ndvi=payload.ndvi,
            vci=payload.vci,
            rainfall_anomaly=payload.rainfall_anomaly_percent,
            flood_index=payload.flood_index,
            moisture_drop=payload.moisture_drop,
            ndvi_drop_2w=payload.ndvi_drop_2w,
            vci_consecutive_low=payload.vci_consecutive_low,
            num_cows=payload.num_cows
        )
        
        # Update metrics stats
        DECISION_STATS["total_evaluated"] += 1
        if routing["color"] == "GREEN":
            DECISION_STATS["auto_approved_green"] += 1
        else:
            DECISION_STATS["deep_inspect_red"] += 1
            
        # Log initial decision in audit trail
        audit_entry = {
            "timestamp": float(int(time.time())),
            "original_color": routing["color"],
            "damage_probability": damage_prob,
            "confidence": confidence,
            "status": routing["status"],
            "payout_amount": routing["payout_amount"],
            "type": "initial_evaluation"
        }
        
        claim_id = payload.farm_id
        if claim_id not in DECISION_AUDIT_TRAIL:
            DECISION_AUDIT_TRAIL[claim_id] = []
        DECISION_AUDIT_TRAIL[claim_id].append(audit_entry)
        
        # Construct response compatible with existing UI structures
        return {
            "claim_id": claim_id,
            "farm_name": farm[1],
            "crop_type": crop_type,
            "prediction": pred,
            "routing": routing,
            "payout": {
                "payout_amount": routing["payout_amount"],
                "trigger_rules": [r for r in [
                    "vci_low" if payload.vci < 40 or payload.vci_consecutive_low else None,
                    "flood_high" if payload.flood_index > 0.8 else None,
                    "moisture_drop" if payload.moisture_drop > 60 else None,
                    "ndvi_drop" if payload.ndvi_drop_2w > 50 else None
                ] if r is not None]
            },
            "audit_trail": DECISION_AUDIT_TRAIL[claim_id]
        }
    except Exception as e:
        logger.error(f"Error evaluating claim decision: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/override", response_model=Dict[str, Any])
async def official_override(payload: OverrideRequest):
    """Audits official overrides."""
    try:
        audit = record_override(
            claim_id=payload.claim_id,
            official_id=payload.official_id,
            original_color=payload.original_color,
            new_color=payload.new_color,
            reason=payload.reason
        )
        return {
            "status": "success",
            "audit": audit
        }
    except Exception as e:
        logger.error(f"Error overriding decision: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/audit/{claim_id}", response_model=List[Dict[str, Any]])
async def get_claim_audit_trail(claim_id: int):
    """Retrieves full audit logs."""
    return DECISION_AUDIT_TRAIL.get(claim_id, [])

@router.get("/stats", response_model=Dict[str, Any])
async def get_decision_stats():
    """Returns decision statistics."""
    total = DECISION_STATS["total_evaluated"]
    overridden = DECISION_STATS["overridden_claims"]
    override_rate = overridden / total if total > 0 else 0.0
    
    return {
        **DECISION_STATS,
        "override_rate": float(override_rate),
        "ai_accuracy_rate": float(1.0 - override_rate)
    }


from app.models.models import DamageAssessment
from sqlalchemy import select

@router.post("/evaluate/{claim_id}")
async def evaluate_claim_decision(claim_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(DamageAssessment).where(DamageAssessment.claim_id == claim_id)
    res = await db.execute(stmt)
    assess = res.scalars().first()
    if not assess:
        from app.ml.fusion_engine import run_fusion_pipeline
        assess = await run_fusion_pipeline(claim_id, db)
        if not assess:
            raise HTTPException(status_code=404, detail="Damage assessment not found")
            
    score = assess.combined_score
    if score >= 70:
        light = "red"
        message = "Auto-approve eligible. Severe damage detected."
    elif score >= 40:
        light = "yellow"
        message = "Manual review required. Moderate damage detected."
    else:
        light = "green"
        message = "Auto-close eligible. No significant damage detected."
        
    return {
        "light": light,
        "score": score,
        "message": message,
        "confidence": assess.confidence or 0.92,
        "breakdown": {
            "satellite": assess.satellite_score,
            "image": assess.image_score,
            "weather": assess.weather_score
        }
    }
