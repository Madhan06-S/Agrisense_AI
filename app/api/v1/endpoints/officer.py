from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_officer, get_current_user
from app.models.claim import Claim, ClaimStatus, ClaimType
from app.models.farm import Farm
from app.models.user import User
from app.models.fraud_flag import FraudFlag
from app.models.damage_assessment import DamageAssessment
from app.schemas.claim import ClaimOut, ClaimDetailOut, OfficerDecision
from app.compliance.audit_chain import AuditChainEngine
from app.payments.pfms import PFMSEngine
from typing import Literal
from pydantic import BaseModel

router = APIRouter(prefix="/officer", tags=["Officer"])


@router.get("/claims", response_model=List[ClaimDetailOut])
async def list_all_claims(
    status: Optional[str] = Query(None),
    claim_type: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None),
    max_score: Optional[float] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_officer),
):
    query = (
        select(Claim)
        .options(
            selectinload(Claim.images),
            selectinload(Claim.damage_assessment),
            selectinload(Claim.fraud_flags),
            selectinload(Claim.farmer),
            selectinload(Claim.farm),
        )
        .order_by(Claim.submitted_at.desc())
    )

    filters = []
    if status:
        filters.append(Claim.status == status)
    if claim_type:
        filters.append(Claim.claim_type == claim_type)
    if min_score is not None:
        filters.append(Claim.ai_damage_score >= min_score)
    if max_score is not None:
        filters.append(Claim.ai_damage_score <= max_score)
    if filters:
        query = query.where(and_(*filters))

    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/claims/{claim_id}", response_model=ClaimDetailOut)
async def get_claim_detail(
    claim_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_officer),
):
    result = await db.execute(
        select(Claim)
        .options(
            selectinload(Claim.images),
            selectinload(Claim.damage_assessment),
            selectinload(Claim.fraud_flags),
            selectinload(Claim.farmer),
            selectinload(Claim.farm),
        )
        .where(Claim.id == claim_id)
    )
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim


class OfficerDecisionRequest(BaseModel):
    action: Literal["approve", "reject"]
    remarks: str

@router.post("/claims/{claim_id}/decision")
async def officer_decision(
    claim_id: int,
    req: OfficerDecisionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Security: only officers/admins
    if current_user.role not in ["officer", "admin"]:
        raise HTTPException(403, "Only officers can approve or reject claims")
    
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(404, "Claim not found")
    
    # Block changing already-decided claims
    if claim.status in [ClaimStatus.approved, ClaimStatus.rejected]:
        raise HTTPException(400, f"Claim already {claim.status}")
    
    if req.action == "approve":
        claim.status = ClaimStatus.approved
        action_type = "APPROVED"
    else:
        claim.status = ClaimStatus.rejected
        action_type = "REJECTED"
    
    claim.officer_remarks = req.remarks
    claim.reviewed_at = datetime.utcnow()
    
    if hasattr(claim, "reviewed_by"):
        claim.reviewed_by = current_user.id
    if hasattr(claim, "officer_id"):
        claim.officer_id = current_user.id
    
    # CRITICAL: Commit and refresh
    await db.commit()
    await db.refresh(claim)
    
    # Log to audit chain
    await AuditChainEngine.add_block(
        claim_id=claim_id,
        action=action_type,
        actor_id=current_user.id,
        actor_role="Officer",
        actor_name=current_user.full_name,
        db=db,
    )
    
    # If approved, generate PFMS sanction order
    if req.action == "approve":
        try:
            # Fetch farmer details
            farmer_stmt = select(User).where(User.id == claim.farmer_id)
            farmer_res = await db.execute(farmer_stmt)
            farmer = farmer_res.scalar_one()

            await PFMSEngine.create_sanction(
                claim=claim,
                beneficiary_name=farmer.full_name,
                amount=25000.00,
                db=db,
            )

            # Log PFMS creation to audit chain
            await AuditChainEngine.add_block(
                claim_id=claim_id,
                action="SANCTION_CREATED",
                actor_id=current_user.id,
                actor_role="Officer",
                actor_name=current_user.full_name,
                db=db,
            )
        except Exception:
            pass
            
    return {
        "status": "success",
        "claim_id": claim_id,
        "new_status": claim.status,
        "officer_remarks": claim.officer_remarks
    }


@router.get("/fraud-flags")
async def list_fraud_flags(
    severity: Optional[str] = Query(None),
    reviewed: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_officer),
):
    query = select(FraudFlag).order_by(FraudFlag.created_at.desc())
    filters = []
    if severity:
        filters.append(FraudFlag.severity == severity)
    if reviewed is not None:
        filters.append(FraudFlag.is_reviewed == reviewed)
    if filters:
        query = query.where(and_(*filters))
    result = await db.execute(query)
    flags = result.scalars().all()
    return flags


@router.post("/fraud-flags/{flag_id}/review")
async def review_fraud_flag(
    flag_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_officer),
):
    result = await db.execute(select(FraudFlag).where(FraudFlag.id == flag_id))
    flag = result.scalar_one_or_none()
    if not flag:
        raise HTTPException(status_code=404, detail="Fraud flag not found")

    flag.is_reviewed = True
    flag.reviewed_by = current_user.id
    flag.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Flag marked as reviewed"}


@router.get("/analytics")
async def get_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_officer),
):
    """Return dashboard analytics data."""
    total = await db.scalar(select(func.count(Claim.id)))
    pending = await db.scalar(select(func.count(Claim.id)).where(Claim.status == ClaimStatus.under_review))
    approved = await db.scalar(select(func.count(Claim.id)).where(Claim.status == ClaimStatus.approved))
    rejected = await db.scalar(select(func.count(Claim.id)).where(Claim.status == ClaimStatus.rejected))
    fraud_alerts = await db.scalar(select(func.count(FraudFlag.id)).where(FraudFlag.is_reviewed == False))

    # Claims by type
    by_type_result = await db.execute(
        select(Claim.claim_type, func.count(Claim.id).label("count"))
        .group_by(Claim.claim_type)
    )
    by_type = [{"type": row.claim_type, "count": row.count} for row in by_type_result]

    return {
        "total_claims": total,
        "pending_review": pending,
        "approved": approved,
        "rejected": rejected,
        "fraud_alerts": fraud_alerts,
        "by_damage_type": by_type,
    }
