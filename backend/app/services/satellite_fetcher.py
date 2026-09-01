import os
import tempfile
import zipfile
import urllib.request
import json
import logging
import anyio
import ee
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from app.core.config import settings
from app.core.storage import get_storage_backend
from app.services.gee_auth import initialize_gee

logger = logging.getLogger(__name__)

class SatelliteFetchError(Exception):
    """Base exception for satellite fetching."""
    pass

def geojson_to_ee_geometry(geojson: Dict[str, Any], buffer_m: float = 500.0) -> Tuple[ee.Geometry, ee.Geometry]:
    """
    Parses a farm GeoJSON and returns:
    1. The original ee.Geometry
    2. The buffered ee.Geometry (default 500m buffer)
    """
    try:
        # Resolve GeoJSON coordinates
        if geojson.get("type") == "FeatureCollection":
            features = geojson.get("features", [])
            if not features:
                raise ValueError("Empty FeatureCollection")
            geom_data = features[0].get("geometry")
        elif geojson.get("type") == "Feature":
            geom_data = geojson.get("geometry")
        else:
            geom_data = geojson

        original_ee = ee.Geometry(geom_data)
        buffered_ee = original_ee.buffer(buffer_m)
        return original_ee, buffered_ee
    except Exception as e:
        logger.error(f"Failed to parse GeoJSON to Earth Engine geometry: {e}")
        raise SatelliteFetchError(f"Invalid GeoJSON geometry: {e}")

async def download_gee_zip_and_extract(image: ee.Image, region: ee.Geometry, scale: float, prefix: str) -> str:
    """
    Downloads an ee.Image clipped to a region, extracts the zip, and returns the path to the TIFF file.
    """
    def _download():
        try:
            # Generate GEE download URL
            url = image.getDownloadURL({
                'scale': scale,
                'crs': 'EPSG:4326',
                'region': region,
                'format': 'GEO_TIFF'
            })
            
            temp_dir = tempfile.mkdtemp()
            zip_path = os.path.join(temp_dir, "gee_download.zip")
            
            logger.info(f"Downloading image from link: {url}")
            urllib.request.urlretrieve(url, zip_path)
            
            # Extract TIFF
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
                
            extracted_files = os.listdir(temp_dir)
            tiff_files = [f for f in extracted_files if f.endswith('.tif') or f.endswith('.tiff')]
            if not tiff_files:
                raise FileNotFoundError(f"No GeoTIFF found in download zip. Files: {extracted_files}")
                
            final_tiff_path = os.path.join(temp_dir, f"{prefix}.tif")
            os.rename(os.path.join(temp_dir, tiff_files[0]), final_tiff_path)
            return final_tiff_path
            
        except Exception as e:
            logger.error(f"Failed to download and extract from GEE: {e}")
            raise SatelliteFetchError(f"GEE download failure: {e}")

    return await anyio.to_thread.run_sync(_download)

