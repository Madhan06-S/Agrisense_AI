import pytest
import numpy as np
from app.features.indices import (
    compute_ndvi,
    compute_ndwi,
    compute_evi,
    compute_savi,
    compute_gndvi,
    compute_ndre,
    compute_msi,
    compute_ndbi,
    compute_nbr,
    compute_gci,
    compute_all_indices
)

def test_ndvi():
    # NIR=0.6, Red=0.2 -> (0.6 - 0.2) / (0.6 + 0.2) = 0.4 / 0.8 = 0.5
    assert pytest.approx(compute_ndvi(0.6, 0.2)) == 0.5
    # Division by zero
    assert compute_ndvi(0.0, 0.0) == 0.0
    # Array input
    nir = np.array([0.6, 0.0])
    red = np.array([0.2, 0.0])
    res = compute_ndvi(nir, red)
    assert pytest.approx(res[0]) == 0.5
    assert res[1] == 0.0

def test_ndwi():
    # Green=0.3, NIR=0.5 -> (0.3 - 0.5) / (0.3 + 0.5) = -0.2 / 0.8 = -0.25
    assert pytest.approx(compute_ndwi(0.3, 0.5)) == -0.25
    assert compute_ndwi(0.0, 0.0) == 0.0

def test_evi():
    # NIR=0.6, Red=0.2, Blue=0.1
    # Denom = 0.6 + 6*0.2 - 7.5*0.1 + 1 = 0.6 + 1.2 - 0.75 + 1 = 2.05
    # Numerator = 2.5 * (0.6 - 0.2) = 2.5 * 0.4 = 1.0
    # EVI = 1.0 / 2.05 = 0.4878048
    assert pytest.approx(compute_evi(0.6, 0.2, 0.1), abs=1e-5) == 1.0 / 2.05
    assert compute_evi(0.0, 0.0, 0.0) == 0.0

def test_savi():
    # NIR=0.6, Red=0.2 -> 1.5 * (0.6 - 0.2) / (0.6 + 0.2 + 0.5) = 1.5 * 0.4 / 1.3 = 0.6 / 1.3 = 0.461538
    assert pytest.approx(compute_savi(0.6, 0.2), abs=1e-5) == 0.6 / 1.3
    assert compute_savi(0.0, -0.5) == 0.0

def test_gndvi():
    # NIR=0.6, Green=0.2 -> (0.6 - 0.2) / (0.6 + 0.2) = 0.5
    assert pytest.approx(compute_gndvi(0.6, 0.2)) == 0.5
    assert compute_gndvi(0.0, 0.0) == 0.0

def test_ndre():
    # NIR=0.6, RedEdge=0.3 -> (0.6 - 0.3) / (0.6 + 0.3) = 0.3 / 0.9 = 0.333333
    assert pytest.approx(compute_ndre(0.6, 0.3), abs=1e-5) == 1.0 / 3.0
    assert compute_ndre(0.0, 0.0) == 0.0

def test_msi():
    # NIR=0.6, SWIR1=0.3 -> 0.6 / 0.3 = 2.0
    assert pytest.approx(compute_msi(0.6, 0.3)) == 2.0
    assert compute_msi(0.6, 0.0) == 0.0

def test_ndbi():
    # SWIR1=0.4, NIR=0.6 -> (0.4 - 0.6) / (0.4 + 0.6) = -0.2 / 1.0 = -0.2
    assert pytest.approx(compute_ndbi(0.4, 0.6)) == -0.2
    assert compute_ndbi(0.0, 0.0) == 0.0

def test_nbr():
    # NIR=0.6, SWIR2=0.2 -> (0.6 - 0.2) / (0.6 + 0.2) = 0.5
    assert pytest.approx(compute_nbr(0.6, 0.2)) == 0.5
    assert compute_nbr(0.0, 0.0) == 0.0

def test_gci():
    # NIR=0.6, Green=0.2 -> (0.6 / 0.2) - 1 = 3 - 1 = 2.0
    assert pytest.approx(compute_gci(0.6, 0.2)) == 2.0
    assert compute_gci(0.6, 0.0) == 0.0

def test_compute_all():
    res = compute_all_indices(
        red=0.2, green=0.3, blue=0.1, nir=0.6, rededge=0.4, swir1=0.3, swir2=0.2,
        historical_ndvi=[0.45, 0.48], current_rainfall=100.0, mean_rainfall=80.0, temperature=33.0
    )
    assert "ndvi" in res
    assert "ndwi" in res
    assert "evi" in res
    assert "savi" in res
    assert "gndvi" in res
    assert "ndre" in res
    assert "msi" in res
    assert "ndbi" in res
    assert "nbr" in res
    assert "gci" in res
    
    # Check derived
    assert res["rainfall_anomaly"] == 20.0
    assert res["temperature_stress"] == 3.0
    assert "ndvi_trend" in res
