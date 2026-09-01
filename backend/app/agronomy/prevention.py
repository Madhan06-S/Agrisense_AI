import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

def evaluate_prevention_warnings(vci_history: List[float], flood_index: float) -> Optional[Dict[str, Any]]:
    """
    Evaluates risk alerts and early warning notifications:
    - VCI dropped into 40-60 range: Suggest pasture rotation.
    - Flood index > 0.6: Recommend early fodder harvest.
    - Extreme low VCI < 40 or drought warning: Suggest troughs & PM-KISAN subsidy.
    """
    if not vci_history:
        return None
        
    latest_vci = vci_history[-1]
    
    if flood_index > 0.6:
        return {
            "urgency": "HIGH",
            "type": "flood_alert",
            "english": "Flood risk high next week. Harvest fodder early and secure equipment.",
            "hindi": "अगले सप्ताह बाढ़ का खतरा अधिक है। चारा पहले ही काट लें और उपकरणों को सुरक्षित करें।"
        }
        
    if latest_vci < 40:
        return {
            "urgency": "CRITICAL",
            "type": "drought_alert",
            "english": "Severe drought stress detected. Install additional water troughs. Subsidy available under PM-KISAN.",
            "hindi": "गंभीर सूखे का प्रभाव देखा गया है। पानी की अतिरिक्त नालियां लगाएं। पीएम-किसान के तहत सब्सिडी उपलब्ध है।"
        }
        
    if 40 <= latest_vci <= 60:
        return {
            "urgency": "MEDIUM",
            "type": "pasture_rotation",
            "english": f"Pasture Health Index (VCI) dropped to {latest_vci:.1f}. Move cows to eastern pasture for healthier grazing grass.",
            "hindi": f"चारागाह स्वास्थ्य सूचकांक (VCI) घटकर {latest_vci:.1f} रह गया है। गायों को हरी घास के लिए पूर्वी चारागाह में स्थानांतरित करें।"
        }
        
    return None
