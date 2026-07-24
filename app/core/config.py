from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "AgriSense AI"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgrespassword@localhost:5432/agrisense"
    
    # Redis & Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Google Earth Engine (GEE)
    GEE_SERVICE_ACCOUNT: Optional[str] = None
    GEE_KEY_FILE: Optional[str] = None
    GEE_KEY_CONTENT: Optional[str] = None  # Support JSON key string directly
    GEE_PROJECT: Optional[str] = None
    
    # Storage
    STORAGE_BACKEND: str = "local"  # 'local' or 'minio'
    LOCAL_STORAGE_DIR: str = "./data"
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadminpassword"
    MINIO_SECURE: bool = False
    MINIO_BUCKET_RAW: str = "raw-data"
    MINIO_BUCKET_PROCESSED: str = "processed-data"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
