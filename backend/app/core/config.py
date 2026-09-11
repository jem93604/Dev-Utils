from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "SQL Hub API"
    database_url: str = "sqlite:///./sqlhub.db"
    # Sync URL used by Alembic (same driver)
    auth_enabled: bool = True
    allow_signup: bool = True
    # Set true ONLY for local dev with the default JWT secret.
    # Production must set a strong JWT_SECRET instead.
    allow_insecure_default_secret: bool = False
    default_user_email: str = "local@sqlhub.internal"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    jwt_secret: str = "change-me-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 3
    # Rate limits (per IP + endpoint, per minute)
    auth_rate_limit_per_min: int = 10
    media_rate_limit_per_min: int = 20

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def check_secret(self) -> None:
        """Fail closed if auth is on with the shipped default secret.

        Tests set JWT_SECRET=test-secret; local dev can opt into the
        insecure default with ALLOW_INSECURE_DEFAULT_SECRET=true.
        """
        if not self.auth_enabled:
            return
        if self.jwt_secret == "change-me-in-prod" and not self.allow_insecure_default_secret:
            raise RuntimeError(
                "JWT_SECRET is still the default. Generate one "
                "(e.g. `openssl rand -hex 32`), put it in backend/.env, "
                "and restart. For throwaway local dev only, set "
                "ALLOW_INSECURE_DEFAULT_SECRET=true."
            )


settings = Settings()
