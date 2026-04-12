# Trading Web (kai-trading-web)

Next.js **frontend** for the KAI trading desk: dashboard shell, markets/bots areas, and a **BFF** that proxies selected calls to **trading-core** (FastAPI). This repo does **not** implement broker integrations; the backend lives in **kai-trading-core**.

---

## What this project is

| Area | Notes |
|------|--------|
| **UI** | App Router, React 19, Tailwind v4, shadcn/ui (`components.json`, Nova preset) |
| **Dashboard** | Live-oriented `/dashboard` SSR-fetches live trading data (`/market/status`, `/quotes/tracked`, `/scanner/tracked-symbols`); deployed server rendering now uses only the authenticated `TRADING_API_UPSTREAM_*` path, with localhost-only fallback to `127.0.0.1:8000` during true local development |
| **Data modes** | **Mock:** in local development, when `NEXT_PUBLIC_TRADING_API_BASE_URL` is unset, `src/lib/trading-api.ts` serves demo data from `src/data/trading-dashboard.ts`. **Live:** set the public base URL to your API origin (often same-origin BFF: `http://localhost:3000/api/trading`). On non-localhost deployments, the client adapter falls back to same-origin `/api/trading` when the public base URL is unset. |
| **BFF** | `src/app/api/trading/**` forwards GET requests to the **upstream** core API with optional bearer token; `GET /scanner/tracked-symbols` is also exposed as a same-origin compatibility alias |
| **Bots / markets (adapter)** | Bots overview and some flows still use mock adapter paths until wired to real endpoints |
| **Quality** | ESLint, Playwright e2e (`e2e/`), GitHub Actions CI |
| **Agent config** | Codex: `.codex/config.toml`, `.codex/skills/`, `.codex/agents/` |

**Docs in-repo:** `AGENTS.md`, `RULES.md`, `ARCHITECTURE.md`, `TASKS.md`, `docs/API_CONTRACT.md` (intended contract vs trading-core), `docs/UI_API_SURFACE_MAP.md` (screen/component to API/field wiring), `docs/MOBILE_COMPONENT_SPEC.md` (dev tags + mobile Stitch component spec), `docs/DESKTOP_COMPONENT_SPEC.md` (desktop Stitch component spec).

---

## Design reference

The current GUI reference for user-facing work is the Stitch project:

