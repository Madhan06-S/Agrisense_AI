import time
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.models.afii import GrazingZone, VCIReading, AFIIPolicy, AFIIPayout
from app.compliance.audit_chain import AuditChainEngine
from app.integrations.gee_service import get_farm_ndvi_data
from app.services.forage import (
    estimate_forage_biomass,
    compute_required_dm_per_ha,
    compute_vci_trend_and_projection,
    determine_afii_zone_status,
    FORAGE_REGRESSION_CONFIG
)

logger = logging.getLogger(__name__)

# Store for active Watch pre-alerts and SMS advisories dispatched
WATCH_PRE_ALERTS: List[Dict[str, Any]] = []


def compute_vci_formula(ndvi_current: float, ndvi_min: float = 0.15, ndvi_max: float = 0.75) -> float:
    """
    Computes Vegetation Condition Index (VCI):
    VCI = 100 * (NDVI_current - NDVI_min) / (NDVI_max - NDVI_min)
    Clamped strictly between 0.0 and 100.0.
    """
    if ndvi_max <= ndvi_min:
        return 50.0
    vci = 100.0 * (ndvi_current - ndvi_min) / (ndvi_max - ndvi_min)
    return round(max(0.0, min(100.0, vci)), 2)


async def compute_zone_vci(zone_id: int, db: AsyncSession, injected_vci: Optional[float] = None) -> VCIReading:
    """
    Pulls NDVI for grazing zone and computes VCI reading.
    Allows injecting low VCI for live demonstration/testing.
    """
    stmt = select(GrazingZone).where(GrazingZone.id == zone_id)
    res = await db.execute(stmt)
    zone = res.scalars().first()
    if not zone:
        raise ValueError(f"GrazingZone {zone_id} not found.")

    ndvi_min = 0.15
    ndvi_max = 0.75

    if injected_vci is not None:
        vci_score = round(max(0.0, min(100.0, injected_vci)), 2)
        ndvi_current = round(ndvi_min + (vci_score / 100.0) * (ndvi_max - ndvi_min), 3)
    else:
        # Pull NDVI from GEE or fallback
        gee_data = await get_farm_ndvi_data(zone_id, db)
        ndvi_current = gee_data.get("ndvi_mean", 0.48)
        vci_score = compute_vci_formula(ndvi_current, ndvi_min, ndvi_max)

    reading = VCIReading(
        zone_id=zone_id,
        date=datetime.now(timezone.utc),
        vci_score=vci_score,
        ndvi_current=ndvi_current,
        ndvi_long_term_mean=0.52,
        ndvi_min=ndvi_min,
        ndvi_max=ndvi_max,
        source="sentinel-2"
    )
    db.add(reading)
    await db.commit()
    await db.refresh(reading)
    return reading


