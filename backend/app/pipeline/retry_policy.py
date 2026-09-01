import os
import logging
import tempfile
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

def move_to_failed_dlq(farm_id: int, folder_prefix: str) -> None:
    """
    Moves files associated with a failed run in the storage backend
    to the 'failed/' prefix.
    """
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
