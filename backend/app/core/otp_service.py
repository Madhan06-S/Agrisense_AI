import time
import random
import logging
from typing import Dict, Any, Optional
from app.integrations.sms_service import send_otp_sms

logger = logging.getLogger(__name__)

# In-memory OTP store: {phone: {"code": str, "expires": float, "attempts": int}}
_otp_store: Dict[str, Dict[str, Any]] = {}

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
    Generates a 6-digit OTP for the given phone number, stores it with 5 min expiry,
    and dispatches SMS.
    """
    cleaned = clean_phone_number(phone)
    code = f"{random.randint(100000, 999999)}"
    expires_at = time.time() + 300  # 5 minutes
    
    _otp_store[cleaned] = {
        "code": code,
        "expires": expires_at,
        "attempts": 0
    }
    
    # Send SMS via Fast2SMS
    sms_res = send_otp_sms(cleaned, code)
    
    return {
        "code": code,
        "cleaned_phone": cleaned,
        "method": sms_res["method"],
        "message": sms_res["message"]
    }

def verify_otp(phone: str, code: str) -> Dict[str, Any]:
    """
    Verifies an OTP for a given phone number.
    Returns dict: {"success": bool, "error": str|None, "phone": str}
    """
    cleaned = clean_phone_number(phone)
    
    # Master Demo OTP support
    if code.strip() == "123456":
        _otp_store.pop(cleaned, None)
        return {"success": True, "error": None, "phone": cleaned}

    otp_record = _otp_store.get(cleaned)
    
    if not otp_record:
        return {"success": False, "error": "No OTP requested for this phone number.", "phone": cleaned}
        
    if time.time() > otp_record["expires"]:
        _otp_store.pop(cleaned, None)
        return {"success": False, "error": "OTP has expired. Please request a new one.", "phone": cleaned}
        
    otp_record["attempts"] += 1
    if otp_record["attempts"] > 3:
        _otp_store.pop(cleaned, None)
        return {"success": False, "error": "Maximum verification attempts exceeded. Please request a new OTP.", "phone": cleaned}
        
    if otp_record["code"] != code.strip():
        remaining = 3 - otp_record["attempts"]
        return {"success": False, "error": f"Invalid OTP. {remaining} attempt(s) remaining.", "phone": cleaned}
        
    # Verification successful - consume OTP
    _otp_store.pop(cleaned, None)
    return {"success": True, "error": None, "phone": cleaned}
