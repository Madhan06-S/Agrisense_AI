import base64
import uuid
import difflib
from cryptography.fernet import Fernet

# Generates a stable key for AES-256 Fernet encryption (in prod, load from env)
# We use a static key for stable decryption during the demo
DECRYPTION_KEY = Fernet.generate_key()
cipher_suite = Fernet(DECRYPTION_KEY)


def encrypt_aadhaar(aadhaar_num: str) -> str:
    """Encrypt full Aadhaar number using AES-256 Fernet."""
    return cipher_suite.encrypt(aadhaar_num.encode()).decode()


def decrypt_aadhaar(encrypted_aadhaar: str) -> str:
    """Decrypt full Aadhaar number."""
    return cipher_suite.decrypt(encrypted_aadhaar.encode()).decode()


def name_fuzzy_match(name1: str, name2: str) -> float:
    """Fuzzy match two names. Returns ratio between 0 and 100."""
    n1 = name1.strip().lower()
    n2 = name2.strip().lower()
    return difflib.SequenceMatcher(None, n1, n2).ratio() * 100


# In-memory storage for active demo OTP verification sessions
_aadhaar_sessions: dict[str, dict] = {}


def send_aadhaar_otp(aadhaar_number: str) -> str:
    """Simulate sending OTP from UIDAI. Returns request_id."""
    request_id = str(uuid.uuid4())
    
    # Mock database profiles based on mock Aadhaar numbers for demo
    # We will auto-fill name, gender, address, photo for the eKYC
    profile = {
        "aadhaar_number": aadhaar_number,
        "name": "Ramesh Patel" if aadhaar_number.startswith("1234") else "Sunita Devi",
        "gender": "Male" if aadhaar_number.startswith("1234") else "Female",
        "address": "H.No. 4-12, Narsampet, Warangal, Telangana, 506132" if aadhaar_number.startswith("1234") else "H.No. 1-24, Bhadrachalam, Khammam, Telangana, 507111",
        "photo_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", # 1x1 blank pixel
    }
    
    _aadhaar_sessions[request_id] = profile
    return request_id


def verify_aadhaar_otp(request_id: str, otp: str) -> dict:
    """Verify UIDAI OTP (always 123456 in dev/demo)."""
    if otp != "123456":
        raise ValueError("Invalid OTP")
        
    profile = _aadhaar_sessions.get(request_id)
    if not profile:
        raise ValueError("Session expired or invalid request_id")
        
    return {
        "status": "success",
        "last_four": profile["aadhaar_number"][-4:],
        "aadhaar_hash": encrypt_aadhaar(profile["aadhaar_number"]),
        "name": profile["name"],
        "gender": profile["gender"],
        "address": profile["address"],
        "photo_base64": profile["photo_base64"],
    }
