import re
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Basic Aadhaar 12-digit number format
AADHAAR_REGEX = re.compile(r"^\d{12}$")

# Mock registry database mapping Aadhaar to PM-KISAN ID and active DBT status
BENEFICIARY_REGISTRY = {
    "123456789012": {"pm_kisan_id": "PMK-983421", "name": "Ramesh Patel", "status": "ACTIVE"},
    "987654321098": {"pm_kisan_id": "PMK-123984", "name": "Suresh Kumar", "status": "ACTIVE"},
    "555544443333": {"pm_kisan_id": "PMK-449832", "name": "Rajesh Singh", "status": "ACTIVE"},
    "111122223333": {"pm_kisan_id": "PMK-009832", "name": "Madhan G", "status": "ACTIVE"}
}

def validate_aadhaar(aadhaar: str) -> bool:
    """Checks if Aadhaar matches standard format."""
    return bool(AADHAAR_REGEX.match(aadhaar))

def verify_pm_kisan_dbt(aadhaar: str) -> Dict[str, Any]:
    """
    Checks the status of the farmer's DBT registration against the PM-KISAN database.
    """
    if not validate_aadhaar(aadhaar):
        logger.warning("Aadhaar validation failed for input: %s", aadhaar)
        return {
            "verified": False,
            "error": "INVALID_AADHAAR",
            "pm_kisan_id": None,
            "status": "UNVERIFIED"
        }
        
    beneficiary = BENEFICIARY_REGISTRY.get(aadhaar)
    
    if beneficiary:
        logger.info("Aadhaar %s verified in PM-KISAN beneficiary database.", aadhaar[:4] + "********")
        return {
            "verified": True,
            "error": None,
            "pm_kisan_id": beneficiary["pm_kisan_id"],
            "status": beneficiary["status"]
        }
    else:
        logger.warning("Aadhaar %s not found in PM-KISAN registry.", aadhaar[:4] + "********")
        return {
            "verified": False,
            "error": "BENEFICIARY_NOT_FOUND",
            "pm_kisan_id": None,
            "status": "NOT_REGISTERED"
        }
