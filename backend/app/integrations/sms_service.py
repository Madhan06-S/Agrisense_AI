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
    
    # Always print OTP to console as fallback / audit log
    print(f"[SMS] OTP for +91{cleaned_phone}: {otp}")
    logger.info(f"[SMS] OTP for +91{cleaned_phone}: {otp}")
    
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
            logger.info(f"[SMS] Sent OTP to +91{cleaned_phone}: {otp}")
            print(f"[SMS] Sent OTP to +91{cleaned_phone}: {otp}")
            return {
                "success": True,
                "method": "sms",
                "message": f"OTP sent via SMS to +91{cleaned_phone}."
            }
        else:
            raw_msg = data.get("message", "SMS gateway error")
            if isinstance(raw_msg, list):
                raw_msg = raw_msg[0]
            logger.warning(f"[SMS] Fast2SMS failed: {raw_msg}. Console OTP for +91{cleaned_phone}: {otp}")
            print(f"[SMS] Fast2SMS failed: {raw_msg}. Console OTP for +91{cleaned_phone}: {otp}")
            return {
                "success": True,
                "method": "console",
                "message": f"Fast2SMS Gateway Notice: {raw_msg}"
            }
    except Exception as e:
        logger.error(f"[SMS] Fast2SMS error: {e}. Console OTP for +91{cleaned_phone}: {otp}")
        print(f"[SMS] Fast2SMS error: {e}. Console OTP for +91{cleaned_phone}: {otp}")
        return {
            "success": True,
            "method": "console",
            "message": "SMS gateway busy. Check backend console for OTP."
        }
