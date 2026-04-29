# Reusable app chrome strategy

Read this file when the task mentions top bar, bottom nav, floating toolbar, page chrome, full-screen page layout, mobile shell, or duplicated header/footer navigation.

## Core rule

Do **not** build page-local copies of floating top/bottom toolbar UI when the structure is the same.

Prefer a **shared application-shell primitive** with slots/config over per-page bespoke markup.

In this repo, inspect these before adding or changing chrome:
- `src/components/mobile/mobile-app-chrome.tsx`
- `src/components/navigation/topbar.tsx`
- `src/components/layout/app-shell.tsx`
- `src/lib/mobile-toolbar-data.ts`

## Preferred reuse strategy

### 1) Shared shell first

If multiple full-screen pages need the same outer chrome, extend the shared shell instead of cloning markup.

Use one of these patterns:
- **slot-based API** for variable regions
- **compound/section components** when the same chrome has repeated internal pieces
- **config-driven nav/action arrays** when only labels, hrefs, icons, or badges differ

### 2) Slots over prop explosion

When the layout stays the same but content differs, prefer named regions like:
- `header`
- `headerActions`
- `bottomAccessory`
- `status`
- `pageMeta`

Avoid adding long prop lists like `showFoo`, `showBar`, `altBackButtonLabel`, `mobileOnlySubtitle`, `secondaryHeaderIcon`, etc. That is usually a sign the shell should expose composition slots instead.

### 3) Data/config separate from presentation

Keep these concerns separate:
- **structure**: shell and toolbar layout components
- **route/view config**: nav items, active tab, labels, hrefs, badges
- **warming/prefetch logic**: route-specific data preloading

If a page only changes toolbar data, do not fork the shell component.

### 4) One nav model, many placements

Desktop rail, topbar shortcuts, and mobile bottom nav should reuse the same semantic route model where practical.

Prefer shared route descriptors like:
```ts
{
  key: "dashboard",
  label: "Dashboard",
  href: "/dashboard",
  icon: DashboardIcon,
}
```

Then derive desktop/mobile renderers from that model instead of hand-maintaining multiple copies.

### 5) Variants, not forks

If some pages need a slightly different chrome, add a small variant API:
- `compact`
- `showMetaRow`
- `showLocaleSwitch`
- `bottomAccessory`

Do not copy the whole shell just to hide or reorder one region.

### 6) Shared floating behavior

Safe-area padding, sticky/fixed positioning, blur, elevation, and bottom spacing tokens should live in shared chrome CSS/modules rather than per-page styles.

If multiple pages need the same floating behavior, centralize it.

### 7) Reuse audit before new UI

Before adding new full-page toolbar markup, search for:
- `MobileAppChrome`
- `Topbar`
- `AppShell`
- `bottomAccessory`
- `topbar`

If a page can fit the existing shell with small extension, extend it there.

## Refactor heuristics for this repo

Good refactor targets include:
- repeated page headers wrapped in `MobileAppChrome`
- duplicated bottom accessory/status strips
- per-page ad hoc nav/action button groups that mirror the same destinations
- route-specific toolbar warming logic that should be keyed by shared view config

## Acceptance criteria

A chrome refactor is better when:
- adding a new full-screen page does **not** require copying a whole top/bottom toolbar
- toolbar structure lives in shared components
- page files mostly provide content/config, not repeated chrome layout markup
- desktop/mobile variants remain visually consistent
- route-specific behavior is added through config or slots rather than shell forks
