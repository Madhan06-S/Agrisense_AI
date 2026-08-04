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


class Base(DeclarativeBase):
    pass


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
    async with engine.begin() as conn:
        # Enable PostGIS
        await conn.execute(
            __import__("sqlalchemy").text("CREATE EXTENSION IF NOT EXISTS postgis")
        )
        
        # Alter userrole type to add collector
        try:
            await conn.execute(__import__("sqlalchemy").text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'collector';"))
        except Exception:
            pass
        
        # Raw alters for users
        await conn.execute(__import__("sqlalchemy").text("ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhaar_hash VARCHAR(255);"))
        await conn.execute(__import__("sqlalchemy").text("ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhaar_verified BOOLEAN DEFAULT FALSE;"))
        await conn.execute(__import__("sqlalchemy").text("ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhaar_name VARCHAR(200);"))
        
        # Raw alters for farms
        await conn.execute(__import__("sqlalchemy").text("ALTER TABLE farms ADD COLUMN IF NOT EXISTS original_boundary geometry(POLYGON,4326);"))
        await conn.execute(__import__("sqlalchemy").text("ALTER TABLE farms ADD COLUMN IF NOT EXISTS boundary_edited BOOLEAN DEFAULT FALSE;"))
        await conn.execute(__import__("sqlalchemy").text("ALTER TABLE farms ADD COLUMN IF NOT EXISTS khasra_number VARCHAR(100);"))
        await conn.execute(__import__("sqlalchemy").text("ALTER TABLE farms ADD COLUMN IF NOT EXISTS land_record_source VARCHAR(100);"))
        
        # Raw alters for claims
        await conn.execute(__import__("sqlalchemy").text("ALTER TABLE claims ADD COLUMN IF NOT EXISTS pfms_transaction_id VARCHAR(100);"))
        await conn.execute(__import__("sqlalchemy").text("ALTER TABLE claims ADD COLUMN IF NOT EXISTS scheme_code VARCHAR(100);"))
        await conn.execute(__import__("sqlalchemy").text("ALTER TABLE claims ADD COLUMN IF NOT EXISTS sanction_order_no VARCHAR(100);"))
        await conn.execute(__import__("sqlalchemy").text("ALTER TABLE claims ADD COLUMN IF NOT EXISTS is_parametric BOOLEAN DEFAULT FALSE;"))
        await conn.execute(__import__("sqlalchemy").text("ALTER TABLE claims ADD COLUMN IF NOT EXISTS trigger_source VARCHAR(50);"))
        await conn.execute(__import__("sqlalchemy").text("ALTER TABLE claims ADD COLUMN IF NOT EXISTS imd_alert_id INTEGER;"))
        
        await conn.run_sync(Base.metadata.create_all)
