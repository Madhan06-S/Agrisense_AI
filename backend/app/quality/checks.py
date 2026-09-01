import logging
from typing import Dict, Any, List, Tuple
from shapely.geometry import shape, box

logger = logging.getLogger(__name__)

def check_geometric_integrity(crs: str, resolution: float, expected_crs: str = "EPSG:4326") -> Tuple[bool, str]:
    """Checks coordinate reference system and pixel resolution validity."""
    if crs.upper() != expected_crs.upper():
        return False, f"CRS mismatch: expected {expected_crs}, found {crs}"
    if resolution <= 0:
        return False, "Resolution must be a positive number."
    return True, ""

def check_radiometric_ranges(bands_stats: List[Dict[str, Any]]) -> Tuple[bool, str]:
    """
    Checks if pixel values fall within the valid physical range (0-1 for reflectance, 
    or 0-10000 for standard scaled Sentinel-2 data) and checks for NaN bands.
    """
    if not bands_stats:
        return True, ""
        
    for stat in bands_stats:
        band_name = stat.get("name", "unknown")
        min_val = stat.get("min", 0)
        max_val = stat.get("max", 0)
        has_nan = stat.get("has_nan", False)
        
        if has_nan:
            return False, f"NaN values detected in band {band_name}."
            
        # Check standard reflectance range (0 - 10000)
        if min_val < 0 or max_val > 10000:
            # Also allow float reflectance [0.0 - 1.0]
            if min_val < 0.0 or max_val > 1.0:
                return False, f"Reflectance values out of bounds for band {band_name}: [{min_val}, {max_val}]"
                
    return True, ""

def check_cloud_properties(cloud_cover: float, threshold: float = 20.0) -> Tuple[bool, str]:
    """Checks if the cloud cover is within acceptable bounds."""
    if cloud_cover > threshold:
        return False, f"Cloud cover ({cloud_cover:.1f}%) exceeds threshold of {threshold}%."
    return True, ""

def check_farm_coverage(farm_geojson: dict, image_bbox: List[float]) -> Tuple[bool, str]:
    """
    Checks if the farm boundary is fully contained in the satellite image bounding box.
    image_bbox: [min_lon, min_lat, max_lon, max_lat]
    """
    try:
        if len(image_bbox) != 4:
            return False, "Invalid bounding box format (must be [min_lon, min_lat, max_lon, max_lat])."
            
        farm_geom = shape(farm_geojson)
        image_geom = box(*image_bbox)
        
        if not image_geom.contains(farm_geom):
            return False, "Farm boundary is not fully contained in the satellite image boundary."
        return True, ""
    except Exception as e:
        return False, f"Coverage containment check failed: {e}"

def check_temporal_duplicates(acquisition_dates: List[str]) -> Tuple[bool, str]:
    """Checks if there are duplicate acquisitions on the same day."""
    seen = set()
    for d in acquisition_dates:
        if d in seen:
            return False, f"Duplicate acquisition date detected: {d}"
        seen.add(d)
    return True, ""
