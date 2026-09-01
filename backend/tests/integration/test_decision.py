import pytest
from app.decision.engine import evaluate_routing_rules_pillar5, record_override, DECISION_AUDIT_TRAIL

def test_evaluate_routing_rules_pillar5():
    # 1. GREEN (Auto-Close): NDVI > 0.6 AND VCI > 60 AND anomaly >= -20 AND flood_index <= 0.8
    green = evaluate_routing_rules_pillar5(
        ndvi=0.72,
        vci=70.0,
        rainfall_anomaly=0.0,
        flood_index=0.1,
        moisture_drop=10.0,
        ndvi_drop_2w=15.0,
        num_cows=5
    )
    assert green["color"] == "GREEN"
    assert green["status"] == "CLAIM_CLOSED_NO_DAMAGE"
    assert green["payout_amount"] == 0.0
    
    # 2. RED (Instant Micro-Payout) - VCI < 40
    red1 = evaluate_routing_rules_pillar5(
        ndvi=0.55,
        vci=35.0,
        rainfall_anomaly=-10.0,
        flood_index=0.2,
        moisture_drop=15.0,
        ndvi_drop_2w=10.0,
        num_cows=5
    )
    assert red1["color"] == "RED"
    assert red1["status"] == "INSTANT_MICRO_PAYOUT"
    assert red1["payout_amount"] == 5 * 5000 * 1.2
    
    # 3. RED (Instant Micro-Payout) - Flood index > 0.8
    red2 = evaluate_routing_rules_pillar5(
        ndvi=0.62,
        vci=65.0,
        rainfall_anomaly=0.0,
        flood_index=0.85,
        moisture_drop=10.0,
        ndvi_drop_2w=15.0,
        num_cows=6
    )
    assert red2["color"] == "RED"
    assert red2["status"] == "INSTANT_MICRO_PAYOUT"
    assert red2["payout_amount"] == 6 * 5000 * 2.0
    
    # 4. RED (Instant Micro-Payout) - Moisture drop > 60%
    red3 = evaluate_routing_rules_pillar5(
        ndvi=0.65,
        vci=62.0,
        rainfall_anomaly=0.0,
        flood_index=0.1,
        moisture_drop=65.0,
        ndvi_drop_2w=5.0,
        num_cows=4
    )
    assert red3["color"] == "RED"
    assert red3["payout_amount"] == 4 * 5000 * 1.8

def test_record_override():
    claim_id = 999
    original = "RED"
    new = "GREEN"
    reason = "Verified pasture was healthy, false red trigger."
    
    record_override(claim_id, 15, original, new, reason)
    
    assert claim_id in DECISION_AUDIT_TRAIL
    entry = DECISION_AUDIT_TRAIL[claim_id][-1]
    assert entry["original_color"] == original
    assert entry["new_color"] == new
    assert entry["reason"] == reason
    assert entry["official_id"] == 15
