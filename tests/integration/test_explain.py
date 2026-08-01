import pytest
from app.ml.explain.shap_engine import explain_local, explain_contrastive
from app.ml.explain.nlp_summary import generate_nlp_explanations

def test_explain_local():
    # 22-dimensional feature vector
    vector = [0.5] * 22
    res = explain_local(vector)
    
    assert "base_value" in res
    assert "prediction_value" in res
    assert "shap_values" in res
    assert len(res["shap_values"]) == 22
    assert "waterfall" in res
    assert len(res["waterfall"]) == 22
    
def test_explain_contrastive():
    vector = [0.15] * 22 # Low values (severe damage)
    res = explain_contrastive(vector, target_class="no_damage")
    
    assert "current_vector" in res
    assert res["target_class"] == "no_damage"
    assert "requirements" in res
    assert len(res["requirements"]) > 0
    assert any(r["feature"] == "ndvi" for r in res["requirements"])

def test_nlp_summary():
    shap_values = {"ndvi": 0.28, "precip": 0.15, "soil_moisture": 0.12}
    # fill other features
    from app.features.fusion import FEATURE_NAMES
    for name in FEATURE_NAMES:
        if name not in shap_values:
            shap_values[name] = 0.01
            
    vector = [0.5] * 22
    
    res = generate_nlp_explanations("moderate_damage", shap_values, vector)
    assert "english" in res
    assert "hindi" in res
    assert "MODERATE DAMAGE" in res["english"]
    assert "मध्यम नुकसान" in res["hindi"]
    assert "NDVI" in res["english"]
    assert "एनडीवीआई" in res["hindi"]
