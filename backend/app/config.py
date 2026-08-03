import os
from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database configuration - supports both local SQLite and Turso (libsql)
    # For local dev: sqlite+aiosqlite:///./nexus.db
    # For Turso: sqlite+libsql://<db-name>.turso.io?auth_token=<token>
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./nexus.db")
    
    # Turso specific settings (alternative to embedding in DATABASE_URL)
    TURSO_DATABASE_URL: str = os.getenv("TURSO_DATABASE_URL", "")
    TURSO_AUTH_TOKEN: str = os.getenv("TURSO_AUTH_TOKEN", "")
    
    # CORS: comma-separated list of allowed frontend origins for production,
    # e.g. "https://mi-app.vercel.app,https://mi-dominio.com". If empty, a safe
    # default regex allows localhost (dev) and any *.vercel.app deploy.
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "")

    # JWT settings
    # JWT_SECRET must come from the environment (backend/.env or deployed env).
    # Generate one with: python -c "import secrets; print(secrets.token_hex(32))"
    JWT_SECRET: str = os.getenv("JWT_SECRET", "")
    JWT_ALGORITHM: str = "HS256"
    # Short-lived access token: refreshed automatically via /auth/refresh.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    # Long-lived refresh token stored in an httpOnly cookie.
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 14
    # Set to true in production so auth cookies are only sent over HTTPS.
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "").lower() in ("1", "true", "yes", "on")

    # Message retention: delete messages (and their uploaded attachments) older
    # than this many days, except pinned ones. Set to 0 to disable entirely.
    MESSAGE_RETENTION_DAYS: int = 90
    # How often the background purge runs, in hours.
    RETENTION_SWEEP_HOURS: int = 24

    # Pet stat decay: points lost per hour while unattended (clamped at 0).
    # Applied lazily whenever a creature's stats are read or mutated.
    HUNGER_DECAY_PER_HOUR: float = 5.0
    HAPPINESS_DECAY_PER_HOUR: float = 3.0

    # Pet lifespan in days. A pet ages from its adoption date; past this it
    # "se despide" (is retired). A heads-up is sent once near the end.
    PET_LIFESPAN_DAYS: int = 120
    # Fraction of life after which the farewell heads-up is sent (0-1).
    PET_FAREWELL_WARN_FRACTION: float = 0.85

    # A pet "needs attention" once hunger drops to/below PET_ATTENTION_HUNGER or
    # happiness drops to/below PET_ATTENTION_HAPPINESS. A background sweep checks
    # every PET_CARE_SWEEP_HOURS and notifies the owner once per lapse.
    PET_ATTENTION_HUNGER: int = 20
    PET_ATTENTION_HAPPINESS: int = 20
    PET_CARE_SWEEP_HOURS: int = 6

    # Critical state: either hunger OR happiness at 0.
    # If either stays at 0 for PET_ESCAPE_GRACE_HOURS, the pet escapes.
    PET_ESCAPE_GRACE_HOURS: float = 6.0
    # Visual critical threshold: pulse animation when either stat <= this value.
    PET_CRITICAL_THRESHOLD: int = 10

    # Cloudinary settings for file uploads
    CLOUDINARY_CLOUD_NAME: str = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY: str = os.getenv("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET: str = os.getenv("CLOUDINARY_API_SECRET", "")

    # Redis settings for caching and pub/sub
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    REDIS_MAX_CONNECTIONS: int = 10

    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    # VAPID keys for Web Push
    VAPID_PUBLIC_KEY: str = os.getenv("VAPID_PUBLIC_KEY", "")
    VAPID_PRIVATE_KEY: str = os.getenv("VAPID_PRIVATE_KEY", "")
    VAPID_SUBJECT: str = os.getenv("VAPID_SUBJECT", "mailto:admin@hogwarts-nexus.example")

    # At-rest encryption key for sensitive data (private keys, etc.)
    # Generate with: python -c "import secrets; print(secrets.token_hex(32))"
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "")

    class Config:
        env_file = ".env"
        extra = "ignore"

    @model_validator(mode="after")
    def _validate_secrets(self):
        if not self.JWT_SECRET:
            raise ValueError(
                "JWT_SECRET must be set in the environment (backend/.env). "
                "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        if not self.ENCRYPTION_KEY:
            raise ValueError(
                "ENCRYPTION_KEY must be set in the environment (backend/.env). "
                "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        return self


settings = Settings()
