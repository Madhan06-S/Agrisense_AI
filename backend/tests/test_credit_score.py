"""
Tests for alternative credit scorer — 4-factor schema.

Covers:
  - Prohibited feature enforcement (caste, religion, gender, location)
  - Weight renormalization over partial data
  - Not-enough-data threshold (completeness < 0.4)
  - Band assignment
  - Score computation
"""
import pytest
from app.credit.alternative_scorer import (
    compute_alternative_credit_score,
    assert_no_prohibited_features,
    get_allowed_scoring_features,
    FACTOR_SPECS,
    PROHIBITED_FEATURES,
)


# ─────────────────────────────────────────────────────────────────────────────
# Prohibited feature tests
# ─────────────────────────────────────────────────────────────────────────────
class TestProhibitedFeatures:
    """CRITICAL: Scoring must never use demographic or exact location features."""

    def test_allowed_features_exclude_prohibited_terms(self):
        """The allowed feature list must not contain any prohibited term."""
        allowed = get_allowed_scoring_features()
        for feat in allowed:
            feat_lower = feat.lower()
            for prohibited in PROHIBITED_FEATURES:
                assert prohibited not in feat_lower, (
                    f"Allowed feature '{feat}' contains prohibited term '{prohibited}'."
                )

    def test_allowed_features_do_not_include_caste(self):
        assert "caste" not in get_allowed_scoring_features()

    def test_allowed_features_do_not_include_religion(self):
        assert "religion" not in get_allowed_scoring_features()

    def test_allowed_features_do_not_include_gender(self):
        allowed_lower = [f.lower() for f in get_allowed_scoring_features()]
        assert not any("gender" in f or "sex" in f for f in allowed_lower)

    def test_allowed_features_do_not_include_exact_location(self):
        allowed_lower = [f.lower() for f in get_allowed_scoring_features()]
        assert not any(
            "latitude" in f or "longitude" in f or "coordinates" in f or "address" in f
            for f in allowed_lower
        )

    def test_assert_raises_on_caste_feature(self):
        with pytest.raises(ValueError, match="caste"):
            assert_no_prohibited_features(["caste_category", "satellite_productivity"])

    def test_assert_raises_on_gender_feature(self):
        with pytest.raises(ValueError, match="gender"):
            assert_no_prohibited_features(["gender_of_farmer"])

    def test_assert_raises_on_latitude_feature(self):
        with pytest.raises(ValueError, match="latitude"):
            assert_no_prohibited_features(["farm_latitude"])

    def test_assert_passes_on_clean_features(self):
        """Must not raise for the legitimate scoring feature keys."""
        assert_no_prohibited_features(list(FACTOR_SPECS.keys()))


# ─────────────────────────────────────────────────────────────────────────────
# Factor weights sum test
# ─────────────────────────────────────────────────────────────────────────────
class TestFactorWeights:
    def test_base_weights_sum_to_one(self):
        total = sum(spec["base_weight"] for spec in FACTOR_SPECS.values())
        assert abs(total - 1.0) < 1e-6, f"Base weights sum {total} != 1.0"

    def test_four_factors_defined(self):
        assert len(FACTOR_SPECS) == 4

    def test_factor_keys(self):
        assert set(FACTOR_SPECS.keys()) == {
            "satellite_productivity",
            "soil_health",
            "supply_chain",
            "insurance_payment",
        }


