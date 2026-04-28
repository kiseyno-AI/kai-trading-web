# RULES.md

## Repository Rules
- Use English for code and technical documentation.
- Keep naming explicit and consistent.
- Avoid hidden magic and implicit coupling.
- Prefer configuration over hardcoded values.
- Keep functions/modules small and testable.
- Do not mix research prototypes into production paths without review.

## AI-assisted changes (Codex)
- Create and switch to a dedicated branch from `main` before starting task work.
- Unless the user explicitly says otherwise, complete the full development flow on that branch: implement, validate, commit, push, and open a PR.
- After a PR is merged or work is cancelled, delete the created branch locally and on the remote unless there is a specific reason to keep it.
- Before finishing, restore the main workspace checkout to `main`.
- Resolve **ESLint** issues (`npm run lint`) before considering a change done.
- Canonical production build verification for agent work is **`npx next build --webpack`**. Do not treat a failing Turbopack build path alone as a blocker when the webpack build passes.
- For **UI or routing** changes, run **`npm run test:e2e`** (Playwright) and fix failures unless the test itself is wrong.
- When browser-level verification is required, use **Playwright MCP** against the local preview before relying on deployed or production environments. Include a mobile viewport for responsive or mobile-relevant flows.
- If Codex sandbox/network policy blocks local dev-server binding (for example `listen EPERM 0.0.0.0:3000`) or prevents a full local browser loop, treat that as a **reportable sandbox limitation**, not an automatic reason to withhold commit/push/PR creation.
- When implementation is complete and static validation passes, still **commit, push, and open the PR** even if sandbox-only runtime verification is blocked. Put the blocked verification clearly in the PR body under Verification or UI checked.
- For PRs opened by Codex, write the body as real multiline Markdown, never with a literal `"/n"` sequence; use direct multiline text, a heredoc, or a file-based body.
- Default PR sections: **Summary**, **Why**, **Verification**, **UI checked**, **Screenshots** when practical, and **Closes #issue** when applicable.
- Verify the rendered PR body in GitHub before marking the PR ready.
- Repository guidance for agents is in **`.codex/`** (`config.toml`, `skills/`, `agents/`); human summary in [AGENTS.md](./AGENTS.md).
