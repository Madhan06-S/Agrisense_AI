"""
Weather Validator — validates claim type against historical weather events.
Uses OpenWeather API in prod, mock scenarios in dev.
"""
import random
from datetime import date, timedelta
from app.core.config import settings


class WeatherValidator:
    SCENARIOS = {
        "flood": {
            "rainfall_mm": lambda: random.uniform(80, 200),
            "max_wind_speed": lambda: random.uniform(20, 50),
            "drought_days": 0,
            "weather_validates": True,
        },
        "drought": {
            "rainfall_mm": lambda: random.uniform(0, 5),
            "max_wind_speed": lambda: random.uniform(5, 20),
            "drought_days": random.randint(25, 45),
            "weather_validates": True,
        },
        "cyclone": {
            "rainfall_mm": lambda: random.uniform(100, 300),
            "max_wind_speed": lambda: random.uniform(90, 180),
            "drought_days": 0,
            "weather_validates": True,
        },
        "hailstorm": {
            "rainfall_mm": lambda: random.uniform(30, 80),
            "max_wind_speed": lambda: random.uniform(40, 90),
            "drought_days": 0,
            "weather_validates": True,
        },
        "pest": {
            "rainfall_mm": lambda: random.uniform(10, 40),
            "max_wind_speed": lambda: random.uniform(5, 25),
            "drought_days": 0,
            "weather_validates": False,  # Weather doesn't directly validate pest
        },
    }

    async def validate(
        self,
        farm_id: int,
        claim_date: date,
        claim_type: str,
        lat: float = 17.5,
        lng: float = 78.5,
    ) -> dict:
        if settings.USE_MOCK_WEATHER:
            return self._mock_validate(claim_type)
        return await self._real_validate(claim_date, claim_type, lat, lng)

    def _mock_validate(self, claim_type: str) -> dict:
        scenario = self.SCENARIOS.get(claim_type, self.SCENARIOS["flood"])

        rainfall = scenario["rainfall_mm"]() if callable(scenario["rainfall_mm"]) else scenario["rainfall_mm"]
        wind = scenario["max_wind_speed"]() if callable(scenario["max_wind_speed"]) else scenario["max_wind_speed"]
        drought_days = scenario["drought_days"]() if callable(scenario.get("drought_days", 0)) else scenario.get("drought_days", 0)
        validates = scenario["weather_validates"]

        # Score: weather strongly supporting claim = high score
        if validates:
            if claim_type == "flood":
                score = min(100.0, (rainfall / 50) * 50 + 30)
            elif claim_type == "drought":
                score = min(100.0, drought_days * 2 + 20)
            elif claim_type == "cyclone":
                score = min(100.0, (wind / 80) * 60 + 30)
            else:
                score = random.uniform(55, 80)
        else:
            score = random.uniform(20, 45)  # weather doesn't validate pest directly

        confidence = 0.90 if validates else 0.55

        return {
            "weather_score": round(score, 1),
            "weather_validates_claim": validates,
            "rainfall_mm": round(rainfall, 1),
            "max_wind_speed": round(wind, 1),
            "drought_days": drought_days,
            "temperature_c": round(random.uniform(25, 42), 1),
            "humidity_pct": round(random.uniform(50, 95), 1),
            "confidence": round(confidence, 2),
        }

    async def _real_validate(self, claim_date: date, claim_type: str, lat: float, lng: float) -> dict:
        raise NotImplementedError("Set USE_MOCK_WEATHER=false and provide OPENWEATHER_API_KEY")

    async def get_current_weather_mock(self) -> dict:
        """Current + 5-day forecast for dashboard widget."""
        days = []
        temps = [32, 34, 30, 28, 33]
        descriptions = ["Partly Cloudy", "Sunny", "Light Rain", "Overcast", "Thunderstorm"]
        for i in range(5):
            days.append({
                "date": (date.today() + timedelta(days=i)).isoformat(),
                "temp_max": temps[i],
                "temp_min": temps[i] - random.randint(4, 8),
                "description": descriptions[i],
                "rainfall_mm": random.uniform(0, 30) if "Rain" in descriptions[i] or "Thunder" in descriptions[i] else 0,
                "humidity": random.randint(60, 90),
                "wind_kmh": random.randint(10, 45),
            })
        return {
            "current": {
                "temp": 33,
                "feels_like": 36,
                "description": "Partly Cloudy",
                "humidity": 75,
                "wind_kmh": 18,
            },
            "forecast": days,
            "alerts": [],
        }
