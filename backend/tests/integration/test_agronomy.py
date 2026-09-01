import pytest
from app.agronomy.prevention import evaluate_prevention_warnings
from app.agronomy.education import get_educational_materials
from app.agronomy.trust import generate_trust_explanation

def test_prevention_warnings():
    # 1. Normal state
    warn = evaluate_prevention_warnings([75.0], 0.1)
    assert warn is None
    
    # 2. Pasture rotation trigger (VCI in 40-60 range)
    warn = evaluate_prevention_warnings([52.0], 0.1)
    assert warn is not None
    assert warn["type"] == "pasture_rotation"
    assert "eastern pasture" in warn["english"]
    
    # 3. Flood alert trigger
    warn = evaluate_prevention_warnings([75.0], 0.7)
    assert warn is not None
    assert warn["type"] == "flood_alert"
    
    # 4. Drought stress alert (VCI < 40)
    warn = evaluate_prevention_warnings([35.0], 0.1)
    assert warn is not None
    assert warn["type"] == "drought_alert"

def test_education_materials():
    materials = get_educational_materials("flood_preparedness")
    assert materials["topic"] == "Flood Preparedness for Pastures"
    assert "sms" in materials["formats"]
    assert "voice_hindi" in materials["formats"]
    assert "tutorial_3d" in materials["formats"]
    
    with pytest.raises(ValueError):
        get_educational_materials("unknown_topic")

def test_trust_explanations():
    stats = {"baseline_ndvi": 0.72, "current_ndvi": 0.31, "change_percent": -56.9}
    expl = generate_trust_explanation(
        1234,
        "RED",
        ["ndvi_drop_percent > 50"],
        stats
    )
    assert expl["farm_id"] == 1234
    assert expl["digital_trust_status"] == "VERIFIED"
    assert expl["evidence_trail"]["satellite_images_analyzed"] == 47
    assert expl["evidence_trail"]["metrics_comparison"]["change_percentage"] == -56.9
