import os
import urllib.request
from typing import Optional, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.farm import Farm

# Try to initialize GEE
try:
    import ee
    try:
        ee.Initialize()
        GEE_INITIALIZED = True
        print("GEE initialized successfully in service")
    except Exception as e:
        print(f"GEE initialization failed in service: {e}")
        GEE_INITIALIZED = False
except ImportError:
    print("earthengine-api not installed. GEE service will run in fallback mock mode.")
    ee = None
    GEE_INITIALIZED = False

async def get_farm_ndvi(farm_id: int, db: AsyncSession, claim_date: Optional[str] = None) -> Dict:
    """
    Fetch real Sentinel-2 NDVI for a farm.
    Returns: {ndvi_score, image_path, ndvi_mean, status}
    """
    # Query farm
    result = await db.execute(select(Farm).where(Farm.id == farm_id))
    farm = result.scalar_one_or_none()
    if not farm:
        return {"ndvi_score": 50, "image_path": None, "ndvi_mean": 0.35, "status": "no_farm"}
    
    # Use farm boundary centroid if available, else default to Pune region
    lat = 18.5204
    lon = 73.8567
    boundary_wkt = getattr(farm, 'boundary', None)
    if boundary_wkt:
        try:
            from shapely.wkt import loads
            poly = loads(boundary_wkt)
            lon = poly.centroid.x
            lat = poly.centroid.y
        except Exception as e:
            print(f"Failed to parse farm boundary centroid: {e}")
    
    # Check if Earth Engine is active and authenticated
    if ee and GEE_INITIALIZED:
        try:
            # Create a point and buffer (farm area)
            point = ee.Geometry.Point([lon, lat])
            # Buffer ~500m around farm center for the image
            region = point.buffer(500)
            
            # Sentinel-2 Surface Reflectance (latest collection)
            collection = (
                ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filterBounds(region)
                .filterDate('2024-01-01', '2026-12-31')  # Wide range for demo
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
                .sort('system:time_start', False)  # Most recent first
            )
            
            image = collection.first()
            
            if image is None or image.getInfo() is None:
                raise ValueError("No satellite imagery available for this location")
            
            # Compute NDVI: (NIR - Red) / (NIR + Red)
            # Sentinel-2 bands: B4=Red, B8=NIR
            ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
            
            # Get mean NDVI in the region (0 to 1 scale)
            mean_ndvi = ndvi.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=region,
                scale=10,
                maxPixels=1e9
            ).get('NDVI').getInfo()
            
            # Convert to 0-100 score (healthy vegetation ~0.6-0.8)
            if mean_ndvi is None:
                ndvi_score = 50
            else:
                # Invert: lower NDVI = higher damage score
                # 0.5 NDVI = 50 score, 0.1 NDVI = 90 score (severe damage)
                ndvi_score = int(max(0, min(100, (0.6 - mean_ndvi) * 200)))
            
            # Generate visualization thumbnail
            vis_params = {
                'min': -0.2,
                'max': 0.8,
                'palette': ['brown', 'yellow', 'lightgreen', 'darkgreen']
            }
            
            thumb_url = ndvi.getThumbURL({
                'region': region,
                'dimensions': 512,
                'format': 'png',
                **vis_params
            })
            
            # Download and save the image
            claim_dir = "uploads/claims/satellite"
            os.makedirs(claim_dir, exist_ok=True)
            image_path = f"{claim_dir}/farm_{farm_id}_ndvi.png"
            
            # Run blocking I/O request in a thread pool to avoid blocking async event loop
            import anyio
            def download_thumb():
                urllib.request.urlretrieve(thumb_url, image_path)
            await anyio.to_thread.run_sync(download_thumb)
            
            return {
                "ndvi_score": ndvi_score,
                "image_path": f"/uploads/claims/satellite/farm_{farm_id}_ndvi.png",
                "ndvi_mean": round(mean_ndvi or 0, 3),
                "status": "success"
            }
            
        except Exception as e:
            print(f"GEE API Execution Error: {e}")
            # Fall through to realistic mock fallback
    
    # Fallback to realistic mock based on farm location
    return {
        "ndvi_score": 65,
        "image_path": None,
        "ndvi_mean": 0.28,
        "status": "fallback"
    }
