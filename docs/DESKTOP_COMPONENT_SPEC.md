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
| Desktop rail | `src/components/mobile/mobile-app-chrome.tsx` | none | `MobileAppChrome` now renders a desktop-only Obsidian Ledger rail with `Dashboard`, `Search`, `Market Status`, and `My Symbols` navigation. |
| Desktop top bar | `src/components/mobile/mobile-app-chrome.tsx` | page-specific | Reuses each route header and keeps the dev-mode toggle visible. |

## Dashboard: `/dashboard`

| Tag | Component | API | Rendered fields |
| --- | --- | --- | --- |
| `dashboard.operational-integrity` | Portfolio / asset status zone | `/api/trading/eod/freshness`, `/api/trading/market/status`, `/api/trading/disclosures/dart/fundamentals/daily/inspect` | `today.received`, `today.trade_date`, `today.symbols_succeeded`, `today.symbols_total`, `latest.price_trade_date`, `latest.symbols_succeeded`, `latest.symbols_total`, `latest.technical_market_date`, `latest.action_market_date`, optional `fundamental(s).latest_date`, fundamentals `latest_run.status`, fundamentals `latest_run.market_date`, fundamentals failure dialog from `latest_run.error_message`, `symbols_failed`, `events_failed`, run counts/timing, and failure-related `run_metadata`, `market.state`, `server_time` |
| `dashboard.audit-feed` | Desktop audit feed | `/api/trading/eod/freshness`, `/api/trading/quotes/tracked` | module freshness rows derived from price, technical, and action layers |
| `dashboard.symbol-card.{symbol}` | Ledger recommendation row | `/api/trading/quotes/tracked`, `/api/trading/eod/freshness` | `symbol`, `company_name`, `price`, `change`, `change_pct`, `turnover`, `available`, `is_live`, `source`, `trade_date`, technical freshness |
| `dashboard.momentum-board` | Global sentiment / movers card | `/api/trading/quotes/tracked` | top absolute movers from `items[].change_pct` |
| `dashboard.coverage-note` | Coverage note card | `/api/trading/eod/freshness`, `/api/trading/quotes/tracked` | fallback/unavailable counts and layer freshness |

## Symbol desktop pages

| Tag | Component | API | Desktop behavior |
| --- | --- | --- | --- |
| `symbol.hero` | Large instrument hero | `/api/trading/quotes/{symbol}`, `/api/trading/market/status`, `/api/trading/symbols/search`, `/api/trading/agent-context/symbol-day` | Wide symbol/price heading with route metadata and quote provenance. |
| `symbol.chart` | Candlestick chart | `/api/trading/symbols/{symbol}/price-bars`, `/api/trading/quotes/{symbol}` | Desktop chart has a larger viewport and still updates focus data from swipe/drag/click. Technical detail also renders this chart. |
| `symbol.action-summary` | Action summary detail | `/api/trading/eod/action-summaries`, fallback `/api/trading/agent-context/symbol-day` | Signal score, confidence/risk, trigger price, reasons, and payload keys. Multi-day signal history remains `[확인 필요]` until exposed upstream. |
| `symbol.technical-analysis` | Technical analysis detail | `/api/trading/eod/technical-snapshots`, fallback `/api/trading/agent-context/symbol-day` | Trend state, MA alignment, returns, volume ratio, ATR, and signal payload keys. Unsupported RSI/MACD/ADX values are not invented. |
| `symbol.fundamentals-history` | Fundamentals history detail | `/api/trading/disclosures/dart/fundamentals/history`, fallback `/api/trading/agent-context/symbol-day` | Filing cards become a desktop grid using available `entries[].highlights`; missing statement rows remain `[확인 필요]`. |
| `symbol.disclosures` | Disclosure coverage detail | `/api/trading/agent-context/symbol-day` | Recent filing cards use `report_nm`, `receipt_date`, `filing_category`, `fundamentals_capture_status`, and `rcept_no`. |
| `symbol.system-freshness` | Freshness registry | `/api/trading/eod/freshness`, `/api/trading/quotes/{symbol}` | Price, technical, action, fundamentals, and disclosure rows preserve layer-specific status. |

## Search: `/search`

Mobile reference:
- `Search - Mobile Terminal` (`53f5332a2ca848d4ac0651fe4b0a0945`)

Desktop reference:
- `Search - Desktop Centered Terminal` (`194aa22ed2c34b8cbb4411af812419f5`)

| Tag | Component | API | Desktop behavior |
| --- | --- | --- | --- |
| `search.terminal-shell` | Centered Universal Search hero | `/api/trading/symbols/search`, selected `/api/trading/quotes/{symbol}` | Large centered terminal input, desktop top links, market-open badge, and dev toggle. |
| `search.quick-access` | Quick Access / Recent cards | local recent selections, `/api/trading/symbols/search` | Four wide cards use actual recent selections or current search metadata; no sample TSLA/NVDA values are hardcoded. |
| `search.desktop-results-table` | Desktop results table | `/api/trading/symbols/search`, selected `/api/trading/quotes/{symbol}` | Rows render symbol metadata from search. Only the selected row shows quote-backed price, change, and freshness; market cap and unsupported coverage are `[확인 필요]`. |
| `search.selected-quote` | Sticky selected quote inspector | `/api/trading/quotes/{symbol}` | Shows live/fallback/unavailable mode, price, change, volume, turnover, source, freshness, and a metadata-preserving symbol detail link. |
| `search.network-integrity` | Mobile integrity strip | client fetch states | Hidden on desktop; mobile uses endpoint error state to degrade the meter. |

## Implementation notes

- Desktop layout is CSS-driven through `MobileAppChrome` and route CSS modules, so page data loading stays shared with mobile.
- `/dashboard/symbol/[symbol]/technical-analysis` now loads `/symbols/{symbol}/price-bars` so the desktop candlestick Stitch screen is represented without faking intraday bars.
- The chart uses `lightweight-charts` with horizontal touch drag and mouse drag enabled; focus cards update from crosshair/click events.
- `/search` uses the same BFF endpoints as the prior route, but replaces the legacy workspace shell with Stitch terminal chrome on both mobile and desktop.
