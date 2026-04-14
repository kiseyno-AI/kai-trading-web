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
| `dashboard.operational-integrity` | `src/app/dashboard/live-dashboard-client.tsx` | Operational Integrity hero | `/api/trading/eod/freshness`, `/api/trading/market/status` | `today.received`, `today.trade_date`, `today.symbols_succeeded`, `today.symbols_total`, `latest.price_trade_date`, `latest.symbols_succeeded`, `latest.symbols_total`, `market.state`, `market.server_time` | The EOD Status stat displays the core freshness received flag, market-date context, latest stored EOD date, and success/total EOD symbol counts, using latest counts when today's run has not happened yet. Fundamentals freshness is still `[확인 필요]` because the current freshness route does not expose a dedicated fundamentals date. |
| `dashboard.watch-snapshot` | `src/app/dashboard/live-dashboard-client.tsx` | Tracked snapshot card | `/api/trading/quotes/tracked`, `/api/trading/scanner/tracked-symbols`, `/api/trading/eod/freshness` | aggregate tracked turnover, tracked count, live/fallback/unavailable counts, lead symbol, `latest.price_trade_date`, `latest.technical_market_date` | The large headline metric is still data-backed. Unsupported portfolio-like values stay `[확인 필요]`. |
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
- `/dashboard/symbol/[symbol]/system-freshness` — System Freshness Component Detail

| Tag | File | Mobile component | API | Rendered fields | Notes |
| --- | --- | --- | --- | --- | --- |
| `symbol.hero` | `src/app/dashboard/symbol/[symbol]/symbol-detail-client.tsx` | Quote hero | `/api/trading/quotes/{symbol}`, `/api/trading/market/status`, `/api/trading/symbols/search`, `/api/trading/agent-context/symbol-day` | `price`, `change`, `change_pct`, `available`, `source`, `market_state`, `trade_date`, `cached_at`, search seed metadata, aggregate availability summary | Includes back navigation, stable-mode/polling state, and the compact fusion note. |
| `symbol.chart` | `src/app/dashboard/symbol/[symbol]/symbol-detail-client.tsx`, `src/app/dashboard/symbol/[symbol]/symbol-history-chart.tsx` | Swipe-aware candlestick chart | `/api/trading/symbols/{symbol}/price-bars`, `/api/trading/quotes/{symbol}` | `items[].trade_date`, `open_price`, `high_price`, `low_price`, `close_price`, `volume`, `turnover`, plus current quote freshness context | Focus date updates from chart interaction; chart stays historical, not live-tick simulated. |
| `symbol.action-summary` | `src/app/dashboard/symbol/[symbol]/symbol-detail-client.tsx`, `src/app/dashboard/symbol/[symbol]/action-summary/page.tsx` | Deterministic action layer card and detail page | `/api/trading/eod/action-summaries`, fallback `/api/trading/agent-context/symbol-day` | `action_label`, `signal_score`, `confidence_tier`, `risk_tier`, `trigger_price`, `support_price`, `resistance_price`, `reasons`, `summary_payload` keys | Multi-day history remains `[확인 필요]` until a confirmed endpoint exists. |
| `symbol.technical-analysis` | `src/app/dashboard/symbol/[symbol]/symbol-detail-client.tsx`, `src/app/dashboard/symbol/[symbol]/technical-analysis/page.tsx` | Technical snapshot card and detail page | `/api/trading/eod/technical-snapshots`, fallback `/api/trading/agent-context/symbol-day` | `trend_state`, `ma_alignment`, `breakout_20d`, `breakdown_20d`, `return_5d`, `return_20d`, `volume_ratio_20d`, `atr_14`, `atr_pct_14`, `signal_payload` keys | RSI/MACD/ADX are not invented when upstream fields are not confirmed. |
| `symbol.fundamentals-history` | `src/app/dashboard/symbol/[symbol]/symbol-detail-client.tsx`, `src/app/dashboard/symbol/[symbol]/fundamentals-history/page.tsx` | DART fundamentals history card and detail page | `/api/trading/disclosures/dart/fundamentals/history`, fallback `/api/trading/agent-context/symbol-day` | `companies[].entries[].filing`, `period`, `statement.fs_div`, `highlights[]`, plus aggregate latest filing fallback | When highlight metrics are missing, UI shows `[확인 필요]` instead of fake valuation data. |
| `symbol.disclosures` | `src/app/dashboard/symbol/[symbol]/symbol-detail-client.tsx`, `src/app/dashboard/symbol/[symbol]/disclosure-coverage/page.tsx` | Recent disclosures card and detail page | `/api/trading/agent-context/symbol-day` | `recent_disclosures.count`, `items[].report_nm`, `receipt_date`, `filing_category`, `fundamentals_capture_status`, `rcept_no` | Explicit empty state uses “No Disclosure Found”. |
| `symbol.system-freshness` | `src/app/dashboard/symbol/[symbol]/symbol-detail-client.tsx`, `src/app/dashboard/symbol/[symbol]/system-freshness/page.tsx` | Layer-specific freshness registry card and detail page | `/api/trading/eod/freshness`, `/api/trading/quotes/{symbol}` | `today.trade_date`, `today.eod_status`, `today.symbols_succeeded`, `today.symbols_total`, `latest.price_trade_date`, `latest.symbols_succeeded`, `latest.symbols_total`, `latest.technical_market_date`, `latest.action_market_date`, quote provenance | Fundamentals freshness remains a reference-only row until upstream exposes a dedicated freshness field. |
| `symbol.errors` | `src/app/dashboard/symbol/[symbol]/symbol-detail-client.tsx` | Error feedback rail | client fetch states | quote, metadata, history, context, fundamentals errors | Error cards are still clamped to 3 lines and sit above the chart on failure. |

