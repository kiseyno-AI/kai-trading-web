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
- `GET /eod/freshness`

Client polling:
- `GET /api/trading/market/status`
- `GET /api/trading/quotes/tracked`
- `GET /api/trading/scanner/tracked-symbols`
- `GET /api/trading/eod/freshness`
- `GET /api/trading/symbols/search?q=...&limit=8`

UI surfaces and fields:
- Shared responsive chrome: mobile fixed app bar + bottom tab bar, desktop Obsidian Ledger rail + top bar -> navigation only, no additional backend dependency
- Operational Integrity card: `/market/status` + `/eod/freshness` -> `state`, `server_time`, `today.received`, `today.trade_date`, `today.symbols_succeeded`, `today.symbols_total`, `latest.price_trade_date`, `latest.symbols_succeeded`, `latest.symbols_total`, `latest.technical_market_date`, `latest.action_market_date`; the D2 EOD Status stat displays the received flag, market-date context, latest stored EOD date, and success/total EOD symbol counts, using latest counts when today's run has not happened yet.
- Tracked snapshot card: `/quotes/tracked.items[]` + `/scanner/tracked-symbols` + `/eod/freshness` -> tracked counts, aggregate turnover, live/fallback/unavailable counts, lead feed mode, layer freshness
- Quote board rows: `/quotes/tracked.items[]` -> `symbol`, `company_name`, `price`, `change`, `change_pct`, `turnover`, `volume`, `as_of`, `source`, `available`, `fallback`, `fallback_reason`, `unavailable_reason`, `trade_date`
- Tracked symbol list: `/scanner/tracked-symbols` -> `tracked_symbols`, `count`, `last_updated_at`
- Momentum board: `/quotes/tracked` -> top absolute movers from `items[].change_pct`
- Coverage notes: `/quotes/tracked` + `/eod/freshness` -> derived counts plus `today.eod_status`, `latest.price_trade_date`, `latest.technical_market_date`, `latest.action_market_date`
- Desktop audit feed: `/eod/freshness` + `/quotes/tracked` -> module freshness rows for price, technical, and action status

Important behavior:
- The UI now treats `available: false` as an explicit unavailable state, not as a zero-price quote.
- `source: "daily_price_bar"` means the backend is serving DB-backed EOD fallback from `daily_price_bars`.
- Dashboard cards intentionally keep price freshness and technical freshness separate.
- Search entry on mobile lives in the bottom tab bar / manage-feed CTA; desktop uses the left rail plus top command bar treatment from the Stitch wide view.

## Symbol detail route: `/dashboard/symbol/[symbol]`

Entry point:
- `src/app/dashboard/symbol/[symbol]/page.tsx`
- `src/app/dashboard/symbol/[symbol]/symbol-detail-client.tsx`
- `src/app/dashboard/symbol/[symbol]/symbol-history-chart.tsx`

Dedicated detail routes:
- `/dashboard/symbol/[symbol]/action-summary`
- `/dashboard/symbol/[symbol]/technical-analysis`
- `/dashboard/symbol/[symbol]/fundamentals-history`
- `/dashboard/symbol/[symbol]/disclosure-coverage`
- `/dashboard/symbol/[symbol]/system-freshness`

Client polling:
- `GET /api/trading/quotes/{symbol}`
- `GET /api/trading/market/status`
- `GET /api/trading/eod/freshness`
- `GET /api/trading/agent-context/symbol-day?market_date=...&symbols={symbol}&disclosures_limit=5[&fs_div=...]`
- `GET /api/trading/eod/technical-snapshots?market_date=...&symbols={symbol}`
- `GET /api/trading/eod/action-summaries?market_date=...&symbols={symbol}`
- `GET /api/trading/disclosures/dart/fundamentals/history?symbols={symbol}&start_date=...&end_date=...[&fs_div=...]`
- `GET /api/trading/symbols/{symbol}/price-bars?...`
- `GET /api/trading/symbols/search?q={symbol}&limit=20` when route seed metadata is incomplete

