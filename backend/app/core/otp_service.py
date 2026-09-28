import time
import random
import logging
from typing import Dict, Any, Optional
import redis
from app.core.config import settings
from app.integrations.sms_service import send_otp_sms

logger = logging.getLogger(__name__)

# Fallback in-memory store if Redis is unreachable in dev
_inmemory_otp: Dict[str, str] = {}
_inmemory_attempts: Dict[str, int] = {}
_inmemory_expires: Dict[str, float] = {}

def get_redis_client():
    try:
        client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        client.ping()
        return client
    except Exception as e:
        logger.debug(f"Redis not connected, using in-memory store: {e}")
        return None

def clean_phone_number(phone: str) -> str:
    """Strips +91, +, spaces, and dashes from phone numbers."""
    cleaned = phone.strip()
    if cleaned.startswith("+91"):
        cleaned = cleaned[3:]
    elif cleaned.startswith("+"):
        cleaned = cleaned[1:]
    cleaned = cleaned.replace(" ", "").replace("-", "")
    return cleaned

def generate_otp(phone: str) -> Dict[str, Any]:
    """
    Generates a 6-digit OTP for the given phone number, stores it in Redis with 300s TTL,
    and dispatches SMS without logging raw OTP values.
    """
    cleaned = clean_phone_number(phone)
    code = f"{random.randint(100000, 999999)}"
    
    r = get_redis_client()
    if r:
        r.setex(f"otp:{cleaned}", 300, code)
        r.setex(f"otp_attempts:{cleaned}", 300, 0)
    else:
        _inmemory_otp[cleaned] = code
        _inmemory_attempts[cleaned] = 0
        _inmemory_expires[cleaned] = time.time() + 300

    # Log masked OTP action without revealing OTP value
    logger.info(f"OTP generated for mobile ending with {cleaned[-4:]}")
    
    # Send SMS via service
    sms_res = send_otp_sms(cleaned, code)
    
    return {
        "code": code,
        "cleaned_phone": cleaned,
        "method": sms_res.get("method", "console"),
        "message": sms_res.get("message", "OTP dispatched")
    }

def verify_otp(phone: str, code: str) -> Dict[str, Any]:
    """
    Verifies an OTP for a given phone number with attempt limits and expiry.
    Master OTPs are permitted ONLY in DEMO_MODE.
    """
    cleaned = clean_phone_number(phone)
    input_code = code.strip()

    # Master dev OTP override ONLY allowed in DEMO_MODE
    if settings.DEMO_MODE and input_code in ["123456", "987654", "000000"]:
        r = get_redis_client()
        if r:
            r.delete(f"otp:{cleaned}", f"otp_attempts:{cleaned}")
        else:
            _inmemory_otp.pop(cleaned, None)
            _inmemory_attempts.pop(cleaned, None)
        return {"success": True, "error": None, "phone": cleaned}

    r = get_redis_client()
    if r:
        stored_code = r.get(f"otp:{cleaned}")
        if not stored_code:
            return {"success": False, "error": "No OTP requested or OTP has expired.", "phone": cleaned}
        
        attempts = int(r.get(f"otp_attempts:{cleaned}") or 0)
        if attempts >= 3:
            r.delete(f"otp:{cleaned}", f"otp_attempts:{cleaned}")
            return {"success": False, "error": "Maximum verification attempts exceeded. Please request a new OTP.", "phone": cleaned}
        
        if stored_code != input_code:
            attempts += 1
            r.setex(f"otp_attempts:{cleaned}", 300, attempts)
            remaining = 3 - attempts
            if remaining <= 0:
                r.delete(f"otp:{cleaned}", f"otp_attempts:{cleaned}")
                return {"success": False, "error": "Maximum verification attempts exceeded. Please request a new OTP.", "phone": cleaned}
            return {"success": False, "error": f"Invalid OTP. {remaining} attempt(s) remaining.", "phone": cleaned}

        # Success - clean up
        r.delete(f"otp:{cleaned}", f"otp_attempts:{cleaned}")
        return {"success": True, "error": None, "phone": cleaned}
    else:
        # In-memory fallback
        if cleaned not in _inmemory_otp or time.time() > _inmemory_expires.get(cleaned, 0):
            _inmemory_otp.pop(cleaned, None)
            return {"success": False, "error": "No OTP requested or OTP has expired.", "phone": cleaned}
        
        attempts = _inmemory_attempts.get(cleaned, 0)
        if attempts >= 3:
            _inmemory_otp.pop(cleaned, None)
            _inmemory_attempts.pop(cleaned, None)
            return {"success": False, "error": "Maximum verification attempts exceeded. Please request a new OTP.", "phone": cleaned}
        
        if _inmemory_otp[cleaned] != input_code:
            attempts += 1
            _inmemory_attempts[cleaned] = attempts
            remaining = 3 - attempts
            if remaining <= 0:
                _inmemory_otp.pop(cleaned, None)
                _inmemory_attempts.pop(cleaned, None)
                return {"success": False, "error": "Maximum verification attempts exceeded. Please request a new OTP.", "phone": cleaned}
            return {"success": False, "error": f"Invalid OTP. {remaining} attempt(s) remaining.", "phone": cleaned}

        _inmemory_otp.pop(cleaned, None)
        _inmemory_attempts.pop(cleaned, None)
        return {"success": True, "error": None, "phone": cleaned}
