from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class DamageAssessment(Base):
    __tablename__ = "damage_assessments"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id", ondelete="CASCADE"), nullable=False, unique=True)

    # Individual component scores (0–100)
    satellite_score = Column(Float, nullable=True)
    image_score = Column(Float, nullable=True)
    weather_score = Column(Float, nullable=True)

    # Confidence levels per component (0–1)
    satellite_confidence = Column(Float, nullable=True)
    image_confidence = Column(Float, nullable=True)
    weather_confidence = Column(Float, nullable=True)

    # Fusion output
    combined_score = Column(Float, nullable=True)       # 0–100
    confidence = Column(Float, nullable=True)            # 0–1
    decision = Column(String(10), nullable=True)         # green | yellow | red

    # Full explanation JSON
    explanation_json = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    claim = relationship("Claim", back_populates="damage_assessment")

    def __repr__(self):
        return f"<DamageAssessment claim_id={self.claim_id} combined={self.combined_score} decision={self.decision}>"
