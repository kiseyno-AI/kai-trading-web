# AGENTS.md

## Purpose
This repository is part of the KAI trading system.

## Working Rules
- Read this file before making changes.
- Prefer simple, practical architecture over premature complexity.
- Keep modules loosely coupled and clearly named.
- Update docs when structure or design changes.
- Do not add live-trading behavior without explicit approval.
- Commit clear, scoped changes.
- After UI or routing changes, run `npm run test:e2e` (Playwright); see `.codex/skills/playwright-iterate/SKILL.md`.
- For new UI primitives, use shadcn/ui (`components.json`, `npx shadcn@latest add …`); see [shadcn Skills](https://ui.shadcn.com/docs/skills) and `.codex/skills/shadcn-ui/SKILL.md`.

## Files to Read First
- AGENTS.md
- RULES.md
- ARCHITECTURE.md
- TASKS.md

