# KAI Trading Design Contract

This contract adapts the Coinbase-inspired getdesign.md direction for KAI Trading. It is not an official Coinbase design system. It is a practical source of truth for building a coherent financial terminal with a clean blue identity, restrained surfaces, and trustworthy information hierarchy.

## Product Character

KAI Trading should feel like a modern financial workstation for retail and institutional users who need dense data without visual noise.

- Lead with clarity, trust, and hierarchy.
- Use blue as the primary brand/accent signal.
- Keep surfaces quiet, rectangular, and precise.
- Make data tables, metric tiles, process monitors, and status panels easy to scan.
- Avoid decorative gradients, mixed accent families, oversized rounded chrome, and flashy motion.
- Preserve mobile usefulness: primary actions must remain reachable, labels must fit, and dense rows must collapse predictably.

## Color System

Use a dark terminal canvas with blue-led accents and neutral graphite surfaces.

| Token | Hex / Role |
| --- | --- |
| Canvas | `#050B14` app background |
| Canvas raised | `#08111F` shell and rail |
| Surface low | `#0B1626` base panels |
| Surface | `#101C2E` cards, drawers, menus |
| Surface high | `#162337` elevated rows and active panels |
| Border | `rgba(134, 162, 194, 0.18)` default outline |
| Border strong | `rgba(88, 139, 255, 0.36)` active/focus outline |
| Text strong | `#F4F8FF` primary text |
| Text | `#D6E2F2` body text |
| Text muted | `#8EA4BF` supporting text |
| Text faint | `#647895` metadata |
| Brand blue | `#0052FF` primary action/accent |
| Brand blue hover | `#0A66FF` hover/selected |
| Blue soft | `rgba(0, 82, 255, 0.16)` selection fill |
| Positive | `#16C784` price/status positive |
| Negative | `#EA3943` price/status negative |
| Warning | `#F5B84B` degraded/pending |
| Info | `#4AA8FF` informational state |

Positive/negative/warning/info are semantic, not decorative. Blue remains the dominant accent.

## Typography

- Primary UI font: Inter.
- Heading font: Manrope.
- Numeric values: tabular numerals.
- Keep letter spacing at `0` for body, headings, and controls. Use modest uppercase metadata only where it improves scanning.
- Headings inside panels are compact. Hero-scale type is reserved for top-level price or route context.

Recommended scale:

| Use | Size / Weight |
| --- | --- |
| Route title | 24-32px, 800 |
| Section title | 17-22px, 750-800 |
| Card title | 14-16px, 700 |
| Body | 13-15px, 400-550 |
| Metadata / labels | 11-12px, 700 |
| Large numeric | 32-48px, 800 |

## Layout

- Desktop shell uses a stable left rail plus sticky top status/search bar.
- Mobile shell uses a compact fixed header and bottom navigation with 44px minimum tap targets.
- Page gutters: 24-32px desktop, 14-18px mobile.
- Panel radius: 8px default, 10-12px for major surfaces, full pill only for badges/toggles.
- Prefer dense grids and rows over decorative cards.
- Do not nest visual cards inside visual cards unless the inner item is a repeated row/tile.
- Keep chart and table containers unambiguous: borders, header row, and consistent metadata.

## Components

### Shell and Navigation

- Brand mark: blue square/compact mark, no gradient orb treatment.
- Active navigation: blue left bar or blue-tinted row, not purple/green glow.
- Topbar: status, route title, search, language, and notification controls in one restrained surface.
- Mobile bottom nav: icon-first, label second, blue active state, no floating neon glow.

### Panels and Cards

- `.glass` and page panels should render as restrained graphite/blue surfaces with a thin border and subtle shadow.
- Primary information goes in the panel header; metadata and status badges sit on the right.
- Repeated data rows use `surface-high` only on hover/active.

### Buttons, Inputs, Toggles

- Primary buttons are Coinbase blue with white text.
- Secondary buttons are transparent/graphite with a blue border on hover.
- Inputs use dark fill, visible border, and blue focus ring.
- Segmented controls and tabs use compact rectangular pills with clear selected state.

### Status, Empty, Loading, Error

- Use one shared state pattern for empty/loading/error/degraded panels.
- Loading may use a small spinner, skeleton line, or blue progress shimmer.
- Error/degraded states use warning/negative semantics sparingly and always include concise recovery context.
- Empty states should be quiet and useful, not marketing copy.

### Data Density

- Use tabular numerals and align money/percent values consistently.
- Preserve chart-adjacent metadata and orderbook rows.
- Status badges should be short: Ready, Live, Pending, Degraded, Offline, Synced.
- For mobile, stack secondary metrics under identity rows instead of shrinking text below legibility.

## Motion

- Use fast, subtle transitions: 120-180ms for hover/focus/selected states.
- Avoid flashy page-level animation, bouncy easing, continuous decorative glow, and large motion.
- Respect reduced-motion preferences.

## Accessibility

- Maintain visible focus states on all interactive controls.
- Use semantic roles for status, alert, tablist, and dialog patterns.
- Preserve accessible names on icon-only controls.
- Do not rely on color alone for market direction or process state.
- Text must fit its container at mobile widths.

## Implementation Rules

- Prefer shared primitives and global composition classes over page-local one-off styling.
- New UI work must follow this contract before adding bespoke CSS.
- When changing API shapes or route behavior, update `docs/API_CONTRACT.md` and `src/types/trading-api.ts`. Pure presentation work should not alter API contracts.
- Do not add live-trading controls or broker calls from the browser.
- Before claiming visual work complete, capture desktop and mobile screenshots for Dashboard, Markets, Portfolio, Search, and Symbol detail when local browser verification is available.
