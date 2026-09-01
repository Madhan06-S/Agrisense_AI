import os
import sys
import asyncio
import logging
import shapely.wkt
import geoalchemy2
from geoalchemy2.types import Geometry
from sqlalchemy.ext.compiler import compiles

from sqlalchemy import String

# Monkey-patch geoalchemy2 Geometry & shape converters for SQLite compatibility
geoalchemy2.Geometry = lambda *args, **kwargs: String()
geoalchemy2.shape.from_shape = lambda shape, *args, **kwargs: str(shape.wkt)
geoalchemy2.shape.to_shape = lambda val, *args, **kwargs: shapely.wkt.loads(val)

# Override DATABASE_URL to use SQLite
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///agrisense.db"

# Now import the seed function
from scripts.seed_data import seed

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("Initializing SQLite database 'agrisense.db'...")
    if os.path.exists("agrisense.db"):
        try:
            os.remove("agrisense.db")
        except Exception as e:
            print(f"Could not remove existing agrisense.db: {e}")
            
    asyncio.run(seed())
    print("Database initialization complete.")
