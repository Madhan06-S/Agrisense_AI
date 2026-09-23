from datetime import datetime, timezone, date
from typing import Optional
from sqlalchemy import (
    Column, Integer, String, Float, Text, DateTime, Date, ForeignKey, Boolean
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class GrazingZone(Base):
    __tablename__ = "grazing_zones"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    state = Column(String(100), nullable=False)
    district = Column(String(100), nullable=False)
    boundary_geojson = Column(Text, nullable=True)
    centroid_lat = Column(Float, nullable=False, default=18.5204)
    centroid_lng = Column(Float, nullable=False, default=73.8567)
    num_households = Column(Integer, default=120)
    livestock_count = Column(Integer, default=850)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    vci_readings = relationship("VCIReading", back_populates="zone", cascade="all, delete-orphan")
    policies = relationship("AFIIPolicy", back_populates="zone", cascade="all, delete-orphan")
    payouts = relationship("AFIIPayout", back_populates="zone", cascade="all, delete-orphan")


class VCIReading(Base):
    __tablename__ = "vci_readings"

    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("grazing_zones.id", ondelete="CASCADE"), nullable=False)
    date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    vci_score = Column(Float, nullable=False)  # 0 to 100
    ndvi_current = Column(Float, nullable=False)
    ndvi_long_term_mean = Column(Float, nullable=False, default=0.55)
    ndvi_min = Column(Float, nullable=False, default=0.15)
    ndvi_max = Column(Float, nullable=False, default=0.75)
    source = Column(String(50), default="sentinel-2")

    zone = relationship("GrazingZone", back_populates="vci_readings")


class AFIIPolicy(Base):
    __tablename__ = "afii_policies"

    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("grazing_zones.id", ondelete="CASCADE"), nullable=False)
    premium_amount = Column(Float, nullable=False, default=1500.0)
    sum_insured_per_household = Column(Float, nullable=False, default=25000.0)
    survival_baseline_vci = Column(Float, nullable=False, default=35.0)  # Default 35% trigger
    active = Column(Boolean, default=True)
    season = Column(String(50), default="Kharif 2026")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    zone = relationship("GrazingZone", back_populates="policies")
    payouts = relationship("AFIIPayout", back_populates="policy", cascade="all, delete-orphan")


class AFIIPayout(Base):
    __tablename__ = "afii_payouts"

    id = Column(Integer, primary_key=True, index=True)
    policy_id = Column(Integer, ForeignKey("afii_policies.id", ondelete="CASCADE"), nullable=False)
    zone_id = Column(Integer, ForeignKey("grazing_zones.id", ondelete="CASCADE"), nullable=False)
    trigger_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    vci_at_trigger = Column(Float, nullable=False)
    payout_per_household = Column(Float, nullable=False, default=25000.0)
    total_payout = Column(Float, nullable=False)
    households_covered = Column(Integer, nullable=False)
    status = Column(String(50), default="triggered")  # triggered | processing | paid
    reference_id = Column(String(100), unique=True, nullable=False)
    reviewed_at = Column(DateTime, nullable=True)

    zone = relationship("GrazingZone", back_populates="payouts")
    policy = relationship("AFIIPolicy", back_populates="payouts")
