import numpy as np
import logging
from typing import Dict, Any, Tuple, Optional
from scipy.ndimage import binary_dilation, uniform_filter

logger = logging.getLogger(__name__)

def cloud_mask_sentinel2(
    image_array: np.ndarray, 
    scl_band: Optional[np.ndarray] = None, 
    fmask_band: Optional[np.ndarray] = None
) -> Tuple[np.ndarray, float, str]:
    """
    Builds a binary cloud mask for Sentinel-2 (1 = clear, 0 = cloud/shadow).
    Uses the Scene Classification Layer (SCL) if available:
      - Class 3: Cloud shadows -> mask
      - Class 8: Medium cloud probability -> mask
      - Class 9: High cloud probability -> mask
      - Class 10: Thin cirrus -> mask
    Falls back to a simplified FMask approximation (Blue band > 0.2 and NDVI < 0.2) if SCL is absent.
    Returns: (binary_mask, cloud_cover_percentage, mask_quality)
    """
    # Assuming image_array shape is (C, H, W). Bands: 0=Blue, 1=Green, 2=Red, 3=NIR, 4=SWIR
    c, h, w = image_array.shape
    total_pixels = h * w
    
    if scl_band is not None:
        # SCL class masks: 3 (shadows), 8 (med cloud), 9 (high cloud), 10 (cirrus)
        cloud_pixels = np.isin(scl_band, [3, 8, 9, 10])
        clear_mask = (~cloud_pixels).astype(np.uint8)
        quality = "high"
    elif fmask_band is not None:
        cloud_pixels = (fmask_band == 0).astype(bool) # Assuming fmask 0 = cloud
        clear_mask = (~cloud_pixels).astype(np.uint8)
        quality = "medium"
    else:
        # Simplified FMask fallback using Blue (band 0) and NIR (band 3)
        # Clouds are bright in blue; vegetation is bright in NIR.
        # NDVI = (NIR - Red) / (NIR + Red)
        blue = image_array[0]
        red = image_array[2]
        nir = image_array[3]
        
        ndvi = (nir - red) / np.clip(nir + red, 1e-5, None)
        cloud_pixels = (blue > 0.22) & (ndvi < 0.15)
        clear_mask = (~cloud_pixels).astype(np.uint8)
        quality = "low"
        
    cloud_cover_pct = (np.sum(clear_mask == 0) / total_pixels) * 100.0
    return clear_mask, cloud_cover_pct, quality

def cloud_shadow_masking(
    image_array: np.ndarray, 
    cloud_mask: np.ndarray
) -> np.ndarray:
    """
    Detects cloud shadows using NIR/SWIR ratio (shadows are dark in NIR/SWIR).
    Dilates the shadow mask by a 3-pixel safety margin and intersects it with the cloud mask.
    """
    # Bands: 3 = NIR, 4 = SWIR
    nir = image_array[3]
    swir = image_array[4]
    
    # Shadow has low reflectance and low ratio
    ratio = nir / np.clip(swir, 1e-5, None)
    shadow_pixels = (nir < 0.15) & (ratio < 0.8)
    
    # Dilate by 3 pixels
    structure = np.ones((7, 7), dtype=bool) # 7x7 kernel gives roughly 3 pixels dilation in each direction
    dilated_shadows = binary_dilation(shadow_pixels, structure=structure)
    
    # Combine (0 = cloud or shadow, 1 = clear)
    combined_mask = cloud_mask.copy()
    combined_mask[dilated_shadows] = 0
    return combined_mask

def preprocess_sentinel1(
    vv_band: np.ndarray, 
    vh_band: np.ndarray, 
    metadata: Optional[Dict[str, Any]] = None
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, float]:
    """
    Preprocesses Sentinel-1 SAR bands:
      1. Applies 7x7 Lee speckle filter
      2. Converts DN to backscatter (sigma0) in dB
      3. Radiometric terrain correction approximation
      4. Generates standard RGB composite: R=VV, G=VH, B=VV/VH
    Returns: (filtered_vv_db, filtered_vh_db, rgb_composite, noise_level)
    """
    # 1. Speckle Filtering (Lee Filter)
    vv_filtered = _lee_filter(vv_band.astype(np.float32), size=7)
    vh_filtered = _lee_filter(vh_band.astype(np.float32), size=7)
    
    # Estimate noise floor
    noise_level = float(np.var(vv_band - vv_filtered))
    
    # 2. Convert to backscatter (dB)
    # sigma0_db = 10 * log10(DN)
    vv_db = 10.0 * np.log10(np.clip(vv_filtered, 1e-5, None))
    vh_db = 10.0 * np.log10(np.clip(vh_filtered, 1e-5, None))
    
    # 3. Terrain correction approximation (cosine correction based on slope if present in metadata)
    if metadata and "slope" in metadata:
        slope = metadata["slope"]
        # Normalize local incidence angle
        cos_slope = np.cos(np.radians(slope))
        vv_db = vv_db + 10.0 * np.log10(np.clip(cos_slope, 0.1, 1.0))
        vh_db = vh_db + 10.0 * np.log10(np.clip(cos_slope, 0.1, 1.0))
        
    # Normalize dB to [0, 1] for visual composite
    # Sentinel-1 VV range is typically [-25, 0] dB, VH is [-35, -5] dB
    vv_norm = np.clip((vv_db + 25.0) / 25.0, 0.0, 1.0)
    vh_norm = np.clip((vh_db + 35.0) / 30.0, 0.0, 1.0)
    ratio_norm = np.clip(vv_norm / np.clip(vh_norm, 1e-5, None), 0.0, 1.0)
    
    rgb = np.stack([vv_norm, vh_norm, ratio_norm], axis=0)
    return vv_db, vh_db, rgb, noise_level

def _lee_filter(img: np.ndarray, size: int = 7) -> np.ndarray:
    """
    Lee filter for speckle noise reduction.
    """
    img_mean = uniform_filter(img, size=size)
    img_sqr_mean = uniform_filter(img**2, size=size)
    img_variance = img_sqr_mean - img_mean**2
    
    overall_variance = np.var(img)
    # Filter weighting factor w
    w = img_variance / (img_variance + overall_variance + 1e-5)
    filtered = img_mean + w * (img - img_mean)
    return np.clip(filtered, 0.0, None)
