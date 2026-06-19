@AGENTS.md

# Nexora Warehouse — Frontend Developer Guide

| Skill | Path | When to Use |
|---|---|---|
| `langgraphpythonfastapi` | `C:\Users\ES\.claude\skills\langgraphpythonfastapi\SKILL.md` | Any backend work — FastAPI routes, LangGraph agents, tools, memory, RAG, events |



## Current Status

**Phase: 23 — Procurement Phase 1: PR UI (CURRENT)**

### ✅ Phase 21.5 — Product Master / Add Product Page (COMPLETE)

**Pages created:**
- `/products` — Add Product form (CEO adds products to the master catalog)

**Files created:**
```
frontend/src/app/products/page.tsx           ← "use client", Clerk useUser, 4 form sections, sticky layout
frontend/src/app/products/products.css       ← scoped to .nexora-products, sticky topbar + action bar
frontend/src/app/api/products/stats/route.ts ← GET: COUNT total/active/draft from backend products table
frontend/src/app/api/products/route.ts       ← POST: upsert product + inventory rows for all warehouses
```

**Key rules for this page:**
- CSS scoped to `.nexora-products` — vars on `.nexora-products {}`, reset on `.nexora-products *`
- Layout: `min-height: 100vh; display: block` on root, `position: sticky; top/bottom: 0` for topbar/action bar — never use `height: 100vh + overflow: hidden` (collapses form fields)
- Right column: `position: sticky; top: 80px` so panels follow scroll
- All `value={form.field}` props use `?? ""` fallback — React 19 concurrent mode can briefly render before useState settles → "uncontrolled→controlled" warning without fallback
- `createdBy` guarded by `isLoaded` to prevent Clerk hydration mismatch
- Safari: `-webkit-backdrop-filter` before `backdrop-filter` on glassmorphism elements

**API schema — writes to backend `products` table (NOT a separate frontend table):**
- Uses `name` (not `product_name`), UUID `id`, `unit_price` (from MRP), `unit_of_measure` (from UOM)
- After product insert → upserts `inventory` row for **every active warehouse** dynamically (`SELECT id FROM warehouses WHERE is_active = TRUE`) — no hardcoded warehouse UUIDs
- `quantity` seeded from `safetyStock` field; `reorder_qty = reorderPoint × 2`; `max_stock = reorderPoint × 4`
- Dashboard "Products" nav wired to `router.push('/products')` in `dashboard/page.tsx`

---

### ⏳ Phase 23 — Procurement PR UI

**New pages:**
- `/procurement` — hub page (3 cards: PR active, PO/GRN upcoming)
- `/procurement/pr` — PR list + warehouse selector + "Generate PR" button
- `/procurement/pr/[id]` — PR detail + 3-button HITL panel + resubmit panel

**New Next.js API routes** (all proxy to `process.env.BACKEND_URL ?? "https://nexora-warehouse.onrender.com"`):
```
GET  POST  /api/procurement/pr
GET        /api/procurement/pr/[id]
POST       /api/procurement/pr/[id]/approve
POST       /api/procurement/pr/[id]/reject
POST       /api/procurement/pr/[id]/request-changes
POST       /api/procurement/pr/[id]/resubmit
```

**IMPORTANT — procurement calls FastAPI backend, NOT Neon directly** (PR generation requires LangGraph agents).

**CSS:** scoped to `.nexora-procurement` — same pattern as `.nexora-dash`. No `:root` vars, no global resets.

**Branch inventory CSS rule:** each branch inventory page owns its own CSS co-located with `page.tsx` (e.g. `blr-inventory.css`). Never import `src/app/inventory/inventory.css` (CEO page) from a branch page — CEO CSS changes will break branch layouts. `.nexora-inventory` root must explicitly set `flex-direction: column`; omitting it defaults to row and produces a broken horizontal layout.

**PR form rules (Phase 23):**
- PR form is branch-scoped: `/branch/bangalore/procurement/pr/page.tsx` — NOT global `/procurement/pr/`. Each branch owns its own PR form (matches branch inventory pattern).
- PR form CSS root `.nexora-pr` must set `display: flex; flex-direction: column` — omitting `flex-direction: column` defaults to row and breaks layout.
- Lock all editable fields after PR creation: `disabled={!!pr}` — prevents double-submission on re-render.
- Amber qty diff: apply class `pr-qty-changed` when `manager_qty !== agent_suggested_qty` — visible audit trail for approvers.
- Accessibility: any `<input>` inside a table column (no visible label) needs `title="..."` and `aria-label="..."`. Any button containing only an SVG/icon needs `title="..."` and `aria-label="..."`.

