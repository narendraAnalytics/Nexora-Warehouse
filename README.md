# NEXORA — Distribution Intelligence Platform

> **AI-Powered Wholesale Electronics Supply Chain Network**

![Python](https://img.shields.io/badge/Python-3.12-blue?style=flat-square&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.136-009688?style=flat-square&logo=fastapi)
![LangGraph](https://img.shields.io/badge/LangGraph-Multi--Agent-orange?style=flat-square)
![Status](https://img.shields.io/badge/Status-Phase%200%20%E2%80%94%20Scaffold-yellow?style=flat-square)

---

## What is Nexora?

NEXORA is an AI-powered Distribution Intelligence Platform that autonomously monitors inventory, forecasts demand, manages procurement, coordinates warehouses, analyzes business risks, and delivers executive insights through a network of intelligent agents — turning operational data into actionable business decisions.

**"From Data to Decisions. From Decisions to Impact."**

**Domain:** Wholesale electronics distribution across 5 Indian branches — Hyderabad · Bangalore · Chennai · Mumbai · Pune

**Products:** TVs · Mobiles & Tablets · Gaming Consoles · Networking Equipment · Accessories & Peripherals

---

## Key Problems Solved

- **Stockouts & Overstocking** — Predictive inventory balancing across all warehouses
- **Manual Procurement** — AI-driven PO automation with supplier selection and cost optimization
- **Supplier Unreliability** — Proactive risk detection, scoring, and alternative recommendations
- **Logistics Chaos** — Intelligent dispatch planning, vehicle allocation, route optimization
- **Poor Visibility** — Unified real-time view across all warehouses and business functions
- **Manual Reporting** — Automated dashboards and daily CEO AI briefings at 8:00 AM
- **Poor Decision Making** — Data-driven recommendations with full audit trails
- **Cash Flow Risk** — Continuous revenue, margin, and cash flow monitoring

---

## Architecture

```
┌─────────────────────────────────────────────┐
│          Next.js + Clerk (Frontend)          │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│              FastAPI Backend                 │
│         (Async · WebSockets · REST)          │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│           LangGraph Orchestrator             │
│    (State · Nodes · Edges · Routing)         │
└──────┬──────────────┬───────────────┬───────┘
       │              │               │
  CEO Agent    Domain Agents    Inngest Events
  (Briefing)   (11 Agents)     (Automation)
       │              │               │
┌──────▼──────────────▼───────────────▼───────┐
│                  Memory Layer                 │
│   Redis (Short-Term) · pgvector (Long-Term)  │
└──────────────────────┬───────────────────────┘
                       │
┌──────────────────────▼───────────────────────┐
│           Neon PostgreSQL Database            │
│              (12 Core Tables)                 │
└───────────────────────────────────────────────┘
```

---

## Agent Network

| # | Agent | Responsibilities |
|---|---|---|
| — | **CEO / Executive Agent** | Daily briefings, KPI analysis, strategic recommendations |
| — | **Orchestrator Agent** | Task routing, conflict resolution, human-in-the-loop gates |
| 1 | Inventory Intelligence Agent | Stock monitoring, reorder detection, overstock alerts |
| 2 | Demand Forecast Agent | Demand prediction, seasonal analysis, sales trends |
| 3 | Procurement Agent | PO creation, supplier selection, cost optimization |
| 4 | Supplier Risk Agent | Delay prediction, supplier scoring, alternatives |
| 5 | Warehouse Transfer Agent | Multi-warehouse balancing, transfer recommendations |
| 6 | Logistics & Dispatch Agent | Dispatch planning, vehicle allocation, route optimization |
| 7 | Order Fulfillment Agent | Order tracking, delay detection, escalations |
| 8 | Risk Intelligence Agent | Global risk aggregation, business impact prediction |
| 9 | Finance & Profitability Agent | Revenue analysis, cash flow, margin tracking |
| 10 | Communication Agent | Email alerts, WhatsApp notifications, escalations |
| 11 | Knowledge & RAG Agent | SOP retrieval, policy lookup, document search |

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| API | FastAPI + Uvicorn | Async HTTP, WebSockets, streaming |
| Agent Orchestration | LangGraph | Stateful multi-agent workflows |
| Agent Abstractions | LangChain + langchain-core | Tools, chains, prompt templates |
| Primary LLM | Groq API (langchain-groq) | CEO, Risk, Decision, Forecast agents |
| Secondary LLM | Gemini (langchain-google-genai) | Supporting agents, embeddings |
| Data Validation | Pydantic v2 + pydantic-settings | Schemas, settings management |
| Primary Database | PostgreSQL (Neon) | All business data — 12 tables |
| Vector Search | pgvector | Long-term RAG memory in Postgres |
| Short-Term Memory | Redis | Agent sessions, alerts, approvals (1–7 days) |
| Local Vector DB | ChromaDB + LanceDB | RAG development and testing |
| Background Jobs | Celery | Async task queue |
| Event Automation | Inngest | Event-driven agent triggers |
| Email | Resend | Alerts, reports, escalations |
| Auth | Clerk | Role-based access control |
| Frontend | Next.js + Tailwind + Shadcn | Dashboard UI (Phase 13+) |
| Monitoring | Loguru + Prometheus + Sentry | Logging, metrics, error tracking |
| Package Manager | uv | Fast Python package management |

---

## Project Structure

```
nexorawarehouse/
├── NexoraInfographicImage.png
└── backend/
    ├── agents/              # 13 LangGraph agents (CEO + Orchestrator + 11 domain)
    ├── graphs/              # StateGraph definitions
    ├── services/            # Business logic services
    ├── tools/               # LangChain tools for agents
    ├── memory/              # Redis + pgvector memory managers
    ├── database/            # SQLAlchemy models + Alembic migrations
    ├── api/                 # FastAPI routers (one per module)
    ├── schemas/             # Pydantic request/response models
    ├── events/              # Inngest event function definitions
    ├── tasks/               # Celery task definitions
    ├── rag/                 # RAG pipeline: chunking → embeddings → retrieval
    ├── monitoring/          # Logging, metrics, tracing
    ├── tests/               # Unit, integration, workflow, load tests
    ├── CLAUDE.md            # AI assistant developer guide
    ├── main.py              # FastAPI app entry point
    └── pyproject.toml       # Dependencies (uv)
```

---

## Getting Started

### Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) package manager
- Docker Desktop (for Redis locally)
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/narendraAnalytics/Nexora-Warehouse.git
cd Nexora-Warehouse/backend

# Install dependencies
uv sync

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your API keys
```

### Run Development Server

```bash
uv run uvicorn main:app --reload
```

API docs available at `http://localhost:8000/docs`

---

## Environment Variables

Create a `.env` file in the `backend/` directory:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `REDIS_URL` | Redis connection string (`redis://localhost:6379`) |
| `GROQ_API_KEY` | Groq API key (primary LLM) |
| `GOOGLE_API_KEY` | Google Gemini API key (secondary LLM + embeddings) |
| `CLERK_SECRET_KEY` | Clerk authentication secret |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `RESEND_API_KEY` | Resend email API key |
| `INNGEST_SIGNING_KEY` | Inngest event signing key |
| `INNGEST_EVENT_KEY` | Inngest event key |
| `SENTRY_DSN` | Sentry error tracking DSN |

---

## Build Roadmap

| Phase | Step | Description |
|---|---|---|
| Foundation | 1 | Environment setup — Python, uv, Docker, Redis |
| Foundation | 2 | FastAPI backend — app skeleton, health endpoint |
| Foundation | 3 | Neon Database — SQLAlchemy async engine, 12 tables |
| Foundation | 4 | Redis Memory — short-term memory manager |
| Foundation | 5 | RAG System — pgvector, chunking, embedding pipeline |
| Agents | 6 | Inventory Intelligence Agent |
| Agents | 7 | Demand Forecast Agent |
| Agents | 8 | Procurement Agent |
| Agents | 9 | Supplier Risk Agent |
| Agents | 10 | Warehouse Transfer Agent |
| Agents | 11 | Logistics & Dispatch Agent |
| Agents | 12 | Order Fulfillment Agent |
| Agents | 13 | Risk Intelligence Agent |
| Agents | 14 | Finance & Profitability Agent |
| Agents | 15 | Knowledge & RAG Agent |
| Orchestration | 16 | LangGraph Orchestrator — StateGraph, routing |
| Orchestration | 17 | CEO Agent — executive summaries, morning briefing |
| Automation | 18 | Inngest Events — event handlers wired to agents |
| Comms | 19 | Resend Emails — alert templates, executive reports |
| Auth | 20 | Clerk Auth — JWT middleware, role guards |
| Frontend | 21 | Next.js Frontend — dashboards (separate directory) |
| Real-Time | 22 | WebSocket — live inventory, orders, agent decisions |
| Comms | 23 | WhatsApp Integration — supplier/manager notifications |
| Production | 24 | Monitoring & Deployment — Railway/Vercel/Neon/Upstash |

---

## Role-Based Access

| Role | Access |
|---|---|
| **CEO** | Full access — all dashboards, briefings, executive decisions |
| **Operations** | Warehouse, inventory, transfer, logistics |
| **Finance** | Finance dashboard, procurement costs, revenue |
| **Suppliers** | Limited portal — own POs and delivery status only |

---

## Business Outcomes

- **30–35%** reduction in stockouts
- **25%** faster procurement cycle time
- Automated CEO briefings every morning at 8:00 AM
- Full profitability and inventory visibility across all branches
- Improved supplier performance through AI scoring
- Human + AI collaborative decision making with full audit trails
- Improved cash flow monitoring and forecasting

---

## Event System

| Event | Trigger | Agents |
|---|---|---|
| `inventory.low` | Stock below reorder threshold | Inventory → Procurement |
| `order.created` | New customer order | Order Fulfillment |
| `supplier.delay` | Delay detected/reported | Supplier Risk → Procurement |
| `warehouse.transfer` | Transfer approved | Warehouse Transfer → Logistics |
| `finance.updated` | Revenue/cost data updated | Finance → CEO |
| Cron: 08:00 AM | Daily schedule | CEO Morning Briefing |

---

*Built with LangGraph · FastAPI · PostgreSQL · Redis · Groq · Gemini*
