# Trading Web

Next.js app-router prototype for a trading dashboard with a reusable shell, route-based information architecture, and shared UI primitives.

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.
The root route redirects to `/dashboard`.

## Environment

Trading API proxy routes under `src/app/api/trading/**` run as server-side Next handlers and forward requests to an upstream origin.

Use these env vars:

- `TRADING_API_UPSTREAM_BASE_URL` — preferred upstream origin for Vercel/serverless deployments, for example `https://api.example.com`
- `TRADING_API_UPSTREAM_BEARER_TOKEN` — optional bearer token forwarded as `Authorization: Bearer ...` to the upstream
- `TRADING_API_INTERNAL_BASE_URL` — legacy fallback name still supported for compatibility
- `NEXT_PUBLIC_TRADING_API_BASE_URL` — optional client adapter base; if unset, the app uses mock dashboard data (see `src/lib/trading-api.ts`)

If none of those upstream base URL vars are set, the proxy falls back to `http://127.0.0.1:8000` so local development keeps working against a local backend.

Copy [`.env.example`](./.env.example) to `.env.local` and edit values for your machine.

## Routes

- `/dashboard` — main trading command surface
- `/markets` — placeholder market overview route for future screeners and breadth data
- `/bots` — placeholder automation route for bot states, logs, and controls

## Project Structure

```text
src/
  app/
    api/
      trading/
        market/status/route.ts
        quotes/[symbol]/route.ts
        quotes/tracked/route.ts
        scanner/tracked-symbols/route.ts
        symbols/search/route.ts
    dashboard/page.tsx
    dashboard/symbol/[symbol]/page.tsx
    markets/page.tsx
    bots/page.tsx
    kis-dashboard/page.tsx
    page.tsx
    real-dashboard/page.tsx
    scanner-tracker/page.tsx
  components/
    dashboard/
    layout/
    navigation/
    ui/
  data/
    trading-dashboard.ts
  features/
    dashboard/
    markets/
    bots/
  lib/
    format.ts
    utils.ts
```

## Notes

- Shared demo data currently lives in `src/data/trading-dashboard.ts`.
- App-router pages and API handlers live under `src/app`.
- Shared layout/navigation lives in `src/components/layout` and `src/components/navigation`.
- Reusable UI elements live in `src/components/ui` (shadcn/ui via `components.json`).
- The structure is intended to make future real-data injection straightforward without keeping the whole dashboard in one page file.

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run test:e2e        # Playwright (starts dev server via config)
npm run test:e2e:ui     # Playwright UI mode
```

CI runs lint, build, and `test:e2e` on push/PR (see `.github/workflows/ci.yml`).

## OpenAI Codex

Agent instructions for this repo live under [`.codex/`](./.codex/): [`config.toml`](./.codex/config.toml), [`skills/`](./.codex/skills/), and [`agents/`](./.codex/agents/). Trust the project in Codex so those layers apply.

Typical loop: implement → `npm run lint` → `npm run test:e2e` after UI/routing → `npm run build` when needed. See [`AGENTS.md`](./AGENTS.md) and the `codex-workflow` skill.
