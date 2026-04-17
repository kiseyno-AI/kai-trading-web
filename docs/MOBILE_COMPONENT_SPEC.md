# Mobile Stitch Component Spec

This document is the working map for the Stitch-driven mobile refresh. It tells us which component tag belongs to which mobile surface, which API powers it, and which fields are actually rendered.

## Global rules

- Mobile is the primary target for this spec. Desktop polish is intentionally secondary for this phase.
- Long text is clamped to **3 lines maximum** in the refreshed mobile cards. Anything longer should visually truncate with `...`.
- Dev-mode component tags stay available through the mobile chrome toggle: `Tags On` / `Tags Off`.
- If an upstream field is not confirmed by `kai-trading-core`, the UI must render `[확인 필요]` instead of inventing data.
- Freshness is **layer-specific**. Price, technical, action, fundamentals, and disclosures must not imply one shared timestamp.
- Dashboard and symbol detail now use a dedicated mobile shell with a fixed top app bar and a bottom tab bar (`Dashboard`, `Search`, `My Symbols`) instead of the old `AppShell` workspace chrome.
- `/search` also uses this shell, matching the Stitch `Search - Mobile Terminal` screen instead of the legacy workspace panel.

## Dev tag workflow

- Toggle dev tags in the mobile app bar.
- Each mobile section renders a `ComponentTag` in dev mode.
- Use the tag names below to jump between code, UI review, and API validation.

## Dashboard

| Tag | File | Mobile component | API | Rendered fields | Notes |
| --- | --- | --- | --- | --- | --- |
| `dashboard.operational-integrity` | `src/app/dashboard/live-dashboard-client.tsx` | Operational Integrity hero | `/api/trading/eod/freshness`, `/api/trading/market/status`, `/api/trading/agent-context/feedback/progress`, `/api/trading/disclosures/dart/fundamentals/daily/inspect` | `today.trade_date`, stage objects `today.price`, `today.technical_analysis`, `today.action_summary`, `today.fundamentals`, each stage `status`, `symbols_succeeded`, `symbols_total`, `symbols_failed`, `latest.price_trade_date`, `latest.technical_market_date`, `latest.action_market_date`, agent progress `request.market_date`, `summary.is_live`, `summary.run_status`, `summary.progress_percent`, `summary.total_symbols`, `summary.failed_items`, `summary.completed_symbols`, `summary.in_progress_symbols`, optional legacy `fundamental(s).latest_date`, fundamentals `latest_run.status`, fundamentals `latest_run.market_date`, fundamentals failure dialog fields from `latest_run.error_message`, `symbols_failed`, `events_failed`, run counts/timing, and failure-related `run_metadata`, `market.state`, `market.server_time` | The EOD Status stat renders Price Fetch, Technical Analysis, Action Summary, and Fundamentals subcards. Stage status maps to `synced`, `running`, or `not synced` from the core stage status plus the relevant latest date; stale latest dates are shown in the subcard details. The Agent Feedback stat displays below EOD Status, uses the latest stored price trade date, and treats `summary.is_live` as the running signal. Fundamentals failure details open from the review control. |
| `dashboard.symbol-card.{symbol}` | `src/app/dashboard/live-dashboard-client.tsx` | Per-symbol tracked card | `/api/trading/quotes/tracked`, `/api/trading/eod/freshness` | `symbol`, `company_name`, `price`, `change`, `change_pct`, `turnover`, `available`, `is_live`, `trade_date`, `source`, `unavailable_reason`, `latest.technical_market_date` | Price freshness and TA freshness are intentionally separate. |
| `dashboard.momentum-board` | `src/app/dashboard/live-dashboard-client.tsx` | Highest-movers note card | `/api/trading/quotes/tracked` | top absolute movers from `items[].change_pct` | Derived ordering only; no new backend fields are invented. |
| `dashboard.coverage-note` | `src/app/dashboard/live-dashboard-client.tsx` | Mobile coverage note stack | `/api/trading/eod/freshness`, `/api/trading/quotes/tracked` | unavailable counts, fallback counts, `latest.price_trade_date`, `latest.technical_market_date`, `latest.action_market_date` | Replaces the old search/notes dashboard column for mobile. |

