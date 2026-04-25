# TASKS.md

## Current Priorities
1. Set dashboard information architecture
2. Define main route structure
3. Prepare UI shell and layout
4. Connect frontend architecture to backend contracts
5. Document component and page conventions

## Active Tracker
- Web refactor phase 2 execution order and remaining follow-up work live in `docs/WEB_REFACTOR_PHASE2_TRACKER.md`. Use that file as the single tracker for #339, #341, #342, #343, and #348.

## Tooling checklist (optional)
- Start task work on a dedicated branch created from `main`.
- Trust this repo in **Codex** so `.codex/config.toml` and skills load; extend behavior via `.codex/skills/` when needed.
- Run `npm run lint` and `npm run test:e2e` before merging UI-heavy branches.
- After merge or cancellation, delete the task branch locally and on the remote unless there is a specific reason to keep it, then restore the workspace checkout to `main`.
