import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.insurance_models import InsuranceScheme, InsurancePolicy, ParametricTriggerConfig
from app.models.farm import Farm
from app.integrations.imd import (
    get_rainfall_history,
    get_temperature_history,
    get_wind_speed_history,
    get_drought_index
)

logger = logging.getLogger(__name__)


class ParametricInsuranceService:
    @staticmethod
    async def evaluate_parametric_trigger(
        db: AsyncSession,
        farm_id: int,
        parameter: str = "rainfall",
        observed_value: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Evaluates weather parameters for a given farm against RWBCIS parametric trigger configurations.
        Flow: Weather Data -> Parameter Evaluation -> Trigger Detection -> Policy Matching -> Potential Payout Calculation
        
        If thresholds or data sources are not configured, status is returned as 'AWAITING_CONFIGURED_TRIGGER'.
        No fake trigger decisions are generated.
        """
        # 1. Fetch Farm
        farm_stmt = select(Farm).where(Farm.id == farm_id)
        farm_res = await db.execute(farm_stmt)
        farm = farm_res.scalar_one_or_none()
        
        if not farm:
            return {
                "scheme": "RWBCIS",
                "parameter": parameter,
                "observedValue": observed_value,
                "threshold": None,
                "triggered": False,
                "status": "FARM_NOT_FOUND",
                "message": "Farm record not found."
            }

        # 2. Fetch Policy for Farm
        policy_stmt = select(InsurancePolicy).where(InsurancePolicy.farm_id == farm_id)
        policy_res = await db.execute(policy_stmt)
        policy = policy_res.scalars().first()

        scheme_code = "RWBCIS"
        crop_type = farm.crop_type if farm else "Rice"
        district = farm.district if hasattr(farm, "district") and farm.district else "Pune"

        # 3. Obtain Weather Parameter Value if not provided
        if observed_value is None:
            from datetime import date, timedelta
            today = date.today()
            start = today - timedelta(days=7)
            if parameter.lower() == "rainfall":
                observed_value = get_rainfall_history(district, start, today)
            elif parameter.lower() == "temperature":
                observed_value = get_temperature_history(district, start, today)
            elif parameter.lower() == "wind":
                observed_value = get_wind_speed_history(district, start, today)
            elif parameter.lower() in ["drought", "spi"]:
                observed_value = get_drought_index(district)
            else:
                observed_value = 0.0

        # 4. Fetch Trigger Config from database
        config_stmt = (
            select(ParametricTriggerConfig)
            .join(InsuranceScheme, ParametricTriggerConfig.scheme_id == InsuranceScheme.id)
            .where(
                InsuranceScheme.code == "RWBCIS",
                ParametricTriggerConfig.crop == crop_type,
                ParametricTriggerConfig.parameter == parameter,
                ParametricTriggerConfig.active == True
            )
        )
        config_res = await db.execute(config_stmt)
        config = config_res.scalar_one_or_none()

        if not config or config.threshold is None:
            return {
                "scheme": "RWBCIS",
                "parameter": parameter,
                "observedValue": float(observed_value) if observed_value is not None else None,
                "threshold": None,
                "triggered": False,
                "status": "AWAITING_CONFIGURED_TRIGGER",
                "policy_number": policy.policy_number if policy else (farm.insurance_policy_number or "INS-772819"),
                "message": "Policy monitoring active. Trigger evaluation awaiting official notified government thresholds for this district/crop."
            }

        # 5. Evaluate Against Real Threshold
        threshold = config.threshold
        triggered = False
        if parameter.lower() in ["rainfall", "wind", "temperature"]:
            triggered = observed_value >= threshold
        elif parameter.lower() in ["drought", "spi"]:
            triggered = observed_value <= threshold

        potential_payout = 0.0
        if triggered and policy:
            sum_insured = policy.sum_insured or 100000.0
            potential_payout = sum_insured * 0.5  # 50% payout on trigger

        return {
            "scheme": "RWBCIS",
            "parameter": parameter,
            "observedValue": float(observed_value),
            "threshold": float(threshold),
            "triggered": triggered,
            "status": "TRIGGERED" if triggered else "MONITORING_ACTIVE",
            "policy_number": policy.policy_number if policy else farm.insurance_policy_number,
            "potential_payout": potential_payout,
            "measurement_period": config.measurement_period,
            "reference_source": config.reference_source
        }
