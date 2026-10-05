from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_name: str = "EduGuard API"
    environment: Literal["development", "test", "production"] = "development"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://eduguard:eduguard@localhost:5432/eduguard"
    jwt_secret: SecretStr = SecretStr("development-only-change-this-secret-32-characters")
    jwt_algorithm: Literal["HS256"] = "HS256"
    access_token_minutes: int = Field(default=30, ge=1, le=60)
    refresh_token_days: int = Field(default=14, ge=1, le=90)
    cors_origins: str = "http://localhost:5173"
    log_level: str = "INFO"
    model_bundle_path: str = "artifacts/eduguard_risk_model.joblib"
    model_metadata_path: str = "artifacts/model_metadata.json"

    @model_validator(mode="after")
    def validate_secret(self) -> "Settings":
        secret = self.jwt_secret.get_secret_value()
        if len(secret) < 32 or (
            self.environment == "production" and secret.startswith("development-only")
        ):
            raise ValueError("JWT_SECRET must be at least 32 characters and private in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
