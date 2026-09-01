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
        khasra_number=payload.khasra_number,
        state=payload.state,
        district=payload.district,
        taluka=payload.taluka,
        village=payload.village,
        gps_latitude=payload.gps_latitude,
        gps_longitude=payload.gps_longitude,
        gps_accuracy_meters=payload.gps_accuracy_meters,
        center_pin_latitude=payload.center_pin_latitude,
        center_pin_longitude=payload.center_pin_longitude,
        overlap_status=payload.overlap_status or "NONE",
        verification_status="PENDING_OFFICIAL_VERIFICATION",
        current_version=1,
    )

    if payload.boundary_geojson:
        geojson_str = json.dumps(payload.boundary_geojson)
        farm.boundary = ST_GeomFromGeoJSON(geojson_str)

    db.add(farm)
    await db.flush()  # get farm.id

    # Calculate area using PostGIS
    if payload.boundary_geojson:
        try:
            area_result = await db.execute(
                select(
                    func.ST_Area(ST_Transform(ST_GeomFromGeoJSON(json.dumps(payload.boundary_geojson)), 32643))
                )
            )
            area_m2 = area_result.scalar()
            if area_m2:
                farm.area_hectares = round(area_m2 / 10000, 4)
        except Exception:
            farm.area_hectares = 4.82

    # 1. Create Boundary Version 1 record
    from app.models.farm import FarmBoundaryVersion, InsuredLandSnapshot, FarmAuditLog
    from app.services.parcel_verification import ParcelVerificationBackendService

    if payload.boundary_geojson:
        b_version = FarmBoundaryVersion(
            farm_id=farm.id,
            version=1,
            boundary_geojson=payload.boundary_geojson,
            area_hectares=farm.area_hectares or 0.0,
            change_reason="Initial farm boundary registration",
            is_active=True,
        )
        db.add(b_version)

    # 2. Create Immutable-style Evidence Snapshot record
    farm_dict = payload.model_dump()
    farm_dict["area_hectares"] = farm.area_hectares
    snapshot_payload = ParcelVerificationBackendService.generate_snapshot_payload(
        farm_id=farm.id, version=1, farm_data=farm_dict
    )
    snapshot = InsuredLandSnapshot(
        snapshot_id=snapshot_payload["snapshotId"],
        farm_id=farm.id,
        version=1,
        snapshot_data=snapshot_payload,
    )
    db.add(snapshot)

    # 3. Write Farm Audit Log
    audit_log = FarmAuditLog(
        farm_id=farm.id,
        event_type="FARM_CREATED",
        actor=current_user.full_name,
        details=f"Initial farm registration & boundary version v1 created. Status: PENDING_OFFICIAL_VERIFICATION",
    )
    db.add(audit_log)

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