## Symbol detail

Primary route:
- `/dashboard/symbol/[symbol]` — Symbol Detail - Insights & Data overview

Dedicated Stitch detail routes:
- `/dashboard/symbol/[symbol]/action-summary` — Action Summary Detail
- `/dashboard/symbol/[symbol]/technical-analysis` — Technical Analysis Detail
- `/dashboard/symbol/[symbol]/fundamentals-history` — Fundamentals History Detail
- `/dashboard/symbol/[symbol]/disclosure-coverage` — Disclosure & Coverage Detail
- `/dashboard/symbol/[symbol]/disclosure-coverage/[receiptNo]` — Disclosure Report Detail
- `/dashboard/symbol/[symbol]/system-freshness` — System Freshness Component Detail

| Tag | File | Mobile component | API | Rendered fields | Notes |
| --- | --- | --- | --- | --- | --- |
| `symbol.hero` | `src/app/dashboard/symbol/[symbol]/symbol-detail-client.tsx` | Quote hero | `/api/trading/quotes/{symbol}`, `/api/trading/market/status`, `/api/trading/symbols/search`, `/api/trading/agent-context/symbol-day` | `price`, `change`, `change_pct`, `available`, `source`, `market_state`, `trade_date`, `cached_at`, search seed metadata, aggregate availability summary | Includes back navigation, stable-mode/polling state, and the compact fusion note. |
| `symbol.chart` | `src/app/dashboard/symbol/[symbol]/symbol-detail-client.tsx`, `src/app/dashboard/symbol/[symbol]/symbol-history-chart.tsx` | Swipe-aware candlestick chart | `/api/trading/symbols/{symbol}/price-bars`, `/api/trading/quotes/{symbol}` | `items[].trade_date`, `open_price`, `high_price`, `low_price`, `close_price`, `volume`, `turnover`, plus current quote freshness context | Focus date updates from chart interaction; chart stays historical, not live-tick simulated. |
| `symbol.action-summary` | `src/app/dashboard/symbol/[symbol]/symbol-detail-client.tsx`, `src/app/dashboard/symbol/[symbol]/action-summary/page.tsx` | Deterministic action layer card and detail page | `/api/trading/eod/action-summaries`, fallback `/api/trading/agent-context/symbol-day` | `action_label`, `signal_score`, `confidence_tier`, `risk_tier`, `trigger_price`, `support_price`, `resistance_price`, `reasons`, `summary_payload` keys | Multi-day history remains `[확인 필요]` until a confirmed endpoint exists. |
| `symbol.technical-analysis` | `src/app/dashboard/symbol/[symbol]/symbol-detail-client.tsx`, `src/app/dashboard/symbol/[symbol]/technical-analysis/page.tsx` | Technical snapshot card and detail page | `/api/trading/eod/technical-snapshots`, fallback `/api/trading/agent-context/symbol-day` | `trend_state`, `ma_alignment`, `breakout_20d`, `breakdown_20d`, `return_5d`, `return_20d`, `volume_ratio_20d`, `atr_14`, `atr_pct_14`, `signal_payload` keys | RSI/MACD/ADX are not invented when upstream fields are not confirmed. |
| `symbol.fundamentals-history` | `src/app/dashboard/symbol/[symbol]/symbol-detail-client.tsx`, `src/app/dashboard/symbol/[symbol]/fundamentals-history/page.tsx` | DART fundamentals history card and detail page | `/api/trading/disclosures/dart/fundamentals/history`, fallback `/api/trading/agent-context/symbol-day` | `companies[].entries[].filing`, `period`, `statement.fs_div`, `highlights[]`, plus aggregate latest filing fallback | When highlight metrics are missing, UI shows `[확인 필요]` instead of fake valuation data. |
| `symbol.disclosures` | `src/app/dashboard/symbol/[symbol]/symbol-detail-client.tsx`, `src/app/dashboard/symbol/[symbol]/disclosure-coverage/page.tsx` | Recent disclosures card and detail page | `/api/trading/agent-context/symbol-day` | `recent_disclosures.count`, `items[].report_nm`, `receipt_date`, `filing_category`, `fundamentals_capture_status`, `rcept_no` | Explicit empty state uses “No Disclosure Found”. |
| `symbol.disclosure-report` | `src/app/dashboard/symbol/[symbol]/disclosure-coverage/[receiptNo]/disclosure-report-client.tsx` | Disclosure report document detail | `/api/trading/disclosures/dart/filings/document` | `rcept_no` from the selected `recent_disclosures.items[]` row plus route metadata query fields | Opens from S7 disclosure cards and preserves the symbol detail query context. |
| `symbol.system-freshness` | `src/app/dashboard/symbol/[symbol]/symbol-detail-client.tsx`, `src/app/dashboard/symbol/[symbol]/system-freshness/page.tsx` | Layer-specific freshness registry card and detail page | `/api/trading/eod/freshness`, `/api/trading/quotes/{symbol}` | `today.trade_date`, `today.eod_status`, `today.symbols_succeeded`, `today.symbols_total`, `latest.price_trade_date`, `latest.symbols_succeeded`, `latest.symbols_total`, `latest.technical_market_date`, `latest.action_market_date`, quote provenance | Fundamentals freshness remains a reference-only row until upstream exposes a dedicated freshness field. |
| `symbol.errors` | `src/app/dashboard/symbol/[symbol]/symbol-detail-client.tsx` | Error feedback rail | client fetch states | quote, metadata, history, context, fundamentals errors | Error cards are still clamped to 3 lines and sit above the chart on failure. |

