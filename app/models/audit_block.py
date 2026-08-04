from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class AuditBlock(Base):
    __tablename__ = "audit_blocks"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(100), nullable=False)  # SUBMITTED, AI_ANALYZED, OFFICER_REVIEWED, APPROVED, REJECTED, PAYOUT_INITIATED, etc.
    
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_role = Column(String(50), nullable=True)
    actor_name = Column(String(200), nullable=True)
    
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    claim_state_snapshot = Column(JSON, nullable=True)
    
    previous_hash = Column(String(64), nullable=True)
    current_hash = Column(String(64), nullable=False)

    # Relationships
    claim = relationship("Claim", back_populates="audit_blocks")

    def __repr__(self):
        return f"<AuditBlock claim_id={self.claim_id} action={self.action} hash={self.current_hash[:8]}>"