**Status badge colors:**
- `PENDING` → amber `#f59e0b`
- `APPROVED` → green `#10b981`
- `REJECTED` → red `#ef4444`
- `CHANGES_REQUESTED` → orange `#f97316`
- `RESUBMITTED` → purple `#a78bfa`

**PR detail page sections:**
1. Header: PR# (monospace) + status badge + warehouse + date + escalation deadline (amber if <24h)
2. Summary cards: Total Value (INR formatted) | Approval Level | Items Count
3. Items table: SKU | Product | Current Stock (red if ≤ reorder_point) | Reorder Pt | Requested Qty | Unit Price | Total | Reason
4. Agent Analysis: 3 JSON cards (inventory_analysis / forecast_analysis / procurement_analysis)
5. Approval Panel (if status PENDING or RESUBMITTED): [✓ Approve] [✗ Reject] [↩ Request Changes]
6. Changes Panel (if status CHANGES_REQUESTED): shows approval_notes + [↑ Resubmit PR]

**File list to create:**
```
frontend/src/app/procurement/layout.tsx
frontend/src/app/procurement/page.tsx
frontend/src/app/procurement/pr/page.tsx
frontend/src/app/procurement/pr/[id]/page.tsx
frontend/src/app/procurement/procurement.module.css
frontend/src/app/api/procurement/pr/route.ts
frontend/src/app/api/procurement/pr/[id]/route.ts
frontend/src/app/api/procurement/pr/[id]/approve/route.ts
frontend/src/app/api/procurement/pr/[id]/reject/route.ts
frontend/src/app/api/procurement/pr/[id]/request-changes/route.ts
frontend/src/app/api/procurement/pr/[id]/resubmit/route.ts
```

---

**Phase: 21 — Full AI Dashboard COMPLETE**

- ✅ Next.js 16 + React 19 + TypeScript scaffold
- ✅ Tailwind v4 (CSS-first, no `tailwind.config.js`) + `@base-ui/react` + shadcn
- ✅ Hero page live at `src/app/page.tsx` — matches sample design exactly
- ✅ Plus Jakarta Sans via Google Fonts `<link>` (weights 400–800, NOT 900)
- ✅ Brand tokens, blob/orb/particle animations in `src/app/globals.css`
- ✅ Cloudinary CDN for images (configured in `next.config.ts`)
- ✅ **Deployed to Vercel: `https://nexorawarehouse.vercel.app`**
- ✅ Nexora logo as favicon (`src/app/icon.png`) — default Next.js favicon removed
- ✅ Clerk Auth (`@clerk/nextjs` v7.5.2) — login modal, navbar user state, sign-in/sign-up pages
- ✅ Neon DB wired — `@neondatabase/serverless` + raw SQL (no drizzle push — table owned by backend)
- ✅ Lazy sync — on login → `/api/auth/sync` → upserts into `users` table with `role='ceo'` → redirects to `/`
- ✅ Transition page (`/transition`) — 7-second cinematic loading screen, panorama fills full viewport, city pins, portal flash, auto-redirects to `/dashboard`
- ✅ Full AI Dashboard (`/dashboard`) — real Neon DB data, 6 API routes, Chart.js charts, skeleton loading, Cloudinary landmark images, India map 300px
- ⏳ Phase 22 — WebSocket Real-Time, WhatsApp alerts, Monitoring

---

## Critical: Next.js 16 Breaking Changes

**DO NOT assume Next.js 13/14/15 patterns work here.**
Read `node_modules/next/dist/docs/` before writing any API routes, middleware, or server actions.

Known breakages already discovered:
- `next/font/google` — broken in v16 (`Can't resolve next/font/google/target.css`). Use direct Google Fonts `<link>` tag in `layout.tsx` instead.
- Font weight 900 doesn't exist for Plus Jakarta Sans. Max is **800**.
- Middleware file must be `src/proxy.ts` NOT `src/middleware.ts` — Next.js 16 renamed the convention.

---

## Tech Stack

