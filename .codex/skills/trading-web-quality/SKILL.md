---
name: trading-web-quality
description: Suggests verification steps and tests for trading-web. Use when the user asks about tests, CI, harness, lint, typecheck, regression safety, or before merging risky UI or API changes.
---

# Trading web quality

## Commands

From repository root: `npm run lint`, `npm run build`. Consider `npx tsc --noEmit` for explicit typechecking in CI.

For UI or routing work, run `npm run test:e2e`. Use Playwright MCP for the browser-verification pass against the local preview. If the change is responsive or mobile-sensitive, include Playwright verification at mobile viewport sizes in addition to desktop; desktop-only inspection is insufficient.

## High-value tests

- Mapping in `src/lib/trading-api.ts` (core JSON to dashboard DTOs) using fixture payloads.
- `src/lib/trading-upstream.ts` with mocked `fetch`: base URL trimming, `Authorization` when `TRADING_API_UPSTREAM_BEARER_TOKEN` is set, non-OK responses.

## Hooks and resilience

Hooks under `src/lib/use-*.ts` should surface errors when improving reliability; then cover loading and error UI.

## Documentation

Prefer a committed `.env.example` at the repo root with the variables from `README.md`. Keep `docs/API_CONTRACT.md` consistent with actual BFF and client paths.
