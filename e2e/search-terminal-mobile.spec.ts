import { expect, test } from "@playwright/test";

import { chromiumIPhone13 } from "./devices";

test.use(chromiumIPhone13);

test.describe("search terminal mobile", () => {
  test("renders mobile terminal chrome and bottom tabs", async ({ page }) => {
    await page.goto("/search");

    const topbar = page.locator("header.topbar");
    await expect(topbar).toBeVisible();
    await expect
      .poll(() => topbar.evaluate((element) => window.getComputedStyle(element).position))
      .toBe("fixed");

    await expect(page.getByRole("navigation", { name: /^Primary$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Search/i })).toBeVisible();
    await expect(page.getByLabel(/Search markets, symbols, or analysis/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Search Results/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Trending Symbols/i })).toBeVisible();
    await expect(page.getByText(/Network Integrity/i)).toBeVisible();
  });

  test("keeps quote prices out of the Q2 symbol list", async ({ page }) => {
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      await route.fulfill({
        json: {
          query: "005930",
          count: 1,
          items: [
            {
              symbol: "005930",
              standard_code: "KR7005930003",
              name_ko: "Samsung Electronics",
              market: "KOSPI",
            },
          ],
        },
      });
    });
    await page.route("**/api/trading/quotes/005930", async (route) => {
      await route.fulfill({
        json: {
          symbol: "005930",
          company_name: "Samsung Electronics",
          price: 71500,
          change: 600,
          change_pct: 0.84,
          volume: 1250000,
          turnover: 89375000000,
          market_state: "OPEN",
          source: "kis",
          fallback: false,
          is_live: true,
          available: true,
          cached_at: "2026-04-14T09:00:00+09:00",
          trade_date: "2026-04-14",
        },
      });
    });

    await page.goto("/search");
    await page.getByLabel(/Search markets, symbols, or analysis/i).fill("005930");

    const resultCard = page.getByRole("button", { name: /005930.*Samsung Electronics/i }).first();
    await expect(resultCard).toBeVisible();
    const quoteResponse = page.waitForResponse(
      (response) => response.url().includes("/api/trading/quotes/005930") && response.ok(),
    );
    await resultCard.click();
    await quoteResponse;

    const selectedInspector = page.getByRole("complementary");
    await expect(selectedInspector.getByText("Last Price")).toBeVisible();
    await expect(selectedInspector.getByText("₩71,500")).toBeVisible();
    await expect(selectedInspector.getByText("+0.84%")).toBeVisible();

    await expect(resultCard).not.toContainText("₩71,500");
    await expect(resultCard).not.toContainText("+0.84%");
  });
});
