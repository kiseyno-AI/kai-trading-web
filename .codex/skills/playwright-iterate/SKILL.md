---
name: playwright-iterate
description: Validates UI changes with Playwright and tightens the feedback loop. Use after editing routes, layout, dashboard, or navigation; when the user asks to verify in the browser, run e2e tests, or iterate until tests pass.
---

# Playwright iterate loop

## Commands (repository root)

1. **Full check (starts `next dev` automatically):** `npm run test:e2e`
2. **Debug interactively:** `npm run test:e2e:ui`
3. **See the browser:** `npm run test:e2e:headed`
4. **Last HTML report:** `npm run test:e2e:report`

If browsers are missing: `npx playwright install chromium`

## Codex workflow

After implementing or refactoring UI:

1. Run `npm run test:e2e` (or `CI=true npm run test:e2e` in automation so a fresh dev server is spawned).
2. If tests fail: read the failure line, open the listed spec under `e2e/`, fix app code or update assertions if the behavior change was intentional.
3. Re-run until green. Prefer fixing product bugs over weakening assertions unless the spec is wrong.
4. For flaky timing, use Playwright auto-waiting (`expect(locator).toBeVisible()`); avoid fixed `waitForTimeout` unless unavoidable.

## Tests location

- Specs: `e2e/*.spec.ts`
- Config: `playwright.config.ts` (`baseURL` is `http://127.0.0.1:3000`, `webServer` runs `npm run dev`)

## Upstream dependency

`/dashboard` SSR calls trading-core at `127.0.0.1:8000` by default. Smoke tests allow either **Trading Dashboard Home** (core up) or **KIS DASHBOARD ERROR** (core down). For CI that must assert live data, start a mock API or set `TRADING_API_UPSTREAM_BASE_URL` to a stub and narrow the assertions.

## Expanding coverage

Add focused specs next to `smoke.spec.ts` for critical flows (search, symbol page, API proxy). Use `data-testid` on unstable widgets only when roles and labels are insufficient.
