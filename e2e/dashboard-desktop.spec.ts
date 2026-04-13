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

  test("D2 EOD status uses core freshness update flag and symbol counts", async ({ page }) => {
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-13",
            eod_status: "missing",
            symbols_total: 250,
            symbols_succeeded: 237,
            symbols_failed: null,
            received: false,
          },
          latest: {
            price_trade_date: "2026-04-10",
            technical_market_date: "2026-04-10",
            action_market_date: "2026-04-10",
          },
        }),
      });
    });

    await page.goto("/dashboard");

    const eodStatusCard = page.locator("#dashboard-freshness article").filter({ hasText: "EOD Status" });
    await expect(eodStatusCard).toBeVisible();
    await expect(eodStatusCard.getByText("Not received")).toBeVisible();
    await expect(eodStatusCard.getByText("Latest EOD date 2026-04-10")).toBeVisible();
    await expect(eodStatusCard.getByText("Success count 237")).toBeVisible();
    await expect(eodStatusCard.getByText("Total count 250")).toBeVisible();
    await expect(eodStatusCard.getByText(/Market date/i)).toHaveCount(0);
  });

  test("D2 EOD status uses freshness values when received flag is absent", async ({ page }) => {
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-13",
            eod_status: null,
            symbols_total: 250,
            symbols_succeeded: 237,
            symbols_failed: null,
            received: null,
          },
          latest: {
            price_trade_date: "2026-04-10",
            technical_market_date: "2026-04-10",
            action_market_date: "2026-04-10",
          },
        }),
      });
    });

    await page.goto("/dashboard");

    const eodStatusCard = page.locator("#dashboard-freshness article").filter({ hasText: "EOD Status" });
    await expect(eodStatusCard).toBeVisible();
    await expect(eodStatusCard.getByText("Freshness available")).toBeVisible();
    await expect(eodStatusCard.getByText("Latest EOD date 2026-04-10")).toBeVisible();
    await expect(eodStatusCard.getByText("Success count 237")).toBeVisible();
    await expect(eodStatusCard.getByText("Total count 250")).toBeVisible();
    await expect(eodStatusCard.getByText("[확인 필요]")).toHaveCount(0);
  });
});
