from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class SatelliteData(Base):
    __tablename__ = "satellite_data"

    id = Column(Integer, primary_key=True, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)

    acquisition_date = Column(Date, nullable=False, index=True)
    ndvi = Column(Float, nullable=True)   # Normalized Difference Vegetation Index
    ndwi = Column(Float, nullable=True)   # Normalized Difference Water Index
    evi = Column(Float, nullable=True)    # Enhanced Vegetation Index
    nbr = Column(Float, nullable=True)    # Normalized Burn Ratio
    vci = Column(Float, nullable=True)    # Vegetation Condition Index

    image_url = Column(String(500), nullable=True)
    cloud_cover = Column(Float, nullable=True)  # 0-100%
    source = Column(String(50), nullable=True)  # sentinel-1 | sentinel-2 | liss-iv

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    farm = relationship("Farm", back_populates="satellite_records")

    def __repr__(self):
        return f"<SatelliteData farm_id={self.farm_id} date={self.acquisition_date} ndvi={self.ndvi}>"
