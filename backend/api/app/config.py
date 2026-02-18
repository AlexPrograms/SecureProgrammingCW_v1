from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = Field(default="Local Vault API", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    app_host: str = Field(default="127.0.0.1", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    app_log_level: str = Field(default="INFO", alias="APP_LOG_LEVEL")
    app_cors_allowed_origin: str = Field(default="http://localhost:5173", alias="APP_CORS_ALLOWED_ORIGIN")
    app_session_idle_minutes: int = Field(default=15, alias="APP_SESSION_IDLE_MINUTES")
    data_dir: Path = Field(default_factory=lambda: Path(__file__).resolve().parents[1] / "data")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def database_path(self) -> Path:
        return self.data_dir / "vault.db"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    return settings
