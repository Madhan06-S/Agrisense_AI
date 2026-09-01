import logging
from datetime import datetime, timedelta
from sqlalchemy import select, func
from app.core.database import AsyncSessionLocal
from app.models.models import DataPipelineRun

logger = logging.getLogger(__name__)

async def send_telegram_alert(message: str) -> None:
    """Sends a mock Telegram message."""
    logger.info(f"[MOCK TELEGRAM ALERT] Sending Telegram message: {message}")

async def send_fcm_push(title: str, body: str, topic: str = "pipeline_alerts") -> None:
    """Sends a mock FCM push notification."""
    logger.info(f"[MOCK FCM ALERT] Sending Push Title: '{title}', Body: '{body}' to topic: '{topic}'")

async def check_critical_failure_rate() -> None:
    """
    Checks the pipeline run failure rate over the last hour.
    Triggers critical alerts if the rate exceeds 10%.
    """
    async with AsyncSessionLocal() as db:
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        
        # Query total and failed runs
        stmt = select(
            func.count(DataPipelineRun.id).label("total"),
            func.count(DataPipelineRun.id).filter(DataPipelineRun.status == "failed").label("failed")
        ).where(DataPipelineRun.started_at >= one_hour_ago)
        
        res = await db.execute(stmt)
        row = res.first()
        if not row or not row.total:
            return
            
        total, failed = row.total, row.failed
        failure_rate = (failed / total) * 100.0 if total > 0 else 0.0
        
        if failure_rate > 10.0:
            alert_msg = f"CRITICAL: Pipeline failure rate is {failure_rate:.1f}% ({failed}/{total} failed) in the last hour!"
            logger.error(alert_msg)
            await send_telegram_alert(alert_msg)
            await send_fcm_push("CRITICAL: High Pipeline Failure Rate", alert_msg)

async def send_daily_email_digest() -> None:
    """
    Generates a daily email digest summarizing pipeline run statistics
    and logs/emits it.
    """
    async with AsyncSessionLocal() as db:
        yesterday = datetime.utcnow() - timedelta(days=1)
        
        stmt = select(
            func.count(DataPipelineRun.id).label("total"),
            func.count(DataPipelineRun.id).filter(DataPipelineRun.status == "success").label("success"),
            func.count(DataPipelineRun.id).filter(DataPipelineRun.status == "failed").label("failed"),
            func.avg(DataPipelineRun.duration_ms).label("avg_duration")
        ).where(DataPipelineRun.started_at >= yesterday)
        
        res = await db.execute(stmt)
        row = res.first()
        if not row or not row.total:
            logger.info("Daily Digest: No pipeline activity recorded in the last 24 hours.")
            return
            
        avg_dur_sec = (row.avg_duration or 0.0) / 1000.0
        
        digest_content = (
            f"Daily AgriSense Pipeline Status Digest\n"
            f"---------------------------------------\n"
            f"Total runs: {row.total}\n"
            f"Successful runs: {row.success}\n"
            f"Failed runs: {row.failed}\n"
            f"Average duration: {avg_dur_sec:.2f}s\n"
        )
        logger.info(f"[MOCK EMAIL DIGEST SENT] Content:\n{digest_content}")
