from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "SQL Hub API"
    database_url: str = "sqlite:///./sqlhub.db"
    # Sync URL used by Alembic (same driver)
    auth_enabled: bool = False
    default_user_email: str = "local@sqlhub.internal"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    jwt_secret: str = "change-me-in-prod"
    jwt_algorithm: str = "HS256"

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
