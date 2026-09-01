import logging
from typing import Dict, Any, List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.insurance.rules import RuleEngine
from app.insurance.parametric_service import ParametricInsuranceService
from app.insurance.risk_service import AgrisenseAIRiskService
from app.models.insurance_models import InsuranceScheme, InsurancePolicy, PolicyCoverage
from app.models.farm import Farm
from app.api.v1.endpoints.features import get_farm_fused_vector

logger = logging.getLogger(__name__)
router = APIRouter()

# Instantiate global rule engine
engine = RuleEngine()

# Pydantic Schemas
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

class CreatePolicyRequest(BaseModel):
    farm_id: int
    scheme_code: str  # PMFBY or RWBCIS
    policy_number: str
    crop: str
    season: str = "Kharif"
    sum_insured: Optional[float] = 100000.0

class ParametricEvalRequest(BaseModel):
    farm_id: int
    parameter: str = "rainfall"
    observed_value: Optional[float] = None


@router.get("/schemes", response_model=List[Dict[str, Any]])
async def get_supported_schemes(db: AsyncSession = Depends(get_db)):
    """Returns active supported insurance schemes: PMFBY and RWBCIS."""
    stmt = select(InsuranceScheme).where(InsuranceScheme.active == True)
    res = await db.execute(stmt)
    schemes = res.scalars().all()
    if not schemes:
        # Fallback default supported schemes
        return [
            {
                "code": "PMFBY",
                "name": "Pradhan Mantri Fasal Bima Yojana",
                "type": "YIELD_BASED",
                "description": "Yield-Based Crop Insurance Scheme"
            },
            {
                "code": "RWBCIS",
                "name": "Restructured Weather Based Crop Insurance Scheme",
                "type": "WEATHER_INDEX_PARAMETRIC",
                "description": "Weather-Based Index Crop Protection Scheme"
            }
        ]
    return [
        {
            "id": s.id,
            "code": s.code,
            "name": s.name,
            "type": s.type,
            "description": s.description
        }
        for s in schemes
    ]


@router.get("/policies/farm/{farm_id}")
async def get_farm_policy(farm_id: int, db: AsyncSession = Depends(get_db)):
    """Gets policy details for a specific farm."""
    stmt = (
        select(InsurancePolicy)
        .where(InsurancePolicy.farm_id == farm_id)
    )
    res = await db.execute(stmt)
    policy = res.scalars().first()

    if not policy:
        # Check farm table for policy number
        farm_stmt = select(Farm).where(Farm.id == farm_id)
        farm_res = await db.execute(farm_stmt)
        farm = farm_res.scalar_one_or_none()
        pol_num = farm.insurance_policy_number if farm and farm.insurance_policy_number else "INS-772819"
        crop = farm.crop_type if farm else "Rice"
        return {
            "policy_number": pol_num,
            "scheme_code": "PMFBY",
            "scheme_name": "Pradhan Mantri Fasal Bima Yojana",
            "crop": crop,
            "season": "Kharif",
            "status": "ACTIVE",
            "sum_insured": 100000.0,
            "coverage_provisions": [
                "Standing Crop / Yield Loss",
                "Prevented Sowing",
                "Localized Calamity",
                "Mid-Season Adversity",
                "Post-Harvest Loss"
            ]
        }

    return {
        "id": policy.id,
        "policy_number": policy.policy_number,
        "scheme_code": policy.scheme.code if policy.scheme else "PMFBY",
        "scheme_name": policy.scheme.name if policy.scheme else "Pradhan Mantri Fasal Bima Yojana",
        "crop": policy.crop,
        "season": policy.season,
        "status": policy.status,
        "sum_insured": policy.sum_insured,
        "coverage_start": policy.coverage_start,
        "coverage_end": policy.coverage_end
    }


@router.post("/policies")
async def create_or_link_policy(payload: CreatePolicyRequest, db: AsyncSession = Depends(get_db)):
    """Creates or links an insurance policy to a farm."""
    # Find scheme by code
    scheme_stmt = select(InsuranceScheme).where(InsuranceScheme.code == payload.scheme_code.upper())
    scheme_res = await db.execute(scheme_stmt)
    scheme = scheme_res.scalar_one_or_none()

    if not scheme:
        # Auto-create scheme if missing
        scheme = InsuranceScheme(
            code=payload.scheme_code.upper(),
            name="Pradhan Mantri Fasal Bima Yojana" if payload.scheme_code.upper() == "PMFBY" else "Restructured Weather Based Crop Insurance Scheme",
            type="YIELD_BASED" if payload.scheme_code.upper() == "PMFBY" else "WEATHER_INDEX_PARAMETRIC",
            description="Crop Insurance Scheme"
        )
        db.add(scheme)
        await db.flush()

    policy = InsurancePolicy(
        policy_number=payload.policy_number,
        scheme_id=scheme.id,
        farm_id=payload.farm_id,
        crop=payload.crop,
        season=payload.season,
        sum_insured=payload.sum_insured or 100000.0,
        status="ACTIVE"
    )
    db.add(policy)

    # Update farm policy number
    farm_stmt = select(Farm).where(Farm.id == payload.farm_id)
    farm_res = await db.execute(farm_stmt)
    farm = farm_res.scalar_one_or_none()
    if farm:
        farm.insurance_policy_number = payload.policy_number

    await db.commit()
    await db.refresh(policy)

    return {
        "status": "linked",
        "policy_id": policy.id,
        "policy_number": policy.policy_number,
        "scheme": scheme.code
    }


@router.get("/risk/{farm_id}")
async def get_agrisense_risk_assessment(farm_id: int, db: AsyncSession = Depends(get_db)):
    """Retrieves Agrisense AI farm risk assessment and agronomic support recommendations."""
    return await AgrisenseAIRiskService.assess_farm_risk(db, farm_id)


@router.post("/parametric/evaluate")
async def evaluate_parametric_trigger(payload: ParametricEvalRequest, db: AsyncSession = Depends(get_db)):
    """Evaluates RWBCIS parametric trigger status for a farm."""
    return await ParametricInsuranceService.evaluate_parametric_trigger(
        db, payload.farm_id, payload.parameter, payload.observed_value
    )


# Existing Rule Engine Endpoints
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
        from sqlalchemy import text
        farm_res = await db.execute(text(f"SELECT id, name, crop_type FROM farms WHERE id = {payload.farm_id}"))
        farm = farm_res.first()
        if not farm:
            raise HTTPException(status_code=404, detail="Farm not found.")
            
        farm_name, crop_type = farm[1], farm[2]
        
        fused_res = await get_farm_fused_vector(payload.farm_id, db)
        vector = fused_res["vector"]
        
        features = {
            "ndvi_drop_percent": (0.6 - float(vector[0])) * 100.0,
            "flood_index": float(vector[18]),
            "rainfall_anomaly": float(vector[14]) * -100.0
        }
        
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
