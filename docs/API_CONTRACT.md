# Trading Web ↔ Trading Core API Contract

This document defines the first practical frontend contract for wiring `trading-web` to the FastAPI backend in `trading-core`.

## Current shipped dashboard wiring
- `/dashboard` currently renders from these live endpoints where available:
  - `GET /market/status`
  - `GET /quotes/tracked`
  - `GET /scanner/tracked-symbols`
  - `GET /symbols/search`
  - `GET /eod/freshness`
    - D2 EOD Status uses `today.received` as the recent EOD update flag and `latest.price_trade_date` as the latest stored EOD date
    - web currently treats `latest.technical_market_date` as the stable technical freshness fallback
    - optional layer objects such as `technical.success` and `technical.latest_date` may be consumed when present
- `/dashboard/symbol/[symbol]` now mixes:
  - `GET /quotes/{symbol}` for the live price, volume, turnover, and quote provenance
  - `GET /market/status` only as the polling stop gate for the symbol quote loop
  - `GET /symbols/{symbol}/price-bars` for the mobile candlestick chart
  - `GET /eod/technical-snapshots` for the dedicated technical-analysis section
  - `GET /eod/action-summaries` for the dedicated action-summary section
  - `GET /eod/freshness` for layer-specific freshness labels, with `latest.technical_market_date` as the stable technical freshness field and optional layer status fields like `technical.success` and `technical.latest_date` consumed when present
  - `GET /disclosures/dart/fundamentals/history` for stored DART fundamentals history
  - `GET /agent-context/symbol-day` for company metadata, aggregate availability, fallback technical/action data, latest fundamentals summary, and recent disclosures
- The symbol detail card stack also powers dedicated mobile Stitch detail routes:
  - `/dashboard/symbol/[symbol]/action-summary`
  - `/dashboard/symbol/[symbol]/technical-analysis`
  - `/dashboard/symbol/[symbol]/fundamentals-history`
  - `/dashboard/symbol/[symbol]/disclosure-coverage`
  - `/dashboard/symbol/[symbol]/system-freshness`
  These routes do not add live-trading behavior; they reuse the BFF reads above and preserve `[확인 필요]` for unconfirmed upstream fields.
- Field-level screen and component mapping now lives in `docs/UI_API_SURFACE_MAP.md`.
- Dev-tag and component specs now live in `docs/MOBILE_COMPONENT_SPEC.md` and `docs/DESKTOP_COMPONENT_SPEC.md`.
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
