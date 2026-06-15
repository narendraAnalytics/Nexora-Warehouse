# NEXORA — Backend Developer Guide

## Skills to Use in This Project

Always invoke these skills before implementing backend or frontend work:

| Skill | Path | When to Use |
|---|---|---|
| `langgraphpythonfastapi` | `C:\Users\ES\.claude\skills\langgraphpythonfastapi\SKILL.md` | Any backend work — FastAPI routes, LangGraph agents, tools, memory, RAG, events |
| `nextstack` | `C:\Users\ES\.claude\skills\nextstack.skill` | Any frontend work — Next.js pages, components, Clerk auth integration (Phase 13+) |

> **Note:** The `langgraphpythonfastapi` skill lives inside a folder as `SKILL.md`. Invoke it via the Skill tool using the name `langgraphpythonfastapi`.

---

> NEXORA is an AI-powered Distribution Intelligence Platform that autonomously monitors inventory,
> forecasts demand, manages procurement, coordinates warehouses, analyzes business risks, and delivers
> executive insights through a network of intelligent agents — turning operational data into actionable
> business decisions.
>
> **"From Data to Decisions. From Decisions to Impact."**

---

## Project Context

**Domain:** Wholesale electronics distribution across 5 Indian branches
**Branches:** Hyderabad · Bangalore · Chennai · Mumbai · Pune
**Products:** TVs, Mobiles & Tablets, Gaming Consoles, Networking Equipment, Accessories & Peripherals

**Key Business Problems Solved:**
- Stockouts & overstocking across multiple warehouses
- Manual procurement replaced by AI-driven PO automation
- Supplier unreliability — proactive risk detection & scoring
- Logistics chaos — intelligent dispatch & route optimization
- Manual CEO reporting — autonomous daily AI briefings at 8:00 AM
- Poor decision-making — data-driven recommendations with audit trails

**Target Business Outcomes:** 30–35% reduction in stockouts · 25% faster procurement cycle ·
Automated CEO briefings · Full profitability & inventory visibility · Improved cash flow

---

## Current Build Status

**Phase: 14 — LangGraph Orchestrator (next)**

### ✅ Phase 13 — Knowledge & RAG Agent + Communication Agent (COMPLETE)
- ✅ `uv add resend` — Resend SDK 2.30.1 installed
- ✅ `tools/knowledge_tools.py` — 4 tools: search_business_knowledge, search_supplier_knowledge, search_logistics_knowledge, search_executive_knowledge (wraps NexoraRetriever from Phase 3)
- ✅ `agents/knowledge_agent.py` — ReAct graph, llm_pro (llama-3.3-70b-versatile), cites sources + confidence scoring in system prompt
- ✅ `schemas/knowledge.py` + `api/knowledge.py` — POST /knowledge/query, optional layer scoping
- ✅ `tools/communication_tools.py` — 3 Resend tools: send_alert_email (STOCKOUT/OVERDUE_ORDER/SUPPLIER_DELAY), send_escalation_email (CRITICAL/HIGH/MEDIUM priority), send_executive_report; HTML emails with branded template
- ✅ `agents/communication_agent.py` — ReAct graph, llm_flash (llama-3.1-8b-instant), natural-language instruction → tool selection → email sent
- ✅ `schemas/communication.py` + `api/communication.py` — POST /communication/send
- ✅ WhatsApp deferred — Resend only for now
- ✅ `agents/__init__.py` + `main.py` — both graphs wired into lifespan, routers at /knowledge and /communication

