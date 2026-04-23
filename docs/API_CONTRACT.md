# Trading Web ↔ Trading Core API Contract

This document defines the first practical frontend contract for wiring `trading-web` to the FastAPI backend in `trading-core`.

## Current shipped dashboard wiring
- `/dashboard` currently renders from these live endpoints where available:
  - `GET /market/status`
  - `GET /quotes/tracked`
  - `GET /quotes/{symbol}`
  - `GET /symbols/search`
  - `GET /eod/freshness`
    - D2 Daily Data Fetch resolves each stage from the latest known snapshot by default, only keeping `today.price`, `today.technical_analysis`, `today.action_summary`, and `today.fundamentals` as the visible source while the matching same-day pipeline stage is actively running or already aligned with the latest layer date; price/technical/action show `symbols_succeeded / symbols_total`, while fundamentals shows a single checked count from the daily inspect run when available
    - Daily Data Fetch keeps the visible header market date on `today.trade_date`, but non-agent D2 status resolution follows the resolved process market date from `/eod/pipeline/status.market_date` when Core reports an older latest run for the requested trade date
    - Stage labels map to `synced` when the resolved stage status is `ready` and the relevant latest date is present, even when the visible `today.trade_date` is newer than that latest date; `running` when the resolved stage status is `running`; `break day` when `/market/status` marks a non-trading day and a resolved `ready` stage is stale; otherwise `not synced`, with the stale latest date shown on the subcard when present
    - Relevant latest dates are `latest.price_trade_date`, `latest.technical_market_date`, `latest.action_market_date`, and the latest DART fundamentals date from the daily inspect response; legacy optional layer objects such as `technical.latest_date`, `fundamental.latest_date`, and `fundamentals.latest_date` remain tolerated as deployment-compatibility fallbacks
  - `GET /eod/piotroski-filter-results?market_date=YYYY-MM-DD`
    - D2 Filtering now renders Piotroski summary state instead of a top-pass teaser list, showing completion state plus `summary.entries` and `summary.passed_count` for the resolved non-agent pipeline market date
    - The D2 Filtering `More` link opens `/dashboard/piotroski-filter?marketDate=YYYY-MM-DD`, which still renders the full passed-symbol list for the same market date and keeps row clicks routed to `/dashboard/symbol/[symbol]`
  - `GET /eod/pipeline/status`
    - `/dashboard` requests this endpoint with the active `market_date` from `/eod/freshness.today.trade_date`, falling back to the market server date when freshness has not loaded
    - When Core responds with an older `market_date` because the latest daily run is still the previous session, `/dashboard` keeps polling the requested active trade date but treats the response `market_date` as the resolved non-agent status basis for Daily Data Fetch, Filtering, and the DART daily inspect follow-up request
    - D2 EOD Status treats `stages.price_collection`, `stages.technical_snapshots`, `stages.action_summaries`, and `stages.fundamentals_daily_refresh` as the live running-state override for the matching freshness subcards; when one of those pipeline stages is `running`, the dashboard keeps the subcard in `running`, uses the pipeline processed/total counters for the visible count, and replaces the usual `synced` pill copy on that same subcard with the reported `current_step`, falling back to `current_activity` and the animated running badge when step text is unavailable
    - The dashboard no longer renders a separate pipeline activity list; it still uses the pipeline endpoint for running-state polling every second while the overall pipeline status or any reported stage remains `running`, and it keeps `current_activity` / `current_symbol` as tooltip context on the running badge when Core reports them
  - `GET /agent-context/feedback/progress`
    - D2 Agent Feedback progress uses `latest.price_trade_date` from `/eod/freshness` as the primary `market_date`, falling back to `today.trade_date` only when no latest price date exists
    - D2 Agent Feedback always shows role rows for the latest market date. While the resolved state is running (`summary.run_status: running`, with `summary.is_live` kept as a legacy fallback), the active summarizer row keeps the detailed progress metrics from `summary.progress_percent`, `summary.total_symbols`, `summary.failed_items`, `summary.completed_symbols`, and `summary.current_role`
    - When the resolved state is not running, D2 Agent Feedback keeps the latest market date visible and shows persisted per-role counts from `result.roles[role].requested_count`, `completed_count`, and `error_count`. If those result counts are absent, the dashboard falls back to the backend role order plus `summary.completed_symbols`, `summary.total_symbols`, and `summary.current_role` to derive a bounded latest-run summary
    - Agent Feedback role rows show compact progress bars under each summarizer title, with right-side status icons still derived from the row status. Running role rows still build from `request.expected_agents`, animate the role matching `summary.current_role`, and keep dependency details such as EOD / Tech readiness out of the summarizer rows; the endpoint is not session-cached because active agent processing can change during the dashboard session and is polled every second while running
  - `POST /agent-context/internal/core/control`
    - The D2 Agent Feedback stop confirmation posts through the Next.js BFF to this authenticated admin endpoint with `{ "action": "kill", "signal_name": "SIGKILL", "port": 8000 }`, allowing the existing dashboard stop flow to invoke the new core control API without exposing the upstream bearer token to the browser
  - `GET /disclosures/dart/fundamentals/daily/inspect`
    - `/dashboard` requests this endpoint with the resolved non-agent pipeline market date from `/eod/pipeline/status.market_date`, falling back to the active trade date or market server date when the pipeline response does not provide one yet
    - D2 Fundamentals displays the latest fundamentals layer date when `/eod/freshness` exposes one; otherwise it falls back to `latest_run.market_date` or the date portion of `latest_run.completed_at`
    - D2 Fundamentals uses `latest_run.status` from the daily inspect response when available instead of keeping a stale `[확인 필요]` placeholder
    - D2 Fundamentals shows the same-day refreshed symbol count from `latest_run.symbols_refreshed` and a bounded sample from `latest_run.run_metadata.refreshed_symbols_sample` when Core provides it
    - When the latest DART fundamentals run has a failed/partial signal, D2 Fundamentals exposes a failure dialog from the status control using `latest_run.error_message`, `symbols_failed`, `events_failed`, run timing/count fields, and failure-related `run_metadata` keys when present
