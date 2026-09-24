from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Index, JSON, Date
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
from geoalchemy2 import Geometry

from app.core.database import Base
from app.models.user import User
from app.models.farm import Farm


class SatelliteImage(Base):
    __tablename__ = "satellite_images"

    id = Column(Integer, primary_key=True, autoincrement=True)
    farm_id = Column(Integer, ForeignKey("farms.id"), nullable=False)
    source = Column(String, nullable=False)  # 'sentinel-1', 'sentinel-2', 'liss-4'
    acquisition_date = Column(Date, nullable=False)
    
    # Band file paths
    red = Column(String, nullable=True)
    green = Column(String, nullable=True)
    blue = Column(String, nullable=True)
    nir = Column(String, nullable=True)
    swir1 = Column(String, nullable=True)
    swir2 = Column(String, nullable=True)
    
    cloud_cover = Column(Float, default=0.0, nullable=False)
    resolution = Column(Float, nullable=False)
    crs = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    
    is_processed = Column(Boolean, default=False, nullable=False)
    is_reconstructed = Column(Boolean, default=False, nullable=False)
    reconstruction_quality = Column(Float, nullable=True)
    
    # Metadata properties
    extra_metadata = Column(JSON, nullable=True)

    farm = relationship("Farm", back_populates="images")

    __table_args__ = (
        Index("idx_sat_img_farm_date", "farm_id", "acquisition_date"),
        Index("idx_sat_img_date", "acquisition_date"),
        {
            "postgresql_partition_by": "RANGE (acquisition_date)"
        }
    )


class FeatureVector(Base):
    __tablename__ = "feature_vectors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    farm_id = Column(Integer, ForeignKey("farms.id"), nullable=False)
    date = Column(Date, nullable=False)
    
    # Vegetation Indices
    ndvi = Column(Float, nullable=True)
    ndwi = Column(Float, nullable=True)
    evi = Column(Float, nullable=True)
    savi = Column(Float, nullable=True)
    gndvi = Column(Float, nullable=True)
    ndre = Column(Float, nullable=True)
    msi = Column(Float, nullable=True)
    ndbi = Column(Float, nullable=True)
    nbr = Column(Float, nullable=True)
    gci = Column(Float, nullable=True)
    
    # Trends and Stress
    ndvi_trend = Column(Float, nullable=True)
    rainfall_anomaly = Column(Float, nullable=True)
    temperature_stress = Column(Float, nullable=True)
    
    is_valid = Column(Boolean, default=True, nullable=False)
    outlier_flags = Column(JSON, nullable=True)

    farm = relationship("Farm", back_populates="features")

    __table_args__ = (
        Index("idx_feat_vec_farm_date", "farm_id", "date"),
        Index("idx_feat_vec_date", "date"),
        {
            "postgresql_partition_by": "RANGE (date)"
        }
    )


class DataPipelineRun(Base):
    __tablename__ = "data_pipeline_runs"

    id = Column(Integer, primary_key=True, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id"), nullable=False)
    run_type = Column(String, nullable=False)  # 'fetch', 'preprocess', 'reconstruct', 'feature_cube'
    status = Column(String, default="pending", nullable=False)  # 'pending', 'running', 'success', 'failed'
    
    started_at = Column(DateTime, default=func.now(), nullable=False)
    completed_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    
    tasks_completed = Column(Integer, default=0, nullable=False)
    tasks_failed = Column(Integer, default=0, nullable=False)
    error_log = Column(String, nullable=True)

    farm = relationship("Farm", back_populates="pipeline_runs")

    __table_args__ = (
        Index("idx_pipeline_run_farm", "farm_id"),
        Index("idx_pipeline_run_status", "status"),
    )


class DatasetVersion(Base):
    __tablename__ = "dataset_versions"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String, unique=True, nullable=False)
    timestamp = Column(DateTime, default=func.now(), nullable=False)
    commit_hash = Column(String, nullable=False)
    schema_version = Column(String, nullable=False)
    checksum = Column(String, nullable=False)
    data = Column(JSON, nullable=False)

    __table_args__ = (
        Index("idx_dataset_versions_version", "version"),
    )



from app.models.claim import Claim
from app.models.damage_assessment import DamageAssessment
