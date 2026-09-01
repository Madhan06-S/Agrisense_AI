from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

# Monkey patch GeoAlchemy2 Geometry for SQLite since SQLite doesn't have spatialite extension loaded by default
if "sqlite" in settings.DATABASE_URL:
    import geoalchemy2
    import geoalchemy2.shape
    import shapely.wkt
    from sqlalchemy import String
    geoalchemy2.Geometry = lambda *args, **kwargs: String()
    geoalchemy2.shape.from_shape = lambda shape, *args, **kwargs: str(shape.wkt)
    geoalchemy2.shape.to_shape = lambda val, *args, **kwargs: shapely.wkt.loads(val)

class Base(DeclarativeBase):
    pass

# Import models so Base.metadata is populated
from app.models.insurance_models import InsuranceScheme, InsurancePolicy, PolicyCoverage, ParametricTriggerConfig


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)





async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables():
    """Create all tables (used in dev). In prod, use Alembic migrations."""
    import app.models
    import app.models.insurance_models  # Register insurance models on Base.metadata
    async with engine.begin() as conn:
        # Enable PostGIS (PostgreSQL only)
        try:
            await conn.execute(
                __import__("sqlalchemy").text("CREATE EXTENSION IF NOT EXISTS postgis")
            )
        except Exception:
            pass
        
        # Alter userrole type to add collector
        try:
            await conn.execute(__import__("sqlalchemy").text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'collector';"))
        except Exception:
            pass
        
        # Raw alters for users
        try:
            await conn.execute(__import__("sqlalchemy").text("ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhaar_hash VARCHAR(255);"))
            await conn.execute(__import__("sqlalchemy").text("ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhaar_verified BOOLEAN DEFAULT FALSE;"))
            await conn.execute(__import__("sqlalchemy").text("ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhaar_name VARCHAR(200);"))
        except Exception:
            pass
        
        # Raw alters for farms
        farm_cols = [
            "farmer_id INTEGER",
            "owner_id INTEGER",
            "khasra_number VARCHAR(100)",
            "land_record_source VARCHAR(100)",
            "insurance_policy_number VARCHAR(100)",
            "boundary_edited BOOLEAN DEFAULT FALSE"
        ]
        for col_def in farm_cols:
            try:
                if "sqlite" in settings.DATABASE_URL:
                    await conn.execute(__import__("sqlalchemy").text(f"ALTER TABLE farms ADD COLUMN {col_def};"))
                else:
                    await conn.execute(__import__("sqlalchemy").text(f"ALTER TABLE farms ADD COLUMN IF NOT EXISTS {col_def};"))
            except Exception:
                pass
        
        # Raw alters for claims
        claim_cols = [
            "pfms_transaction_id VARCHAR(100)",
            "scheme_code VARCHAR(100)",
            "sanction_order_no VARCHAR(100)",
            "is_parametric BOOLEAN DEFAULT FALSE",
            "trigger_source VARCHAR(50)",
            "imd_alert_id INTEGER",
            "payout_amount FLOAT",
            "damage_percent FLOAT",
            "farm_area FLOAT",
            "sum_insured FLOAT",
            "policy_id INTEGER",
            "insured_snapshot_id VARCHAR(100)",
            "insured_boundary_version INTEGER DEFAULT 1",
            "coverage_type VARCHAR(100)",
            "damage_type VARCHAR(100)"
        ]
        for col_def in claim_cols:
            col_name = col_def.split()[0]
            try:
                if "sqlite" in settings.DATABASE_URL:
                    await conn.execute(__import__("sqlalchemy").text(f"ALTER TABLE claims ADD COLUMN {col_def};"))
                else:
                    await conn.execute(__import__("sqlalchemy").text(f"ALTER TABLE claims ADD COLUMN IF NOT EXISTS {col_def};"))
            except Exception:
                pass
        
        await conn.run_sync(Base.metadata.create_all)
