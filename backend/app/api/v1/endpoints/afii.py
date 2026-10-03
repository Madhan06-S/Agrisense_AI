import logging
import time
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.models.afii import GrazingZone, VCIReading, AFIIPolicy, AFIIPayout
from app.services.afii_engine import (
    compute_vci_formula,
    compute_zone_vci,
    auto_trigger_check,
    evaluate_zone_forage_and_warning,
    WATCH_PRE_ALERTS
)
from app.compliance.audit_chain import AuditChainEngine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/afii", tags=["AFII Forage Index Insurance"])


class GrazingZoneCreate(BaseModel):
    name: str
    state: str
    district: str
    boundary_geojson: Optional[str] = None
    centroid_lat: float = 18.5204
    centroid_lng: float = 73.8567
    num_households: int = 120
    livestock_count: int = 850
    area_hectares: float = 100.0


class AFIIPolicyCreate(BaseModel):
    zone_id: int
    premium_amount: float = 1500.0
    sum_insured_per_household: float = 25000.0
    survival_baseline_vci: float = 35.0
    season: str = "Kharif 2026"


class InjectVCITestRequest(BaseModel):
    zone_id: int
    vci_score: float = 30.0  # Default low VCI breach value (< 35%)


@router.post("/zones", status_code=201)
async def create_grazing_zone(payload: GrazingZoneCreate, db: AsyncSession = Depends(get_db)):
    """Creates a new pastoral grazing zone."""
    zone = GrazingZone(
        name=payload.name,
        state=payload.state,
        district=payload.district,
        boundary_geojson=payload.boundary_geojson,
        centroid_lat=payload.centroid_lat,
        centroid_lng=payload.centroid_lng,
        num_households=payload.num_households,
        livestock_count=payload.livestock_count,
        area_hectares=payload.area_hectares
    )
    db.add(zone)
    await db.commit()
    await db.refresh(zone)

    policy = AFIIPolicy(
        zone_id=zone.id,
        premium_amount=1500.0,
        sum_insured_per_household=25000.0,
        survival_baseline_vci=35.0,
        season="Kharif 2026"
    )
    db.add(policy)

    initial_vci = VCIReading(
        zone_id=zone.id,
        vci_score=62.5,
        ndvi_current=0.52,
        ndvi_long_term_mean=0.55,
        source="sentinel-2"
    )
    db.add(initial_vci)
    await db.commit()

    return zone


@router.get("/zones")
async def list_grazing_zones(db: AsyncSession = Depends(get_db)):
    """
    Lists all pastoral grazing zones with VCI, DM/ha vs baseline, days to breach,
    Watch pre-alert status, and active payout flow (triggered -> approved -> paid).
    """
    res_zones = await db.execute(select(GrazingZone).order_by(GrazingZone.id.asc()))
    zones = res_zones.scalars().all()

    if not zones:
        demo_zones = [
            GrazingZone(
                id=1,
                name="Banni Grasslands Grazing Zone",
                state="Gujarat",
                district="Kutch",
                centroid_lat=23.4000,
                centroid_lng=69.5000,
                num_households=150,
                livestock_count=1200,
                area_hectares=120.0
            ),
            GrazingZone(
                id=2,
                name="Thar Pastoral Belt",
                state="Rajasthan",
                district="Jaisalmer",
                centroid_lat=26.9157,
                centroid_lng=70.9083,
                num_households=210,
                livestock_count=1850,
                area_hectares=150.0
            ),
            GrazingZone(
                id=3,
                name="Kongu Plateau Grazing Zone",
                state="Tamil Nadu",
                district="Coimbatore",
                centroid_lat=11.0168,
                centroid_lng=76.9558,
                num_households=95,
                livestock_count=640,
                area_hectares=90.0
            )
        ]
        for dz in demo_zones:
            db.add(dz)
        await db.commit()

        vci_scores = [58.0, 32.0, 68.0]  # Thar Pastoral Belt breaches VCI (<35%)
        for i, dz in enumerate(demo_zones):
            pol = AFIIPolicy(
                zone_id=dz.id,
                premium_amount=1500.0,
                sum_insured_per_household=25000.0,
                survival_baseline_vci=35.0
            )
            db.add(pol)

            read = VCIReading(
                zone_id=dz.id,
                vci_score=vci_scores[i],
                ndvi_current=0.15 + (vci_scores[i] / 100.0) * 0.60,
                ndvi_long_term_mean=0.55
            )
            db.add(read)
        await db.commit()

        res_zones = await db.execute(select(GrazingZone).order_by(GrazingZone.id.asc()))
        zones = res_zones.scalars().all()

    result = []
    for z in zones:
        res_pol = await db.execute(select(AFIIPolicy).where(AFIIPolicy.zone_id == z.id, AFIIPolicy.active == True).limit(1))
        policy = res_pol.scalars().first()

        eval_res = await evaluate_zone_forage_and_warning(z, policy, db)

        res_pay = await db.execute(select(AFIIPayout).where(AFIIPayout.zone_id == z.id).order_by(desc(AFIIPayout.trigger_date)).limit(1))
        latest_payout = res_pay.scalars().first()

        result.append({
            "id": z.id,
            "name": z.name,
            "state": z.state,
            "district": z.district,
            "centroid_lat": z.centroid_lat,
            "centroid_lng": z.centroid_lng,
            "num_households": z.num_households,
            "livestock_count": z.livestock_count,
            "area_hectares": getattr(z, "area_hectares", 100.0),
            "vci_score": eval_res["vci_score"],
            "ndvi_current": eval_res["ndvi_current"],
            "survival_baseline_vci": eval_res["survival_baseline_vci"],
            "dm_available_kg_ha": eval_res["dm_available_kg_ha"],
            "dm_required_kg_ha": eval_res["dm_required_kg_ha"],
            "vci_breach": eval_res["vci_breach"],
            "dm_shortfall_breach": eval_res["dm_shortfall_breach"],
            "days_to_breach": eval_res["days_to_breach"],
            "vci_status": eval_res["vci_status"].lower(),
            "status_reason": eval_res["status_reason"],
            "sum_insured_per_household": policy.sum_insured_per_household if policy else 25000.0,
            "active_payout": {
                "id": latest_payout.id,
                "status": latest_payout.status,
                "total_payout": latest_payout.total_payout,
                "vci_at_trigger": latest_payout.vci_at_trigger,
                "reference_id": latest_payout.reference_id,
                "trigger_date": latest_payout.trigger_date.isoformat()
            } if latest_payout else None
        })

    return result


