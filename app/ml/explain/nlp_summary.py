import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

def generate_nlp_explanations(damage_class: str, shap_values: Dict[str, float], vector: List[float]) -> Dict[str, str]:
    """
    Generates natural language summaries in English and Hindi based on SHAP contributions.
    """
    # Sort features by absolute contribution
    sorted_features = sorted(shap_values.items(), key=lambda x: abs(x[1]), reverse=True)
    
    # Extract top positive contributors for damage (or negative for no damage)
    top_contributors = sorted_features[:3]
    
    class_map = {
        "no_damage": ("NO DAMAGE / HEALTHY", "कोई नुकसान नहीं / स्वस्थ"),
        "moderate_damage": ("MODERATE DAMAGE", "मध्यम नुकसान"),
        "severe_damage": ("SEVERE DAMAGE", "गंभीर नुकसान")
    }
    
    cls_eng, cls_hin = class_map.get(damage_class, (damage_class.upper(), damage_class))
    
    eng_bullets = []
    hin_bullets = []
    
    # Feature description maps
    descriptions = {
        "ndvi": {
            "eng": "NDVI (crop health index) deviated from seasonal baseline (impact: {impact:+.2f})",
            "hin": "एनडीवीआई (फसल स्वास्थ्य सूचकांक) मौसमी बेसलाइन से विचलित हुआ (प्रभाव: {impact:+.2f})"
        },
        "precip": {
            "eng": "Rainfall anomaly during critical growth phases (impact: {impact:+.2f})",
            "hin": "महत्वपूर्ण विकास चरणों के दौरान असामान्य वर्षा (प्रभाव: {impact:+.2f})"
        },
        "soil_moisture": {
            "eng": "Soil moisture saturation exceeded safe levels (impact: {impact:+.2f})",
            "hin": "मिट्टी में नमी का संतृप्ति सुरक्षित स्तर से अधिक हुआ (प्रभाव: {impact:+.2f})"
        },
        "temp": {
            "eng": "Air temperature deviated from normal threshold (impact: {impact:+.2f})",
            "hin": "हवा का तापमान सामान्य सीमा से विचलित हुआ (प्रभाव: {impact:+.2f})"
        },
        "sar_ratio": {
            "eng": "SAR polarization ratios indicated crop canopy flooding/lodging (impact: {impact:+.2f})",
            "hin": "एसएआर ध्रुवीकरण अनुपात ने फसल चंदवा जलभराव / गिरने का संकेत दिया (प्रभाव: {impact:+.2f})"
        }
    }
    
    default_desc = {
        "eng": "Feature {name} contributed to model confidence (impact: {impact:+.2f})",
        "hin": "फ़ीचर {name} ने मॉडल के विश्वास में योगदान दिया (प्रभाव: {impact:+.2f})"
    }
    
    for name, impact in top_contributors:
        # Format values
        desc = descriptions.get(name, {
            "eng": default_desc["eng"].format(name=name, impact=impact),
            "hin": default_desc["hin"].format(name=name, impact=impact)
        })
        
        # If it's in descriptions, format with impact
        if name in descriptions:
            eng_str = desc["eng"].format(impact=impact)
            hin_str = desc["hin"].format(impact=impact)
        else:
            eng_str = desc["eng"]
            hin_str = desc["hin"]
            
        eng_bullets.append(f"- {eng_str}")
        hin_bullets.append(f"- {hin_str}")
        
    english_summary = f"Your farm was flagged for {cls_eng} because:\n" + "\n".join(eng_bullets)
    hindi_summary = f"आपके खेत को {cls_hin} के लिए चिह्नित किया गया था क्योंकि:\n" + "\n".join(hin_bullets)
    
    return {
        "english": english_summary,
        "hindi": hindi_summary
    }
