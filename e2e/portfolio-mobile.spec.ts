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

async function mockPortfolioRiskSnapshot(page: Page) {
  await page.route("**/api/trading/execution/runtime/portfolio-risk-snapshot", async (route) => {
    await route.fulfill({
      json: {
        generated_at: "2026-04-21T09:12:00+09:00",
        mode: "paper",
        source: "execution_positions",
        source_status: "ready",
        open_holding_count: 1,
        total_market_value_krw: "858000",
        top_position_concentration: [
          {
            symbol: "005930",
            name: "Samsung Electronics",
            market: "KOSPI",
            market_value_krw: "858000",
            portfolio_weight_pct: "6.86",
            quantity: 12,
          },
        ],
        open_order_summary: {
          open_order_count: 1,
          total_open_order_notional_krw: "715000",
        },
        open_orders: [
          {
            broker_order_id: "order-1",
            symbol: "005930",
            side: "buy",
            status: "submitted",
            remaining_quantity: 10,
            notional_krw: "715000",
          },
        ],
        concentration_warnings: [
          {
            symbol: "005930",
            message: "Top symbol is within the configured concentration limit.",
          },
        ],
        stale_open_order_warnings: [],
        stale_local_position_warnings: [],
        missing_stop_metadata_count: 0,
      },
    });
  });
}

async function mockPortfolioRiskEndpointPending(page: Page) {
  await page.route("**/api/trading/execution/runtime/portfolio-risk-snapshot", async (route) => {
    await route.fulfill({ status: 404, json: { detail: "not implemented" } });
  });
}

