import json
import random
from locust import HttpUser, task, between

class AgriSenseLoadUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def register_farm(self):
        """Simulates concurrent farmers registering their fields."""
        payload = {
            "name": f"Farmer field {random.randint(100, 99999)}",
            "crop_type": random.choice(["Rice", "Wheat", "Sugarcane", "Paddy"]),
            "sowing_date": "2026-06-15",
            "insurance_policy_number": f"INS-{random.randint(100000, 999999)}",
            "khasra_number": f"K-{random.randint(100, 999)}",
            "state": "Punjab",
            "district": "Amritsar",
            "taluka": "Ajnala",
            "village": "Lopoke",
            "boundary": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [74.80, 31.60],
                        [74.82, 31.60],
                        [74.82, 31.62],
                        [74.80, 31.62],
                        [74.80, 31.60]
                    ]
                ]
            }
        }
        headers = {"Content-Type": "application/json"}
        with self.client.post("/api/v1/farms/", json=payload, headers=headers, catch_response=True) as response:
            if response.status_code == 201:
                response.success()
            else:
                response.failure(f"Farm registration failed: {response.text}")

    @task(2)
    def trigger_pipeline(self):
        """Simulates triggering satellite ingestion pipelines."""
        # Query a random farm ID (e.g. 1) to fetch satellite imagery
        farm_id = random.randint(1, 5)
        with self.client.post(
            f"/api/v1/satellite/fetch?farm_id={farm_id}&start_date=2026-06-01&end_date=2026-07-24",
            catch_response=True
        ) as response:
            if response.status_code in [202, 404]:
                response.success()
            else:
                response.failure(f"Pipeline fetch trigger failed: {response.text}")

    @task(5)
    def view_dashboard(self):
        """Simulates government officials viewing and refreshing the dashboard."""
        self.client.get("/api/v1/pipeline/status")
        self.client.get("/api/v1/pipeline/runs")
        self.client.get("/api/v1/pipeline/metrics")
        self.client.get("/api/v1/catalog/images?min_quality=60")
