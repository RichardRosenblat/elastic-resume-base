from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    gcp_project_id: str = ""
    port: int = 8004
    log_level: str = "INFO"
    max_file_size_mb: int = 10


settings = Settings()
