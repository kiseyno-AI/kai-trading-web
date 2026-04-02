---
name: codex-workflow
description: Default Codex working style for this Next.js repo—stack conventions, quality loop, and shadcn usage. Use for general implementation tasks, refactors, and when the user opens Codex in this project without a narrower skill.
---

# Codex workflow (trading-web)

## Before larger edits

1. Read `AGENTS.md`, `RULES.md`, and `ARCHITECTURE.md`.
2. Trust the project in Codex so `.codex/config.toml` and skills load ([Codex config reference](https://developers.openai.com/codex/config-reference)).

## Stack conventions

- **Next.js App Router:** Routes in `src/app`; page composition in `src/features`; shared UI in `src/components`. Default to Server Components; add `"use client"` only for hooks, events, or browser APIs.
- **Tailwind:** Prefer `flex` / `grid` with `gap-*` over `space-x-*` / `space-y-*`. Use `cn()` from `@/lib/utils` for conditional classes.
- **Data & secrets:** No broker calls from the browser. Server-only env: `TRADING_API_UPSTREAM_*`, `TRADING_API_UPSTREAM_BEARER_TOKEN`. Client base URL only via `NEXT_PUBLIC_TRADING_API_BASE_URL` (never secrets there).
- **UI:** Prefer shadcn/ui via CLI (`npx shadcn@latest add …`, `info`, `docs`). See `.codex/skills/shadcn-ui`. Existing desk `Button` variants: `glass`, `pill`, `primary`.

## Quality loop (run in terminal from repo root)

1. `npm run lint` — fix ESLint issues before stopping; do not silence rules without cause.
2. `npm run build` — when types or app build might be affected.
3. For user-facing UI changes, verify in this order: local branch/build preview first, direct browser inspection on that local preview second, then deployed/production verification last.
4. When that UI is responsive or plausibly used on mobile, include at least one mobile viewport in the direct browser inspection step.
5. `npm run test:e2e` — after UI or routing changes as part of that local-first verification loop (see `.codex/skills/playwright-iterate`).
6. For responsive or mobile-sensitive UI changes, verify the affected flow with Playwright at a mobile viewport as well as desktop. Desktop-only inspection is insufficient.

For TDD-style work: add or extend tests first when the user asks, then implement until green.

## When APIs are unclear

Consult current Next.js / React / Tailwind documentation (fetch or web search) instead of guessing—version-sensitive behavior matters.

## Subagents

Use `.codex/agents/*.toml` when the task fits a specialist (`trading_api_specialist`, `playwright_verifier`, etc.).
