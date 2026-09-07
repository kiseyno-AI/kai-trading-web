# Architecture

## System boundary

KAI Trading Web is a Next.js App Router frontend and same-origin BFF. It renders
read models owned by `kai-trading-core`; Core may in turn expose read-only
runtime state originating in `kai-trading-exec`.

```text
Browser -> Next.js /api/trading/* -> kai-trading-core -> read models
```

The browser must never call a broker, exchange, or Exec directly. Web must not
place/cancel orders or start/stop Core or Exec processes. New mutations require
an explicit cross-repository contract and are outside the current product
boundary.

## Navigation and route ownership

`src/lib/app-chrome-routes.ts` is the single primary-navigation registry. Every
viewport and workspace uses the same ordered set:

1. Overview: `/dashboard`
2. Explore: `/search`
3. Review: `/calendar`
4. Portfolio: `/portfolio`

`src/components/mobile/mobile-app-chrome.tsx` owns both the desktop rail and
mobile bottom navigation. Pages provide metadata and content; they do not create
their own global shell.

Specialized routes such as symbol detail, factor screening, crypto visibility,
My Symbols, and feedback review are contextual destinations rather than primary
navigation items. Retired experimental routes redirect at their page entrypoint
so old bookmarks remain safe without maintaining duplicate implementations.

## Data ownership and states

User-visible values must come from a validated BFF response or an explicitly
named deterministic calculation. Presentation code follows these rules:

- select exact normalized symbols only;
- keep requested, resolved, actual, and observed dates distinct;
- represent missing values as unavailable, never as zero or a plausible default;
- distinguish data availability from market-session state;
- preserve last-good data only with visible stale/error provenance;
- do not seed unavailable bootstrap state into shared snapshots;
- keep source and as-of information adjacent to decisions when available.

Live market/quote/runtime/progress reads poll without durable caching. Stored EOD,
factor, fundamentals, and document reads may use the session cache implemented
by `src/lib/trading-api-cache.ts`. Each feature remains responsible for rejecting
wrong-symbol, wrong-date, and invalid upstream payloads before display.

## Code boundaries

- `src/app/*`: route wrappers and BFF handlers.
- `src/components/mobile/*`: canonical responsive application chrome.
- `src/components/navigation/*`: reusable toolbar, language, and route controls.
- `src/features/dashboard/*`: Overview data orchestration and pure display models.
- `src/features/symbol-detail/*`: exact-symbol reads and detail presentation.
- `src/features/portfolio/*`: portfolio/risk state classification and display.
- `src/features/markets/*`: factor and read-only crypto research surfaces.
- `src/lib/*`: route registry, cache, API paths, formatting, and pure domain logic.
- `src/types/*`: upstream DTOs, split by endpoint family where practical.
- `src/i18n/locales/*`: English and Korean product copy.

Route entrypoints should stay thin. Fetch/state orchestration belongs in a feature
hook or client, while selection and display decisions belong in testable pure
functions. Reuse an existing helper before adding an abstraction or dependency.

## UI system

The interface uses the existing CSS variables in `src/app/globals.css`, CSS
modules, React components, Inter for UI/numbers, and Manrope for headings. The
visual hierarchy favors compact cards, clear status tones, tabular numbers, and
progressive disclosure. Status color never replaces a text label.

The current design direction is documented by the Stitch project linked from
the README. Visual changes must still pass responsive overflow, keyboard, and
truthful unavailable/stale-state checks.

## Verification contract

Run the following before merging a production-facing change:

```bash
npm run lint
npm run test:unit
npm run test:regression:display
npx next build --webpack
CI=true npm run test:e2e
```

Route or UI work also requires browser inspection at mobile and desktop widths.
Data-contract work requires focused regressions for mismatched symbols/dates and
unavailable or partial responses.

See [README.md](README.md), [docs/API_CONTRACT.md](docs/API_CONTRACT.md), and
[docs/UI_API_SURFACE_MAP.md](docs/UI_API_SURFACE_MAP.md) for operational details.
