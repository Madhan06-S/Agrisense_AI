import logging
import random
import time
from typing import Dict, Any, List, Tuple, Optional
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.models import User

logger = logging.getLogger(__name__)
router = APIRouter()

# ----------------------------------------------------
# JWT Configurations & Custom Signer
# ----------------------------------------------------
import hmac
import hashlib
import base64
import json

SECRET_KEY = "government_secure_key_for_agrisense"

def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").replace("=", "")

def base64url_decode(data: str) -> bytes:
    padding = "=" * (4 - len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)

def encode_jwt(payload: dict) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = base64url_encode(json.dumps(header).encode("utf-8"))
    payload_b64 = base64url_encode(json.dumps(payload).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    signature = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    signature_b64 = base64url_encode(signature)
    return f"{header_b64}.{payload_b64}.{signature_b64}"

def decode_jwt(token: str) -> dict:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid token structure")
        header_b64, payload_b64, signature_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        expected_sig = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
        expected_sig_b64 = base64url_encode(expected_sig)
        if not hmac.compare_digest(signature_b64, expected_sig_b64):
            raise ValueError("Signature mismatch")
        payload = json.loads(base64url_decode(payload_b64).decode("utf-8"))
        if payload.get("exp", 0) < time.time():
            raise ValueError("Token expired")
        return payload
    except Exception as e:
        raise ValueError(f"Invalid token: {str(e)}")

# ----------------------------------------------------
# OTP Storage & Management (Redis + In-Memory Fallback)
# ----------------------------------------------------
IN_MEMORY_OTP: Dict[str, Tuple[str, float]] = {}
IN_MEMORY_ATTEMPTS: Dict[str, Tuple[int, float]] = {}
IN_MEMORY_WRONG_ATTEMPTS: Dict[str, Tuple[int, float]] = {}
SENT_SMS_MESSAGES: List[dict] = []

try:
    import redis
    redis_client = redis.Redis(host="localhost", port=6379, db=0, socket_timeout=1)
    redis_client.ping()
    use_redis = True
except Exception:
    use_redis = False
    redis_client = None

def get_otp_store(phone: str) -> Optional[str]:
    if use_redis:
        try:
            val = redis_client.get(f"otp:{phone}")
            return val.decode("utf-8") if val else None
        except Exception:
            pass
    if phone in IN_MEMORY_OTP:
        otp, expire = IN_MEMORY_OTP[phone]
        if expire > time.time():
            return otp
        else:
            del IN_MEMORY_OTP[phone]
    return None

def set_otp_store(phone: str, otp: str, ttl: int = 300) -> None:
    if use_redis:
        try:
            redis_client.setex(f"otp:{phone}", ttl, otp)
            return
        except Exception:
            pass
    IN_MEMORY_OTP[phone] = (otp, time.time() + ttl)

def check_rate_limit(phone: str) -> bool:
    now = time.time()
    if use_redis:
        try:
            key = f"rate:{phone}"
            val = redis_client.get(key)
            if val:
                count = int(val)
                if count >= 3:
                    return False
                redis_client.incr(key)
            else:
                redis_client.setex(key, 3600, 1)
            return True
        except Exception:
            pass
    if phone in IN_MEMORY_ATTEMPTS:
        count, reset_time = IN_MEMORY_ATTEMPTS[phone]
        if now > reset_time:
            IN_MEMORY_ATTEMPTS[phone] = (1, now + 3600)
            return True
        elif count >= 3:
            return False
        else:
            IN_MEMORY_ATTEMPTS[phone] = (count + 1, reset_time)
            return True
    else:
        IN_MEMORY_ATTEMPTS[phone] = (1, now + 3600)
        return True

def check_lockout(phone: str) -> Tuple[bool, int]:
    now = time.time()
    if use_redis:
        try:
            lock_key = f"lockout:{phone}"
            lock_val = redis_client.get(lock_key)
            if lock_val:
                ttl = redis_client.ttl(lock_key)
                return True, max(0, int(ttl))
        except Exception:
            pass
    if phone in IN_MEMORY_WRONG_ATTEMPTS:
        wrong_count, lockout_end = IN_MEMORY_WRONG_ATTEMPTS[phone]
        if now < lockout_end:
            return True, int(lockout_end - now)
    return False, 0

def increment_wrong_otp(phone: str) -> int:
    now = time.time()
    if use_redis:
        try:
            wrong_key = f"wrong:{phone}"
            val = redis_client.get(wrong_key)
            count = int(val or 0) + 1
            if count >= 3:
                redis_client.setex(f"lockout:{phone}", 300, "locked")
                redis_client.delete(wrong_key)
                return 3
            else:
                redis_client.setex(wrong_key, 300, count)
                return count
        except Exception:
            pass
    if phone in IN_MEMORY_WRONG_ATTEMPTS:
        wrong_count, lockout_end = IN_MEMORY_WRONG_ATTEMPTS[phone]
        count = wrong_count + 1
        if count >= 3:
            IN_MEMORY_WRONG_ATTEMPTS[phone] = (3, now + 300)
            return 3
        else:
            IN_MEMORY_WRONG_ATTEMPTS[phone] = (count, 0)
            return count
    else:
        IN_MEMORY_WRONG_ATTEMPTS[phone] = (1, 0)
        return 1

def reset_wrong_otp(phone: str) -> None:
    if use_redis:
        try:
            redis_client.delete(f"wrong:{phone}")
            redis_client.delete(f"lockout:{phone}")
        except Exception:
            pass
    if phone in IN_MEMORY_WRONG_ATTEMPTS:
        del IN_MEMORY_WRONG_ATTEMPTS[phone]

# ----------------------------------------------------
# Pydantic Schemas
# ----------------------------------------------------
class SendOTPRequest(BaseModel):
    phone: str = Field(..., description="10-digit mobile number")
    role: Optional[str] = "farmer"

class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str
    pin: Optional[str] = None

# ----------------------------------------------------
# Router Endpoints
# ----------------------------------------------------
@router.post("/send-otp")
async def send_otp(req: SendOTPRequest):
    phone = req.phone.strip()
    if len(phone) != 10 or not phone.isdigit() or phone[0] not in "6789":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a valid 10-digit mobile number starting with 6/7/8/9"
        )
    
    is_locked, remaining_lock = check_lockout(phone)
    if is_locked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many wrong attempts. Locked out. Try again in {remaining_lock} seconds."
        )
    
    if not check_rate_limit(phone):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum 3 OTP requests per hour. Please wait."
        )
    
    # Generate 6-digit OTP
    otp = f"{random.randint(100000, 999999)}"
    set_otp_store(phone, otp, ttl=300)
    
    # Log simulated SMS message
    msg = f"Message from AGRISE: Your AgriSense OTP is {otp}. Valid for 5 mins."
    SENT_SMS_MESSAGES.append({
        "phone": phone,
        "message": msg,
        "timestamp": time.time()
    })
    logger.info(f"Simulated SMS for {phone}: {msg}")
    
    return {"message": "OTP sent successfully", "expires_in": 300}

