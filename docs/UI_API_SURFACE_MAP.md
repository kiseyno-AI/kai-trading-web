# UI API Surface Map

This document answers a debugging question quickly: which screen or component uses which backend API, and which fields actually drive the UI.

## Global shell and data boundary

- One responsive `MobileAppChrome` owns both the desktop rail and mobile bottom navigation.
- The only primary destinations are Overview (`/dashboard`), Explore (`/search`), Review (`/calendar`), and Portfolio (`/portfolio`). Factor, crypto, My Symbols, symbol detail, and feedback pages are contextual destinations.
- Browser reads go through same-origin `/api/trading/**` handlers. No UI surface calls Exec directly or starts, stops, or signals Core or Exec processes.
- Symbol-scoped loaders accept only an exact normalized symbol match, and date-scoped loaders accept a response as current only when its actual or resolved date matches the requested date. A first row, another symbol's row, or an echoed request date is not valid evidence.

## Dashboard route: `/dashboard`

Entry points:
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/live-dashboard-client.tsx`

Initial server state:
- `src/app/dashboard/page.tsx` performs no upstream read. It renders explicit unavailable sentinels for market status and tracked quotes, plus `null` for every other dashboard source.
- The client accepts a source as available only after the corresponding validated BFF read succeeds; initial sentinels are not persisted as last-good data.

Client polling:
- `GET /api/trading/market/status`
- `GET /api/trading/market/snapshot`
- `GET /api/trading/quotes/tracked`
- `GET /api/trading/quotes/{symbol}`
- `GET /api/trading/eod/freshness`
- `GET /api/trading/eod/piotroski-filter-results?market_date={resolved_pipeline.market_date}`
- `GET /api/trading/eod/market-risk-filters?market_date={resolved_pipeline.market_date}`
- `GET /api/trading/eod/pipeline/status?market_date={today.trade_date}`
- `GET /api/trading/agent-context/feedback/progress?market_date={latest.price_trade_date}`
- `GET /api/trading/agent-context/feedback?market_date={agent_progress.market_date}&agent_name=signal-decider&limit={progress-sized full-result window, max 200}`
- `GET /api/trading/agent-context/feedback?market_date={latest_completed_or_resolved_feedback_date}&agent_name=signal-decider&limit={progress-sized full-result window, max 200}` for the dashboard-only latest-completed fallback
- `GET /api/trading/disclosures/dart/fundamentals/daily/inspect?runs_limit=1&market_date={resolved_pipeline.market_date}`
- `GET /api/trading/execution/runtime/status`
- `GET /api/trading/execution/runtime/monitored-symbols?market_date={today.trade_date}`
- `GET /api/trading/execution/runtime/daily-board?market_date={today.trade_date}`

UI surfaces and fields:
- Shared responsive chrome: mobile fixed app bar + bottom tab bar, desktop KAI Trading rail + top bar -> navigation only, no additional backend dependency
- Market condition card: `/market/snapshot` -> `status`, `indices.kospi.level/change/change_rate`, `indices.kosdaq.level/change/change_rate`, `fx.usdkrw.rate` or `value`, `flows.foreign`, `flows.institutional`, optional `summary.market_bias` / breadth line, optional `missing_fields`, and optional `stale_reason`; `/market/status` supplies only session and trading-day context. The card also accepts live Core partial-cache fields `markets.kospi` / `markets.kosdaq`, top-level `usd_krw`, and embedded row flows such as `foreign_net_value` / `institution_net_value`, normalizing them into the same display model. The card accepts direct or enveloped snapshot payloads, keeps partial-but-usable values visible, and labels `ready`, `partial`, `stale`, and `unavailable` states explicitly. This card does not read Piotroski or KIS risk-filter summaries as market-condition substitutes; if Core has not exposed `/market/snapshot`, it shows an explicit unavailable state with no inferred KOSPI/KOSDAQ, FX, or flow values.
- Execution runtime cards: `/execution/runtime/status` -> `status`, `mode`, `exec_connected`, `automation_enabled`, `paused`, `kill_switch_enabled`, `monitoring_alive`, `last_heartbeat_at`, `open_order_count`, `active_execution_job_count`, `issues`, optional `symbols.filled_today_by_side`, optional `daily_pnl`, optional `weekly_pnl`, optional `monthly_pnl`, and optional `actionable_alerts`; `/execution/runtime/monitored-symbols` -> `items[].symbol`, `name`, `market`, `monitoring_state`, `position_side`, `planned_intents`, `last_event_at`, and `status_counts`; `/execution/runtime/daily-board` -> `market_date`, `summary` counts, and `items[]` fields including symbol/name/market, `intent`, `status`, quantities, prices, decision/plan/order IDs, `last_updated_at`, and `failure_reason`. The runtime card displays daily and weekly FIFO P/L, sold/closed symbol counts, and unmatched sell counts from Core's status read when available, so sell fills without FIFO buy lots remain visible instead of being confused with closed-trade P/L. The canonical web DTOs are `src/types/trading-api/execution-runtime.ts`; the dashboard runtime poller normalizes timeout, unavailable, not-configured, and invalid-response states through `src/lib/execution-runtime-read.ts` plus `src/lib/trading-api-result.ts`. These reads are core-owned BFF paths only; the browser never calls `kai-trading-exec` directly. Offline/degraded/paused/kill-switched runtime states stay visible as explicit status pills, monitored symbols use compact operator labels, planned buy/sell rows remain visible before market open when available, and partial board rows remain visible with unavailable labels for missing optional fields.
- Daily process trigger and monitor drawer: `/market/status` + `/eod/freshness` + `/eod/pipeline/status` + `/agent-context/feedback/progress` + `/disclosures/dart/fundamentals/daily/inspect` + `/eod/piotroski-filter-results` + `/eod/market-risk-filters` -> EOD stage status/counts/latest dates, running pipeline steps, filtering fallback dates and counts, scoring progress, agent-feedback role progress, fundamentals failure-dialog context, and the shared patch date. The compact trigger is the only process summary in the dashboard body; the drawer is the canonical detail view and owns the Filtering and Scoring cards. Filtering keeps Piotroski and KIS risk as sibling sections, suppresses same-as-patch-date dataset labels, uses requested-vs-resolved notes for older stored results, and routes `More` with the Piotroski effective/resolved date.
- Tracked quotes: `/quotes/tracked` is retained as a dashboard availability/cache input, but the dashboard no longer renders a ledger recommendation card or per-symbol quote rows.
- Piotroski full-list route: `/eod/piotroski-filter-results.items[]` + `/quotes/{symbol}` + `/symbols/search` -> pass rows only, sorted by `piotroski_score` descending on the client; the process-monitor Filtering card keeps the compact summary and its `More` route shows the full passed-symbol list
- Execution-runtime recommendation drilldown: each monitored-symbol or daily-board row links to `/dashboard/symbol/{symbol}/action-summary` with `recommendationSource=execution-runtime`, `recommendationSymbol`, `recommendationMarketDate`, `executionAction`, `executionSource`, stop/target/reference-price context, and optional same-date Signal Decider action/stop/target evidence. The action-summary screen presents runtime and stored action-summary evidence as distinct sources.

Important behavior:
- The UI now treats `available: false` as an explicit unavailable state, not as a zero-price quote.
- `source: "daily_price_bar"` means the backend is serving DB-backed EOD fallback from `daily_price_bars`.
- Explore is available from both the mobile bottom tab bar and desktop rail; contextual manage-feed actions may also enter symbol discovery.
- Runtime/Signal Decider conflicts require the same effective date and ticker after trimming surrounding whitespace and normalizing case. The dashboard flags action or stop/target disagreement without selecting a winner, then hands the preserved context to the symbol-scoped Signal Decider feedback route for reconciliation.

## Decider feedback routes

Entry point:
- `src/app/dashboard/decider-feedback/page.tsx` — shared `signal-decider` / `short-term-decider` review
- `src/app/dashboard/signal-decider-feedback/page.tsx`
- `src/app/dashboard/signal-decider-feedback/signal-decider-feedback-page-client.tsx`

Client loading:
- `GET /api/trading/eod/freshness` when the route is opened without `marketDate`
- Shared route: `GET /api/trading/agent-context/feedback?market_date={marketDate}&agent_name={selectedDecider}&limit=200[&symbols={selectedSymbol}]`, where `selectedDecider` is strictly `signal-decider` or `short-term-decider`
- Signal-only compatibility route: `GET /api/trading/agent-context/feedback?market_date={marketDate}&agent_name=signal-decider&limit=200[&symbols={selectedSymbol}]`
- `GET /api/trading/agent-context/feedback/progress?market_date={marketDate}[&symbols={selectedSymbol}]` as a best-effort status overlay
- Dashboard card only: `GET /api/trading/agent-context/feedback?market_date={latest_completed_or_resolved_feedback_date}&agent_name=signal-decider&limit={progress-sized full-result window}` as the latest-completed recommendation fallback while the active process date is still running or empty

UI surfaces and fields:
- Dashboard card: result count from stored rows/progress counts, market date, action mix from the full fetched signal-decider result window, compact preview rows, and link to the detail page.
- Detail filters: market date, action, verdict, policy version, search query, and sort mode. Verdict and policy options are derived only from stored row fields that are present.
- Detail table: `items[].symbol`, company metadata from row payload/context, preferred or next-day-open action, optional quality/evaluation verdict, optional realized result horizon summary, persisted 5-trading-day evaluation status/target-hit/stop-hit/first-hit/MFE/MAE/window/warnings, confidence/conviction, thesis, trace availability counts, optional policy version, and captured/received timestamps.
- Detail dialog: thesis, quality reason, stop/target/return plan, persisted 5-trading-day target/stop evaluation fields, optional realized results by horizon, risk flags, factor attribution, gate results, upstream evidence, and traceability fields extracted from generic row payload/details.

Important behavior:
- `/dashboard/decider-feedback` preserves the selected agent, market date, symbol scope, filters, and sort state while switching between decider tabs. `/dashboard/signal-decider-feedback` remains signal-only for backward compatibility.
- Both routes use the generic stored feedback read filtered to the exact decider agent; there is no decider-specific read endpoint yet.
- Symbol-detail evidence links add the selected symbol as an upstream `symbols` filter before Core applies its 200-row cap; the matching `q` parameter remains a client-side display filter.
- Execution-conflict handoffs preserve the runtime context parameters while adding the exact `marketDate`, `q`, and repeatable `symbols` scope. The feedback page normalizes ticker case and surrounding whitespace for both the requested-symbol membership check and the returned-row lookup, refreshes the Signal Decider values from the stored row, and renders the conflict callout only while the normalized symbol, date, and disagreement still match.
- Persisted 5-trading-day evaluation fields are read from stored feedback rows/details/normalized payloads only. The UI does not call compute, evaluate, recompute, maintenance, or task-run endpoints; absent evaluation objects render as `not computed yet`, and incomplete persisted objects render pending/insufficient-data states.
- The dashboard card may show an older latest-completed signal-decider row set while the active process date is still running. The fallback read still includes a resolved `market_date` from the latest completed pipeline/action-summary/process basis when available and does not call the generic feedback route without that required query parameter. In that state the card labels the recommendation market date separately from the current cycle date/status, and its detail link points to the effective recommendation date. Explicit date-selected detail and calendar reads stay pinned to the requested date.
- Dedicated Core decision list/detail/diagnostics/policy APIs from `kai-trading-core#234` and `#235` are still a dependency for guaranteed realized-result, missed-opportunity, bad-buy, and policy-version coverage. This page displays those fields when they are already stored on feedback rows, but it does not infer them from unrelated market data.
- If Core omits `result.roles["signal-decider"]`, the UI does not infer completion from payload shape. It shows the available stored rows and falls back to conservative waiting/completed status copy.
- The dashboard Decider recommendations card only uses running copy when process evidence reports a live running stage/state. A partial, pending, or otherwise non-running daily process with no live stage should render daily-board planned buy/sell rows when available, or an explicit empty/updating/unavailable state when not available.
- This is a decision-support inspection surface only and does not create orders.

