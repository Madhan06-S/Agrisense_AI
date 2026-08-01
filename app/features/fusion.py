import numpy as np
from typing import List, Dict, Any, Optional, Tuple

FEATURE_NAMES = [
    # Optical (10)
    "ndvi", "ndwi", "evi", "savi", "gndvi", "ndre", "msi", "ndbi", "nbr", "gci",
    # SAR (3)
    "vv", "vh", "sar_ratio",
    # Weather (5)
    "temp", "precip", "humidity", "wind_speed", "solar_rad",
    # Soil (4)
    "soil_moisture", "soil_ph", "soil_n", "soil_p"
]

def fuse_features(
    optical: Dict[str, float],
    sar: Dict[str, float],
    weather: Dict[str, float],
    soil: Dict[str, float]
) -> np.ndarray:
    """
    Early fusion: concatenate optical (10), SAR (3), weather (5), and soil (4) features
    into a single 22-dimensional feature vector.
    """
    vector = []
    
    # 1. Optical (10)
    for name in ["ndvi", "ndwi", "evi", "savi", "gndvi", "ndre", "msi", "ndbi", "nbr", "gci"]:
        vector.append(optical.get(name, np.nan))
        
    # 2. SAR (3)
    vv = sar.get("vv", np.nan)
    vh = sar.get("vh", np.nan)
    sar_ratio = sar.get("sar_ratio", vv / vh if (vh != 0.0 and not np.isnan(vv) and not np.isnan(vh)) else np.nan)
    vector.extend([vv, vh, sar_ratio])
    
    # 3. Weather (5)
    for name in ["temp", "precip", "humidity", "wind_speed", "solar_rad"]:
        vector.append(weather.get(name, np.nan))
        
    # 4. Soil (4)
    for name in ["soil_moisture", "soil_ph", "soil_n", "soil_p"]:
        vector.append(soil.get(name, np.nan))
        
    return np.array(vector, dtype=np.float32)

def fuse_dataset(
    optical_list: List[Dict[str, float]],
    sar_list: List[Dict[str, float]],
    weather_list: List[Dict[str, float]],
    soil_list: List[Dict[str, float]]
) -> np.ndarray:
    """
    Fuses lists of features into an [N, 22] matrix.
    """
    n = min(len(optical_list), len(sar_list), len(weather_list), len(soil_list))
    if n == 0:
        return np.empty((0, 22), dtype=np.float32)
        
    matrix = np.zeros((n, 22), dtype=np.float32)
    for i in range(n):
        matrix[i] = fuse_features(optical_list[i], sar_list[i], weather_list[i], soil_list[i])
    return matrix

def impute_missing(matrix: np.ndarray) -> np.ndarray:
    """
    Performs median imputation: replaces NaNs in each column with the median of that column.
    If a column has only NaNs, fills with 0.0.
    """
    imputed = matrix.copy()
    if imputed.shape[0] == 0:
        return imputed
        
    for col_idx in range(imputed.shape[1]):
        col = imputed[:, col_idx]
        nan_mask = np.isnan(col)
        if not np.any(nan_mask):
            continue
            
        non_nan_vals = col[~nan_mask]
        if len(non_nan_vals) > 0:
            median_val = np.median(non_nan_vals)
        else:
            median_val = 0.0
            
        imputed[nan_mask, col_idx] = median_val
        
    return imputed

def normalize_zscore(matrix: np.ndarray) -> np.ndarray:
    """
    Performs z-score normalization on columns: (x - mean) / std.
    If std is 0.0, the normalized values will be set to 0.0.
    """
    normalized = matrix.copy()
    if normalized.shape[0] == 0:
        return normalized
        
    for col_idx in range(normalized.shape[1]):
        col = normalized[:, col_idx]
        mean = np.mean(col)
        std = np.std(col)
        if std > 1e-8:
            normalized[:, col_idx] = (col - mean) / std
        else:
            normalized[:, col_idx] = 0.0
            
    return normalized

def calculate_mutual_information(x: np.ndarray, y: np.ndarray, bins: int = 10) -> float:
    """
    Computes Shannon mutual information I(X; Y) between continuous features using histogram binning.
    """
    # Filter out NaNs
    mask = ~np.isnan(x) & ~np.isnan(y)
    x_clean = x[mask]
    y_clean = y[mask]
    
    if len(x_clean) < 2:
        return 0.0
        
    # Get joint distribution
    c_xy, _, _ = np.histogram2d(x_clean, y_clean, bins=bins)
    p_xy = c_xy / np.sum(c_xy)
    
    p_x = np.sum(p_xy, axis=1)
    p_y = np.sum(p_xy, axis=0)
    
    mi = 0.0
    for i in range(p_xy.shape[0]):
        for j in range(p_xy.shape[1]):
            if p_xy[i, j] > 0.0 and p_x[i] > 0.0 and p_y[j] > 0.0:
                mi += p_xy[i, j] * np.log2(p_xy[i, j] / (p_x[i] * p_y[j]))
                
    return max(0.0, float(mi))

def rank_features(matrix: np.ndarray, target: np.ndarray) -> List[Dict[str, Any]]:
    """
    Ranks the 22 features based on their mutual information with the target vector.
    Returns list of dicts: [{"name": name, "mi": value, "rank": rank_idx}]
    """
    rankings = []
    
    for col_idx in range(22):
        name = FEATURE_NAMES[col_idx]
        col = matrix[:, col_idx]
        
        mi = calculate_mutual_information(col, target)
        rankings.append({
            "name": name,
            "mi": mi,
            "feature_index": col_idx
        })
        
    # Sort descending by MI
    rankings.sort(key=lambda x: x["mi"], reverse=True)
    
    # Assign ranks
    for idx, item in enumerate(rankings):
        item["rank"] = idx + 1
        
    return rankings
