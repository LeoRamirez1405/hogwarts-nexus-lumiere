from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./nexus.db"
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

    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
