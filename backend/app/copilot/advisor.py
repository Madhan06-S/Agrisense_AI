import os
import json
import time
import re
import logging
from typing import Dict, Any, List, Optional, Tuple
from openai import OpenAI
from dotenv import load_dotenv, find_dotenv

from app.copilot.ml_models import (
    normalize_moisture_humidity,
    estimate_yield,
    forecast_pest_risk,
    schedule_irrigation,
    get_market_advisory
)

load_dotenv(find_dotenv())
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")

# Global advisory cache and rate limiting store (farm_id -> list of timestamps)
ADVISORY_HISTORY: Dict[int, List[Dict[str, Any]]] = {}
RATE_LIMIT_STORE: Dict[int, List[float]] = {}
DAILY_LIMIT = 30

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
            try:
                self.client = OpenAI(
                    base_url="https://openrouter.ai/api/v1",
                    api_key=OPENROUTER_API_KEY,
                    timeout=15.0
                )
                self.model = "google/gemini-2.5-flash"
                logger.info("COPILOT: LLM provider ACTIVE (OpenRouter Gemini 2.5 Flash configured)")
            except Exception as err:
                logger.error(f"COPILOT: Failed to initialize OpenRouter client: {err}")
                self.client = None
                self.model = "heuristic"
        else:
            self.client = None
            self.model = "heuristic"
            logger.info("COPILOT: LLM provider NOT configured — heuristic mode active")

    def check_rate_limit(self, farm_id: int) -> bool:
        """Returns True if within rate limit (<= 30 calls/day), False if exceeded."""
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
        
        text = text[:500]
        text = re.sub(r"<[^>]*>", "", text).strip()

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
        Generates agronomic advice using LLM (Gemini 2.5 Flash) or rule-based heuristics.
        Fixed BUG 0 (moisture clamping 0-100%). Grounded in live farm facts & 5 ML models.
        """
        farm_id = farm_profile.get("id", 1)

        # 1. Rate Limiting Check
        if not self.check_rate_limit(farm_id):
            limit_msgs = {
                "hi-IN": "आपने 30 प्रश्नों की दैनिक सीमा पूरी कर ली है। कृपया कल पुनः प्रयास करें।",
                "ta-IN": "தினசரி 30 AI கேள்விகளின் வரம்பை எட்டிவிட்டீர்கள். நாளை மீண்டும் முயற்சிக்கவும்.",
                "en-IN": "You have reached your daily limit of 30 AI advisory queries. Please try again tomorrow."
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

        self.record_call(farm_id)

        # Extract and normalize farm facts (Fixing BUG 0)
        crop = farm_profile.get("crop_type", "Rice")
        size_ha = farm_profile.get("area_hectares", 2.5)
        ndvi = float(latest_vector[0]) if len(latest_vector) > 0 else 0.28
        raw_moisture = float(latest_vector[18]) if len(latest_vector) > 18 else 38.0
        
        # Bug 0 Fix: Clamp moisture/humidity between 0-100%
        moisture_pct = normalize_moisture_humidity(raw_moisture)

        temp_c = float(weather_forecast.get("temp_c", 31.0))
        precip_mm = float(weather_forecast.get("precip_mm", 12.5))
        precip_prob = float(weather_forecast.get("precip_probability", 0.8))

        # Evaluate ML models for context enrichment
        yield_info = estimate_yield([ndvi], crop, size_ha)
        pest_info = forecast_pest_risk(crop, moisture_pct, temp_c, precip_mm)
        irrig_info = schedule_irrigation(crop, moisture_pct, precip_mm * 2)
        mkt_info = get_market_advisory(crop)

        # Health band
        if ndvi >= 0.6:
            health_band = "Healthy / High Crop Vigor"
        elif ndvi >= 0.4:
            health_band = "Adequate Vigor"
        elif ndvi >= 0.2:
            health_band = "Moderate Stress / Declining Vigor"
        else:
            health_band = "Severe Crop Damage / Low Vigor"

        context_summary = (
            f"Farm: {size_ha}ha {crop} | NDVI: {ndvi:.2f} ({health_band}) | "
            f"Soil Humidity: {moisture_pct:.1f}% | Weather: {temp_c:.1f}°C, {precip_mm}mm rain | "
            f"Pest Risk: {pest_info['risk_level']} ({pest_info['pest_risk_score']}/100, Pests: {', '.join(pest_info['top_likely_pests'])}) | "
            f"Yield Est: {yield_info['estimated_yield_per_acre']} q/acre | "
            f"Market MSP: ₹{mkt_info['msp_inr']}/q vs Mandi: ₹{mkt_info['mandi_avg_inr']}/q ({mkt_info['recommendation']})"
        )

        lang_instructions = {
            "hi-IN": "Answer strictly in clear Hindi (Devanagari script only). Keep response helpful and under 4 sentences.",
            "ta-IN": "Answer strictly in clear Tamil (Tamil script only). Keep response helpful and under 4 sentences.",
            "en-IN": "Answer in clear, direct Indian Agronomist English. Keep response helpful and under 4 sentences."
        }
        lang_rule = lang_instructions.get(language, lang_instructions["en-IN"])

        system_prompt = (
            f"You are an expert AI Agronomist Copilot assisting an Indian farmer named Patel on his farm. "
            f"LIVE FARM METRICS: [{context_summary}].\n"
            f"Rules:\n"
            f"1. Follow language instruction: {lang_rule}\n"
            f"2. Always cite specific numbers from the farm context (e.g. NDVI {ndvi:.2f}, Humidity {moisture_pct:.1f}%, Rain {precip_mm}mm) to prove you know their exact farm state.\n"
            f"3. Provide actionable, practical farming advice."
        )

        user_content = sanitized_query or f"What is my current crop health, pest risk, and irrigation advice for my {crop} farm?"

        # Try OpenRouter LLM Call
        if self.client:
            for attempt in range(2):
                try:
                    logger.info(f"Dispatching Copilot Gemini 2.5 Flash Query (Attempt {attempt+1}) for farm {farm_id}...")
                    response = self.client.chat.completions.create(
                        model=self.model,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_content}
                        ],
                        max_tokens=350
                    )
                    llm_text = response.choices[0].message.content.strip()
                    tokens = response.usage.total_tokens if hasattr(response, "usage") and response.usage else 140
                    return self._parse_llm_response(
                        llm_text, ndvi, moisture_pct, crop, context_summary, tokens,
                        yield_info, pest_info, irrig_info, mkt_info
                    )
                except Exception as e:
                    logger.warning(f"LLM API attempt {attempt+1} failed: {e}")
                    if attempt == 0:
                        time.sleep(1)

        # Fallback Heuristic
        logger.info("Serving rule-based agronomy heuristic fallback.")
        return self._generate_heuristic_advisory(
            crop, ndvi, moisture_pct, precip_prob, yield_info, pest_info, irrig_info, mkt_info
        )

    def _parse_llm_response(
        self,
        text: str,
        ndvi: float,
        moisture: float,
        crop: str,
        context_summary: str,
        tokens: int,
        yield_info: Dict[str, Any],
        pest_info: Dict[str, Any],
        irrig_info: Dict[str, Any],
        mkt_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Formats LLM response into full advisory structure."""
        return {
            "source": "LLM_ADVISOR",
            "is_heuristic": False,
            "model_used": "Gemini 2.5 Flash (OpenRouter)",
            "tokens_used": tokens,
            "raw_text": text,
            "context_summary": context_summary,
            "ml_insights": {
                "yield": yield_info,
                "pest": pest_info,
                "irrigation": irrig_info,
                "market": mkt_info
            },
            "advisories": [
                {
                    "type": "chat_reply",
                    "english": text,
                    "hindi": text,
                    "tamil": text
                },
                {
                    "type": "irrigation",
                    "english": irrig_info["recommendation_english"],
                    "hindi": irrig_info["recommendation_hindi"],
                    "tamil": irrig_info["recommendation_tamil"]
                },
                {
                    "type": "pest",
                    "english": f"[{pest_info['risk_level']} PEST RISK - Humidity {moisture:.1f}%] {pest_info['prevention_guidance']}",
                    "hindi": f"[{pest_info['risk_level']} कीट जोखिम - नमी {moisture:.1f}%] {pest_info['prevention_guidance']}",
                    "tamil": f"[{pest_info['risk_level']} பூச்சி ஆபத்து - ஈரப்பதம் {moisture:.1f}%] {pest_info['prevention_guidance']}"
                },
                {
                    "type": "market",
                    "english": mkt_info["advice_english"],
                    "hindi": mkt_info["advice_hindi"],
                    "tamil": mkt_info["advice_tamil"]
                }
            ]
        }

    def _generate_heuristic_advisory(
        self,
        crop: str,
        ndvi: float,
        moisture: float,
        rain_prob: float,
        yield_info: Dict[str, Any],
        pest_info: Dict[str, Any],
        irrig_info: Dict[str, Any],
        mkt_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Fixed rule-based agronomy advisor fallback (BUG 0 moisture clamping applied)."""
        advisories = [
            {
                "type": "irrigation",
                "english": irrig_info["recommendation_english"],
                "hindi": irrig_info["recommendation_hindi"],
                "tamil": irrig_info["recommendation_tamil"]
            },
            {
                "type": "pest",
                "english": f"[{pest_info['risk_level']} PEST RISK - Humidity {moisture:.1f}%] {pest_info['prevention_guidance']}",
                "hindi": f"[{pest_info['risk_level']} कीट जोखिम - नमी {moisture:.1f}%] {pest_info['prevention_guidance']}",
                "tamil": f"[{pest_info['risk_level']} பூச்சி ஆபத்து - ஈரப்பதம் {moisture:.1f}%] {pest_info['prevention_guidance']}"
            },
            {
                "type": "fertilizer",
                "english": f"[NDVI {ndvi:.2f}] Crop vigor is at {yield_info['estimated_yield_per_acre']} q/acre ({yield_info['status_label']}). Maintain urea application.",
                "hindi": f"[NDVI {ndvi:.2f}] फसल का अनुमानित उत्पादन {yield_info['estimated_yield_per_acre']} किग्रा/एकड़ है। यूरिया का संतुलन बनाएं रखें।",
                "tamil": f"[NDVI {ndvi:.2f}] எதிர்பார்க்கப்படும் விளைச்சல் {yield_info['estimated_yield_per_acre']} குவிண்டால்/ஏக்கர்."
            },
            {
                "type": "market",
                "english": mkt_info["advice_english"],
                "hindi": mkt_info["advice_hindi"],
                "tamil": mkt_info["advice_tamil"]
            }
        ]

        return {
            "source": "HEURISTIC_ADVISOR",
            "is_heuristic": True,
            "model_used": "Rule Matrix Engine",
            "tokens_used": 0,
            "context_summary": f"NDVI {ndvi:.2f} | Humidity {moisture:.1f}% | Crop {crop}",
            "ml_insights": {
                "yield": yield_info,
                "pest": pest_info,
                "irrigation": irrig_info,
                "market": mkt_info
            },
            "advisories": advisories
        }