- `/dashboard/symbol/[symbol]` now mixes:
  - `GET /quotes/{symbol}` for the live price, volume, turnover, and quote provenance
  - `GET /market/status` only as the polling stop gate for the symbol quote loop
  - `GET /symbols/{symbol}/price-bars` for the mobile candlestick chart
  - `GET /eod/technical-snapshots` for the dedicated technical-analysis section
  - `GET /eod/action-summaries` for the dedicated action-summary section
  - `GET /eod/piotroski-filter-results?market_date=YYYY-MM-DD&symbol=005930` for the S1 hero Piotroski pass/fail card
  - `GET /eod/freshness` for layer-specific freshness labels, with `latest.technical_market_date` as the stable technical freshness field and optional layer status fields like `technical.success` and `technical.latest_date` consumed when present
  - `GET /disclosures/dart/fundamentals/history` for stored DART fundamentals history
  - `GET /agent-context/symbol-day` for company metadata, aggregate availability, fallback technical/action data, latest fundamentals summary, and recent disclosures; the S1 hero also uses the latest disclosure name/date from this payload for the Fundamental latest card
  - `GET /disclosures/dart/filings/document?rcept_no=...` for the S7 disclosure report detail document stream
  - `GET /scanner/tracked-symbols` and `POST /scanner/tracked-symbols` for the hero star toggle beside the disabled Trade action; the star is filled when the current symbol is already tracked, and toggling posts the replacement tracked-symbol set
- The symbol detail card stack also powers dedicated mobile Stitch detail routes:
  - `/dashboard/symbol/[symbol]/action-summary`
  - `/dashboard/symbol/[symbol]/technical-analysis`
  - `/dashboard/symbol/[symbol]/fundamentals-history`
  - `/dashboard/symbol/[symbol]/disclosure-coverage`
  - `/dashboard/symbol/[symbol]/disclosure-coverage/[receiptNo]`
  - `/dashboard/symbol/[symbol]/system-freshness`
  These routes do not add live-trading behavior; they reuse the BFF reads above and preserve `[확인 필요]` for unconfirmed upstream fields.
