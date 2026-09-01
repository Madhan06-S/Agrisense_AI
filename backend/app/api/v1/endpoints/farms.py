import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from geoalchemy2.functions import ST_GeomFromGeoJSON, ST_Area, ST_AsGeoJSON, ST_Transform
from geoalchemy2.shape import to_shape

from app.core.database import get_db
from app.core.security import require_farmer, get_current_user
from app.models.farm import Farm
from app.models.user import User
from app.schemas.farm import FarmCreate, FarmUpdate, FarmOut, FarmListOut
from typing import List, Optional

router = APIRouter(prefix="/farms", tags=["Farms"])


def _geojson_from_boundary(boundary) -> Optional[dict]:
    """Convert PostGIS geometry to GeoJSON dict."""
    if boundary is None:
        return None
    try:
        return json.loads(to_shape(boundary).__geo_interface__.__str__().replace("'", '"'))
    except Exception:
        return None


@router.post("/", response_model=FarmOut, status_code=201)
async def create_farm(
    payload: FarmCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_farmer),
):
    farm = Farm(
        farmer_id=current_user.id,
        name=payload.name,
        crop_type=payload.crop_type,
        sowing_date=payload.sowing_date,
        insurance_policy_number=payload.insurance_policy_number,
    )

    if payload.boundary_geojson:
        geojson_str = json.dumps(payload.boundary_geojson)
        farm.boundary = ST_GeomFromGeoJSON(geojson_str)

    db.add(farm)
    await db.flush()  # get farm.id

    # Calculate area using PostGIS (convert to UTM for meters, then to hectares)
    if payload.boundary_geojson:
        area_result = await db.execute(
            select(
                func.ST_Area(ST_Transform(ST_GeomFromGeoJSON(json.dumps(payload.boundary_geojson)), 32643))
            )
        )
        area_m2 = area_result.scalar()
        if area_m2:
            farm.area_hectares = round(area_m2 / 10000, 4)

    await db.commit()
    await db.refresh(farm)

    out = FarmOut.model_validate(farm)
    out.boundary_geojson = payload.boundary_geojson
    return out


@router.get("")
async def get_my_farms(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "farmer":
        raise HTTPException(status_code=403, detail="Only farmers can view farms")
    
    result = await db.execute(
        select(Farm).where(Farm.farmer_id == current_user.id)
    )
    return result.scalars().all()


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

    # Officers can see any farm; farmers only their own
    if current_user.role == "farmer" and farm.farmer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    out = FarmOut.model_validate(farm)
    if farm.boundary is not None:
        try:
            geojson_result = await db.execute(
                select(ST_AsGeoJSON(Farm.boundary)).where(Farm.id == farm_id)
            )
            geojson_str = geojson_result.scalar()
            if geojson_str:
                out.boundary_geojson = json.loads(geojson_str)
        except Exception:
            pass
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
        geojson_str = json.dumps(payload.boundary_geojson)
        farm.boundary = ST_GeomFromGeoJSON(geojson_str)

    await db.commit()
    await db.refresh(farm)
    out = FarmOut.model_validate(farm)
    if payload.boundary_geojson:
        out.boundary_geojson = payload.boundary_geojson
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
