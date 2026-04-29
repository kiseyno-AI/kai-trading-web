# Responsive dashboard layout rules

Read this file when the task mentions responsive layout, breakpoints, whitespace, card density, dashboard rearrangement, mobile/desktop parity, or “looks wrong at different resolutions”.

## Core rule

Use **CSS Grid for the dashboard shell** and **Flexbox inside a card/component**.

- Grid is the default for two-dimensional dashboard placement (rows + columns).
- Flex is the default for one-dimensional alignment inside cards, headers, toolbars, and stat rows.

## Layout patterns to prefer

### 1) Auto-fitting card grids

Use auto-fitting tracks before adding many breakpoint-specific column counts.

```tsx
<div className="grid grid-cols-[repeat(auto-fit,minmax(min(22rem,100%),1fr))] gap-4 xl:gap-5">
```

Use this for card collections where cards should fill width cleanly without awkward leftover gaps.

### 2) Explicit spans for featured cards

For hero/process/market cards, keep the parent grid auto-fitting but give important cards controlled spans.

```tsx
<div className="grid grid-cols-[repeat(auto-fit,minmax(min(20rem,100%),1fr))] gap-4">
  <section className="lg:col-span-2 xl:col-span-2">…</section>
  <section>…</section>
  <section>…</section>
</div>
```

Do not hardcode wide spans that leave dead whitespace when sibling cards are absent.

### 3) Container queries for component-level reflow

When a component changes shape based on its own width, use container queries instead of viewport-only media queries.

```css
.cardCluster {
  container-type: inline-size;
}

@container (max-width: 34rem) {
  .metricRow {
    grid-template-columns: 1fr;
  }
}
```

Use this for cards that move from side-by-side stats to stacked stats when their parent column narrows.

### 4) Content-safe sizing

Avoid fixed card heights unless the visual design truly requires them.

Prefer:
- `min-w-0` on shrinking children
- `overflow-hidden` only when intentional
- `line-clamp-*` for summaries
- `grid-auto-rows: minmax(...)` or content-driven height over hardcoded pixel heights

### 5) Gap discipline

Use one spacing scale per region.

- outer dashboard sections: `gap-4` or `gap-5`
- dense internal stat grids: `gap-3` or `gap-4`
- avoid mixed random `gap-2 gap-6 gap-3` patterns in sibling groups unless visually justified

### 6) Stable empty/missing states

A partial API payload must not collapse surrounding layout.

Missing data should keep card structure intact with:
- stable labels
- placeholder values
- preserved card height only when necessary for scanability

Do not remove whole rows if that causes adjacent cards to jump unpredictably.

### 7) Dense placement with caution

`grid-auto-flow: dense` can visually fill holes, but use it only when:
- DOM order still matches reading order expectations
- focus/navigation order will not become confusing

Default to predictable source order first.

## Tailwind-first heuristics

- Prefer `grid` + `gap-*` over nested spacer divs.
- Prefer `auto-fit/minmax` over long breakpoint ladders when card widths are flexible.
- Prefer `items-start` for mixed-height dashboard cards.
- Use `self-stretch` / `h-full` only when the neighboring card heights should visually align.
- On text-heavy cards, set `min-w-0` on the content column before debugging truncation.

## Verification widths

At minimum, verify:
- 390px mobile
- 768px tablet
- 1280px laptop
- 1536px or wider desktop

For dashboard-heavy changes, check at least one “awkward middle” width too (around 1024px) because that is where dead whitespace and broken spans usually appear.