- Field-level screen and component mapping now lives in `docs/UI_API_SURFACE_MAP.md`.
- Dev-tag and component specs now live in `docs/MOBILE_COMPONENT_SPEC.md` and `docs/DESKTOP_COMPONENT_SPEC.md`.
- `/search` Q3 quick access reads `GET /symbols/favorites`, opens the `+` dialog against `GET /symbols/search`, and adds a symbol by posting the replacement set to `POST /scanner/tracked-symbols`, matching the current core write API that persists scanner membership in the database.
- `/search` Q4 trending symbols now reads exact symbols from core trending sources: `GET /scanner/realtime-trending` for the KIS tab and `GET /scanner/trending-stocks` for stored `1d`, `5d`, and `20d` tabs. The card shows five rows first and requests a larger limit when the user taps More.
- The broader `/api/v1/dashboard/summary` contract below is still an intended future shape, not the current backend dependency for the live dashboard route.

## Goals
- Match the current UI shape in `/dashboard`, `/markets`, and `/bots`
- Keep the frontend broker-agnostic
- Give `trading-core` a clean first API surface without over-designing
- Preserve room for streaming upgrades later (WebSocket/SSE)

## Base assumptions
- Base URL: `/api/v1`
- Content type: `application/json`
- All responses use an envelope
- Timestamps are ISO-8601 UTC strings
- Currency/value strings shown below are display-ready for the current UI, but backend should also keep raw numeric fields in later revisions if analytics screens need them

## Response envelope

```json
{
  "data": {},
  "meta": {
    "generatedAt": "2026-03-29T08:10:00Z",
    "source": "api",
    "requestId": "req_01HQ..."
  }
}
```

## 1) Dashboard summary

### `GET /api/v1/dashboard/summary`
Returns enough data to render the current dashboard in a single request.

### Response
```json
{
  "data": {
    "nav": [
      {
        "id": "dashboard",
        "label": "Dashboard",
        "icon": "◫",
        "href": "/dashboard",
        "description": "Main command surface"
      }
    ],
    "searchSuggestions": [
      {
        "id": "market-1",
        "label": "BTC/USDT · Perpetual",
        "type": "market",
        "route": "/markets"
      }
    ],
    "metrics": [
      {
        "id": "total_balance",
        "title": "Total Balance",
        "value": "$4,284,390",
        "delta": "+2.48%",
        "tone": "positive",
        "subtitle": "Across spot, futures, and bot allocations"
      },
      {
        "id": "live_pnl",
        "title": "Live PNL",
        "value": "+$182,440",
        "delta": "Realtime",
        "tone": "positive",
        "subtitle": "Session return +4.21%",
        "sparkline": [58, 49, 52, 36, 39, 25]
      },
      {
        "id": "win_rate",
        "title": "Win Rate",
        "value": "78%",
        "delta": "30D",
        "tone": "neutral",
        "donut": {
          "value": 78,
          "summary": "214 wins · 101 losses"
        }
      }
    ],
    "chart": {
      "symbol": "BTC/USDT",
      "title": "Execution Chart",
      "tabs": ["1H", "4H", "1D"],
      "activeTab": "1H",
      "overlays": {
        "top": "87,880",
        "mid": "87,430",
        "low": "86,980"
      },
      "tradeMarkers": [
        {
          "side": "buy",
          "label": "Buy",
          "value": "87,140",
          "left": "19%",
          "top": "64%"
        }
      ],
      "orderBook": {
        "depth": 10,
        "sell": [{ "price": "87,688", "size": "1.82 BTC" }],
        "midPrice": "87,430.18",
        "midChange": "+1.8%",
        "buy": [{ "price": "87,418", "size": "2.03 BTC" }]
      }
    },
    "watchlist": [
      {
        "symbol": "BTC/USDT",
        "context": "Momentum intact",
        "price": 87430,
        "change": 1.82
      }
    ],
    "insight": {
      "score": "87 / 100",
      "label": "Primary Bias",
      "title": "Long continuation with guarded leverage",
      "description": "Order-flow delta remains positive while short-term funding stays manageable.",
      "rows": [
        { "label": "Confidence", "value": "High" },
        { "label": "Volatility", "value": "Elevated" }
      ]
    },
    "botControls": {
      "title": "Bot Controls",
      "idleLabel": "Bot idle · Awaiting command",
      "actions": [
        { "id": "start", "label": "Start Bot" },
        { "id": "pause", "label": "Pause" },
        { "id": "hedge", "label": "Hedge" },
        { "id": "stop", "label": "Stop" }
      ]
    }
  },
  "meta": {
    "generatedAt": "2026-03-29T08:10:00Z",
    "source": "api"
  }
}
```

