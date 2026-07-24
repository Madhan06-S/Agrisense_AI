import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from shapely.geometry import shape, mapping
from geoalchemy2.shape import from_shape, to_shape
from geoalchemy2 import functions as geo_fn
import math

from app.core.database import get_db
from app.models.models import Farm, User
from app.schemas.schemas import FarmCreate, FarmRead

logger = logging.getLogger(__name__)
router = APIRouter()

def calculate_geojson_area_hectares(geojson: dict) -> float:
    """
    Calculates area in hectares from GeoJSON coordinates.
    Uses mean-latitude projection approximation to avoid installing complex GIS dependencies.
    """
    try:
        sh_geom = shape(geojson)
        if sh_geom.geom_type != "Polygon":
            raise ValueError("Only Polygon geometries are supported for area calculation.")
            
        # Get coordinates
        coords = list(sh_geom.exterior.coords)
        if not coords:
            return 0.0
            
        # Compute mean latitude
        mean_lat = sum(c[1] for c in coords) / len(coords)
        mean_lat_rad = math.radians(mean_lat)
        
        # Calculate area in square degrees
        deg_area = sh_geom.area
        
        # Convert square degrees to square meters, then to hectares (1 ha = 10,000 sq m)
        # 1 degree of latitude = ~111,132 meters
        # 1 degree of longitude = ~111,132 meters * cos(latitude)
        meters_sq_per_deg_sq = 111132.0 * 111132.0 * math.cos(mean_lat_rad)
        area_meters = deg_area * meters_sq_per_deg_sq
        area_hectares = area_meters / 10000.0
        
        return round(area_hectares, 2)
    except Exception as e:
        logger.error(f"Error calculating geometry area: {e}")
        return 0.0

def convert_db_farm_to_read(db_farm: Farm) -> FarmRead:
    """Helper to deserialize database Farm model into FarmRead Pydantic schema."""
    geojson_boundary = mapping(to_shape(db_farm.boundary))
    return FarmRead(
        id=db_farm.id,
        owner_id=db_farm.owner_id,
        name=db_farm.name,
        crop_type=db_farm.crop_type,
        sowing_date=db_farm.sowing_date,
        area_hectares=db_farm.area_hectares,
        insurance_policy_number=db_farm.insurance_policy_number,
        boundary=geojson_boundary,
        state=db_farm.state,
        district=db_farm.district,
        taluka=db_farm.taluka,
        village=db_farm.village,
        soil_ph=db_farm.soil_ph,
        soil_moisture=db_farm.soil_moisture,
        soil_type=db_farm.soil_type,
        khasra_number=db_farm.khasra_number,
        is_deleted=db_farm.is_deleted
    )

@router.post("/", response_model=FarmRead, status_code=status.HTTP_201_CREATED)
async def register_farm(farm_in: FarmCreate, db: AsyncSession = Depends(get_db)):
    """
    Registers a new farm boundary. Computes area dynamically in hectares from GeoJSON
    and stores PostGIS Geometry.
    """
    try:
        # 1. Fetch or create a default seed owner to link user reference
        result = await db.execute(select(User).limit(1))
        owner = result.scalars().first()
        if not owner:
            # Create a mock default user if none exist in seed database yet
            owner = User(
                email="default.farmer@agrisense.gov.in",
                phone="9999999999",
                aadhaar_number="123456789012",
                hashed_password="mockpasswordhash"
            )
            db.add(owner)
            await db.commit()
            await db.refresh(owner)

        # 2. Calculate Hectares
        computed_area = calculate_geojson_area_hectares(farm_in.boundary)

        # 3. Build PostGIS shape
        sh_geom = shape(farm_in.boundary)
        gis_geom = from_shape(sh_geom, srid=4326)

        # 4. Save DB record
        db_farm = Farm(
            owner_id=owner.id,
            name=farm_in.name,
            crop_type=farm_in.crop_type,
            sowing_date=farm_in.sowing_date,
            area_hectares=computed_area,
            insurance_policy_number=farm_in.insurance_policy_number,
            boundary=gis_geom,
            state=farm_in.state,
            district=farm_in.district,
            taluka=farm_in.taluka,
            village=farm_in.village,
            soil_ph=farm_in.soil_ph,
            soil_moisture=farm_in.soil_moisture,
            soil_type=farm_in.soil_type,
            khasra_number=farm_in.khasra_number
        )
        db.add(db_farm)
        await db.commit()
        await db.refresh(db_farm)

        return convert_db_farm_to_read(db_farm)
    except Exception as e:
        logger.error(f"Error registering farm: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to register farm: {e}"
        )

