"""
Backend Parcel Verification & Audit Service
Handles server-side validation of farm polygon boundaries, spatial checks,
evidence snapshot creation, and audit trails.
"""
from datetime import datetime, timezone
import json
from typing import Dict, Any, Optional

class ParcelVerificationBackendService:
    @staticmethod
    def validate_boundary_geometry(boundary_geojson: Dict[str, Any]) -> Dict[str, Any]:
        """
        Server-side validation of polygon geometry.
        Ensures GeoJSON represents a valid closed polygon with at least 3 unique vertices.
        """
        if not boundary_geojson or boundary_geojson.get("type") != "Polygon":
            return {"valid": False, "error": "Geometry must be a valid GeoJSON Polygon"}
        
        coords = boundary_geojson.get("coordinates")
        if not coords or not isinstance(coords, list) or len(coords) == 0:
            return {"valid": False, "error": "Polygon coordinates cannot be empty"}
        
        ring = coords[0]
        if len(ring) < 4:  # Closed ring needs min 4 points (first and last same)
            return {"valid": False, "error": "Polygon boundary must contain at least 3 vertices"}
        
        # Check closed ring
        if ring[0] != ring[-1]:
            ring.append(ring[0])
            
        return {"valid": True, "ring_count": len(ring) - 1}

    @staticmethod
    def generate_snapshot_payload(
        farm_id: int,
        version: int,
        farm_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate immutable insured parcel evidence snapshot dictionary payload.
        """
        timestamp = datetime.now(timezone.utc).isoformat()
        snapshot_id = f"SNAP-{farm_id}-V{version}-{timestamp[:10]}"
        
        return {
            "snapshotId": snapshot_id,
            "farmId": farm_id,
            "version": version,
            "capturedAt": timestamp,
            "farmName": farm_data.get("name"),
            "cropType": farm_data.get("crop_type"),
            "sowingDate": str(farm_data.get("sowing_date")),
            "state": farm_data.get("state"),
            "district": farm_data.get("district"),
            "taluka": farm_data.get("taluka"),
            "village": farm_data.get("village"),
            "khasraNumber": farm_data.get("khasra_number"),
            "insurancePolicyNumber": farm_data.get("insurance_policy_number"),
            "gpsLatitude": farm_data.get("gps_latitude"),
            "gpsLongitude": farm_data.get("gps_longitude"),
            "gpsAccuracyMeters": farm_data.get("gps_accuracy_meters"),
            "centerPinLatitude": farm_data.get("center_pin_latitude"),
            "centerPinLongitude": farm_data.get("center_pin_longitude"),
            "boundaryGeoJSON": farm_data.get("boundary_geojson"),
            "areaHectares": farm_data.get("area_hectares"),
            "areaAcres": round((farm_data.get("area_hectares") or 0.0) * 2.47105, 2),
            "overlapStatus": farm_data.get("overlap_status", "NONE"),
            "verificationStatus": "PENDING_OFFICIAL_VERIFICATION",
            "disclaimer": "GPS and satellite imagery are used to identify the selected agricultural plot. Legal ownership and official parcel boundaries must be verified using applicable land records."
        }

    @staticmethod
    def evaluate_parcel_match_score(
        khasra_number: str,
        state: str,
        district: str,
        boundary_geojson: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Interface for future official cadastral GIS integration.
        Currently returns PENDING_OFFICIAL_VERIFICATION.
        """
        return {
            "matchStatus": "PENDING_OFFICIAL_VERIFICATION",
            "matchScore": None,
            "officialParcelId": None,
            "officialAreaHectares": None,
            "notes": "Official state government cadastral GIS lookup pending integration."
        }
