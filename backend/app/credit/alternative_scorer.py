import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Factor specification — 4 factors as per problem statement
# Weights sum to 1.0
# ─────────────────────────────────────────────────────────────────────────────
FACTOR_SPECS: Dict[str, Dict[str, Any]] = {
    "satellite_productivity": {
        "key": "satellite_productivity",
        "name": "Satellite-verified productivity",
        "base_weight": 0.35,
        "default_reason": "Share of seasons where peak NDVI met crop baseline, including year-to-year consistency",
        "action": "Ensure irrigation and soil health to maintain NDVI above crop baseline across all seasons.",
    },
    "soil_health": {
        "key": "soil_health",
        "name": "Soil health trajectory",
        "base_weight": 0.30,
        "default_reason": "Trend of soil moisture and soil health indicators from satellite + sensor readings",
        "action": "Adopt regenerative practices (composting, cover crops) to improve soil health trend.",
    },
    "supply_chain": {
        "key": "supply_chain",
        "name": "Supply chain reliability",
        "base_weight": 0.25,
        "default_reason": "Delivered vs promised quantity, on-time rate, and buyer diversity from cooperative records",
        "action": "Register delivery records with a cooperative or FPC to build your supply chain score.",
    },
    "insurance_payment": {
        "key": "insurance_payment",
        "name": "Insurance & payment record",
        "base_weight": 0.10,
        "default_reason": "Claim history and repayment of settled amounts",
        "action": "Maintain clean claim filing and enroll in PMFBY / AFII continuously.",
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# Prohibited demographic / location features — never used in scoring
# ─────────────────────────────────────────────────────────────────────────────
PROHIBITED_FEATURES = frozenset({
    "caste", "religion", "gender", "sex", "exact_location",
    "coordinates", "latitude", "longitude", "address",
    "race", "ethnicity", "village", "pin_code", "pincode",
})


def get_allowed_scoring_features() -> List[str]:
    """Returns the strict list of features used for credit scoring."""
    return list(FACTOR_SPECS.keys())


def assert_no_prohibited_features(feature_names: List[str]) -> None:
    """
    Verifies that no prohibited demographic or location attributes
    appear in scoring inputs. Raises ValueError on violation.
    """
    for feat in feature_names:
        feat_lower = feat.lower()
        for prohibited in PROHIBITED_FEATURES:
            if prohibited in feat_lower:
                raise ValueError(
                    f"Prohibited demographic/location feature detected in scoring inputs: '{feat}'. "
                    "AgriSense credit scoring never uses caste, religion, gender, or exact location."
                )


def compute_alternative_credit_score(
    raw_factor_values: Dict[str, Optional[float]],
    custom_reasons: Optional[Dict[str, str]] = None,
    custom_actions: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Computes an explainable alternative credit score (0–100).

    Algorithm
    ---------
    1. Identify factors that have valid numeric data (non-None).
    2. data_completeness = sum(base_weights of available factors).
    3. If data_completeness < 0.4 → band = "Not enough data", score = None.
    4. Renormalize weights: w_i = base_w_i / data_completeness.
    5. score = Σ(value_i × w_i), rounded to 1 dp.

    Bands
    -----
    80+   → Strong
    60–79 → Good
    40–59 → Building
    <40   → Needs support
    """
    custom_reasons = custom_reasons or {}
    custom_actions = custom_actions or {}

    feature_keys = list(raw_factor_values.keys())
    assert_no_prohibited_features(feature_keys)

    available_factors: Dict[str, float] = {}
    available_weight_sum = 0.0

    for key, spec in FACTOR_SPECS.items():
        val = raw_factor_values.get(key)
        if val is not None and isinstance(val, (int, float)):
            clamped = max(0.0, min(100.0, float(val)))
            available_factors[key] = clamped
            available_weight_sum += spec["base_weight"]

    data_completeness = round(available_weight_sum, 3)

    # ── Not enough data ──────────────────────────────────────────────────────
    if data_completeness < 0.4:
        factors_output = _build_factors_output(
            available_factors, custom_reasons, data_completeness, available_weight_sum
        )
        return {
            "score": None,
            "band": "Not enough data",
            "data_completeness": data_completeness,
            "factors": factors_output,
            "improvements": [
                "Register crop delivery records with a cooperative or FPC.",
                "Enroll in PMFBY or AFII scheme to start building your insurance record.",
                "Submit additional farm records so satellite productivity can be computed.",
            ],
        }

    # ── Compute score ────────────────────────────────────────────────────────
    factors_output = []
    total_score = 0.0
    weakest: List[Tuple[str, float]] = []

    for key, spec in FACTOR_SPECS.items():
        is_present = key in available_factors
        if is_present:
            val = available_factors[key]
            renorm = round(spec["base_weight"] / available_weight_sum, 4)
            total_score += val * renorm
            weakest.append((key, val))
            factors_output.append({
                "key": key,
                "name": spec["name"],
                "value": round(val, 1),
                "base_weight": spec["base_weight"],
                "renormalized_weight": renorm,
                "available": True,
                "reason": custom_reasons.get(key, spec["default_reason"]),
                "action": custom_actions.get(key, spec["action"]),
            })
        else:
            factors_output.append({
                "key": key,
                "name": spec["name"],
                "value": None,
                "base_weight": spec["base_weight"],
                "renormalized_weight": 0.0,
                "available": False,
                "reason": custom_reasons.get(key, f"{spec['name']} data not yet available"),
                "action": custom_actions.get(key, spec["action"]),
            })

    final_score = round(total_score, 1)

    # Band
    if final_score >= 80.0:
        band = "Strong"
    elif final_score >= 60.0:
        band = "Good"
    elif final_score >= 40.0:
        band = "Building"
    else:
        band = "Needs support"

    # Improvements from weakest 3 available factors
    weakest.sort(key=lambda x: x[1])
    improvements = [
        FACTOR_SPECS[k]["action"]
        for k, _ in weakest[:3]
        if k in FACTOR_SPECS
    ] or [
        "Maintain continuous crop insurance enrollment.",
        "Log regular satellite health scans for your parcel.",
        "Register cooperative delivery records.",
    ]

    return {
        "score": final_score,
        "band": band,
        "data_completeness": data_completeness,
        "factors": factors_output,
        "improvements": improvements[:3],
    }


def _build_factors_output(
    available_factors: Dict[str, float],
    custom_reasons: Dict[str, str],
    data_completeness: float,
    available_weight_sum: float,
) -> List[Dict[str, Any]]:
    """Helper: build factors list for the Not-enough-data path."""
    output = []
    for key, spec in FACTOR_SPECS.items():
        is_present = key in available_factors
        renorm = (
            round(spec["base_weight"] / available_weight_sum, 4)
            if is_present and available_weight_sum > 0
            else 0.0
        )
        output.append({
            "key": key,
            "name": spec["name"],
            "value": available_factors.get(key),
            "base_weight": spec["base_weight"],
            "renormalized_weight": renorm,
            "available": is_present,
            "reason": custom_reasons.get(
                key,
                spec["default_reason"] if is_present else f"{spec['name']} data not yet available",
            ),
            "action": spec["action"],
        })
    return output