- [Stitch design reference](https://stitch.withgoogle.com/projects/3421673477307619036)

If a fresh screenshot or exported image from Stitch is available, link it from future updates. Until then, treat the Stitch project above as the source of truth for the current GUI direction.

---

## Authentication and upstream security

### Browser → Next.js BFF (`/api/trading/...`)

Server-side handlers use **`trading-upstream.ts`**. If **`TRADING_API_UPSTREAM_BEARER_TOKEN`** is set, the BFF sends `Authorization: Bearer …` to **trading-core** when proxying. The browser does not need to send that token for BFF routes (unless you add separate Next auth later).

### Browser → direct API (`NEXT_PUBLIC_TRADING_API_BASE_URL`)

If the client calls the core **directly** (bypassing the BFF), it must satisfy **whatever** trading-core requires (e.g. `UPSTREAM_BEARER_TOKEN` on the core). Do not put secrets in `NEXT_PUBLIC_*`, and prefer the same-origin BFF unless you intentionally want browser-to-core traffic.

---

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `TRADING_API_UPSTREAM_BASE_URL` | Server | Upstream trading-core origin (e.g. `https://api.example.com`) |
| `TRADING_API_INTERNAL_BASE_URL` | Server | Legacy alias for upstream base URL |
| `TRADING_API_UPSTREAM_BEARER_TOKEN` | Server | Bearer token forwarded to core on BFF proxy calls |
| `NEXT_PUBLIC_TRADING_API_BASE_URL` | Client | If set, client fetches use this base; if unset, localhost keeps **mock** data while deployed environments fall back to same-origin `/api/trading` |

If no upstream base URL env is set, localhost development still falls back to **`http://127.0.0.1:8000`**. Deployed BFF and SSR routes now fail loudly with a config error instead of silently guessing a same-origin or localhost upstream, and server rendering no longer uses `NEXT_PUBLIC_TRADING_API_BASE_URL` as an authenticated upstream source.

For preview/production, set these server env vars together:

```bash
TRADING_API_UPSTREAM_BASE_URL=https://your-core-origin
TRADING_API_UPSTREAM_BEARER_TOKEN=... # required for deployed SSR/BFF trading fetches
```

Use `NEXT_PUBLIC_TRADING_API_BASE_URL` only for browser-visible base URLs, and prefer the same-origin BFF value (`/api/trading` or `https://your-web-origin/api/trading`) rather than the core origin.

Copy **[`.env.example`](./.env.example)** to `.env.local` and adjust.

**Example (local):** core on `:8000`, browser uses BFF on `:3000`:

```bash
# .env.local — client hits same-origin BFF
NEXT_PUBLIC_TRADING_API_BASE_URL=http://localhost:3000/api/trading
# Server proxies to core (optional if core is default localhost:8000)
# TRADING_API_UPSTREAM_BASE_URL=http://127.0.0.1:8000
# TRADING_API_UPSTREAM_BEARER_TOKEN=...   # if core requires it
```

---

## HTTP API this app exposes (Next.js BFF)

Base URL (local dev): `http://localhost:3000`

These routes are implemented under **`src/app/api/trading/`**. They **proxy GET** to trading-core paths on the configured upstream (status and body pass through).

| Method | Next.js path | Upstream path (trading-core) | Query |
|--------|----------------|-------------------------------|--------|
| `GET` | `/scanner/tracked-symbols` | `/scanner/tracked-symbols` | — |
| `GET` | `/api/trading/market/status` | `/market/status` | — |
| `GET` | `/api/trading/agent-context/symbol-day` | `/agent-context/symbol-day` | `market_date`, repeatable `symbols`, optional `fs_div`, optional `disclosures_limit` |
| `GET` | `/api/trading/eod/freshness` | `/eod/freshness` | — |
| `GET` | `/api/trading/eod/technical-snapshots` | `/eod/technical-snapshots` | `market_date`, repeatable `symbols` |
| `GET` | `/api/trading/eod/action-summaries` | `/eod/action-summaries` | `market_date`, repeatable `symbols` |
| `GET` | `/api/trading/quotes/tracked` | `/quotes/tracked` | — |
| `GET` | `/api/trading/quotes/{symbol}` | `/quotes/{symbol}` | — |
| `GET` | `/api/trading/scanner/tracked-symbols` | `/scanner/tracked-symbols` | — |
| `GET` | `/api/trading/disclosures/dart/fundamentals/history` | `/disclosures/dart/fundamentals/history` | repeatable `symbols`, `start_date`, `end_date`, optional `fs_div` |
| `GET` | `/api/trading/symbols/{symbol}/price-bars` | `/symbols/{symbol}/price-bars` | `start_date`, `end_date`, `limit` |
| `GET` | `/api/trading/symbols/search` | `/symbols/search` | `q` (optional), `limit` (optional, forwarded) |

**Not proxied here:** trading-core endpoints such as `/broker/kis/*`, `/macro/*`, `/fx/*` are not under `/api/trading/` in this app. Add new route handlers if the UI needs them.

There is **no** separate OpenAPI document shipped for the BFF; behavior matches the upstream JSON. See **trading-core** `README.md` / `GET /docs` on the core service for the full API.

---

## Client adapter (`trading-api.ts`)

When **`NEXT_PUBLIC_TRADING_API_BASE_URL`** is set, the dashboard adapter issues fetches to:

- `{base}/market/status`
- `{base}/quotes/tracked`
- `{base}/scanner/tracked-symbols`

…with **no** `/api/v1` prefix (aligned with current core routes). Set `base` to `http://localhost:3000/api/trading` to use the BFF. When the env var is unset, deployed browser sessions fall back to same-origin `/api/trading`; localhost keeps mock mode.

Bots and some overview calls may still use **mock** implementations in the same module until wired to real endpoints.

---

## UI routes (pages)

| Path | Role |
|------|------|
| `/` | Redirects to `/dashboard` |
| `/dashboard` | Primary desk (server data from core when reachable); mobile and desktop Stitch layouts share the same API-backed data |
| `/dashboard/symbol/[symbol]` | Symbol-scoped view; `/quotes/{symbol}` keeps polling until both quote and market-status routes report `CLOSED`, while explanatory cards use `/agent-context/symbol-day` and symbol metadata falls back to `/symbols/search` only when route seed data is missing |
| `/dashboard/symbol/[symbol]/action-summary` | Stitch Action Summary Detail; reuses `/eod/action-summaries` with aggregate fallback |
| `/dashboard/symbol/[symbol]/technical-analysis` | Stitch Technical Analysis Detail; reuses `/eod/technical-snapshots` with aggregate fallback and renders the desktop candlestick view from `/symbols/{symbol}/price-bars` |
| `/dashboard/symbol/[symbol]/fundamentals-history` | Stitch Fundamentals History Detail; reuses `/disclosures/dart/fundamentals/history` with aggregate fallback |
| `/dashboard/symbol/[symbol]/disclosure-coverage` | Stitch Disclosure & Coverage Detail; reuses `/agent-context/symbol-day.recent_disclosures` |
| `/dashboard/symbol/[symbol]/system-freshness` | Stitch System Freshness Detail; reuses `/eod/freshness` and quote provenance |
| `/markets` | Markets overview (client data via adapter / mock) |
| `/bots` | Automation overview (mock-heavy today) |
| `/search` | Stitch terminal search entry backed by `/api/trading/symbols/search`; selected rows poll `/api/trading/quotes/{symbol}` |
| `/kis-dashboard` | Alternate KIS-oriented dashboard experiment |
| `/real-dashboard` | Alternate dashboard variant |
| `/scanner-tracker` | Scanner / tracking UI |

Layout and navigation: `src/components/layout`, `src/components/navigation`.

For exact field-level wiring by UI surface, use [`docs/UI_API_SURFACE_MAP.md`](./docs/UI_API_SURFACE_MAP.md).

---

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. For a **live** dashboard, run **trading-core** on `127.0.0.1:8000` (or set upstream URL) and configure `.env.local` as above.

```bash
npm run lint
npm run build
npm run test:e2e        # Playwright; starts dev server via playwright.config
npm run test:e2e:ui
```

---

## Project structure (abbreviated)

```text
src/
  app/
    api/trading/          # BFF proxy routes
    dashboard/            # Main dashboard + symbol route
    markets/, bots/, search/, ...
  components/             # layout, navigation, ui (shadcn), dashboard widgets
  features/               # dashboard, markets, bots composition
  data/                   # Mock/demo payloads
  lib/                    # trading-api adapter, trading-upstream, hooks, utils
  types/                  # DTOs (trading-api.ts)
docs/
  API_CONTRACT.md         # Intended envelope and shapes (may drift; compare to code)
e2e/                      # Playwright smoke tests
.codex/                   # Codex config, skills, agents
```

---

## CI

`.github/workflows/ci.yml` runs **lint**, **production build**, and **Playwright** on push/PR (see workflow for branches).

---

## OpenAI Codex

Instructions: **`.codex/config.toml`**, **`.codex/skills/`**, **`.codex/agents/`**. Trust the project in Codex so they load.

Typical loop: implement → `npm run lint` → `npm run test:e2e` after UI/routing → `npm run build` when appropriate. See **[AGENTS.md](./AGENTS.md)** and the **`codex-workflow`** skill.

---

## Related repos

- **kai-trading-core** — FastAPI backend; source of truth for `/market`, `/quotes`, `/scanner`, `/symbols`, KIS, EOD, etc. Keep BFF proxy paths and JSON aligned when either repo changes.
