# Trading Web Functional Specification

## Document status

- Repository: `trading-web`
- Scope: current shipped and intentionally scaffolded product behavior
- Audience: product, frontend, backend, QA, and future verification agents
- Primary goal: define what each surface should do, what data it should show, and how it should behave when data is missing, stale, partial, or unavailable

This document is the product-level source of truth for the web app.
For field-level API wiring, also read:

- `docs/API_CONTRACT.md`
- `docs/UI_API_SURFACE_MAP.md`
- `docs/MOBILE_COMPONENT_SPEC.md`
- `docs/DESKTOP_COMPONENT_SPEC.md`
- `src/types/trading-api.ts`

---

## 1. Product purpose

`trading-web` is a read-focused trading operations interface for the KAI system.
It is not a broker UI and must not bypass the backend.
The app exists to let an operator:

- inspect market and pipeline state
- verify EOD data freshness and downstream processing
- review filtering and scoring outputs
- inspect signal-decider decisions and decision quality evidence
- inspect symbol-level technical, factor, and disclosure context
- inspect portfolio state through backend-managed integrations
- navigate a coherent mobile-first and desktop-capable operations shell

### Core product boundaries

The web app must:

- call only the BFF / trading API layer, never broker APIs directly from the browser
- behave conservatively when data is missing or ambiguous
- prefer explicit unavailable / pending / stale states over guessed values
- keep read-only decision support separate from live execution unless explicitly approved

The web app must not:

- invent prices, factor values, evaluation verdicts, or outcomes
- imply that a missing field is zero
- infer market-condition data from unrelated filtering endpoints
- enable live-trading actions by accident

---

## 2. Architecture and delivery model

### 2.1 Frontend shape

- Framework: Next.js App Router + TypeScript
- Delivery pattern: server-rendered bootstrap with client-side polling / refresh where needed
- Main folders:
  - `src/app/*` route entrypoints
  - `src/features/*` page-level composition
  - `src/components/*` shared UI, layout, navigation, dashboard parts
  - `src/lib/*` adapters, formatting, caching, and state helpers
  - `src/types/trading-api.ts` frontend API DTO contracts

### 2.2 Backend access rule

All browser-facing data must come through:

- `src/app/api/trading/**` BFF routes, or
- the configured trading API base URL via the app adapters

Never call broker systems directly from the browser.

### 2.3 Rendering strategy

Prefer:

1. SSR/bootstrap for initial route payloads where practical
2. client polling only for actively changing operational data
3. per-surface state mapping so one bad subsection does not collapse a whole page

---

## 3. Shared UX rules

### 3.1 Truthfulness rules

If a field is not confirmed by backend data, the UI must:

- show `needs review`, `unavailable`, `pending`, or another explicit state label
- never synthesize a plausible-looking number or verdict

### 3.2 Freshness rules

Freshness is layer-specific.
Price, technical, action-summary, fundamentals, disclosures, filtering, scoring, and agent-feedback do not share one universal timestamp.
The UI must preserve those distinctions.

### 3.3 State vocabulary

The product should consistently map backend conditions into a bounded set of understandable UI states.
Preferred labels:

- `running`
- `pending`
- `completed`
- `needs review`
- `waiting`
- `unavailable`
- `not configured`
- `partial`
- `stale`
- `break day` where explicitly relevant for non-trading-day interpretation

### 3.4 Responsive rules

- Mobile is first-class, not a reduced afterthought
- Desktop must preserve the same meaning and data truth while using wider layouts
- Long text should visually clamp instead of exploding layouts
- Shared shell and navigation must remain consistent across routes

### 3.5 Dev inspection rules

Dev-mode component tags remain available and should continue to map screen sections to backend dependencies.
They are part of the intended QA/debug workflow.

---

## 4. Shared chrome and navigation specification

Two shell systems coexist intentionally.

### 4.1 `MobileAppChrome`

Used by the main operator surfaces such as:

- `/dashboard`
- `/search`
- `/my-symbols`
- `/portfolio`
- `/calendar`
- symbol-detail and related mobile-style deep links

Expected behavior:

