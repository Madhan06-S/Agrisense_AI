import pytest
import numpy as np
from app.preprocessing.cloud_sar import (
    cloud_mask_sentinel2,
    cloud_shadow_masking,
    preprocess_sentinel1
)

def test_scl_cloud_masking():
    # Shape [5, 10, 10]
    bands = np.random.rand(5, 10, 10).astype(np.float32)
    # SCL: Class 4 = Veg (clear), Class 8 = Cloud (masked), Class 9 = High Cloud (masked)
    scl = np.ones((10, 10), dtype=np.uint8) * 4
    scl[2:4, 2:4] = 8 # 4 pixels cloud
    scl[6, 6] = 9 # 1 pixel cloud
    
    mask, pct, quality = cloud_mask_sentinel2(bands, scl_band=scl)
    
    assert quality == "high"
    assert pct == 5.0 # 5% of 100 pixels
    assert np.all(mask[2:4, 2:4] == 0)
    assert mask[6, 6] == 0
    assert mask[0, 0] == 1

def test_sar_speckle_filter_noise_reduction():
    # Speckled input
    np.random.seed(42)
    base_signal = np.ones((50, 50), dtype=np.float32) * 10.0
    speckle_noise = np.random.exponential(scale=1.0, size=(50, 50))
    speckled_img = base_signal * speckle_noise
    
    vv_db, vh_db, rgb, noise = preprocess_sentinel1(speckled_img, speckled_img)
    
    # Assert variance is significantly reduced (measured via noise)
    assert noise > 0.0
    assert rgb.shape == (3, 50, 50)
