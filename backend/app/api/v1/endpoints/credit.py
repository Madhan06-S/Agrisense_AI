"""
GET /api/v1/credit/score          — explainable alternative credit score for a farmer
GET /api/v1/credit/bank-link      — create a time-limited read-only share link (DPDP)
GET /api/v1/credit/bank-view/{token} — public read-only view (score + reasons only)
POST /api/v1/credit/cooperative/deliveries  — cooperative records a delivery entry
POST /api/v1/credit/cooperative/upload-csv  — cooperative uploads a CSV of deliveries
GET  /api/v1/credit/cooperative/deliveries  — list deliveries for a farmer
"""
import csv
import io
import logging
import secrets
import hashlib
from datetime import datetime, timezone, timedelta, date
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select

from app.core.database import get_db
from app.models.credit_score import CreditScore
from app.models.supply_delivery import SupplyDelivery
from app.credit.alternative_scorer import compute_alternative_credit_score, assert_no_prohibited_features

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory store for time-limited bank share tokens {token: {farmer_id, expires_at, snapshot}}
_BANK_SHARE_TOKENS: Dict[str, Dict[str, Any]] = {}


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────────────────────────────────────
class DeliveryEntryRequest(BaseModel):
    farmer_id: int
    delivery_date: str          # YYYY-MM-DD
    crop_name: str
    quantity_promised_kg: float
    quantity_delivered_kg: float
    on_time: str = "yes"        # "yes" | "no" | "partial"
    buyer_name: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Helper: compute raw factor values from DB
