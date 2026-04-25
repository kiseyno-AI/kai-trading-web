# Web Refactor Phase 2 Tracker

Use this file as the single execution-order and dependency tracker for the dashboard/symbol-detail refactor phase-2 stream. Keep it limited to behavior-preserving refactor work and direct follow-up safety items.

## Execution order on `main`

| Order | Issue | Status | Landed via | Notes |
| --- | --- | --- | --- | --- |
| 1 | #339 | Done | PR #340 on 2026-04-25 | TC-first behavior lock plus the dashboard/symbol-detail structural split. This is the foundation for every later phase-2 item. |
| 2 | #341 | Done | PR #344 on 2026-04-25 | Normalized dashboard and symbol-detail section inputs around stable display models after the structural split existed. |
| 3 | #342 | Done | PR #345 on 2026-04-25 | Render-path cleanup after the split and display-model work stabilized section boundaries. |
| 4 | #343 | Done | PR #346 on 2026-04-25 | Shared stage/date presenter extraction after the split, keeping status/date policy in one reusable layer. |
| 5 | #348 | Open follow-up | Not landed | Dedicated regression-pack work for latest/today/running/break-day and symbol-detail route/section semantics. This is the next phase-2 task. |

## Dependency notes

- #339 must remain the base dependency for #341, #342, and #343.
- #341 is the preferred base before #342 because render optimization is lower-risk once display-model props are already stable.
- #343 depends on the split from #339 and should stay behavior-preserving; it should not reopen render-boundary work unless #348 exposes a regression.
- #348 should run after #339, #341, and #343 are on `main` so the regression pack targets the final display-model and presenter boundaries instead of transient refactor code.

## Follow-up audit

- GitHub audit completed on 2026-04-25.
- The only discovered open follow-up item in this stream is #348.
- Do not create parallel phase-2 checklists elsewhere; update this file when a new follow-up issue is opened or when #348 lands.
