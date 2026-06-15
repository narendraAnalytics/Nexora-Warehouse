# Nexora Warehouse — Root Project Guide

> **"From Data to Decisions. From Decisions to Impact."**
>
> AI-powered Distribution Intelligence Platform — autonomous inventory, procurement,
> logistics, risk detection, and CEO briefings for a 5-branch wholesale electronics distributor.

---

## Monorepo Structure

```
nexorawarehouse/
├── backend/     ← FastAPI + LangGraph + Python (uv)
└── frontend/    ← Next.js 16 + React 19 + Tailwind v4 (npm)
```

Each folder has its own `CLAUDE.md` with full context. Always read the relevant one before working in that directory.

- Backend details → `backend/CLAUDE.md`
- Frontend details → `frontend/CLAUDE.md`

---

## Current Build Phase

| Area | Phase | Status |
|---|---|---|
| Backend | Phase 17 — Render Deployment | ✅ Complete |
| Frontend | Phase 18 — Hero Section + Vercel Deployment | ✅ Complete |
| Next up | Phase 18 cont. — Dashboard pages | ⏳ Pending |
| Deferred | Clerk Auth | ⏳ After frontend stable |

---

## Live Services

| Service | URL |
|---|---|
| **Frontend** | `https://nexorawarehouse.vercel.app` |
| Backend API | `https://nexora-warehouse.onrender.com` |
| API Docs | `https://nexora-warehouse.onrender.com/docs` |
| Frontend (local) | `http://localhost:3000` |
| Database | Neon PostgreSQL (see backend/.env) |
| Redis | Render managed Redis port 12657 — plain TCP, no TLS |

---

## Quick Start

```bash
# Backend
cd backend
uv sync
uv run uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

---

## Domain

**Wholesale electronics distribution — 5 Indian branches**
Hyderabad · Bangalore · Chennai · Mumbai · Pune

**Products:** TVs · Mobiles & Tablets · Gaming Consoles · Networking Equipment · Accessories

---

## Key Rules

- Backend: always use `uv`, never `pip`. All async. Pydantic for all I/O.
- Frontend: Next.js 16 has breaking changes — read docs before writing routes/middleware.
- `next/font/google` is broken in v16 — use direct Google Fonts `<link>` tag.
- Plus Jakarta Sans max weight is **800** (not 900).
- Never commit `.env` files.