## Signal Review Calendar route: `/calendar`

Entry point:
- `src/app/calendar/page.tsx`
- `src/app/calendar/signal-review-calendar-page-client.tsx`

Client loading:
- `GET /api/trading/agent-context/feedback/calendar?month={visibleMonth}` for the compact month summary
- `GET /api/trading/agent-context/feedback/review?market_date={selectedDate}&agent_name=signal-decider&limit=200` for selected-date detail
- `GET /api/trading/agent-context/feedback/progress?market_date={selectedDate}` as a best-effort selected-date completion overlay
- If a compact calendar or review read fails, the route may use exact-date `GET /api/trading/agent-context/feedback?market_date={date}&agent_name=signal-decider&limit=200` reads as a degraded fallback. It does not treat an unresolved or mismatched date as stored coverage.

UI surfaces and fields:
- Navigation: `/calendar` is the shared shell's Review destination and presents the signal-review calendar.
- Month calendar: stored signal-decider summary rows drive date-cell decision counts, buy/wait/reject mix, reviewed/partial/stored/empty/unavailable state, and month total counts. The calendar does not invent dates or outcomes when the compact summary and exact-date fallback provide no evidence.
- Selected-date summary: total decisions, action mix, reviewed row count, target/stop/unresolved path counts, and role-progress warning when progress is unavailable.
- Decision table: symbol/company, decision, target/stop, D+1/D+3/D+5 realized horizon summaries when stored, intraday target/stop path when stored, and a review insight headline/conclusion when stored or derivable from explicit quality tags.
- Symbol detail dialog: original action plan, target/stop interpretation, following-session outcomes, thesis/conclusion, risks, run id, policy version, and captured timestamp.

