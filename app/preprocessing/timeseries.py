import pandas as pd
import numpy as np
import xarray as xr
import logging
from typing import Dict, Any, Tuple, List, Optional
from datetime import datetime, date, timedelta

logger = logging.getLogger(__name__)

def align_time_series(
    available_dates: List[date], 
    start_date: date, 
    end_date: date, 
    target_frequency: str = '5D'
) -> Tuple[List[date], List[Optional[date]]]:
    """
    Grids available acquisition dates into a regular temporal grid (default every 5 days).
    For each target date in the grid:
      - Searches ±3 days for available imagery.
      - If multiple found: picks the closest.
      - If none found: marks as a gap (None).
    """
    target_range = pd.date_range(start=start_date, end=end_date, freq=target_frequency)
    target_dates = [t.date() for t in target_range]
    
    aligned_mapping = []
    
    for t_date in target_dates:
        best_match = None
        min_diff = timedelta(days=4) # Search window is ±3 days
        
        for a_date in available_dates:
            diff = abs(a_date - t_date)
            if diff < min_diff:
                min_diff = diff
                best_match = a_date
                
        aligned_mapping.append(best_match)
        
    return target_dates, aligned_mapping

def interpolate_gaps(
    band_data: np.ndarray, # Shape: [T, H, W]
    grid_dates: List[date],
    aligned_dates: List[Optional[date]]
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Performs pixel-level interpolation over the time axis:
      - Gaps < 15 days: Linear interpolation between nearest valid dates.
      - Gaps 15-30 days: Cubic spline interpolation.
      - Gaps > 30 days: Left as NaN (insufficient data).
    Returns: (interpolated_band_data, quality_metrics)
    """
    t, h, w = band_data.shape
    interpolated = band_data.copy().astype(np.float32)
    
    # Track metrics
    total_points = t * h * w
    interpolated_count = 0
    gap_count = 0
    
    # Convert dates to pandas timestamps for delta calculations
    pd_dates = [pd.Timestamp(d) for d in grid_dates]
    
    # Process each pixel time-series
    for y in range(h):
        for x in range(w):
            series_vals = band_data[:, y, x].copy()
            s = pd.Series(series_vals, index=pd_dates)
            
            is_nan = s.isna()
            if not is_nan.any():
                continue
                
            # Group consecutive NaNs to evaluate gap sizes
            blocks = (is_nan != is_nan.shift()).cumsum()
            nan_blocks = blocks[is_nan]
            
            for block_id in nan_blocks.unique():
                block_mask = (blocks == block_id)
                indices = np.where(block_mask.values)[0]
                start_idx = indices[0] - 1
                end_idx = indices[-1] + 1
                
                # Check boundary cases
                if start_idx < 0 or end_idx >= t:
                    # Boundary gap cannot be interpolated reliably, leave as is
                    gap_count += len(indices)
                    continue
                    
                gap_days = (grid_dates[end_idx] - grid_dates[start_idx]).days
                
                if gap_days < 15:
                    # Linear interpolation
                    interpolated_vals = s.interpolate(method='linear')
                    s[block_mask] = interpolated_vals[block_mask]
                    interpolated_count += len(indices)
                elif gap_days <= 30:
                    # Cubic spline interpolation
                    try:
                        interpolated_vals = s.interpolate(method='cubic')
                        s[block_mask] = interpolated_vals[block_mask]
                        interpolated_count += len(indices)
                    except Exception:
                        # Fallback to linear if cubic spline has too few points
                        interpolated_vals = s.interpolate(method='linear')
                        s[block_mask] = interpolated_vals[block_mask]
                        interpolated_count += len(indices)
                else:
                    # Gap > 30 days: leave as NaN
                    gap_count += len(indices)
                    
            interpolated[:, y, x] = s.values
            
    # Calculate coverage metrics
    interpolation_ratio = (interpolated_count / total_points) * 100.0 if total_points > 0 else 0.0
    valid_count = np.sum(~np.isnan(interpolated))
    temporal_coverage = (valid_count / total_points) * 100.0 if total_points > 0 else 0.0
    
    metrics = {
        "interpolation_ratio": interpolation_ratio,
        "gap_count": gap_count,
        "temporal_coverage": temporal_coverage
    }
    
    return interpolated, metrics

def harmonize_sensors(
    optical_dates: List[date], 
    sar_dates: List[date]
) -> Dict[date, Optional[date]]:
    """
    Aligns optical and SAR time series by matching the closest SAR date
    to each optical acquisition for sensor fusion.
    """
    mapping = {}
    for o_date in optical_dates:
        best_match = None
        min_diff = timedelta(days=15) # Max search window is 15 days
        
        for s_date in sar_dates:
            diff = abs(s_date - o_date)
            if diff < min_diff:
                min_diff = diff
                best_match = s_date
                
        mapping[o_date] = best_match
    return mapping

def temporal_composite(
    band_data: np.ndarray, # Shape: [T, H, W]
    composite_type: str = 'median'
) -> np.ndarray:
    """
    Generates a single temporal composite array (e.g. median, mean, max) from timeseries.
    Ignores NaNs in calculations.
    """
    if composite_type == 'mean':
        return np.nanmean(band_data, axis=0)
    elif composite_type == 'max':
        return np.nanmax(band_data, axis=0)
    else:
        # Default to median (robust to outliers/cloud remnants)
        return np.nanmedian(band_data, axis=0)
