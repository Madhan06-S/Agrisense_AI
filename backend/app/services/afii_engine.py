import time
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.models.afii import GrazingZone, VCIReading, AFIIPolicy, AFIIPayout
from app.compliance.audit_chain import AuditChainEngine
from app.integrations.gee_service import get_farm_ndvi_data

logger = logging.getLogger(__name__)


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


async def auto_trigger_check(db: AsyncSession) -> List[AFIIPayout]:
    """
    Scans all active AFII Policies.
    If latest VCI < survival_baseline_vci (default 35%), triggers automatic payout and logs to audit trail.
    """
    stmt_policies = select(AFIIPolicy).where(AFIIPolicy.active == True)
    res_policies = await db.execute(stmt_policies)
    policies = res_policies.scalars().all()

    new_payouts = []

    for policy in policies:
        # Fetch latest VCI reading for zone
        stmt_vci = select(VCIReading).where(VCIReading.zone_id == policy.zone_id).order_by(desc(VCIReading.date)).limit(1)
        res_vci = await db.execute(stmt_vci)
        latest_vci = res_vci.scalars().first()

        if not latest_vci:
            continue

        # Check breach: VCI < survival_baseline_vci (e.g. 35.0)
        if latest_vci.vci_score < policy.survival_baseline_vci:
            # Check if active payout already triggered for this zone/policy
            stmt_existing = select(AFIIPayout).where(
                AFIIPayout.policy_id == policy.id,
                AFIIPayout.zone_id == policy.zone_id,
                AFIIPayout.status.in_(["triggered", "processing", "paid"])
            )
            res_existing = await db.execute(stmt_existing)
            existing_payout = res_existing.scalars().first()

            if not existing_payout:
                # Fetch zone details
                stmt_zone = select(GrazingZone).where(GrazingZone.id == policy.zone_id)
                res_zone = await db.execute(stmt_zone)
                zone = res_zone.scalars().first()

                households = zone.num_households if zone else 100
                total_payout = policy.sum_insured_per_household * households
                ref_id = f"AFII-PAYOUT-Z{policy.zone_id}-{int(time.time())}"

                payout = AFIIPayout(
                    policy_id=policy.id,
                    zone_id=policy.zone_id,
                    trigger_date=datetime.now(timezone.utc),
                    vci_at_trigger=latest_vci.vci_score,
                    payout_per_household=policy.sum_insured_per_household,
                    total_payout=total_payout,
                    households_covered=households,
                    status="triggered",
                    reference_id=ref_id
                )
                db.add(payout)
                await db.commit()
                await db.refresh(payout)

                # Log to AuditChain Engine
                try:
                    await AuditChainEngine.add_block(
                        claim_id=payout.id,
                        action="AFII_FORAGE_PAYOUT_TRIGGERED",
                        actor_id=1,
                        actor_role="AFII Engine",
                        actor_name=f"Zone #{policy.zone_id} VCI Breach ({latest_vci.vci_score:.1f}% < {policy.survival_baseline_vci}%)",
                        db=db,
                    )
                except Exception as e:
                    logger.warning(f"Audit chain note: {e}")

                new_payouts.append(payout)

    return new_payouts