Important behavior:
- The compact calendar endpoint is the preferred month index and the review endpoint is the preferred selected-date read. Per-date generic feedback requests are failure fallback only.
- Target/stop path, review conclusion, and replay horizon fields are optional stored-feedback fields. The UI labels missing fields as unavailable instead of deriving them from unrelated quote or price-bar data.
- This is a review/debugging surface only and does not create orders or live-trading actions.

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
- `GET /api/trading/eod/momentum-factors?market_date=...&symbols={symbol}&limit=1`
- `GET /api/trading/eod/low-risk-factors?market_date=...&symbol={symbol}`
- `GET /api/trading/eod/beta-factors?market_date=...&symbol={symbol}`
- `GET /api/trading/eod/value-factors?market_date=...&symbol={symbol}`
- `GET /api/trading/eod/advanced-value-factors?market_date=...&symbol={symbol}`
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
- Quote hero: `/quotes/{symbol}` + `/market/status` + `/symbols/search` + `/eod/action-summaries` + `/agent-context/symbol-day` -> `price`, `change`, `change_pct`, `volume`, `turnover`, `market_state`, `source`, `available`, `fallback`, `fallback_reason`, `unavailable_reason`, `cached_at`, `trade_date`, action-summary `action_label`, `confidence_tier`, `reasons`, route metadata seed, aggregate availability summary
- Hero tracked-symbol star: `/scanner/tracked-symbols` -> `tracked_symbols`; clicking the star posts the replacement symbol list, fills the star when the current symbol is present, and clears the fill when it is removed
- Market-status gate for quote polling: `/market/status` -> `state`
- Chart: `/symbols/{symbol}/price-bars` -> `items[].trade_date`, `open_price`, `high_price`, `low_price`, `close_price`, `volume`, `turnover`; the UI treats missing or zero-sentinel turnover on a nonzero-volume candle as confirmation-needed instead of rendering `₩0`
- Factor Snapshot section: `/eod/momentum-factors`, `/eod/low-risk-factors`, `/eod/beta-factors`, `/eod/value-factors`, `/eod/advanced-value-factors` -> family-level `feature_version`, `summary`, and `item` / `items[]` inspect rows; the UI shows one explainable card per factor family plus a reserved composite slot, isolates partial family failures, and surfaces the main score / percentile / rank / classification fields without dumping raw payloads. Value rows prefer optional `unified_value_score`, `unified_value_rank`, `unified_value_percentile`, and `unified_value_status`; component status hints are read from root fields or payload status maps for PER, PBR, dividend yield, FCF yield, and EV / EBITDA when present. A subordinate quality-score block below the value metrics reads optional `quality_score`, `quality_rank`, `quality_percentile`, `quality_status`, `components_possible`, `components_used`, `is_quality_score_complete`, and quality component status maps for ROE, ROA, gross profit / assets, operating cash flow / net income, debt ratio, and accruals.
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
- Symbol metadata and factor/action/technical responses must resolve the exact requested symbol. If the exact row is absent, the section is unavailable rather than borrowing the first returned row.
- When a request includes `marketDate`, response data may be presented as that requested date only when every available actual/resolved date agrees. An explicit older fallback may be shown with its resolved date and fallback provenance; a response that merely echoes the requested parameter does not prove the dataset date.
- The primary chart now uses the stored historical bars API, not an in-page quote trace. The technical-analysis detail page also renders the same candlestick API on desktop to match the Stitch candlestick view.
- The chart focus card updates from chart interaction, but the chart itself remains EOD-history based.
- Quote polling stops when `/market/status` resolves a closed session, including the dashboard's latest shared market-status snapshot. While market state is unresolved, symbol detail retries the status gate without claiming active live quote polling; resolved open sessions and confirmed live/open quotes preserve the active quote refresh loop.
- `/agent-context/symbol-day`, `/eod/momentum-factors`, `/eod/low-risk-factors`, `/eod/beta-factors`, `/eod/value-factors`, `/eod/advanced-value-factors`, `/eod/technical-snapshots`, `/eod/action-summaries`, `/disclosures/dart/fundamentals/history`, and `/symbols/{symbol}/price-bars` are one-shot per dependency change, not recurring quote polls.
- `/scanner/tracked-symbols` is requested by the symbol detail route only for the hero star state and toggle; it does not enable order execution.
- When a technical or action field is not confirmed upstream, the UI shows `[확인 필요]` instead of manufacturing indicator values.
- The five dedicated detail routes reuse the same responsive chrome, dev tags, and API loaders as the overview card stack. They narrow the rendered body to the selected Stitch detail screen instead of duplicating data logic.

