import os
import requests
from typing import Dict, Optional, Tuple
from datetime import datetime
from app.core.config import settings

OPENWEATHER_API_KEY = settings.OPENWEATHER_API_KEY or os.getenv("OPENWEATHER_API_KEY", "")

class WeatherServiceError(Exception):
    pass

def get_farm_weather(lat: float, lon: float) -> Dict:
    """
    Fetch real weather data from Open-Meteo API for a farm location (no API key required).
    Returns: {rainfall_48h, temperature, wind_speed, humidity, source, status}
    """
    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,relative_humidity_2m,wind_speed_10m"
            f"&past_days=2&hourly=precipitation"
        )
        res = requests.get(url, timeout=10)
        res.raise_for_status()
        data = res.json()
        print(f"[OPEN-METEO LIVE RESPONSE] lat={lat}, lon={lon} => {data.get('current')}")

        current = data.get("current", {})
        temp = current.get("temperature_2m", 30.0)
        humidity = current.get("relative_humidity_2m", 60)
        wind_speed = current.get("wind_speed_10m", 12.0)

        hourly_precip = data.get("hourly", {}).get("precipitation", [])
        rainfall_48h = sum(hourly_precip[-48:]) if hourly_precip else 0.0

        return {
            "rainfall_48h": round(rainfall_48h, 1),
            "temperature": round(temp, 1),
            "wind_speed": round(wind_speed, 1),
            "humidity": humidity,
            "source": "Open-Meteo API",
            "status": "live"
        }
    except Exception as e:
        print(f"Open-Meteo API error: {e}")
        return _fallback_weather(lat, lon)

def calculate_weather_score(weather: Dict, claim_type: str) -> int:
    """
    Calculate damage-relevant weather score (0-100) based on actual conditions.
    """
    rainfall = weather.get("rainfall_48h", 0)
    temp = weather.get("temperature", 30)
    
    claim_type = claim_type.lower()
    
    if claim_type == "flood":
        # More rain = more damage
        score = min(100, int(rainfall * 0.8))
    elif claim_type == "drought":
        # Less rain + high temp = more damage
        score = max(0, min(100, int(100 - rainfall * 2 + (temp - 35) * 3)))
    elif claim_type == "pest":
        # 25-35°C + moderate humidity = ideal pest conditions
        temp_factor = max(0, 20 - abs(temp - 30))  # Peak at 30°C
        humidity = weather.get("humidity", 50)
        score = min(100, int(temp_factor * 3 + humidity * 0.3))
    elif claim_type in ["cyclone", "hailstorm"]:
        # High wind + rain
        wind = weather.get("wind_speed", 0)
        score = min(100, int(wind * 1.5 + rainfall * 0.3))
    else:
        score = 50
    
    return max(0, min(100, score))

def _fallback_weather(lat: float, lon: float) -> Dict:
    """Realistic fallback weather based on Indian monsoon patterns."""
    # Simple lat-based approximation for demo
    if lat < 15:  # South India
        rainfall, temp, wind, humidity = 85, 29, 25, 80
    elif lat < 22:  # Central India
        rainfall, temp, wind, humidity = 45, 34, 35, 65
    else:  # North India
        rainfall, temp, wind, humidity = 30, 36, 20, 55
    
    return {
        "rainfall_48h": rainfall,
        "temperature": temp,
        "wind_speed": wind,
        "humidity": humidity,
        "source": "IMD Estimate (Fallback)",
        "status": "fallback"
    }
