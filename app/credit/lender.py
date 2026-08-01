import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# Mock lender portfolio storage
LENDER_PORTFOLIO = {
    "total_funds_disbursed": 4500000.0,
    "active_loans": 35,
    "average_interest_rate": 8.7,
    "default_rate_percent": 0.35, # Alternative satellite score yields ultra low defaults
    "geographic_distribution": [
        {"district": "Punjab - Amritsar", "loans_issued": 18, "amount": 2500000.0},
        {"district": "Punjab - Bhatinda", "loans_issued": 12, "amount": 1500000.0},
        {"district": "Haryana - Karnal", "loans_issued": 5, "amount": 500000.0}
    ]
}

def get_lender_portfolio_data() -> Dict[str, Any]:
    """Retrieves lender portfolio statistics."""
    logger.info("Retrieving lender credit portfolio insights.")
    return LENDER_PORTFOLIO
