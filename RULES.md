# RULES.md

## Repository Rules
- Use English for code and technical documentation.
- Keep naming explicit and consistent.
- Avoid hidden magic and implicit coupling.
- Prefer configuration over hardcoded values.
- Keep functions/modules small and testable.
- Do not mix research prototypes into production paths without review.

## AI-assisted changes (Codex)
- Resolve **ESLint** issues (`npm run lint`) before considering a change done.
- For **UI or routing** changes, run **`npm run test:e2e`** (Playwright) and fix failures unless the test itself is wrong.
- For PRs opened by Codex, write the body as real multiline Markdown, never with a literal `"/n"` sequence; use direct multiline text, a heredoc, or a file-based body.
- Default PR sections: **Summary**, **Why**, **Verification**, **UI checked**, **Screenshots** when practical, and **Closes #issue** when applicable.
- Verify the rendered PR body in GitHub before marking the PR ready.
- Repository guidance for agents is in **`.codex/`** (`config.toml`, `skills/`, `agents/`); human summary in [AGENTS.md](./AGENTS.md).
