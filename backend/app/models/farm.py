from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime, ForeignKey, Boolean, JSON
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
    current_version = Column(Integer, default=1)

    # Insurance & Location Verification details
    state = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    taluka = Column(String(100), nullable=True)
    village = Column(String(100), nullable=True)

    gps_latitude = Column(Float, nullable=True)
    gps_longitude = Column(Float, nullable=True)
    gps_accuracy_meters = Column(Float, nullable=True)

    center_pin_latitude = Column(Float, nullable=True)
    center_pin_longitude = Column(Float, nullable=True)

    khasra_number = Column(String(100), nullable=True)
    land_record_source = Column(String(100), default="User Provided")
    verification_status = Column(String(100), default="PENDING_OFFICIAL_VERIFICATION")
    overlap_status = Column(String(50), default="NONE")

    sowing_date = Column(Date, nullable=True)
    insurance_policy_number = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    farmer = relationship("User", back_populates="farms")
    claims = relationship("Claim", back_populates="farm", lazy="select")
    satellite_records = relationship("SatelliteData", back_populates="farm", lazy="select")
    boundary_versions = relationship("FarmBoundaryVersion", back_populates="farm", cascade="all, delete-orphan")
    snapshots = relationship("InsuredLandSnapshot", back_populates="farm", cascade="all, delete-orphan")
    audit_logs = relationship("FarmAuditLog", back_populates="farm", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Farm id={self.id} name={self.name} farmer_id={self.farmer_id}>"


class FarmBoundaryVersion(Base):
    __tablename__ = "farm_boundary_versions"

    id = Column(Integer, primary_key=True, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False)
    boundary_geojson = Column(JSON, nullable=False)
    area_hectares = Column(Float, nullable=False)
    change_reason = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    farm = relationship("Farm", back_populates="boundary_versions")


class InsuredLandSnapshot(Base):
    __tablename__ = "insured_land_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(String(100), unique=True, nullable=False, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False)
    snapshot_data = Column(JSON, nullable=False)
    captured_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    farm = relationship("Farm", back_populates="snapshots")


class FarmAuditLog(Base):
    __tablename__ = "farm_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(100), nullable=False)
    actor = Column(String(100), default="Farmer")
    details = Column(String(1000), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    farm = relationship("Farm", back_populates="audit_logs")