UI surfaces and fields:
- Shared responsive chrome: mobile fixed app bar + bottom tab bar, desktop Obsidian Ledger rail + top bar -> current symbol navigation state only, no additional backend dependency
- Quote hero: `/quotes/{symbol}` + `/market/status` + `/symbols/search` + `/agent-context/symbol-day` -> `price`, `change`, `change_pct`, `volume`, `turnover`, `market_state`, `source`, `available`, `fallback`, `fallback_reason`, `unavailable_reason`, `cached_at`, `trade_date`, route metadata seed, aggregate availability summary
- Market-status gate for quote polling: `/market/status` -> `state`
- Chart: `/symbols/{symbol}/price-bars` -> `items[].trade_date`, `open_price`, `high_price`, `low_price`, `close_price`, `volume`, `turnover`
- Action Summary section: `/eod/action-summaries` with fallback `/agent-context/symbol-day.action_summary` -> `action_label`, `signal_score`, `confidence_tier`, `risk_tier`, `trigger_price`, `support_price`, `resistance_price`, `reasons`, `summary_payload`
- Technical Analysis section: `/eod/technical-snapshots` with fallback `/agent-context/symbol-day.technical_snapshot` -> `trend_state`, `ma_alignment`, `breakout_20d`, `breakdown_20d`, `return_5d`, `return_20d`, `volume_ratio_20d`, `atr_14`, `atr_pct_14`, `signal_payload`
- Fundamentals section: `/disclosures/dart/fundamentals/history` with fallback `/agent-context/symbol-day.fundamentals.latest_snapshot` -> `companies[].entries[].filing`, `period`, `statement.fs_div`, `highlights[]`
- Disclosures section: `/agent-context/symbol-day` -> `recent_disclosures.count`, `recent_disclosures.items[]`, `availability.recent_disclosures`
- System Freshness section: `/eod/freshness` -> `today.trade_date`, `today.eod_status`, `today.symbols_succeeded`, `today.symbols_total`, `latest.price_trade_date`, `latest.symbols_succeeded`, `latest.symbols_total`, `latest.technical_market_date`, `latest.action_market_date`
- Fusion note and fallback messaging: `/agent-context/symbol-day` -> `company`, `technical_snapshot`, `action_summary`, `fundamentals`, `recent_disclosures`, `availability`
- Symbol metadata fallback seed: `/symbols/search` -> `symbol`, `standard_code`, `name_ko`, `market`
- Detail page tabs: route-only navigation that preserves known seed metadata, `marketDate`, and `fsDiv`; seed values are forwarded only when they come from actual symbol metadata or non-placeholder route params.

Important behavior:
- The primary chart now uses the stored historical bars API, not an in-page quote trace. The technical-analysis detail page also renders the same candlestick API on desktop to match the Stitch candlestick view.
- The chart focus card updates from chart interaction, but the chart itself remains EOD-history based.
- Quote polling stops entirely after the first response where both `/market/status.state` and `/quotes/{symbol}.market_state` are `CLOSED`.
- `/agent-context/symbol-day`, `/eod/technical-snapshots`, `/eod/action-summaries`, `/disclosures/dart/fundamentals/history`, and `/symbols/{symbol}/price-bars` are one-shot per dependency change, not recurring quote polls.
- `/scanner/tracked-symbols` is not requested by the symbol detail route anymore; tracked-universe coverage now remains a dashboard/search concern.
- When a technical or action field is not confirmed upstream, the UI shows `[확인 필요]` instead of manufacturing indicator values.
- The five dedicated detail routes reuse the same responsive chrome, dev tags, and API loaders as the overview card stack. They narrow the rendered body to the selected Stitch detail screen instead of duplicating data logic.

## Search route: `/search`

Entry point:
- `src/app/search/page.tsx`

Client polling:
- `GET /api/trading/symbols/search?q=...&limit=20`
- `GET /api/trading/quotes/{symbol}`

UI surfaces and fields:
- Shared responsive chrome: mobile fixed Search terminal top bar + bottom tab bar, desktop Obsidian Ledger rail + centered terminal search surface -> navigation only, no direct backend dependency
- Terminal search input and result count: `/symbols/search` -> `query`, `count`, `items.length`
- Mobile result cards: `/symbols/search.items[]` -> `symbol`, `standard_code`, `name_ko`, `market`; selected row also uses `/quotes/{symbol}` for price and change
- Quick access / recent cards: local recent selections plus current `/symbols/search.items[]`; no backend field is invented for unavailable recency
- Trending symbols cards: current `/symbols/search.items[]` metadata only; ranking source, market cap, and unselected prices remain `[확인 필요]` until confirmed upstream
- Desktop results table: `/symbols/search.items[]` -> `symbol`, `standard_code`, `name_ko`, `market`; selected row also uses `/quotes/{symbol}` for `price`, `change_pct`, `cached_at`, `trade_date`
- Selected quote panel: `/quotes/{symbol}` -> `price`, `change`, `change_pct`, `volume`, `turnover`, `source`, `available`, `fallback`, `is_live`, `cached_at`, `trade_date`, `unavailable_reason`

Important behavior:
- Symbol detail links preserve only actual metadata returned by `/symbols/search`; `market` is never hardcoded.
- Desktop Stitch-only fields such as market cap, terminal coverage tier, result ranking, and bulk freshness are rendered as `[확인 필요]` unless backed by the selected quote response or returned search metadata.
- Dev-mode tags for this route are `search.terminal-shell`, `search.mobile-results`, `search.quick-access`, `search.trending-symbols`, `search.network-integrity`, `search.desktop-results-table`, and `search.selected-quote`.

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
- `src/app/api/trading/eod/freshness/route.ts`
- `src/app/api/trading/eod/technical-snapshots/route.ts`
- `src/app/api/trading/eod/action-summaries/route.ts`
- `src/app/api/trading/disclosures/dart/fundamentals/history/route.ts`
- `src/app/api/trading/symbols/[symbol]/price-bars/route.ts`
- `src/app/api/trading/symbols/search/route.ts`

Behavior:
- These handlers proxy JSON through to trading-core.
- UI debugging should confirm whether a field is missing upstream in trading-core before changing the frontend interpretation.
