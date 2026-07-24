import asyncio
import logging
from datetime import date, datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from geoalchemy2.shape import from_shape
from shapely.geometry import Polygon

from app.core.config import settings
from app.models.models import Base, User, Farm, SatelliteImage, FeatureVector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed():
    logger.info("Connecting to database to seed data...")
    url = settings.DATABASE_URL
    
    # Enable statement echoing for diagnostic visibility
    engine = create_async_engine(url, echo=True)
    
    # Auto-create tables for convenience in local test environments
    async with engine.begin() as conn:
        try:
            # Enable PostGIS extension first
            await conn.execute(Base.metadata.schema.create_all)
        except Exception:
            pass
            
        try:
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Database schema applied.")
        except Exception as e:
            logger.error(f"Skipped schema auto-apply: {e}")
            
    AsyncSessionLocal = sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    async with AsyncSessionLocal() as session:
        try:
            # 1. Create a Seed User
            user = User(
                email="farmer.singh@agrisense.gov.in",
                phone="9876543210",
                aadhaar_number="123412341234",
                hashed_password="hashed_password_placeholder_123"
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            logger.info(f"Created seed user: {user.email}")
            
            # 2. Create a Seed Farm in Karnal, Haryana
            poly = Polygon([
                (76.96, 29.54),
                (76.98, 29.54),
                (76.98, 29.56),
                (76.96, 29.56),
                (76.96, 29.54)
            ])
            gis_boundary = from_shape(poly, srid=4326)
            
            farm = Farm(
                owner_id=user.id,
                name="Karnal Paddy Block A",
                crop_type="Rice",
                sowing_date=date(2026, 6, 15),
                area_hectares=4.82,
                insurance_policy_number="INS-PMFBY-778210",
                boundary=gis_boundary,
                state="Haryana",
                district="Karnal",
                taluka="Gharaunda",
                village="Basdhara",
                soil_ph=6.5,
                soil_moisture=0.34,
                soil_type="Clayey Loam",
                khasra_number="223/4"
            )
            session.add(farm)
            await session.commit()
            await session.refresh(farm)
            logger.info(f"Created seed farm: {farm.name}")
            
            # 3. Create Seed Satellite Images
            img1 = SatelliteImage(
                farm_id=farm.id,
                source="sentinel-2",
                acquisition_date=date(2026, 7, 1),
                file_path=f"farm-{farm.id}/sentinel-2/2026-07-01/bands.tif",
                cloud_cover=12.4,
                resolution=10.0,
                crs="EPSG:4326",
                is_processed=True,
                is_reconstructed=False
            )
            
            img2 = SatelliteImage(
                farm_id=farm.id,
                source="sentinel-1",
                acquisition_date=date(2026, 7, 3),
                file_path=f"farm-{farm.id}/sentinel-1/2026-07-03/sar.tif",
                cloud_cover=0.0,
                resolution=10.0,
                crs="EPSG:4326",
                is_processed=True,
                is_reconstructed=False
            )
            session.add_all([img1, img2])
            await session.commit()
            logger.info("Created seed satellite images.")
            
            # 4. Create Seed Feature Vectors
            fv = FeatureVector(
                farm_id=farm.id,
                date=date(2026, 7, 1),
                ndvi=0.68,
                ndwi=-0.15,
                evi=0.52,
                savi=0.58,
                gndvi=0.62,
                ndre=0.32,
                msi=0.74,
                ndbi=-0.24,
                nbr=0.45,
                gci=2.1,
                ndvi_trend=0.02,
                rainfall_anomaly=2.4,
                temperature_stress=0.5,
                is_valid=True,
                outlier_flags={"outliers": []}
            )
            session.add(fv)
            await session.commit()
            logger.info("Created seed feature vectors.")
            
            logger.info("Database seeding completed successfully.")
            
        except Exception as e:
            logger.error(f"Seeding failed: {e}")
            await session.rollback()
            raise e
        finally:
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed())
