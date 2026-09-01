import io
import os
import random
import math
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

def hsv_to_rgb(h, s, v):
    """Convert HSV to RGB (0-255 range)"""
    h = h % 360
    c = v * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = v - c
    if h < 60:   r, g, b = c, x, 0
    elif h < 120: r, g, b = x, c, 0
    elif h < 180: r, g, b = 0, c, x
    elif h < 240: r, g, b = 0, x, c
    elif h < 300: r, g, b = x, 0, c
    else:         r, g, b = c, 0, x
    return (int((r + m) * 255), int((g + m) * 255), int((b + m) * 255))

def generate_ndvi_image_bytes(ndvi_score: int, ndvi_mean: float, farm_name: str = "Farm") -> bytes:
    """
    Generate a realistic synthetic satellite NDVI image.
    Includes field patterns, roads, water bodies — looks like real Sentinel-2.
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
        width, height = 800, 320
        
        # Base color based on NDVI health
        if ndvi_mean < 0.2:
            base_h, base_s, base_v = 30, 0.6, 0.35   # Brown
            label = "SEVERE DAMAGE DETECTED"
        elif ndvi_mean < 0.35:
            base_h, base_s, base_v = 45, 0.7, 0.55   # Yellow-Orange
            label = "MODERATE STRESS"
        else:
            base_h, base_s, base_v = 120, 0.5, 0.4   # Green
            label = "HEALTHY VEGETATION"
        
        img = Image.new('RGB', (width, height), color=(25, 25, 30))
        draw = ImageDraw.Draw(img)
        
        # Generate field parcels (like real farm boundaries)
        random.seed(42)  # Consistent for same farm
        parcels = []
        for _ in range(15):
            x = random.randint(0, width - 100)
            y = random.randint(0, height - 60)
            w = random.randint(60, 180)
            h = random.randint(40, 100)
            parcels.append((x, y, x + w, y + h))
        
        # Draw parcels with NDVI-colored fills
        for i, (x1, y1, x2, y2) in enumerate(parcels):
            # Vary color slightly per parcel
            hue_offset = random.randint(-15, 15)
            sat_var = random.uniform(0.8, 1.2)
            val_var = random.uniform(0.85, 1.15)
            
            h = max(0, min(360, base_h + hue_offset))
            s = max(0, min(1, base_s * sat_var))
            v = max(0, min(1, base_v * val_var))
            r, g, b = hsv_to_rgb(h, s, v)
            
            # Draw field with slight texture
            for dy in range(y1, y2, 3):
                noise = random.randint(-8, 8)
                draw.line([(x1, dy), (x2, dy)], fill=(max(0, r+noise), max(0, g+noise), max(0, b+noise)), width=2)
            
            # Field border
            draw.rectangle([x1, y1, x2, y2], outline=(60, 60, 50), width=1)
        
        # Draw roads (gray lines)
        for _ in range(4):
            rx = random.randint(0, width)
            draw.line([(rx, 0), (rx + random.randint(-30, 30), height)], fill=(90, 90, 85), width=3)
        for _ in range(3):
            ry = random.randint(0, height)
            draw.line([(0, ry), (width, ry + random.randint(-20, 20))], fill=(90, 90, 85), width=3)
        
        # Draw water body (blue patch)
        wx, wy = random.randint(100, width-200), random.randint(20, height-80)
        for r in range(25):
            draw.ellipse([wx-r, wy-r, wx+r, wy+r], fill=(40, 60, 90, 128))
        
        # Add subtle noise for realism
        pixels = img.load()
        for x in range(0, width, 2):
            for y in range(0, height, 2):
                r, g, b = pixels[x, y]
                noise = random.randint(-5, 5)
                pixels[x, y] = (max(0, min(255, r+noise)), max(0, min(255, g+noise)), max(0, min(255, b+noise)))
        
        # Bottom info bar
        draw.rectangle([0, height - 70, width, height], fill=(15, 15, 20))
        
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
            small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
        except:
            try:
                font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 20)
                small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
            except:
                font = ImageFont.load_default()
                small = font
        
        draw.text((25, height - 62), f"SENTINEL-2 NDVI | {farm_name}", fill=(240, 240, 240), font=font)
        draw.text((25, height - 34), f"{label}  |  NDVI Mean: {ndvi_mean}  |  Score: {ndvi_score}/100", fill=(180, 180, 180), font=small)
        
        # SIMULATED badge
        draw.rounded_rectangle([12, 12, 130, 42], radius=4, fill=(200, 160, 30))
        draw.text((20, 16), "SIMULATED", fill=(255, 255, 255), font=small)
        
        # Scale bar
        draw.rectangle([width - 150, height - 55, width - 50, height - 50], fill=(255, 255, 255))
        draw.text((width - 150, height - 45), "500 m", fill=(200, 200, 200), font=small)
        
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return buf.getvalue()
        
    except Exception as e:
        print(f"Image generation failed: {e}")
        # Return 1x1 transparent pixel as ultimate fallback
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
