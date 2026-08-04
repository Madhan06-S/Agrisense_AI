from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Boolean, Float, DateTime, ForeignKey
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class ClaimImage(Base):
    __tablename__ = "claim_images"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id", ondelete="CASCADE"), nullable=False)

    image_url = Column(String(500), nullable=False)
    image_hash = Column(String(64), nullable=True, index=True)  # pHash for fraud detection

    # EXIF / GPS
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    is_geo_tagged = Column(Boolean, default=False)
    captured_at = Column(DateTime(timezone=True), nullable=True)  # from EXIF

    file_size_bytes = Column(Integer, nullable=True)
    original_filename = Column(String(255), nullable=True)

    uploaded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    claim = relationship("Claim", back_populates="images")

    def __repr__(self):
        return f"<ClaimImage id={self.id} claim_id={self.claim_id} geo={self.is_geo_tagged}>"