## Search

Primary route:
- `/search` — Search - Mobile Terminal

| Tag | File | Mobile component | API | Rendered fields | Notes |
| --- | --- | --- | --- | --- | --- |
| `search.terminal-shell` | `src/app/search/page.tsx` | Search app bar and terminal input | `/api/trading/symbols/search`, selected `/api/trading/quotes/{symbol}` | `query`, result count, selected quote mode | Replaces the old `AppShell` search layout and keeps the bottom tab bar active on Search. |
| `search.mobile-results` | `src/app/search/page.tsx` | Mobile result cards | `/api/trading/symbols/search`, selected `/api/trading/quotes/{symbol}` | `items[].symbol`, `items[].name_ko`, `items[].market`, selected `price`, selected `change_pct`, selected freshness | Unselected rows show `[확인 필요]` for quote values instead of sample prices. |
| `search.quick-access` | `src/app/search/page.tsx` | Recent / quick chips | local recent selections, `/api/trading/symbols/search` | recent `symbol`, `name_ko`, current query items | Local storage is convenience state only; no backend recency is implied. |
| `search.trending-symbols` | `src/app/search/page.tsx` | Trending-style symbol cards | `/api/trading/symbols/search`, selected `/api/trading/quotes/{symbol}` | current result `symbol`, `market`, selected quote values | Actual trend ranking source is `[확인 필요]` because no confirmed trending endpoint powers `/search`. |
| `search.network-integrity` | `src/app/search/page.tsx` | Integrity strip | client fetch states | search/quote error state | The visual integrity meter degrades when either endpoint errors. |
| `search.selected-quote` | `src/app/search/page.tsx` | Selected quote inspector | `/api/trading/quotes/{symbol}` | `price`, `change`, `change_pct`, `volume`, `turnover`, `source`, `available`, `fallback`, `is_live`, `cached_at`, `trade_date` | Provides a real-data path to the symbol detail route without adding trading actions. |

## Dev tag IDs

The dev-mode tag overlay shows short IDs while copying the full label/API payload. Current mappings:
- `D1` dashboard core unavailable
- `D2` dashboard operational integrity
- `D3` dashboard watch/symbol cards
- `D4` dashboard momentum board
- `D5` dashboard coverage note
- `Q1` search terminal shell
- `Q2` search mobile results
- `Q3` search quick access
- `Q4` search trending symbols
- `Q5` search network integrity
- `Q6` search desktop results table
- `Q7` search selected quote
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