class SatelliteFetcher:
    def __init__(self):
        self.storage = get_storage_backend()

    async def fetch_sentinel_2(
        self, farm_id: int, original_geom: ee.Geometry, buffered_geom: ee.Geometry, start_date: str, end_date: str
    ) -> List[Dict[str, Any]]:
        """
        Queries and fetches Sentinel-2 Level-2A imagery for the AOI.
        Filters for cloud cover < 20%.
        """
        await initialize_gee()
        
        logger.info(f"Searching Sentinel-2 data for Farm {farm_id} from {start_date} to {end_date}")
        
        # Load collection
        s2_collection = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(buffered_geom)
            .filterDate(start_date, end_date)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
        )
        
        # Get list of images
        try:
            def get_info():
                size = s2_collection.size().getInfo()
                if size == 0:
                    return []
                # Fetch basic info for all matching images
                images_list = s2_collection.toList(size).getInfo()
                return images_list
                
            images_info = await anyio.to_thread.run_sync(get_info)
        except Exception as e:
            logger.error(f"Error querying Sentinel-2 collection: {e}")
            return []

        fetched_records = []

        for idx, img_data in enumerate(images_info):
            properties = img_data.get("properties", {})
            img_id = img_data.get("id")
            system_time = properties.get("system:time_start") / 1000.0
            acq_date_str = datetime.utcfromtimestamp(system_time).strftime("%Y-%m-%d")
            cloud_cover = properties.get("CLOUDY_PIXEL_PERCENTAGE", 0.0)
            orbit = properties.get("SENSING_ORBIT_NUMBER", 0)

            # File path structure: {farm_id}/{satellite}/{date}/{filename}
            dest_prefix = f"farm-{farm_id}/sentinel-2/{acq_date_str}"
            dest_tif = f"{dest_prefix}/bands.tif"
            dest_meta = f"{dest_prefix}/metadata.json"

            # Duplicate detection
            if self.storage.exists(dest_meta):
                logger.info(f"Sentinel-2 image for {acq_date_str} already exists. Skipping.")
                # Retrieve URL to return
                fetched_records.append({
                    "satellite": "sentinel-2",
                    "date": acq_date_str,
                    "file_path": dest_tif,
                    "metadata_path": dest_meta,
                    "cloud_cover": cloud_cover,
                    "status": "exists"
                })
                continue

            logger.info(f"Fetching Sentinel-2 image {idx+1}/{len(images_info)}: Date={acq_date_str}, Cloud={cloud_cover}%")

            try:
                # Load GEE image object
                img = ee.Image(img_id)
                
                # Select standard bands (Blue, Green, Red, NIR, SWIR1, SWIR2)
                img_selected = img.select(["B2", "B3", "B4", "B8", "B11", "B12"])
                
                # Clip to buffer region
                img_clipped = img_selected.clip(buffered_geom)

                # Download local TIFF
                local_tif = await download_gee_zip_and_extract(img_clipped, buffered_geom, 10, "bands")

                # Prepare metadata
                metadata = {
                    "satellite_source": "sentinel-2",
                    "acquisition_date": acq_date_str,
                    "cloud_cover": str(cloud_cover),
                    "orbit": str(orbit),
                    "farm_id": str(farm_id),
                    "processed": "false"
                }

                # Upload TIFF
                self.storage.upload(local_tif, dest_tif, metadata)
                
                # Upload Metadata file
                temp_meta_path = os.path.join(os.path.dirname(local_tif), "metadata.json")
                with open(temp_meta_path, "w") as f:
                    json.dump(metadata, f, indent=2)
                self.storage.upload(temp_meta_path, dest_meta)

                # Clean up local temporary files
                os.remove(local_tif)
                os.remove(temp_meta_path)
                try:
                    os.rmdir(os.path.dirname(local_tif))
                except Exception:
                    pass

                fetched_records.append({
                    "satellite": "sentinel-2",
                    "date": acq_date_str,
                    "file_path": dest_tif,
                    "metadata_path": dest_meta,
                    "cloud_cover": cloud_cover,
                    "status": "downloaded"
                })

            except Exception as e:
                logger.error(f"Failed to fetch Sentinel-2 image on {acq_date_str}: {e}")
                # Queue failed fetches can be handled by Celery caller

        return fetched_records

    async def fetch_sentinel_1(
        self, farm_id: int, original_geom: ee.Geometry, buffered_geom: ee.Geometry, start_date: str, end_date: str
    ) -> List[Dict[str, Any]]:
        """
        Queries and fetches Sentinel-1 SAR imagery (IW mode, VV+VH polarizations) for the AOI.
        """
        await initialize_gee()
        logger.info(f"Searching Sentinel-1 data for Farm {farm_id} from {start_date} to {end_date}")

        s1_collection = (
            ee.ImageCollection("COPERNICUS/S1_GRD")
            .filterBounds(buffered_geom)
            .filterDate(start_date, end_date)
            .filter(ee.Filter.eq("instrumentMode", "IW"))
            .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
            .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
        )

        try:
            def get_info():
                size = s1_collection.size().getInfo()
                if size == 0:
                    return []
                return s1_collection.toList(size).getInfo()
            images_info = await anyio.to_thread.run_sync(get_info)
        except Exception as e:
            logger.error(f"Error querying Sentinel-1 collection: {e}")
            return []

        fetched_records = []

        for idx, img_data in enumerate(images_info):
            properties = img_data.get("properties", {})
            img_id = img_data.get("id")
            system_time = properties.get("system:time_start") / 1000.0
            acq_date_str = datetime.utcfromtimestamp(system_time).strftime("%Y-%m-%d")
            orbit = properties.get("orbitProperties_pass", "N/A")

            dest_prefix = f"farm-{farm_id}/sentinel-1/{acq_date_str}"
            dest_tif = f"{dest_prefix}/sar.tif"
            dest_meta = f"{dest_prefix}/metadata.json"

            if self.storage.exists(dest_meta):
                logger.info(f"Sentinel-1 SAR image for {acq_date_str} already exists. Skipping.")
                fetched_records.append({
                    "satellite": "sentinel-1",
                    "date": acq_date_str,
                    "file_path": dest_tif,
                    "metadata_path": dest_meta,
                    "status": "exists"
                })
                continue

            logger.info(f"Fetching Sentinel-1 SAR image {idx+1}/{len(images_info)}: Date={acq_date_str}")

            try:
                img = ee.Image(img_id)
                img_selected = img.select(["VV", "VH"])
                img_clipped = img_selected.clip(buffered_geom)

                local_tif = await download_gee_zip_and_extract(img_clipped, buffered_geom, 10, "sar")

                metadata = {
                    "satellite_source": "sentinel-1",
                    "acquisition_date": acq_date_str,
                    "polarization": "VV+VH",
                    "orbit": str(orbit),
                    "farm_id": str(farm_id),
                    "processed": "false"
                }

                self.storage.upload(local_tif, dest_tif, metadata)
                
                temp_meta_path = os.path.join(os.path.dirname(local_tif), "metadata.json")
                with open(temp_meta_path, "w") as f:
                    json.dump(metadata, f, indent=2)
                self.storage.upload(temp_meta_path, dest_meta)

                os.remove(local_tif)
                os.remove(temp_meta_path)
                try:
                    os.rmdir(os.path.dirname(local_tif))
                except Exception:
                    pass

                fetched_records.append({
                    "satellite": "sentinel-1",
                    "date": acq_date_str,
                    "file_path": dest_tif,
                    "metadata_path": dest_meta,
                    "status": "downloaded"
                })

            except Exception as e:
                logger.error(f"Failed to fetch Sentinel-1 image on {acq_date_str}: {e}")

        return fetched_records

    async def fetch_liss_4(
        self, farm_id: int, original_geom: ee.Geometry, buffered_geom: ee.Geometry, start_date: str, end_date: str
    ) -> List[Dict[str, Any]]:
        """
        Queries and fetches LISS-IV (ISRO Resourcesat) imagery if available.
        Uses fallback mock/warning if dataset is unavailable.
        """
        await initialize_gee()
        logger.info(f"Searching LISS-IV data for Farm {farm_id} from {start_date} to {end_date}")

        try:
            # Check ISRO Resourcesat-2 LISS-4 collection in Earth Engine
            # Note: Public collection for LISS-4 may be nested or requires credentials.
            # We attempt standard access, and gracefully log if inaccessible.
            liss_collection = (
                ee.ImageCollection("ISRO/RESOURCESAT2/LISS4")  # standard catalog path if public
                .filterBounds(buffered_geom)
                .filterDate(start_date, end_date)
            )

            def get_info():
                size = liss_collection.size().getInfo()
                if size == 0:
                    return []
                return liss_collection.toList(size).getInfo()
            
            images_info = await anyio.to_thread.run_sync(get_info)
        except Exception as e:
            logger.warning(f"LISS-IV dataset 'ISRO/RESOURCESAT2/LISS4' not accessible: {e}. Skipping LISS-IV query.")
            return []

        fetched_records = []
        for idx, img_data in enumerate(images_info):
            properties = img_data.get("properties", {})
            img_id = img_data.get("id")
            system_time = properties.get("system:time_start") / 1000.0
            acq_date_str = datetime.utcfromtimestamp(system_time).strftime("%Y-%m-%d")

            dest_prefix = f"farm-{farm_id}/liss-4/{acq_date_str}"
            dest_tif = f"{dest_prefix}/liss.tif"
            dest_meta = f"{dest_prefix}/metadata.json"

            if self.storage.exists(dest_meta):
                fetched_records.append({
                    "satellite": "liss-4",
                    "date": acq_date_str,
                    "file_path": dest_tif,
                    "metadata_path": dest_meta,
                    "status": "exists"
                })
                continue

            logger.info(f"Fetching LISS-IV image {idx+1}/{len(images_info)}: Date={acq_date_str}")

            try:
                img = ee.Image(img_id)
                # LISS-IV standard bands (B2 Green, B3 Red, B4 NIR) at 5.8m
                img_clipped = img.select(["B2", "B3", "B4"]).clip(buffered_geom)

                local_tif = await download_gee_zip_and_extract(img_clipped, buffered_geom, 5.8, "liss")

                metadata = {
                    "satellite_source": "liss-4",
                    "acquisition_date": acq_date_str,
                    "resolution": "5.8m",
                    "farm_id": str(farm_id),
                    "processed": "false"
                }

                self.storage.upload(local_tif, dest_tif, metadata)
                
                temp_meta_path = os.path.join(os.path.dirname(local_tif), "metadata.json")
                with open(temp_meta_path, "w") as f:
                    json.dump(metadata, f, indent=2)
                self.storage.upload(temp_meta_path, dest_meta)

                os.remove(local_tif)
                os.remove(temp_meta_path)
                try:
                    os.rmdir(os.path.dirname(local_tif))
                except Exception:
                    pass

                fetched_records.append({
                    "satellite": "liss-4",
                    "date": acq_date_str,
                    "file_path": dest_tif,
                    "metadata_path": dest_meta,
                    "status": "downloaded"
                })
            except Exception as e:
                logger.error(f"Failed to fetch LISS-IV image on {acq_date_str}: {e}")

        return fetched_records
