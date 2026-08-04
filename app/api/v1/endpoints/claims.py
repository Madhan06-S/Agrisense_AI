import os
import shutil
import uuid
import hashlib
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from PIL import Image
import imagehash
import io

from app.core.database import get_db
from app.core.security import require_farmer, get_current_user
from app.core.config import settings
from app.models.claim import Claim, ClaimStatus, ClaimType
from app.models.farm import Farm
from app.models.claim_image import ClaimImage
from app.models.user import User
from app.models.damage_assessment import DamageAssessment
from app.schemas.claim import ClaimCreate, ClaimOut, ClaimDetailOut
from app.compliance.audit_chain import AuditChainEngine
from app.ml.fusion_engine import run_fusion_pipeline
from app.decision.engine import apply_traffic_light_decision

router = APIRouter(prefix="/claims", tags=["Claims"])

MEDIA_DIR = getattr(settings, "MEDIA_DIR", "media")


def _save_file_locally(data: bytes, filename: str) -> str:
    """Save uploaded file to local disk and return URL."""
    os.makedirs(MEDIA_DIR, exist_ok=True)
    path = os.path.join(MEDIA_DIR, filename)
    with open(path, "wb") as f:
        f.write(data)
    return f"/media/{filename}"


def _extract_exif_gps(data: bytes):
    """Extract GPS from EXIF data. Returns (lat, lng, captured_at) or (None, None, None)."""
    try:
        img = Image.open(io.BytesIO(data))
        exif = img._getexif()
        if not exif:
            return None, None, None

        # GPS IFD tag
        gps_info = exif.get(34853)
        captured_at = None

        # DateTime original
        dt_str = exif.get(36867)
        if dt_str:
            try:
                captured_at = datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S").replace(tzinfo=timezone.utc)
            except Exception:
                pass

        if not gps_info:
            return None, None, captured_at

        def _to_decimal(dms, ref):
            d, m, s = dms
            decimal = float(d) + float(m) / 60 + float(s) / 3600
            return -decimal if ref in ["S", "W"] else decimal

        lat = _to_decimal(gps_info.get(2, (0, 0, 0)), gps_info.get(1, "N"))
        lng = _to_decimal(gps_info.get(4, (0, 0, 0)), gps_info.get(3, "E"))
        return lat, lng, captured_at
    except Exception:
        return None, None, None


def _compute_phash(data: bytes) -> str:
    """Compute perceptual hash of image for fraud detection."""
    try:
        img = Image.open(io.BytesIO(data))
        return str(imagehash.phash(img))
    except Exception:
        return hashlib.md5(data).hexdigest()


# ── Claims ────────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_claim(
    payload: ClaimCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_farmer),
):
    # Verify farm belongs to farmer
    result = await db.execute(
        select(Farm).where(Farm.id == payload.farm_id, Farm.farmer_id == current_user.id)
    )
    farm = result.scalar_one_or_none()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found or not yours")

    claim = Claim(
        farm_id=payload.farm_id,
        farmer_id=current_user.id,
        claim_type=payload.claim_type,
        description=payload.description,
        status=ClaimStatus.submitted,
    )
    db.add(claim)
    await db.commit()
    await db.refresh(claim)
    
    await AuditChainEngine.add_block(
        claim_id=claim.id,
        action="SUBMITTED",
        actor_id=current_user.id,
        actor_role="Farmer",
        actor_name=current_user.full_name,
        db=db,
    )
    
    # Run AI pipeline
    assessment = await run_fusion_pipeline(claim.id, db)
    await apply_traffic_light_decision(claim.id, db)
    await db.refresh(claim)
    
    return {
        "claim_id": claim.id,
        "status": claim.status,
        "ai_score": assessment.combined_score if assessment else None,
        "message": "Claim submitted and analyzed. Check dashboard for decision."
    }


