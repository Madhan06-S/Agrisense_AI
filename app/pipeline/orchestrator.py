import logging
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.models import DataPipelineRun
from app.pipeline.alerts import send_telegram_alert, send_fcm_push

logger = logging.getLogger(__name__)

# Enforce strict IDLE -> FETCHING -> PREPROCESSING -> RECONSTRUCTING -> FEATURE_ENGINEERING -> COMPLETED/FAILED pipeline transitions
VALID_TRANSITIONS = {
    "IDLE": ["FETCHING", "FAILED"],
    "PENDING": ["FETCHING", "FAILED"], # support pending from original fetch
    "FETCHING": ["PREPROCESSING", "FAILED"],
    "PREPROCESSING": ["RECONSTRUCTING", "FAILED"],
    "RECONSTRUCTING": ["FEATURE_ENGINEERING", "FAILED"],
    "FEATURE_ENGINEERING": ["COMPLETED", "FAILED"],
    "COMPLETED": [],
    "FAILED": []
}

class PipelineStateError(ValueError):
    """Exception raised when an invalid pipeline state transition is requested."""
    pass

class PipelineOrchestrator:
    @staticmethod
    async def create_run(db, farm_id: int) -> DataPipelineRun:
        """Creates and returns a new DataPipelineRun record initialized to IDLE."""
        run = DataPipelineRun(
            farm_id=farm_id,
            run_type="pipeline",
            status="IDLE",
            started_at=datetime.utcnow()
        )
        db.add(run)
        await db.commit()
        await db.refresh(run)
        logger.info(f"Initialized new pipeline run {run.id} (IDLE) for farm {farm_id}")
        return run

    @staticmethod
    async def transition_state(db, run_id: int, target_state: str, error_log: Optional[str] = None) -> DataPipelineRun:
        """
        Validates the transition and updates the status of the pipeline run.
        """
        result = await db.execute(select(DataPipelineRun).where(DataPipelineRun.id == run_id))
        run = result.scalars().first()
        if not run:
            raise PipelineStateError(f"Pipeline run {run_id} not found.")

        current_state = run.status.upper()
        target_state_upper = target_state.upper()

        # Enforce validation rules
        if target_state_upper not in VALID_TRANSITIONS.get(current_state, []):
            # Check if attempting to skip or go backwards
            raise PipelineStateError(
                f"Invalid pipeline state transition: {current_state} -> {target_state_upper}"
            )

        run.status = target_state_upper
        if error_log:
            run.error_log = error_log

        if target_state_upper in ["COMPLETED", "FAILED", "SUCCESS"]:
            # Standardize SUCCESS as COMPLETED
            if target_state_upper == "SUCCESS":
                run.status = "COMPLETED"
            run.completed_at = datetime.utcnow()
            run.duration_ms = int((run.completed_at - run.started_at).total_seconds() * 1000)

        await db.commit()
        await db.refresh(run)
        logger.info(f"Pipeline run {run_id} transitioned: {current_state} -> {run.status}")
        return run

    @staticmethod
    async def handle_timeouts() -> None:
        """
        Identifies active pipeline runs hanging for more than 30 minutes,
        marks them FAILED, logs the error, and fires FCM/Telegram alerts.
        """
        async with AsyncSessionLocal() as db:
            limit_time = datetime.utcnow() - timedelta(minutes=30)
            
            # Select runs running older than 30 minutes
            stmt = select(DataPipelineRun).where(
                DataPipelineRun.status.in_(["FETCHING", "PREPROCESSING", "RECONSTRUCTING", "FEATURE_ENGINEERING"]),
                DataPipelineRun.started_at <= limit_time
            )
            res = await db.execute(stmt)
            hung_runs = res.scalars().all()
            
            for run in hung_runs:
                logger.warning(f"Pipeline run {run.id} for farm {run.farm_id} hung in state '{run.status}' for >30m. Transitioning to FAILED.")
                
                run.status = "FAILED"
                run.completed_at = datetime.utcnow()
                run.duration_ms = int((run.completed_at - run.started_at).total_seconds() * 1000)
                run.error_log = f"Pipeline execution timed out (hung in state {run.status} > 30 minutes)."
                
                await db.commit()
                
                alert_text = f"ALERT: Pipeline run {run.id} for farm {run.farm_id} timed out in state {run.status}."
                await send_telegram_alert(alert_text)
                await send_fcm_push("Pipeline Timeout", alert_text)
