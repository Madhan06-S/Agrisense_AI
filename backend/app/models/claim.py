import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Text, DateTime, ForeignKey, Enum as SAEnum, Boolean
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class ClaimType(str, enum.Enum):
    flood = "flood"
    drought = "drought"
    pest = "pest"
    cyclone = "cyclone"
    hailstorm = "hailstorm"
    fire = "fire"
    other = "other"


class ClaimStatus(str, enum.Enum):
    submitted = "submitted"
    under_review = "under_review"
    approved = "approved"
    rejected = "rejected"
    pending_evidence = "pending_evidence"
    payout_processed = "payout_processed"


class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id", ondelete="CASCADE"), nullable=False)
    farmer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    claim_type = Column(SAEnum(ClaimType), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(SAEnum(ClaimStatus), nullable=False, default=ClaimStatus.submitted, index=True)

    ai_damage_score = Column(Float, nullable=True)  # 0-100
    ai_decision = Column(String(10), nullable=True)  # green | yellow | red
    officer_remarks = Column(Text, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Payout fields
    payout_amount = Column(Float, nullable=True)
    damage_percent = Column(Float, nullable=True)
    farm_area = Column(Float, nullable=True)
    sum_insured = Column(Float, nullable=True)

    # PFMS & Parametric Trigger fields
    pfms_transaction_id = Column(String(100), nullable=True)
    scheme_code = Column(String(100), nullable=True)
    sanction_order_no = Column(String(100), nullable=True)
    is_parametric = Column(Boolean, default=False)
    trigger_source = Column(String(50), nullable=True)
    imd_alert_id = Column(Integer, nullable=True)

    submitted_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    farm = relationship("Farm", back_populates="claims")
    farmer = relationship("User", back_populates="claims", foreign_keys=[farmer_id])
    images = relationship("ClaimImage", back_populates="claim", lazy="select", cascade="all, delete-orphan")
    damage_assessment = relationship("DamageAssessment", back_populates="claim", uselist=False, lazy="select")
    fraud_flags = relationship("FraudFlag", back_populates="claim", lazy="select")
    audit_blocks = relationship("AuditBlock", back_populates="claim", lazy="select", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Claim id={self.id} status={self.status} score={self.ai_damage_score}>"
