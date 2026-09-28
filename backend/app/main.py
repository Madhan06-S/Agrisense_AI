import logging
import time
from datetime import datetime
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import app.core.database
from app.core.config import settings
from app.api.v1.api import api_router
from app.services.gee_auth import initialize_gee, check_gee_health, GEEAuthError

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)
import os
os.makedirs("data/uploads", exist_ok=True)
os.makedirs("data/media", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="data/uploads"), name="uploads")
app.mount("/media", StaticFiles(directory="data/media"), name="media")

# CORS middleware for Next.js communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    if os.environ.get("OPENROUTER_API_KEY"):
        logger.info("COPILOT: LLM provider ACTIVE (OpenRouter API key configured)")
    else:
        logger.info("COPILOT: LLM provider NOT configured — heuristic mode active (rule engine on real NDVI/weather data)")

    try:
        from app.ml.xgboost.inference import get_model_status
        xgb_status = get_model_status()
        if xgb_status["model_loaded"]:
            logger.info(f"ML: XGBoost booster LOADED (1500 trees, version {xgb_status['model_version']})")
        else:
            logger.warning("ML: XGBoost FAILED — mock fallback ACTIVE")
    except Exception as ml_err:
        logger.warning(f"ML: XGBoost health check error: {ml_err}")

    logger.info("Initializing Google Earth Engine on system startup...")
    try:
        await initialize_gee()
    except Exception as e:
        logger.error(
            f"Failed to auto-authenticate GEE on startup: {e}. "
            "Continuing boot; backend GEE health will show unhealthy."
        )
    
    # Run startup metadata create_all ONLY for SQLite in development mode
    if "sqlite" in settings.DATABASE_URL.lower() and settings.DEMO_MODE:
        logger.info("Initializing SQLite database tables in development mode...")
        try:
            from app.core.database import engine, Base
            import app.models
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Successfully ran Base.metadata.create_all.")
        except Exception as e:
            logger.error(f"Failed metadata create_all: {e}")


# Request logger middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    try:
        response = await call_next(request)
        duration = time.time() - start_time
        log_msg = (
            f"Method: {request.method} Path: {request.url.path} "
            f"Status: {response.status_code} Duration: {duration:.4f}s"
        )
        if response.status_code >= 500:
            logger.error(f"SERVER ERROR 5XX: {log_msg}")
        elif response.status_code >= 400:
            logger.warning(f"CLIENT ERROR 4XX: {log_msg}")
        else:
            logger.info(log_msg)
        return response
    except Exception as exc:
        duration = time.time() - start_time
        logger.error(
            f"UNHANDLED EXCEPTION: Method: {request.method} Path: {request.url.path} "
            f"Error: {exc} Duration: {duration:.4f}s"
        )
        raise exc

# Custom GEE Exception Handlers
@app.exception_handler(GEEAuthError)
async def gee_auth_exception_handler(request: Request, exc: GEEAuthError):
    logger.error(f"GEE auth error encountered: {exc}")
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": f"Earth Engine service is currently unavailable: {str(exc)}"}
    )

@app.get("/health", tags=["health"])
@app.get(f"{settings.API_V1_STR}/health", tags=["health"])
async def health_check():
    """
    Health check endpoint to verify database and GEE connectivity.
    """
    gee_status = await check_gee_health()
    
    # Verify Database connectivity
    db_status = "healthy"
    try:
        from app.core.database import AsyncSessionLocal
        from sqlalchemy import text
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    overall_status = "healthy"
    if gee_status.get("status") != "healthy" or db_status != "healthy":
        overall_status = "unhealthy"

    return {
        "status": overall_status,
        "database": db_status,
        "earth_engine": gee_status,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/health/readiness", tags=["health"])
@app.get(f"{settings.API_V1_STR}/health/readiness", tags=["health"])
async def readiness_check(response: JSONResponse = None):
    """
    Readiness endpoint checking Database and Redis connectivity.
    """
    db_ok = True
    redis_ok = True
    errors = []

    # Database check
    try:
        from app.core.database import AsyncSessionLocal
        from sqlalchemy import text
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception as e:
        db_ok = False
        errors.append(f"Database error: {e}")

    # Redis check
    try:
        import redis
        r = redis.from_url(settings.REDIS_URL, decode_responses=True)
        r.ping()
    except Exception as e:
        redis_ok = False
        errors.append(f"Redis error: {e}")

    is_ready = db_ok and redis_ok
    status_code = status.HTTP_200_OK if is_ready else status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(
        status_code=status_code,
        content={
            "ready": is_ready,
            "database": "healthy" if db_ok else "unhealthy",
            "redis": "healthy" if redis_ok else "unhealthy",
            "errors": errors,
            "timestamp": datetime.utcnow().isoformat()
        }
    )

# Include API endpoints
app.include_router(api_router, prefix=settings.API_V1_STR)