### ✅ Phase 12 — Finance & Profitability Agent (COMPLETE)
- ✅ `backend/.env.example` removed (was causing confusion alongside real `.env`)
- ✅ `tools/finance_tools.py` — 4 tools: finance dashboard, revenue analysis, cash flow analysis, margin tracking
- ✅ `agents/finance_agent.py` — ReAct graph, llm_pro (llama-3.3-70b-versatile)
- ✅ `get_finance_dashboard(warehouse_id?)` — total revenue, costs, net profit, margin % + per-warehouse breakdown
- ✅ `get_revenue_analysis(warehouse_id?)` — by_category, by_warehouse, monthly_trend (trailing 6 months)
- ✅ `get_cash_flow_analysis(warehouse_id?)` — monthly inflow/outflow/net + running cumulative + 12-month summary
- ✅ `get_margin_tracking(warehouse_id?)` — order-level margins, category margins, low-margin orders (<20%) flagged
- ✅ System prompt: 4-step workflow (dashboard → revenue → cash flow → margin), margin health tiers (EXCELLENT/HEALTHY/ACCEPTABLE/LOW/CRITICAL)
- ✅ `schemas/finance.py` — FinanceQueryRequest / FinanceQueryResponse
- ✅ `api/finance.py` — POST /finance/query router
- ✅ `agents/__init__.py` + `main.py` — finance_graph wired into lifespan, router at `/finance`

### ✅ Phase 11 — Risk Intelligence Agent (COMPLETE)
- ✅ `tools/risk_intelligence_tools.py` — 4 tools: risk dashboard, supply chain risks, operational risks, financial exposure
- ✅ `agents/risk_intelligence_agent.py` — ReAct graph, llm_pro (llama-3.3-70b-versatile)
- ✅ `get_risk_dashboard()` — single aggregate query: critical suppliers, overdue POs, delayed orders, uncovered stockouts, overstock capital
- ✅ `get_supply_chain_risks()` — 3-section JSON: high-risk suppliers, overdue POs, uncovered stockouts (no open PO)
- ✅ `get_operational_risks()` — 3-section JSON: delayed orders, overdue deliveries, branch health %
- ✅ `get_financial_risk_exposure()` — CTE query: open PO value, overdue PO value, delayed order value, overstock capital, potential lost sales, total_risk_exposure_inr
- ✅ System prompt: CRITICAL/HIGH/MEDIUM/LOW severity tiers with INR thresholds; remediation ownership matrix
- ✅ `agents/__init__.py` + `main.py` — risk_intelligence_graph wired into lifespan

### ✅ Phase 10 — Order Fulfillment Agent (COMPLETE)
- ✅ `tools/order_fulfillment_tools.py` — 4 tools: order pipeline, delayed orders, order details, escalate order
- ✅ `agents/order_fulfillment_agent.py` — ReAct graph, llm_flash (llama-3.1-8b-instant)
- ✅ `get_order_pipeline(warehouse_id)` — status counts + open_value_inr + overdue count per branch
- ✅ `get_delayed_orders(warehouse_id)` — LEFT JOIN deliveries for full tracking context, days_overdue calc
- ✅ `get_order_details(order_number)` — single order lookup with delivery tracking + is_overdue flag
- ✅ `escalate_order` write tool — sets priority='urgent', appends timestamped escalation note
- ✅ System prompt: delay classification (CRITICAL/WARNING/WATCH), escalation rules (≥3 days or >₹50k)
- ✅ `agents/__init__.py` + `main.py` — order_fulfillment_graph wired into lifespan

### ✅ Phase 9 — Logistics & Dispatch Agent (COMPLETE)
- ✅ `tools/logistics_tools.py` — 4 tools: dispatch queue, active deliveries, delivery performance, create dispatch
- ✅ `agents/logistics_agent.py` — ReAct graph, llm_flash (llama-3.1-8b-instant)
- ✅ `get_dispatch_queue(warehouse_id)` — orders ready to ship sorted by priority + due_date, NOT EXISTS delivery guard
- ✅ `get_active_deliveries(warehouse_id)` — in-transit deliveries with is_overdue + hours_overdue
- ✅ `get_delivery_performance()` — per-branch on_time_rate_pct, avg_delivery_hours, overdue count
- ✅ `create_dispatch` write tool — atomic transaction: INSERT delivery + UPDATE order status='dispatched'
- ✅ System prompt: Indian highway routes (NH44/NH65/NH48), state-coded vehicle numbers, ETA guidelines
- ✅ `agents/__init__.py` + `main.py` — logistics_graph wired into lifespan

