# Desktop Stitch Component Spec

This document maps the desktop Stitch refresh to the shipped React surfaces, component tags, and backend API fields. It complements `docs/MOBILE_COMPONENT_SPEC.md`; the same data rules apply on desktop.

## Global rules

- Desktop layouts are active at `1024px+`; mobile keeps the fixed top app bar and bottom tabs.
- Long text remains clamped to **3 lines maximum** via `clamp-3`, then visually truncates with `...`.
- Dev-mode component tags remain available through the `DevModeToggle` in the top bar.
- If a field is not confirmed by `kai-trading-core`, the UI renders `[확인 필요]` instead of inventing values.
- No live-trading behavior was added. Disabled execution CTAs remain visual placeholders until explicitly approved.

## Stitch references

Project: `4983085105003286837`

| Stitch screen | Screen ID | Route |
| --- | --- | --- |
| Dashboard - Optimized Wide View | `56afc14ce7924860be94af849a098e91` | `/dashboard` |
| Symbol Detail - Desktop View | `ad1e28efa1e847ae8d65d8a21d8e906e` | `/dashboard/symbol/[symbol]` |
| Action Summary Detail - Desktop View | `ff30595a9e094ff6bb9dd59a787bef61` | `/dashboard/symbol/[symbol]/action-summary` |
| Fundamentals History - Desktop View | `d87dcf06e3694c57aa4a72e537eb23d3` | `/dashboard/symbol/[symbol]/fundamentals-history` |
| Technical Analysis Detail - Candlestick View | `7d122202cb7740f3b146aa4470c76914` | `/dashboard/symbol/[symbol]/technical-analysis` |
| Search - Desktop Centered Terminal | `194aa22ed2c34b8cbb4411af812419f5` | `/search` |

Downloaded reference assets were stored under `/tmp/stitch-4983085105003286837-desktop` during implementation.

## Shared desktop shell

| Surface | File | API | Notes |
| --- | --- | --- | --- |
| Desktop rail | `src/components/mobile/mobile-app-chrome.tsx` + `src/lib/app-chrome-routes.ts` | shared route model | `MobileAppChrome` renders a desktop-only KAI Trading rail from the same descriptors as the mobile bottom nav: `Dashboard`, `Search`, `Calendar`, `Assets`, and `My Symbols`. |
| Desktop top bar | `src/components/navigation/dashboard-toolbar.tsx` | route slot/config | `MobileAppChrome` and `AppShell` compose the shared dashboard toolbar instead of keeping per-route top-bar markup. Screens provide only `topbar` slots/config such as status/actions or a small leading control. |

## Dashboard: `/dashboard`

| Tag | Component | API | Rendered fields |
| --- | --- | --- | --- |
| `dashboard.process-monitor` | Toolbar daily process monitor drawer plus dashboard Filtering and Scoring cards | `/api/trading/eod/freshness`, `/api/trading/eod/pipeline/status`, `/api/trading/market/status`, `/api/trading/agent-context/feedback/progress`, `/api/trading/disclosures/dart/fundamentals/daily/inspect`, `/api/trading/eod/piotroski-filter-results`, `/api/trading/eod/market-risk-filters` | EOD stage status/counts/latest dates, running pipeline steps, filtering fallback dates and counts, scoring progress, agent-feedback role progress, and the shared patch date |
| `dashboard.signal-decider-feedback` | Signal-decider feedback card and detail route | `/api/trading/agent-context/feedback?market_date=...&agent_name=signal-decider`, `/api/trading/agent-context/feedback/progress` | card status, result count, market date, action mix, preview rows, and detail rows with symbol/company, action, conviction/confidence, thesis, risks, stop/target, persisted 5-day evaluation status/target-hit/stop-hit/first-hit/MFE/MAE/window/warnings, run id, and captured timestamp |
| `dashboard.piotroski-board` | Piotroski full-list route | `/api/trading/eod/piotroski-filter-results`, `/api/trading/quotes/{symbol}`, `/api/trading/symbols/search` | `items[].symbol`, `items[].passed_filter`, `items[].piotroski_score`, per-symbol quote `price`, `change_pct`, metadata fallback name; the shared dashboard/process-monitor Filtering card owns the compact summary, while `More` opens `/dashboard/piotroski-filter` for the full list |

- Agent Feedback role rows render compact progress bars under each EOD / Technical / Fundamental summarizer and signal-decider title, with the right-side status icon still derived from each row's resolved status.
- Signal-decider feedback uses the generic stored feedback read filtered by `agent_name=signal-decider`; if progress role counts are absent, the UI keeps row counts visible and avoids inferring full cycle completion. Persisted 5-day evaluation outcomes are displayed when already stored on feedback rows, and missing/incomplete evaluation rows render not-computed, pending-window, or insufficient-data states without triggering compute endpoints.
- At desktop widths, the dashboard-body Filtering and Scoring cards share a balanced row. The process monitor keeps the full `Daily Data Fetch`, `Filtering`, `Scoring`, and `Agent Feedback` detail grid.

