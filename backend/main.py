from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database.connection import create_pool
from database.init_db import init_db
from memory.redis_manager import create_redis_client, create_memory_manager
from agents import (
    create_inventory_graph,
    create_demand_forecast_graph,
    create_procurement_graph,
    create_supplier_risk_graph,
    create_warehouse_transfer_graph,
    create_logistics_graph,
    create_order_fulfillment_graph,
    create_risk_intelligence_graph,
)
from api.rag import router as rag_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Phase 1: Neon database pool
    app.state.pool = await create_pool()
    await init_db(app.state.pool)

    # Phase 2: Redis memory manager
    app.state.redis = create_redis_client()
    app.state.memory = create_memory_manager(app.state.redis)

    # Phase 4: Inventory Intelligence Agent (no checkpointer yet — Phase 7+)
    app.state.inventory_graph = create_inventory_graph(app.state.pool)

    # Phase 5: Demand Forecast Agent
    app.state.demand_forecast_graph = create_demand_forecast_graph(app.state.pool)

    # Phase 6: Procurement Agent
    app.state.procurement_graph = create_procurement_graph(app.state.pool)

    # Phase 7: Supplier Risk Agent
    app.state.supplier_risk_graph = create_supplier_risk_graph(app.state.pool)

    # Phase 8: Warehouse Transfer Agent
    app.state.warehouse_transfer_graph = create_warehouse_transfer_graph(app.state.pool)

    # Phase 9: Logistics & Dispatch Agent
    app.state.logistics_graph = create_logistics_graph(app.state.pool)

    # Phase 10: Order Fulfillment Agent
    app.state.order_fulfillment_graph = create_order_fulfillment_graph(app.state.pool)

    # Phase 11: Risk Intelligence Agent
    app.state.risk_intelligence_graph = create_risk_intelligence_graph(app.state.pool)

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
app.include_router(rag_router, prefix="/rag", tags=["RAG"])
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
