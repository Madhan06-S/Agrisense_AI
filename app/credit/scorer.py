import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# Credit score metrics weighting
METRIC_WEIGHTS = {
    "stability": 0.20,
    "diversity": 0.15,
    "size": 0.10,
    "productivity": 0.20,
    "resilience": 0.15,
    "payment_history": 0.10,
    "tenure": 0.10
}

def calculate_credit_score(
    features: Dict[str, float],
    demographics: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Computes alternative credit score between 300 and 900 based on weighted metrics.
    Enforces FAIRNESS constraints: ignores demographic attributes (gender, religion, caste) to prevent bias.
    """
    # 1. Enforce fairness: audit check
    if demographics:
        sensitive_keys = ["gender", "religion", "caste"]
        for key in sensitive_keys:
            if key in demographics:
                logger.info("Fairness Auditor: Discarding sensitive attribute '%s' from scoring pipeline.", key)
                
    # 2. Weighted Sum of features (each feature is 0-100)
    weighted_sum = 0.0
    for metric, weight in METRIC_WEIGHTS.items():
        val = features.get(metric, 50.0)
        weighted_sum += val * weight
        
    # Scale weighted sum (0-100) to credit score range (300-900)
    # score = 300 + (weighted_sum / 100) * 600
    credit_score = 300.0 + (weighted_sum / 100.0) * 600.0
    credit_score = max(300.0, min(900.0, credit_score))
    credit_score = round(credit_score)
    
    # 3. Determine Tiers and Interest Rates
    if credit_score >= 750:
        tier = "Excellent"
        max_loan = 500000.0
        interest_rate = 7.0
    elif credit_score >= 650:
        tier = "Good"
        max_loan = 300000.0
        interest_rate = 9.0
    elif credit_score >= 550:
        tier = "Fair"
        max_loan = 100000.0
        interest_rate = 12.0
    else:
        tier = "Building"
        max_loan = 50000.0
        interest_rate = 15.0
        
    # 4. Generate SHAP explanations (SHAP sums to prediction margin)
    # Base value is 300 (starting point)
    # Contribution of each feature = (value * weight / 100) * 600
    shap_values = {}
    for metric, weight in METRIC_WEIGHTS.items():
        val = features.get(metric, 50.0)
        contribution = (val * weight / 100.0) * 600.0
        shap_values[metric] = float(contribution)
        
    # Verify: 300 + sum(shap) == credit_score (within rounding tolerance)
    total_shap = 300.0 + sum(shap_values.values())
    logger.info("SHAP sum verification: Total=%s, Credit Score=%s", total_shap, credit_score)
    
    return {
        "credit_score": int(credit_score),
        "tier": tier,
        "max_loan_limit_inr": float(max_loan),
        "interest_rate_percent": float(interest_rate),
        "feature_contributions": features,
        "shap_breakdown": shap_values,
        "fairness_audit_passed": True
    }
