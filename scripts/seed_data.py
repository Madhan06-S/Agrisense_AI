import app.core.database
import asyncio
import logging
from datetime import date, datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from geoalchemy2.shape import from_shape
from shapely.geometry import Polygon
from sqlalchemy import select

from app.core.config import settings
from app.models.models import Base, User, Farm, SatelliteImage, FeatureVector, Claim, DamageAssessment

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed():
    logger.info("Connecting to database to seed data...")
    url = settings.DATABASE_URL
    
    engine = create_async_engine(url, echo=True)
    
    # Auto-create tables
    async with engine.begin() as conn:
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
            # Clear previous claims/assessments to avoid duplicates
            await session.execute(Base.metadata.tables["damage_assessments"].delete())
            await session.execute(Base.metadata.tables["claims"].delete())
            await session.commit()
            logger.info("Cleared previous claims & assessments.")

            # 1. Create Farmer User
            stmt_f = select(User).where(User.phone == "9876543210")
            res_f = await session.execute(stmt_f)
            farmer = res_f.scalars().first()
            if not farmer:
                farmer = User(
                    email="farmer.singh@agrisense.gov.in",
                    phone="9876543210",
                    aadhaar_number="123412341234",
                    hashed_password="hashed_password_placeholder_123",
                    role="farmer"
                )
                session.add(farmer)
                await session.commit()
                await session.refresh(farmer)
                logger.info(f"Created seed farmer user: {farmer.email}")
            
            # 2. Create Officer User
            stmt_o = select(User).where(User.phone == "9876543299")
            res_o = await session.execute(stmt_o)
            officer = res_o.scalars().first()
            if not officer:
                officer = User(
                    email="officer.sharma@agrisense.gov.in",
                    phone="9876543299",
                    aadhaar_number="987698769876",
                    hashed_password="hashed_password_placeholder_officer",
                    role="officer",
                    pin="1234"
                )
                session.add(officer)
                await session.commit()
                await session.refresh(officer)
                logger.info(f"Created seed officer user: {officer.email}")

            # 3. Create Seed Farms
            poly1 = Polygon([(76.96, 29.54), (76.98, 29.54), (76.98, 29.56), (76.96, 29.56), (76.96, 29.54)])
            gis_poly1 = from_shape(poly1, srid=4326)
            
            stmt_farm1 = select(Farm).where(Farm.name == "Karnal Paddy Block A")
            res_farm1 = await session.execute(stmt_farm1)
            farm1 = res_farm1.scalars().first()
            if not farm1:
                farm1 = Farm(
                    owner_id=farmer.id,
                    name="Karnal Paddy Block A",
                    crop_type="Rice",
                    sowing_date=date(2026, 6, 15),
                    area_hectares=4.82,
                    insurance_policy_number="INS-PMFBY-778210",
                    boundary=gis_poly1,
                    state="Haryana",
                    district="Karnal",
                    taluka="Gharaunda",
                    village="Basdhara",
                    soil_ph=6.5,
                    soil_moisture=0.34,
                    soil_type="Clayey Loam",
                    khasra_number="223/4"
                )
                session.add(farm1)
                await session.commit()
                await session.refresh(farm1)
                logger.info(f"Created seed farm 1: {farm1.name}")

            poly2 = Polygon([(76.98, 29.54), (77.00, 29.54), (77.00, 29.56), (76.98, 29.56), (76.98, 29.54)])
            gis_poly2 = from_shape(poly2, srid=4326)
            
            stmt_farm2 = select(Farm).where(Farm.name == "Karnal Wheat Block B")
            res_farm2 = await session.execute(stmt_farm2)
            farm2 = res_farm2.scalars().first()
            if not farm2:
                farm2 = Farm(
                    owner_id=farmer.id,
                    name="Karnal Wheat Block B",
                    crop_type="Wheat",
                    sowing_date=date(2026, 11, 10),
                    area_hectares=5.12,
                    insurance_policy_number="INS-PMFBY-778211",
                    boundary=gis_poly2,
                    state="Haryana",
                    district="Karnal",
                    taluka="Gharaunda",
                    village="Basdhara",
                    soil_ph=6.7,
                    soil_moisture=0.28,
                    soil_type="Sandy Loam",
                    khasra_number="223/5"
                )
                session.add(farm2)
                await session.commit()
                await session.refresh(farm2)
                logger.info(f"Created seed farm 2: {farm2.name}")

            # 4. Create Seed Claims and Assessments
            # Claim 1: Flood (Auto-Approve Eligible, RED)
            c1 = Claim(
                id=1,
                farm_id=farm1.id,
                farmer_name=farmer.phone,
                farm_name=farm1.name,
                claim_type="flood",
                description="Heavy flood damage in north quadrant.",
                status="under_review",
                submitted_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
            )
            session.add(c1)
            await session.commit()
            
            a1 = DamageAssessment(
                claim_id=c1.id,
                satellite_score=82,
                image_score=88,
                weather_score=90,
                combined_score=85,
                confidence=0.92,
                explanation_json={
                    "satellite_contribution": 0.35,
                    "image_contribution": 0.35,
                    "weather_contribution": 0.30,
                    "key_factors": ["NDVI drop detected: 82%", "Image analysis confidence: 88%", "Weather validation: 90%"]
                }
            )
            session.add(a1)
            await session.commit()
            
            # Claim 2: Drought (Review Required, YELLOW)
            c2 = Claim(
                id=2,
                farm_id=farm2.id,
                farmer_name=farmer.phone,
                farm_name=farm2.name,
                claim_type="drought",
                description="Severe rainfall deficit over 45 days.",
                status="under_review",
                submitted_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
            )
            session.add(c2)
            await session.commit()
            
            a2 = DamageAssessment(
                claim_id=c2.id,
                satellite_score=65,
                image_score=45,
                weather_score=70,
                combined_score=58,
                confidence=0.92,
                explanation_json={
                    "satellite_contribution": 0.35,
                    "image_contribution": 0.35,
                    "weather_contribution": 0.30,
                    "key_factors": ["NDVI drop detected: 65%", "Image analysis confidence: 45%", "Weather validation: 70%"]
                }
            )
            session.add(a2)
            await session.commit()

            # Claim 3: Pest (Rejected, GREEN)
            c3 = Claim(
                id=3,
                farm_id=farm1.id,
                farmer_name=farmer.phone,
                farm_name=farm1.name,
                claim_type="pest",
                description="Minor leaf spotting.",
                status="rejected",
                officer_remarks="Rejected due to insufficient evidence",
                submitted_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
            )
            session.add(c3)
            await session.commit()
            
            a3 = DamageAssessment(
                claim_id=c3.id,
                satellite_score=30,
                image_score=25,
                weather_score=40,
                combined_score=18,
                confidence=0.92,
                explanation_json={
                    "satellite_contribution": 0.35,
                    "image_contribution": 0.35,
                    "weather_contribution": 0.30,
                    "key_factors": ["NDVI drop detected: 30%", "Image analysis confidence: 25%", "Weather validation: 40%"]
                }
            )
            session.add(a3)
            await session.commit()
            
            logger.info("Database seeding completed successfully with realistic claims data.")
            
        except Exception as e:
            logger.error(f"Seeding failed: {e}")
            await session.rollback()
            raise e
        finally:
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed())
