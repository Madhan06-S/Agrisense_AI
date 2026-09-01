import numpy as np
import logging
from typing import Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)

def radiometric_correction(image_array: np.ndarray, metadata: Optional[Dict[str, Any]] = None) -> np.ndarray:
    """
    Converts Sentinel-2 L1C Digital Number (DN) values to Top of Atmosphere (TOA) reflectance.
    reflectance = (DN + offset) / quantization
    Preserves float32 precision and clips output to [0.0, 1.0].
    """
    arr = image_array.astype(np.float32)
    quantization = 10000.0
    offset = 0.0
    
    if metadata:
        quantization = float(metadata.get("quantization_value", 10000.0))
        offset = float(metadata.get("harmonization_offset", 0.0))
        
    reflectance = (arr + offset) / quantization
    return np.clip(reflectance, 0.0, 1.0)

def atmospheric_correction(
    image_array: np.ndarray, 
    metadata: Optional[Dict[str, Any]] = None,
    aot: Optional[float] = None,
    water_vapor: Optional[float] = None
) -> np.ndarray:
    """
    Applies a simplified Dark Object Subtraction (DOS1) atmospheric correction model.
    Estimates the path radiance/haze from the darkest 1% of pixels for each band
    and subtracts it. Standard atmospheric coefficients from metadata are optionally applied.
    """
    arr = image_array.astype(np.float32)
    
    if len(arr.shape) == 2:
        # Single band
        dark_val = np.percentile(arr, 1.0)
        corrected = arr - dark_val
    else:
        # Multi-band
        corrected = np.zeros_like(arr)
        for c in range(arr.shape[0]):
            dark_val = np.percentile(arr[c], 1.0)
            corrected[c] = arr[c] - dark_val
            
    # Apply Sentinel-2 specific per-band atmospheric coefficients if present
    if metadata and "atmospheric_coefficients" in metadata:
        coefs = metadata["atmospheric_coefficients"]
        if len(arr.shape) > 2 and len(coefs) == arr.shape[0]:
            for c in range(arr.shape[0]):
                corrected[c] = corrected[c] * float(coefs[c])
                
    return np.clip(corrected, 0.0, 1.0)

def solar_zenith_correction(image_array: np.ndarray, solar_zenith_angle: float) -> np.ndarray:
    """
    Corrects for solar illumination angle: corrected = raw / cos(solar_zenith_angle).
    If solar_zenith_angle > 85 degrees, the correction becomes unstable and is flagged.
    """
    arr = image_array.astype(np.float32)
    
    if solar_zenith_angle > 85.0:
        logger.warning(
            "Solar zenith angle %s is > 85 degrees. Illumination correction is highly unreliable.", 
            solar_zenith_angle
        )
        # We flag this in metadata but still perform a capped correction to avoid inf
        solar_zenith_angle = 85.0
        
    cos_zenith = np.cos(np.radians(solar_zenith_angle))
    cos_zenith = max(cos_zenith, 0.01) # Avoid division by zero
    
    corrected = arr / cos_zenith
    return np.clip(corrected, 0.0, 1.0)

def topographic_correction(
    image_array: np.ndarray, 
    dem: np.ndarray, 
    slope: np.ndarray, 
    aspect: np.ndarray, 
    metadata: Optional[Dict[str, Any]] = None
) -> np.ndarray:
    """
    Implements C-correction for terrain illumination using DEM, slope, and aspect.
    Formula: Rc = Ro * (cos(zenith) + c) / (cos_i + c)
    where cos_i = cos(slope) * cos(zenith) + sin(slope) * sin(zenith) * cos(azimuth - aspect)
    """
    arr = image_array.astype(np.float32)
    
    # Defaults
    zenith = 30.0
    azimuth = 135.0
    if metadata:
        zenith = float(metadata.get("solar_zenith_angle", 30.0))
        azimuth = float(metadata.get("solar_azimuth_angle", 135.0))
        
    zenith_rad = np.radians(zenith)
    azimuth_rad = np.radians(azimuth)
    
    slope_rad = np.radians(slope)
    aspect_rad = np.radians(aspect)
    
    # Local illumination angle (cos_i)
    cos_i = (np.cos(slope_rad) * np.cos(zenith_rad) + 
             np.sin(slope_rad) * np.sin(zenith_rad) * np.cos(azimuth_rad - aspect_rad))
    cos_zenith = np.cos(zenith_rad)
    
    corrected = np.zeros_like(arr)
    if len(arr.shape) == 2:
        corrected = _apply_c_correction(arr, cos_i, cos_zenith)
    else:
        for c in range(arr.shape[0]):
            corrected[c] = _apply_c_correction(arr[c], cos_i, cos_zenith)
            
    return np.clip(corrected, 0.0, 1.0)

def _apply_c_correction(band: np.ndarray, cos_i: np.ndarray, cos_zenith: float) -> np.ndarray:
    # Linear regression: band = m * cos_i + b for non-flat terrain
    mask = (cos_i > 0.0) & (band > 0.0)
    x = cos_i[mask]
    y = band[mask]
    
    if len(x) < 10:
        # Fallback to cosine correction if regression is underdetermined
        return band * (cos_zenith / np.clip(cos_i, 0.01, 1.0))
        
    m, b = np.polyfit(x, y, 1)
    if abs(m) < 1e-6:
        c = 0.0
    else:
        c = b / m
        
    denominator = cos_i + c
    denominator = np.where(denominator <= 0.0, 0.01, denominator)
    
    corrected_band = band * ((cos_zenith + c) / denominator)
    return corrected_band

def generate_correction_report(before_array: np.ndarray, after_array: np.ndarray) -> Dict[str, Any]:
    """
    Computes summary statistics before and after corrections for reporting.
    """
    stats = {}
    if len(before_array.shape) == 2:
        before_bands = [before_array]
        after_bands = [after_array]
    else:
        before_bands = [before_array[c] for c in range(before_array.shape[0])]
        after_bands = [after_array[c] for c in range(after_array.shape[0])]
        
    for c in range(len(before_bands)):
        band_key = f"band_{c}"
        b = before_bands[c]
        a = after_bands[c]
        stats[band_key] = {
            "before": {
                "mean": float(np.mean(b)),
                "std": float(np.std(b)),
                "min": float(np.min(b)),
                "max": float(np.max(b))
            },
            "after": {
                "mean": float(np.mean(a)),
                "std": float(np.std(a)),
                "min": float(np.min(a)),
                "max": float(np.max(a))
            }
        }
    return stats
