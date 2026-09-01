import random

# Coordinates for mock farm boundaries around Hyderabad, Telangana
MOCK_COORDINATES = [
    # Boundary 1
    [[[78.47, 17.37], [78.475, 17.37], [78.475, 17.375], [78.47, 17.375], [78.47, 17.37]]],
    # Boundary 2
    [[[78.50, 17.40], [78.505, 17.40], [78.505, 17.405], [78.50, 17.405], [78.50, 17.40]]],
    # Boundary 3
    [[[78.42, 17.35], [78.428, 17.35], [78.428, 17.358], [78.42, 17.358], [78.42, 17.35]]],
]


def fetch_land_record(state: str, district: str, tehsil: str, khasra_number: str) -> dict:
    """
    Mock land records (Bhulekh API) lookup.
    Returns: GeoJSON boundary, owner_name, area_acres, source.
    """
    # Demo matching based on khasra numbers to simulate correct matching vs mismatching
    # Khasra "123" -> Ramesh Patel
    # Khasra "456" -> Sunita Devi
    # Khasra "999" -> Owner Name Mismatch (Trigger manual verification flow)
    
    if khasra_number == "123":
        owner_name = "Ramesh Patel"
        area = 2.45
        coords = MOCK_COORDINATES[0]
    elif khasra_number == "456":
        owner_name = "Sunita Devi"
        area = 1.82
        coords = MOCK_COORDINATES[1]
    elif khasra_number == "999":
        owner_name = "Rajesh Kumar Mismatch"
        area = 3.10
        coords = MOCK_COORDINATES[2]
    else:
        # Default fallback mock response
        owner_name = "Ramesh Patel"
        area = round(random.uniform(1.2, 4.5), 2)
        coords = MOCK_COORDINATES[random.randint(0, len(MOCK_COORDINATES) - 1)]

    return {
        "status": "success",
        "owner_name": owner_name,
        "area_acres": area,
        "area_hectares": round(area * 0.404686, 2),
        "source": f"{state.upper()}_Bhulekh",
        "khasra_number": khasra_number,
        "geojson": {
            "type": "Polygon",
            "coordinates": coords
        }
    }
