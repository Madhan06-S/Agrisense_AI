from datetime import date, datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.farm import Farm
from app.models.claim import Claim, ClaimStatus, ClaimType
from app.models.imd_alert import IMDAlert
from app.integrations.imd import get_rainfall_history, get_temperature_history, get_wind_speed_history, get_drought_index
from app.compliance.audit_chain import AuditChainEngine


class ParametricTriggerEngine:
    @staticmethod
    async def evaluate_triggers(db: AsyncSession) -> dict:
        """
        Daily cron trigger evaluator. Checks IMD logs for all active districts,
        registers alerts, and auto-generates claims for affected farms.
        """
        # Active demo districts in our platform
        districts = ["Warangal", "Khammam", "Puri", "Marathwada", "Mumbai"]
        today = date.today()
        start = today - timedelta(days=2)
        
        claims_created = 0
        alerts_raised = []

        for dist in districts:
            # 1. Flood check (Rainfall > 100mm)
            rain = get_rainfall_history(dist, start, today)
            if rain > 100:
                alert = await ParametricTriggerEngine._log_alert(dist, "flood", "severe", today, rain, 0.0, db)
                alerts_raised.append(alert)
                count = await ParametricTriggerEngine._trigger_auto_claims(dist, ClaimType.flood, alert, db)
                claims_created += count
                
            # 2. Cyclone check (Wind > 80 km/h)
            wind = get_wind_speed_history(dist, start, today)
            if wind > 80:
                alert = await ParametricTriggerEngine._log_alert(dist, "cyclone", "severe", today, 0.0, wind, db)
                alerts_raised.append(alert)
                count = await ParametricTriggerEngine._trigger_auto_claims(dist, ClaimType.cyclone, alert, db)
                claims_created += count

            # 3. Drought check (SPI < -1.5)
            spi = get_drought_index(dist)
            if spi < -1.5:
                alert = await ParametricTriggerEngine._log_alert(dist, "drought", "severe", today, 0.0, 0.0, db)
                alerts_raised.append(alert)
                count = await ParametricTriggerEngine._trigger_auto_claims(dist, ClaimType.drought, alert, db)
                claims_created += count

        return {
            "alerts_triggered": len(alerts_raised),
            "claims_auto_filed": claims_created,
            "districts_checked": len(districts),
        }

    @staticmethod
    async def _log_alert(
        district: str,
        alert_type: str,
        severity: str,
        today: date,
        rain: float,
        wind: float,
        db: AsyncSession,
    ) -> IMDAlert:
        alert = IMDAlert(
            district=district,
            alert_type=alert_type,
            severity=severity,
            start_date=today - timedelta(days=2),
            end_date=today,
            rainfall_mm=rain,
            wind_speed=wind,
        )
        db.add(alert)
        await db.commit()
        await db.refresh(alert)
        return alert

    @staticmethod
    async def _trigger_auto_claims(
        district: str,
        claim_type: ClaimType,
        alert: IMDAlert,
        db: AsyncSession,
    ) -> int:
        """Find farms in the district and create claims if not already filed."""
        # Join farms and user profiles to filter by district
        from app.models.user import User
        stmt = (
            select(Farm)
            .join(User, Farm.farmer_id == User.id)
            .where(User.district == district)
        )
        result = await db.execute(stmt)
        farms = result.scalars().all()
        
        count = 0
        for farm in farms:
            # Check if active claim of this type already exists in last 7 days
            seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
            check_stmt = (
                select(Claim)
                .where(
                    Claim.farm_id == farm.id,
                    Claim.claim_type == claim_type,
                    Claim.submitted_at >= seven_days_ago
                )
            )
            check_res = await db.execute(check_stmt)
            if check_res.scalar_one_or_none():
                continue # Skip if claim already exists
                
            claim = Claim(
                farm_id=farm.id,
                farmer_id=farm.farmer_id,
                claim_type=claim_type,
                description=f"Auto-generated claim by government parametric trigger. IMD Alert Reference ID #{alert.id} for {alert.alert_type} in {alert.district}.",
                status=ClaimStatus.submitted,
                is_parametric=True,
                trigger_source="IMD",
                imd_alert_id=alert.id,
            )
            db.add(claim)
            await db.flush() # get claim.id
            
            # Write to audit chain
            await AuditChainEngine.add_block(
                claim_id=claim.id,
                action="SUBMITTED",
                actor_id=None,
                actor_role="IMD Weather Station",
                actor_name=f"IMD Auto-Trigger ({alert.district})",
                db=db,
            )
            
            # Send mock SMS to farmer
            print(f"📡 MOCK SMS SENT to farmer {farm.farmer_id} of Farm #{farm.id}: Claim #{claim.id} auto-filed for {claim_type.value} damage.")
            count += 1
            
        await db.commit()
        return count
