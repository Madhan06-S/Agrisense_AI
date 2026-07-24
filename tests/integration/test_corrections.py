import pytest
import numpy as np
from app.preprocessing.corrections import (
    radiometric_correction,
    atmospheric_correction,
    solar_zenith_correction,
    topographic_correction,
    generate_correction_report
)

def test_radiometric_correction_scaling():
    # DN input
    dn_input = np.array([[1000, 2000], [5000, 10000]], dtype=np.uint16)
    
    # Sentinel-2 scaling: 10000.0 quantization
    ref = radiometric_correction(dn_input)
    
    # Assert type is float32
    assert ref.dtype == np.float32
    # Verify exact division
    assert ref[0, 0] == 0.1
    assert ref[1, 1] == 1.0
    # Bounds check [0, 1]
    assert np.all(ref >= 0.0) & np.all(ref <= 1.0)

def test_atmospheric_correction_dos():
    # Synthetic array with haze
    np.random.seed(42)
    haze_band = np.random.rand(100, 100).astype(np.float32) + 0.15
    
    # Dark object subtraction
    corrected = atmospheric_correction(haze_band)
    
    # The darkest 1% of pixels should be subtracted, making minimum value close to 0
    assert np.min(corrected) == 0.0
    assert np.mean(corrected) < np.mean(haze_band)

def test_solar_zenith_correction_angles():
    raw_ref = np.array([[0.2, 0.4], [0.5, 0.6]], dtype=np.float32)
    
    # 45 degree angle
    corrected = solar_zenith_correction(raw_ref, 45.0)
    cos_45 = np.cos(np.radians(45.0))
    
    assert np.allclose(corrected, np.clip(raw_ref / cos_45, 0.0, 1.0))
    
    # Zenith > 85 degrees warning case
    # Should not crash, should be clipped
    corrected_extreme = solar_zenith_correction(raw_ref, 89.0)
    assert np.max(corrected_extreme) <= 1.0

def test_topographic_c_correction():
    # Flat terrain - should fallback to cosine correction
    band = np.ones((10, 10), dtype=np.float32) * 0.5
    dem = np.ones((10, 10), dtype=np.float32) * 200.0
    slope = np.zeros((10, 10), dtype=np.float32)
    aspect = np.zeros((10, 10), dtype=np.float32)
    
    corrected = topographic_correction(band, dem, slope, aspect)
    # On flat slope, cos_i = cos_zenith. Output should equal input.
    assert np.allclose(corrected, band)
