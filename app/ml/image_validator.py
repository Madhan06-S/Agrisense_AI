import io
import numpy as np
from PIL import Image
from PIL.ExifTags import TAGS
from typing import Dict, Tuple, Optional

class ImageValidationError(Exception):
    pass

def validate_farmer_photo(file_bytes: bytes, expected_location: Optional[Tuple[float, float]] = None) -> Dict:
    """
    Validates a farmer-uploaded photo:
    1. Not black/blank/corrupted
    2. Contains geotag (GPS coordinates)
    3. Looks like vegetation/farm (green pixel ratio)
    4. Reasonable resolution
    """
    try:
        img = Image.open(io.BytesIO(file_bytes))
    except Exception:
        raise ImageValidationError("Invalid image file. Please upload a valid JPG/PNG.")
    
    # 1. Basic checks
    w, h = img.size
    if w < 400 or h < 400:
        raise ImageValidationError("Image resolution too low. Minimum 400x400 pixels required.")
    if w > 8000 or h > 8000:
        raise ImageValidationError("Image too large. Maximum 8000x8000 pixels allowed.")
    
    # 2. Check not black/blank
    img_array = np.array(img)
    if len(img_array.shape) == 2:  # Grayscale
        img_array = np.stack([img_array]*3, axis=-1)
    
    # Calculate brightness
    brightness = np.mean(img_array)
    if brightness < 15:
        raise ImageValidationError("Image appears to be completely dark. Please upload a clear daylight photo.")
    if brightness > 250:
        raise ImageValidationError("Image appears to be overexposed/blank. Please upload a valid farm photo.")
    
    # 3. Check variance (not a solid color)
    variance = np.var(img_array)
    if variance < 50:
        raise ImageValidationError("Image lacks detail. Please upload a clear farm photo, not a blank screen.")
    
    # 4. Green pixel ratio (vegetation detection)
    green_ratio = 0.0
    if img_array.shape[-1] >= 3:
        r, g, b = img_array[:,:,0], img_array[:,:,1], img_array[:,:,2]
        # Green dominance: G > R and G > B
        # Let's adjust thresholds slightly to be more forgiving on dry/yellow crops but block selfies/non-vegetation
        green_mask = (g > r + 10) & (g > b + 10) & (g > 50)
        green_ratio = np.mean(green_mask)
        
        # Check if the photo has vegetation (at least 2.5% green pixels for crops)
        if green_ratio < 0.025:
            raise ImageValidationError(
                "Photo does not appear to contain vegetation. "
                "Please upload a photo of your actual crop field."
            )
    
    # 5. EXIF Geotag validation
    exif = img._getexif()
    gps_info = None
    
    if exif:
        for tag_id, value in exif.items():
            tag = TAGS.get(tag_id, tag_id)
            if tag == "GPSInfo":
                gps_info = value
                break
    
    if not gps_info:
        raise ImageValidationError(
            "Photo missing GPS geotag. "
            "Please enable location services on your phone camera and retake the photo at your farm."
        )
    
    # Parse GPS coordinates
    def parse_dms(dms):
        # Handle tuple of fractions
        def to_float(val):
            if isinstance(val, tuple) or isinstance(val, list):
                return float(val[0]) / float(val[1]) if val[1] != 0 else float(val[0])
            return float(val)
        
        degrees = to_float(dms[0])
        minutes = to_float(dms[1])
        seconds = to_float(dms[2])
        return degrees + minutes/60 + seconds/3600
    
    lat_ref = gps_info.get(1)
    lat_dms = gps_info.get(2)
    lon_ref = gps_info.get(3)
    lon_dms = gps_info.get(4)
    
    if not all([lat_ref, lat_dms, lon_ref, lon_dms]):
        raise ImageValidationError("GPS data incomplete. Please retake photo with location enabled.")
    
    latitude = parse_dms(lat_dms)
    if lat_ref == 'S': latitude = -latitude
    longitude = parse_dms(lon_dms)
    if lon_ref == 'W': longitude = -longitude
    
    # Validate coordinates are in India (rough bounds)
    if not (6.5 <= latitude <= 37.5 and 68.0 <= longitude <= 97.5):
        raise ImageValidationError(
            f"GPS coordinates ({latitude:.4f}, {longitude:.4f}) appear to be outside India. "
            "Please take the photo at your registered farm location."
        )
    
    # Optional: Check distance from expected farm location
    if expected_location:
        from math import radians, sin, cos, sqrt, atan2
        lat1, lon1 = radians(expected_location[0]), radians(expected_location[1])
        lat2, lon2 = radians(latitude), radians(longitude)
        dlat, dlon = lat2 - lat1, lon2 - lon1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        distance_km = 6371 * c  # Earth radius in km
        
        if distance_km > 10.0:  # Allow 10km radius buffer for precision/network discrepancy
            raise ImageValidationError(
                f"Photo taken {distance_km:.1f} km from registered farm. "
                "Please take photos at your actual farm location."
            )
    
    return {
        "valid": True,
        "width": w,
        "height": h,
        "green_ratio": round(float(green_ratio), 3),
        "latitude": round(latitude, 6),
        "longitude": round(longitude, 6),
        "brightness": round(float(brightness), 1)
    }