## Symbol desktop pages

| Tag | Component | API | Desktop behavior |
| --- | --- | --- | --- |
| `symbol.hero` | Large instrument hero | `/api/trading/quotes/{symbol}`, `/api/trading/market/status`, `/api/trading/symbols/search`, `/api/trading/symbols/{symbol}/price-bars`, `/api/trading/agent-context/symbol-day`, `/api/trading/eod/piotroski-filter-results` | Wide symbol/price heading with route metadata, quote provenance, focus-candle OHLCV lines, latest DART event/date, Piotroski pass/fail, and a recommendation placeholder. |
| `symbol.chart` | Candlestick chart | `/api/trading/symbols/{symbol}/price-bars`, `/api/trading/quotes/{symbol}` | Desktop chart has a larger viewport and still updates focus data from swipe/drag/click. Technical detail also renders this chart. Missing or zero-sentinel turnover on a nonzero-volume candle is shown as confirmation-needed, not factual `₩0`. |
| `symbol.action-summary` | Action summary detail | `/api/trading/eod/action-summaries`, fallback `/api/trading/agent-context/symbol-day` | Signal score, confidence/risk, trigger price, reasons, and payload keys. Multi-day signal history remains `[확인 필요]` until exposed upstream. |
| `symbol.technical-analysis` | Technical analysis detail | `/api/trading/eod/technical-snapshots`, fallback `/api/trading/agent-context/symbol-day` | Trend state, MA alignment, returns, volume ratio, ATR, and signal payload keys. Unsupported RSI/MACD/ADX values are not invented. |
| `symbol.fundamentals-history` | Fundamentals history detail | `/api/trading/disclosures/dart/fundamentals/history`, fallback `/api/trading/agent-context/symbol-day` | Filing cards become a desktop grid using available `entries[].highlights`; missing statement rows remain `[확인 필요]`. |
| `symbol.disclosures` | Disclosure coverage detail | `/api/trading/agent-context/symbol-day` | Recent filing cards use `report_nm`, `receipt_date`, `filing_category`, `fundamentals_capture_status`, and `rcept_no`. |
| `symbol.disclosure-report` | Disclosure report document detail | `/api/trading/disclosures/dart/filings/document` | S7 filing cards open a full-width document screen under `/dashboard/symbol/[symbol]/disclosure-coverage/[receiptNo]`. |
| `symbol.system-freshness` | Freshness registry | `/api/trading/eod/freshness`, `/api/trading/quotes/{symbol}` | Price, technical, action, fundamentals, and disclosure rows preserve layer-specific status. |

## Search: `/search`

Mobile reference:
- `Search - Mobile Terminal` (`53f5332a2ca848d4ac0651fe4b0a0945`)

Desktop reference:
- `Search - Desktop Centered Terminal` (`194aa22ed2c34b8cbb4411af812419f5`)

| Tag | Component | API | Desktop behavior |
| --- | --- | --- | --- |
| `search.terminal-shell` | Centered Universal Search hero | `/api/trading/symbols/search` | Large centered terminal input, inline autocomplete under Q1 while typing, desktop top links, and shared dashboard-toolbar status/actions. |
| `search.quick-access` | Quick Access favorites and `+` search dialog | `/api/trading/symbols/favorites`, `/api/trading/symbols/search`, `/api/trading/scanner/tracked-symbols` | Four wide cards render core favorites only. Empty Q3 stays empty until `+` opens the autocomplete dialog and saves through the tracked-symbol write route. |
| `search.desktop-results-table` | Desktop results table | `/api/trading/symbols/search`, selected `/api/trading/quotes/{symbol}` | Rows render symbol metadata from search. Only the selected row shows quote-backed price, change, and freshness; market cap and unsupported coverage are `[확인 필요]`. |

## Implementation notes

- Desktop layout is CSS-driven through `MobileAppChrome` and route CSS modules, so page data loading stays shared with mobile.
- `/dashboard/symbol/[symbol]/technical-analysis` now loads `/symbols/{symbol}/price-bars` so the desktop candlestick Stitch screen is represented without faking intraday bars.
- The chart uses `lightweight-charts` with horizontal touch drag and mouse drag enabled; focus cards update from crosshair/click events.
- `/search` uses the same BFF endpoints as the prior route, but replaces the legacy workspace shell with Stitch terminal chrome on both mobile and desktop.