- fixed top app bar composed inside `MobileAppChrome` from `src/components/navigation/dashboard-toolbar.tsx`; routes provide only `topbar` slots/config
- bottom tab bar
- active-tab highlighting
- desktop left rail when viewed at larger widths, derived from the shared app chrome route model
- locale switch in shell chrome
- release version visibility
- sibling-route prefetching for toolbar targets
- bottom accessory and floating layer slots that inherit the shell-owned safe-area/floating offset

Primary nav destinations:

- Dashboard
- Search
- Calendar
- Assets / Portfolio
- My Symbols

### 4.2 `AppShell`

Used by broader workspace-style routes such as:

- `/markets`
- `/markets/factors`
- `/bots`

`AppShell` uses the same shared dashboard toolbar component as `MobileAppChrome`, adding route copy, search, notification, locale, and profile slots instead of maintaining a separate top-bar implementation. Its default sidebar/nav and search suggestions are generated from the same route descriptors used by the full-page mobile chrome.

Expected behavior:

- left sidebar on larger layouts
- shared top bar with route title and eyebrow
- mobile nav drawer behavior when needed
- route-level search suggestions and route metadata

### 4.3 Navigation rules

- `/` must redirect to `/dashboard`
- route titles and eyebrows must match route intent
- navigation should warm likely sibling views when the dedicated mobile shell is used
- route changes should expose navigation-pending feedback rather than appearing dead

---

## 5. Route inventory

## 5.1 `/` Home redirect

Purpose:

- canonical entry redirects immediately to `/dashboard`

Expected behavior:

- no content surface of its own
- no alternate landing experience

---

## 5.2 `/dashboard` Primary command surface

Purpose:

- the main operational surface for daily monitoring and intervention awareness

Primary bootstrap sources:

- `/market/status`
- `/market/snapshot`
- `/quotes/tracked`
- `/eod/freshness`
- `/eod/pipeline/status`
- `/disclosures/dart/fundamentals/daily/inspect`
- `/agent-context/feedback/progress`
- `/agent-context/feedback?agent_name=signal-decider`
- `/portfolio/summary`
- `/eod/piotroski-filter-results`
- `/eod/market-risk-filters`

### Required top-level behavior

The dashboard should act as a truth-preserving status surface, not a marketing dashboard.
It must show what is truly available now, what is still running, and what is missing.

### Required major sections

#### A. Core unavailable fallback

When upstream bootstrap fails badly enough that the main dashboard cannot be trusted, the route must show an explicit core-unavailable state instead of a fake healthy dashboard.

Expected content:

- clear unavailable message
- indication that live core data is unavailable
- only safe fallback/mock placeholders where already intentionally supported

#### B. Market condition card

Purpose:

- show real market-condition context from the dedicated market snapshot payload

Source:

- `/api/trading/market/snapshot`

Expected displayed data when available:

- KOSPI level / change / change rate
- KOSDAQ level / change / change rate
- USD/KRW rate
- foreign flow
- institutional flow
- optional market bias summary
- optional breadth / market line summary
- snapshot status: `ready`, `partial`, `stale`, or `unavailable`
- optional `missing_fields` and `stale_reason` context

Rules:

- must not derive this card from Piotroski, risk-filter, or generic market status payloads
- `/market/status` may only supply session / trading-day context for this card
- if snapshot data is unavailable, show explicit unavailable state
- if snapshot data is partial but still usable, keep the available values visible and label the card as partial
- if a refresh fails after a usable snapshot was already loaded, keep the last usable values visible and label the card as stale
- do not fabricate index, FX, or flow values

#### C. Portfolio state card

Purpose:

- summarize portfolio integration readiness and aggregate account condition without forcing the user into the portfolio page

Source:

- `/api/trading/portfolio/summary`

Expected behaviors:

- distinguish not configured vs unavailable vs stale vs empty vs partially synced vs healthy
- show account and sync context only when supplied by backend
- remain read-only

#### D. Operational Integrity hero (D2)

Purpose:

- expose the current end-to-end system processing state across non-agent stages, filtering, and agent feedback

This is the most important operational contract in the app.

It should contain three major cards:

1. `Daily Data Fetch`
2. `Filtering`
3. `Agent Feedback`

##### D1. Daily Data Fetch

Expected rows:

- Price Fetch
- Technical Analysis
- Action Summary
- Fundamentals

Expected displayed data per row when available:

