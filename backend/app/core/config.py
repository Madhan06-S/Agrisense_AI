import os
from typing import Optional
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_DB_PATH = os.path.join(_BASE_DIR, "agrisense.db")

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "AgriSense AI"
    API_V1_STR: str = "/api/v1"
    
    SECRET_KEY: str = "agrisense_dev_secret_key_minimum_32_characters_long"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 240
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Cookies
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"
    
    # Payments & Webhooks
    UPI_WEBHOOK_SECRET: str = "agrisense_upi_webhook_secret_key"
    ALERT_WEBHOOK_URL: Optional[str] = None
    
    # Database
    DATABASE_URL: str = f"sqlite+aiosqlite:///{_DB_PATH}"
    
    # Redis & Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # OpenWeatherMap
    OPENWEATHER_API_KEY: Optional[str] = None

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

    @property
    def DEMO_MODE(self) -> bool:
        return self.ENVIRONMENT.lower() != "production"

    @model_validator(mode="after")
    def validate_production_config(self):
        if self.ENVIRONMENT.lower() == "production":
            insecure_keys = [
                "agrisense_dev_secret_key_minimum_32_characters_long",
                "government_secure_key_for_agrisense",
                "secret",
                "changeme",
                "123456"
            ]
            if not self.SECRET_KEY or len(self.SECRET_KEY) < 32 or self.SECRET_KEY in insecure_keys:
                raise ValueError("Invalid or insecure SECRET_KEY in production mode. Must be at least 32 characters long.")
            
            if "sqlite" in self.DATABASE_URL.lower():
                raise ValueError("SQLite DATABASE_URL is not permitted in production environment.")
            
            if self.STORAGE_BACKEND.lower() == "minio":
                if self.MINIO_ACCESS_KEY == "minioadmin" or self.MINIO_SECRET_KEY == "minioadminpassword":
                    raise ValueError("Default MinIO credentials are not permitted in production mode.")
                if not self.MINIO_SECURE:
                    raise ValueError("MinIO TLS (MINIO_SECURE=True) is required in production mode.")
        return self

settings = Settings()

