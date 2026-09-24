import os
import json
import time
import re
import logging
from typing import Dict, Any, List, Optional, Tuple
from openai import OpenAI
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

# Global advisory cache and rate limiting store (farm_id -> list of timestamps)
ADVISORY_HISTORY: Dict[int, List[Dict[str, Any]]] = {}
RATE_LIMIT_STORE: Dict[int, List[float]] = {}
DAILY_LIMIT = 20

INJECTION_PATTERNS = [
    r"ignore\s+previous\s+instructions",
    r"disregard\s+all\s+prior",
    r"system\s+prompt",
    r"you\s+are\s+now\s+a",
    r"override\s+rules"
]


class AgronomyAdvisor:
    def __init__(self):
        if OPENROUTER_API_KEY:
            self.client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=OPENROUTER_API_KEY,
                timeout=15.0
            )
            self.model = "meta-llama/llama-3-8b-instruct:free"
        else:
            self.client = None
            self.model = "llama3"

    def check_rate_limit(self, farm_id: int) -> bool:
        """Returns True if within rate limit (<= 20 calls/day), False if exceeded."""
        now = time.time()
        window_start = now - 86400  # 24 hours
        timestamps = RATE_LIMIT_STORE.get(farm_id, [])
        valid_ts = [t for t in timestamps if t >= window_start]
        RATE_LIMIT_STORE[farm_id] = valid_ts
        return len(valid_ts) < DAILY_LIMIT

    def record_call(self, farm_id: int):
        now = time.time()
        if farm_id not in RATE_LIMIT_STORE:
            RATE_LIMIT_STORE[farm_id] = []
        RATE_LIMIT_STORE[farm_id].append(now)

    def sanitize_input(self, text: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
        """Sanitizes prompt input. Returns (sanitized_text, error_message)."""
        if not text:
            return None, None
        
        # Cap at 500 chars
        text = text[:500]

        # Strip HTML tags
        text = re.sub(r"<[^>]*>", "", text).strip()

        # Check prompt injection patterns
        for pattern in INJECTION_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                return None, "Invalid query pattern detected. Please rephrase your agronomy question."

        return text, None

    def generate_advisory(
        self,
        farm_profile: Dict[str, Any],
        latest_vector: List[float],
        weather_forecast: Dict[str, Any],
        historical_damage: List[Dict[str, Any]],
        user_query: Optional[str] = None,
        language: str = "en-IN"
    ) -> Dict[str, Any]:
        """
        Generates actionable agronomic alerts using LLM or rule-based heuristics.
        Includes rate-limiting, injection protection, dynamic farm facts, and language enforcement.
        """
        farm_id = farm_profile.get("id", 1)

        # 1. Rate Limiting Check
        if not self.check_rate_limit(farm_id):
            limit_msgs = {
                "hi-IN": "आपने 20 प्रश्नों की दैनिक सीमा पूरी कर ली है। कृपया कल पुनः प्रयास करें या अपने कृषि अधिकारी से संपर्क करें।",
                "ta-IN": "தினசரி 20 AI கேள்விகளின் வரம்பை எட்டிவிட்டீர்கள். நாளை மீண்டும் முயற்சிக்கவும் அல்லது வேளாண் அலுவலரைத் தொடர்பு கொள்ளவும்.",
                "en-IN": "You have reached your daily limit of 20 AI advisory queries. Please try again tomorrow."
            }
            msg = limit_msgs.get(language, limit_msgs["en-IN"])
            return {
                "source": "RATE_LIMITED",
                "is_heuristic": True,
                "is_rate_limited": True,
                "raw_text": msg,
                "advisories": [{
                    "type": "system_notice",
                    "english": limit_msgs["en-IN"],
                    "hindi": limit_msgs["hi-IN"],
                    "tamil": limit_msgs["ta-IN"]
                }]
            }

        # 2. Input Sanitization
        sanitized_query, injection_err = self.sanitize_input(user_query)
        if injection_err:
            return {
                "source": "SECURITY_BLOCK",
                "is_heuristic": True,
                "raw_text": injection_err,
                "advisories": [{
                    "type": "system_notice",
                    "english": injection_err,
                    "hindi": injection_err,
                    "tamil": injection_err
                }]
            }

        # Record valid call towards rate limit
        self.record_call(farm_id)

        # Extract real farm facts
        crop = farm_profile.get("crop_type", "Rice")
        size = farm_profile.get("area_hectares", 2.5)
        ndvi = float(latest_vector[0]) if len(latest_vector) > 0 else 0.28
        moisture = float(latest_vector[18]) if len(latest_vector) > 18 else 0.35
        temp_c = weather_forecast.get("temp_c", 31.0)
        precip_prob = weather_forecast.get("precip_probability", 0.8)

        # Calculate real NDVI health band
        if ndvi >= 0.6:
            health_band = "Healthy / High Crop Vigor"
        elif ndvi >= 0.4:
            health_band = "Adequate Vigor"
        elif ndvi >= 0.2:
            health_band = "Moderate Stress / Declining Vigor"
        else:
            health_band = "Severe Crop Damage / Low Vigor"

        weather_str = f"{temp_c:.1f}°C, {precip_prob * 100:.0f}% rain probability"
        claims_str = f"{len(historical_damage)} recent insurance claims"

        # Language Script Enforcement Instruction
        lang_instructions = {
            "hi-IN": "Answer strictly in Hindi (Devanagari script only). Do NOT use English letters.",
            "ta-IN": "Answer strictly in Tamil (Tamil script only). Do NOT use English letters.",
            "en-IN": "Answer in clear Indian English."
        }
        lang_rule = lang_instructions.get(language, lang_instructions["en-IN"])

        # Contextual System Prompt
        system_prompt = (
            f"You are an agricultural advisor for an Indian smallholder farmer. "
            f"Farm facts: [NDVI {ndvi:.2f} - {health_band}], [{weather_str}], [{size}ha {crop}], [{claims_str}]. "
            f"Rules: answer in the farmer's requested language ({lang_rule}), max 3 sentences, actionable advice only. "
            f"You MUST cite the actual NDVI value ({ndvi:.2f}) and current weather in your advice."
        )

        user_content = sanitized_query or f"What are my top 3 crop health advisories for {crop}?"

        # 3. LLM Execution with 1 Retry + 2s Backoff Fallback Chain
        if self.client:
            for attempt in range(2):
                try:
                    logger.info(f"Dispatching Copilot LLM Query (Attempt {attempt+1}): {user_content[:50]}...")
                    response = self.client.chat.completions.create(
                        model=self.model,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_content}
                        ],
                        max_tokens=300
                    )
                    llm_text = response.choices[0].message.content.strip()
                    tokens = response.usage.total_tokens if hasattr(response, "usage") and response.usage else 120
                    return self._parse_llm_response(llm_text, ndvi, health_band, tokens)
                except Exception as e:
                    logger.warning(f"LLM API attempt {attempt+1} failed: {e}")
                    if attempt == 0:
                        time.sleep(2)

        # Fallback to Rule-Based Heuristic Engine if LLM fails or is disabled
        logger.info("Serving rule-based heuristic advisor fallback.")
        return self._generate_heuristic_advisory(crop, ndvi, moisture, precip_prob)

    def _parse_llm_response(self, text: str, ndvi: float, health_band: str, tokens: int = 120) -> Dict[str, Any]:
        """Formats LLM output into structured advisory object."""
        return {
            "source": "LLM_ADVISOR",
            "is_heuristic": False,
            "tokens_used": tokens,
            "raw_text": text,
            "advisories": [
                {
                    "type": "voice_query",
                    "english": text,
                    "hindi": text,
                    "tamil": text
                },
                {
                    "type": "irrigation",
                    "english": f"[NDVI {ndvi:.2f} - {health_band}] Monitor soil moisture. Postpone unnecessary watering prior to expected rain.",
                    "hindi": f"[NDVI {ndvi:.2f} - {health_band}] मिट्टी की नमी की निगरानी करें। बारिश से पहले सिंचाई स्थगित रखें।",
                    "tamil": f"[NDVI {ndvi:.2f} - {health_band}] பாசனத்தை தள்ளிவைக்கவும். மழைக்காலம் நெருங்குகிறது."
                }
            ]
        }

    def _generate_heuristic_advisory(self, crop: str, ndvi: float, moisture: float, rain_prob: float) -> Dict[str, Any]:
        """Rule-based agronomy advisor fallback."""
        advisories = []

        if rain_prob > 0.6:
            advisories.append({
                "type": "irrigation",
                "english": f"[CRITICAL - NDVI {ndvi:.2f}] Postpone all irrigation. High precipitation forecast (80%) will saturate soil naturally.",
                "hindi": f"[गंभीर - NDVI {ndvi:.2f}] सिंचाई स्थगित करें। अगले ४८ घंटों में भारी वर्षा से जलभराव हो सकता है।",
                "tamil": f"[மிகவும் முக்கியம் - NDVI {ndvi:.2f}] பாசனத்தை தள்ளிவைக்கவும். கனமழை பெய்ய வாய்ப்புள்ளது."
            })
        else:
            advisories.append({
                "type": "irrigation",
                "english": f"[LOW - NDVI {ndvi:.2f}] Water fields in evening to minimize midday evaporation loss.",
                "hindi": f"[कम - NDVI {ndvi:.2f}] शाम के समय खेतों में पानी दें। वाष्पीकरण के नुकसान को कम करेगा।",
                "tamil": f"[குறைந்த - NDVI {ndvi:.2f}] மாலை வேளையில் நீர் பாய்ச்சவும்."
            })

        if moisture > 0.45:
            advisories.append({
                "type": "pest",
                "english": f"[HIGH - Moisture {moisture:.0%}] Monitor crop base for Brown Plant Hopper due to high humidity.",
                "hindi": f"[उच्च - नमी {moisture:.0%}] फसल के तने में हॉपर कीट की निगरानी करें। अत्यधिक नमी कीटों का खतरा बढ़ाती है।",
                "tamil": f"[அதிக - ஈரப்பதம் {moisture:.0%}] தண்டுப்பூச்சி தாக்குதலை கண்காணிக்கவும்."
            })
        else:
            advisories.append({
                "type": "pest",
                "english": "[MEDIUM] Apply neem-based bio-pesticide spray to mitigate pest risk.",
                "hindi": "[मध्यम] नीम आधारित जैविक कीटनाशक का छिड़काव करें।",
                "tamil": "[நடுத்தர] வேப்ப எண்ணெய் பூச்சிக்கொல்லி தெளிக்கவும்."
            })

        if ndvi < 0.5:
            advisories.append({
                "type": "fertilizer",
                "english": f"[MEDIUM - NDVI {ndvi:.2f}] Nitrogen deficiency flagged. Apply 45kg urea top-dressing in next 3 days.",
                "hindi": f"[मध्यम - NDVI {ndvi:.2f}] नाइट्रोजन की कमी पाई गई। ४५ किलोग्राम यूरिया डालें।",
                "tamil": f"[நடுத்தர - NDVI {ndvi:.2f}] 45 கிலோ யூரியா உரம் இடவும்."
            })
        else:
            advisories.append({
                "type": "fertilizer",
                "english": f"[LOW - NDVI {ndvi:.2f}] Crop vigor adequate. Maintain regular weeding.",
                "hindi": f"[निम्न - NDVI {ndvi:.2f}] फसल स्वास्थ्य उत्तम है। खरपतवार नियंत्रण जारी रखें।",
                "tamil": f"[குறைந்த - NDVI {ndvi:.2f}] பயிர் வளர்ச்சி நன்றாக உள்ளது."
            })

        return {
            "source": "HEURISTIC_ADVISOR",
            "is_heuristic": True,
            "tokens_used": 0,
            "advisories": advisories
        }