| Layer | Tech | Notes |
|---|---|---|
| Framework | Next.js 16.2.9 | App Router, `src/app/` directory |
| React | 19.2.4 | Server + Client components |
| Styling | Tailwind v4 | CSS-first: `@import "tailwindcss"` in globals.css, no config file |
| UI Primitives | `@base-ui/react` + shadcn 4.11 | Not Radix — `@base-ui/react` |
| Font | Plus Jakarta Sans | Google Fonts link, weights 400/500/600/700/800 only |
| Images | Cloudinary CDN | Hostname configured in `next.config.ts` |
| Auth | Clerk `^7.5.2` | ✅ Wired — `ClerkProvider` in `layout.tsx`, `useUser()` in `page.tsx`, `proxy.ts` middleware |
| DB | `@neondatabase/serverless` | ✅ Wired — raw SQL via tagged template literals, no drizzle push (table owned by backend) |
| Email | Resend + React Email | Not yet wired |
| Background jobs | Inngest 4.5.1 | Mirrors backend event system |

---

## Brand Design System

### Colors
```css
--nex-pink:   #FF4FA3
--nex-coral:  #FF7A59
--nex-peach:  #FFB36A
--nex-mint:   #3EE8C2
--nex-teal:   #18D8C3
--nex-purple: #A855F7
--nex-violet: #D946EF
```

### Gradient presets (CSS classes in globals.css)
- `.gw-warm` — `#FFD060 → #FF8C40 → #FF4FA3` (headings "Smarter", "Better")
- `.gw-teal` — `#44EECA → #18D8C3 → #A855F7` (headings "Faster")
- Primary CTA button: `linear-gradient(130deg, #3EE8C2, #18D8C3 50%, #A855F7)`
- Hero background: 5-stop radial stack + `linear-gradient(128deg, #FF7840, #E03898, #8B2EE0, #12C0D0)`

### Font
- Family: `'Plus Jakarta Sans', sans-serif`
- Applied globally in `globals.css` `@layer base` on `html` and `body`
- Weights: 400 (normal) · 500 · 600 · 700 · 800 (extrabold / max)

### Animation classes (defined in globals.css)
| Class | Purpose |
|---|---|
| `.hw` | Hero wrapper with full gradient background |
| `.blob .b1–.b5` | Animated background blobs |
| `.orb .o1–.o6` | Floating decorative orbs |
| `.pt` | Floating particle (spawned via JS) |
| `.warehouse-img` | mix-blend-mode + drop-shadow on illustration |
| `.gw-warm` / `.gw-teal` | Gradient text clips |
| `.hero-l-anim` / `.hero-r-anim` / `.stats-anim` | Entrance slide animations |
| `.img-float` | Continuous float animation on hero image |
| `.badge-dot` | Pulsing green dot in badge |

---

## Image CDN URLs

```
Logo:        https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1781526126/logoImage_nonxua.png
Hero Image:  https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1781526127/rightsideimage_ext740.png
```

Both are configured as `remotePatterns` in `next.config.ts`.

---

