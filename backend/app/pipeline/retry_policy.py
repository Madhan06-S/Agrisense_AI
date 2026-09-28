import os
import logging
import tempfile
from typing import Optional
from datetime import datetime
from app.core.storage import get_storage_backend

logger = logging.getLogger(__name__)

class GEEQuotaError(Exception):
    """Exception raised when Google Earth Engine quota is exceeded."""
    pass

class NetworkError(Exception):
    """Exception raised on network connectivity failures."""
    pass

class InvalidDataError(Exception):
    """Exception raised when inputs fail validation (no retry)."""
    pass

def send_pipeline_alert(farm_id: int, stage: str, error_msg: str, run_id: Optional[int] = None) -> bool:
    """Dispatches webhook / SMS notification on pipeline stage failure."""
    from app.core.config import settings
    import requests
    
    payload = {
        "event": "pipeline_failure",
        "farm_id": farm_id,
        "run_id": run_id,
        "stage": stage,
        "error": error_msg,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    logger.warning(f"[PIPELINE ALERT] Pipeline failure on farm {farm_id} during stage '{stage}': {error_msg}")
    
    if settings.ALERT_WEBHOOK_URL:
        try:
            res = requests.post(settings.ALERT_WEBHOOK_URL, json=payload, timeout=5)
            return res.status_code < 400
        except Exception as err:
            logger.error(f"[PIPELINE ALERT] Webhook notification failed: {err}")
            return False
    return True

def move_to_failed_dlq(farm_id: int, folder_prefix: str, error_msg: str = "", run_id: Optional[int] = None) -> None:
    """
    Moves files associated with a failed run in the storage backend
    to the 'failed/' prefix and triggers alert notifications.
    """
    send_pipeline_alert(farm_id, folder_prefix, error_msg, run_id)

    storage = get_storage_backend()
    # List files matching the farm prefix
    target_prefix = f"farm-{farm_id}/{folder_prefix}" if folder_prefix else f"farm-{farm_id}"
    logger.info(f"Moving files under prefix '{target_prefix}' to DLQ failed/ prefix...")
    
    try:
        files = storage.list(target_prefix)
        for f in files:
            # Clean up key/path
            clean_path = f
            # For MinIO, list might prepend bucket name, let's normalize
            if clean_path.startswith("raw-data/"):
                clean_path = clean_path[len("raw-data/"):]
            elif clean_path.startswith("processed-data/"):
                clean_path = clean_path[len("processed-data/"):]
                
            if "failed/" in clean_path:
                continue
                
            try:
                with tempfile.TemporaryDirectory() as temp_dir:
                    local_file = os.path.join(temp_dir, os.path.basename(clean_path))
                    storage.download(clean_path, local_file)
                    
                    # Upload to failed/ path
                    dlq_path = f"failed/{clean_path.lstrip('/')}"
                    storage.upload(local_file, dlq_path)
                    
                    # Delete original
                    storage.delete(clean_path)
                    logger.info(f"Successfully moved {clean_path} to DLQ path {dlq_path}")
            except Exception as e:
                logger.error(f"Failed to move file {clean_path} to DLQ: {e}")
    except Exception as e:
        logger.error(f"DLQ moving failed for prefix '{target_prefix}': {e}")
