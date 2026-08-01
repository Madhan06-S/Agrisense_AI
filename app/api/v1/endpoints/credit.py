import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.credit.features import extract_credit_features
from app.credit.scorer import calculate_credit_score
from app.credit.lender import get_lender_portfolio_data
from app.api.v1.endpoints.features import get_farm_fused_vector

logger = logging.getLogger(__name__)
router = APIRouter()

# Global applications tracker for demo
LOAN_APPLICATIONS: List[Dict[str, Any]] = []

class LoanApplicationRequest(BaseModel):
    farm_id: int
    requested_amount: float
    tenure_months: int
    demographics: Optional[Dict[str, Any]] = None

@router.get("/score/{farm_id}", response_model=Dict[str, Any])
async def get_farm_credit_score(farm_id: int, db: AsyncSession = Depends(get_db)):
    """Retrieves credit score and metric breakdown for the farm."""
    try:
        # 1. Fetch farm details
        from sqlalchemy import text
        farm_res = await db.execute(text(f"SELECT id, name, crop_type, area_hectares, extra_metadata FROM farms WHERE id = {farm_id}"))
        farm = farm_res.first()
        if not farm:
            raise HTTPException(status_code=404, detail="Farm not found.")
            
        import json
        extra_meta = {}
        if farm[4]:
            try:
                extra_meta = json.loads(farm[4]) if isinstance(farm[4], str) else farm[4]
            except Exception:
                extra_meta = {}
                
        farm_profile = {"id": farm[0], "name": farm[1], "crop_type": farm[2], "area_hectares": farm[3], "extra_metadata": extra_meta}
        
        # 2. Fetch fused vectors
        fused_res = await get_farm_fused_vector(farm_id, db)
        vector = fused_res["vector"]
        
        # 3. Extract parameters
        features = extract_credit_features(farm_profile, [vector])
        
        # 4. Calculate score
        score = calculate_credit_score(features)
        
        return {
            "farm_id": farm_id,
            "farm_name": farm_profile["name"],
            "features": features,
            "score_report": score
        }
    except Exception as e:
        logger.error(f"Error calculating credit score: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/report/{farm_id}", response_model=Dict[str, Any])
async def get_credit_report_pdf(farm_id: int, db: AsyncSession = Depends(get_db)):
    """Simulates alternate credit report PDF metadata generation."""
    details = await get_farm_credit_score(farm_id, db)
    return {
        "farm_id": farm_id,
        "pdf_download_url": f"http://localhost:8000/api/v1/credit/report/{farm_id}/download",
        "credit_summary": details
    }

@router.post("/apply", response_model=Dict[str, Any])
async def submit_loan_application(payload: LoanApplicationRequest, db: AsyncSession = Depends(get_db)):
    """Submits loan application processed under alternative scoring."""
    try:
        details = await get_farm_credit_score(payload.farm_id, db)
        score_rep = details["score_report"]
        
        # Check eligibility limit
        eligible = payload.requested_amount <= score_rep["max_loan_limit_inr"]
        status_msg = "APPROVED" if eligible else "REJECTED_EXCEEDS_LIMIT"
        
        app_record = {
            "application_id": f"LOAN-{len(LOAN_APPLICATIONS) + 1000}",
            "farm_id": payload.farm_id,
            "requested_amount": payload.requested_amount,
            "eligible_limit": score_rep["max_loan_limit_inr"],
            "interest_rate": score_rep["interest_rate_percent"],
            "credit_score": score_rep["credit_score"],
            "status": status_msg,
            "audit_fairness_passed": score_rep["fairness_audit_passed"]
        }
        
        LOAN_APPLICATIONS.append(app_record)
        return app_record
    except Exception as e:
        logger.error(f"Error applying for loan: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/lender/portfolio", response_model=Dict[str, Any])
async def get_lender_portfolio():
    """Retrieves lender portfolio statistics."""
    return get_lender_portfolio_data()
