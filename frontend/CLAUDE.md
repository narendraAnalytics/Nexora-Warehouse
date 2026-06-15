@AGENTS.md

# Nexora Warehouse — Frontend Developer Guide

| Skill | Path | When to Use |
|---|---|---|
| `langgraphpythonfastapi` | `C:\Users\ES\.claude\skills\langgraphpythonfastapi\SKILL.md` | Any backend work — FastAPI routes, LangGraph agents, tools, memory, RAG, events |



## Current Status

**Phase: 19 — Clerk Auth Integration COMPLETE**

- ✅ Next.js 16 + React 19 + TypeScript scaffold
- ✅ Tailwind v4 (CSS-first, no `tailwind.config.js`) + `@base-ui/react` + shadcn
- ✅ Hero page live at `src/app/page.tsx` — matches sample design exactly
- ✅ Plus Jakarta Sans via Google Fonts `<link>` (weights 400–800, NOT 900)
- ✅ Brand tokens, blob/orb/particle animations in `src/app/globals.css`
- ✅ Cloudinary CDN for images (configured in `next.config.ts`)
- ✅ **Deployed to Vercel: `https://nexorawarehouse.vercel.app`**
- ✅ Nexora logo as favicon (`src/app/icon.png`) — default Next.js favicon removed
- ✅ Clerk Auth (`@clerk/nextjs` v7.5.2) — login modal, navbar user state, sign-in/sign-up pages
- ⏳ Dashboard pages — Phase 20
- ⏳ API integration — backend live at `https://nexora-warehouse.onrender.com`

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
| DB | Drizzle ORM + Neon | Not yet wired — schema TBD |
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
│   │   └── sign-up/[[...sign-up]]/
│   │       └── page.tsx                  ← Clerk SignUp page (catch-all route)
│   ├── components/
│   │   └── ui/
│   │       └── button.tsx                ← shadcn Button (base-ui/react)
│   ├── lib/
│   │   └── utils.ts                      ← cn() utility (clsx + tailwind-merge)
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
- All auth redirects → `/` (hero page)

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
