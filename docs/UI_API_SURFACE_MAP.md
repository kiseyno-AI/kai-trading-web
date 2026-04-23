# UI API Surface Map

This document answers a debugging question quickly: which screen or component uses which backend API, and which fields actually drive the UI.

## Dashboard route: `/dashboard`

Entry points:
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/live-dashboard-client.tsx`

SSR bootstrap:
- `GET /market/status`
- `GET /quotes/tracked`
- `GET /eod/freshness`
- `GET /eod/pipeline/status?market_date={today.trade_date}`
- `GET /disclosures/dart/fundamentals/daily/inspect?runs_limit=1&market_date={resolved_pipeline.market_date}`

Client polling:
- `GET /api/trading/market/status`
- `GET /api/trading/quotes/tracked`
- `GET /api/trading/quotes/{symbol}`
- `GET /api/trading/eod/freshness`
- `GET /api/trading/eod/piotroski-filter-results?market_date={resolved_pipeline.market_date}`
- `GET /api/trading/eod/pipeline/status?market_date={today.trade_date}`
- `GET /api/trading/disclosures/dart/fundamentals/daily/inspect?runs_limit=1&market_date={resolved_pipeline.market_date}`
- `GET /api/trading/symbols/search?q=...&limit=8`

UI surfaces and fields:
- Shared responsive chrome: mobile fixed app bar + bottom tab bar, desktop KAI Trading rail + top bar -> navigation only, no additional backend dependency
- Operational Integrity card: `/market/status` + `/eod/freshness` + `/eod/pipeline/status` + `/agent-context/feedback/progress` + `/disclosures/dart/fundamentals/daily/inspect` + `/eod/piotroski-filter-results` -> `state`, `server_time`, `is_trading_day`, `today.trade_date`, resolved non-agent process date from `pipeline.market_date`, stage objects `today.price`, `today.technical_analysis`, `today.action_summary`, `today.fundamentals`, each stage `status`, `symbols_succeeded`, `symbols_total`, `symbols_failed`, live pipeline stages `stages.price_collection`, `stages.technical_snapshots`, `stages.action_summaries`, `stages.trending_ranks`, `stages.signal_features`, and optional `stages.fundamentals_daily_refresh` with `status`, `processed`, `total`, `failed`, `current_step`, `current_activity`, `current_symbol`, `latest.price_trade_date`, `latest.technical_market_date`, `latest.action_market_date`, agent progress `request.market_date`, `request.expected_agents`, `summary.is_live`, `summary.run_status`, `summary.progress_percent`, `summary.total_symbols`, `summary.failed_items`, `summary.completed_symbols`, `summary.latest_feedback_at`, `summary.seconds_since_last_feedback`, `summary.current_role`, optional role-progress payloads, Piotroski `summary.entries`, `summary.passed_count`, optional legacy `fundamental(s).latest_date`, and fundamentals `latest_run.status` / `latest_run.market_date` / `latest_run.symbols_checked` / `latest_run.symbols_refreshed` / `latest_run.run_metadata.refreshed_symbols_sample`; D2 now renders `Daily Data Fetch`, `Filtering`, and `Agent Feedback` cards inside the same hero. Daily Data Fetch keeps the Price Fetch / Technical Analysis / Action Summary / Fundamentals freshness rows, and a mapped running pipeline stage still reuses the animated status pill on the matching row to show `current_step` or `current_activity` instead of adding a second pipeline list. The Daily Data Fetch header keeps `today.trade_date`, but stage sync/completion state and the Filtering card both resolve against `pipeline.market_date` when Core reports an older latest completed daily run for the requested trade date. A stage shows `synced` when that resolved pipeline market date matches its relevant latest date and the resolved stage status is `ready`, `running` when the resolved stage status is `running`, `break day` on non-trading market days when a resolved `ready` stage is stale, and `not synced` otherwise, with stale latest dates shown in the row details. Filtering shows Piotroski completion state plus checked/pass counts for the same resolved pipeline market date and keeps the `More` route into the full pass list. Agent Feedback keeps animated role progress and active metrics while running, then continues to show the latest market date plus per-role complete counts/status when not running, using direct role payloads when present and a bounded fallback summary otherwise. If the latest fundamentals run is failed/partial, the review control opens a failure dialog from `latest_run.error_message`, failure counters, timing/count fields, and failure-related `run_metadata`.
- Quote board rows: `/quotes/tracked.items[]` -> `symbol`, `company_name`, `price`, `change`, `change_pct`, `turnover`, `volume`, `as_of`, `source`, `available`, `fallback`, `fallback_reason`, `unavailable_reason`, `trade_date`
- Piotroski full-list route: `/eod/piotroski-filter-results.items[]` + `/quotes/{symbol}` + `/symbols/search` -> pass rows only, sorted by `piotroski_score` descending on the client; the dashboard now keeps only the D2 summary card and the `More` route shows the full passed-symbol list
- Coverage notes: `/quotes/tracked` + `/eod/freshness` -> derived counts plus `today.eod_status`, `latest.price_trade_date`, `latest.technical_market_date`, `latest.action_market_date`

Important behavior:
- The UI now treats `available: false` as an explicit unavailable state, not as a zero-price quote.
- `source: "daily_price_bar"` means the backend is serving DB-backed EOD fallback from `daily_price_bars`.
- Dashboard cards intentionally keep price freshness and technical freshness separate.
- Search entry on mobile lives in the bottom tab bar / manage-feed CTA; desktop uses the left rail plus top command bar treatment from the Stitch wide view.

## Piotroski pass route: `/dashboard/piotroski-filter`

Entry point:
- `src/app/dashboard/piotroski-filter/page.tsx`
- `src/app/dashboard/piotroski-filter/piotroski-filter-page-client.tsx`

Client loading:
- `GET /api/trading/eod/freshness` when the route is opened without `marketDate`
- `GET /api/trading/eod/piotroski-filter-results?market_date={marketDate}`
- `GET /api/trading/quotes/{symbol}`
- `GET /api/trading/symbols/search?q={symbol}&limit=8` when the quote payload does not provide a usable company name

UI surfaces and fields:
- Shared responsive chrome: same dashboard shell and top app bar as `/dashboard`
- Full pass list: `/eod/piotroski-filter-results.items[]` -> `symbol`, `passed_filter`, `piotroski_score`; `/quotes/{symbol}` -> `price`, `change_pct`; `/symbols/search` -> fallback `name_ko` / `name` / `company_name`

Important behavior:
- The route preserves the dashboard market date by forwarding `marketDate` from the D2 Filtering `More` link.
- Row clicks forward the resolved symbol name and `marketDate` into `/dashboard/symbol/[symbol]`.

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
- `/dashboard/symbol/[symbol]/disclosure-coverage/[receiptNo]`
- `/dashboard/symbol/[symbol]/system-freshness`

Client polling:
- `GET /api/trading/quotes/{symbol}`
- `GET /api/trading/market/status`
- `GET /api/trading/eod/freshness`
- `GET /api/trading/agent-context/symbol-day?market_date=...&symbols={symbol}&disclosures_limit=5[&fs_div=...]`
- `GET /api/trading/eod/technical-snapshots?market_date=...&symbols={symbol}`
- `GET /api/trading/eod/action-summaries?market_date=...&symbols={symbol}`
- `GET /api/trading/disclosures/dart/fundamentals/history?symbols={symbol}&start_date=...&end_date=...[&fs_div=...]`
- `GET /api/trading/disclosures/dart/filings/document?rcept_no={receiptNo}`
- `GET /api/trading/symbols/{symbol}/price-bars?...`
- `GET /api/trading/symbols/search?q={symbol}&limit=20` when route seed metadata is incomplete
- `GET /api/trading/scanner/tracked-symbols`
- `POST /api/trading/scanner/tracked-symbols`

UI surfaces and fields:
- Shared responsive chrome: mobile fixed app bar + bottom tab bar, desktop KAI Trading rail + top bar -> current symbol navigation state only, no additional backend dependency
- Quote hero: `/quotes/{symbol}` + `/market/status` + `/symbols/search` + `/agent-context/symbol-day` -> `price`, `change`, `change_pct`, `volume`, `turnover`, `market_state`, `source`, `available`, `fallback`, `fallback_reason`, `unavailable_reason`, `cached_at`, `trade_date`, route metadata seed, aggregate availability summary
- Hero tracked-symbol star: `/scanner/tracked-symbols` -> `tracked_symbols`; clicking the star posts the replacement symbol list, fills the star when the current symbol is present, and clears the fill when it is removed
- Market-status gate for quote polling: `/market/status` -> `state`
- Chart: `/symbols/{symbol}/price-bars` -> `items[].trade_date`, `open_price`, `high_price`, `low_price`, `close_price`, `volume`, `turnover`
- Action Summary section: `/eod/action-summaries` with fallback `/agent-context/symbol-day.action_summary` -> `action_label`, `signal_score`, `confidence_tier`, `risk_tier`, `trigger_price`, `support_price`, `resistance_price`, `reasons`, `summary_payload`
- Technical Analysis section: `/eod/technical-snapshots` with fallback `/agent-context/symbol-day.technical_snapshot` -> `trend_state`, `ma_alignment`, `breakout_20d`, `breakdown_20d`, `return_5d`, `return_20d`, `volume_ratio_20d`, `atr_14`, `atr_pct_14`, `signal_payload`
- Fundamentals section: `/disclosures/dart/fundamentals/history` with fallback `/agent-context/symbol-day.fundamentals.latest_snapshot` -> `companies[].entries[].filing`, `period`, `statement.fs_div`, `highlights[]`
- Disclosures section: `/agent-context/symbol-day` -> `recent_disclosures.count`, `recent_disclosures.items[]`, `availability.recent_disclosures`
- Disclosure report detail: `/disclosures/dart/filings/document` -> document stream keyed by `recent_disclosures.items[].rcept_no`
- System Freshness section: `/eod/freshness` -> `today.trade_date`, `today.eod_status`, `today.symbols_succeeded`, `today.symbols_total`, `latest.price_trade_date`, `latest.symbols_succeeded`, `latest.symbols_total`, `latest.technical_market_date`, `latest.action_market_date`
- Fusion note and fallback messaging: `/agent-context/symbol-day` -> `company`, `technical_snapshot`, `action_summary`, `fundamentals`, `recent_disclosures`, `availability`
- Symbol metadata fallback seed: `/symbols/search` -> `symbol`, `standard_code`, `name_ko`, `market`
- Detail page tabs: route-only navigation that preserves known seed metadata, `marketDate`, and `fsDiv`; seed values are forwarded only when they come from actual symbol metadata or non-placeholder route params.

Important behavior:
- The primary chart now uses the stored historical bars API, not an in-page quote trace. The technical-analysis detail page also renders the same candlestick API on desktop to match the Stitch candlestick view.
- The chart focus card updates from chart interaction, but the chart itself remains EOD-history based.
- Quote polling stops entirely after the first response where both `/market/status.state` and `/quotes/{symbol}.market_state` are `CLOSED`.
- `/agent-context/symbol-day`, `/eod/technical-snapshots`, `/eod/action-summaries`, `/disclosures/dart/fundamentals/history`, and `/symbols/{symbol}/price-bars` are one-shot per dependency change, not recurring quote polls.
- `/scanner/tracked-symbols` is requested by the symbol detail route only for the hero star state and toggle; it does not enable order execution.
- When a technical or action field is not confirmed upstream, the UI shows `[확인 필요]` instead of manufacturing indicator values.
- The five dedicated detail routes reuse the same responsive chrome, dev tags, and API loaders as the overview card stack. They narrow the rendered body to the selected Stitch detail screen instead of duplicating data logic.

## Search route: `/search`

Entry point:
- `src/app/search/page.tsx`

Client polling:
- `GET /api/trading/symbols/search?q=...&limit=20`
- `GET /api/trading/quotes/{symbol}`
- `GET /api/trading/symbols/favorites`
- `GET /api/trading/scanner/tracked-symbols`
- `POST /api/trading/scanner/tracked-symbols`
- `GET /api/trading/scanner/realtime-trending?limit=...&market_code=J&sources=volume-rank,fluctuation,hts-top-view`
- `GET /api/trading/scanner/trending-stocks?period=1d|5d|20d&direction=both&limit=...`

UI surfaces and fields:
- Shared responsive chrome: mobile fixed search top bar + bottom tab bar, desktop KAI Trading rail + centered search surface -> navigation only, no direct backend dependency
- Terminal search input and inline autocomplete: `/symbols/search` -> `query`, `count`, `items[].symbol`, `items[].standard_code`, `items[].name_ko`, `items[].market`; the autocomplete list is rendered directly under Q1 only while the query is non-empty
- Quick access cards: `/symbols/favorites.items[]` only; the `+` action opens a symbol-search dialog backed by `/symbols/search`, then posts the updated symbol set through `/scanner/tracked-symbols` because that is the current core write path that persists scanner membership
- Trending symbols cards: `/scanner/realtime-trending.items[]` for the KIS tab and `/scanner/trending-stocks.items[]` for stored `1d`, `5d`, and `20d` tabs -> exact `symbol`, display name, market, rank, metric/change percentage, source label, and selected symbol metadata seed. The first fetch shows five rows; the More button raises the requested limit by five.
- Desktop results table: `/symbols/search.items[]` -> `symbol`, `standard_code`, `name_ko`, `market`; selected row also uses `/quotes/{symbol}` for `price`, `change_pct`, `cached_at`, `trade_date`

Important behavior:
- Symbol detail links preserve only actual metadata returned by `/symbols/search`; `market` is never hardcoded.
- Desktop Stitch-only fields such as market cap, terminal coverage tier, result ranking, and bulk freshness are rendered as `[확인 필요]` unless backed by the selected quote response or returned search metadata.
- Dev-mode tags for this route are `search.terminal-shell`, `search.quick-access`, `search.trending-symbols`, and `search.desktop-results-table`.

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
- `src/app/api/trading/symbols/favorites/route.ts`
- `src/app/api/trading/symbols/[symbol]/price-bars/route.ts`
- `src/app/api/trading/symbols/search/route.ts`

Behavior:
- These handlers proxy JSON through to trading-core.
- UI debugging should confirm whether a field is missing upstream in trading-core before changing the frontend interpretation.
