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
| Frontend | Phase 19 — Clerk Auth Integration | ✅ Complete |
| Frontend | Phase 20 — Clerk ↔ Neon Lazy Sync | ✅ Complete |
| Frontend | Phase 20.5 — Transition Page + Placeholder Dashboard | ✅ Complete |
| Frontend | Phase 21 — Full AI Dashboard | ✅ Complete |
| Next up | Phase 22 — WebSocket Real-Time / WhatsApp / Monitoring | ⏳ Pending |

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
- Next.js 16 uses `src/proxy.ts` NOT `src/middleware.ts` for middleware.
- Never commit `.env` files.
- Clerk auth: username enabled in Clerk dashboard (Require username ON). Use `useUser()` hook in client components.
- Neon DB (`@neondatabase/serverless`): use tagged template literals — `` sql`SELECT ... WHERE id = ${id}` `` NOT `sql('string', [params])`.
- `users` table: no `warehouse_id` column (dropped). Columns: `id`, `clerk_id`, `email`, `full_name`, `role`, `is_active`, `created_at`, `updated_at`.
- Clerk→Neon sync: on login → `/api/auth/sync` → upserts user with `role='ceo'` → redirects to `/`.
- Transition page (`/transition`): 7-second cinematic loading screen (panorama fills full viewport, `.scene` is `position:absolute inset:0`, `.top` floats over it). Never add a page background gradient or scene-blend overlay — it washes out the sky.
- After transition → `/dashboard` (full AI dashboard — Phase 21 complete).
- Page-scoped CSS resets: any `* { margin:0; padding:0 }` in a page CSS file MUST be scoped to `.page *` to prevent bleeding into other pages after client-side navigation.
- Dashboard CSS scoped to `.nexora-dash` — all selectors prefixed, CSS vars defined on `.nexora-dash {}` not `:root`. Scrollable content area needs `flex: 1; min-height: 0; overflow-y: scroll` — omitting `min-height: 0` causes flexbox to expand past viewport and clips the scrollbar.
- Clerk hydration rule: any `isSignedIn`-conditional JSX MUST be guarded by `isLoaded` → `{isLoaded && isSignedIn ? <authed/> : <signInBtn/>}`. Without `isLoaded`, SSR renders signed-out HTML but client renders signed-in HTML → hydration mismatch.