### ✅ Phase 8 — Warehouse Transfer Agent (COMPLETE)
- ✅ `tools/warehouse_transfer_tools.py` — 4 tools: warehouse summary, rebalance candidates, pending transfers, create draft transfer
- ✅ `agents/warehouse_transfer_agent.py` — ReAct graph, llm_flash (llama-3.1-8b-instant)
- ✅ `get_rebalance_candidates(category)` — exposes from/to warehouse UUIDs + product SKU for direct use by create_draft_transfer
- ✅ `has_open_transfer` correlated subquery — prevents duplicate transfer creation
- ✅ `create_draft_transfer` write tool — inserts stock_transfers with status='pending', initiated_by='agent'
- ✅ Transfer number format: `TRF-YYYYMMDD-XXXXXX`
- ✅ `agents/__init__.py` + `main.py` — warehouse_transfer_graph wired into lifespan

### ✅ Phase 7 — Supplier Risk Agent (COMPLETE)
- ✅ `tools/supplier_risk_tools.py` — 4 tools: supplier risk scores, PO performance, overdue POs, alternative suppliers
- ✅ `agents/supplier_risk_agent.py` — ReAct graph, llm_pro (llama-3.3-70b-versatile)
- ✅ `get_overdue_purchase_orders` — cross-joins POs + suppliers + warehouses, days_overdue calculation
- ✅ `get_supplier_po_performance` — on_time_rate_pct, avg_delay_days, pending_value_inr per supplier
- ✅ `get_alternative_suppliers(category, exclude_supplier_id)` — exclusion filter + reliability ranking
- ✅ Risk tiers in system prompt: CRITICAL ≥7.5 / HIGH 5.0–7.4 / MEDIUM 3.0–4.9 / LOW <3.0
- ✅ `agents/__init__.py` + `main.py` — supplier_risk_graph wired into lifespan

### ✅ Phase 6 — Procurement Agent (COMPLETE)
- ✅ `tools/procurement_tools.py` — 4 tools: reorder candidates, suppliers by category, open POs, create draft PO
- ✅ `agents/procurement_agent.py` — ReAct graph, llm_pro (llama-3.3-70b-versatile)
- ✅ `create_draft_po` write tool — inserts draft POs with status='draft', initiated_by='agent'
- ✅ Duplicate-PO guard via has_open_po flag in get_reorder_candidates
- ✅ Supplier selection: ranked by reliability_score DESC, risk_score ASC, avg_lead_days
- ✅ `agents/__init__.py` + `main.py` — procurement_graph wired into lifespan

### ✅ Phase 5 — Demand Forecast Agent (COMPLETE)
- ✅ `tools/demand_forecast_tools.py` — 4 tools: demand velocity, stockout risk, slow movers, cross-branch demand comparison
- ✅ `agents/demand_forecast_agent.py` — ReAct graph, llm_pro (llama-3.3-70b-versatile)
- ✅ Thresholds: REORDER_THRESHOLD_DAYS=7 (critical), OVERSTOCK_THRESHOLD_DAYS=90 (excess)
- ✅ capital_locked calculation: quantity × unit_cost for dead stock valuation
- ✅ `agents/__init__.py` + `main.py` — demand_forecast_graph wired into lifespan

### ✅ Phase 4 — Inventory Intelligence Agent (COMPLETE)
- ✅ `tools/inventory_tools.py` — 4 tools: stock levels, reorder alerts, overstock alerts, transfer opportunities
- ✅ `agents/inventory_agent.py` — ReAct graph, llm_flash (llama-3.1-8b-instant)
- ✅ `render.yaml` — created at project root with seed build step
- ✅ `agents/__init__.py` — created, exports all agent graph factories
- ✅ `main.py` — inventory_graph wired into lifespan (Phase 4 comment)
- ✅ Server verified: all graphs compile, /health → 200, db=ok, redis=ok