- resolved stage status
- succeeded / total counts
- failure counts where relevant
- latest applicable layer date when it differs from the shared patch date
- running pill and current step when pipeline is active

Sources:

- `/api/trading/eod/freshness`
- `/api/trading/eod/pipeline/status`
- `/api/trading/disclosures/dart/fundamentals/daily/inspect`
- `/api/trading/market/status`

Rules:

- visible page header may keep `today.trade_date`
- stage resolution must respect resolved pipeline market date when backend reports an older latest completed run
- a delayed fetch must not masquerade as `running`
- if fundamentals latest run is failed or partial, a review / dialog path should expose error context instead of hiding the problem
- process monitor should show the shared patch date once, not redundantly on every row when identical

##### D2. Filtering

Expected sections:

- Piotroski
- KIS Risk
- Final filtered symbols

Sources:

- `/api/trading/eod/piotroski-filter-results`
- `/api/trading/eod/market-risk-filters`
- `/api/trading/agent-context/feedback/progress` for final requested universe context when available

Expected displayed data:

- per-filter status
- filtered / passed counts
- requested market date
- resolved market date when fallback occurs
- note when backend served older stored results
- final filtered symbol count

Rules:

- same-date refreshes should keep visible data across reloads
- delayed API responses should map to `pending` or `waiting`, not active backend `running`
- `More` from Piotroski should open the full Piotroski pass list with the same effective date basis

##### D3. Agent Feedback

Expected role rows:

- EOD summarizer
- Technical summarizer
- Fundamental summarizer
- signal-decider

Source:

- `/api/trading/agent-context/feedback/progress`

Expected displayed data:

- row status per role
- running role highlight when live cycle is active
- requested / completed / error counts per role when persisted counts exist
- compact progress bars
- active current role when live
- progress percent / totals while running

Rules:

- each role must preserve independent counts and progress
- missing role detail must not be silently converted into false completion
- if progress data is partial, UI should remain conservative and explicit

#### E. Scoring section

Purpose:

- show non-agent scoring progress separately from filtering and agent-feedback

Current contract:

- separate card below Filtering
- intended to read future pipeline stages such as unified value / quality / momentum scoring

Expected behavior now:

- if real scoring stage data is not yet integrated, the card must show clear pending / unavailable states rather than `needs review` everywhere or pretending completion
- each scoring family should be independently rendered

#### F. Signal-decider preview card

Purpose:

- quick inspection entry into signal-decider decision outputs

Sources:

- `/api/trading/agent-context/feedback?agent_name=signal-decider`
- `/api/trading/agent-context/feedback/progress`

Expected displayed data:

- market date
- result count
- action mix
- preview rows with symbol/company, action, thesis, conviction/confidence, stop, target, captured time

Rules:

- this is decision support only
- no order placement behavior
- if verdict/outcome review fields are absent, decision data like thesis / target / stop must still show
- missing review verdict/outcome must be shown as pending review data, not as a synthetic unknown verdict

---

## 5.3 `/dashboard/piotroski-filter`

Purpose:

- show the full pass-list workspace for Piotroski filtering

Sources:

- `/api/trading/eod/piotroski-filter-results`
- `/api/trading/quotes/{symbol}`
- `/api/trading/symbols/search`

Expected behavior:

- list only the resolved dataset for the chosen/effective market date
- show pass state and Piotroski score per symbol
- allow navigation into symbol detail
- preserve effective-date / fallback context from the dashboard
- include a clear back path to dashboard

Expected displayed data:

- symbol
- company name when available
- Piotroski score
- pass/fail status
- quote price / change where quote data is available

Rules:

- rows must not pretend intraday/live values if only EOD context exists
- missing quote enrichment should not block the table

---

## 5.4 `/dashboard/signal-decider-feedback`

Purpose:

- full detail inspection surface for signal-decider outputs

Sources:

- `/api/trading/eod/freshness`
- `/api/trading/agent-context/feedback?agent_name=signal-decider&market_date=...`
- `/api/trading/agent-context/feedback/progress`

Expected behavior:

- date-based loading
- filters for action / available verdict / policy metadata only when such fields truly exist
- search and sort across returned decision rows
- detail dialog or expanded inspection for per-row reasoning

Expected displayed row data where present:

