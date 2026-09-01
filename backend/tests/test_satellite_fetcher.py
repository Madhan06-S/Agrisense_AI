import pytest
import os
import shutil
from unittest.mock import patch, MagicMock
from app.services.satellite_fetcher import SatelliteFetcher, geojson_to_ee_geometry

@pytest.mark.asyncio
async def test_satellite_fetcher_s2_download():
    fetcher = SatelliteFetcher()
    
    geojson = {
        "type": "Polygon",
        "coordinates": [
            [[76.96, 29.54], [76.98, 29.54], [76.98, 29.56], [76.96, 29.56], [76.96, 29.54]]
        ]
    }
    orig, buff = geojson_to_ee_geometry(geojson)
    
    # Mock download extraction to return a dummy file path
    async def mock_download(*args, **kwargs):
        import tempfile
        temp_dir = tempfile.mkdtemp()
        dummy_tif = os.path.join(temp_dir, "bands.tif")
        with open(dummy_tif, "w") as f:
            f.write("mock_tiff_binary_data")
        return dummy_tif

    # Mock matching imagery catalog search response
    mock_s2_images_list = [
        {
            "id": "COPERNICUS/S2_SR_HARMONIZED/img1",
            "properties": {
                "system:time_start": 1784080000000,  # 2026-07-15 approx
                "CLOUDY_PIXEL_PERCENTAGE": 12.5,
                "SENSING_ORBIT_NUMBER": 42
            }
        }
    ]

    with patch("app.services.satellite_fetcher.download_gee_zip_and_extract", side_effect=mock_download):
        with patch("ee.ImageCollection.size", return_value=MagicMock(getInfo=lambda: 1)):
            with patch("ee.ImageCollection.toList", return_value=MagicMock(getInfo=lambda: mock_s2_images_list)):
                
                # Mock storage backend exists/upload to avoid real AWS/MinIO interaction during test
                with patch.object(fetcher.storage, "exists", return_value=False):
                    with patch.object(fetcher.storage, "upload", return_value=True):
                        records = await fetcher.fetch_sentinel_2(1, orig, buff, "2026-07-01", "2026-07-20")
                        
                        assert len(records) == 1
                        assert records[0]["satellite"] == "sentinel-2"
                        assert records[0]["date"] == "2026-07-15"
                        assert records[0]["status"] == "downloaded"
