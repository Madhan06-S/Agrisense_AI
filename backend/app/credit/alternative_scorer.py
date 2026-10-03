import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Base factor specifications and weights (sum = 1.0)
FACTOR_SPECS: Dict[str, Dict[str, Any]] = {
    "satellite_history": {
        "key": "satellite_history",
        "name": "Satellite History",
        "base_weight": 0.25,
        "default_reason": "3 of last 4 seasons maintained satellite NDVI above crop baseline",
        "action": "Maintain optimal crop vigor across all crop seasons to raise NDVI baseline consistency.",
    },
    "claim_history": {
        "key": "claim_history",
        "name": "Claim History",
        "base_weight": 0.15,
        "default_reason": "Genuine claim filings with zero rejected or fraudulent submissions",
        "action": "Ensure accurate claim reporting with immediate geo-tagged damage evidence.",
    },
    "payment_history": {
        "key": "payment_history",
        "name": "Payment History",
        "base_weight": 0.15,
        "default_reason": "Verified DBT and UPI direct settlement record",
        "action": "Link active bank account for automated DBT and UPI premium/payout settlements.",
    },
    "scheme_usage": {
        "key": "scheme_usage",
        "name": "Scheme Usage",
        "base_weight": 0.10,
        "default_reason": "Continuous PMFBY & AFII scheme enrollment over 2+ consecutive years",
        "action": "Enroll in multi-season PMFBY crop insurance and AFII forage coverage.",
    },
    "farm_productivity_trend": {
        "key": "farm_productivity_trend",
        "name": "Farm Productivity Trend",
        "base_weight": 0.15,
        "default_reason": "Positive biomass growth trend and consistent multi-year yields",
        "action": "Adopt regenerative soil practices to enhance long-term farm productivity.",
    },
    "biogas_milk_records": {
        "key": "biogas_milk_records",
        "name": "Biogas & Milk Records",
        "base_weight": 0.10,
        "default_reason": "Biogas or dairy yield records pending integration",
        "action": "Connect dairy cooperative milk records once digital registry goes live.",
    },
    "carbon_credits": {
        "key": "carbon_credits",
        "name": "Carbon Credits Earned",
        "base_weight": 0.10,
        "default_reason": "Carbon credit registry data not yet available",
        "action": "Register sustainable farming practices for upcoming carbon credit verification.",
    },
}

PROHIBITED_FEATURES = {
    "caste", "religion", "gender", "sex", "exact_location",
    "coordinates", "latitude", "longitude", "address", "race", "ethnicity"
}

def get_allowed_scoring_features() -> List[str]:
    """Returns the strict list of features used for credit scoring."""
    return list(FACTOR_SPECS.keys())

def assert_no_prohibited_features(feature_names: List[str]) -> None:
    """Verifies that no prohibited demographic or location attributes exist in scoring inputs."""
    for feat in feature_names:
        feat_lower = feat.lower()
        for prohibited in PROHIBITED_FEATURES:
            if prohibited in feat_lower:
                raise ValueError(f"Prohibited demographic/location feature detected: {feat}")

def compute_alternative_credit_score(
    raw_factor_values: Dict[str, Optional[float]],
    custom_reasons: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Computes an explainable alternative credit score (0-100) for a farmer.

    Renormalization algorithm:
    1. Identify factors that have valid numeric data (non-None).
    2. Sum base weights of available factors -> data_completeness (0-1).
    3. If data_completeness < 0.4: return band "Not enough data" and score = None.
    4. Otherwise, renormalize weights: weight_i = base_weight_i / sum(available_base_weights).
    5. Score = sum(value_i * weight_i), rounded to 1 decimal place.
    6. Band assignment:
       - 80+: "Strong"
       - 60-79: "Good"
       - 40-59: "Building"
       - <40: "Needs support"
    """
    custom_reasons = custom_reasons or {}
    feature_keys = list(raw_factor_values.keys())
    assert_no_prohibited_features(feature_keys)

    available_factors = {}
    available_weight_sum = 0.0

    for key, spec in FACTOR_SPECS.items():
        val = raw_factor_values.get(key)
        if val is not None and isinstance(val, (int, float)):
            clamped_val = max(0.0, min(100.0, float(val)))
            available_factors[key] = clamped_val
            available_weight_sum += spec["base_weight"]

    data_completeness = round(available_weight_sum, 2)

    # Check minimum completeness threshold
    if data_completeness < 0.4:
        # Build factors response with missing status
        factors_output = []
        for key, spec in FACTOR_SPECS.items():
            is_present = key in available_factors
            factors_output.append({
                "key": key,
                "name": spec["name"],
                "value": available_factors.get(key),
                "base_weight": spec["base_weight"],
                "renormalized_weight": 0.0,
                "available": is_present,
                "reason": custom_reasons.get(key, spec["default_reason"] if is_present else f"{spec['name']} unavailable"),
            })

        return {
            "score": None,
            "band": "Not enough data",
            "data_completeness": data_completeness,
            "factors": factors_output,
            "improvements": [
                "Submit additional farm records and enroll in PMFBY to unlock your credit score."
            ]
        }

    # Renormalize weights over available factors
    factors_output = []
    total_score = 0.0
    weakest_factors: List[Tuple[str, float]] = []

    for key, spec in FACTOR_SPECS.items():
        is_present = key in available_factors
        if is_present:
            val = available_factors[key]
            renormalized_weight = round(spec["base_weight"] / available_weight_sum, 4)
            weighted_val = val * renormalized_weight
            total_score += weighted_val
            weakest_factors.append((key, val))

            factors_output.append({
                "key": key,
                "name": spec["name"],
                "value": round(val, 1),
                "base_weight": spec["base_weight"],
                "renormalized_weight": round(renormalized_weight, 4),
                "available": True,
                "reason": custom_reasons.get(key, spec["default_reason"]),
            })
        else:
            factors_output.append({
                "key": key,
                "name": spec["name"],
                "value": None,
                "base_weight": spec["base_weight"],
                "renormalized_weight": 0.0,
                "available": False,
                "reason": custom_reasons.get(key, f"{spec['name']} data pending integration"),
            })

    final_score = round(total_score, 1)

    # Determine band
    if final_score >= 80.0:
        band = "Strong"
    elif final_score >= 60.0:
        band = "Good"
    elif final_score >= 40.0:
        band = "Building"
    else:
        band = "Needs support"

    # Derive 2-3 concrete actions from weakest available factors
    weakest_factors.sort(key=lambda x: x[1])
    improvements = []
    for key, _val in weakest_factors[:3]:
        if key in FACTOR_SPECS and FACTOR_SPECS[key].get("action"):
            improvements.append(FACTOR_SPECS[key]["action"])

    if not improvements:
        improvements = [
            "Maintain continuous crop insurance enrollment.",
            "Log regular satellite health scans for your parcel.",
            "Complete DBT bank account verification."
        ]

    return {
        "score": final_score,
        "band": band,
        "data_completeness": data_completeness,
        "factors": factors_output,
        "improvements": improvements[:3]
    }
