import os
import urllib.request
from typing import Optional, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.farm import Farm

# Try to init GEE
GEE_AVAILABLE = False
try:
    import ee
    try:
        ee.Initialize()
        GEE_AVAILABLE = True
        print("GEE initialized successfully")
    except Exception as e:
        print(f"GEE not available ({e}). Using fallback image generation.")
except ImportError:
    print("earthengine-api not installed. GEE service will run in fallback mock mode.")
    ee = None

def _generate_fallback_ndvi_image(save_path: str, ndvi_score: int, ndvi_mean: float):
    """
    Generate a fake but realistic NDVI heatmap image when GEE is unavailable.
    Green = healthy, Yellow = moderate, Brown = damaged.
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
        
        width, height = 600, 240
        img = Image.new('RGB', (width, height), color=(240, 240, 240))
        draw = ImageDraw.Draw(img)
        
        # Color based on NDVI mean
        if ndvi_mean < 0.2:
            base_color = (160, 82, 45)  # Brown - damaged
            label = "SEVERE DAMAGE"
        elif ndvi_mean < 0.4:
            base_color = (255, 215, 0)  # Yellow - moderate
            label = "MODERATE STRESS"
        else:
            base_color = (34, 139, 34)  # Green - healthy
            label = "HEALTHY VEGETATION"
        
        # Draw gradient blocks to simulate a satellite map
        for i in range(10):
            for j in range(5):
                x, y = i * 60, j * 48
                variation = (i + j) % 3
                if variation == 0:
                    fill = base_color
                elif variation == 1:
                    fill = (min(255, base_color[0] + 30), min(255, base_color[1] + 30), min(255, base_color[2] + 30))
                else:
                    fill = (max(0, base_color[0] - 20), max(0, base_color[1] - 20), max(0, base_color[2] - 20))
                draw.rectangle([x, y, x + 60, y + 48], fill=fill)
        
        # Draw border
        draw.rectangle([0, 0, width - 1, height - 1], outline=(200, 200, 200), width=2)
        
        # Draw text
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
            small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
        except:
            font = ImageFont.load_default()
            small_font = font
        
        # Semi-transparent overlay for text
        overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay)
        overlay_draw.rectangle([10, height - 70, 300, height - 10], fill=(0, 0, 0, 160))
        img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
        draw = ImageDraw.Draw(img)
        
        draw.text((20, height - 60), "Sentinel-2 NDVI (Fallback)", fill=(255, 255, 255), font=font)
        draw.text((20, height - 35), f"{label} | Mean: {ndvi_mean} | Score: {ndvi_score}", fill=(255, 255, 255), font=small_font)
        
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        img.save(save_path, "PNG")
        return True
    except Exception as e:
        print(f"Fallback image generation failed: {e}")
        return False

async def get_farm_ndvi(farm_id: int, db: AsyncSession, claim_date: Optional[str] = None) -> Dict:
    """
    Fetch real Sentinel-2 NDVI for a farm. Guaranteed to return an image path.
    """
    result = await db.execute(select(Farm).where(Farm.id == farm_id))
    farm = result.scalar_one_or_none()
    
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
            
    claim_dir = "uploads/claims/satellite"
    os.makedirs(claim_dir, exist_ok=True)
    image_path = f"{claim_dir}/farm_{farm_id}_ndvi.png"
    web_path = f"/uploads/claims/satellite/farm_{farm_id}_ndvi.png"
    
    # Try real GEE first
    if ee and GEE_AVAILABLE:
        try:
            point = ee.Geometry.Point([lon, lat])
            region = point.buffer(500)
            
            collection = (
                ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filterBounds(region)
                .filterDate('2024-01-01', '2026-12-31')
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
                .sort('system:time_start', False)
            )
            
            image = collection.first()
            
            if image is not None and image.getInfo() is not None:
                ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
                
                mean_ndvi = ndvi.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=region,
                    scale=10,
                    maxPixels=1e9
                ).get('NDVI').getInfo()
                
                if mean_ndvi is not None:
                    ndvi_score = int(max(0, min(100, (0.6 - mean_ndvi) * 200)))
                    
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
                    
                    import anyio
                    def download_thumb():
                        urllib.request.urlretrieve(thumb_url, image_path)
                    await anyio.to_thread.run_sync(download_thumb)
                    
                    return {
                        "ndvi_score": ndvi_score,
                        "image_path": web_path,
                        "ndvi_mean": round(mean_ndvi, 3),
                        "status": "success"
                    }
        except Exception as e:
            print(f"GEE fetch failed: {e}, using fallback.")
            
    # FALLBACK: Generate synthetic NDVI image
    ndvi_mean = 0.28  # Moderate stress default
    ndvi_score = int(max(0, min(100, (0.6 - ndvi_mean) * 200)))  # ~64
    
    # Run image generation in thread pool
    import anyio
    def gen_fallback():
        _generate_fallback_ndvi_image(image_path, ndvi_score, ndvi_mean)
    await anyio.to_thread.run_sync(gen_fallback)
    
    return {
        "ndvi_score": ndvi_score,
        "image_path": web_path,
        "ndvi_mean": ndvi_mean,
        "status": "fallback"
    }
