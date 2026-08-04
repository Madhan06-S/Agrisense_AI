import random
from datetime import date


def get_rainfall_history(district: str, start_date: date, end_date: date) -> float:
    """Mock IMD API returning total rainfall in mm over period."""
    # Pre-coded demo scenarios
    if district.lower() == "mumbai" or district.lower() == "warangal":
        return 350.0 # Flood trigger (350mm)
    return random.uniform(5.0, 45.0)


def get_temperature_history(district: str, start_date: date, end_date: date) -> float:
    """Mock IMD API returning maximum temp recorded."""
    if district.lower() == "khammam" or district.lower() == "marathwada":
        return 43.5 # Drought trigger (>40C)
    return random.uniform(28.0, 38.0)


def get_wind_speed_history(district: str, start_date: date, end_date: date) -> float:
    """Mock IMD API returning max wind speed in km/h."""
    if district.lower() == "puri":
        return 145.0 # Cyclone trigger (>80km/h)
    return random.uniform(10.0, 35.0)


def get_drought_index(district: str) -> float:
    """Mock IMD Standardized Precipitation Index (SPI). Less than -1.5 is severe drought."""
    if district.lower() == "marathwada":
        return -2.1 # Severe drought index
    return random.uniform(-0.8, 1.2)
