from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Phase 3+: database pool init here
    # Phase 4+: Redis memory manager init here
    # Phase 7+: LangGraph checkpointer + store + compiled graph here
    yield
    # Cleanup on shutdown


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
async def health():
    return {
        "status": "ok",
        "service": "nexora-backend",
        "env": settings.APP_ENV,
        "version": "0.1.0",
    }