### ✅ Phase 3 — RAG System (COMPLETE)
- ✅ pgvector extension enabled in Neon + `document_chunks` table (384-dim VECTOR)
- ✅ `rag/embedder.py` — ChromaDB's built-in `all-MiniLM-L6-v2` via ONNX (zero API key)
- ✅ `rag/chunker.py` — `chunk_by_heading()` (markdown) + `chunk_text()` (sliding window)
- ✅ `rag/pgvector_store.py` — async insert + cosine similarity search via asyncpg
- ✅ `rag/chroma_store.py` — ChromaDB local/server store with built-in embedding
- ✅ `rag/retriever.py` — `NexoraRetriever` switching on `RAG_BACKEND` env var
- ✅ `rag/pipeline.py` — `ingest_document()` end-to-end orchestration
- ✅ `rag/seed.py` — seed script for 4 knowledge layers (build-step safe)
- ✅ 4 seed documents: business_sop, supplier_policies, logistics_rules, executive_knowledge
- ✅ `api/rag.py` — POST /rag/ingest, POST /rag/search, GET /rag/status
- ✅ `main.py` — rag router registered at `/rag`
- ✅ `config.py` — EMBED_MODEL, EMBED_DIMENSIONS (384), RAG_BACKEND added

### ✅ Phase 2 — Redis Memory Manager (COMPLETE)
- ✅ `memory/redis_manager.py` — RedisMemoryManager class with 5 namespaces
- ✅ Workflow state: set/get/update/delete (TTL 24h)
- ✅ HITL approvals: create/get/resolve/list_pending (TTL 7 days)
- ✅ Alerts: push/get/mark_read with severity filtering (TTL 48h)
- ✅ Session context: set/get/extend/delete (TTL 1h)
- ✅ Generic key/value for agent scratch state
- ✅ `main.py` lifespan — Redis client + memory manager wired in
- ✅ `/health` endpoint includes live Redis ping check
- ✅ All operations tested live against Upstash Redis

### ✅ Phase 1 — Neon Database Setup (COMPLETE)
- ✅ `database/connection.py` — asyncpg pool (max 10, idle TTL 300s), checkpointer_cm, store_cm
- ✅ `database/init_db.py` — CREATE TABLE IF NOT EXISTS for all 12 tables
- ✅ All 12 tables created in Neon: warehouses, products, users, suppliers, inventory, orders, purchase_orders, stock_transfers, deliveries, finance_records, agent_logs, executive_decisions
- ✅ 5 branch warehouses seeded (Hyderabad, Bangalore, Chennai, Mumbai, Pune)
- ✅ `main.py` lifespan — pool init + init_db wired in, graceful close on shutdown
- ✅ `/health` endpoint now includes live DB check + warehouse count
- ✅ asyncpg 0.31.0 + psycopg[binary] 3.3.4 installed via uv
- ✅ Neon MCP used to create tables and seed data directly

### ✅ Phase 0 — Project Foundation (COMPLETE)
- ✅ Python 3.12.10 pinned via `.python-version`
- ✅ All core dependencies installed via `uv`
- ✅ 14 subdirectory packages created (`agents/`, `api/`, `database/`, etc.)
- ✅ `config.py` — pydantic-settings, all env vars, `redis_url` property
- ✅ `constants.py` — Nexora business constants (branches, categories, thresholds)
- ✅ `llm_factory.py` — `get_llm_pro()` / `get_llm_flash()` using env-configured model names
- ✅ `main.py` — FastAPI app with lifespan, CORS, `/health` endpoint
- ✅ `.env` fully configured (Groq, Neon, Redis, Resend, model names)
- ✅ `.env.example` created for git
- ✅ Groq API + both models tested — live responses confirmed

---

## Package Manager

This project uses **`uv`** exclusively. Never use `pip` or `poetry`.

