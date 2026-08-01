import pytest
import numpy as np
from app.features.fusion import (
    fuse_features,
    fuse_dataset,
    impute_missing,
    normalize_zscore,
    calculate_mutual_information,
    rank_features,
    FEATURE_NAMES
)

def test_fuse_features():
    opt = {name: 0.5 for name in ["ndvi", "ndwi", "evi", "savi", "gndvi", "ndre", "msi", "ndbi", "nbr", "gci"]}
    sar = {"vv": 1.0, "vh": 2.0}
    weather = {"temp": 25.0, "precip": 1.0, "humidity": 50.0, "wind_speed": 5.0, "solar_rad": 100.0}
    soil = {"soil_moisture": 30.0, "soil_ph": 7.0, "soil_n": 10.0, "soil_p": 5.0}
    
    vec = fuse_features(opt, sar, weather, soil)
    assert len(vec) == 22
    assert vec[0] == 0.5
    assert vec[10] == 1.0
    assert vec[11] == 2.0
    assert vec[12] == 0.5
    assert vec[13] == 25.0
    assert vec[18] == 30.0

def test_impute_missing():
    matrix = np.array([
        [1.0, np.nan],
        [2.0, 4.0],
        [np.nan, 5.0]
    ], dtype=np.float32)
    
    imputed = impute_missing(matrix)
    assert imputed[2, 0] == 1.5
    assert imputed[0, 1] == 4.5

def test_normalize_zscore():
    matrix = np.array([
        [1.0, 10.0],
        [2.0, 10.0],
        [3.0, 10.0]
    ], dtype=np.float32)
    
    normalized = normalize_zscore(matrix)
    assert pytest.approx(normalized[0, 0], abs=1e-2) == -1.2247
    assert pytest.approx(normalized[1, 0]) == 0.0
    assert pytest.approx(normalized[2, 0], abs=1e-2) == 1.2247
    
    assert normalized[0, 1] == 0.0
    assert normalized[1, 1] == 0.0

def test_mutual_information():
    np.random.seed(42)
    x = np.linspace(0, 10, 100)
    y = x * 2.0 + np.random.normal(0, 0.1, 100)
    
    mi_high = calculate_mutual_information(x, y)
    
    z = np.random.normal(0, 1, 100)
    mi_low = calculate_mutual_information(x, z)
    
    assert mi_high > mi_low
    assert mi_high > 0.5
    assert mi_low < 1.0

def test_rank_features():
    np.random.seed(42)
    matrix = np.random.normal(0, 1, (100, 22)) # Increase sample size to 100
    target = matrix[:, 4] * 3.0 + np.random.normal(0, 0.1, 100)
    
    rankings = rank_features(matrix, target)
    assert len(rankings) == 22
    assert rankings[0]["name"] == "gndvi"
