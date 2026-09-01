import logging
import json
import ee
from typing import Optional
from google.oauth2 import service_account
from google.auth import default as google_auth_default
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GEEAuthError(Exception):
    """Base error for GEE Authentication."""
    pass

class InvalidCredentialsError(GEEAuthError):
    """Raised when credentials are empty, malformed or unauthorized."""
    pass

class QuotaExceededError(GEEAuthError):
    """Raised when the GEE project quota is exceeded."""
    pass

class ProjectNotFoundError(GEEAuthError):
    """Raised when the target GCP project is not found."""
    pass

class NetworkTimeoutError(GEEAuthError):
    """Raised when connections to the Earth Engine API timeout."""
    pass

@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((NetworkTimeoutError, ee.EEException)),
    reraise=True
)
def initialize_gee_sync() -> bool:
    """
    Synchronously initialize Google Earth Engine with credentials.
    Retries up to 5 times with exponential backoff on network failures.
    """
    try:
        logger.info("Attempting Google Earth Engine initialization...")
        credentials = None

        # 1. Service Account JSON key content (env variable)
        if settings.GEE_KEY_CONTENT:
            try:
                info = json.loads(settings.GEE_KEY_CONTENT)
                credentials = service_account.Credentials.from_service_account_info(info)
                logger.info("Loaded GEE service account credentials from GEE_KEY_CONTENT.")
            except Exception as e:
                logger.error(f"Failed to parse GEE_KEY_CONTENT: {e}")
                raise InvalidCredentialsError("Invalid service account JSON key content in settings.")
        
        # 2. Service Account JSON key file path
        elif settings.GEE_KEY_FILE:
            try:
                credentials = service_account.Credentials.from_service_account_file(settings.GEE_KEY_FILE)
                logger.info(f"Loaded GEE service account credentials from file: {settings.GEE_KEY_FILE}")
            except Exception as e:
                logger.error(f"Failed to load credentials from file {settings.GEE_KEY_FILE}: {e}")
                raise InvalidCredentialsError(f"Failed to load service account file: {e}")
        
        # 3. Fallback to Application Default Credentials (ADC)
        else:
            logger.info("No explicit service account provided. Loading Application Default Credentials (ADC)...")
            try:
                credentials, _ = google_auth_default()
            except Exception as e:
                logger.warning(f"Could not load Application Default Credentials: {e}. Defaulting to ee.Initialize() default login.")

        # Set up initialization parameters
        init_kwargs = {}
        if credentials:
            init_kwargs["credentials"] = credentials
        if settings.GEE_PROJECT:
            init_kwargs["project"] = settings.GEE_PROJECT

        # Execute EE initialization
        ee.Initialize(**init_kwargs)
        logger.info("Google Earth Engine initialized successfully.")
        return True

    except ee.EEException as e:
        msg = str(e).lower()
        logger.error(f"Earth Engine exception during initialization: {e}")
        if "quota" in msg:
            raise QuotaExceededError(f"GEE quota exceeded: {e}")
        elif "not found" in msg or "project" in msg:
            raise ProjectNotFoundError(f"GEE project not found: {e}")
        elif "credential" in msg or "unauthorized" in msg or "permission" in msg:
            raise InvalidCredentialsError(f"GEE credentials error: {e}")
        elif "timeout" in msg or "connection" in msg or "deadline" in msg:
            raise NetworkTimeoutError(f"GEE connection timed out: {e}")
        else:
            raise GEEAuthError(f"GEE initialization failed: {e}")
    except Exception as e:
        logger.error(f"Unexpected error during GEE initialization: {e}")
        raise GEEAuthError(f"GEE unexpected authentication error: {e}")

async def initialize_gee() -> bool:
    """Async-compatible wrapper to run GEE initialization in a thread pool."""
    import anyio
    return await anyio.to_thread.run_sync(initialize_gee_sync)

async def check_gee_health() -> dict:
    """
    Health check endpoint logic to verify active connection to Earth Engine.
    Runs a tiny sample evaluation query (ee.Image(1).getInfo()).
    """
    try:
        import anyio
        
        def query_ee():
            # Trivial execution query
            img = ee.Image(1)
            return img.getInfo()
            
        result = await anyio.to_thread.run_sync(query_ee)
        if result:
            return {"status": "healthy", "details": "Successfully connected and queried Google Earth Engine."}
        else:
            return {"status": "unhealthy", "details": "Query succeeded but returned empty payload."}
    except Exception as e:
        logger.error(f"GEE health check query failed: {e}")
        return {"status": "unhealthy", "error": str(e)}
