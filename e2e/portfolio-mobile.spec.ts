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

  test("shows unavailable state when aggregate summary endpoint is pending", async ({ page }) => {
    await page.route("**/api/trading/portfolio/summary", async (route) => {
      await route.fulfill({ status: 404, json: { detail: "not implemented" } });
    });

    await page.goto("/portfolio");

    await expect(page.getByRole("heading", { name: "Portfolio" })).toBeVisible();
    await expect(page.getByText("Aggregate portfolio summary endpoint is not available yet. HTTP 404")).toBeVisible();
    await expect(page.getByText("Portfolio summary unavailable.").first()).toBeVisible();
    await expect(
      page.getByText("The aggregate portfolio summary route is not returning a usable response yet.").first(),
    ).toBeVisible();
    await expect(page.getByText("No accounts in portfolio summary.")).toHaveCount(0);
    await expect(page.getByText("No holdings reported yet.")).toHaveCount(0);
  });

  test("keeps connected empty holdings separate from unavailable summary", async ({ page }) => {
    await page.route("**/api/trading/portfolio/summary", async (route) => {
      await route.fulfill({
        json: {
          asOf: "2026-04-21T09:12:00+09:00",
          source: "portfolio-summary",
          sync: {
            status: "synced",
            lastSyncedAt: "2026-04-21T09:12:00+09:00",
            source: "kis",
          },
          accounts: [
            {
              id: "kis-empty",
              label: "KIS Empty Account",
              broker: "KIS",
              accountType: "cash",
              status: "synced",
              baseCurrency: "KRW",
              lastSyncedAt: "2026-04-21T09:12:00+09:00",
              summary: {
                totalAssets: { amount: 1000000, currency: "KRW" },
                cash: { amount: 1000000, currency: "KRW" },
                buyingPower: { amount: 1000000, currency: "KRW" },
              },
              holdings: [],
            },
          ],
        },
      });
    });

    await page.goto("/portfolio");

    await expect(page.getByText("KIS Empty Account")).toBeVisible();
    await expect(page.getByText("Connected empty")).toBeVisible();
    await expect(page.getByText("No holdings reported yet.")).toBeVisible();
    await expect(page.getByText("The aggregate summary is connected and returned no holdings for the current accounts.")).toBeVisible();
    await expect(page.getByText("Portfolio summary unavailable.")).toHaveCount(0);
  });

  test("surfaces stale sync while still rendering returned holdings", async ({ page }) => {
    await page.route("**/api/trading/portfolio/summary", async (route) => {
      await route.fulfill({
        json: {
          asOf: "2026-04-21T09:12:00+09:00",
          source: "portfolio-summary",
          sync: {
            status: "stale",
            lastSyncedAt: "2026-04-20T09:12:00+09:00",
            source: "kis",
            message: "KIS balance sync is older than the latest market session.",
          },
          accounts: [
            {
              id: "kis-stale",
              label: "KIS Stale Account",
              broker: "KIS",
              accountType: "cash",
              status: "stale",
              baseCurrency: "KRW",
              lastSyncedAt: "2026-04-20T09:12:00+09:00",
              summary: {
                totalAssets: { amount: 12500000, currency: "KRW" },
                cash: { amount: 1500000, currency: "KRW" },
                buyingPower: { amount: 3000000, currency: "KRW" },
              },
              holdings: [
                {
                  symbol: "005930",
                  name: "Samsung Electronics",
                  market: "KOSPI",
                  quantity: 12,
                  marketValue: { amount: 858000, currency: "KRW" },
                },
              ],
            },
          ],
        },
      });
    });

    await page.goto("/portfolio");

    await expect(page.getByText("Portfolio sync needs attention.")).toBeVisible();
    await expect(page.getByText("KIS balance sync is older than the latest market session.")).toBeVisible();
    await expect(page.getByText("KIS Stale Account")).toBeVisible();
    await expect(page.getByText("Samsung Electronics")).toBeVisible();
    await expect(page.getByText("No order or execution summary yet.")).toBeVisible();
  });
});
