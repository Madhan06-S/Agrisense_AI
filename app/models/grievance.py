from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class Grievance(Base):
    __tablename__ = "grievances"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id", ondelete="CASCADE"), nullable=False, index=True)
    farmer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # REJECTION_CHALLENGE | DELAYED_PAYMENT | INCORRECT_AMOUNT | FRAUD_FLAG_DISPUTE | OTHER
    type = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    evidence_urls = Column(JSON, nullable=True)  # List of URLs

    # FILED | UNDER_REVIEW | HEARING_SCHEDULED | RESOLVED | ESCALATED
    status = Column(String(50), default="FILED", index=True)

    assigned_officer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    hearing_date = Column(DateTime(timezone=True), nullable=True)
    resolution_remarks = Column(Text, nullable=True)

    filed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    sla_deadline = Column(DateTime(timezone=True), nullable=False)

    satisfaction_rating = Column(Integer, nullable=True)  # 1-5 rating by farmer

    # Relationships
    claim = relationship("Claim")
    farmer = relationship("User", foreign_keys=[farmer_id])
    assigned_officer = relationship("User", foreign_keys=[assigned_officer_id])

    def __repr__(self):
        return f"<Grievance id={self.id} status={self.status} type={self.type}>"
