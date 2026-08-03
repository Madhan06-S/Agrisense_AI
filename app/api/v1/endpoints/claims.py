from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.models.models import Claim, Farm, User
from app.ml.fusion_engine import run_fusion_pipeline
from app.decision.engine import apply_traffic_light_decision

router = APIRouter()

class ClaimCreate(BaseModel):
    farm_id: int
    claim_type: str  # "flood", "drought", "pest"
    description: str

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_claim(req: ClaimCreate, db: AsyncSession = Depends(get_db)):
    # Verify farm exists
    stmt_farm = select(Farm).where(Farm.id == req.farm_id)
    res_farm = await db.execute(stmt_farm)
    farm = res_farm.scalars().first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
        
    # Fetch owner details
    stmt_owner = select(User).where(User.id == farm.owner_id)
    res_owner = await db.execute(stmt_owner)
    owner = res_owner.scalars().first()
    farmer_name = owner.phone if owner else "Ramesh Patel"
        
    # Create claim
    claim = Claim(
        farm_id=req.farm_id,
        farmer_name=farmer_name,
        farm_name=farm.name,
        claim_type=req.claim_type,
        description=req.description,
        status="under_review",
        submitted_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    )
    db.add(claim)
    await db.commit()
    await db.refresh(claim)
    
    # Run AI analysis
    assessment = await run_fusion_pipeline(claim.id, db)
    
    # Auto-apply traffic light
    await apply_traffic_light_decision(claim.id, db)
    await db.refresh(claim)
    
    return {
        "claim_id": claim.id,
        "status": claim.status,
        "ai_score": assessment.combined_score if assessment else None,
        "message": "Claim submitted and analyzed. Check dashboard for decision."
    }

@router.get("/")
async def list_claims(db: AsyncSession = Depends(get_db)):
    stmt = select(Claim)
    res = await db.execute(stmt)
    claims = res.scalars().all()
    return claims

@router.get("/{claim_id}")
async def get_claim(claim_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(Claim).where(Claim.id == claim_id)
    res = await db.execute(stmt)
    claim = res.scalars().first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim
