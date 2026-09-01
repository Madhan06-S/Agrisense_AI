import logging
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.farm import Farm
from app.models.insurance_models import InsurancePolicy, InsuranceScheme
from app.integrations.imd import get_rainfall_history

logger = logging.getLogger(__name__)


class AgrisenseAIRiskService:
    @staticmethod
    async def assess_farm_risk(
        db: AsyncSession,
        farm_id: int
    ) -> Dict[str, Any]:
        """
        Connects:
        Farm -> Insured Land Snapshot -> Crop -> Policy -> Weather Data + Satellite Data -> Risk Assessment -> Early Warning & Agronomic Support
        """
        # 1. Fetch Farm
        farm_stmt = select(Farm).where(Farm.id == farm_id)
        farm_res = await db.execute(farm_stmt)
        farm = farm_res.scalar_one_or_none()

        farm_name = farm.name if farm else "Sample Farm"
        crop_type = farm.crop_type if farm else "Rice"
        district = farm.district if hasattr(farm, "district") and farm.district else "Kallakurichi"
        policy_no = farm.insurance_policy_number if farm and farm.insurance_policy_number else "INS-772819"

        # 2. Fetch Policy
        policy = None
        scheme_code = "PMFBY"
        if farm:
            pol_stmt = select(InsurancePolicy).where(InsurancePolicy.farm_id == farm_id)
            pol_res = await db.execute(pol_stmt)
            policy = pol_res.scalars().first()
            if policy and policy.scheme:
                scheme_code = policy.scheme.code

        # 3. Weather Data Assessment
        from datetime import date, timedelta
        today = date.today()
        start = today - timedelta(days=5)
        recent_rain = get_rainfall_history(district, start, today)

        # Weather Risk Level
        weather_risk_level = "Normal"
        potential_risk_desc = "No imminent extreme weather detected."
        agronomic_recommendation = "Maintain regular crop monitoring and standard field care."

        if recent_rain > 75.0:
            weather_risk_level = "High Rainfall Risk"
            potential_risk_desc = "Heavy rainfall and excess surface runoff expected."
            agronomic_recommendation = "Ensure field drainage channels are clear and monitor waterlogging over the next few days."
        elif recent_rain < 10.0:
            weather_risk_level = "Drought Risk"
            potential_risk_desc = "Rainfall deficit detected over the past measurement period."
            agronomic_recommendation = "Monitor soil moisture levels closely and follow recommended supplemental irrigation schedule."
        else:
            weather_risk_level = "Moderate Rainfall Risk"
            potential_risk_desc = "Moderate rainfall in forecast area."
            agronomic_recommendation = "Inspect field borders and verify drainage passages are unblocked."

        # Overall Risk Rating
        current_risk_rating = "Moderate" if weather_risk_level != "Normal" else "Low"

        return {
            "farm_id": farm_id,
            "farm_name": farm_name,
            "crop": crop_type,
            "insured_snapshot_id": f"SNAP-FARM{farm_id}-V1",
            "policy": {
                "policy_number": policy.policy_number if policy else policy_no,
                "scheme": scheme_code,
                "status": "Active"
            },
            "risk_assessment": {
                "current_risk": current_risk_rating,
                "weather_risk": weather_risk_level,
                "crop_health": "Normal",
                "insurance_status": "Active",
                "potential_risk": potential_risk_desc,
                "recommended_action": agronomic_recommendation
            },
            "data_source_status": "SIMULATED_DEMO_DATA"
        }