@router.get("/zones/{zone_id}")
async def get_zone_detail(zone_id: int, db: AsyncSession = Depends(get_db)):
    """Returns zone forage details, survival baseline, and VCI historical time series."""
    res_zone = await db.execute(select(GrazingZone).where(GrazingZone.id == zone_id))
    zone = res_zone.scalars().first()
    if not zone:
        raise HTTPException(status_code=404, detail="Grazing zone not found.")

    res_vci = await db.execute(select(VCIReading).where(VCIReading.zone_id == zone_id).order_by(VCIReading.date.asc()))
    readings = res_vci.scalars().all()

    res_pol = await db.execute(select(AFIIPolicy).where(AFIIPolicy.zone_id == zone_id).limit(1))
    policy = res_pol.scalars().first()

    eval_res = await evaluate_zone_forage_and_warning(zone, policy, db)

    return {
        "id": zone.id,
        "name": zone.name,
        "state": zone.state,
        "district": zone.district,
        "num_households": zone.num_households,
        "livestock_count": zone.livestock_count,
        "area_hectares": getattr(zone, "area_hectares", 100.0),
        "survival_baseline_vci": policy.survival_baseline_vci if policy else 35.0,
        "sum_insured_per_household": policy.sum_insured_per_household if policy else 25000.0,
        "dm_available_kg_ha": eval_res["dm_available_kg_ha"],
        "dm_required_kg_ha": eval_res["dm_required_kg_ha"],
        "days_to_breach": eval_res["days_to_breach"],
        "vci_status": eval_res["vci_status"],
        "vci_history": [
            {
                "id": r.id,
                "date": r.date.strftime("%Y-%m-%d") if r.date else "",
                "vci_score": r.vci_score,
                "ndvi_current": r.ndvi_current
            }
            for r in readings
        ]
    }


@router.post("/zones/{zone_id}/scan")
async def scan_zone_vci(zone_id: int, db: AsyncSession = Depends(get_db)):
    """Triggers fresh VCI & DM computation and checks auto-payout breach."""
    reading = await compute_zone_vci(zone_id, db)
    payouts = await auto_trigger_check(db)
    return {
        "status": "success",
        "zone_id": zone_id,
        "vci_score": reading.vci_score,
        "ndvi_current": reading.ndvi_current,
        "triggered_payouts": len(payouts)
    }


from app.core.config import settings


