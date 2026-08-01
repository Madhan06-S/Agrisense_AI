import pytest
from app.copilot.advisor import AgronomyAdvisor
from app.copilot.delivery import register_fcm_token, dispatch_push_notification, dispatch_sms_alert
from app.copilot.feedback import submit_feedback, log_advisory_adoption, get_prevention_metrics

def test_advisor_heuristics():
    advisor = AgronomyAdvisor()
    profile = {"crop_type": "Rice", "area_hectares": 2.5}
    vector = [0.45] * 22 # Moderate NDVI and high moisture
    weather = {"precip_probability": 0.8}
    history = []
    
    res = advisor.generate_advisory(profile, vector, weather, history)
    assert "advisories" in res
    assert len(res["advisories"]) == 3
    # Verify both languages exist
    assert "english" in res["advisories"][0]
    assert "hindi" in res["advisories"][0]
    assert res["advisories"][0]["type"] in ["irrigation", "pest", "fertilizer"]

def test_delivery_dispatch():
    register_fcm_token(1234, "FCM-TOKEN-XYZ")
    assert dispatch_push_notification(1234, "Test Title", "Test Body")
    assert not dispatch_push_notification(9999, "Test Title", "Test Body") # non-existent token
    
    assert dispatch_sms_alert("+919999999999", "SMS alert")

def test_feedback_loop():
    from app.copilot.feedback import ADVISORY_FEEDBACK, ADOPTION_TRAJECTORY
    ADVISORY_FEEDBACK.clear()
    ADOPTION_TRAJECTORY.clear()
    adv_id = "ADV-992211"
    submit_feedback(adv_id, "thumbs_up", "Great advisor!")
    log_advisory_adoption(adv_id, followed=True)
    
    metrics = get_prevention_metrics()
    assert metrics["total_advisories_rated"] == 1
    assert metrics["satisfaction_rate"] == 1.0
    assert metrics["adoption_rate"] == 1.0
    assert metrics["estimated_damage_prevented_inr"] == 25000.0
