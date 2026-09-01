import sys
import os
from unittest.mock import MagicMock

# 1. Mock 'ee' (Google Earth Engine) module before it's imported
mock_ee = MagicMock()
class MockEEException(Exception):
    pass
mock_ee.EEException = MockEEException

# Define standard image queries mock behavior
mock_img = MagicMock()
mock_img.getInfo.return_value = {"type": "Image", "bands": [{"id": "B2"}]}
mock_img.select.return_value.clip.return_value = mock_img
mock_img.getDownloadURL.return_value = "http://localhost:9000/mock-download-url"
mock_ee.Image.return_value = mock_img

mock_geom = MagicMock()
mock_geom.buffer.return_value = mock_geom
mock_ee.Geometry.return_value = mock_geom

# Setup chained mock builder pattern for ee.ImageCollection
mock_collection = MagicMock()
mock_collection.filterBounds.return_value = mock_collection
mock_collection.filterDate.return_value = mock_collection
mock_collection.filter.return_value = mock_collection

mock_collection.size.return_value.getInfo.return_value = 1
# Default mock images list
mock_collection.toList.return_value.getInfo.return_value = [
    {
        "id": "COPERNICUS/S2_SR_HARMONIZED/img1",
        "properties": {
            "system:time_start": 1784080000000,
            "CLOUDY_PIXEL_PERCENTAGE": 12.5,
            "SENSING_ORBIT_NUMBER": 42
        }
    }
]
mock_ee.ImageCollection.return_value = mock_collection

sys.modules['ee'] = mock_ee

# 2. Mock google.auth.default
import google.auth
mock_google_auth_default = MagicMock(return_value=(MagicMock(), "mock-project-id"))
google.auth.default = mock_google_auth_default

# 3. Monkey-patch geoalchemy2 Geometry & shape converters for SQLite compatibility
import geoalchemy2
import geoalchemy2.shape
import shapely.wkt
from sqlalchemy import String

# Compile Geometry as a VARCHAR string in SQLite
geoalchemy2.Geometry = lambda *args, **kwargs: String()
# Convert shape to WKT text on write
geoalchemy2.shape.from_shape = lambda shape, *args, **kwargs: str(shape.wkt)
# Parse WKT text back to shape on read
geoalchemy2.shape.to_shape = lambda val, *args, **kwargs: shapely.wkt.loads(val)

# Set testing environment variables explicitly
os.environ["GEE_KEY_CONTENT"] = ""
os.environ["GEE_KEY_FILE"] = ""
os.environ["GEE_SERVICE_ACCOUNT"] = ""
os.environ["GEE_PROJECT"] = "mock-project"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///test.db"
os.environ["REDIS_URL"] = "redis://localhost:6379/9"
os.environ["STORAGE_BACKEND"] = "local"
os.environ["LOCAL_STORAGE_DIR"] = "/tmp/agrisense_test_storage"

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.database import Base
import app.models
import app.models.insurance_models

# Configure Celery tasks to run synchronously in tests
from app.tasks.celery_app import celery
celery.conf.task_always_eager = True
celery.conf.task_eager_propagates = True


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"

@pytest_asyncio.fixture(scope="function")
async def db_session():
    # Remove existing test.db if it exists to start fresh
    if os.path.exists("test.db"):
        try:
            os.remove("test.db")
        except Exception:
            pass

    engine = create_async_engine("sqlite+aiosqlite:///test.db", future=True)
    
    # Strip postgresql-specific partitioning from metadata dialect_options for SQLite compatibility
    for table in Base.metadata.tables.values():
        if 'postgresql' in table.dialect_options:
            opts = table.dialect_options['postgresql']
            if hasattr(opts, '_non_defaults') and 'partition_by' in opts._non_defaults:
                opts.pop('partition_by', None)
            
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    AsyncSessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False
    )

    # Patch AsyncSessionLocal globally in all imported modules
    import app.core.database
    import app.tasks.satellite_tasks
    app.core.database.AsyncSessionLocal = AsyncSessionLocal
    app.tasks.satellite_tasks.AsyncSessionLocal = AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        yield session

    await engine.dispose()
    
    # Cleanup test.db
    if os.path.exists("test.db"):
        try:
            os.remove("test.db")
        except Exception:
            pass
