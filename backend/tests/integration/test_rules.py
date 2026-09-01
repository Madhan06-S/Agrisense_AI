import pytest
from app.insurance.rules import RuleEngine

def test_rule_engine_loading():
    engine = RuleEngine()
    assert len(engine.rules) > 0
    assert any(r["name"] == "NDVI Drop Payout" for r in engine.rules)

def test_rule_evaluation_ndvi():
    engine = RuleEngine()
    features = {
        "ndvi_drop_percent": 45.0, # triggers NDVI drop (>40%)
        "flood_index": 0.2,
        "rainfall_anomaly": 0.0
    }
    
    # Rice is flood-sensitive, but not drought-sensitive
    res = engine.evaluate(
        features=features,
        sum_insured=100000.0,
        area_hectares=2.5,
        crop_type="Rice",
        season="Kharif"
    )
    
    assert res["payout_amount"] > 0
    assert len(res["triggered_rules"]) == 1
    assert res["triggered_rules"][0]["rule_name"] == "NDVI Drop Payout"
    
def test_rule_evaluation_flood():
    engine = RuleEngine()
    features = {
        "ndvi_drop_percent": 10.0,
        "flood_index": 0.85, # triggers flood payout (>0.8)
        "rainfall_anomaly": 0.0
    }
    
    # Sugarcane is flood sensitive. Factor is 1.1. Flood rule weight is boosted by 1.25 in Kharif.
    # payout = fixed_per_hectare (15000) * 2.5 (area) = 37500.
    # With adjustments: 37500 * 1.15 (flood sensitive) * 1.25 (Kharif season) * 1.1 (sugarcane factor) = 59343.75
    res = engine.evaluate(
        features=features,
        sum_insured=100000.0,
        area_hectares=2.5,
        crop_type="Sugarcane",
        season="Kharif"
    )
    
    assert res["payout_amount"] > 37500.0
    assert any(r["rule_name"] == "Flood Index Payout" for r in res["triggered_rules"])
