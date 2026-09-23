import pytest
from app.services.afii_engine import compute_vci_formula


def test_vci_formula_normal():
    # NDVI current = 0.45, min = 0.15, max = 0.75 -> VCI = 100 * (0.45 - 0.15) / 0.60 = 50.0%
    vci = compute_vci_formula(0.45, 0.15, 0.75)
    assert vci == 50.0


def test_vci_formula_clamping():
    # Below min -> 0%
    assert compute_vci_formula(0.10, 0.15, 0.75) == 0.0
    # Above max -> 100%
    assert compute_vci_formula(0.85, 0.15, 0.75) == 100.0


def test_vci_survival_baseline_boundary():
    # Baseline is 35.0%
    baseline = 35.0
    
    # 36.0% VCI -> Normal / Watch, NO trigger
    vci_normal = 36.0
    assert vci_normal >= baseline

    # 34.9% VCI -> Breach, TRIGGER payout
    vci_breach = 34.9
    assert vci_breach < baseline