## File Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    ← root layout, ClerkProvider, Plus Jakarta Sans
│   │   ├── page.tsx                      ← hero section (client component, Clerk auth UI)
│   │   ├── globals.css                   ← Tailwind v4 + brand tokens + all animations
│   │   ├── onboarding/
│   │   │   └── page.tsx                  ← username collection (fallback, Clerk handles natively)
│   │   ├── sign-in/[[...sign-in]]/
│   │   │   └── page.tsx                  ← Clerk SignIn page (catch-all route)
│   │   ├── sign-up/[[...sign-up]]/
│   │   │   └── page.tsx                  ← Clerk SignUp page (catch-all route)
│   │   ├── transition/
│   │   │   ├── page.tsx                  ← 7-sec cinematic loading screen (client component)
│   │   │   └── transition.css            ← all keyframe animations, scoped to .page *
│   │   ├── dashboard/
│   │   │   ├── page.tsx                  ← full CEO dashboard (Phase 21), real Neon data, Chart.js
│   │   │   └── dashboard.css             ← all dashboard styles, scoped to .nexora-dash
│   │   └── api/
│   │       ├── auth/sync/
│   │       │   └── route.ts              ← GET: upsert Clerk user → Neon, redirect to /
│   │       └── dashboard/
│   │           ├── kpis/route.ts         ← inventory value, orders, shipments, OTD%, active products
│   │           ├── branches/route.ts     ← per-warehouse inventory value, utilization%, OTD%
│   │           ├── inventory-categories/route.ts ← SUM by category (donut + top products)
│   │           ├── orders-trend/route.ts ← 8-day daily order counts (generate_series)
│   │           ├── shipments-trend/route.ts ← 8-day daily dispatched_at counts
│   │           └── alerts/route.ts       ← latest 4 rows from agent_logs
│   ├── components/
│   │   └── ui/
│   │       └── button.tsx                ← shadcn Button (base-ui/react)
│   ├── lib/
│   │   ├── utils.ts                      ← cn() utility (clsx + tailwind-merge)
│   │   ├── db.ts                         ← neon() SQL client (DATABASE_URL)
│   │   └── auth.ts                       ← getOrCreateUser() lazy Clerk→Neon sync
│   └── proxy.ts                          ← Clerk middleware (public route matcher)
├── next.config.ts                        ← Cloudinary remotePatterns
├── components.json                       ← shadcn CLI config
└── samplecode/                           ← reference HTML designs (DO NOT delete)
```

## Clerk Auth

- Package: `@clerk/nextjs` v7.5.2 (v7 — breaking changes from v5/v6)
- `ClerkProvider` wraps outside `<html>` in `layout.tsx`
- Middleware: `src/proxy.ts` (NOT `middleware.ts`) with `clerkMiddleware` + `createRouteMatcher`
- Navbar: `useUser()` → signed-out shows `<SignInButton mode="modal">`, signed-in shows `Welcome, {username}` + `<UserButton />`
- Hero CTA + mobile overlay: also wrapped with `<SignInButton mode="modal">` when signed out
- Clerk dashboard: **Require username ON** — username collected in Clerk modal during sign-up
- Sign-in/sign-up pages at `/sign-in/[[...sign-in]]` and `/sign-up/[[...sign-up]]` (Nexora gradient background)
- After sign-in/sign-up: force-redirects to `/api/auth/sync` (upserts user to Neon) then → `/`
- Signed-in "Get Started" → `/transition` → 7-sec animation → `/dashboard`
- **CSS bleed rule**: any page-level CSS reset (`* { margin:0 }`) MUST be scoped to `.page *` — plain `*` resets persist across client-side navigation and break other pages
- **Transition layout rule**: `.scene` must be `position:absolute; inset:0` (full viewport), `.top` floats over it `position:absolute; top:0`. Never use a flex column layout or add a background gradient to `.page` — it creates a white band above the panorama
- **Clerk hydration rule**: any `isSignedIn`-conditional JSX MUST be guarded by `isLoaded` — use `{isLoaded && isSignedIn ? <authed/> : <signInBtn/>}`. Without `isLoaded`, SSR renders signed-out HTML, client renders signed-in HTML → hydration mismatch error.
- **Dashboard scroll rule**: scrollable content pane inside a flex column must use `flex: 1; min-height: 0; overflow-y: scroll`. Without `min-height: 0`, flexbox expands the div to its full natural height and the parent's `overflow: hidden` clips the scrollbar — page appears non-scrollable.
- **Dashboard CSS scope**: all selectors prefixed with `.nexora-dash`, CSS vars on `.nexora-dash {}` not `:root`. Body overflow set/restored in `useEffect`.
- `NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/api/auth/sync` — must be set in Vercel env vars
- `NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/api/auth/sync` — must be set in Vercel env vars

### Clerk v7 Key Differences
| Old | New (v7) |
|---|---|
| `<SignedIn>` / `<SignedOut>` | `useUser()` + conditional JSX |
| `redirectUrl` prop | `forceRedirectUrl` prop |
| `afterSignOutUrl` prop on UserButton | `NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL` env var |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL` |
| `middleware.ts` | `proxy.ts` (Next.js 16) |

---

## Development Commands

```bash
npm run dev      # start dev server at localhost:3000
npm run build    # production build
npm run lint     # ESLint check
```

---

## Backend API

Live at: `https://nexora-warehouse.onrender.com`

Key endpoints the frontend will consume:
| Endpoint | Purpose |
|---|---|
| `GET /health` | Health check |
| `POST /ceo/briefing` | CEO morning briefing |
| `GET /ceo/decisions` | Recent executive decisions |
| `POST /orchestrator/run` | Trigger agent workflow |
| `GET /orchestrator/pending` | Pending HITL approvals |
| `POST /finance/query` | Finance dashboard data |
| `POST /knowledge/query` | RAG knowledge search |

---

## Path Alias

`@/*` maps to `./src/*` — always use this for imports.

```tsx
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
```