@router.get("")
async def get_my_claims(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "farmer":
        raise HTTPException(status_code=403, detail="Only farmers can view their claims")
    
    result_claims = await db.execute(
        select(Claim)
        .where(Claim.farmer_id == current_user.id)
        .order_by(Claim.submitted_at.desc())
    )
    claims = result_claims.scalars().all()
    
    # Include assessment scores in response
    result = []
    for claim in claims:
        stmt_da = select(DamageAssessment).where(DamageAssessment.claim_id == claim.id)
        res_da = await db.execute(stmt_da)
        assessment = res_da.scalars().first()
        
        result.append({
            "id": claim.id,
            "farm_id": claim.farm_id,
            "claim_type": claim.claim_type,
            "description": claim.description,
            "status": claim.status,
            "submitted_at": claim.submitted_at.isoformat() if claim.submitted_at else None,
            "ai_score": assessment.combined_score if assessment else None,
            "officer_remarks": claim.officer_remarks
        })
    
    return result


@router.get("/{claim_id}")
async def get_claim(
    claim_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if current_user.role == "farmer" and claim.farmer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Fetch farmer name
    result_user = await db.execute(select(User).where(User.id == claim.farmer_id))
    farmer = result_user.scalar_one_or_none()

    # Fetch farm name
    result_farm = await db.execute(select(Farm).where(Farm.id == claim.farm_id))
    farm = result_farm.scalar_one_or_none()

    # Fetch images
    result_images = await db.execute(select(ClaimImage).where(ClaimImage.claim_id == claim_id))
    images = result_images.scalars().all()

    image_urls = [
        img.image_url if img.image_url.startswith("/uploads/") else f"/uploads/claims/{claim_id}/{img.image_url.split('/')[-1]}"
        for img in images
    ]

    # Fetch assessment to get GEE satellite image and NDVI mean
    result_da = await db.execute(select(DamageAssessment).where(DamageAssessment.claim_id == claim_id))
    assessment = result_da.scalar_one_or_none()
    satellite_img = None
    ndvi_mean_val = None
    if assessment and assessment.explanation_json:
        satellite_img = assessment.explanation_json.get("satellite_image_path")
        ndvi_mean_val = assessment.explanation_json.get("ndvi_mean")

    return {
        "id": claim.id,
        "farmer_name": farmer.full_name if farmer else "Unknown",
        "farm_name": farm.name if farm else "Unknown Farm",
        "claim_type": claim.claim_type,
        "description": claim.description,
        "status": claim.status,
        "submitted_at": claim.submitted_at.isoformat() if claim.submitted_at else None,
        "officer_remarks": claim.officer_remarks,
        "ai_damage_score": claim.ai_damage_score,
        "images": image_urls,
        "farmer_id": claim.farmer_id,
        "satellite_image": satellite_img,
        "ndvi_mean": ndvi_mean_val,
        "gee_status": assessment.explanation_json.get("gee_status") if assessment else "fallback",
        "farm_id": claim.farm_id
    }


@router.post("/{claim_id}/images", status_code=201)
async def upload_images(
    claim_id: int,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_farmer),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Upload geo-tagged images for a claim."""
    result = await db.execute(
        select(Claim).where(Claim.id == claim_id, Claim.farmer_id == current_user.id)
    )
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 images allowed")

    # Create directory for this claim
    claim_dir = f"uploads/claims/{claim_id}"
    os.makedirs(claim_dir, exist_ok=True)

    saved_images = []
    for f in files:
        data = await f.read()
        if len(data) > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(status_code=400, detail=f"{f.filename} exceeds 10MB limit")

        # Save file to uploads/claims/{claim_id}/{filename}
        file_path = os.path.join(claim_dir, f.filename)
        with open(file_path, "wb") as buffer:
            buffer.write(data)

        url = f"/uploads/claims/{claim_id}/{f.filename}"

        # Extract EXIF
        lat, lng, captured_at = _extract_exif_gps(data)
        phash = _compute_phash(data)

        img_record = ClaimImage(
            claim_id=claim_id,
            image_url=url,
            image_hash=phash,
            latitude=lat,
            longitude=lng,
            is_geo_tagged=lat is not None,
            captured_at=captured_at,
            file_size_bytes=len(data),
            original_filename=f.filename,
        )
        db.add(img_record)
        saved_images.append({"filename": f.filename, "url": url, "geo_tagged": lat is not None})

    # Update claim status to under_review once images uploaded
    claim.status = ClaimStatus.under_review
    await db.commit()
    return {"status": "success", "uploaded": len(saved_images), "files": [img["filename"] for img in saved_images]}

    await AuditChainEngine.add_block(
        claim_id=claim_id,
        action="UNDER_REVIEW",
        actor_id=current_user.id,
        actor_role="Farmer",
        actor_name=current_user.full_name,
        db=db,
    )

    return {"uploaded": len(saved_images), "images": saved_images}


@router.get("/{claim_id}/weather")
async def get_weather(
    claim_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return mock weather data for the farm location."""
    from app.ml.weather_validator import WeatherValidator
    validator = WeatherValidator()
    return await validator.get_current_weather_mock()