- symbol
- company
- preferred action / next-day-open action
- confidence / conviction
- thesis summary
- risk flags
- stop-loss price
- target price
- policy version
- verdict / quality evaluation
- realized outcome horizons
- run id
- timestamps

Rules:

- if review/evaluation fields do not exist, the page must still show stored decision fields instead of degrading the entire row to unknown
- decision data and review/result data must be visually separated so pending review data cannot be confused with the stored decision
- no synthetic realized outcomes from unrelated market data
- no execution actions

---

## 5.5 `/dashboard/symbol/[symbol]` Symbol detail overview

Purpose:

- primary investigation surface for one symbol

Primary sources:

- `/api/trading/quotes/{symbol}`
- `/api/trading/market/status`
- `/api/trading/symbols/search`
- `/api/trading/symbols/{symbol}/price-bars`
- `/api/trading/agent-context/symbol-day`
- `/api/trading/eod/piotroski-filter-results`
- factor inspect routes
- `/api/trading/eod/technical-snapshots`
- `/api/trading/eod/action-summaries`
- `/api/trading/eod/freshness`
- `/api/trading/disclosures/dart/fundamentals/history`

### Required sections

#### A. Hero

Expected displayed data:

- symbol
- company name
- market
- current/last known price
- absolute and percentage change
- quote freshness / provenance
- market state
- latest disclosure summary
- Piotroski pass/fail summary
- tracked/favorite state

Rules:

- `available: false` is unavailable, not zero price
- preserve source/provenance semantics
- favorite / tracked star should update tracked-symbol persistence via backend write route only

#### B. Historical candlestick chart

Expected data:

- trade date
- OHLC
- volume
- turnover
- focus-candle details on interaction

Rules:

- historical chart, not fake realtime tape
- symbol quote context may augment freshness but must not rewrite the bar history

#### C. Factor Snapshot

Sources:

- momentum factors
- low-risk factors
- beta factors
- value factors
- advanced-value factors

Expected behavior:

- each factor family renders independently
- unavailable or failed factor families should remain isolated
- reserved composite-summary slot remains in layout for future aggregate scoring

Expected displayed data when available:

- momentum score/rank/eligibility
- low-risk status / percentile signals
- beta factor context
- value score fields
- advanced-value component fields
- unified value fields when backend provides them
- quality score fields when backend provides them

Rules:

- unified value should become the primary valuation display when present
- quality should appear as subordinate structured detail under value when present
- do not require raw JSON reading to understand factor availability

#### D. Action Summary

Expected displayed data:

- action label
- signal score
- confidence tier
- risk tier
- trigger / support / resistance context
- reasons
- summary payload evidence

Rules:

- use dedicated endpoint when available, fallback to symbol-day aggregate only when necessary
- do not invent unsupported multi-day history

#### E. Technical Analysis

Expected displayed data:

- trend state
- MA alignment
- breakout / breakdown flags
- return_5d
- return_20d
- volume ratio
- ATR
- ATR percent
- payload evidence

Rules:

- unsupported indicators like RSI/MACD/ADX must not be faked

#### F. Fundamentals History

Expected displayed data:

- filing date / label / period
- statement division
- structured highlight metrics
- latest fundamentals summary if available

Rules:

- missing metrics render as unavailable / `needs review`
- filing cards should remain useful even with incomplete highlight extraction

#### G. Disclosures

Expected displayed data:

- recent disclosure count
- report name
- receipt date
- filing category
- fundamentals capture status
- receipt number

Rules:

- empty state should explicitly indicate no disclosure found
- report detail route should preserve symbol context

#### H. System Freshness

Expected displayed data:

- layer-specific freshness for price, technical, action, fundamentals, disclosures as available
- latest known dates
- quote provenance tie-ins where relevant

Rules:

- do not collapse all freshness into one generic label

#### I. Error rail

Purpose:

- expose section-level loading/fetch errors without blanking the whole symbol page

Expected behavior:

- quote, metadata, history, context, and fundamentals errors should remain attributable

---

## 5.6 Symbol deep-link routes

These are focused detail surfaces derived from the main symbol-detail stack.

Routes:

