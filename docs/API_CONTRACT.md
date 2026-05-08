# Trading Web ↔ Trading Core API Contract

This document defines the first practical frontend contract for wiring `trading-web` to the FastAPI backend in `trading-core`.

## Current shipped dashboard wiring
- Web-side BFF and browser API reads are expected to resolve into data, empty, unavailable, timeout, or error states. The Next.js BFF applies a bounded timeout to JSON proxy reads and returns HTTP `504` with an explicit timeout message when trading-core hangs or lags past that budget, so operator routes should not remain in indefinite loading states while waiting on upstream reads.
- `/dashboard` currently renders from these live endpoints where available:
  - `GET /market/status`
  - `GET /market/snapshot`
    - The market-condition card is driven by this compact market snapshot surface when Core exposes it. Expected card fields are `status`, `indices.kospi`, `indices.kosdaq`, `fx.usdkrw`, `flows.foreign`, `flows.institutional`, optional `summary.market_bias` / breadth text, optional `missing_fields`, and optional `stale_reason`.
    - The frontend also normalizes the live Core partial-cache shape where index values are exposed as `markets.kospi` / `markets.kosdaq`, USD/KRW is exposed as top-level `usd_krw`, and investor flow values are embedded in each market row as fields such as `foreign_net_value` and `institution_net_value`.
    - `status` should be one of `ready`, `partial`, `stale`, or `unavailable`. The frontend also derives `partial` when a payload has usable data but is missing one of the required market fields, and derives `stale` when the last usable snapshot remains visible after a refresh error.
    - The frontend accepts both the direct snapshot object and an enveloped `{ "data": { ... }, "meta": { ... } }` response for deployment compatibility. It displays available field values individually, labels partial/stale/unavailable states explicitly, and does not collapse partial-but-usable snapshots to `[확인 필요]`.
    - The card does not derive substitute KOSPI/KOSDAQ, FX, or investor-flow values from filtering/status endpoints. `GET /market/status` is used only for compact session/trading-day context.
  - `GET /quotes/tracked`
  - `GET /quotes/{symbol}`
  - `GET /symbols/search`
  - `GET /eod/freshness`
    - D2 Daily Data Fetch resolves each stage from the latest known snapshot by default, only keeping `today.price`, `today.technical_analysis`, and `today.action_summary` as the visible source while the matching same-day pipeline stage is actively running, explicitly failed, or already aligned with the latest layer date; flat `latest.technical_market_date` and `latest.action_market_date` are sufficient latest-available stage evidence when same-day stages are only pending/missing and the latest completed pipeline basis is healthy. Price/technical/action show `symbols_succeeded / symbols_total`, while fundamentals now prefers explicit latest-available coverage from `latest.fundamentals` / `latest.stage_details.fundamentals` when Core exposes it and only falls back to same-day stage data while the fundamentals refresh is actively running or no latest-available coverage exists
    - Daily Data Fetch keeps the visible header market date on `today.trade_date`, but non-agent D2 status resolution follows the resolved process market date from `/eod/pipeline/status.market_date` when Core reports an older latest run for the requested trade date
    - Stage labels map to `synced` when the resolved stage status is `ready` and the relevant latest date is present, even when the visible `today.trade_date` is newer than that latest date; `running` when the resolved stage status is `running`; `break day` when `/market/status` marks a non-trading day and a resolved `ready` stage is stale; otherwise `not synced`, with the stale latest date shown on the subcard when present
    - The Daily process monitor renders the resolved latest patch date once at the bottom of the drawer; per-task date labels are suppressed when they match that patch date, while stage-specific latest dates remain visible when they differ
    - When `today.trade_date` and the latest stored EOD trade date differ, the shared patch date keeps the stored patch basis visible so operators can see that the latest stored patch still trails the current market date instead of hiding the mismatch behind the status pill
    - Relevant latest dates are `latest.price_trade_date`, `latest.technical_market_date`, `latest.action_market_date`, and the latest-available DART fundamentals date from `latest.fundamentals` / `latest.stage_details.fundamentals` when present, falling back to the daily inspect response and legacy optional layer objects such as `technical.latest_date`, `fundamental.latest_date`, and `fundamentals.latest_date` for deployment compatibility
  - `GET /eod/piotroski-filter-results?market_date=YYYY-MM-DD`
    - D2 Filtering renders Piotroski summary state instead of a top-pass teaser list, showing completion state plus only the filtered count from `summary.passed_count` for the actual returned dataset
    - The dashboard and Piotroski full-list page tolerate the richer optional date fields `requested_market_date`, `resolved_market_date`, `is_latest_fallback`, and the returned effective `market_date`
    - D2 Filtering uses the returned effective `market_date` when present, otherwise falls back to `resolved_market_date`, then the requested market date; the per-stage `Market date` line is only shown when that effective date differs from the shared patch date, and when the requested and effective dates differ the card keeps a compact note so operators can tell whether Core resolved to another stored date or explicitly fell back to the latest available result
    - The D2 Filtering `More` link opens `/dashboard/piotroski-filter?marketDate=YYYY-MM-DD` using the effective/resolved date so the full pass list matches the process monitor summary, and row clicks still route to `/dashboard/symbol/[symbol]`
  - `GET /eod/market-risk-filters?market_date=YYYY-MM-DD`
    - D2 Filtering also renders the persisted KIS market-risk summary beside Piotroski inside the same card, showing completion state plus only the filtered count from `summary.passed_count`
    - The card uses the same optional date-resolution fields `requested_market_date`, `resolved_market_date`, `is_latest_fallback`, and `market_date` so operators can see when KIS risk status is showing the requested date versus the latest available stored result
    - The dashboard treats Core as the source of truth for the KIS risk filtered count and does not infer it from frontend-only logic
  - `GET /eod/pipeline/status`
    - `/dashboard` requests this endpoint with the active `market_date` from `/eod/freshness.today.trade_date`, falling back to the market server date when freshness has not loaded
    - If the active-date pipeline response is only pending and `/eod/freshness.latest.trade_date` points at an older stored date, `/dashboard` also requests `/eod/pipeline/status` for that latest date and uses it as the resolved process basis only when that latest response is completed. Running, completed, failed, partial, or otherwise problem-marked active-date pipeline responses remain authoritative.
    - When Core responds with an older `market_date` because the latest daily run is still the previous session, `/dashboard` keeps polling the requested active trade date but treats the response `market_date` as the resolved non-agent status basis for Daily Data Fetch, Filtering, and the DART daily inspect follow-up request
    - D2 EOD Status treats `stages.price_collection`, `stages.technical_snapshots`, `stages.action_summaries`, and `stages.fundamentals_daily_refresh` as the live running-state override for the matching freshness subcards; when one of those pipeline stages is `running`, the dashboard keeps the subcard in `running`, uses the pipeline processed/total counters for the visible count, uses the active pipeline market date for the fundamentals latest-date presentation, suppresses stored fundamentals updated-entry activity while that live polling view is active, and replaces the usual `synced` pill copy on that same subcard with the reported `current_step`, falling back to `current_activity` and the animated running badge when step text is unavailable
    - D2 Scoring renders as a separate operational card below Filtering. Live/running state still comes from `stages.unified_value_scoring`, `stages.quality_scoring`, and `stages.momentum_scoring` when Core exposes them, while persisted result counts come from `GET /eod/value-factors?market_date=YYYY-MM-DD` for unified value plus quality scoring and `GET /eod/momentum-factors?market_date=YYYY-MM-DD` for momentum scoring. Those factor responses may include the same optional date-resolution fields as filtering (`requested_market_date`, `resolved_market_date`, `is_latest_fallback`, and returned effective `market_date`), and the dashboard shows the effective/latest-valid scoring basis instead of treating same-day absence as a broken scoring section. Pipeline stage rows override persisted summaries only when they carry active, completed, failed, or count evidence for the current process date.
    - The dashboard no longer renders a separate pipeline activity list; it still uses the pipeline endpoint for running-state polling every second while the overall pipeline status or any reported stage remains `running`, and it keeps `current_activity` / `current_symbol` as tooltip context on the running badge when Core reports them
  - `GET /agent-context/feedback/progress`
    - D2 Agent Feedback progress uses `latest.price_trade_date` from `/eod/freshness` as the primary `market_date`, falling back to `today.trade_date` only when no latest price date exists
    - D2 Filtering uses the agent feedback target as the card-level final filtered-symbol count: `request.symbols.length` when Core returns an explicit request list, otherwise `summary.total_symbols`; if feedback progress is unavailable, the card falls back to the final KIS risk `summary.passed_count`
    - D2 Agent Feedback always shows role rows for the latest market date. The dashboard treats top-level live summary fields as the primary truth for active state: `summary.run_status`, `summary.run_table_status`, `summary.cycle_status`, `summary.is_live`, `summary.current_role`, and recent live-progress evidence such as `summary.processed_symbols`, `summary.completed_feedback_count`, and `summary.latest_feedback_at`
    - While the resolved state is running, the active summarizer row keeps the detailed progress metrics from `summary.progress_percent`, `summary.total_symbols`, `summary.failed_items`, `summary.completed_symbols`, and `summary.current_role`, and conservative role-local labels such as `pending` do not demote the active row back to an idle treatment when the top-level cycle is clearly live
    - When the resolved state is not running, D2 Agent Feedback shows persisted per-role counts from `result.roles[role].requested_count`, `completed_count`, and `error_count`, with the latest market date only shown when it differs from the shared patch date. If those result counts are absent, the dashboard falls back to the backend role order plus `summary.completed_symbols`, `summary.total_symbols`, and `summary.current_role` to derive a bounded latest-run summary
    - Agent Feedback role rows show compact progress bars under each summarizer and signal-decider title, with right-side status icons still derived from the row status. Running role rows still build from `request.expected_agents`, animate the role matching `summary.current_role`, and keep dependency details such as EOD / Tech readiness out of the summarizer rows; the endpoint is not session-cached because active agent processing can change during the dashboard session and is polled every second while running
  - `GET /agent-context/feedback?market_date=YYYY-MM-DD&agent_name=signal-decider&limit=...`
    - The Signal Decider dashboard card and `/dashboard/signal-decider-feedback` detail page read the existing generic feedback rows filtered by `agent_name=signal-decider`. The dashboard sizes the feedback request from progress role counts when available so action-mix totals are built from the full completed result window while compact card rows remain preview-only. The frontend normalizes only display fields that already appear in the stored row payloads, including symbol/company, preferred action, next-day-open action when present, confidence/conviction, thesis, risk flags, stop/target, market date, run id, and captured/received timestamps.
    - `/dashboard` also performs a dashboard-only latest-completed feedback read with `agent_name=signal-decider` and an explicit `market_date` resolved from the latest completed pipeline/action-summary/process basis when available, falling back only to already-known progress/current dates. It never calls the generic stored feedback route without `market_date`. When the active/current process date has no completed signal-decider row set yet and that fallback read resolves to an older market date with rows, the dashboard card renders those latest completed recommendations, labels their effective market date, and separately labels the active cycle date/status. Explicit date-selected routes such as `/dashboard/signal-decider-feedback?marketDate=YYYY-MM-DD` and `/calendar` remain anchored to the requested date and do not use this latest-completed fallback.
    - The detail page also consumes optional stored decision-quality fields when Core includes them in the generic row payload or details object: policy/ruleset version, quality/evaluation verdict, missed-opportunity and weak/bad-buy tags, quality reason, realized results by horizon, factor attribution, gate results, traceability, and upstream evidence. Decision fields and review/result fields are displayed as separate groups. Review verdict/outcome areas render as pending when those fields are absent; they do not fall back to `[확인 필요]` as if a verdict or realized result existed, and the UI does not synthesize realized outcomes or policy versions from unrelated data.
    - The same stored feedback payload may include a persisted 5-trading-day decider evaluation object such as `five_day_evaluation`, `five_trading_day_evaluation`, `evaluation_5d`, `target_stop_evaluation`, or `short_term_decider_evaluation`. The frontend reads only those persisted fields and never calls compute/evaluate/recompute/maintenance routes from normal pages. Supported display fields include evaluation status/outcome, target/stop hit booleans within five trading days, first hit when known, same-day target/stop ambiguity, max favorable/adverse excursion percentages, evaluation window dates, and data-quality warnings. Missing persisted evaluation data renders as `not computed yet`; pending/incomplete persisted states render as pending evaluation window or insufficient-data states.
    - `/calendar` uses `GET /agent-context/feedback/calendar` for compact month summaries plus `GET /agent-context/feedback/review` for selected-date detail. Calendar cells show month-level decision and review counts from the compact summary payload and selected-date detail still maps through `GET /agent-context/feedback/review`.
    - The page keeps a fallback path: when summary reads fail, it probes visible month dates with the legacy generic read (`market_date=YYYY-MM-DD&agent_name=signal-decider&limit=200`) so month loading can still render degraded cells.
    - `/calendar` still avoids decision-object fanout for regular successful month reads and does not call `GET /trading/decisions` or per-symbol decision detail APIs directly; target/stop path outcomes remain derived from stored review fields in the compact payload or fallback generic rows.
    - Status remains anchored to `/agent-context/feedback/progress` role counts when present: requested/completed/error counts produce completed, partial, needs-review, running, or waiting states. When Core omits role counts for `signal-decider`, the UI shows stored row counts and conservative waiting/completed states instead of inferring cycle completeness from row content.
    - This surface is decision support only. The dashboard card links out to the detail page and neither surface creates orders or enables live-trading behavior.
  - `GET /execution/runtime/status`
    - `/dashboard` renders the execution runtime summary from this core-owned read model only. The web does not call `kai-trading-exec` directly.
    - The card treats `status` values `ready`, `degraded`, `offline`, `paused`, and `kill_switched` as operator-facing states, while still showing separate mode, connection, paused / kill-switch / automation, monitoring heartbeat recency, open order count, active execution job count, and issue details when Core supplies them.
    - Runtime reads are uncached in the browser because liveness, heartbeat, open orders, and active jobs can change during the same session.
  - `GET /execution/runtime/monitored-symbols?market_date=YYYY-MM-DD`
    - `/dashboard` renders current monitored symbols from Core's grouped execution-runtime view. It displays compact labels for `watching_target_stop`, `watching_fill`, `reconciling`, and `idle`, plus symbol identity, market, planned intents, status-count summary, and last event timestamp when present.
    - The request uses the active same-day market date resolved from `/eod/freshness.today.trade_date` and `/market/status.server_time`; it does not read exec service URLs or credentials from the browser.
  - `GET /execution/runtime/daily-board?market_date=YYYY-MM-DD`
    - `/dashboard` renders the same-day execution board from Core's merged planning/readback model. The board preserves planned, accepted, scheduled, submitted, partial, filled, failed, and cancelled statuses and keeps partial row data visible instead of collapsing the section when optional fields such as quantities, prices, or timestamps are absent.
    - Rows display symbol/company, intent, status, filled/planned quantity, price basis, last update, and failure reason when present. The route remains read-only and does not create orders.
  - `GET /execution/runtime/symbols/{symbol}?market_date=YYYY-MM-DD`
    - The BFF exposes this core-owned per-symbol execution detail path for later symbol/review drilldown work. The dashboard does not yet render a drilldown from it, and the web still avoids direct exec calls.
  - `POST /agent-context/internal/core/control`
    - The D2 Agent Feedback stop confirmation posts through the Next.js BFF to this authenticated admin endpoint with `{ "action": "kill", "signal_name": "SIGKILL", "port": 8000 }`, allowing the existing dashboard stop flow to invoke the new core control API without exposing the upstream bearer token to the browser
  - `GET /disclosures/dart/fundamentals/daily/inspect`
    - `/dashboard` requests this endpoint with the resolved non-agent pipeline market date from `/eod/pipeline/status.market_date`, falling back to the active trade date or market server date when the pipeline response does not provide one yet
    - D2 Fundamentals displays the latest-available fundamentals coverage date from `/eod/freshness.latest.fundamentals` when present; otherwise it falls back to the layer date, then `latest_run.market_date`, then the date portion of `latest_run.completed_at`
    - D2 Fundamentals uses `latest_run.status` to preserve running / failed / partial semantics when Core reports an active or problematic refresh, but when the inspected run exposes structured latest-run activity via `latest_run.updated_entries_summary` / `latest_run.updated_entries`, the primary fundamentals count switches to the latest-run updated count instead of the latest-coverage checked count; when that run date differs from the active process date, the label changes from `Updated today` to `Recently updated`
    - D2 Fundamentals shows up to three updated companies from the structured latest-run payload, preferring `latest_run.updated_entries_preview` for the collapsed preview rows and `latest_run.updated_entries` for the expandable full list, each with `company_name` plus `category_label` (falling back to a deterministic `update_category` token label when needed)
    - When the structured updated-entry payload is temporarily absent, the dashboard keeps the existing checked/latest-coverage behavior and falls back to the legacy updated-symbol sample string sourced from `latest_run.symbols_refreshed` and `latest_run.run_metadata.refreshed_symbols_sample` when the latest run still matches the latest-available fundamentals date
    - When the latest DART fundamentals run has a failed/partial signal, D2 Fundamentals exposes a failure dialog from the status control using `latest_run.error_message`, `symbols_failed`, `events_failed`, run timing/count fields, and failure-related `run_metadata` keys when present
