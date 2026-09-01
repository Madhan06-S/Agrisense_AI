import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.insurance.rules import RuleEngine
from app.api.v1.endpoints.features import get_farm_fused_vector

logger = logging.getLogger(__name__)
router = APIRouter()

# Instantiate global rule engine
engine = RuleEngine()

# Schemas
class EvaluateRulesRequest(BaseModel):
    farm_id: int
    sum_insured: float = 120000.0
    area_hectares: float = 2.5
    season: str = "Kharif"

class CreateRuleRequest(BaseModel):
    name: str
    condition: str
    threshold: float
    payout_type: str
    payout_value: float
    max_payout: float

@router.get("/rules", response_model=List[Dict[str, Any]])
async def list_active_rules():
    """Lists all active parametric rules."""
    return engine.rules

@router.post("/rules", response_model=Dict[str, Any])
async def create_rule(payload: CreateRuleRequest):
    """Admin-only rule creation endpoint."""
    new_rule = {
        "name": payload.name,
        "condition": payload.condition,
        "threshold": payload.threshold,
        "payout_type": payload.payout_type,
        "payout_value": payload.payout_value,
        "max_payout": payload.max_payout
    }
    engine.rules.append(new_rule)
    logger.info("Admin created new parametric rule: %s", payload.name)
    return {"status": "created", "rule": new_rule}

@router.post("/rules/evaluate", response_model=Dict[str, Any])
async def evaluate_rules_for_farm(payload: EvaluateRulesRequest, db: AsyncSession = Depends(get_db)):
    """Evaluates rules for a given farm's fused satellite/weather vectors."""
    try:
        # 1. Fetch farm detail
        from sqlalchemy import text
        farm_res = await db.execute(text(f"SELECT id, name, crop_type FROM farms WHERE id = {payload.farm_id}"))
        farm = farm_res.first()
        if not farm:
            raise HTTPException(status_code=404, detail="Farm not found.")
            
        farm_name, crop_type = farm[1], farm[2]
        
        # 2. Fetch fused feature vector
        fused_res = await get_farm_fused_vector(payload.farm_id, db)
        vector = fused_res["vector"]
        
        # Map early fused indices:
        # ndvi is idx 0
        # precipitation is idx 14
        # soil moisture is idx 18
        features = {
            "ndvi_drop_percent": (0.6 - float(vector[0])) * 100.0, # calculate drop relative to healthy 0.6
            "flood_index": float(vector[18]), # map soil moisture to flood index for rule simplicity
            "rainfall_anomaly": float(vector[14]) * -100.0 # rainfall deviation
        }
        
        # 3. Evaluate engine
        eval_res = engine.evaluate(
            features=features,
            sum_insured=payload.sum_insured,
            area_hectares=payload.area_hectares,
            crop_type=crop_type,
            season=payload.season
        )
        
        return {
            "farm_id": payload.farm_id,
            "farm_name": farm_name,
            "crop_type": crop_type,
            "evaluated_features": features,
            "evaluation_result": eval_res
        }
    except Exception as e:
        logger.error(f"Error evaluating rules: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/rules/{rule_name}", response_model=Dict[str, Any])
async def get_rule_details(rule_name: str):
    """Retrieves specific details of a rule by name."""
    found = [r for r in engine.rules if r["name"].lower() == rule_name.lower()]
    if not found:
        raise HTTPException(status_code=404, detail=f"Rule {rule_name} not found.")
    return found[0]