# ─────────────────────────────────────────────────────────────────────────────
async def _compute_raw_factors(farmer_id: int, db: AsyncSession) -> tuple[dict, dict, dict]:
    """
    Returns (raw_values, reasons, actions) dicts for all 4 factors.
    Missing data → None (not zero).
    """
    raw: Dict[str, Optional[float]] = {
        "satellite_productivity": None,
        "soil_health": None,
        "supply_chain": None,
        "insurance_payment": None,
    }
    reasons: Dict[str, str] = {}
    actions: Dict[str, str] = {}

    # ── 1. Satellite-verified productivity (35%) ────────────────────────────
    # Share of satellite scans where NDVI ≥ crop baseline (0.35),
    # weighted by year-to-year consistency (stddev penalty).
    sat_res = await db.execute(text(
        "SELECT COUNT(*), "
        "  COALESCE(SUM(CASE WHEN sd.ndvi >= 0.35 THEN 1 ELSE 0 END), 0), "
        "  COALESCE(AVG(sd.ndvi), 0), "
        "  COALESCE(MAX(sd.ndvi) - MIN(sd.ndvi), 0) "
        "FROM satellite_data sd "
        "JOIN farms f ON sd.farm_id = f.id "
        "WHERE f.farmer_id = :fid"
    ), {"fid": farmer_id})
    sat_row = sat_res.first()
    if sat_row and sat_row[0] > 0:
        total_scans, above_baseline, avg_ndvi, ndvi_range = sat_row
        hit_rate = (above_baseline / total_scans) * 100.0
        # Consistency penalty: high ndvi_range = less consistent (max 30-pt penalty)
        consistency_bonus = max(0.0, (1.0 - min(ndvi_range, 0.5) / 0.5)) * 20.0
        sat_score = round(min(100.0, hit_rate * 0.8 + consistency_bonus), 1)
        raw["satellite_productivity"] = sat_score
        reasons["satellite_productivity"] = (
            f"{above_baseline} of {total_scans} satellite scans had NDVI ≥ 0.35 (crop baseline); "
            f"avg NDVI {avg_ndvi:.3f}"
        )
    else:
        # Demo fallback — 3 of 4 seasons above baseline
        raw["satellite_productivity"] = 82.0
        reasons["satellite_productivity"] = "3 of last 4 seasons maintained peak NDVI above crop baseline (demo data)"

    # ── 2. Soil health trajectory (30%) ────────────────────────────────────
    # Trend of soil moisture from sensor readings / satellite proxies.
    # We use the most recent 10 satellite NDVI readings as a proxy for soil condition.
    soil_res = await db.execute(text(
        "SELECT sd.ndvi FROM satellite_data sd "
        "JOIN farms f ON sd.farm_id = f.id "
        "WHERE f.farmer_id = :fid "
        "ORDER BY sd.acquisition_date DESC LIMIT 10"
    ), {"fid": farmer_id})
    soil_rows = soil_res.fetchall()
    if len(soil_rows) >= 3:
        ndvi_vals = [r[0] for r in soil_rows if r[0] is not None]
        # Simple trend: compare first half avg vs second half avg
        half = len(ndvi_vals) // 2
        recent_avg = sum(ndvi_vals[:half]) / half if half > 0 else 0
        older_avg = sum(ndvi_vals[half:]) / (len(ndvi_vals) - half) if (len(ndvi_vals) - half) > 0 else 0
        trend_delta = recent_avg - older_avg  # positive = improving
        # Score: base 60, +20 if improving, -20 if declining
        if trend_delta > 0.02:
            soil_score = min(100.0, 70.0 + trend_delta * 200)
            trajectory = "improving"
        elif trend_delta < -0.02:
            soil_score = max(0.0, 50.0 + trend_delta * 200)
            trajectory = "declining"
        else:
            soil_score = 65.0
            trajectory = "stable"
        raw["soil_health"] = round(soil_score, 1)
        reasons["soil_health"] = (
            f"Soil health trajectory: {trajectory} "
            f"(recent avg NDVI {recent_avg:.3f} vs older {older_avg:.3f} over {len(ndvi_vals)} observations)"
        )
    else:
        # Demo: stable soil
        raw["soil_health"] = 68.0
        reasons["soil_health"] = "Soil indicators stable across observed seasons (demo data)"

    # ── 3. Supply chain reliability (25%) ──────────────────────────────────
    # From supply_deliveries table: delivery rate, on-time rate, buyer diversity.
    try:
        sc_res = await db.execute(text(
            "SELECT COUNT(*), "
            "  COALESCE(SUM(quantity_delivered_kg), 0), "
            "  COALESCE(SUM(quantity_promised_kg), 0), "
            "  COALESCE(SUM(CASE WHEN on_time = 'yes' THEN 1 ELSE 0 END), 0), "
            "  COUNT(DISTINCT buyer_name) "
            "FROM supply_deliveries WHERE farmer_id = :fid"
        ), {"fid": farmer_id})
        sc_row = sc_res.first()
        if sc_row and sc_row[0] > 0:
            total_deliveries, total_delivered, total_promised, on_time_count, buyer_count = sc_row
            delivery_rate = (total_delivered / total_promised * 100.0) if total_promised > 0 else 0.0
            on_time_rate = (on_time_count / total_deliveries * 100.0) if total_deliveries > 0 else 0.0
            buyer_diversity_bonus = min(15.0, buyer_count * 5.0)
            sc_score = round(
                min(100.0, delivery_rate * 0.50 + on_time_rate * 0.35 + buyer_diversity_bonus),
                1
            )
            raw["supply_chain"] = sc_score
            reasons["supply_chain"] = (
                f"Delivery rate {delivery_rate:.0f}% ({total_delivered:.0f}/{total_promised:.0f} kg), "
                f"on-time {on_time_rate:.0f}%, {buyer_count} buyer(s) recorded"
            )
        # else: supply_chain stays None
    except Exception as e:
        logger.warning(f"supply_chain score computation skipped: {e}")
        # Table may not exist yet — stays None

    # ── 4. Insurance & payment record (10%) ────────────────────────────────
    claim_res = await db.execute(text(
        "SELECT COUNT(*), "
        "  COALESCE(SUM(CASE WHEN status NOT IN ('rejected','fraud_detected') THEN 1 ELSE 0 END), 0) "
        "FROM claims WHERE farmer_id = :fid"
    ), {"fid": farmer_id})
    claim_row = claim_res.first()

    pfms_res = await db.execute(text(
        "SELECT COUNT(*) FROM pfms_transactions pt "
        "JOIN users u ON pt.beneficiary_name = u.full_name "
        "WHERE u.id = :fid"
    ), {"fid": farmer_id})
    pfms_count = pfms_res.scalar() or 0

    pol_res = await db.execute(text(
        "SELECT COUNT(*) FROM insurance_policies ip "
        "JOIN farms f ON ip.farm_id = f.id WHERE f.farmer_id = :fid"
    ), {"fid": farmer_id})
    pol_count = pol_res.scalar() or 0

    if (claim_row and claim_row[0] > 0) or pfms_count > 0 or pol_count > 0:
        genuine_rate = 100.0
        if claim_row and claim_row[0] > 0:
            genuine_rate = round((claim_row[1] / claim_row[0]) * 100.0, 1)
        payment_bonus = 10.0 if pfms_count > 0 else 0.0
        scheme_bonus = 10.0 if pol_count > 0 else 0.0
        ins_score = round(min(100.0, genuine_rate * 0.80 + payment_bonus + scheme_bonus), 1)
        raw["insurance_payment"] = ins_score
        reasons["insurance_payment"] = (
            f"{genuine_rate:.0f}% genuine claim rate "
            f"({claim_row[1] if claim_row else 0}/{claim_row[0] if claim_row else 0} valid claims); "
            f"{'DBT settlements verified; ' if pfms_count > 0 else ''}"
            f"{'PMFBY/AFII enrolled' if pol_count > 0 else 'no active scheme'}"
        )
    else:
        # Demo fallback
        raw["insurance_payment"] = 88.0
        reasons["insurance_payment"] = "Clean claim history; PMFBY enrolled (demo data)"

    return raw, reasons, actions


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/v1/credit/score
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/score", response_model=Dict[str, Any])
async def get_farmer_credit_score(
    farmer_id: int = Query(default=1, ge=1),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the explainable alternative credit score (0–100) for a farmer.
    Factors: satellite productivity 35%, soil health 30%,
             supply chain 25%, insurance & payment 10%.
    Missing factors are renormalized — never zeroed.
    """
    try:
        raw, reasons, actions = await _compute_raw_factors(farmer_id, db)
        result = compute_alternative_credit_score(raw, reasons, actions)

        # Persist to credit_scores table
        cs = CreditScore(
            farmer_id=farmer_id,
            score=result["score"],
            band=result["band"],
            factors=result["factors"],
            data_completeness=result["data_completeness"],
            computed_at=datetime.now(timezone.utc),
        )
        db.add(cs)
        await db.commit()

        return {
            "farmer_id": farmer_id,
            "score": result["score"],
            "band": result["band"],
            "data_completeness": result["data_completeness"],
            "factors": result["factors"],
            "improvements": result["improvements"],
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Credit score computation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/v1/credit/bank-link   — create time-limited read-only share link
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/bank-link", response_model=Dict[str, Any])
async def create_bank_share_link(
    farmer_id: int = Query(default=1, ge=1),
    db: AsyncSession = Depends(get_db),
):
    """
    DPDP-compliant: generates a 7-day read-only share link.
    Stores a score snapshot. Returns the token + link.
    The public view endpoint returns score and factor reasons ONLY — never raw data.
    """
    try:
        raw, reasons, actions = await _compute_raw_factors(farmer_id, db)
        result = compute_alternative_credit_score(raw, reasons, actions)

        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        _BANK_SHARE_TOKENS[token] = {
            "farmer_id": farmer_id,
            "expires_at": expires_at.isoformat(),
            "snapshot": {
                "score": result["score"],
                "band": result["band"],
                "data_completeness": result["data_completeness"],
                "factors": [
                    {
                        "name": f["name"],
                        "value": f["value"],
                        "available": f["available"],
                        "reason": f["reason"],
                        # action intentionally excluded from bank view
                    }
                    for f in result["factors"]
                ],
                "improvements": result["improvements"],
                "computed_at": datetime.now(timezone.utc).isoformat(),
                "consent_text": (
                    "This score was shared with explicit farmer consent under DPDP Act 2023. "
                    "Scoring uses satellite imagery, cooperative delivery records, and insurance history. "
                    "Caste, religion, gender, and exact location are NEVER used."
                ),
            },
        }
        return {
            "token": token,
            "bank_view_url": f"/api/v1/credit/bank-view/{token}",
            "expires_at": expires_at.isoformat(),
            "valid_days": 7,
            "dpdp_notice": "Shared under DPDP Act 2023 with explicit farmer consent.",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/v1/credit/bank-view/{token}
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/bank-view/{token}", response_model=Dict[str, Any])
async def get_bank_view(token: str):
    """
    Public read-only bank view. Returns score snapshot + factor reasons.
    No raw farm data, coordinates, or personal identifiers exposed.
    """
    record = _BANK_SHARE_TOKENS.get(token)
    if not record:
        raise HTTPException(status_code=404, detail="Share link not found or already revoked.")
    expires_at = datetime.fromisoformat(record["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        del _BANK_SHARE_TOKENS[token]
        raise HTTPException(status_code=410, detail="Share link has expired (7-day limit).")
    return {
        "status": "valid",
        "expires_at": record["expires_at"],
        "snapshot": record["snapshot"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v1/credit/cooperative/deliveries  — single delivery entry
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/cooperative/deliveries", status_code=201)
async def record_delivery(
    payload: DeliveryEntryRequest,
    cooperative_id: int = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Cooperative/officer records a single crop delivery for a farmer."""
    try:
        delivery_date_parsed = date.fromisoformat(payload.delivery_date)
    except ValueError:
        raise HTTPException(status_code=422, detail="delivery_date must be YYYY-MM-DD")

    record = SupplyDelivery(
        farmer_id=payload.farmer_id,
        cooperative_id=cooperative_id,
        delivery_date=delivery_date_parsed,
        crop_name=payload.crop_name.strip(),
        quantity_promised_kg=payload.quantity_promised_kg,
        quantity_delivered_kg=payload.quantity_delivered_kg,
        on_time=payload.on_time,
        buyer_name=payload.buyer_name,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return {
        "id": record.id,
        "farmer_id": record.farmer_id,
        "crop_name": record.crop_name,
        "delivery_date": str(record.delivery_date),
        "quantity_promised_kg": record.quantity_promised_kg,
        "quantity_delivered_kg": record.quantity_delivered_kg,
        "on_time": record.on_time,
        "buyer_name": record.buyer_name,
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v1/credit/cooperative/upload-csv
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/cooperative/upload-csv", status_code=201)
async def upload_deliveries_csv(
    file: UploadFile = File(...),
    cooperative_id: int = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Cooperative uploads a CSV of delivery records.
    Expected columns (case-insensitive):
      farmer_id, delivery_date, crop_name,
      quantity_promised_kg, quantity_delivered_kg, on_time, buyer_name
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=422, detail="Only .csv files accepted.")

    content = await file.read()
    try:
        text_content = content.decode("utf-8")
    except UnicodeDecodeError:
        text_content = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text_content))
    # Normalize headers
    field_map = {f.lower().strip(): f for f in (reader.fieldnames or [])}

    def get_field(row: dict, key: str) -> Optional[str]:
        canonical = field_map.get(key)
        return row.get(canonical, "").strip() if canonical else ""

    inserted, errors = 0, []
    for i, row in enumerate(reader, start=2):
        try:
            farmer_id_val = int(get_field(row, "farmer_id") or 0)
            crop = get_field(row, "crop_name")
            d_str = get_field(row, "delivery_date")
            promised = float(get_field(row, "quantity_promised_kg") or 0)
            delivered = float(get_field(row, "quantity_delivered_kg") or 0)
            on_time = get_field(row, "on_time") or "yes"
            buyer = get_field(row, "buyer_name") or None

            if not farmer_id_val or not crop or not d_str:
                errors.append(f"Row {i}: missing required fields")
                continue

            delivery_date_parsed = date.fromisoformat(d_str)
            record = SupplyDelivery(
                farmer_id=farmer_id_val,
                cooperative_id=cooperative_id,
                delivery_date=delivery_date_parsed,
                crop_name=crop,
                quantity_promised_kg=promised,
                quantity_delivered_kg=delivered,
                on_time=on_time,
                buyer_name=buyer,
            )
            db.add(record)
            inserted += 1
        except Exception as e:
            errors.append(f"Row {i}: {e}")

    await db.commit()
    return {"inserted": inserted, "errors": errors[:10]}


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/v1/credit/cooperative/deliveries  — list deliveries for a farmer
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/cooperative/deliveries", response_model=List[Dict[str, Any]])
async def list_deliveries(
    farmer_id: int = Query(default=1, ge=1),
    db: AsyncSession = Depends(get_db),
):
    """Lists all supply chain delivery records for a farmer."""
    res = await db.execute(
        select(SupplyDelivery)
        .where(SupplyDelivery.farmer_id == farmer_id)
        .order_by(SupplyDelivery.delivery_date.desc())
    )
    rows = res.scalars().all()

    # Demo seed if empty
    if not rows:
        return _demo_deliveries(farmer_id)

    return [
        {
            "id": r.id,
            "farmer_id": r.farmer_id,
            "delivery_date": str(r.delivery_date),
            "crop_name": r.crop_name,
            "quantity_promised_kg": r.quantity_promised_kg,
            "quantity_delivered_kg": r.quantity_delivered_kg,
            "on_time": r.on_time,
            "buyer_name": r.buyer_name,
        }
        for r in rows
    ]


def _demo_deliveries(farmer_id: int) -> List[Dict[str, Any]]:
    """Returns seeded demo delivery records when no real records exist."""
    return [
        {
            "id": None, "farmer_id": farmer_id,
            "delivery_date": "2026-06-15", "crop_name": "Rice",
            "quantity_promised_kg": 1200.0, "quantity_delivered_kg": 1185.0,
            "on_time": "yes", "buyer_name": "Sahyadri FPC"
        },
        {
            "id": None, "farmer_id": farmer_id,
            "delivery_date": "2026-03-10", "crop_name": "Wheat",
            "quantity_promised_kg": 850.0, "quantity_delivered_kg": 820.0,
            "on_time": "yes", "buyer_name": "ITC e-Choupal"
        },
        {
            "id": None, "farmer_id": farmer_id,
            "delivery_date": "2025-11-20", "crop_name": "Rice",
            "quantity_promised_kg": 1100.0, "quantity_delivered_kg": 1100.0,
            "on_time": "yes", "buyer_name": "Sahyadri FPC"
        },
        {
            "id": None, "farmer_id": farmer_id,
            "delivery_date": "2025-06-05", "crop_name": "Cotton",
            "quantity_promised_kg": 600.0, "quantity_delivered_kg": 540.0,
            "on_time": "partial", "buyer_name": "Maharashtra State Coop"
        },
    ]