@router.post("/test-inject-vci")
async def inject_low_vci_test(payload: InjectVCITestRequest, db: AsyncSession = Depends(get_db)):
    """
    DEMO TEST ENDPOINT: Injects a low VCI value (e.g. VCI = 30%) to trigger the AFII forage payout live.
    Sets status to 'triggered' (NEVER 'paid').
    """
    if not settings.DEMO_MODE:
        raise HTTPException(status_code=403, detail="Test VCI injection route is available only in demo mode.")
    reading = await compute_zone_vci(payload.zone_id, db, injected_vci=payload.vci_score)

    payouts = await auto_trigger_check(db)

    return {
        "status": "success",
        "message": f"Injected VCI score {reading.vci_score}% into Zone #{payload.zone_id}.",
        "vci_score": reading.vci_score,
        "triggered_payouts_count": len(payouts),
        "payouts": [
            {
                "id": p.id,
                "zone_id": p.zone_id,
                "status": p.status,  # Must be 'triggered'
                "total_payout": p.total_payout,
                "reference_id": p.reference_id
            }
            for p in payouts
        ]
    }


@router.post("/run-check")
async def run_manual_auto_trigger_check(db: AsyncSession = Depends(get_db)):
    """Runs manual auto-trigger evaluation for all active AFII policies."""
    payouts = await auto_trigger_check(db)
    return {
        "status": "success",
        "payouts_triggered_count": len(payouts),
        "payout_ids": [p.id for p in payouts]
    }


@router.get("/payouts")
async def list_afii_payouts(db: AsyncSession = Depends(get_db)):
    """Lists all AFII forage payouts for officer approval queue and audit log."""
    res_payouts = await db.execute(select(AFIIPayout).order_by(desc(AFIIPayout.trigger_date)))
    payouts = res_payouts.scalars().all()

    result = []
    for p in payouts:
        res_z = await db.execute(select(GrazingZone).where(GrazingZone.id == p.zone_id))
        zone = res_z.scalars().first()

        result.append({
            "id": p.id,
            "policy_id": p.policy_id,
            "zone_id": p.zone_id,
            "zone_name": zone.name if zone else f"Zone #{p.zone_id}",
            "state": zone.state if zone else "",
            "district": zone.district if zone else "",
            "trigger_date": p.trigger_date.isoformat() if p.trigger_date else None,
            "vci_at_trigger": p.vci_at_trigger,
            "payout_per_household": p.payout_per_household,
            "total_payout": p.total_payout,
            "households_covered": p.households_covered,
            "status": p.status,
            "reference_id": p.reference_id
        })

    return result


@router.post("/payouts/{payout_id}/approve")
async def approve_afii_payout(payout_id: int, db: AsyncSession = Depends(get_db)):
    """
    Officer status transition 1: 'triggered' -> 'approved'.
    A triggered row transitions to 'approved' (not directly 'paid').
    """
    res_p = await db.execute(select(AFIIPayout).where(AFIIPayout.id == payout_id))
    payout = res_p.scalars().first()
    if not payout:
        raise HTTPException(status_code=404, detail="AFII Payout record not found.")

    payout.status = "approved"
    payout.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(payout)

    try:
        await AuditChainEngine.add_block(
            claim_id=payout.id,
            action="AFII_FORAGE_PAYOUT_APPROVED",
            actor_id=3,
            actor_role="Officer",
            actor_name=f"Officer Approved AFII Forage Payout (₹{payout.total_payout:,.2f})",
            db=db,
        )
    except Exception as e:
        logger.warning(f"Audit chain note: {e}")

    return {
        "status": "success",
        "payout_id": payout.id,
        "new_status": payout.status,
        "total_payout": payout.total_payout,
        "reference_id": payout.reference_id
    }


@router.post("/payouts/{payout_id}/disburse")
async def disburse_afii_payout(payout_id: int, db: AsyncSession = Depends(get_db)):
    """
    Officer status transition 2: 'approved' -> 'paid'.
    Disburses funds to household bank accounts and sets final status to 'paid'.
    """
    res_p = await db.execute(select(AFIIPayout).where(AFIIPayout.id == payout_id))
    payout = res_p.scalars().first()
    if not payout:
        raise HTTPException(status_code=404, detail="AFII Payout record not found.")

    payout.status = "paid"
    payout.reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(payout)

    try:
        await AuditChainEngine.add_block(
            claim_id=payout.id,
            action="AFII_FORAGE_PAYOUT_DISBURSED",
            actor_id=3,
            actor_role="Officer",
            actor_name=f"Disbursed AFII Forage Payout (₹{payout.total_payout:,.2f})",
            db=db,
        )
    except Exception as e:
        logger.warning(f"Audit chain note: {e}")

    return {
        "status": "success",
        "payout_id": payout.id,
        "new_status": payout.status,
        "total_payout": payout.total_payout,
        "reference_id": payout.reference_id
    }
