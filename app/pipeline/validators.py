import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, Tuple
from shapely.geometry import shape
import math

logger = logging.getLogger(__name__)

def calculate_geojson_area_hectares(geojson: dict) -> float:
    try:
        sh_geom = shape(geojson)
        if sh_geom.geom_type != "Polygon":
            raise ValueError("Only Polygon geometries are supported.")
        coords = list(sh_geom.exterior.coords)
        if not coords:
            return 0.0
        mean_lat = sum(c[1] for c in coords) / len(coords)
        mean_lat_rad = math.radians(mean_lat)
        deg_area = sh_geom.area
        meters_sq_per_deg_sq = 111132.0 * 111132.0 * math.cos(mean_lat_rad)
        area_meters = deg_area * meters_sq_per_deg_sq
        return round(area_meters / 10000.0, 4)
    except Exception as e:
        logger.error(f"Error calculating area: {e}")
        return 0.0

def validate_geojson(geojson: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Validates GeoJSON polygons:
    - Must be a Polygon geometry type
    - Must be closed (first and last coordinate match)
    - Must be valid (non-self-intersecting)
    - Area must be > 0.1 hectares
    """
    try:
        if not isinstance(geojson, dict):
            return False, "GeoJSON must be a dictionary."
        
        # Resolve Feature/FeatureCollection
        if geojson.get("type") == "FeatureCollection":
            features = geojson.get("features", [])
            if not features:
                return False, "GeoJSON FeatureCollection contains no features."
            geom_data = features[0].get("geometry")
        elif geojson.get("type") == "Feature":
            geom_data = geojson.get("geometry")
        else:
            geom_data = geojson

        if not geom_data or geom_data.get("type") != "Polygon":
            return False, "Geometry must be of type Polygon."

        coords = geom_data.get("coordinates")
        if not coords or not isinstance(coords, (list, tuple)) or len(coords) == 0:
            return False, "Polygon must have coordinate rings."

        # Check if closed
        for ring in coords:
            if not isinstance(ring, (list, tuple)) or len(ring) < 4:
                return False, "Linear ring must have at least 4 coordinates."
            if list(ring[0]) != list(ring[-1]):
                return False, "Polygon linear ring is not closed (start and end coordinates must match)."

        # Parse with shapely
        sh_geom = shape(geom_data)
        if not sh_geom.is_valid:
            return False, "Polygon is self-intersecting or invalid."

        # Check area
        area_ha = calculate_geojson_area_hectares(geom_data)
        if area_ha <= 0.1:
            return False, f"Farm area ({area_ha:.4f} ha) is too small. Minimum required area is 0.1 ha."

        return True, ""
    except Exception as e:
        return False, f"Failed to parse or validate GeoJSON: {str(e)}"

def validate_date_range(start_date_str: str, end_date_str: str) -> Tuple[bool, str]:
    """
    Validates date ranges:
    - Cannot be in the future
    - Cannot be older than 5 years back
    - start_date must be <= end_date
    """
    try:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    except ValueError as e:
        return False, f"Invalid date format (must be YYYY-MM-DD): {str(e)}"

    today = date.today()
    five_years_ago = today - timedelta(days=5 * 365)

    if start_date > today or end_date > today:
        return False, "Requested date range cannot be in the future."

    if start_date < five_years_ago:
        return False, "Requested start date cannot be older than 5 years."

    if start_date > end_date:
        return False, f"Start date ({start_date_str}) must be before or equal to end date ({end_date_str})."

    return True, ""

def validate_satellite_availability(satellite: str, start_date_str: str, end_date_str: str) -> Tuple[bool, str]:
    """
    Validates satellite availability for requested dates:
    - Sentinel-2: available from 2015-06-23
    - Sentinel-1: available from 2014-04-03
    - LISS-4: available from 2011-10-12
    """
    try:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    except ValueError:
        return False, "Invalid date format."

    availabilities = {
        "sentinel-2": (date(2015, 6, 23), "Sentinel-2 is available starting from June 23, 2015."),
        "sentinel-1": (date(2014, 4, 3), "Sentinel-1 is available starting from April 3, 2014."),
        "liss-4": (date(2011, 10, 12), "LISS-4 is available starting from October 12, 2011.")
    }

    sat_key = satellite.lower()
    if sat_key not in availabilities:
        return False, f"Unknown satellite: {satellite}. Supported satellites: sentinel-2, sentinel-1, liss-4."

    launch_date, message = availabilities[sat_key]
    if end_date < launch_date:
        return False, f"No data available for {satellite} in the requested period. {message}"

    return True, ""
