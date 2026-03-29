# Trading Web

Next.js app-router prototype for a trading dashboard with a reusable shell, route-based information architecture, and shared UI primitives.

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.
The root route redirects to `/dashboard`.

## Routes

- `/dashboard` — main trading command surface
- `/markets` — placeholder market overview route for future screeners and breadth data
- `/bots` — placeholder automation route for bot states, logs, and controls

## Project Structure

```text
src/
  app/
    dashboard/page.tsx
    markets/page.tsx
    bots/page.tsx
    page.tsx
  components/
    dashboard/
    layout/
    navigation/
    ui/
  data/
    trading-dashboard.ts
  features/
    dashboard/
    markets/
    bots/
  lib/
    format.ts
    utils.ts
```

## Notes

- Shared demo data currently lives in `src/data/trading-dashboard.ts`.
- Shared layout/navigation lives in `src/components/layout` and `src/components/navigation`.
- Reusable UI elements live in `src/components/ui`.
- The structure is intended to make future real-data injection straightforward without keeping the whole dashboard in one page file.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```
