import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database configuration - supports both local SQLite and Turso (libsql)
    # For local dev: sqlite+aiosqlite:///./nexus.db
    # For Turso: sqlite+libsql://<db-name>.turso.io?auth_token=<token>
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./nexus.db")
    
    # Turso specific settings (alternative to embedding in DATABASE_URL)
    TURSO_DATABASE_URL: str = os.getenv("TURSO_DATABASE_URL", "")
    TURSO_AUTH_TOKEN: str = os.getenv("TURSO_AUTH_TOKEN", "")
    
    # JWT settings
    JWT_SECRET: str = "hogwarts-nexus-lumiere-secret-key-2024"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

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

    # Cloudinary settings for file uploads
    CLOUDINARY_CLOUD_NAME: str = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY: str = os.getenv("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET: str = os.getenv("CLOUDINARY_API_SECRET", "")

    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
