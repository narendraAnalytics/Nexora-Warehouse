import asyncpg
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.store.postgres import AsyncPostgresStore
from config import settings


async def create_pool() -> asyncpg.Pool:
    return await asyncpg.create_pool(
        settings.NEON_DB_URL,
        ssl="require",                          # explicit SSL — asyncpg ignores sslmode= in DSN
        min_size=2,
        max_size=10,
        max_inactive_connection_lifetime=300,   # recycle before Neon drops idle connections
        command_timeout=60,                     # fail fast instead of hanging on cold start
    )


def checkpointer_cm():
    """Context manager for LangGraph AsyncPostgresSaver (checkpoint storage)."""
    return AsyncPostgresSaver.from_conn_string(settings.NEON_DB_URL)


def store_cm():
    """Context manager for LangGraph AsyncPostgresStore (long-term agent memory)."""
    return AsyncPostgresStore.from_conn_string(settings.NEON_DB_URL)
