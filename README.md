# KAI Trading Web

KAI Trading Web is the read-only operator interface for the KAI trading stack.
It turns validated Core and Exec read models into an overview, research tools,
decision review, and portfolio visibility. The browser never talks to a broker
or execution service directly.

## Product map

The application uses one responsive shell and four primary destinations:

| Destination | Route | Purpose |
| --- | --- | --- |
| Overview | `/dashboard` | Decisions requiring attention, portfolio risk, market context, and data-process health |
| Explore | `/search` | Symbol search, favorites, tracked symbols, and research entry points |
| Review | `/calendar` | Date-based recommendation review and decision history |
| Portfolio | `/portfolio` | Accounts, holdings, allocation, activity, and read-only runtime risk |

Contextual screens remain available under `/dashboard/symbol/[symbol]`,
`/markets/factors`, `/markets/crypto`, `/my-symbols`, and the shared decider
feedback route at `/dashboard/decider-feedback`. The shared route preserves the
selected `signal-decider` or `short-term-decider` agent in its query. The older
`/dashboard/signal-decider-feedback` route remains available as a signal-only
compatibility entry point. Retired experiments redirect to a canonical
destination:

| Retired route | Redirect |
| --- | --- |
| `/real-dashboard`, `/kis-dashboard`, `/bots` | `/dashboard` |
| `/scanner-tracker` | `/my-symbols` |
| `/markets` | `/markets/factors` |

## Safety and data integrity

These rules are part of the product contract, not presentation preferences:

- Web is a consumer of Core-owned and Exec-owned read models. It must not place,
  cancel, or modify orders and must not control Core or Exec processes.
- Browser requests use the same-origin Next.js BFF under `/api/trading/**`.
  Upstream bearer credentials stay on the server.
- Missing, stale, mismatched, or invalid data remains visibly unavailable. It
  must not be replaced by plausible prices, scores, dates, zeroes, or another
  symbol's row.
- A requested market date is considered current only when the returned actual
  or resolved date agrees with it.
- Cached EOD data and live polling data are intentionally separate. A failed
  refresh may preserve a last-known value only when the UI also marks it stale.

See [API contract](docs/API_CONTRACT.md) for endpoint-level details and
[UI/API surface map](docs/UI_API_SURFACE_MAP.md) for field ownership.

## Architecture

```text
Browser
  -> Next.js pages and client components
  -> same-origin /api/trading/* BFF
  -> authenticated kai-trading-core read APIs
  -> Core-owned Exec runtime read models where applicable
```

`kai-trading-core` is the source of truth for market, quote, decision, factor,
portfolio, and execution-runtime data. `kai-trading-exec` remains behind Core;
there is no direct Web-to-Exec or Web-to-broker path.

Main code boundaries:

```text
src/app/                 App Router pages and BFF route handlers
src/components/mobile/   Canonical responsive application shell
src/features/dashboard/  Overview display models and live-data orchestration
src/features/portfolio/  Portfolio and risk presentation
src/features/symbol-detail/
                         Exact-symbol data selection and detail presentation
src/features/markets/    Factor and crypto research surfaces
src/lib/                 BFF clients, caching, routing, and pure domain helpers
src/types/               Upstream DTOs
src/i18n/locales/        English and Korean product copy
e2e/                     Playwright operator-flow coverage
```

Read [ARCHITECTURE.md](ARCHITECTURE.md) before changing boundaries and
[AGENTS.md](AGENTS.md) plus [RULES.md](RULES.md) before editing code.

## Local setup

Install dependencies and start the development server:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. By default, local server-side BFF requests use
`http://127.0.0.1:8000` for Core. Copy `.env.example` to `.env.local` when the
upstream or authentication differs.

```bash
cp .env.example .env.local
```

| Variable | Scope | Meaning |
| --- | --- | --- |
| `TRADING_API_UPSTREAM_BASE_URL` | Server | Core origin used by BFF handlers |
| `TRADING_API_INTERNAL_BASE_URL` | Server | Legacy alias for the upstream origin |
| `TRADING_API_UPSTREAM_BEARER_TOKEN` | Server | Bearer token forwarded from BFF to Core |
| `NEXT_PUBLIC_TRADING_API_BASE_URL` | Browser | Optional client base; prefer same-origin `/api/trading` |
| `NEXT_PUBLIC_BASE_PATH` | Build/runtime | Optional deployment base path, such as `/trading-web` |
| `NEXT_DIST_DIR` | Build/runtime | Optional isolated Next.js output directory |

Never place credentials in `NEXT_PUBLIC_*`. Preview and production deployments
must set the upstream base URL and bearer token explicitly; they do not silently
fall back to localhost.

## Verification

Use the same sequence expected for a production-facing change:

```bash
npm run lint
npm run test:unit
npm run test:regression:display
npx next build --webpack
CI=true npm run test:e2e
```

The explicit Webpack build is the canonical local production check. UI or route
changes also require desktop and mobile browser verification for console errors,
overflow, keyboard access, and truthful unavailable/stale states.

## BFF surface

Route handlers live under `src/app/api/trading/` and proxy selected Core reads.
The main families are:

- market status, market snapshot, and quotes;
- symbol search, favorites, tracked membership, and price bars;
- EOD freshness, pipeline status, factor screens, technical snapshots, and
  action summaries;
- decision feedback, calendar, progress, and review;
- DART fundamentals and filing documents;
- portfolio summary and execution-runtime visibility;
- read-only crypto market, strategy, readiness, and paper-runtime visibility.

Handlers preserve upstream status/body where possible. JSON proxy reads use the
configured Web timeout and return an explicit `504` response when Core does not
respond in time. The complete current list and query shapes live in
[docs/API_CONTRACT.md](docs/API_CONTRACT.md).

## Caching and freshness

`src/lib/trading-api-cache.ts` stores successful cacheable reads in
`sessionStorage`. Stored EOD and fundamentals data can be cached longer than live
state. Market status, quotes, market snapshot, pipeline progress, agent progress,
and execution-runtime state remain polling-oriented and are not treated as
durable snapshots. Unavailable bootstrap sentinels are never written into the
shared trading snapshot cache.

## Release version

The visible release label comes from `package.json` via
`src/lib/release-version.ts`. Update `package.json` and `package-lock.json`
together:

```bash
npm version patch --no-git-tag-version
```

## Production serve on port 8383

The local production service uses port `8383` and an isolated
`.next-prod-8383` build:

```bash
./scripts/redeploy-prod-8383.sh
```

The deploy helper requires a clean `main`, fast-forwards it from `origin/main`,
builds with the `/trading-web` base path, restarts the launchd service, and runs
health checks. The canonical Tailnet entry point is:

```text
https://gangseunghyeon-uiui-macmini-1.tail1d831c.ts.net/trading-web
```

Run its browser smoke independently with:

```bash
npm run test:e2e:tailnet
```

## Design reference

User-facing work follows the current
[Stitch design project](https://stitch.withgoogle.com/projects/3421673477307619036)
while preserving the data-integrity rules above.

## Related repositories

- `kai-trading-core`: authoritative API, decision, market-data, and read-model layer
- `kai-trading-exec`: execution runtime behind Core-owned interfaces

Changes in this repository must not silently change either repository's behavior
or contract.
