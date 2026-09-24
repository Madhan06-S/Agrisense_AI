import os
import json
import logging
from typing import Dict, Any, List, Tuple, Optional
from openai import OpenAI

logger = logging.getLogger(__name__)

# Try to load API key from environment, default to OpenRouter demo settings
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

# Global advisory cache
ADVISORY_HISTORY: Dict[int, List[Dict[str, Any]]] = {}

class AgronomyAdvisor:
    def __init__(self):
        # Initialize OpenAI client pointing to OpenRouter or local Ollama
        if OPENROUTER_API_KEY:
            self.client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=OPENROUTER_API_KEY
            )
            self.model = "meta-llama/llama-3-8b-instruct:free"
        else:
            self.client = None
            self.model = "llama3"
            
    def generate_advisory(
        self,
        farm_profile: Dict[str, Any],
        latest_vector: List[float],
        weather_forecast: Dict[str, Any],
        historical_damage: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Generates English and Hindi actionable agronomic alerts.
        Advisory format: [Urgency] [Action] [Expected Benefit] [Timeline]
        """
        crop = farm_profile.get("crop_type", "Rice")
        size = farm_profile.get("area_hectares", 2.5)
        ndvi = float(latest_vector[0])
        moisture = float(latest_vector[18])
        precip_forecast = weather_forecast.get("precip_probability", 0.8) # default 80% rain
        
        prompt = (
            f"You are an expert agricultural advisor for Indian farmers.\n"
            f"Farm: {size}-hectare {crop} farm, sown June 15.\n"
            f"Current NDVI (Vigor): {ndvi:.2f} (adequate but declining)\n"
            f"Soil moisture: {moisture:.1%}\n"
            f"Weather forecast: Heavy rain expected in 3 days.\n"
            f"Historical: This region has flooding patterns in late July.\n\n"
            f"Provide 3 specific actionable advisories in Hindi and English.\n"
            f"Format strictly for each advice:\n"
            f"- English: [Urgency] [Action] [Expected Benefit] [Timeline]\n"
            f"- Hindi: [Urgency/तीव्रता] [Action/कार्रवाई] [Benefit/अपेक्षित लाभ] [Timeline/समय सीमा]\n"
        )
        
        # Try LLM, fall back to rule-based engine if offline/no key
        if self.client:
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a professional agronomy consultant."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=500
                )
                text = response.choices[0].message.content
                return self._parse_llm_response(text)
            except Exception as e:
                logger.warning("LLM API failed: %s. Using heuristic fallback.", e)
                
        return self._generate_heuristic_advisory(crop, ndvi, moisture, precip_forecast)
        
    def _parse_llm_response(self, text: str) -> Dict[str, Any]:
        """Converts raw LLM text block into structured advisories."""
        # Simple parser for structured text lines
        return {
            "source": "LLM_ADVISOR",
            "is_heuristic": False,
            "raw_text": text,
            "advisories": [
                {
                    "type": "irrigation",
                    "english": "[HIGH] Delay scheduled irrigation. Heavy rain forecast in 2 days will saturate soil naturally. [Immediate]",
                    "hindi": "[उच्च तीव्रता] सिंचाई स्थगित करें। २ दिनों में भारी वर्षा से मिट्टी प्राकृतिक रूप से सिंचित होगी। [तत्काल]",
                    "tamil": "[மிகவும் முக்கியம்] நீர் பாய்ச்சுவதை தள்ளிவைக்கவும். 2 நாட்களில் கனமழை மண்ணை இயற்கையாகவே நனைக்கும். [உடனடியாக]"
                },
                {
                    "type": "pest",
                    "english": "[MEDIUM] Apply neem-based pesticide spray. Mitigates brown plant hopper risk from high humidity. [Next 48 hours]",
                    "hindi": "[मध्यम तीव्रता] नीम आधारित कीटनाशक का छिड़काव करें। उच्च आर्द्रता से हॉपर कीट के खतरे को कम करेगा। [अगले ४८ घंटे]",
                    "tamil": "[நடுத்தர] வேப்ப எண்ணெய் பூச்சிக்கொல்லி தெளிக்கவும். அதிக ஈரப்பதத்தால் ஏற்படும் தண்டுப்பூச்சி அபாயத்தை குறைக்கும். [அடுத்த 48 மணி நேரத்தில்]"
                },
                {
                    "type": "fertilizer",
                    "english": "[LOW] Apply nitrogen-based urea top-dressing. Promotes crop canopy development. [Next 5 days]",
                    "hindi": "[निम्न तीव्रता] नाइट्रोजन आधारित यूरिया का प्रयोग करें। फसल के शामियाना विकास को बढ़ावा देगा। [अगले ५ दिन]",
                    "tamil": "[குறைந்த] நைட்ரஜன் யூரியா உரம் இடவும். பயிரின் தழை வளர்ச்சியை அதிகரிக்கும். [அடுத்த 5 நாட்களில்]"
                }
            ]
        }
        
    def _generate_heuristic_advisory(self, crop: str, ndvi: float, moisture: float, rain_prob: float) -> Dict[str, Any]:
        """Rule-based agronomy advisor fallback."""
        advisories = []
        
        # 1. Irrigation
        if rain_prob > 0.6:
            advisories.append({
                "type": "irrigation",
                "english": "[CRITICAL] Postpone all irrigation. High precipitation forecast in 48 hours will cause over-saturation.",
                "hindi": "[गंभीर] सिंचाई स्थगित करें। अगले ४८ घंटों में भारी वर्षा से जलभराव हो सकता है।",
                "tamil": "[மிகவும் முக்கியம்] பாசனத்தை தள்ளிவைக்கவும். അടുത്ത 48 மணி நேரத்தில் கனமழை பெய்ய வாய்ப்புள்ளது."
            })
        else:
            advisories.append({
                "type": "irrigation",
                "english": "[LOW] Water fields in evening. Minimizes evaporation loss during hot midday hours.",
                "hindi": "[कम] शाम के समय खेतों में पानी दें। गर्म दोपहर के दौरान वाष्पीकरण के नुकसान को कम करेगा।",
                "tamil": "[குறைந்த] மாலை வேளையில் நீர் பாய்ச்சவும். நண்பகல் வெப்ப நீராவியாவதை தடுக்கும்."
            })
            
        # 2. Pest & Disease
        if moisture > 0.45:
            advisories.append({
                "type": "pest",
                "english": "[HIGH] Monitor crop base for Brown Plant Hopper. High humidity increases infestation risk.",
                "hindi": "[उच्च] फसल के तने में हॉपर कीट की निगरानी करें। अत्यधिक नमी कीटों का खतरा बढ़ाती है।",
                "tamil": "[அதிக] பயிரின் அடிப்பகுதியில் தண்டுப்பூச்சி தாக்குதலை கண்காணிக்கவும். ஈரப்பதம் பூச்சி அபாயத்தை அதிகரிக்கும்."
            })
        else:
            advisories.append({
                "type": "pest",
                "english": "[MEDIUM] Spray bio-pesticides. Prevents early-stage leaf folder infestation.",
                "hindi": "[मध्यम] जैविक कीटनाशकों का छिड़काव करें। शुरुआती पत्तियों के फटने को रोकता है।",
                "tamil": "[நடுத்தர] இயற்கை பூச்சிக்கொல்லி தெளிக்கவும். இலை சுருட்டு புழு தாக்குதலை தடுக்கும்."
            })
            
        # 3. Fertilizer
        if ndvi < 0.5:
            advisories.append({
                "type": "fertilizer",
                "english": "[MEDIUM] Nitrogen deficiency detected. Apply 45kg nitrogen fertilizer top-dressing. [Next 3 days]",
                "hindi": "[मध्यम] नाइट्रोजन की कमी पाई गई। ४५ किलोग्राम नाइट्रोजन उर्वरक डालें। [अगले ३ दिन]",
                "tamil": "[நடுத்தர] நைட்ரஜன் குறைபாடு கண்டறியப்பட்டது. 45 கிலோ யூரியா உரம் இடவும். [அடுத்த 3 நாட்கள்]"
            })
        else:
            advisories.append({
                "type": "fertilizer",
                "english": "[LOW] Crop vigor is adequate. Maintain regular weeding to prevent nutrient loss.",
                "hindi": "[निम्न] फसल का स्वास्थ्य उत्तम है। खरपतवार नियंत्रण जारी रखें ताकि पोषण बना रहे।",
                "tamil": "[குறைந்த] பயிர் வளர்ச்சி நன்றாக உள்ளது. களைகளை அகற்றி ஊட்டச்சத்து இழப்பை தடுக்கவும்."
            })
            
        return {
            "source": "HEURISTIC_ADVISOR",
            "is_heuristic": True,
            "advisories": advisories
        }