## Factor screening route: `/markets/factors`

Entry point:
- `src/app/markets/factors/page.tsx`
- `src/features/markets/factor-screening.tsx`
- `src/lib/factor-screening.ts`

Client loading:
- `GET /api/trading/eod/freshness` when the route is opened without `marketDate`
- `GET /api/trading/eod/momentum-factors?market_date={marketDate}`
- `GET /api/trading/eod/low-risk-factors?market_date={marketDate}`
- `GET /api/trading/eod/beta-factors?market_date={marketDate}`
- `GET /api/trading/eod/value-factors?market_date={marketDate}`
- `GET /api/trading/eod/advanced-value-factors?market_date={marketDate}`

UI surfaces and fields:
- Shared shell: the common responsive app chrome, with Explore active in the four-item primary navigation
- Market-date controls: `/eod/freshness` -> latest stored `price_trade_date`, with the route preserving an explicit `marketDate` query param when provided
- Family selector cards: each factor inspect response -> top-level `market_date`, `feature_version`, `summary.entries`, and client-derived eligible / caution / audit row counts from `item` / `items[]`
- Ranked row list: family-specific factor items -> symbol, company name, market, ranking score / percentile / rank fields, classification or eligibility status, and one or more supporting factor details; row clicks navigate into `/dashboard/symbol/[symbol]` with forwarded `name`, `market`, and `marketDate`. The value family makes unified valuation fields primary when available, labels legacy value score fields as legacy, explains `invalid_per` as non-positive earnings excluding the symbol from PER scoring, and keeps quality-score status directly below the value metrics with possible / used component counts plus complete, partial, or unavailable calculation state.
- Composite slot: reserved client-side family card plus empty-state body only; no composite API is called yet

