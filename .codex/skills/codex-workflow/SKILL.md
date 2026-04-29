---
name: codex-workflow
description: Default Codex working style for this Next.js repo—stack conventions, quality loop, and shadcn usage. Use for general implementation tasks, refactors, and when the user opens Codex in this project without a narrower skill.
---

# Codex workflow (trading-web)

## Before larger edits

1. Read `AGENTS.md`, `RULES.md`, and `ARCHITECTURE.md`.
2. Trust the project in Codex so `.codex/config.toml` and skills load ([Codex config reference](https://developers.openai.com/codex/config-reference)).
3. Create and switch to a dedicated branch from `main` before starting task work.

## Branch workflow

- After a PR is merged or work is cancelled, delete the created branch locally and on the remote unless there is a specific reason to keep it.
- Before finishing, restore the main workspace checkout to `main`.

## Stack conventions

- **Next.js App Router:** Routes in `src/app`; page composition in `src/features`; shared UI in `src/components`. Default to Server Components; add `"use client"` only for hooks, events, or browser APIs.
- **Tailwind:** Prefer `flex` / `grid` with `gap-*` over `space-x-*` / `space-y-*`. Use `cn()` from `@/lib/utils` for conditional classes.
- **Data & secrets:** No broker calls from the browser. Server-only env: `TRADING_API_UPSTREAM_*`, `TRADING_API_UPSTREAM_BEARER_TOKEN`. Client base URL only via `NEXT_PUBLIC_TRADING_API_BASE_URL` (never secrets there).
- **UI:** Prefer shadcn/ui via CLI (`npx shadcn@latest add …`, `info`, `docs`). See `.codex/skills/shadcn-ui`. Existing desk `Button` variants: `glass`, `pill`, `primary`.

## Responsive dashboard composition

When the task mentions resolution changes, breakpoints, whitespace, card rearrangement, dashboard density, or “looks wrong on some screen sizes”, read `references/responsive-layouts.md` before editing.

Default implementation rules:
- Use **Grid for dashboard/card placement**, **Flexbox inside a component/card**.
- Prefer `repeat(auto-fit, minmax(..., 1fr))` style card grids before adding many breakpoint-only column counts.
- Use **container queries** when a component should reflow based on its own rendered width, not just the viewport.
- Avoid fixed card heights unless the visual contract truly requires them.
- Treat “no awkward dead whitespace across common widths” as a real acceptance criterion for dashboard refactors.

## Quality loop (run in terminal from repo root)

1. `npm run lint` — fix ESLint issues before stopping; do not silence rules without cause.
2. `npm run build` — when types or app build might be affected.
3. For user-facing UI changes, verify in this order: local branch/build preview first, Playwright MCP browser inspection on that local preview second, then deployed/production verification last.
4. When that UI is responsive or plausibly used on mobile, include at least one mobile viewport in the Playwright MCP browser inspection step.
5. `npm run test:e2e` — after UI or routing changes as part of that local-first verification loop (see `.codex/skills/playwright-iterate`).
6. For responsive or mobile-sensitive UI changes, verify the affected flow with Playwright at mobile, tablet, laptop, and wide-desktop widths when the change affects dashboard/card layout. Desktop-only inspection is insufficient.

For TDD-style work: add or extend tests first when the user asks, then implement until green.

## Pull requests

- Build PR bodies as real multiline Markdown. Do not assemble PR text with a literal `"/n"` sequence; use actual newlines via direct multiline text, a heredoc, or a file-based body such as `gh pr create --body-file`.
- Preferred PR body structure for this repo:
  - `Summary`
  - `Why`
  - `Verification`
  - `UI checked`
  - `Screenshots` when practical
  - `Closes #issue` when applicable
- When screenshots are included in a PR body/comment, do not list bare filenames only. Upload or reference real image URLs/attachments and embed them as rendered Markdown images so the screenshots visibly display in GitHub.
- Before considering the PR ready, verify the rendered PR body formatting in GitHub so headings, bullets, spacing, and any screenshot embeds display correctly.

## When APIs are unclear

Consult current Next.js / React / Tailwind documentation (fetch or web search) instead of guessing—version-sensitive behavior matters.

## Subagents

Use `.codex/agents/*.toml` when the task fits a specialist (`trading_api_specialist`, `playwright_verifier`, etc.).
