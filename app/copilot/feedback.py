import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# Feedback ratings database
ADVISORY_FEEDBACK: Dict[str, Dict[str, Any]] = {}
ADOPTION_TRAJECTORY: Dict[str, bool] = {}

def submit_feedback(advisory_id: str, rating: str, comment: str = "") -> None:
    """Logs farmer ratings (thumbs_up or thumbs_down)."""
    if rating not in ["thumbs_up", "thumbs_down"]:
        raise ValueError("Rating must be thumbs_up or thumbs_down")
        
    ADVISORY_FEEDBACK[advisory_id] = {
        "rating": rating,
        "comment": comment
    }
    logger.info("Feedback received for advisory %s: %s", advisory_id, rating)

def log_advisory_adoption(advisory_id: str, followed: bool) -> None:
    """Tracks if the farmer followed the recommendation."""
    ADOPTION_TRAJECTORY[advisory_id] = followed
    logger.info("Adoption log written for advisory %s: followed=%s", advisory_id, followed)

def get_prevention_metrics() -> Dict[str, Any]:
    """Calculates adoption rates and successful damage prevention stats."""
    total_ratings = len(ADVISORY_FEEDBACK)
    upvotes = sum(1 for r in ADVISORY_FEEDBACK.values() if r["rating"] == "thumbs_up")
    
    total_tracked = len(ADOPTION_TRAJECTORY)
    followed_count = sum(1 for f in ADOPTION_TRAJECTORY.values() if f)
    
    adoption_rate = followed_count / total_tracked if total_tracked > 0 else 0.0
    satisfaction_rate = upvotes / total_ratings if total_ratings > 0 else 0.0
    
    return {
        "total_advisories_rated": total_ratings,
        "satisfaction_rate": float(satisfaction_rate),
        "adoption_rate": float(adoption_rate),
        "estimated_damage_prevented_inr": followed_count * 25000.0 # assume ₹25k saved per action
    }