test.describe("portfolio mobile route", () => {
  test("bottom toolbar opens the portfolio screen", async ({ page }) => {
    await mockSearchShellApis(page);
    await mockPortfolioSummary(page);
    await mockPortfolioRiskSnapshot(page);

    await page.goto("/search");
    await expect(page.getByRole("heading", { name: "Quick Access" })).toBeVisible();

    await page.getByRole("link", { name: "Portfolio", exact: true }).click();

    await expect(page).toHaveURL(/\/portfolio$/);
    await expect(page.getByRole("heading", { name: "Portfolio", exact: true })).toBeVisible();
    await expect(page.getByText("KIS Main Account")).toBeVisible();
    await expect(page.getByLabel("Holdings list").getByText("Samsung Electronics")).toBeVisible();
    await expect(page.getByLabel("Portfolio summary metrics").getByText("₩12,500,000")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Portfolio risk snapshot" })).toBeVisible();
    await expect(page.getByLabel("Portfolio risk snapshot metrics").getByText("₩858,000")).toBeVisible();
    await expect(page.getByLabel("Top open orders by notional").getByText("₩715,000")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent orders and executions" })).toBeVisible();
  });

  test("shows unavailable state when aggregate summary endpoint is pending", async ({ page }) => {
    await mockPortfolioRiskEndpointPending(page);
    await page.route("**/api/trading/portfolio/summary", async (route) => {
      await route.fulfill({ status: 404, json: { detail: "not implemented" } });
    });

    await page.goto("/portfolio");

    await expect(page.getByRole("heading", { name: "Portfolio", exact: true })).toBeVisible();
    await expect(page.getByText("Aggregate portfolio summary endpoint is not available yet.").first()).toBeVisible();
    await expect(page.getByText("Aggregate endpoint pending.").first()).toBeVisible();
    await expect(page.getByText("HTTP 404")).toHaveCount(0);
    await expect(page.getByText("No accounts in portfolio summary.")).toHaveCount(0);
    await expect(page.getByText("No holdings reported yet.")).toHaveCount(0);
  });

  test("separates upstream configuration and connectivity failures", async ({ page }) => {
    await mockPortfolioRiskEndpointPending(page);
    await page.route("**/api/trading/portfolio/summary", async (route) => {
      await route.fulfill({
        status: 500,
        json: { message: "TRADING_API_UPSTREAM_BASE_URL is required for deployed trading proxy requests." },
      });
    });

    await page.goto("/portfolio");

    await expect(page.getByText("Portfolio upstream not configured.").first()).toBeVisible();
    await expect(page.getByText("Trading upstream configuration is missing.").first()).toBeVisible();
    await expect(page.getByText("Trading-core portfolio API unreachable.")).toHaveCount(0);

    await page.unroute("**/api/trading/portfolio/summary");
    await page.route("**/api/trading/portfolio/summary", async (route) => {
      await route.fulfill({ status: 502, json: { message: "connect ECONNREFUSED 127.0.0.1:8000" } });
    });
    await page.reload();

    await expect(page.getByText("Trading-core portfolio API unreachable.").first()).toBeVisible();
    await expect(page.getByText("Trading-core portfolio upstream is unavailable.").first()).toBeVisible();
    await expect(page.getByText("HTTP 502")).toHaveCount(0);
  });

  test("resolves aggregate summary gateway timeouts into an explicit unavailable state", async ({ page }) => {
    await mockPortfolioRiskEndpointPending(page);
    await page.route("**/api/trading/portfolio/summary", async (route) => {
      await route.fulfill({
        status: 504,
        json: {
          error: "Upstream request timed out",
          message: "Timed out after 5.0s while loading /portfolio/summary from trading-core.",
        },
      });
    });

    await page.goto("/portfolio");

    await expect(page.getByRole("heading", { name: "Portfolio", exact: true })).toBeVisible();
    await expect(page.getByText("Trading-core portfolio API unreachable.").first()).toBeVisible();
    await expect(page.getByText("Trading-core portfolio upstream is unavailable.").first()).toBeVisible();
    await expect(page.getByText("HTTP 504")).toHaveCount(0);
    await expect(page.getByText("Timed out after")).toHaveCount(0);
    await expect(page.getByText("/portfolio/summary")).toHaveCount(0);
    await expect(page.getByText("Loading the aggregate portfolio summary from trading-core...")).toHaveCount(0);

    const accountState = page.locator("dt", { hasText: /^Account state$/ }).locator("..");
    const holdingsState = page.locator("dt", { hasText: /^holdings$/ }).locator("..");
    await expect(accountState.getByText("Upstream unavailable", { exact: true })).toBeVisible();
    await expect(holdingsState.getByText("Upstream unavailable", { exact: true })).toBeVisible();
    await expect(page.getByText("0 accounts", { exact: true })).toHaveCount(0);
    await expect(page.getByText("0 holdings", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Korean" }).click();

    const koreanAccountState = page.locator("dt", { hasText: /^계좌 상태$/ }).locator("..");
    const koreanHoldingsState = page.locator("dt", { hasText: /^보유$/ }).locator("..");
    await expect(koreanAccountState.getByText("업스트림 사용 불가", { exact: true })).toBeVisible();
    await expect(koreanHoldingsState.getByText("업스트림 사용 불가", { exact: true })).toBeVisible();
    await expect(page.getByText("0 계좌", { exact: true })).toHaveCount(0);
    await expect(page.getByText("0 보유", { exact: true })).toHaveCount(0);

    await page.setViewportSize({ width: 1440, height: 900 });

    await expect(koreanAccountState.getByText("업스트림 사용 불가", { exact: true })).toBeVisible();
    await expect(koreanHoldingsState.getByText("업스트림 사용 불가", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "기본 데스크톱" })).toBeVisible();
  });

  test("keeps raw runtime risk snapshot diagnostics out of visible unavailable copy", async ({ page }) => {
    await mockPortfolioSummary(page);
    await page.route("**/api/trading/execution/runtime/portfolio-risk-snapshot", async (route) => {
      await route.fulfill({
        json: {
          available: false,
          source: "execution_positions",
          source_failed: "Timed out after 5.0s while loading /execution/runtime/portfolio-risk-snapshot from trading-core.",
          as_of: "2026-06-20T01:10:00Z",
        },
      });
    });

    await page.goto("/portfolio");

    await expect(page.getByRole("heading", { name: "Portfolio risk snapshot" })).toBeVisible();
    await expect(page.getByText("Risk snapshot unavailable.")).toBeVisible();
    await expect(page.getByText("Execution runtime did not return usable portfolio risk data.")).toBeVisible();
    await expect(page.getByText("Timed out after")).toHaveCount(0);
    await expect(page.getByText("/execution/runtime/portfolio-risk-snapshot")).toHaveCount(0);
  });

  test("keeps connected empty holdings separate from unavailable summary", async ({ page }) => {
    await mockPortfolioRiskEndpointPending(page);
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
    await expect(page.getByRole("banner").getByText("Connected empty")).toBeVisible();
    await expect(page.getByText("Portfolio is connected and empty.")).toBeVisible();
    await expect(page.getByText("No holdings reported yet.")).toBeVisible();
    await expect(page.getByText("The aggregate summary is connected and returned no holdings for the current accounts.")).toBeVisible();
    await expect(page.getByText("Portfolio summary unavailable.")).toHaveCount(0);

    const accountState = page.locator("dt", { hasText: /^Account state$/ }).locator("..");
    const holdingsState = page.locator("dt", { hasText: /^holdings$/ }).locator("..");
    await expect(accountState.getByText("1 account", { exact: true })).toBeVisible();
    await expect(holdingsState.getByText("0 holdings", { exact: true })).toBeVisible();

    await page.evaluate(() => window.sessionStorage.clear());
    await page.unroute("**/api/trading/portfolio/summary");
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
          accounts: [],
        },
      });
    });
    await page.reload();

    await expect(
      page.locator("dt", { hasText: /^Account state$/ }).locator("..").getByText("0 accounts", { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator("dt", { hasText: /^holdings$/ }).locator("..").getByText("0 holdings", { exact: true }),
    ).toBeVisible();
  });

  test("surfaces stale sync while still rendering returned holdings", async ({ page }) => {
    await mockPortfolioRiskEndpointPending(page);
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

    await expect(page.getByText("Portfolio sync is stale.")).toBeVisible();
    await expect(page.getByText("KIS balance sync is older than the latest market session.")).toBeVisible();
    await expect(page.getByText("KIS Stale Account")).toBeVisible();
    await expect(page.getByText("Samsung Electronics")).toBeVisible();
    await expect(page.getByText("No order or execution summary yet.")).toBeVisible();
  });

  test("keeps returned sections visible when the portfolio summary is partial", async ({ page }) => {
    await mockPortfolioRiskEndpointPending(page);
    await page.route("**/api/trading/portfolio/summary", async (route) => {
      await route.fulfill({
        json: {
          asOf: "2026-04-21T09:12:00+09:00",
          source: "portfolio-summary",
          sync: {
            status: "partial",
            lastSyncedAt: "2026-04-21T09:12:00+09:00",
            source: "kis",
            message: "KIS holdings inquiry returned a partial response.",
          },
          accounts: [
            {
              id: "kis-partial",
              label: "KIS Partial Account",
              broker: "KIS",
              accountType: "cash",
              status: "partial",
              baseCurrency: "KRW",
              lastSyncedAt: "2026-04-21T09:12:00+09:00",
              summary: {
                totalAssets: { amount: 12500000, currency: "KRW" },
              },
            },
          ],
          notices: ["Tax lots are still pending."],
        },
      });
    });

    await page.goto("/portfolio");

    await expect(page.getByText("Portfolio data is partial.")).toBeVisible();
    await expect(page.getByText("KIS holdings inquiry returned a partial response.")).toBeVisible();
    await expect(page.getByText("Tax lots are still pending.")).toBeVisible();
    await expect(page.getByText("KIS Partial Account")).toBeVisible();
    await expect(page.getByText("Not returned").first()).toBeVisible();
    await expect(page.getByText("Holdings data is partial.")).toBeVisible();
    await expect(page.getByText("Activity data is partial.")).toBeVisible();
    await expect(page.getByText("Portfolio summary unavailable.")).toHaveCount(0);
  });
});
