from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database.connection import create_pool
from database.init_db import init_db
from memory.redis_manager import create_redis_client, create_memory_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Phase 1: Neon database pool
    app.state.pool = await create_pool()
    await init_db(app.state.pool)

    # Phase 2: Redis memory manager
    app.state.redis = create_redis_client()
    app.state.memory = create_memory_manager(app.state.redis)

    # Phase 7+: LangGraph checkpointer + store + compiled graph here
    yield

    await app.state.redis.aclose()
    await app.state.pool.close()


app = FastAPI(
    title="Nexora Distribution Intelligence API",
    description=(
        "AI-powered multi-agent platform for wholesale electronics distribution. "
        "Manages inventory, procurement, supplier risk, logistics, and executive intelligence "
        "across 5 Indian branches via LangGraph agent workflows."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.ALLOWED_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
# Registered here as each phase is completed:
# Phase 2:  api/health (already inline below)
# Phase 3:  database connected
# Phase 6+: api/inventory, api/orders, api/suppliers, api/finance, api/agents


@app.get("/health", tags=["System"])
async def health(request: Request):
    # DB check
    try:
        async with request.app.state.pool.acquire() as conn:
            warehouse_count = await conn.fetchval("SELECT COUNT(*) FROM warehouses")
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"
        warehouse_count = None

    # Redis check
    try:
        redis_ok = await request.app.state.memory.ping()
        redis_status = "ok" if redis_ok else "error: ping failed"
    except Exception as e:
        redis_status = f"error: {e}"

    return {
        "status": "ok",
        "service": "nexora-backend",
        "env": settings.APP_ENV,
        "version": "0.2.0",
        "database": db_status,
        "redis": redis_status,
        "warehouses_seeded": warehouse_count,
    }