## 2) Markets overview

### `GET /api/v1/markets/overview`
Lightweight summary for the current `/markets` page.

### Response
```json
{
  "data": {
    "spotlight": [
      {
        "symbol": "BTC/USDT",
        "trend": "Leading the tape",
        "volume": "$12.4B",
        "change": "+1.82%"
      }
    ]
  },
  "meta": {
    "generatedAt": "2026-03-29T08:10:00Z",
    "source": "api"
  }
}
```

## 3) Order book detail

### `GET /api/v1/markets/{symbol}/orderbook?depth=10`
Optional dedicated endpoint for later refresh/streaming without reloading the full dashboard.

### Response
```json
{
  "data": {
    "symbol": "BTC/USDT",
    "depth": 10,
    "midPrice": "87,430.18",
    "midChange": "+1.8%",
    "sell": [{ "price": "87,688", "size": "1.82 BTC" }],
    "buy": [{ "price": "87,418", "size": "2.03 BTC" }]
  },
  "meta": {
    "generatedAt": "2026-03-29T08:10:00Z",
    "source": "api"
  }
}
```

## 4) Bots overview

### `GET /api/v1/bots`
Returns bot roster for `/bots`.

### Response
```json
{
  "data": {
    "bots": [
      {
        "id": "bot-1",
        "name": "Momentum Breakout",
        "mode": "Armed",
        "risk": "Medium",
        "allocation": "28%",
        "status": "running"
      }
    ]
  },
  "meta": {
    "generatedAt": "2026-03-29T08:10:00Z",
    "source": "api"
  }
}
```

## 5) Bot command endpoint

### `POST /api/v1/bots/{botId}/commands`
Used by dashboard control buttons and future bot detail screens.

### Request
```json
{
  "command": "hedge",
  "note": "Triggered from dashboard quick actions"
}
```

### Response
```json
{
  "data": {
    "botId": "bot-1",
    "command": "hedge",
    "status": "hedged",
    "statusLabel": "Hedge active · Delta exposure reduced",
    "acceptedAt": "2026-03-29T08:11:10Z"
  },
  "meta": {
    "generatedAt": "2026-03-29T08:11:10Z",
    "source": "api"
  }
}
```

## Backend implementation notes for `trading-core`
- FastAPI router grouping suggestion:
  - `dashboard.py`
  - `markets.py`
  - `bots.py`
- Keep response DTOs close to router layer and map from domain models there
- Later add numeric/raw fields behind the same display contract instead of breaking existing UI fields
- Dashboard summary can aggregate from positions, pnl, orderbook cache, signal service, and bot orchestration service
- Use Redis/cache for short-lived market snapshots and order book depth data

## Frontend implementation notes in `trading-web`
- Types live in `src/types/trading-api.ts`
- Current mock adapter lives in `src/lib/trading-api.ts`
- Route-level hooks now consume the adapter rather than hardcoding page data
- FastAPI migration path: swap `mockTradingApi` for an HTTP-backed adapter with the same `TradingApiAdapter` interface
