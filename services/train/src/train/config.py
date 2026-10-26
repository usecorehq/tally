from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Same single env file at the repo root as every other app.
ROOT_ENV = Path(__file__).resolve().parents[4] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_ENV, extra="ignore")

    qore_catalog_base_url: str = "http://localhost:3100"
    qore_catalog_api_key: str = ""
    supabase_db_url: str = ""


settings = Settings()
