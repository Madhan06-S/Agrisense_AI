import pytest
from app.credit.features import extract_credit_features
from app.credit.scorer import calculate_credit_score

def test_extract_credit_features():
    profile = {"crop_type": "Rice", "area_hectares": 3.0, "extra_metadata": {"years_farming": 12}}
    vectors = [[0.65] * 22, [0.55] * 22] # stable NDVI
    
    feats = extract_credit_features(profile, vectors)
    assert "stability" in feats
    assert "diversity" in feats
    assert "productivity" in feats
    assert "tenure" in feats
    assert feats["stability"] > 50.0
    assert feats["tenure"] == min(100.0, (12.0 / 15.0) * 100.0)

def test_calculate_credit_score():
    features = {
        "stability": 80.0,
        "diversity": 70.0,
        "size": 30.0,
        "productivity": 85.0,
        "resilience": 80.0,
        "payment_history": 95.0,
        "tenure": 60.0
    }
    
    # Evaluate score
    res = calculate_credit_score(features)
    assert 300 <= res["credit_score"] <= 900
    assert res["tier"] in ["Excellent", "Good", "Fair", "Building"]
    assert res["interest_rate_percent"] > 0
    assert res["max_loan_limit_inr"] > 0
    
    # SHAP sum checks (base 300 + sum of shap == score)
    shap_sum = 300.0 + sum(res["shap_breakdown"].values())
    assert abs(shap_sum - res["credit_score"]) <= 1.5 # minor rounding margins

def test_fairness_constraints():
    features = {
        "stability": 70.0,
        "diversity": 60.0,
        "size": 20.0,
        "productivity": 70.0,
        "resilience": 80.0,
        "payment_history": 90.0,
        "tenure": 50.0
    }
    
    # Passing demographics (caste, religion, gender) should pass fairness audit
    demog = {"gender": "Female", "religion": "Sikh", "caste": "General"}
    res = calculate_credit_score(features, demographics=demog)
    assert res["fairness_audit_passed"]
