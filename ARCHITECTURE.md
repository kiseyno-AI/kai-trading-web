# ARCHITECTURE.md

## Current Direction
- Next.js + TypeScript frontend
- App-router structure with route-specific feature folders
- Shared application shell for navigation, search, and responsive layout
- Sovereign-style workstation theme primitives drive the shared shell, dashboard, and search surfaces
- Connect to backend API, never directly to brokers
- Focus on positions, orders, fills, PnL, health, and admin views
- UI must support future KR/US market workflows

## Current Route Map
- `/dashboard` — primary command surface
- `/markets` — market intelligence and screening space
- `/bots` — automation management space

## Folder Conventions
- `src/app/*` owns route entrypoints
- `src/features/*` owns page-level composition for each domain
- `src/components/ui/*` owns reusable primitives (shadcn/ui via `components.json`; add with `npx shadcn@latest add …`)
- `src/components/navigation/*` owns shared nav/search/mobile shell elements
- `src/components/dashboard/*` owns dashboard-specific presentational parts
- `src/data/*` owns mock/demo data and view contracts until API adapters are added
- `src/lib/*` owns generic helpers and formatting utilities

## Core Areas
- app router pages
- reusable UI components
- charting and data visualization
- API integration layer
- design system evolution

## Tooling and quality
- **Codex:** Project instructions in [`.codex/config.toml`](./.codex/config.toml), skills in [`.codex/skills/`](./.codex/skills/), optional subagents in [`.codex/agents/`](./.codex/agents/).
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) runs lint, production build, and Playwright e2e tests.

See [AGENTS.md](./AGENTS.md) for how humans and Codex should use this repo.