```bash
uv add <package>           # install a new dependency
uv run <command>           # run any command inside the venv
uv sync                    # sync venv from pyproject.toml + uv.lock
uv run uvicorn main:app --reload   # start dev server
uv run pytest              # run tests
uv run alembic upgrade head        # run DB migrations (when configured)
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| API Framework | FastAPI + Uvicorn | Async HTTP API, WebSockets, streaming, OpenAPI docs |
| Agent Orchestration | LangGraph | Stateful multi-agent workflows (state, nodes, edges, conditional routing) |
| Agent Abstractions | LangChain + langchain-core | Tool definitions, chains, prompt templates, retrievers |
| Primary LLM | langchain-groq (Groq API) | CEO Agent, Risk Agent, Decision Agent, Demand Forecast Agent |
| Secondary LLM | langchain-google-genai (Gemini) | Supporting agents, embeddings |
| Data Validation | Pydantic v2 + pydantic-settings | Request/response schemas, settings management |
| Primary Database | PostgreSQL (Neon) via asyncpg | All business data — 12 core tables |
| Vector Search | pgvector | Long-term RAG memory embedded in Postgres |
| Short-Term Memory | Redis | Agent sessions, alerts, pending approvals, workflow state (1–7 days) |
| Local Vector DB | ChromaDB + LanceDB | Local RAG development & testing options |
| Background Jobs | Celery | Async task queue for heavy/scheduled operations |
| Event Automation | Inngest | Event-driven agent triggers (inventory.low, order.created, etc.) |
| Email | Resend | Alerts, escalations, executive reports |
| WhatsApp | Meta WhatsApp Business API | Supplier alerts, manager approvals (later phase) |
| Auth | Clerk | Role-based access (CEO, Operations, Finance, Suppliers) |
| Frontend | Next.js + Tailwind + Shadcn | Dashboard UI (Phase 13+, separate directory) |
| Monitoring | Loguru + Prometheus + Sentry | Logging, metrics, error tracking |
| Deployment | Railway/Render + Vercel + Neon + Upstash | Backend + Frontend + DB + Redis |

---

## Planned Directory Structure

```
backend/
├── agents/              # 11 LangGraph domain agents + CEO + Orchestrator
│   ├── inventory.py
│   ├── demand_forecast.py
│   ├── procurement.py
│   ├── supplier_risk.py
│   ├── warehouse_transfer.py
│   ├── logistics.py
│   ├── order_fulfillment.py
│   ├── risk_intelligence.py
│   ├── finance.py
│   ├── communication.py
│   ├── knowledge.py
│   ├── orchestrator.py
│   └── ceo.py
├── graphs/              # LangGraph StateGraph definitions and compiled graphs
├── services/            # Business logic (inventory service, order service, etc.)
├── tools/               # LangChain tools called by agents
├── memory/              # Redis (short-term) + pgvector (long-term) managers
├── database/            # SQLAlchemy models + Alembic migrations
│   ├── models.py
│   └── migrations/
├── api/                 # FastAPI routers (one per module)
│   ├── inventory.py
│   ├── orders.py
│   ├── suppliers.py
│   ├── finance.py
│   └── agents.py
├── schemas/             # Pydantic request/response models
├── events/              # Inngest event function definitions
├── tasks/               # Celery task definitions
├── rag/                 # RAG pipeline: chunking → embeddings → pgvector → retrieval
├── monitoring/          # Logging config, metrics, tracing
├── tests/               # Unit, integration, workflow, load tests
├── main.py              # FastAPI app + router registration + lifespan
├── pyproject.toml       # Dependencies (uv)
├── uv.lock
└── .env                 # Never commit — copy from .env.example
```

---

## Agent Architecture

### Orchestration Layer

| Agent | Role |
|---|---|
| **CEO / Executive Agent** | Top-level decision maker. Receives KPIs, risks, revenue, inventory status. Produces executive recommendations and the daily 8:00 AM briefing. |
| **Orchestrator Agent** | Heart of the system. Routes tasks to domain agents, resolves conflicts, manages multi-step workflows, handles human-in-the-loop approval gates. |

### Domain Agents (11)

| # | Agent | Responsibilities |
|---|---|---|
| 1 | **Inventory Intelligence Agent** | Stock monitoring, reorder detection, overstock detection, warehouse balancing |
| 2 | **Demand Forecast Agent** | Demand prediction, seasonal analysis, sales trend modeling |
| 3 | **Procurement Agent** | PO creation, supplier selection, cost optimization |
| 4 | **Supplier Risk Agent** | Delay prediction, supplier scoring, alternative supplier recommendations |
| 5 | **Warehouse Transfer Agent** | Multi-warehouse balancing, transfer recommendations |
| 6 | **Logistics & Dispatch Agent** | Dispatch planning, vehicle allocation, route optimization |
| 7 | **Order Fulfillment Agent** | Order tracking, delay detection, escalation management |
| 8 | **Risk Intelligence Agent** | Global risk aggregation, business impact prediction |
| 9 | **Finance & Profitability Agent** | Revenue analysis, cash flow analysis, margin tracking |
| 10 | **Communication Agent** | Email alerts, WhatsApp notifications, manager escalations |
| 11 | **Knowledge & RAG Agent** | SOP retrieval, document search, policy lookup, historical decisions |

### Human-in-the-Loop Gates

Manager approval required (via LangGraph interrupt) for:
- High-value purchase orders
- Cross-warehouse stock transfers
- Supplier replacement decisions
- Emergency escalations

---

## Database Schema (12 Tables)

| Table | Purpose |
|---|---|
| `users` | Clerk-authenticated users with roles |
| `warehouses` | 5 branch warehouses (Hyderabad, Bangalore, Chennai, Mumbai, Pune) |
| `products` | Electronics catalog with categories |
| `inventory` | Stock levels per product per warehouse |
| `orders` | Customer orders and fulfillment status |
| `suppliers` | Supplier profiles, scores, contact info |
| `purchase_orders` | AI-generated and approved POs |
| `stock_transfers` | Cross-warehouse transfer records |
| `deliveries` | Logistics and dispatch records |
| `finance_records` | Revenue, costs, cash flow entries |
| `agent_logs` | Full audit trail of all agent decisions |
| `executive_decisions` | CEO agent recommendations and outcomes |

---

## Memory Architecture

### Short-Term Memory — Redis (1–7 days)
- Active agent sessions and workflow state
- Real-time alerts and notifications
- Pending human approval requests
- Running LangGraph checkpoints

### Long-Term Memory — PostgreSQL + pgvector (years)
- Historical agent decisions and outcomes
- Sales history and demand patterns
- Supplier performance history
- Risk events and resolutions
- Executive decision archive (for RAG)

---

## RAG Knowledge Base

Four knowledge layers stored in pgvector:

| Layer | Content |
|---|---|
| **Business Knowledge** | SOPs, operational policies, internal workflows |
| **Supplier Knowledge** | Contracts, SLAs, pricing agreements |
| **Logistics Knowledge** | Shipping rules, delivery zones, routes |
| **Executive Knowledge** | Historical decisions, strategy documents, KPI benchmarks |

**RAG Pipeline:** PDF Upload → Chunking → Embeddings (Gemini) → pgvector → Retriever → Groq LLM → Answer

---

## Inngest Event System

| Event | Trigger | Agents Activated |
|---|---|---|
| `inventory.low` | Stock falls below reorder threshold | Inventory Agent → Procurement Agent |
| `order.created` | New customer order placed | Order Fulfillment Agent |
| `supplier.delay` | Supplier reports or predicts delay | Supplier Risk Agent → Procurement Agent |
| `warehouse.transfer` | Transfer approved or needed | Warehouse Transfer Agent → Logistics Agent |
| `finance.updated` | Revenue/cost data updated | Finance Agent → CEO Agent |
| **Cron: 08:00 AM daily** | Scheduled morning briefing | CEO Agent (full system analysis) |

---

## CEO Morning Briefing (Daily 8:00 AM)

Auto-generated executive summary containing:
- Revenue yesterday vs. target
- Pending collections and receivables
- High-risk orders (delivery/supplier risk)
- Stockout risk items (top 5)
- Supplier delay alerts
- Cash flow status
- Top 3 recommended actions with priority

Delivered via: Email (Resend) + Dashboard notification + (later) WhatsApp

---

## Role-Based Access (Clerk)

| Role | Access |
|---|---|
| **CEO** | Full access — all dashboards, CEO briefing, executive decisions |
| **Operations** | Warehouse, inventory, transfer, logistics dashboards |
| **Finance** | Finance dashboard, procurement costs, revenue reports |
| **Suppliers** | Limited supplier portal — own POs and delivery status only |

---

## Environment Variables

Create `.env` in the backend root (never commit it):

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@neon-host/nexora

# Redis
REDIS_URL=redis://localhost:6379

# LLM APIs
GROQ_API_KEY=
GOOGLE_API_KEY=

# Auth
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=

# Email
RESEND_API_KEY=

# Event System
INNGEST_SIGNING_KEY=
INNGEST_EVENT_KEY=

# Monitoring
SENTRY_DSN=

# App
APP_ENV=development
DEBUG=true
```