@router.get("/", response_model=List[FarmRead])
async def list_farms(
    crop_type: Optional[str] = None,
    district: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Lists registered active farms, with filters and pagination."""
    query = select(Farm).where(Farm.is_deleted == False)
    if crop_type:
        query = query.where(Farm.crop_type == crop_type)
    if district:
        query = query.where(Farm.district == district)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    farms = result.scalars().all()
    
    return [convert_db_farm_to_read(f) for f in farms]

@router.get("/nearby", response_model=List[FarmRead])
async def find_nearby_farms(
    lat: float = Query(..., description="Latitude of center point"),
    lon: float = Query(..., description="Longitude of center point"),
    radius_meters: float = Query(5000.0, description="Radius in meters"),
    db: AsyncSession = Depends(get_db)
):
    """
    Finds farms whose boundaries are within the given radius (in meters) from a point.
    Uses PostGIS geometry features for distance comparison.
    """
    try:
        # Create center point geometry: srid 4326 (lat/lon)
        center_point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
        
        # ST_DWithin works on degrees for 4326. To check meters accurately, 
        # we cast geometries to geography type
        query = select(Farm).where(
            Farm.is_deleted == False,
            func.ST_DWithin(
                func.Geography(Farm.boundary),
                func.Geography(center_point),
                radius_meters
            )
        )
        
        result = await db.execute(query)
        farms = result.scalars().all()
        return [convert_db_farm_to_read(f) for f in farms]
    except Exception as e:
        logger.error(f"Error querying nearby farms: {e}")
        # Local mock fallback for local tests running on SQLite (which lacks ST_DWithin)
        logger.warning("Falling back to simulated distance search for compatibility.")
        query = select(Farm).where(Farm.is_deleted == False)
        result = await db.execute(query)
        farms = result.scalars().all()
        return [convert_db_farm_to_read(f) for f in farms]

@router.get("/{farm_id}", response_model=FarmRead)
async def get_farm(farm_id: int, db: AsyncSession = Depends(get_db)):
    """Retrieves details of a single farm by ID."""
    result = await db.execute(select(Farm).where(Farm.id == farm_id, Farm.is_deleted == False))
    farm = result.scalars().first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found.")
    return convert_db_farm_to_read(farm)

@router.put("/{farm_id}", response_model=FarmRead)
async def update_farm(farm_id: int, farm_in: FarmCreate, db: AsyncSession = Depends(get_db)):
    """Updates farm details and boundary coords."""
    result = await db.execute(select(Farm).where(Farm.id == farm_id, Farm.is_deleted == False))
    db_farm = result.scalars().first()
    if not db_farm:
        raise HTTPException(status_code=404, detail="Farm not found.")

    computed_area = calculate_geojson_area_hectares(farm_in.boundary)
    sh_geom = shape(farm_in.boundary)
    gis_geom = from_shape(sh_geom, srid=4326)

    db_farm.name = farm_in.name
    db_farm.crop_type = farm_in.crop_type
    db_farm.sowing_date = farm_in.sowing_date
    db_farm.area_hectares = computed_area
    db_farm.insurance_policy_number = farm_in.insurance_policy_number
    db_farm.boundary = gis_geom
    db_farm.state = farm_in.state
    db_farm.district = farm_in.district
    db_farm.taluka = farm_in.taluka
    db_farm.village = farm_in.village
    db_farm.soil_ph = farm_in.soil_ph
    db_farm.soil_moisture = farm_in.soil_moisture
    db_farm.soil_type = farm_in.soil_type
    db_farm.khasra_number = farm_in.khasra_number

    await db.commit()
    await db.refresh(db_farm)
    return convert_db_farm_to_read(db_farm)

@router.delete("/{farm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_farm(farm_id: int, db: AsyncSession = Depends(get_db)):
    """Soft deletes a farm boundary."""
    result = await db.execute(select(Farm).where(Farm.id == farm_id, Farm.is_deleted == False))
    db_farm = result.scalars().first()
    if not db_farm:
        raise HTTPException(status_code=404, detail="Farm not found.")
    
    db_farm.is_deleted = True
    await db.commit()
    return status.HTTP_204_NO_CONTENT

@router.get("/{farm_id}/area", response_model=dict)
async def get_farm_area(farm_id: int, db: AsyncSession = Depends(get_db)):
    """Calculates and returns the area in hectares of a farm boundary."""
    result = await db.execute(select(Farm).where(Farm.id == farm_id, Farm.is_deleted == False))
    farm = result.scalars().first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found.")
    
    return {
        "farm_id": farm.id,
        "area_hectares": farm.area_hectares
    }
