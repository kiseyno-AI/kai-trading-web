import { chromiumIPhone13 } from "./devices";
import { expect, test } from "@playwright/test";

test.describe("Piotroski pass-list route", () => {
  test("renders available Piotroski rows while quote enrichment is still pending", async ({ page }) => {
    const quoteRequests: string[] = [];

    await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          requested_market_date: "2026-04-29",
          resolved_market_date: "2026-04-29",
          is_latest_fallback: false,
          market_date: "2026-04-29",
          summary: {
            entries: 2_811,
            requested_symbol: null,
            matched_symbols: ["000660", "005930"],
            missing_symbols: [],
            passed_count: 106,
            not_passed_count: 2_705,
          },
          items: [
            {
              symbol: "005930",
              market_date: "2026-04-29",
              passed_filter: true,
              piotroski_score: 8,
              passes_piotroski_score: true,
              captured_at: "2026-04-29T16:10:00+09:00",
            },
            {
              symbol: "000660",
              market_date: "2026-04-29",
              passed_filter: true,
              piotroski_score: 9,
              passes_piotroski_score: true,
              captured_at: "2026-04-29T16:10:00+09:00",
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/quotes/005930", async (route) => {
      quoteRequests.push(route.request().url());
      await new Promise(() => undefined);
    });
    await page.route("**/api/trading/quotes/000660", async (route) => {
      quoteRequests.push(route.request().url());
      await new Promise(() => undefined);
    });

    await page.goto("/dashboard/piotroski-filter?marketDate=2026-04-29");

    await expect(page.getByRole("heading", { name: /Piotroski filter pass list/i })).toBeVisible();
    await expect(page.getByText(/Showing passed symbols for 2026-04-29/)).toBeVisible();
    await expect(page.getByText("Loading Piotroski pass list...")).toHaveCount(0);
    await expect(page.getByText(/Passed symbols\s*106/)).toBeVisible();

    const rows = page.locator('a[href*="/dashboard/symbol/"]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("000660");
    await expect(rows.nth(0)).toContainText("Quote unavailable");
    await expect(rows.nth(0)).toContainText("9");
    await expect(rows.nth(1)).toContainText("005930");
    await expect(rows.nth(1)).toContainText("Quote unavailable");
    await expect(rows.nth(1)).toContainText("8");
    await expect.poll(() => quoteRequests.length).toBeGreaterThan(0);
  });
});

test.describe("Piotroski pass-list route on mobile", () => {
  test.use(chromiumIPhone13);

  test("maps quote unavailable reason tokens to compact change copy", async ({ page }) => {
    await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          requested_market_date: "2026-04-29",
          resolved_market_date: "2026-04-29",
          is_latest_fallback: false,
          market_date: "2026-04-29",
          summary: {
            entries: 2_811,
            requested_symbol: null,
            matched_symbols: ["000660"],
            missing_symbols: [],
            passed_count: 1,
            not_passed_count: 0,
          },
          items: [
            {
              symbol: "000660",
              market_date: "2026-04-29",
              passed_filter: true,
              piotroski_score: 9,
              passes_piotroski_score: true,
              captured_at: "2026-04-29T16:10:00+09:00",
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/quotes/000660", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          symbol: "000660",
          price: null,
          change: null,
          change_pct: null,
          volume: null,
          turnover: null,
          market_state: "closed",
          source: "api",
          fallback: false,
          is_live: false,
          available: false,
          unavailable_reason: "no_live_quote_or_fresh_fallback",
        }),
      });
    });

    await page.goto("/dashboard/piotroski-filter?marketDate=2026-04-29");

    const row = page.locator('a[href*="/dashboard/symbol/000660"]');
    await expect(row).toContainText("변동 미제공");
    await expect(row).not.toContainText("no_live_quote_or_fresh_fallback");
  });
});
