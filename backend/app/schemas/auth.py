from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from app.models.user import UserRole


class UserRegister(BaseModel):
    full_name: str
    phone: str
    email: Optional[str] = None
    password: str
    role: UserRole = UserRole.farmer
    aadhaar_number: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    village: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        digits = v.replace("+91", "").replace(" ", "").replace("-", "")
        if not digits.isdigit() or len(digits) < 10:
            raise ValueError("Enter a valid 10-digit phone number")
        return digits[-10:]


class OTPRequest(BaseModel):
    phone: str


class OTPVerify(BaseModel):
    phone: str
    otp: str


class LoginRequest(BaseModel):
    phone: str
    otp: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: int
    role: str
    full_name: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: int
    phone: str
    email: Optional[str]
    full_name: str
    role: UserRole
    state: Optional[str]
    district: Optional[str]
    village: Optional[str]
    is_active: bool

    model_config = {"from_attributes": True}
