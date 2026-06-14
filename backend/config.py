from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── LLM ───────────────────────────────────────────────
    GROQ_API_KEY: str = ""
    GROQ_MODEL_PRO: str = "llama-3.3-70b-versatile"
    GROQ_MODEL_FLASH: str = "llama-3.1-8b-instant"

    # ── Database (Neon PostgreSQL) ─────────────────────────
    # Pooler URL: postgresql://...  — used directly by asyncpg
    # For LangGraph checkpoint (psycopg) Phase 3 will derive the psycopg URL
    NEON_DB_URL: str = ""

    # ── Redis (Upstash-style separate fields) ───────────────
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_USERNAME: str = "default"
    REDIS_PASSWORD: str = ""

    # ── Vector DB (ChromaDB) ───────────────────────────────
    CHROMA_MODE: str = "local"       # local | server
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8001

    # ── Email (Resend) ────────────────────────────────────
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = ""
    RESEND_FROM_NAME: str = ""

    # ── Events (Inngest) — Phase 8+ ───────────────────────
    INNGEST_SIGNING_KEY: str = ""
    INNGEST_EVENT_KEY: str = ""

    # ── Auth (Clerk) — Phase 11+ ──────────────────────────
    CLERK_SECRET_KEY: str = ""
    CLERK_PUBLISHABLE_KEY: str = ""

    # ── Monitoring — Phase 16+ ────────────────────────────
    SENTRY_DSN: str = ""

    # ── App ───────────────────────────────────────────────
    ALLOWED_ORIGIN: str = "http://localhost:3000"
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"

    @property
    def redis_url(self) -> str:
        """Construct Redis URL from separate fields."""
        if self.REDIS_PASSWORD:
            return (
                f"redis://{self.REDIS_USERNAME}:{self.REDIS_PASSWORD}"
                f"@{self.REDIS_HOST}:{self.REDIS_PORT}"
            )
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}"

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"


settings = Settings()
