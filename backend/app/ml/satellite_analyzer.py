"""
Satellite Analyzer — fetches NDVI/NDWI from Google Earth Engine or returns mock data.
Controlled by USE_MOCK_SATELLITE env flag.
"""
import random
from datetime import date, timedelta
from typing import Optional
from app.core.config import settings


class SatelliteAnalyzer:
    def __init__(self):
        self.use_mock = settings.USE_MOCK_SATELLITE

    async def analyze(
        self,
        farm_id: int,
        claim_date: date,
        claim_type: str,
        boundary_geojson: Optional[dict] = None,
    ) -> dict:
        if self.use_mock:
            return self._mock_analysis(claim_type)
        return await self._gee_analysis(farm_id, claim_date, boundary_geojson)

    def _mock_analysis(self, claim_type: str) -> dict:
        """Generate realistic mock satellite scores based on claim type."""
        scenarios = {
            "flood": {
                "ndvi_current": random.uniform(0.10, 0.30),
                "ndvi_baseline": random.uniform(0.55, 0.75),
                "ndwi": random.uniform(0.35, 0.65),
                "water_detected": True,
            },
            "drought": {
                "ndvi_current": random.uniform(0.08, 0.25),
                "ndvi_baseline": random.uniform(0.50, 0.70),
                "ndwi": random.uniform(-0.4, -0.1),
                "water_detected": False,
            },
            "pest": {
                "ndvi_current": random.uniform(0.25, 0.45),
                "ndvi_baseline": random.uniform(0.55, 0.70),
                "ndwi": random.uniform(-0.1, 0.1),
                "water_detected": False,
            },
            "cyclone": {
                "ndvi_current": random.uniform(0.05, 0.20),
                "ndvi_baseline": random.uniform(0.55, 0.75),
                "ndwi": random.uniform(0.20, 0.50),
                "water_detected": True,
            },
            "hailstorm": {
                "ndvi_current": random.uniform(0.15, 0.35),
                "ndvi_baseline": random.uniform(0.55, 0.70),
                "ndwi": random.uniform(-0.1, 0.2),
                "water_detected": False,
            },
        }
        data = scenarios.get(claim_type, scenarios["flood"])

        ndvi_drop = data["ndvi_baseline"] - data["ndvi_current"]
        ndvi_drop_pct = (ndvi_drop / data["ndvi_baseline"]) * 100

        # Score: 0.5 NDVI drop = 100 score
        satellite_score = min(100.0, ndvi_drop * 200)
        confidence = 0.85 if ndvi_drop > 0.3 else (0.65 if ndvi_drop > 0.15 else 0.40)

        return {
            "satellite_score": round(satellite_score, 1),
            "ndvi_current": round(data["ndvi_current"], 3),
            "ndvi_baseline": round(data["ndvi_baseline"], 3),
            "ndvi_drop_percent": round(ndvi_drop_pct, 1),
            "ndwi": round(data["ndwi"], 3),
            "water_detected": data["water_detected"],
            "cloud_cover": round(random.uniform(5, 35), 1),
            "source": "sentinel-2",
            "confidence": round(confidence, 2),
        }

    async def _gee_analysis(self, farm_id: int, claim_date: date, boundary_geojson: Optional[dict]) -> dict:
        """Real GEE analysis — implement when credentials are available."""
        raise NotImplementedError("GEE analysis requires USE_MOCK_SATELLITE=false and valid credentials")
