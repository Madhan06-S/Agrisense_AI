from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from typing import AsyncGenerator
from app.core.config import settings

if "sqlite" in settings.DATABASE_URL:
    import geoalchemy2
    import geoalchemy2.shape
    import shapely.wkt
    from sqlalchemy import String
    geoalchemy2.Geometry = lambda *args, **kwargs: String()
    geoalchemy2.shape.from_shape = lambda shape, *args, **kwargs: str(shape.wkt)
    geoalchemy2.shape.to_shape = lambda val, *args, **kwargs: shapely.wkt.loads(val)


# Create async database engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True
)

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency injection helper for getting db session in FastAPI routes."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
