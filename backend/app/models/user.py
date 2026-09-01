import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserRole(str, enum.Enum):
    farmer = "farmer"
    officer = "officer"
    collector = "collector"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    phone = Column(String(15), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), nullable=False, default=UserRole.farmer)

    full_name = Column(String(200), nullable=False)
    aadhaar_number = Column(String(12), nullable=True)
    aadhaar_hash = Column(String(255), nullable=True)
    aadhaar_verified = Column(Boolean, default=False)
    aadhaar_name = Column(String(200), nullable=True)
    state = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    village = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True)
    pin = Column(String(10), nullable=True)
    last_login = Column(DateTime, nullable=True)
    login_attempts = Column(Integer, default=0, nullable=False)
    password_reset_token = Column(String(255), nullable=True)

    # Relationships
    farms = relationship("Farm", back_populates="farmer", lazy="select")
    claims = relationship("Claim", back_populates="farmer", lazy="select", foreign_keys="[Claim.farmer_id]")

    def __repr__(self):
        return f"<User id={self.id} phone={self.phone} role={self.role}>"
