import json
import math
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from shapely.geometry import shape

from app.core.database import get_db
from app.core.security import require_farmer, get_current_user
from app.models.farm import Farm
from app.models.user import User
from app.schemas.farm import FarmCreate, FarmUpdate, FarmOut, FarmListOut

router = APIRouter(prefix="/farms", tags=["Farms"])


def _calculate_area_hectares(boundary_geojson: dict) -> float:
    """Calculate polygon area in hectares using Shapely with latitude correction."""
    if not boundary_geojson:
        return 0.0
    try:
        poly = shape(boundary_geojson)
        centroid = poly.centroid
        lat_rad = math.radians(centroid.y)
        m_lat = 111132.92
        m_lon = 111412.84 * math.cos(lat_rad)
        area_m2 = poly.area * m_lat * m_lon
        return round(area_m2 / 10000.0, 4)
    except Exception:
        return 0.0


def _parse_boundary_json(boundary_val) -> Optional[dict]:
    """Parse stored boundary value to GeoJSON dict."""
    if not boundary_val:
        return None
    if isinstance(boundary_val, dict):
        return boundary_val
    try:
        from geoalchemy2.shape import to_shape
        from shapely.geometry import mapping
        return mapping(to_shape(boundary_val))
    except Exception:
        pass
    try:
        return json.loads(str(boundary_val))
    except Exception:
        return None


@router.post("/", response_model=FarmOut, status_code=201)
async def create_farm(
    payload: FarmCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_farmer),
):
    boundary_geom = None
    if payload.boundary_geojson:
        try:
            from geoalchemy2.shape import from_shape
            poly = shape(payload.boundary_geojson)
            boundary_geom = from_shape(poly, srid=4326)
        except Exception:
            boundary_geom = None

    calculated_area = _calculate_area_hectares(payload.boundary_geojson) if payload.boundary_geojson else None

    farm = Farm(
        farmer_id=current_user.id,
        name=payload.name,
        crop_type=payload.crop_type,
        sowing_date=payload.sowing_date,
        insurance_policy_number=payload.insurance_policy_number,
        khasra_number=payload.khasra_number,
        boundary=boundary_geom,
        area_hectares=calculated_area,
    )

    db.add(farm)
    await db.commit()
    await db.refresh(farm)

    out = FarmOut.model_validate(farm)
    out.boundary_geojson = payload.boundary_geojson
    return out


@router.get("", response_model=List[FarmOut])
@router.get("/", response_model=List[FarmOut])
async def get_my_farms(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "farmer":
        raise HTTPException(status_code=403, detail="Only farmers can view farms")

    result = await db.execute(
        select(Farm).where(Farm.farmer_id == current_user.id)
    )
    farms = result.scalars().all()
    
    out_list = []
    for f in farms:
        item = FarmOut.model_validate(f)
        item.boundary_geojson = _parse_boundary_json(f.boundary)
        out_list.append(item)
    return out_list


@router.get("/nearby", response_model=List[FarmOut])
async def get_nearby_farms(
    lat: float,
    lon: float,
    radius_km: float = 10.0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Farm))
    farms = result.scalars().all()
    out_list = []
    for f in farms:
        item = FarmOut.model_validate(f)
        item.boundary_geojson = _parse_boundary_json(f.boundary)
        out_list.append(item)
    return out_list


@router.get("/{farm_id}", response_model=FarmOut)
async def get_farm(
    farm_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Farm).where(Farm.id == farm_id))
    farm = result.scalar_one_or_none()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    if current_user.role == "farmer" and farm.farmer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    out = FarmOut.model_validate(farm)
    out.boundary_geojson = _parse_boundary_json(farm.boundary)
    return out


@router.put("/{farm_id}", response_model=FarmOut)
async def update_farm(
    farm_id: int,
    payload: FarmUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_farmer),
):
    result = await db.execute(
        select(Farm).where(Farm.id == farm_id, Farm.farmer_id == current_user.id)
    )
    farm = result.scalar_one_or_none()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    for field, value in payload.model_dump(exclude_none=True, exclude={"boundary_geojson"}).items():
        setattr(farm, field, value)

    if payload.boundary_geojson:
        farm.boundary = json.dumps(payload.boundary_geojson)
        farm.area_hectares = _calculate_area_hectares(payload.boundary_geojson)

    await db.commit()
    await db.refresh(farm)
    out = FarmOut.model_validate(farm)
    out.boundary_geojson = _parse_boundary_json(farm.boundary)
    return out


@router.delete("/{farm_id}", status_code=204)
async def delete_farm(
    farm_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_farmer),
):
    result = await db.execute(
        select(Farm).where(Farm.id == farm_id, Farm.farmer_id == current_user.id)
    )
    farm = result.scalar_one_or_none()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    await db.delete(farm)
    await db.commit()
