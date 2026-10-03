from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class CreditScore(Base):
    __tablename__ = "credit_scores"

    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Float, nullable=True)  # 0-100, or None if data_completeness < 0.4
    band = Column(String(50), nullable=False)  # Strong, Good, Building, Needs support, Not enough data
    factors = Column(JSON, nullable=False)
    data_completeness = Column(Float, nullable=False)  # 0-1
    computed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    farmer = relationship("User", lazy="select")

    def __repr__(self):
        return f"<CreditScore id={self.id} farmer_id={self.farmer_id} score={self.score} band='{self.band}'>"