@router.post("/verify-otp")
async def verify_otp(req: VerifyOTPRequest, response: Response, db: AsyncSession = Depends(get_db)):
    phone = req.phone.strip()
    otp = req.otp.strip()
    
    is_locked, remaining_lock = check_lockout(phone)
    if is_locked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Locked out. Try again in {remaining_lock} seconds."
        )
        
    stored_otp = get_otp_store(phone)
    if not stored_otp or stored_otp != otp:
        wrong_count = increment_wrong_otp(phone)
        remaining = 3 - wrong_count
        if remaining <= 0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many incorrect OTP attempts. Locked out for 5 minutes."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid OTP. {remaining} attempts remaining."
            )
            
    # Success: Reset wrong attempts and delete OTP
    reset_wrong_otp(phone)
    if use_redis:
        try:
            redis_client.delete(f"otp:{phone}")
        except Exception:
            pass
    elif phone in IN_MEMORY_OTP:
        del IN_MEMORY_OTP[phone]
        
    # Get or create user
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalars().first()
    
    # Simple role detection: default to farmer, but if phone in list or pin is provided, make them officer
    role = "farmer"
    if phone in ["9876543211", "9876543222", "9999988888"] or req.pin is not None:
        role = "officer"
        
    if not user:
        # Sign up user
        user = User(
            email=f"{phone}@agrisense.gov.in",
            phone=phone,
            aadhaar_number=f"123456{phone}", # generate mock aadhaar
            hashed_password="pbkdf2:sha256:260000$mock_hash_placeholder",
            role=role,
            pin=req.pin.strip() if req.pin else None
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Upgrade to officer if PIN is provided on login
        if req.pin and user.role == "farmer":
            user.role = "officer"
            user.pin = req.pin.strip()
            await db.commit()
            await db.refresh(user)
            
        # Check PIN for officers
        if user.role == "officer":
            if not user.pin:
                # If first login, let them set a PIN
                if req.pin:
                    user.pin = req.pin.strip()
                    await db.commit()
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="PIN is required for first-time officer login setup."
                    )
            elif req.pin and user.pin != req.pin.strip():
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid officer credentials (PIN mismatch)."
                )

    # Generate JWT Tokens
    now = int(time.time())
    access_token = encode_jwt({"sub": str(user.id), "phone": user.phone, "role": user.role, "exp": now + 900}) # 15 mins
    refresh_token = encode_jwt({"sub": str(user.id), "phone": user.phone, "role": user.role, "exp": now + 604800}) # 7 days
    
    # Set cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=900,
        samesite="lax",
        secure=False # set true in prod
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=604800,
        samesite="lax",
        secure=False
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": user.id,
            "email": user.email,
            "phone": user.phone,
            "role": user.role
        }
    }

@router.get("/me")
async def get_me(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        # Check Authorization header as fallback
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        
    try:
        payload = decode_jwt(token)
        user_id = int(payload.get("sub"))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Session expired or invalid: {str(e)}")
        
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    return {
        "id": user.id,
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
        "has_pin": user.pin is not None
    }

@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")
        
    try:
        payload = decode_jwt(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
        
    now = int(time.time())
    access_token = encode_jwt({"sub": payload["sub"], "phone": payload["phone"], "role": payload["role"], "exp": now + 900})
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=900,
        samesite="lax",
        secure=False
    )
    return {"access_token": access_token}

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Successfully logged out"}

@router.get("/last-sms")
async def get_last_sms(phone: Optional[str] = None):
    if phone:
        matched = [m for m in SENT_SMS_MESSAGES if m["phone"] == phone]
        if matched:
            return matched[-1]
    elif SENT_SMS_MESSAGES:
        return SENT_SMS_MESSAGES[-1]
    return {"message": "No SMS sent yet"}
