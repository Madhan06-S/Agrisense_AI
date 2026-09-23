from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.sms_advisory import generate_sms_risk_advisory, generate_sms_copilot_response

router = APIRouter()

class SMSAdvisoryRequest(BaseModel):
    mobile: str = "+919876543210"
    farm_id: int = 1
    language: Optional[str] = "en-IN"

class SMSCopilotRequest(BaseModel):
    mobile: str = "+919876543210"
    query: str
    language: Optional[str] = "en-IN"

@router.post("/advisory")
async def send_sms_advisory_endpoint(
    payload: SMSAdvisoryRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Sends or returns a concise 2-3 line SMS advisory for feature-phone users.
    """
    try:
        res = await generate_sms_risk_advisory(
            mobile=payload.mobile,
            farm_id=payload.farm_id,
            db=db,
            language=payload.language or "en-IN"
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/copilot")
async def send_sms_copilot_endpoint(
    payload: SMSCopilotRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Processes SMS query from feature phone and returns SMS-length reply (<=160 chars).
    """
    try:
        res = await generate_sms_copilot_response(
            mobile=payload.mobile,
            query=payload.query,
            db=db,
            language=payload.language or "en-IN"
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