- `/dashboard/symbol/[symbol]` now mixes:
  - `GET /quotes/{symbol}` for the live price, volume, turnover, and quote provenance
  - `GET /market/status` only as the polling stop gate for the symbol quote loop
  - `GET /symbols/{symbol}/price-bars` for the mobile candlestick chart
  - `GET /eod/momentum-factors?market_date=YYYY-MM-DD&symbols={symbol}&limit=1` for the symbol-level factor snapshot momentum card
  - `GET /eod/low-risk-factors?market_date=YYYY-MM-DD&symbol={symbol}` for the symbol-level factor snapshot low-risk card
  - `GET /eod/beta-factors?market_date=YYYY-MM-DD&symbol={symbol}` for the symbol-level factor snapshot beta card
  - `GET /eod/value-factors?market_date=YYYY-MM-DD&symbol={symbol}` for the symbol-level factor snapshot value card
  - `GET /eod/advanced-value-factors?market_date=YYYY-MM-DD&symbol={symbol}` for the symbol-level factor snapshot advanced-value card
  - `GET /eod/technical-snapshots` for the dedicated technical-analysis section
  - `GET /eod/action-summaries` for the dedicated action-summary section
  - `GET /eod/piotroski-filter-results?market_date=YYYY-MM-DD&symbol=005930` for the S1 hero Piotroski pass/fail card
  - `GET /eod/freshness` for layer-specific freshness labels, with `latest.technical_market_date` as the stable technical freshness field and optional layer status fields like `technical.success` and `technical.latest_date` consumed when present
  - `GET /disclosures/dart/fundamentals/history` for stored DART fundamentals history
  - `GET /agent-context/symbol-day` for company metadata, aggregate availability, fallback technical/action data, latest fundamentals summary, and recent disclosures; the S1 hero also uses the latest disclosure name/date from this payload for the Fundamental latest card
  - `GET /disclosures/dart/filings/document?rcept_no=...` for the S7 disclosure report detail document stream
  - `GET /scanner/tracked-symbols` and `POST /scanner/tracked-symbols` for the hero star toggle beside the disabled Trade action; the star is filled when the current symbol is already tracked, and toggling posts the replacement tracked-symbol set
  - The overview body now includes an explainable `Factor Snapshot` section that reads the five persisted factor inspect endpoints directly, isolates missing or failed families per card, and keeps a reserved composite-summary slot above the family cards so a later composite endpoint can land without reworking the symbol-detail layout. When Core includes unified valuation fields on a value inspect row, the snapshot makes `unified_value_score`, `unified_value_rank`, `unified_value_percentile`, and `unified_value_status` the primary displayed valuation status while keeping legacy PER/PBR/dividend-yield and advanced component hints clearly labeled. When Core includes optional quality-score fields on the value row, the snapshot renders a subordinate quality block under the existing value metrics using `quality_score`, `quality_rank`, `quality_percentile`, `quality_status`, `components_possible`, `components_used`, `is_quality_score_complete`, and compact per-component status hints for ROE, ROA, gross profit / assets, operating cash flow / net income, debt ratio, and accruals. Before those fields are available, the same block shows an explicit unavailable calculation state instead of requiring raw JSON inspection.
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
- `/portfolio` is the first account/asset route and reads the frontend BFF endpoint `GET /api/trading/portfolio/summary`, which proxies upstream `GET /portfolio/summary`.
  - As of the web-side pre-integration for `kai-trading-web#403`, the frontend is wired to this aggregate contract while the matching trading-core aggregate endpoint may still be pending.
  - The page is read-only and does not place trades.
  - The expected payload is `PortfolioSummaryDto` with `accounts[]`, per-account `summary` money fields, `holdings[]`, optional `allocation[]`, optional `recentActivity[]`, top-level `sync`, `asOf`, and `notices`.
  - Money fields use `{ amount, currency, display }` so backend responses can provide raw analytics values while still allowing display-ready fallbacks during integration.
  - The route distinguishes loading, endpoint-pending, upstream-not-configured, upstream-unavailable, invalid-response, connected-but-empty, stale-sync, partial-data, and fully-synced states instead of treating every missing payload as an empty portfolio.
  - Portfolio subsections map their own state for hero metrics, account cards, holdings, allocation, and recent activity so a missing or partial subsection does not collapse the full page into generic unavailable copy.
  - Multiple accounts are supported from the start; the summary cards aggregate same-currency account totals and avoid pretending mixed-currency values are a single number.
