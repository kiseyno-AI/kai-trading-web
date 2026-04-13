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

  test("D2 EOD card uses core freshness update status and date", async ({ page }) => {
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        json: {
          today: {
            trade_date: "2026-04-10",
            eod_status: "completed",
            symbols_total: 950,
            symbols_succeeded: 950,
            symbols_failed: 0,
            received: true,
          },
          latest: {
            price_trade_date: "2026-04-10",
            technical_market_date: "2026-04-09",
            action_market_date: "2026-04-09",
          },
        },
      });
    });

    await page.goto("/dashboard");

    const freshnessCard = page.locator("#dashboard-freshness");
    await expect(freshnessCard.getByText(/EOD Update/i)).toBeVisible();
    await expect(freshnessCard.getByText(/Recently updated/i).first()).toBeVisible();
    await expect(freshnessCard.getByText(/Latest EOD date 2026-04-10/i)).toBeVisible();
    await expect(freshnessCard.getByText(/Market date 2026-04-10/i)).toBeVisible();
    await expect(freshnessCard.getByText(/Run status Completed/i)).toBeVisible();
  });

  test("D2 EOD card does not use market date as latest stored EOD date", async ({ page }) => {
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        json: {
          today: {
            trade_date: "2026-04-10",
            eod_status: "completed",
            symbols_total: 950,
            symbols_succeeded: 950,
            symbols_failed: 0,
            received: true,
          },
          latest: {
            price_trade_date: null,
            technical_market_date: "2026-04-09",
            action_market_date: "2026-04-09",
          },
        },
      });
    });

    await page.goto("/dashboard");

    const freshnessCard = page.locator("#dashboard-freshness");
    await expect(freshnessCard.getByText(/Latest EOD date \[확인 필요\]/i)).toBeVisible();
    await expect(freshnessCard.getByText(/Market date 2026-04-10/i)).toBeVisible();
  });
});
