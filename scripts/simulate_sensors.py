#!/usr/bin/env python3
import argparse
import requests

API_URL = "http://localhost:8000/api/v1/sensors/readings"
DEFAULT_API_KEY = "agrisense-sensor-key-2026"


def simulate(farm_id: int, scenario: str, url: str):
    if scenario == "drought":
        payload = {
            "farm_id": farm_id,
            "soil_moisture": 12.5,  # % severely dry
            "air_temp": 41.2,       # °C high heat stress
            "rainfall_mm": 0.0,     # mm no rain
            "device_id": f"SENSOR-DROUGHT-{farm_id}"
        }
    elif scenario == "flood":
        payload = {
            "farm_id": farm_id,
            "soil_moisture": 94.8,  # % saturated standing water
            "air_temp": 23.5,       # °C
            "rainfall_mm": 135.0,   # mm heavy rainfall
            "device_id": f"SENSOR-FLOOD-{farm_id}"
        }
    else:  # normal
        payload = {
            "farm_id": farm_id,
            "soil_moisture": 45.0,  # % normal
            "air_temp": 28.0,       # °C
            "rainfall_mm": 5.0,     # mm
            "device_id": f"SENSOR-NORMAL-{farm_id}"
        }

    headers = {
        "X-Device-API-Key": DEFAULT_API_KEY,
        "Content-Type": "application/json"
    }

    print(f"Sending sensor payload for farm {farm_id} scenario '{scenario}' to {url}:")
    print(payload)
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=5)
        print("Response:", response.status_code, response.json())
    except Exception as e:
        print("Failed to send sensor reading:", e)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Simulate ground sensor readings for AgriSense AI")
    parser.add_argument("--farm-id", type=int, default=1, help="Target Farm ID")
    parser.add_argument("--scenario", type=str, choices=["drought", "flood", "normal"], default="drought", help="Simulation scenario")
    parser.add_argument("--url", type=str, default=API_URL, help="API Endpoint URL")
    args = parser.parse_args()

    simulate(args.farm_id, args.scenario, args.url)