- `/markets/factors` now reads:
  - `GET /eod/freshness` to resolve the latest stored price trade date when the route is opened without an explicit `marketDate`
  - `GET /eod/momentum-factors?market_date=YYYY-MM-DD`
  - `GET /eod/low-risk-factors?market_date=YYYY-MM-DD`
  - `GET /eod/beta-factors?market_date=YYYY-MM-DD`
  - `GET /eod/value-factors?market_date=YYYY-MM-DD`
  - `GET /eod/advanced-value-factors?market_date=YYYY-MM-DD`
  - The route renders one reusable factor-screening pattern with family switching, market-date aware ranking, eligibility/caution/audit filtering, natural row navigation into `/dashboard/symbol/[symbol]`, and a reserved composite slot so a later composite endpoint can land without redesigning the page. The value family treats optional `unified_value_*` fields as primary when present and falls back to the legacy value score when they are absent. A subordinate quality-score block sits below the value metrics and reads the optional quality contract fields (`quality_score`, rank / percentile, status, possible / used component counts, completion boolean, and per-component status maps) when Core provides them.
  - Factor row identity prefers distinct optional name fields (`company_name`, `name_ko`, `display_name`, `name`, `name_en`, `corp_name`) over the symbol. If Core returns only the symbol as the name, the row keeps the symbol as the primary identifier and shows an explicit name-unavailable state instead of rendering duplicated `symbol (symbol)` copy.
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
        "subtitle": "Across tracked market surfaces"
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
      "title": "Bot controls unavailable",
      "idleLabel": "No bot command API connected",
      "actions": []
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
Planned read model for `/bots`. The current `/bots` route is a scaffold and must not render a roster, execution state, risk fields, or capital allocation from mock data. Until this endpoint is backed by a real service, the UI should show explicit unavailable/scaffold copy instead of fabricated operational values.

### Response
```json
{
  "data": {
    "bots": []
  },
  "meta": {
    "generatedAt": "2026-03-29T08:10:00Z",
    "source": "api"
  }
}
```

## 5) Bot command endpoint

### `POST /api/v1/bots/{botId}/commands`
Planned command endpoint for future bot detail screens. Placeholder UI must not expose command controls until the execution workflow, safety checks, and source-backed command status contract are explicit and approved.

### Request / response
No active request or response contract is documented for the current web UI. Add source-backed DTOs here only after the execution workflow, safety checks, and operator-facing status semantics are approved.

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
