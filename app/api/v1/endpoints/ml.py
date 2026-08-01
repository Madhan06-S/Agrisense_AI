import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.ml.xgboost.inference import predict_single, predict_batch, load_model
from app.ml.explain.shap_engine import explain_local, explain_contrastive
from app.ml.explain.nlp_summary import generate_nlp_explanations
from app.api.v1.endpoints.features import get_farm_fused_vector

logger = logging.getLogger(__name__)
router = APIRouter()

# Schemas
class SinglePredictRequest(BaseModel):
    feature_vector: List[float]
    farm_id: Optional[int] = None

class BatchPredictRequest(BaseModel):
    feature_vectors: List[List[float]]
    farm_ids: Optional[List[int]] = None

@router.post("/predict", response_model=Dict[str, Any])
async def predict_farm_damage(payload: SinglePredictRequest):
    """
    Predicts crop damage for a single feature vector.
    """
    try:
        res = predict_single(payload.feature_vector, payload.farm_id)
        return res
    except Exception as e:
        logger.error(f"Error predicting damage: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/predict/batch", response_model=List[Dict[str, Any]])
async def predict_farm_damage_batch(payload: BatchPredictRequest):
    """
    Predicts crop damage for a batch of feature vectors.
    """
    try:
        res = predict_batch(payload.feature_vectors, payload.farm_ids)
        return res
    except Exception as e:
        logger.error(f"Error predicting batch damage: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/model/info", response_model=Dict[str, Any])
async def get_model_info():
    """
    Retrieves info about the active XGBoost model.
    """
    _, meta = load_model()
    return {
        "model_version": meta.get("model_version", "mock-dev"),
        "mean_cv_logloss": meta.get("mean_cv_logloss", 0.0),
        "trained_samples": meta.get("trained_samples", 0),
        "features": 22
    }

@router.get("/model/importance", response_model=Dict[str, Any])
@router.get("/explain/global", response_model=Dict[str, Any])
async def get_global_importance():
    """
    Retrieves the global feature importances of the model.
    """
    _, meta = load_model()
    # Default fallback values if no metadata is saved
    importance = {}
    if "feature_importance" in meta and len(meta["feature_importance"]) > 0:
        for name, scores in meta["feature_importance"].items():
            importance[name] = scores.get("gain", 0.0)
    else:
        # Mock global importance
        from app.features.fusion import FEATURE_NAMES
        for name in FEATURE_NAMES:
            if name == "ndvi":
                importance[name] = 0.42
            elif name == "precip":
                importance[name] = 0.28
            elif name == "soil_moisture":
                importance[name] = 0.18
            else:
                importance[name] = 0.12 / 19
                
    return {
        "status": "success",
        "global_importance": importance
    }

@router.get("/explain/{farm_id}", response_model=Dict[str, Any])
async def get_local_explanation(farm_id: int, db: AsyncSession = Depends(get_db)):
    """
    Generates local explanations (SHAP + NLP) for the specified farm.
    """
    try:
        # 1. Fetch fused 22-dimensional feature vector for the farm
        fused_res = await get_farm_fused_vector(farm_id, db)
        vector = fused_res["vector"]
        
        # 2. Get prediction details
        pred = predict_single(vector, farm_id)
        
        # 3. Get SHAP details
        exp = explain_local(vector)
        
        # 4. Generate NLP explanations (Bilingual English + Hindi)
        nlp_exp = generate_nlp_explanations(pred["damage_class"], exp["shap_values"], vector)
        
        return {
            "farm_id": farm_id,
            "prediction": pred,
            "shap_explanation": exp,
            "nlp_summary": nlp_exp
        }
    except Exception as e:
        logger.error(f"Error explaining farm prediction: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/explain/contrast/{farm_id}", response_model=Dict[str, Any])
async def get_contrastive_explanation(farm_id: int, target_class: str = "no_damage", db: AsyncSession = Depends(get_db)):
    """
    Contrastive what-if explanation: what needs to change to transition to another class.
    """
    try:
        fused_res = await get_farm_fused_vector(farm_id, db)
        vector = fused_res["vector"]
        
        exp = explain_contrastive(vector, target_class)
        return exp
    except Exception as e:
        logger.error(f"Error generating contrastive explanation: {e}")
        raise HTTPException(status_code=400, detail=str(e))


from app.models.models import DamageAssessment
from sqlalchemy import select

@router.get("/analyze/{claim_id}/result")
async def get_claim_assessment_result(claim_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(DamageAssessment).where(DamageAssessment.claim_id == claim_id)
    res = await db.execute(stmt)
    assess = res.scalars().first()
    if not assess:
        from app.ml.fusion_engine import run_fusion_pipeline
        assess = await run_fusion_pipeline(claim_id, db)
        if not assess:
            raise HTTPException(status_code=404, detail="Assessment not found")
    return assess
