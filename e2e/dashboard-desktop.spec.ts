import { expect, test } from "@playwright/test";

test.describe("dashboard desktop", () => {
  test("dashboard labels match currently wired core data", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText(/Trading Dashboard/i)).toBeVisible();
    await expect(page.getByRole("navigation", { name: /Primary desktop/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Operational Integrity/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Today's ledger recommendations/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Highest absolute movers/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Ledger coverage notes/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Layer sync events/i })).toBeVisible();

    await expect(page.getByText(/Market Freshness Registry/i)).toBeVisible();
    await expect(page.getByText(/Manage Feed/i)).toBeVisible();

    await expect(page.getByText(/Readiness and breadth/i)).toHaveCount(0);
    await expect(page.getByText(/Top movers/i)).toHaveCount(0);
    await expect(page.getByText(/Connection and timing/i)).toHaveCount(0);
  });

  test("D2 EOD status uses received state and latest stored price date", async ({ page }) => {
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        json: {
          today: {
            trade_date: "2026-04-13",
            eod_status: "running",
            symbols_total: 10,
            symbols_succeeded: 8,
            symbols_failed: 2,
            received: true,
          },
          latest: {
            price_trade_date: "2026-04-10",
            technical_market_date: "2026-04-09",
            action_market_date: "2026-04-09",
          },
          price: {
            success: true,
            latest_date: "2026-04-10",
          },
          technical: {
            success: true,
            latest_date: "2026-04-09",
          },
          action: {
            success: true,
            latest_date: "2026-04-09",
          },
        },
      });
    });

    await page.goto("/dashboard");

    const eodStatusCard = page.locator("#dashboard-freshness article").filter({ hasText: /EOD Status/i });
    await expect(eodStatusCard).toBeVisible();
    await expect(eodStatusCard.getByText(/Recently Updated/i)).toBeVisible();
    await expect(eodStatusCard.getByText(/Latest stored EOD 2026-04-10/i)).toBeVisible();
    await expect(eodStatusCard.getByText(/Market date 2026-04-13/i)).toBeVisible();
  });
});
