from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime, ForeignKey, Boolean
)
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from app.core.database import Base


class Farm(Base):
    __tablename__ = "farms"

    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    crop_type = Column(String(100), nullable=False)
    area_hectares = Column(Float, nullable=True)

    # PostGIS polygon for farm boundary (WGS84)
    boundary = Column(Geometry(geometry_type="POLYGON", srid=4326), nullable=True)
    original_boundary = Column(Geometry(geometry_type="POLYGON", srid=4326), nullable=True)
    boundary_edited = Column(Boolean, default=False)

    khasra_number = Column(String(100), nullable=True)
    land_record_source = Column(String(100), nullable=True)

    sowing_date = Column(Date, nullable=True)
    insurance_policy_number = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    farmer = relationship("User", back_populates="farms")
    claims = relationship("Claim", back_populates="farm", lazy="select")
    satellite_records = relationship("SatelliteData", back_populates="farm", lazy="select")

    def __repr__(self):
        return f"<Farm id={self.id} name={self.name} farmer_id={self.farmer_id}>"
