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

  test("D2 EOD status uses received flag and latest stored EOD date", async ({ page }) => {
    await page.route("**/api/trading/market/status", async (route) => {
      await route.fulfill({
        json: {
          state: "CLOSED",
          is_open: false,
          server_time: "2026-04-13T10:00:00Z",
        },
      });
    });
    await page.route("**/api/trading/quotes/tracked", async (route) => {
      await route.fulfill({
        json: {
          market_state: "CLOSED",
          as_of: "2026-04-13T10:00:00Z",
          items: [
            {
              symbol: "005930",
              company_name: "Samsung Electronics",
              price: 71500,
              change: 600,
              change_pct: 0.84,
              volume: 120000,
              turnover: 8580000000,
              as_of: "2026-04-13T10:00:00Z",
              market_state: "CLOSED",
              source: "daily_price_bar",
              fallback: true,
              is_live: false,
              available: true,
              trade_date: "2026-04-11",
              cached_at: null,
              fallback_reason: "eod_fallback",
              unavailable_reason: null,
            },
          ],
        },
      });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      await route.fulfill({
        json: {
          tracked_symbols: ["005930"],
          count: 1,
          last_updated_at: "2026-04-13T10:00:00Z",
        },
      });
    });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        json: {
          today: {
            trade_date: "2026-04-13",
            eod_status: "running",
            symbols_total: 1,
            symbols_succeeded: 0,
            symbols_failed: 0,
            received: true,
          },
          latest: {
            price_trade_date: "2026-04-11",
            technical_market_date: "2026-04-10",
            action_market_date: "2026-04-10",
          },
          price: {
            success: true,
            latest_date: "2026-04-11",
          },
          technical: {
            success: true,
            latest_date: "2026-04-10",
          },
          action: {
            success: true,
            latest_date: "2026-04-10",
          },
        },
      });
    });

    await page.goto("/dashboard");

    const d2 = page.locator("#dashboard-freshness");
    await expect(d2.getByRole("heading", { name: /Operational Integrity/i })).toBeVisible();
    await expect(d2.getByText("EOD Updated").first()).toBeVisible();
    await expect(d2.getByText(/Latest stored EOD 2026-04-11/)).toBeVisible();
    await expect(d2.getByText(/Market date 2026-04-13/)).toBeVisible();
    await expect(d2.getByText("Running")).toHaveCount(0);
  });
});