- `/dashboard/symbol/[symbol]/action-summary`
- `/dashboard/symbol/[symbol]/technical-analysis`
- `/dashboard/symbol/[symbol]/fundamentals-history`
- `/dashboard/symbol/[symbol]/disclosure-coverage`
- `/dashboard/symbol/[symbol]/disclosure-coverage/[receiptNo]`
- `/dashboard/symbol/[symbol]/system-freshness`

Expected behavior:

- use the same underlying data truth as the overview page
- present one concern in more depth without inventing new backend semantics
- preserve navigation back to the symbol overview
- remain read-only

---

## 5.7 `/calendar` Signal review calendar

Purpose:

- provide a calendar-style decision review surface for signal-decider history

Current source model:

- generic signal-decider feedback rows probed by visible dates
- progress endpoint as best-effort overlay

Expected behavior:

- month navigation
- date cells showing decision counts and action mix when stored rows exist
- selected-date summary
- decision table for the selected date
- decision detail view / dialog

Expected displayed data where available:

- date-level total decisions
- buy / wait / reject mix
- reviewed / partial / stored / unavailable state
- target / stop
- D+1 / D+3 / D+5 outcome summaries if stored
- review insight headline / conclusion if stored
- thesis, risks, policy version, captured timestamp

Rules:

- must not invent month aggregates beyond probed data
- must label missing review/path fields as unavailable instead of back-solving from unrelated quotes
- review-only surface; no execution actions

---

## 5.8 `/search`

Purpose:

- universal symbol discovery and fast navigation surface

Sources:

- `/api/trading/symbols/search`
- `/api/trading/quotes/{symbol}`
- `/api/trading/symbols/favorites`
- `/api/trading/scanner/tracked-symbols`
- `/api/trading/scanner/realtime-trending`
- `/api/trading/scanner/trending-stocks`

Required major sections:

#### A. Terminal search shell

Expected behavior:

- central search input
- inline autocomplete below the input while query is non-empty
- route-level chrome consistent with mobile/desktop shell

Expected displayed data:

- symbol
- Korean company name
- market
- result count

#### B. Quick access

Expected behavior:

- show favorite symbols
- allow add flow through `+` dialog backed by symbol search
- persist tracked-symbol changes through backend write route

Expected displayed data:

- favorites / tracked symbol tiles
- selected search dialog results

#### C. Trending symbols

Expected behavior:

- support KIS realtime and stored 1D / 5D / 20D tabs
- initial small list with incremental `More`

Expected displayed data:

- symbol
- display name
- market
- rank
- selected trend metric / change percent
- source label

#### D. Desktop results table

Expected behavior:

- search results list on desktop
- selected row gets quote enrichment

Rules:

- market cap, coverage tier, or unsupported metadata should stay unavailable unless backend provides them

---

## 5.9 `/my-symbols`

Purpose:

- tracked and favorite symbol workspace focused on the mobile-toolbar flow

Known sources from current implementation tags:

- `/api/trading/market/status`
- `/api/trading/symbols/favorites`
- `/api/trading/quotes/tracked`

Expected behavior:

- summarize tracked universe with current market/session context
- show favorite / tracked lists in a way that supports quick jumping into symbol detail or search
- remain consistent with the mobile shell and symbol-centric workflow

Expected displayed data:

- tracked or favorite symbol identity
- quote snapshots where available
- session / market context where relevant

Rules:

- treat unavailable quote rows as unavailable, not zero
- this is a navigation and inspection workspace, not a trading blotter

---

## 5.10 `/portfolio`

Purpose:

- read-only portfolio and account state inspection

Source:

- `/api/trading/portfolio/summary`

Expected page-level states:

- loading
- endpoint pending
- upstream not configured
- upstream unavailable
- invalid response
- connected but empty
- stale sync
- partial data
- healthy synced

Required sections:

#### A. Hero summary

Expected displayed data:

- as-of timestamp
- source
- sync status
- top-level notices
- aggregate totals where safe

Rules:

- do not merge mixed currencies into fake single totals
- aggregate same-currency totals only when valid

#### B. Account cards

Expected displayed data per account:

- label
- broker
- account type
- status
- base currency
- last synced at
- money summary fields

#### C. Holdings

Expected displayed data:

- symbol
- name
- market
- quantity
- average price
- last price
- market value
- day pnl
- unrealized pnl
- unrealized pnl percent
- allocation percent

#### D. Allocation

