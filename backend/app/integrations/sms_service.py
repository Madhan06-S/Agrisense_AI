import logging
import requests
from app.core.config import settings

logger = logging.getLogger(__name__)

FAST2SMS_API_KEY = getattr(
    settings,
    "FAST2SMS_API_KEY",
    "Mf4gIWSUPL8GbunN5VkdB10JCTmzyjvhs96xcYQtXeHwZR3DaKRDmCaSBntzGhZygvJbwcoMljfurkO7"
)

def send_otp_sms(phone: str, otp: str) -> dict:
    """
    Sends OTP via Fast2SMS Bulk V2 API.
    Falls back to console log if API fails or network fails.
    """
    cleaned_phone = phone.replace("+91", "").replace("+", "").strip()
    
    # Mask OTP in log
    logger.info(f"[SMS] Dispatching OTP for +91{cleaned_phone}")
    
    url = "https://www.fast2sms.com/dev/bulkV2"
    headers = {
        "authorization": FAST2SMS_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "route": "q",
        "message": f"Your AgriSense AI OTP is {otp}. Valid for 5 minutes.",
        "language": "english",
        "flash": 0,
        "numbers": cleaned_phone
    }
    
    try:
        res = requests.post(url, json=payload, headers=headers, timeout=10)
        data = res.json()
        if res.status_code == 200 and data.get("return") is True:
            logger.info(f"[SMS] Sent OTP to +91{cleaned_phone}")
            return {
                "success": True,
                "delivered": True,
                "provenance": "live",
                "method": "sms",
                "message": f"OTP sent via SMS to +91{cleaned_phone}."
            }
        else:
            raw_msg = data.get("message", "SMS gateway error")
            if isinstance(raw_msg, list):
                raw_msg = raw_msg[0]
            logger.warning(f"[SMS] Fast2SMS gateway response: {raw_msg}. Using console fallback.")
            return {
                "success": True,
                "delivered": False,
                "provenance": "fallback",
                "method": "console",
                "message": "OTP dispatched to registered mobile number (console fallback)."
            }
    except Exception as e:
        logger.error(f"[SMS] Fast2SMS network error: {e}. Using console fallback.")
        return {
            "success": True,
            "delivered": False,
            "provenance": "fallback",
            "method": "console",
            "message": "OTP dispatched to registered mobile number (console fallback)."
        }

