from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.decision.engine import evaluate_traffic_light

router = APIRouter(prefix="/decision", tags=["Traffic Light"])

@router.post("/evaluate/{claim_id}")
async def evaluate_claim(claim_id: int, db: AsyncSession = Depends(get_db)):
    return await evaluate_traffic_light(claim_id, db)
