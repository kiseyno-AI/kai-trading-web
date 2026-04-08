# UI API Surface Map

This document answers a debugging question quickly: which screen or component uses which backend API, and which fields actually drive the UI.

## Dashboard route: `/dashboard`

Entry points:
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/live-dashboard-client.tsx`

SSR bootstrap:
- `GET /market/status`
- `GET /quotes/tracked`
- `GET /scanner/tracked-symbols`

Client polling:
- `GET /api/trading/market/status`
- `GET /api/trading/quotes/tracked`
- `GET /api/trading/scanner/tracked-symbols`
- `GET /api/trading/symbols/search?q=...&limit=8`

UI surfaces and fields:
- Hero market badges: `/market/status` -> `state`, `is_open`, `server_time`
- Hero lead tracked quote: first item from `/quotes/tracked.items[0]` -> `symbol`, `company_name`, `price`, `change`, `change_pct`, `turnover`, `volume`, `as_of`, `source`, `available`, `fallback`, `fallback_reason`, `unavailable_reason`, `trade_date`
- Quote board rows: `/quotes/tracked.items[]` -> same per-symbol fields as above
- Tracked symbol list: `/scanner/tracked-symbols` -> `tracked_symbols`, `count`, `last_updated_at`
- Search panel: `/symbols/search` -> `items[].symbol`, `standard_code`, `name_ko`, `market`

Important behavior:
- The dashboard lead quote is always the first tracked item returned by `/quotes/tracked`.
- The UI now treats `available: false` as an explicit unavailable state, not as a zero-price quote.
- `source: "daily_price_bar"` means the backend is serving DB-backed EOD fallback from `daily_price_bars`.

## Symbol detail route: `/dashboard/symbol/[symbol]`

Entry point:
- `src/app/dashboard/symbol/[symbol]/page.tsx`

Client polling:
- `GET /api/trading/quotes/{symbol}`
- `GET /api/trading/agent-context/symbol-day?market_date=...&symbols={symbol}&disclosures_limit=5[&fs_div=...]`
- `GET /api/trading/scanner/tracked-symbols`
- `GET /api/trading/symbols/search?q={symbol}&limit=20` when route seed metadata is incomplete

UI surfaces and fields:
- Quote summary cards and recent price trace: `/quotes/{symbol}` -> `price`, `change`, `change_pct`, `volume`, `turnover`, `market_state`, `source`, `available`, `fallback`, `fallback_reason`, `unavailable_reason`, `cached_at`, `trade_date`
- Aggregate context narrative and explanatory cards: `/agent-context/symbol-day` -> `company`, `technical_snapshot`, `action_summary`, `fundamentals`, `recent_disclosures`, `availability`
- Tracked-universe badge and messaging: `/scanner/tracked-symbols` -> `tracked_symbols`
- Symbol metadata fallback seed: `/symbols/search` -> `symbol`, `standard_code`, `name_ko`, `market`

Important behavior:
- The chart is not a historical bars API. It is an in-page trace built from repeated `/quotes/{symbol}` responses.
- Aggregate explanatory cards do not read `/quotes/{symbol}` except for quote-provenance messaging.

## Search route: `/search`

Entry point:
- `src/app/search/page.tsx`

Client polling:
- `GET /api/trading/symbols/search?q=...&limit=20`
- `GET /api/trading/quotes/{symbol}`

UI surfaces and fields:
- Search results list: `/symbols/search.items[]` -> `symbol`, `standard_code`, `name_ko`, `market`
- Right-hand quote panel: `/quotes/{symbol}` -> `price`, `change`, `change_pct`, `volume`, `turnover`, `source`, `available`, `fallback`, `cached_at`, `trade_date`, `unavailable_reason`

## Alternate dashboard routes

Files:
- `src/app/kis-dashboard/page.tsx`
- `src/app/real-dashboard/page.tsx`

APIs:
- `GET /market/status`
- `GET /quotes/tracked`
- `GET /scanner/tracked-symbols`

Important behavior:
- These routes consume the same tracked quote payload as `/dashboard`.
- They must handle `available: false` and `source: "daily_price_bar"` the same way as the main dashboard.

## BFF proxy layer

Files:
- `src/app/api/trading/market/status/route.ts`
- `src/app/api/trading/quotes/tracked/route.ts`
- `src/app/api/trading/quotes/[symbol]/route.ts`
- `src/app/api/trading/scanner/tracked-symbols/route.ts`
- `src/app/api/trading/agent-context/symbol-day/route.ts`
- `src/app/api/trading/symbols/search/route.ts`

Behavior:
- These handlers proxy JSON through to trading-core.
- UI debugging should confirm whether a field is missing upstream in trading-core before changing the frontend interpretation.