## Search

Primary route:
- `/search` — Search - Mobile Terminal

| Tag | File | Mobile component | API | Rendered fields | Notes |
| --- | --- | --- | --- | --- | --- |
| `search.terminal-shell` | `src/app/search/page.tsx` | Search app bar, terminal input, and inline autocomplete | `/api/trading/symbols/search` | `query`, result count, `items[].symbol`, `items[].name_ko`, `items[].market` | Replaces the old `AppShell` search layout, keeps the bottom tab bar active on Search, and renders suggestions directly below Q1 only after the user types. |
| `search.quick-access` | `src/app/search/page.tsx` | Favorite quick chips and `+` search dialog | `/api/trading/symbols/favorites`, `/api/trading/symbols/search`, `/api/trading/scanner/tracked-symbols` | favorite `symbol`, `name_ko`, dialog search result `symbol`, `name_ko`, `market` | Q3 no longer falls back to local recent or current query lists; the `+` action opens autocomplete before saving through the core tracked-symbol write route. |
| `search.trending-symbols` | `src/app/search/page.tsx` | Trending symbol source card | `/api/trading/scanner/realtime-trending`, `/api/trading/scanner/trending-stocks` | `items[].symbol`, display name, market, rank, metric/change percentage, source label | Q4 has KIS, 1D, 5D, and 20D tabs. It renders exact symbols from core, starts with five rows, and extends the requested limit by five from the More button. |

## Dev tag IDs

The dev-mode tag overlay shows short IDs while copying the full label/API payload. Current mappings:
- `D1` dashboard core unavailable
- `D2` dashboard operational integrity
- `D4` dashboard momentum board
- `D5` dashboard coverage note
- `Q1` search terminal shell
- `Q3` search quick access
- `Q4` search trending symbols
- `Q6` search desktop results table
- `S1` symbol hero
- `S2` symbol errors
- `S3` symbol chart
- `S4` action summary
- `S5` technical analysis
- `S6` fundamentals history
- `S7` disclosures
- `S8` system freshness

## BFF routes added for the mobile Stitch refresh

- `GET /api/trading/eod/freshness`
- `GET /api/trading/eod/technical-snapshots`
- `GET /api/trading/eod/action-summaries`
- `GET /api/trading/disclosures/dart/fundamentals/history`
- `GET /api/trading/symbols/{symbol}/price-bars`

## Source of truth

- Stitch project export under `/tmp/stitch-4983085105003286837`
- `kai-trading-core` spec: `docs/CORE_API_SPEC.md`
- Screen/API field map: `docs/UI_API_SURFACE_MAP.md`
