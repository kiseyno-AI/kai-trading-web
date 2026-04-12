# AGENTS.md

## Purpose
This repository is part of the KAI trading system.

## developer_instructions
This workspace is KAI trading-web (Next.js App Router, TypeScript). Project AI guidance lives under .codex/ (this file, skills, agents)—not in .cursor.

Before substantial edits, read AGENTS.md, RULES.md, and ARCHITECTURE.md at the repository root.

Branch workflow: before task work, create and switch to a dedicated branch from main. After a PR is merged or work is cancelled, delete that branch locally and on the remote unless there is a specific reason to keep it. Before finishing, restore the main workspace checkout to main.

Layout: src/app (routes), src/features (domain composition), src/components (ui, navigation, layout, dashboard), src/lib (hooks, trading-api adapter, trading-upstream), src/data (mock/demo). Do not call brokers from the browser; use the Next BFF under src/app/api/trading/** or the configured API base URL.

React/Next: Prefer Server Components; use "use client" only when required. Tailwind: flex/grid with gap-*; use cn() from @/lib/utils. When framework APIs are uncertain, verify against current official docs (do not guess).

Environment: TRADING_API_UPSTREAM_BASE_URL / TRADING_API_INTERNAL_BASE_URL and TRADING_API_UPSTREAM_BEARER_TOKEN are server-only. NEXT_PUBLIC_TRADING_API_BASE_URL is for the client adapter in src/lib/trading-api.ts. Never put secrets in NEXT_PUBLIC_*.

When changing API shapes or routes, keep docs/API_CONTRACT.md and src/types/trading-api.ts aligned with implementation. Do not add live-trading behavior without explicit approval. Use English for code and technical documentation.

For new or refactored UI, prefer shadcn/ui via the CLI and components.json (see .codex/skills/shadcn-ui and https://ui.shadcn.com/docs/skills).

After edits: run npm run lint; after UI or routing changes follow this verification order: (1) local branch/build preview, (2) Playwright MCP browser verification against that local preview, including a mobile viewport when the change is responsive or user-facing on mobile, then (3) deployed/production verification. Keep npm run test:e2e in that loop for UI or routing changes (see .codex/skills/playwright-iterate). For responsive or mobile-sensitive UI changes, verify with Playwright at mobile viewport sizes as well as desktop; desktop-only inspection is insufficient. Run npm run build when the change could affect typecheck or production compile.

When creating pull requests, write the PR body as real multiline Markdown. Never build PR text with a literal "/n" sequence; use actual newlines via direct multiline text, a heredoc, or a file-based body such as gh pr create --body-file. Use this repo PR structure by default: Summary, Why, Verification, UI checked, Screenshots when practical, Closes #issue when applicable. Before considering the PR ready, verify the rendered PR body formatting in GitHub so headings, bullets, and spacing display correctly.

ACP session handling: default ACP coding work to a fresh thread-spawned ACP session. Treat "acpx exited with code 1", empty spawned-session messages, and gateway errors such as "queue owner unavailable", "Resource not found", or "repairing dead named session" as dead-session symptoms. Silent run fallback is forbidden. Required recovery: clean up stale ACP sessions, restart the gateway if needed, then retry with a fresh spawned ACP session.

Optional deeper workflow patterns: .codex/skills/codex-workflow


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
- After UI or routing changes, run `npm run test:e2e` (Playwright); use Playwright MCP for the browser-verification step against the local preview, including a mobile viewport when the affected flow is responsive or mobile-relevant. See `.codex/skills/playwright-iterate/SKILL.md`.
- For new UI primitives, use shadcn/ui (`components.json`, `npx shadcn@latest add …`); see [shadcn Skills](https://ui.shadcn.com/docs/skills) and `.codex/skills/shadcn-ui/SKILL.md`.

## OpenAI Codex

- **Project layer:** [`.codex/config.toml`](./.codex/config.toml) (`developer_instructions`) loads when the workspace is **trusted** in Codex. See [Codex configuration](https://developers.openai.com/codex/config-reference).
- **Skills:** [`.codex/skills/*/SKILL.md`](./.codex/skills/) — start with `codex-workflow`, `shadcn-ui`, `playwright-iterate`, `trading-api-wiring`, `trading-web-quality`.
- **Subagents:** [`.codex/agents/*.toml`](./.codex/agents/) for focused roles (e.g. `playwright_verifier`, `trading_api_specialist`).
- **ACP sessions:** Default ACP coding work to a fresh thread-spawned ACP session. Treat `acpx exited with code 1`, empty spawned-session messages, and gateway errors such as `queue owner unavailable`, `Resource not found`, or `repairing dead named session` as dead-session symptoms. Silent run fallback is forbidden. Recover by cleaning up stale ACP sessions, restarting the gateway if needed, and retrying with a fresh spawned ACP session.
- **Quality loop:** After changes, run `npm run lint`; after UI/routing, also `npm run test:e2e`. Use `npm run build` when compile/type risk exists. Ask Codex to run these and fix failures before finishing.
- **Pull requests:** PR bodies must use real multiline Markdown, never a literal `"/n"` sequence. Prefer `Summary`, `Why`, `Verification`, `UI checked`, `Screenshots` when practical, and `Closes #issue` when applicable. Have Codex verify the rendered GitHub PR body before treating the PR as ready.
- **Docs:** When Next.js / React / Tailwind APIs are unclear, have the agent verify against current official documentation rather than guessing.
- **MCP:** Optional in user-level Codex config when you need external tools (DB, registries, etc.).

## Files to Read First
- AGENTS.md
- RULES.md
- ARCHITECTURE.md
- TASKS.md
