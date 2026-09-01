import logging
import time
from typing import Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models import User
from app.core.otp_service import generate_otp, verify_otp, clean_phone_number
from app.core.security import create_access_token, create_refresh_token, decode_token, decode_jwt

logger = logging.getLogger(__name__)
router = APIRouter()

# ----------------------------------------------------
# Pydantic Schemas
# ----------------------------------------------------
class PhoneRequest(BaseModel):
    phone: str = Field(..., pattern=r'^[6-9]\d{9}$')

class OTPVerifyRequest(BaseModel):
    phone: str = Field(..., pattern=r'^[6-9]\d{9}$')
    otp: str = Field(..., pattern=r'^\d{6}$')

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict

# Demo test phone list
DEMO_PHONES = ["9876543210", "9876543211", "9876543299", "8838803421"]

# ----------------------------------------------------
# Router Endpoints
# ----------------------------------------------------

@router.post("/check-phone")
async def check_phone(data: PhoneRequest, db: AsyncSession = Depends(get_db)):
    """
    Checks if user phone number is registered in AgriSense database.
    """
    cleaned = clean_phone_number(data.phone)
    stmt = select(User).where(User.phone == cleaned)
    res = await db.execute(stmt)
    user = res.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mobile number not registered. Contact your block agriculture officer."
        )
        
    return {
        "exists": True,
        "role": user.role
    }

@router.post("/send-otp")
async def send_otp(data: PhoneRequest, db: AsyncSession = Depends(get_db)):
    """
    Sends OTP via Fast2SMS (with console fallback) for registered users.
    """
    cleaned = clean_phone_number(data.phone)
    stmt = select(User).where(User.phone == cleaned)
    res = await db.execute(stmt)
    user = res.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mobile number not registered. Contact your block agriculture officer."
        )
        
    if getattr(user, 'is_active', True) is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account deactivated"
        )
        
    otp_res = generate_otp(cleaned)
    
    return {
        "success": True,
        "message": "OTP sent to your registered mobile number.",
        "method": otp_res["method"]
    }

@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp_endpoint(
    data: OTPVerifyRequest, 
    response: Response, 
    db: AsyncSession = Depends(get_db)
):
    """
    Verifies 6-digit OTP, authenticates user, sets cookies, and returns AgriSense JWTs.
    """
    cleaned = clean_phone_number(data.phone)
    result = verify_otp(cleaned, data.otp)
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=result["error"]
        )
        
    stmt = select(User).where(User.phone == cleaned)
    res = await db.execute(stmt)
    user = res.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User registration not found in local system."
        )
        
    if getattr(user, 'is_active', True) is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account deactivated"
        )
        
    # Update last login
    user.last_login = datetime.utcnow()
    await db.commit()
    
    # Generate JWT Tokens
    access_token = create_access_token(subject=user.id, extra_claims={"phone": user.phone, "role": user.role})
    refresh_token = create_refresh_token(subject=user.id)
    
    # Set cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=900,
        samesite="lax",
        secure=False
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
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "full_name": getattr(user, 'full_name', user.phone),
            "phone": user.phone,
            "role": user.role
        }
    }

@router.get("/me")
async def get_me(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        
    try:
        payload = decode_token(token)
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
        "role": user.role
    }

@router.post("/refresh")
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("refresh_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")
        
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
        
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    access_token = create_access_token(subject=user.id, extra_claims={"phone": user.phone, "role": user.role})
    
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
