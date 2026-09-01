import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Enum as SAEnum, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base


class FlagType(str, enum.Enum):
    duplicate_image = "duplicate_image"
    satellite_mismatch = "satellite_mismatch"
    repeated_claim = "repeated_claim"
    weather_mismatch = "weather_mismatch"
    image_tampering = "image_tampering"


class FlagSeverity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class FraudFlag(Base):
    __tablename__ = "fraud_flags"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id", ondelete="CASCADE"), nullable=False, index=True)

    flag_type = Column(SAEnum(FlagType), nullable=False)
    severity = Column(SAEnum(FlagSeverity), nullable=False, default=FlagSeverity.medium)
    details_json = Column(JSON, nullable=True)

    is_reviewed = Column(Boolean, default=False)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    claim = relationship("Claim", back_populates="fraud_flags")

    def __repr__(self):
        return f"<FraudFlag claim_id={self.claim_id} type={self.flag_type} severity={self.severity}>"
