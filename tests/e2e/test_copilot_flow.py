import pytest
from app.copilot.advisor import AgronomyAdvisor
from app.copilot.feedback import submit_feedback, log_advisory_adoption, get_prevention_metrics

def test_full_copilot_feedback_cycle():
    advisor = AgronomyAdvisor()
    profile = {"crop_type": "Wheat", "area_hectares": 1.5}
    vector = [0.60] * 22
    weather = {"precip_probability": 0.1}
    
    # 1. Generate Advice
    res = advisor.generate_advisory(profile, vector, weather, [])
    assert len(res["advisories"]) == 3
    
    # 2. Farmer rates advisory
    adv_id = "ADV-E2E-77"
    submit_feedback(adv_id, "thumbs_up", "Great advice for wheat!")
    log_advisory_adoption(adv_id, followed=True)
    
    # 3. Verify loop metrics
    metrics = get_prevention_metrics()
    assert metrics["total_advisories_rated"] >= 1
    assert metrics["adoption_rate"] > 0.0
    assert metrics["estimated_damage_prevented_inr"] >= 25000.0
