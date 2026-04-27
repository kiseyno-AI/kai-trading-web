import { expect, test, type Page } from "@playwright/test";

import { chromiumIPhone13 } from "./devices";

test.use(chromiumIPhone13);

async function mockSearchShellApis(page: Page) {
  await page.route("**/api/trading/symbols/favorites", async (route) => {
    await route.fulfill({ json: { count: 0, items: [] } });
  });
  await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
    await route.fulfill({ json: { tracked_symbols: [], count: 0, last_updated_at: null } });
  });
  await page.route("**/api/trading/scanner/realtime-trending?**", async (route) => {
    await route.fulfill({
      json: {
        status: "ok",
        source: "kis",
        as_of: "2026-04-21T09:12:00+09:00",
        market: "KRX",
        summary: { item_count: 0 },
        items: [],
      },
    });
  });
  await page.route("**/api/trading/scanner/trending-stocks?**", async (route) => {
    await route.fulfill({
      json: {
        request: { resolved_market_date: "2026-04-21", period: "1d", direction: "up", limit: 5 },
        summary: { count: 0, data_available: true },
        items: [],
      },
    });
  });
}

async function mockPortfolioSummary(page: Page) {
  await page.route("**/api/trading/portfolio/summary", async (route) => {
    await route.fulfill({
      json: {
        asOf: "2026-04-21T09:12:00+09:00",
        source: "mock-account-api",
        sync: {
          status: "synced",
          lastSyncedAt: "2026-04-21T09:12:00+09:00",
          source: "kis",
        },
        accounts: [
          {
            id: "kis-main",
            label: "KIS Main Account",
            broker: "KIS",
            accountType: "cash",
            status: "synced",
            baseCurrency: "KRW",
            lastSyncedAt: "2026-04-21T09:12:00+09:00",
            summary: {
              totalAssets: { amount: 12500000, currency: "KRW" },
              cash: { amount: 1500000, currency: "KRW" },
              buyingPower: { amount: 3000000, currency: "KRW" },
              pnl: {
                day: { amount: 120000, currency: "KRW" },
                unrealized: { amount: 450000, currency: "KRW" },
              },
            },
            holdings: [
              {
                symbol: "005930",
                name: "Samsung Electronics",
                market: "KOSPI",
                quantity: 12,
                lastPrice: { amount: 71500, currency: "KRW" },
                marketValue: { amount: 858000, currency: "KRW" },
                unrealizedPnl: { amount: 42000, currency: "KRW" },
                allocationPercent: 6.86,
              },
            ],
            allocation: [
              {
                id: "equity",
                label: "Equity",
                value: { amount: 11000000, currency: "KRW" },
                percent: 88,
              },
              {
                id: "cash",
                label: "Cash",
                value: { amount: 1500000, currency: "KRW" },
                percent: 12,
              },
            ],
            recentActivity: [
              {
                id: "fill-1",
                symbol: "005930",
                side: "buy",
                status: "filled",
                quantity: 2,
                filledQuantity: 2,
                updatedAt: "2026-04-21T09:10:00+09:00",
              },
            ],
          },
        ],
      },
    });
  });
}

test.describe("portfolio mobile route", () => {
  test("bottom toolbar opens the portfolio assets screen", async ({ page }) => {
    await mockSearchShellApis(page);
    await mockPortfolioSummary(page);

    await page.goto("/search");
    await expect(page.getByRole("heading", { name: "Quick Access" })).toBeVisible();

    await page.getByRole("link", { name: "Assets", exact: true }).click();

    await expect(page).toHaveURL(/\/portfolio$/);
    await expect(page.getByRole("heading", { name: "Portfolio" })).toBeVisible();
    await expect(page.getByText("KIS Main Account")).toBeVisible();
    await expect(page.getByText("Samsung Electronics")).toBeVisible();
    await expect(page.getByLabel("Portfolio summary metrics").getByText("₩12,500,000")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent orders and executions" })).toBeVisible();
  });

  test("shows empty and unavailable states when portfolio data is not populated", async ({ page }) => {
    await page.route("**/api/trading/portfolio/summary", async (route) => {
      await route.fulfill({ status: 404, json: { detail: "not implemented" } });
    });

    await page.goto("/portfolio");

    await expect(page.getByRole("heading", { name: "Portfolio" })).toBeVisible();
    await expect(page.getByText("Portfolio feed unavailable. HTTP 404")).toBeVisible();
    await expect(page.getByText("No account snapshot yet.")).toBeVisible();
    await expect(page.getByText("No holdings reported yet.")).toBeVisible();
    await expect(page.getByText("No order or execution summary yet.")).toBeVisible();
  });
});
