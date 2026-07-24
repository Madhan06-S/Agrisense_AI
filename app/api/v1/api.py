from fastapi import APIRouter
from app.api.v1.endpoints import farms, satellite, catalog, quality, pipeline, preprocessing, timeseries
from app.pipeline.metrics import router as metrics_router

api_router = APIRouter()
api_router.include_router(farms.router, prefix="/farms", tags=["farms"])
api_router.include_router(satellite.router, prefix="/satellite", tags=["satellite"])
api_router.include_router(catalog.router, prefix="/catalog", tags=["catalog"])
api_router.include_router(quality.router, prefix="/quality", tags=["quality"])
api_router.include_router(pipeline.router, prefix="/pipeline", tags=["pipeline"])
api_router.include_router(preprocessing.router, prefix="/preprocessing", tags=["preprocessing"])
api_router.include_router(timeseries.router, prefix="/timeseries", tags=["timeseries"])
api_router.include_router(metrics_router, tags=["metrics"])
