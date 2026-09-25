import pytest
from app.decision.engine import evaluate_traffic_light, TrafficLight


@pytest.mark.asyncio
async def test_traffic_light_xgboost_probability_red_boundary():
    # p_severe = 0.60 exactly -> RED
    res_60 = await evaluate_traffic_light(
        claim_id=999,
        db=None,
        model_probs={"p_no_damage": 0.10, "p_moderate": 0.30, "p_severe": 0.60},
        model_available=True
    )
    assert res_60["light"] == TrafficLight.RED.value
    assert res_60["basis"] == "xgboost_probs"
    assert res_60["p_severe"] == 0.60

    # p_severe = 0.59 -> YELLOW
    res_59 = await evaluate_traffic_light(
        claim_id=999,
        db=None,
        model_probs={"p_no_damage": 0.10, "p_moderate": 0.31, "p_severe": 0.59},
        model_available=True
    )
    assert res_59["light"] == TrafficLight.YELLOW.value
    assert res_59["basis"] == "xgboost_probs"
    assert res_59["p_severe"] == 0.59


@pytest.mark.asyncio
async def test_traffic_light_xgboost_probability_green_boundary():
    # GREEN: p_severe < 0.15 AND p_moderate < 0.35
    res_green = await evaluate_traffic_light(
        claim_id=999,
        db=None,
        model_probs={"p_no_damage": 0.80, "p_moderate": 0.10, "p_severe": 0.10},
        model_available=True
    )
    assert res_green["light"] == TrafficLight.GREEN.value
    assert res_green["basis"] == "xgboost_probs"

    # p_moderate >= 0.35 -> YELLOW
    res_yellow = await evaluate_traffic_light(
        claim_id=999,
        db=None,
        model_probs={"p_no_damage": 0.55, "p_moderate": 0.35, "p_severe": 0.10},
        model_available=True
    )
    assert res_yellow["light"] == TrafficLight.YELLOW.value


@pytest.mark.asyncio
async def test_traffic_light_fallback_when_model_missing():
    # Model missing / unavailable -> fallback to combined score
    res_fallback = await evaluate_traffic_light(
        claim_id=999,
        db=None,
        model_probs=None,
        model_available=False
    )
    assert res_fallback["basis"] == "score_fallback"
    assert "p_no_damage" in res_fallback
    assert "p_moderate" in res_fallback
    assert "p_severe" in res_fallback
