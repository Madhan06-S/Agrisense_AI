import pytest
import numpy as np
from datetime import date, timedelta
from app.preprocessing.timeseries import (
    align_time_series,
    interpolate_gaps,
    harmonize_sensors,
    temporal_composite
)

def test_align_time_series_gridding():
    start = date(2026, 6, 1)
    end = date(2026, 6, 15)
    
    # Available acquisitions (on 1st, 7th, 15th)
    available = [date(2026, 6, 1), date(2026, 6, 7), date(2026, 6, 15)]
    
    # Grid frequency: 5D -> 1st, 6th, 11th
    grid_dates, aligned = align_time_series(available, start, end, target_frequency="5D")
    
    assert len(grid_dates) == 3
    assert grid_dates[0] == date(2026, 6, 1)
    # 1st matches 1st (0 days diff)
    assert aligned[0] == date(2026, 6, 1)
    # 6th matches 7th (1 day diff < 3)
    assert aligned[1] == date(2026, 6, 7)
    # 11th has no match in available within ±3 days
    assert aligned[2] is None

def test_interpolate_gaps_selective():
    grid_dates = [date(2026, 6, 1) + timedelta(days=5 * i) for i in range(10)]
    
    # 3D band data: [10, 2, 2]
    band_data = np.ones((10, 2, 2), dtype=np.float32)
    
    # Create aligned list with gaps
    aligned = [date(2026, 6, 1) + timedelta(days=5 * i) for i in range(10)]
    
    # 1. Mild gap: 1 missing date (5 days gap size) -> should interpolate linear
    aligned[3] = None
    band_data[3] = np.nan
    
    # 2. Moderate gap: 3 missing dates (15 days gap size) -> should interpolate cubic spline
    aligned[6] = None
    aligned[7] = None
    aligned[8] = None
    band_data[6] = np.nan
    band_data[7] = np.nan
    band_data[8] = np.nan
    
    interpolated, metrics = interpolate_gaps(band_data, grid_dates, aligned)
    
    # Verify mild gap (index 3) is filled
    assert not np.isnan(interpolated[3]).any()
    # Verify moderate gap (indices 6, 7, 8) is filled
    assert not np.isnan(interpolated[6]).any()
    
    # Verify statistics
    assert metrics["interpolation_ratio"] == 40.0 # 4 of 10 elements filled

def test_sensor_harmonization():
    optical = [date(2026, 6, 1), date(2026, 6, 10)]
    sar = [date(2026, 6, 2), date(2026, 6, 8), date(2026, 6, 15)]
    
    mapping = harmonize_sensors(optical, sar)
    
    # 1st optical should match 2nd June SAR
    assert mapping[date(2026, 6, 1)] == date(2026, 6, 2)
    # 10th optical should match 8th June SAR
    assert mapping[date(2026, 6, 10)] == date(2026, 6, 8)

def test_temporal_composites():
    # 3D data: shape [3, 2, 2]
    data = np.array([
        [[1.0, 2.0], [3.0, 4.0]],
        [[2.0, 3.0], [4.0, 5.0]],
        [[np.nan, 4.0], [5.0, 6.0]]
    ], dtype=np.float32)
    
    median_comp = temporal_composite(data, composite_type="median")
    assert median_comp[0, 0] == 1.5 # Median of 1.0, 2.0, nan is 1.5
    assert median_comp[1, 1] == 5.0 # Median of 4.0, 5.0, 6.0 is 5.0