Expected displayed data:

- allocation buckets with value and/or percent

#### E. Recent activity

Expected displayed data:

- order/execution activity summary rows
- side
- status
- quantity / filled quantity
- average fill price
- timestamps

Rules:

- partial missing subsections must not blank the whole page
- read-only only; no order placement

---

## 5.11 `/markets`

Purpose:

- higher-level market intelligence landing space

Current composition:

- `MarketsOverview` inside `AppShell`

Expected behavior:

- act as a summarized market overview surface
- provide route introduction, spotlight content, and links deeper into factor/screening workflows

Expected displayed data:

- market overview copy
- breadth/overview sections
- spotlight modules

Rules:

- any live data surfaced here should remain consistent with backend-truth and not contradict the dedicated dashboard market-condition contract

---

## 5.12 `/markets/factors`

Purpose:

- factor-family ranking and screening workspace

Sources:

- `/api/trading/eod/freshness`
- `/api/trading/eod/momentum-factors`
- `/api/trading/eod/low-risk-factors`
- `/api/trading/eod/beta-factors`
- `/api/trading/eod/value-factors`
- `/api/trading/eod/advanced-value-factors`

Expected behavior:

- switch among factor families
- respect chosen or latest resolved market date
- support eligibility / caution / audit grouping
- navigate naturally into symbol detail
- preserve a reserved composite slot for future combined scoring

Expected displayed data:

- family-specific rankings
- eligibility status
- factor score and percentile fields where supported
- unified value fields when present
- quality fields when present under the value family

Rules:

- frontend should not invent factor math
- invalid / caution rows should be explainable, not silently hidden

---

## 5.13 `/bots`

Purpose:

- automation management / operational playbook space

Current composition:

- `BotsOverview` inside `AppShell`

Expected behavior:

- show automation fleet / ops snapshot / playbooks as management surfaces
- if actions are represented visually, they must not imply approved live-trading control unless the backend workflow is explicit and approved

---

## 5.14 Alternate / legacy operator routes

Routes:

- `/scanner-tracker`
- `/kis-dashboard`
- `/real-dashboard`

Expected status:

- these are not the primary user journey
- they may still exist for legacy, transitional, or experimental operator use
- they must obey the same truthfulness rules for unavailable quotes and fallback provenance

---

## 6. BFF and API surface rules

### 6.1 General rules

- BFF routes must protect server-only configuration and bearer-token usage
- frontend route code and `src/types/trading-api.ts` should stay aligned
- docs must stay aligned with API contract evolution

### 6.2 Important BFF categories

#### Market / dashboard

- `/api/trading/market/status`
- `/api/trading/market/snapshot`
- `/api/trading/quotes/tracked`
- `/api/trading/quotes/{symbol}`
- `/api/trading/eod/freshness`
- `/api/trading/eod/pipeline/status`
- `/api/trading/eod/piotroski-filter-results`
- `/api/trading/eod/market-risk-filters`
- `/api/trading/disclosures/dart/fundamentals/daily/inspect`
- `/api/trading/agent-context/feedback/progress`
- `/api/trading/agent-context/feedback`

#### Symbol detail / research

- `/api/trading/symbols/search`
- `/api/trading/symbols/{symbol}/price-bars`
- `/api/trading/agent-context/symbol-day`
- `/api/trading/eod/technical-snapshots`
- `/api/trading/eod/action-summaries`
- `/api/trading/disclosures/dart/fundamentals/history`
- `/api/trading/disclosures/dart/filings/document`
- factor inspect endpoints

#### Tracking / favorites / scanner

- `/api/trading/symbols/favorites`
- `/api/trading/scanner/tracked-symbols`
- `/api/trading/scanner/realtime-trending`
- `/api/trading/scanner/trending-stocks`

#### Portfolio

- `/api/trading/portfolio/summary`

### 6.3 Control endpoint rule

A control path may exist for explicit operational actions such as stop/kill flow through core control, but such actions must remain:

- intentional
- authenticated through backend/BFF
- visibly separate from regular read-only inspection UI

---

## 7. State-handling specification

### 7.1 Missing data

If a subsection payload is missing:

- show section-level unavailable or pending state
- keep sibling sections alive if their data exists

### 7.2 Partial data

If a payload is structurally present but incomplete:

