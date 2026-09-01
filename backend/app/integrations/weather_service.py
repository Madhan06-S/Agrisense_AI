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
    Fetch real weather data from OpenWeatherMap for a farm location.
    Returns: {rainfall_48h, temperature, wind_speed, humidity, weather_score, source}
    """
    if not OPENWEATHER_API_KEY:
        # Fallback to realistic mock if no API key
        return _fallback_weather(lat, lon)
    
    try:
        # 1. Current weather
        current_url = (
            f"https://api.openweathermap.org/data/2.5/weather"
            f"?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"
        )
        current_res = requests.get(current_url, timeout=10)
        current_res.raise_for_status()
        current = current_res.json()
        
        temp = current.get("main", {}).get("temp", 30)
        humidity = current.get("main", {}).get("humidity", 60)
        wind_speed = current.get("wind", {}).get("speed", 10) * 3.6  # m/s to km/h
        
        # 2. 5-day forecast for 48h rainfall accumulation
        forecast_url = (
            f"https://api.openweathermap.org/data/2.5/forecast"
            f"?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"
        )
        forecast_res = requests.get(forecast_url, timeout=10)
        forecast_res.raise_for_status()
        forecast = forecast_res.json()
        
        # Sum rainfall from first 16 intervals (48 hours = 16 × 3-hour blocks)
        rainfall_48h = 0.0
        intervals = forecast.get("list", [])[:16]
        for interval in intervals:
            rain = interval.get("rain", {}).get("3h", 0)
            rainfall_48h += rain
        
        return {
            "rainfall_48h": round(rainfall_48h, 1),
            "temperature": round(temp, 1),
            "wind_speed": round(wind_speed, 1),
            "humidity": humidity,
            "source": "OpenWeatherMap",
            "status": "live"
        }
        
    except Exception as e:
        print(f"Weather API error: {e}")
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
