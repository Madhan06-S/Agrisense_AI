import logging
import time
from datetime import datetime
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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

# CORS middleware for Next.js communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    logger.info("Initializing Google Earth Engine on system startup...")
    try:
        await initialize_gee()
    except Exception as e:
        logger.error(
            f"Failed to auto-authenticate GEE on startup: {e}. "
            "Continuing boot; backend GEE health will show unhealthy."
        )
    
    # Run startup migrations/alters for SQLite database
    logger.info("Running startup DB alters...")
    try:
        from app.core.database import AsyncSessionLocal
        from sqlalchemy import text
        async with AsyncSessionLocal() as session:
            try:
                await session.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'farmer'"))
                await session.commit()
                logger.info("Successfully added role column to users table.")
            except Exception:
                pass
            
            try:
                await session.execute(text("ALTER TABLE users ADD COLUMN pin VARCHAR"))
                await session.commit()
                logger.info("Successfully added pin column to users table.")
            except Exception:
                pass
    except Exception as e:
        logger.error(f"Failed to run startup DB alters: {e}")

# Request logger middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(
        f"Method: {request.method} Path: {request.url.path} "
        f"Status: {response.status_code} Duration: {duration:.4f}s"
    )
    return response

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

# Include API endpoints
app.include_router(api_router, prefix=settings.API_V1_STR)
