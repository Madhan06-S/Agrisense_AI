import io
import os
import random
from typing import Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.farm import Farm

# Try GEE
GEE_AVAILABLE = False
try:
    import ee
    ee.Initialize()
    GEE_AVAILABLE = True
except Exception as e:
    print(f"GEE not available: {e}")

def generate_ndvi_image_bytes(ndvi_score: int, ndvi_mean: float, farm_name: str = "Farm") -> bytes:
    """
    Generate a synthetic NDVI heatmap image in memory.
    Guaranteed to work on any system — no external font files needed.
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
        
        width, height = 800, 320
        
        # Determine color based on NDVI mean
        if ndvi_mean < 0.2:
            base = (139, 69, 19)      # Brown - severe damage
            label = "SEVERE DAMAGE DETECTED"
        elif ndvi_mean < 0.35:
            base = (218, 165, 32)     # Yellow - moderate stress
            label = "MODERATE STRESS"
        else:
            base = (34, 139, 34)      # Green - healthy
            label = "HEALTHY VEGETATION"
        
        img = Image.new('RGB', (width, height), color=(30, 30, 30))
        draw = ImageDraw.Draw(img)
        
        # Generate pixelated heatmap blocks
        block_w, block_h = 40, 40
        for row in range(height // block_h):
            for col in range(width // block_w):
                x, y = col * block_w, row * block_h
                
                # Add randomness to simulate real satellite variation
                r = max(0, min(255, base[0] + random.randint(-40, 40)))
                g = max(0, min(255, base[1] + random.randint(-40, 40)))
                b = max(0, min(255, base[2] + random.randint(-40, 40)))
                
                # Some blocks darker (shadows/water), some lighter
                if random.random() < 0.15:
                    r, g, b = max(0, r-60), max(0, g-60), max(0, b-60)
                
                draw.rectangle([x, y, x + block_w - 1, y + block_h - 1], fill=(r, g, b))
        
        # Overlay info bar at bottom
        draw.rectangle([0, height - 85, width, height], fill=(20, 20, 20))
        
        # Try to load font, fallback to default
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
            small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        except:
            try:
                font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 22)
                small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
            except:
                font = ImageFont.load_default()
                small = font
        
        draw.text((30, height - 75), f"SENTINEL-2 NDVI | {farm_name}", fill=(255, 255, 255), font=font)
        draw.text((30, height - 42), f"{label} | NDVI Mean: {ndvi_mean} | Score: {ndvi_score}/100", fill=(200, 200, 200), font=small)
        
        # "SIMULATED" badge in top-left
        badge_w, badge_h = 140, 32
        draw.rectangle([10, 10, 10 + badge_w, 10 + badge_h], fill=(180, 140, 20))
        draw.text((18, 14), "SIMULATED", fill=(255, 255, 255), font=small)
        
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return buf.getvalue()
        
    except Exception as e:
        print(f"PIL image generation failed: {e}")
        # Ultimate fallback: return a 1x1 transparent PNG
        buf = io.BytesIO()
        Image.new('RGBA', (1, 1), (0, 0, 0, 0)).save(buf, format="PNG")
        buf.seek(0)
        return buf.getvalue()

async def get_farm_ndvi_data(farm_id: int, db: AsyncSession) -> Dict:
    """
    Returns NDVI data. If GEE works, use it. Otherwise compute realistic fallback.
    """
    result = await db.execute(select(Farm).where(Farm.id == farm_id))
    farm = result.scalar_one_or_none()
    lat = getattr(farm, 'latitude', None) or 18.5204
    lon = getattr(farm, 'longitude', None) or 73.8567
    farm_name = getattr(farm, 'name', 'Farm')
    
    # Try real GEE
    if GEE_AVAILABLE:
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
                    reducer=ee.Reducer.mean(), geometry=region, scale=10, maxPixels=1e9
                ).get('NDVI').getInfo()
                if mean_ndvi is not None:
                    ndvi_score = int(max(0, min(100, (0.6 - mean_ndvi) * 200)))
                    return {
                        "ndvi_score": ndvi_score,
                        "ndvi_mean": round(mean_ndvi, 3),
                        "status": "success",
                        "farm_name": farm_name
                    }
        except Exception as e:
            print(f"GEE error: {e}")
    
    # Fallback: realistic values based on typical Indian farm NDVI
    ndvi_mean = 0.28
    ndvi_score = int(max(0, min(100, (0.6 - ndvi_mean) * 200)))
    
    return {
        "ndvi_score": ndvi_score,
        "ndvi_mean": ndvi_mean,
        "status": "fallback",
        "farm_name": farm_name
    }