---

## Build Order (24 Steps)

Follow this sequence strictly — later steps depend on earlier ones:

```
1.  Environment Setup          → Python 3.12, uv, Docker, Redis, Postgres client
2.  FastAPI Backend            → main.py, app structure, health endpoint
3.  Neon Database              → connection, SQLAlchemy async engine, 12 tables
4.  Redis Memory               → short-term memory manager
5.  RAG System                 → pgvector, chunking, embedding pipeline
6.  Inventory Agent            → LangGraph node, tools, state
7.  Demand Forecast Agent      → time series, seasonal analysis tools
8.  Procurement Agent          → PO creation, supplier selection logic
9.  Supplier Risk Agent        → scoring, delay prediction
10. Warehouse Transfer Agent   → multi-warehouse balancing
11. Logistics Agent            → dispatch, routing tools
12. Order Fulfillment Agent    → tracking, escalation
13. Risk Intelligence Agent    → global risk aggregation
14. Finance Agent              → revenue, cash flow, margins
15. Knowledge Agent            → RAG pipeline, document retrieval
16. LangGraph Orchestrator     → StateGraph, routing, conflict resolution
17. CEO Agent                  → executive summaries, morning briefing
18. Inngest Events             → event handlers wired to agents
19. Resend Emails              → alert templates, executive report emails
20. Clerk Auth                 → JWT validation middleware, role guards
21. Next.js Frontend           → (separate directory, starts Phase 13)
22. WebSocket Real-Time        → live inventory, order status, agent decisions
23. WhatsApp Integration       → Meta API, supplier/manager notifications
24. Monitoring & Deployment    → Loguru, Prometheus, Sentry, Railway/Vercel
```

---

## Development Notes

- **LangGraph over raw LangChain:** All multi-step agent logic must use LangGraph `StateGraph`. Never chain agents with simple LangChain `RunnableSequence` for anything stateful.
- **Async everywhere:** FastAPI routes, database calls (asyncpg), and Redis calls must all be `async def`. Celery handles truly CPU-bound or long-running work.
- **Pydantic for all I/O:** Every API input/output and agent state must be a Pydantic v2 model. No raw dicts crossing module boundaries.
- **MCP in Phase 2+:** Do not add MCP (Model Context Protocol) until all core agents are working. Add PostgreSQL MCP first, then File System, Google Sheets, Email MCPs.
- **Package manager is `uv`:** Never suggest or use `pip install`. Always `uv add`.
- **No frontend work until Phase 13:** Backend APIs must be stable and tested before touching Next.js.