- render the available subset
- explicitly mark missing fields
- do not downgrade all content to unknown if core decision data still exists

### 7.3 Stale / fallback data

If backend explicitly reports fallback or resolved older data:

- preserve requested vs resolved date context
- show effective date where needed
- never silently present older data as if it were same-session live truth

### 7.4 Loading vs running

Critical rule:

- frontend fetch latency is not backend execution

Therefore:

- `loading` network state should not automatically render as operational `running`
- use `pending` / `waiting` when a result is expected but not yet loaded
- use `running` only when backend stage/progress evidence indicates actual live work

### 7.5 Error isolation

- errors should be attributable to the smallest meaningful section
- one API failure should not force unrelated healthy cards into generic failure copy

---

## 8. Data display expectations by domain

### 8.1 Market domain

Should show:

- market state
- trading-day context
- indices and FX only from dedicated market snapshot when required
- investor flow only from dedicated market snapshot when present

Should not show:

- inferred market condition from filter results

### 8.2 Pipeline / operations domain

Should show:

- stage progress
- counts
- current step/activity for running stages
- latest effective dates
- fallback or stale conditions
- review dialog for failed fundamentals runs

### 8.3 Filtering / scoring domain

Should show:

- separate filtering vs scoring concepts
- family-specific counts and states
- independent scoring-family rows

Should not show:

- scoring folded ambiguously into filtering
- generic unknown badges when a more precise pending/unavailable label is possible

### 8.4 Signal-decider domain

Should show when stored:

- decision action
- thesis
- risk framing
- target and stop
- confidence/conviction
- policy metadata
- review / realized outcome metadata when truly persisted

Should not show:

- synthesized verdicts/outcomes from unrelated sources

### 8.5 Symbol research domain

Should show:

- quote and provenance
- historical bars
- factor families
- technical summary
- action summary
- DART-based fundamentals/disclosures
- freshness by layer

### 8.6 Portfolio domain

Should show:

- sync health
- account summaries
- holdings
- allocation
- recent activity
- notices

Should not show:

- fake aggregate totals across incompatible currencies
- execution controls

---

## 9. Localization and copy rules

- app supports English and Korean locale switching
- shell-level locale control must remain visible in intended responsive contexts
- status copy should remain concise and operational
- fallback copy must be explicit, not vague

Preferred principle:

- if the system is uncertain, say exactly what is uncertain

---

## 10. QA and verification expectations

This document is meant to support future automated and manual verification.
A good QA pass should confirm:

- each route loads with the correct shell
- each section maps to the documented backend dependencies
- missing fields degrade honestly
- same-date refreshes do not blank already-known results unnecessarily
- mobile and desktop preserve the same semantic truth
- detail routes preserve navigation context
- no surface invents trading actions or unsupported data

### Recommended QA focus areas

1. dashboard first-load vs refresh behavior
2. pipeline-running vs slow-network distinction
3. market snapshot unavailable recovery
4. signal-decider row rendering when review fields are absent but thesis/target/stop exist
5. fallback-date handling for filtering/scoring pages
6. symbol-detail family-by-family factor availability
7. portfolio multi-state rendering
8. search quick-add and tracked-symbol persistence flow
9. calendar month/date truthfulness with sparse stored feedback
10. responsive shell consistency across dashboard, search, portfolio, and my-symbols

---

## 11. Non-goals and explicit constraints

This document does not authorize:

- direct broker calls from the browser
- live order placement from existing read-only surfaces
- implicit conversion of incomplete data into confident judgments
- broad UI rewrites that break the existing shared shell semantics without replacement guidance

---

## 12. Relationship to other docs

Use this document for product intent.
Use the following for implementation-level detail:

- `docs/API_CONTRACT.md` for request/response expectations and evolving backend contract notes
- `docs/UI_API_SURFACE_MAP.md` for exact route-to-API field mapping
- `docs/MOBILE_COMPONENT_SPEC.md` for mobile component/tag expectations
- `docs/DESKTOP_COMPONENT_SPEC.md` for desktop composition expectations
- `src/types/trading-api.ts` for DTO-level frontend typing

If these docs disagree:

1. preserve backend-truth and no-invention rules first
2. prefer this document for product behavior intent
3. update the lower-level doc that drifted
