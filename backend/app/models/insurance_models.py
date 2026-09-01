from datetime import datetime, timezone, date
from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class InsuranceScheme(Base):
    __tablename__ = "insurance_schemes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)  # PMFBY, RWBCIS
    name = Column(String(200), nullable=False)
    type = Column(String(50), nullable=False)  # YIELD_BASED, WEATHER_INDEX_PARAMETRIC
    description = Column(Text, nullable=True)
    active = Column(Boolean, default=True, nullable=False)

    # Relationships
    policies = relationship("InsurancePolicy", back_populates="scheme")
    trigger_configs = relationship("ParametricTriggerConfig", back_populates="scheme")

    def __repr__(self):
        return f"<InsuranceScheme id={self.id} code={self.code} name={self.name}>"


class InsurancePolicy(Base):
    __tablename__ = "insurance_policies"

    id = Column(Integer, primary_key=True, index=True)
    policy_number = Column(String(100), unique=True, nullable=False, index=True)
    scheme_id = Column(Integer, ForeignKey("insurance_schemes.id", ondelete="CASCADE"), nullable=False)
    farm_id = Column(Integer, ForeignKey("farms.id", ondelete="CASCADE"), nullable=False)
    crop = Column(String(100), nullable=False)
    season = Column(String(50), nullable=False, default="Kharif")  # Kharif, Rabi, Zaid
    coverage_start = Column(Date, nullable=True)
    coverage_end = Column(Date, nullable=True)
    sum_insured = Column(Float, nullable=True, default=100000.0)
    status = Column(String(50), nullable=False, default="ACTIVE")  # ACTIVE, EXPIRED, CANCELLED
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    scheme = relationship("InsuranceScheme", back_populates="policies")
    farm = relationship("Farm", back_populates="policies")
    coverages = relationship("PolicyCoverage", back_populates="policy", cascade="all, delete-orphan")
    claims = relationship("Claim", back_populates="policy")

    def __repr__(self):
        return f"<InsurancePolicy id={self.id} number={self.policy_number} scheme_id={self.scheme_id}>"


class PolicyCoverage(Base):
    __tablename__ = "policy_coverages"

    id = Column(Integer, primary_key=True, index=True)
    policy_id = Column(Integer, ForeignKey("insurance_policies.id", ondelete="CASCADE"), nullable=False)
    coverage_type = Column(String(100), nullable=False)  # Standing Crop / Yield Loss, Prevented Sowing, Localized Calamity, Mid-Season Adversity, Post-Harvest Loss
    description = Column(Text, nullable=True)
    active = Column(Boolean, default=True, nullable=False)

    # Relationships
    policy = relationship("InsurancePolicy", back_populates="coverages")

    def __repr__(self):
        return f"<PolicyCoverage id={self.id} type={self.coverage_type}>"


class ParametricTriggerConfig(Base):
    __tablename__ = "parametric_trigger_configs"

    id = Column(Integer, primary_key=True, index=True)
    scheme_id = Column(Integer, ForeignKey("insurance_schemes.id", ondelete="CASCADE"), nullable=False)
    crop = Column(String(100), nullable=False)
    parameter = Column(String(50), nullable=False)  # rainfall, temperature, wind, drought_spi
    threshold = Column(Float, nullable=True)  # configured threshold or null if unconfigured
    measurement_period = Column(String(100), nullable=True)  # e.g., 30_days, monsoon_season
    reference_source = Column(String(100), nullable=True)  # IMD_WEATHER_STATION, SAT_RAINFALL
    payout_rule = Column(String(100), nullable=True)  # TIERED_PERCENTAGE, FIXED_PER_HECTARE
    applicable_location = Column(String(100), nullable=True)
    active = Column(Boolean, default=True, nullable=False)

    # Relationships
    scheme = relationship("InsuranceScheme", back_populates="trigger_configs")

    def __repr__(self):
        return f"<ParametricTriggerConfig id={self.id} param={self.parameter} crop={self.crop}>"
