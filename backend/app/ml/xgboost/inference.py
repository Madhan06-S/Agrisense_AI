import os
import time
import json
import logging
import numpy as np
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# Paths
MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(MODEL_DIR, "model.json")
META_PATH = os.path.join(MODEL_DIR, "model_meta.json")

# Import wrapper for XGBoost
try:
    import xgboost as xgb
    HAS_XGB = True
except Exception as e:
    logger.warning("XGBoost library failed to load (libomp missing?): %s. Fallback predict_single is active.", e)
    HAS_XGB = False

# Cache
PREDICTION_CACHE: Dict[str, Dict[str, Any]] = {}
_MODEL = None
_METADATA = None

def load_model():
    global _MODEL, _METADATA
    if _MODEL is not None:
        return _MODEL, _METADATA
        
    if HAS_XGB and os.path.exists(MODEL_PATH):
        try:
            # Check if model is mock (written when C-library was absent during training)
            with open(MODEL_PATH, "r") as f:
                content = f.read(50)
                if "mock" in content:
                    logger.info("Found mock training sentinel in model.json. Using mock prediction.")
                    _MODEL = None
                else:
                    bst = xgb.Booster()
                    bst.load_model(MODEL_PATH)
                    _MODEL = bst
                    logger.info("XGBoost model loaded successfully from %s", MODEL_PATH)
            
            if os.path.exists(META_PATH):
                with open(META_PATH, "r") as f:
                    _METADATA = json.load(f)
            else:
                _METADATA = {"model_version": "1.0.0", "feature_importance": {}}
        except Exception as e:
            logger.error("Failed to load XGBoost model booster: %s. Falling back to mock prediction.", e)
            _MODEL = None
            _METADATA = {"model_version": "mock-dev", "feature_importance": {}}
    else:
        logger.warning("XGBoost model file not found or package failed to import. Mock model will be used.")
        _MODEL = None
        
        # Load meta if present to preserve version tag
        if os.path.exists(META_PATH):
            try:
                with open(META_PATH, "r") as f:
                    _METADATA = json.load(f)
            except Exception:
                _METADATA = {"model_version": "mock-dev", "feature_importance": {}}
        else:
            _METADATA = {"model_version": "mock-dev", "feature_importance": {}}
        
    return _MODEL, _METADATA

def get_mock_prediction(vector: np.ndarray) -> Dict[str, Any]:
    """
    Mock heuristic model for development:
    - NDVI (idx 0) < 0.2 -> severe_damage (prob 0.9)
    - NDVI 0.2-0.4 -> moderate_damage (prob 0.7)
    - NDVI > 0.4 -> no_damage (prob 0.95)
    """
    # Vector length 22
    ndvi = float(vector[0])
    
    if ndvi < 0.2:
        prob_severe = 0.90
        prob_mod = 0.08
        prob_no = 0.02
        damage_class = "severe_damage"
        confidence = prob_severe
    elif ndvi <= 0.40:
        prob_severe = 0.15
        prob_mod = 0.70
        prob_no = 0.15
        damage_class = "moderate_damage"
        confidence = prob_mod
    else:
        prob_severe = 0.01
        prob_mod = 0.04
        prob_no = 0.95
        damage_class = "no_damage"
        confidence = prob_no
        
    probs = [prob_no, prob_mod, prob_severe]
    
    # Global feature importance mocks
    from app.features.fusion import FEATURE_NAMES
    mock_importance = {}
    for name in FEATURE_NAMES:
        if name == "ndvi":
            mock_importance[name] = 0.45
        elif name == "precip":
            mock_importance[name] = 0.25
        elif name == "soil_moisture":
            mock_importance[name] = 0.15
        else:
            mock_importance[name] = 0.15 / 19
            
    return {
        "damage_probability": float(prob_mod + prob_severe),
        "damage_probabilities": probs,
        "damage_class": damage_class,
        "confidence": float(confidence),
        "feature_importance": mock_importance,
        "model_version": "mock-dev",
        "inference_time_ms": 0.5
    }

def predict_single(vector_list: List[float], farm_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Runs classification inference for a single 22-dimensional feature vector.
    """
    start_time = time.time()
    
    # Cache hit check
    if farm_id is not None:
        cache_key = f"predict:{farm_id}"
        if cache_key in PREDICTION_CACHE:
            cached_res = PREDICTION_CACHE[cache_key]
            if time.time() - cached_res["_timestamp"] < 3600:
                res = cached_res.copy()
                del res["_timestamp"]
                return res

    vec = np.array(vector_list, dtype=np.float32)
    if len(vec) != 22:
        raise ValueError(f"Feature vector must have exactly 22 dimensions, got {len(vec)}")
        
    model, meta = load_model()
    
    if model is None:
        # Mock fallback
        res = get_mock_prediction(vec)
        # Use version from metadata if available
        res["model_version"] = meta.get("model_version", "mock-dev")
    else:
        # Prepare DMatrix
        dmat = xgb.DMatrix(vec.reshape(1, 22))
        preds = model.predict(dmat)[0]
        
        classes = ["no_damage", "moderate_damage", "severe_damage"]
        class_idx = int(np.argmax(preds))
        damage_class = classes[class_idx]
        confidence = float(preds[class_idx])
        
        damage_prob = float(preds[1] + preds[2])
        
        importance = {}
        for name, scores in meta.get("feature_importance", {}).items():
            importance[name] = scores.get("gain", 0.0)
            
        res = {
            "damage_probability": damage_prob,
            "damage_probabilities": [float(x) for x in preds],
            "damage_class": damage_class,
            "confidence": confidence,
            "feature_importance": importance,
            "model_version": meta.get("model_version", "1.0.0"),
            "inference_time_ms": float((time.time() - start_time) * 1000)
        }
        
    if farm_id is not None:
        cache_key = f"predict:{farm_id}"
        cache_val = res.copy()
        cache_val["_timestamp"] = time.time()
        PREDICTION_CACHE[cache_key] = cache_val
        
    return res

def predict_batch(vectors: List[List[float]], farm_ids: Optional[List[int]] = None) -> List[Dict[str, Any]]:
    results = []
    for idx, vec in enumerate(vectors):
        fid = farm_ids[idx] if farm_ids is not None else None
        results.append(predict_single(vec, fid))
    return results
