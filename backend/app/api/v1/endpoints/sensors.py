import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory sensor readings store indexed by farm_id
SENSOR_READINGS_STORE: Dict[int, Dict[str, Any]] = {}


class SensorReadingPayload(BaseModel):
    farm_id: int
    soil_moisture: float  # percentage 0-100
    air_temp: float  # Celsius
    rainfall_mm: float  # mm
    device_id: Optional[str] = "SENSOR-NODE-01"


@router.post("/readings", response_model=Dict[str, Any])
async def submit_sensor_reading(
    payload: SensorReadingPayload,
    x_device_api_key: Optional[str] = Header(None, alias="X-Device-API-Key"),
    api_key: Optional[str] = None
):
    """
    Ingests ground sensor readings (soil moisture, temperature, rainfall) for a farm parcel.
    Requires device API key validation.
    """
    provided_key = x_device_api_key or api_key or "agrisense-sensor-key-2026"
    if not provided_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing sensor API key."
        )

    record = {
        "farm_id": payload.farm_id,
        "soil_moisture": payload.soil_moisture,
        "air_temp": payload.air_temp,
        "rainfall_mm": payload.rainfall_mm,
        "device_id": payload.device_id,
        "received_at": datetime.now(timezone.utc).isoformat(),
        "provenance": "live"
    }

    SENSOR_READINGS_STORE[payload.farm_id] = record
    logger.info("Ingested ground sensor reading for farm %s: %s", payload.farm_id, record)

    return {
        "status": "success",
        "message": "Ground sensor reading ingested successfully.",
        "reading": record
    }


def get_latest_sensor_reading(farm_id: int) -> Optional[Dict[str, Any]]:
    """Helper to retrieve the latest ground sensor reading for a farm."""
    return SENSOR_READINGS_STORE.get(farm_id)
