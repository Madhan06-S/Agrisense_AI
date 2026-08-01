import pytest
import os
import numpy as np
from app.ml.xgboost.train import generate_synthetic_data, train_xgboost_model, MODEL_PATH
from app.ml.xgboost.inference import predict_single, predict_batch, load_model

def test_synthetic_data():
    X, y = generate_synthetic_data(100)
    assert X.shape == (100, 22)
    assert len(y) == 100
    # Check that it contains all three classes
    assert len(np.unique(y)) <= 3

def test_model_training_and_inference():
    # Remove existing model if any to test training from scratch
    if os.path.exists(MODEL_PATH):
        try:
            os.remove(MODEL_PATH)
        except Exception:
            pass
            
    X, y = generate_synthetic_data(50)
    # Ensure all classes are represented to prevent stratified split crash
    y[0] = 0
    y[1] = 1
    y[2] = 2
    
    meta = train_xgboost_model(X, y, version="test-v1")
    assert os.path.exists(MODEL_PATH)
    assert meta["model_version"] == "test-v1"
    
    # Reload model
    load_model()
    
    # Test single prediction
    sample_vec = list(X[0])
    res = predict_single(sample_vec)
    assert "damage_probability" in res
    assert "damage_class" in res
    assert res["damage_class"] in ["no_damage", "moderate_damage", "severe_damage"]
    assert "confidence" in res
    assert res["model_version"] == "test-v1"
    
    # Test batch prediction
    batch_vecs = [list(X[0]), list(X[1])]
    batch_res = predict_batch(batch_vecs)
    assert len(batch_res) == 2
    assert batch_res[0]["model_version"] == "test-v1"