# ─────────────────────────────────────────────────────────────────────────────
# Scoring computation tests
# ─────────────────────────────────────────────────────────────────────────────
class TestCreditScoreComputation:

    def test_all_factors_present_strong_band(self):
        result = compute_alternative_credit_score({
            "satellite_productivity": 90.0,
            "soil_health": 85.0,
            "supply_chain": 88.0,
            "insurance_payment": 92.0,
        })
        assert result["score"] is not None
        assert result["score"] >= 80.0
        assert result["band"] == "Strong"
        assert result["data_completeness"] == pytest.approx(1.0)

    def test_all_factors_present_building_band(self):
        result = compute_alternative_credit_score({
            "satellite_productivity": 50.0,
            "soil_health": 45.0,
            "supply_chain": 40.0,
            "insurance_payment": 55.0,
        })
        assert result["score"] is not None
        assert 40.0 <= result["score"] < 60.0
        assert result["band"] == "Building"

    def test_all_factors_present_needs_support(self):
        result = compute_alternative_credit_score({
            "satellite_productivity": 25.0,
            "soil_health": 20.0,
            "supply_chain": 30.0,
            "insurance_payment": 35.0,
        })
        assert result["band"] == "Needs support"

    def test_missing_supply_chain_renormalizes(self):
        """When supply_chain is missing, weights should renormalize over 3 factors."""
        result = compute_alternative_credit_score({
            "satellite_productivity": 80.0,
            "soil_health": 80.0,
            "supply_chain": None,           # missing
            "insurance_payment": 80.0,
        })
        # Completeness = 0.35+0.30+0.10 = 0.75 (supply_chain 0.25 missing)
        assert result["data_completeness"] == pytest.approx(0.75)
        assert result["score"] == pytest.approx(80.0, abs=1.0)
        # Renormalized weights must sum to 1 over available factors
        available_factors = [f for f in result["factors"] if f["available"]]
        weight_sum = sum(f["renormalized_weight"] for f in available_factors)
        assert abs(weight_sum - 1.0) < 0.01

    def test_not_enough_data_below_0_4(self):
        """Only insurance_payment available (0.10) < 0.4 threshold → Not enough data."""
        result = compute_alternative_credit_score({
            "satellite_productivity": None,
            "soil_health": None,
            "supply_chain": None,
            "insurance_payment": 90.0,
        })
        assert result["score"] is None
        assert result["band"] == "Not enough data"
        assert result["data_completeness"] == pytest.approx(0.10)

    def test_satellite_and_soil_only_above_threshold(self):
        """satellite 0.35 + soil 0.30 = 0.65 ≥ 0.4 → computes a score."""
        result = compute_alternative_credit_score({
            "satellite_productivity": 70.0,
            "soil_health": 60.0,
            "supply_chain": None,
            "insurance_payment": None,
        })
        assert result["score"] is not None
        assert result["data_completeness"] == pytest.approx(0.65)

    def test_values_clamped_to_0_100(self):
        result = compute_alternative_credit_score({
            "satellite_productivity": 150.0,   # should clamp to 100
            "soil_health": -20.0,              # should clamp to 0
            "supply_chain": 80.0,
            "insurance_payment": 70.0,
        })
        sat_factor = next(f for f in result["factors"] if f["key"] == "satellite_productivity")
        soil_factor = next(f for f in result["factors"] if f["key"] == "soil_health")
        assert sat_factor["value"] == pytest.approx(100.0)
        assert soil_factor["value"] == pytest.approx(0.0)

    def test_improvements_list_not_empty_when_score_present(self):
        result = compute_alternative_credit_score({
            "satellite_productivity": 70.0,
            "soil_health": 65.0,
            "supply_chain": 50.0,
            "insurance_payment": 80.0,
        })
        assert isinstance(result["improvements"], list)
        assert len(result["improvements"]) >= 1

    def test_factors_output_has_all_four_keys(self):
        result = compute_alternative_credit_score({
            "satellite_productivity": 80.0,
            "soil_health": 75.0,
            "supply_chain": None,
            "insurance_payment": 90.0,
        })
        keys_in_result = {f["key"] for f in result["factors"]}
        assert keys_in_result == {
            "satellite_productivity", "soil_health",
            "supply_chain", "insurance_payment"
        }

    def test_unavailable_factor_has_zero_renormalized_weight(self):
        result = compute_alternative_credit_score({
            "satellite_productivity": 80.0,
            "soil_health": None,
            "supply_chain": None,
            "insurance_payment": 90.0,
        })
        for f in result["factors"]:
            if not f["available"]:
                assert f["renormalized_weight"] == 0.0