Important behavior:
- The route loads all current factor families in parallel for the selected market date, but keeps family failures isolated so other factor slices remain usable.
- Eligibility filters are bucketed into eligible, caution / watchlist, and audit / invalid states rather than hiding invalid rows by default.
- The ranking page reuses the existing factor-client layer concepts from symbol detail instead of inventing factor math in the browser.

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

## Retired route redirects

Files:
- `src/app/kis-dashboard/page.tsx`
- `src/app/real-dashboard/page.tsx`
- `src/app/bots/page.tsx`
- `src/app/scanner-tracker/page.tsx`
- `src/app/markets/page.tsx`

Behavior:
- `/kis-dashboard`, `/real-dashboard`, and `/bots` redirect to `/dashboard` and load no independent data surface.
- `/scanner-tracker` redirects to `/my-symbols`.
- `/markets` redirects to `/markets/factors`.
- These compatibility entrypoints must not regain synthetic data or duplicate navigation/shell implementations.

## BFF proxy layer

Files:
- `src/lib/trading-upstream.ts`
- `src/lib/trading-api-result.ts`
- `src/lib/execution-runtime-read.ts`
- `src/app/api/trading/market/status/route.ts`
- `src/app/api/trading/quotes/tracked/route.ts`
- `src/app/api/trading/quotes/[symbol]/route.ts`
- `src/app/api/trading/scanner/tracked-symbols/route.ts`
- `src/app/api/trading/agent-context/symbol-day/route.ts`
- `src/app/api/trading/execution/runtime/status/route.ts`
- `src/app/api/trading/execution/runtime/monitored-symbols/route.ts`
- `src/app/api/trading/execution/runtime/daily-board/route.ts`
- `src/app/api/trading/execution/runtime/symbols/[symbol]/route.ts`
- `src/app/api/trading/eod/freshness/route.ts`
- `src/app/api/trading/eod/momentum-factors/route.ts`
- `src/app/api/trading/eod/low-risk-factors/route.ts`
- `src/app/api/trading/eod/beta-factors/route.ts`
- `src/app/api/trading/eod/value-factors/route.ts`
- `src/app/api/trading/eod/advanced-value-factors/route.ts`
- `src/app/api/trading/eod/technical-snapshots/route.ts`
- `src/app/api/trading/eod/action-summaries/route.ts`
- `src/app/api/trading/disclosures/dart/fundamentals/history/route.ts`
- `src/app/api/trading/symbols/favorites/route.ts`
- `src/app/api/trading/symbols/[symbol]/price-bars/route.ts`
- `src/app/api/trading/symbols/search/route.ts`

Behavior:
- These handlers proxy JSON through to trading-core.
- UI debugging should confirm whether a field is missing upstream in trading-core before changing the frontend interpretation.
