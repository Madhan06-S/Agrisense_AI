import pytest
from app.credit.alternative_scorer import (
    compute_alternative_credit_score,
    get_allowed_scoring_features,
    assert_no_prohibited_features,
    PROHIBITED_FEATURES,
    FACTOR_SPECS,
)


def test_no_prohibited_features_in_scoring_inputs():
    """Asserts that scoring feature list contains no caste, religion, gender, or exact location."""
    allowed_features = get_allowed_scoring_features()

    for feat in allowed_features:
        feat_lower = feat.lower()
        for prohibited in PROHIBITED_FEATURES:
            assert prohibited not in feat_lower, f"Prohibited feature '{prohibited}' found in '{feat}'"

    # Test asserting prohibited feature rejection
    with pytest.raises(ValueError, match="Prohibited demographic/location feature detected"):
        assert_no_prohibited_features(["satellite_history", "gender", "caste"])

    with pytest.raises(ValueError, match="Prohibited demographic/location feature detected"):
        assert_no_prohibited_features(["satellite_history", "latitude", "longitude"])


def test_credit_score_weight_renormalization_partial_data():
    """Tests weight renormalization when 2 out of 7 factors are missing (biogas & carbon credits)."""
    raw_factors = {
        "satellite_history": 80.0,
        "claim_history": 100.0,
        "payment_history": 85.0,
        "scheme_usage": 90.0,
        "farm_productivity_trend": 75.0,
        "biogas_milk_records": None,
        "carbon_credits": None,
    }

    result = compute_alternative_credit_score(raw_factors)

    # Base weight sum of available factors = 0.25 + 0.15 + 0.15 + 0.10 + 0.15 = 0.80
    assert result["data_completeness"] == 0.80
    assert result["band"] == "Strong"
    assert result["score"] is not None

    # Verify renormalized weights sum to 1.0 among available factors
    available_factors = [f for f in result["factors"] if f["available"]]
    assert len(available_factors) == 5
    renormalized_sum = sum(f["renormalized_weight"] for f in available_factors)
    assert abs(renormalized_sum - 1.0) < 0.001

    # Verify individual renormalized weights: 0.25 / 0.80 = 0.3125
    sat_factor = next(f for f in available_factors if f["key"] == "satellite_history")
    assert sat_factor["renormalized_weight"] == 0.3125

    # Expected score calculation:
    # 80*0.3125 + 100*0.1875 + 85*0.1875 + 90*0.125 + 75*0.1875 = 25.0 + 18.75 + 15.9375 + 11.25 + 14.0625 = 85.0
    assert result["score"] == 85.0


def test_credit_score_insufficient_data_threshold():
    """Tests that if data_completeness < 0.4, band 'Not enough data' is returned with score = None."""
    # Only scheme_usage (0.10) and claim_history (0.15) available -> total = 0.25 < 0.40
    raw_factors = {
        "satellite_history": None,
        "claim_history": 90.0,
        "payment_history": None,
        "scheme_usage": 80.0,
        "farm_productivity_trend": None,
        "biogas_milk_records": None,
        "carbon_credits": None,
    }

    result = compute_alternative_credit_score(raw_factors)

    assert result["data_completeness"] == 0.25
    assert result["band"] == "Not enough data"
    assert result["score"] is None


def test_credit_score_band_boundaries():
    """Tests band assignment for Strong (80+), Good (60-79), Building (40-59), Needs support (<40)."""
    # 80+ -> Strong
    res_strong = compute_alternative_credit_score({
        "satellite_history": 85, "claim_history": 85, "payment_history": 85,
        "scheme_usage": 85, "farm_productivity_trend": 85, "biogas_milk_records": None, "carbon_credits": None
    })
    assert res_strong["band"] == "Strong"

    # 60-79 -> Good
    res_good = compute_alternative_credit_score({
        "satellite_history": 70, "claim_history": 70, "payment_history": 70,
        "scheme_usage": 70, "farm_productivity_trend": 70, "biogas_milk_records": None, "carbon_credits": None
    })
    assert res_good["band"] == "Good"

    # 40-59 -> Building
    res_building = compute_alternative_credit_score({
        "satellite_history": 50, "claim_history": 50, "payment_history": 50,
        "scheme_usage": 50, "farm_productivity_trend": 50, "biogas_milk_records": None, "carbon_credits": None
    })
    assert res_building["band"] == "Building"

    # <40 -> Needs support
    res_needs_support = compute_alternative_credit_score({
        "satellite_history": 30, "claim_history": 30, "payment_history": 30,
        "scheme_usage": 30, "farm_productivity_trend": 30, "biogas_milk_records": None, "carbon_credits": None
    })
    assert res_needs_support["band"] == "Needs support"
