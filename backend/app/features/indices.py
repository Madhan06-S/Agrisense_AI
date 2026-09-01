import numpy as np
from typing import Dict, Any, Union, List, Optional

def compute_ndvi(nir: Union[float, np.ndarray], red: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
    """NDVI = (NIR - R) / (NIR + R)"""
    denom = nir + red
    if isinstance(denom, np.ndarray):
        out = np.zeros_like(denom, dtype=np.float32)
        np.divide(nir - red, denom, out=out, where=denom != 0.0)
        return out
    return (nir - red) / denom if denom != 0.0 else 0.0

def compute_ndwi(green: Union[float, np.ndarray], nir: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
    """NDWI = (G - NIR) / (G + NIR)"""
    denom = green + nir
    if isinstance(denom, np.ndarray):
        out = np.zeros_like(denom, dtype=np.float32)
        np.divide(green - nir, denom, out=out, where=denom != 0.0)
        return out
    return (green - nir) / denom if denom != 0.0 else 0.0

def compute_evi(nir: Union[float, np.ndarray], red: Union[float, np.ndarray], blue: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
    """EVI = 2.5 * (NIR - R) / (NIR + 6*R - 7.5*B + 1)"""
    denom = nir + 6.0 * red - 7.5 * blue + 1.0
    if isinstance(denom, np.ndarray):
        out = np.zeros_like(denom, dtype=np.float32)
        np.divide(2.5 * (nir - red), denom, out=out, where=denom != 0.0)
        return out
    return 2.5 * (nir - red) / denom if denom != 0.0 else 0.0

def compute_savi(nir: Union[float, np.ndarray], red: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
    """SAVI = (1.5)*(NIR-R)/(NIR+R+0.5)"""
    denom = nir + red + 0.5
    if isinstance(denom, np.ndarray):
        out = np.zeros_like(denom, dtype=np.float32)
        np.divide(1.5 * (nir - red), denom, out=out, where=denom != 0.0)
        return out
    return 1.5 * (nir - red) / denom if denom != 0.0 else 0.0

def compute_gndvi(nir: Union[float, np.ndarray], green: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
    """GNDVI = (NIR - G) / (NIR + G)"""
    denom = nir + green
    if isinstance(denom, np.ndarray):
        out = np.zeros_like(denom, dtype=np.float32)
        np.divide(nir - green, denom, out=out, where=denom != 0.0)
        return out
    return (nir - green) / denom if denom != 0.0 else 0.0

def compute_ndre(nir: Union[float, np.ndarray], rededge: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
    """NDRE = (NIR - RedEdge) / (NIR + RedEdge)"""
    denom = nir + rededge
    if isinstance(denom, np.ndarray):
        out = np.zeros_like(denom, dtype=np.float32)
        np.divide(nir - rededge, denom, out=out, where=denom != 0.0)
        return out
    return (nir - rededge) / denom if denom != 0.0 else 0.0

def compute_msi(nir: Union[float, np.ndarray], swir1: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
    """MSI = NIR / SWIR1"""
    if isinstance(swir1, np.ndarray):
        out = np.zeros_like(swir1, dtype=np.float32)
        np.divide(nir, swir1, out=out, where=swir1 != 0.0)
        return out
    return nir / swir1 if swir1 != 0.0 else 0.0

def compute_ndbi(swir1: Union[float, np.ndarray], nir: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
    """NDBI = (SWIR1 - NIR) / (SWIR1 + NIR)"""
    denom = swir1 + nir
    if isinstance(denom, np.ndarray):
        out = np.zeros_like(denom, dtype=np.float32)
        np.divide(swir1 - nir, denom, out=out, where=denom != 0.0)
        return out
    return (swir1 - nir) / denom if denom != 0.0 else 0.0

def compute_nbr(nir: Union[float, np.ndarray], swir2: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
    """NBR = (NIR - SWIR2) / (NIR + SWIR2)"""
    denom = nir + swir2
    if isinstance(denom, np.ndarray):
        out = np.zeros_like(denom, dtype=np.float32)
        np.divide(nir - swir2, denom, out=out, where=denom != 0.0)
        return out
    return (nir - swir2) / denom if denom != 0.0 else 0.0

def compute_gci(nir: Union[float, np.ndarray], green: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
    """GCI = (NIR / G) - 1"""
    if isinstance(green, np.ndarray):
        out = np.zeros_like(green, dtype=np.float32)
        np.divide(nir, green, out=out, where=green != 0.0)
        # Apply subtraction mask-aware or subtract 1.0 from active elements
        out = np.where(green != 0.0, out - 1.0, 0.0)
        return out
    return (nir / green) - 1.0 if green != 0.0 else 0.0

def compute_derived_metrics(
    ndvi: float,
    historical_ndvi: Optional[List[float]] = None,
    current_rainfall: Optional[float] = None,
    mean_rainfall: Optional[float] = None,
    temperature: Optional[float] = None
) -> Dict[str, float]:
    """
    Computes derived metrics:
    - ndvi_trend: Slope of NDVI historical trend or simple diff.
    - rainfall_anomaly: current_rainfall - mean_rainfall.
    - temperature_stress: max(0.0, temperature - 30.0).
    """
    # 1. NDVI Trend
    if historical_ndvi and len(historical_ndvi) > 0:
        if len(historical_ndvi) == 1:
            ndvi_trend = ndvi - historical_ndvi[0]
        else:
            y = historical_ndvi + [ndvi]
            x = list(range(len(y)))
            try:
                slope, _ = np.polyfit(x, y, 1)
                ndvi_trend = float(slope)
            except Exception:
                ndvi_trend = 0.0
    else:
        ndvi_trend = 0.0

    # 2. Rainfall Anomaly
    if current_rainfall is not None and mean_rainfall is not None:
        rainfall_anomaly = current_rainfall - mean_rainfall
    else:
        rainfall_anomaly = 0.0

    # 3. Temperature Stress
    if temperature is not None:
        temperature_stress = max(0.0, temperature - 30.0)
    else:
        temperature_stress = 0.0

    return {
        "ndvi_trend": ndvi_trend,
        "rainfall_anomaly": rainfall_anomaly,
        "temperature_stress": temperature_stress
    }

def compute_all_indices(
    red: float,
    green: float,
    blue: float,
    nir: float,
    rededge: Optional[float] = None,
    swir1: float = 0.0,
    swir2: float = 0.0,
    historical_ndvi: Optional[List[float]] = None,
    current_rainfall: Optional[float] = None,
    mean_rainfall: Optional[float] = None,
    temperature: Optional[float] = None
) -> Dict[str, float]:
    """
    Computes all 10 indices and derived metrics from cleaned band values.
    """
    re = rededge if rededge is not None else (red + nir) / 2.0

    ndvi = float(compute_ndvi(nir, red))
    ndwi = float(compute_ndwi(green, nir))
    evi = float(compute_evi(nir, red, blue))
    savi = float(compute_savi(nir, red))
    gndvi = float(compute_gndvi(nir, green))
    ndre = float(compute_ndre(nir, re))
    msi = float(compute_msi(nir, swir1))
    ndbi = float(compute_ndbi(swir1, nir))
    nbr = float(compute_nbr(nir, swir2))
    gci = float(compute_gci(nir, green))

    derived = compute_derived_metrics(
        ndvi=ndvi,
        historical_ndvi=historical_ndvi,
        current_rainfall=current_rainfall,
        mean_rainfall=mean_rainfall,
        temperature=temperature
    )

    return {
        "ndvi": ndvi,
        "ndwi": ndwi,
        "evi": evi,
        "savi": savi,
        "gndvi": gndvi,
        "ndre": ndre,
        "msi": msi,
        "ndbi": ndbi,
        "nbr": nbr,
        "gci": gci,
        **derived
    }
