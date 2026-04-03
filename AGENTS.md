# AGENTS.md

## Purpose
This repository is part of the KAI trading system.

## Working Rules
- Read this file before making changes.
- Before task work, create and switch to a dedicated branch from `main`.
- Prefer simple, practical architecture over premature complexity.
- Keep modules loosely coupled and clearly named.
- Update docs when structure or design changes.
- Do not add live-trading behavior without explicit approval.
- Commit clear, scoped changes.
- After a PR is merged or work is cancelled, delete the created local and remote branch unless there is a specific reason to keep it.
- Before finishing, restore the main workspace checkout to `main`.
- After UI or routing changes, run `npm run test:e2e` (Playwright); see `.codex/skills/playwright-iterate/SKILL.md`.
- For new UI primitives, use shadcn/ui (`components.json`, `npx shadcn@latest add …`); see [shadcn Skills](https://ui.shadcn.com/docs/skills) and `.codex/skills/shadcn-ui/SKILL.md`.

## OpenAI Codex

- **Project layer:** [`.codex/config.toml`](./.codex/config.toml) (`developer_instructions`) loads when the workspace is **trusted** in Codex. See [Codex configuration](https://developers.openai.com/codex/config-reference).
- **Skills:** [`.codex/skills/*/SKILL.md`](./.codex/skills/) — start with `codex-workflow`, `shadcn-ui`, `playwright-iterate`, `trading-api-wiring`, `trading-web-quality`.
- **Subagents:** [`.codex/agents/*.toml`](./.codex/agents/) for focused roles (e.g. `playwright_verifier`, `trading_api_specialist`).
- **Quality loop:** After changes, run `npm run lint`; after UI/routing, also `npm run test:e2e`. Use `npm run build` when compile/type risk exists. Ask Codex to run these and fix failures before finishing.
- **Pull requests:** PR bodies must use real multiline Markdown, never a literal `"/n"` sequence. Prefer `Summary`, `Why`, `Verification`, `UI checked`, `Screenshots` when practical, and `Closes #issue` when applicable. Have Codex verify the rendered GitHub PR body before treating the PR as ready.
- **Docs:** When Next.js / React / Tailwind APIs are unclear, have the agent verify against current official documentation rather than guessing.
- **MCP:** Optional in user-level Codex config when you need external tools (DB, registries, etc.).

## Files to Read First
- AGENTS.md
- RULES.md
- ARCHITECTURE.md
- TASKS.md