async def evaluate_zone_forage_and_warning(
    zone: GrazingZone,
    policy: Optional[AFIIPolicy],
    db: AsyncSession
) -> Dict[str, Any]:
    """
    Evaluates forage biomass (DM/ha), survival baseline, VCI trend, days to breach,
    and returns early warning status (Normal / Watch / Triggered).
    """
    # Fetch historical VCI readings for trend projection
    stmt_vci = select(VCIReading).where(VCIReading.zone_id == zone.id).order_by(VCIReading.date.asc())
    res_vci = await db.execute(stmt_vci)
    vci_readings = res_vci.scalars().all()

    latest_reading = vci_readings[-1] if vci_readings else None
    current_vci = latest_reading.vci_score if latest_reading else 50.0
    current_ndvi = latest_reading.ndvi_current if latest_reading else 0.48

    # 1. Forage biomass estimate (kg DM/ha)
    dm_available = estimate_forage_biomass(current_ndvi)

    # 2. Survival baseline required DM/ha
    livestock = zone.livestock_count or 850
    area_ha = getattr(zone, "area_hectares", 100.0) or 100.0
    dm_required = compute_required_dm_per_ha(livestock, area_ha)

    threshold_vci = policy.survival_baseline_vci if policy else 35.0

    # 3. VCI trend & days to breach projection
    vci_history = [(r.date, r.vci_score) for r in vci_readings if r.date and r.vci_score is not None]
    dvci_per_day, days_to_breach = compute_vci_trend_and_projection(vci_history, current_vci, threshold_vci)

    # 4. Status determination (Normal / Watch / Triggered)
    status, is_breached, reason = determine_afii_zone_status(
        current_vci, threshold_vci, dm_available, dm_required, days_to_breach
    )

    # 5. Dispatch Watch Pre-Alert if in Watch state
    if status == "Watch":
        alert_record = {
            "zone_id": zone.id,
            "zone_name": zone.name,
            "days_to_breach": days_to_breach,
            "current_vci": current_vci,
            "dispatched_at": datetime.now(timezone.utc).isoformat(),
            "message": f"Pre-alert: Forage trend in {zone.name} indicates projected breach in {days_to_breach} days. Prepare supplemental feed."
        }
        if not any(a["zone_id"] == zone.id and a["days_to_breach"] == days_to_breach for a in WATCH_PRE_ALERTS):
            WATCH_PRE_ALERTS.append(alert_record)
            logger.info("Dispatched AFII Watch Pre-Alert & SMS: %s", alert_record)

    return {
        "zone_id": zone.id,
        "vci_score": current_vci,
        "ndvi_current": current_ndvi,
        "survival_baseline_vci": threshold_vci,
        "dm_available_kg_ha": dm_available,
        "dm_required_kg_ha": dm_required,
        "vci_breach": current_vci < threshold_vci,
        "dm_shortfall_breach": dm_available < dm_required,
        "days_to_breach": days_to_breach,
        "dvci_per_day": dvci_per_day,
        "vci_status": status,
        "is_breached": is_breached,
        "status_reason": reason,
        "regression_calibration_label": FORAGE_REGRESSION_CONFIG["label"],
        "daily_intake_label": FORAGE_REGRESSION_CONFIG["intake_label"]
    }


async def auto_trigger_check(db: AsyncSession) -> List[AFIIPayout]:
    """
    Scans all active AFII Policies.
    Payout triggered if EITHER VCI < 35% OR DM available < DM required.
    Status flow: 'triggered' -> 'approved' -> 'paid'.
    A triggered row MUST NEVER say 'paid' until explicitly approved and disbursed!
    """
    stmt_policies = select(AFIIPolicy).where(AFIIPolicy.active == True)
    res_policies = await db.execute(stmt_policies)
    policies = res_policies.scalars().all()

    new_payouts = []

    for policy in policies:
        stmt_zone = select(GrazingZone).where(GrazingZone.id == policy.zone_id)
        res_zone = await db.execute(stmt_zone)
        zone = res_zone.scalars().first()
        if not zone:
            continue

        eval_res = await evaluate_zone_forage_and_warning(zone, policy, db)

        # Dual trigger condition: VCI breach OR DM/ha shortfall breach
        if eval_res["is_breached"]:
            # Check if active payout already exists for this zone/policy
            stmt_existing = select(AFIIPayout).where(
                AFIIPayout.policy_id == policy.id,
                AFIIPayout.zone_id == policy.zone_id,
                AFIIPayout.status.in_(["triggered", "approved", "processing", "paid"])
            )
            res_existing = await db.execute(stmt_existing)
            existing_payout = res_existing.scalars().first()

            if not existing_payout:
                households = zone.num_households or 100
                total_payout = policy.sum_insured_per_household * households
                ref_id = f"AFII-PAYOUT-Z{policy.zone_id}-{int(time.time())}"

                # Strict status flow initialization: status = 'triggered' (NEVER 'paid')
                payout = AFIIPayout(
                    policy_id=policy.id,
                    zone_id=policy.zone_id,
                    trigger_date=datetime.now(timezone.utc),
                    vci_at_trigger=eval_res["vci_score"],
                    payout_per_household=policy.sum_insured_per_household,
                    total_payout=total_payout,
                    households_covered=households,
                    status="triggered",  # Initial status MUST be 'triggered'
                    reference_id=ref_id
                )
                db.add(payout)
                await db.commit()
                await db.refresh(payout)

                # Log trigger to AuditChain Engine
                try:
                    await AuditChainEngine.add_block(
                        claim_id=payout.id,
                        action="AFII_FORAGE_PAYOUT_TRIGGERED",
                        actor_id=1,
                        actor_role="AFII Engine",
                        actor_name=f"Zone #{policy.zone_id} Breach ({eval_res['status_reason']})",
                        db=db,
                    )
                except Exception as e:
                    logger.warning(f"Audit chain note: {e}")

                new_payouts.append(payout)

    return new_payouts
