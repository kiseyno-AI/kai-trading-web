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

  test("opens the candlestick detail page from the Q2 symbol list without rendering quote prices in the list", async ({ page }) => {
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
    await page.route("**/api/trading/symbols/005930/price-bars?**", async (route) => {
      await route.fulfill({
        json: {
          symbol: "005930",
          count: 3,
          start_date: "2026-04-10",
          end_date: "2026-04-14",
          requested_start_date: "2025-04-14",
          requested_end_date: "2026-04-14",
          items: [
            {
              trade_date: "2026-04-10",
              open_price: 70000,
              high_price: 71000,
              low_price: 69500,
              close_price: 70500,
              volume: 1000000,
              turnover: 70500000000,
              source: "test",
              captured_at: "2026-04-10T16:00:00+09:00",
            },
            {
              trade_date: "2026-04-13",
              open_price: 70600,
              high_price: 71600,
              low_price: 70200,
              close_price: 70900,
              volume: 1100000,
              turnover: 77990000000,
              source: "test",
              captured_at: "2026-04-13T16:00:00+09:00",
            },
            {
              trade_date: "2026-04-14",
              open_price: 71000,
              high_price: 71800,
              low_price: 70800,
              close_price: 71500,
              volume: 1250000,
              turnover: 89375000000,
              source: "test",
              captured_at: "2026-04-14T16:00:00+09:00",
            },
          ],
        },
      });
    });
    await page.route("**/api/trading/quotes/005930**", async (route) => {
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

    const resultCard = page.getByRole("link", { name: /005930.*Samsung Electronics/i }).first();
    await expect(resultCard).toBeVisible();
    await expect(resultCard).toHaveAttribute(
      "href",
      "/dashboard/symbol/005930?name=Samsung+Electronics&market=KOSPI&standardCode=KR7005930003",
    );

    await expect(resultCard).not.toContainText("₩71,500");
    await expect(resultCard).not.toContainText("+0.84%");

    await Promise.all([page.waitForURL(/\/dashboard\/symbol\/005930/), resultCard.click()]);

    await expect(page.getByRole("heading", { name: /Swipe-aware candlestick chart/i })).toBeVisible();
    await expect(page.getByRole("img", { name: /Historical candlestick chart for 005930/i })).toBeVisible();
  });

  test("keeps the favorite dialog overlay above the mobile bottom nav", async ({ page }) => {
    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({
        json: {
          count: 0,
          items: [],
        },
      });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      await route.fulfill({
        json: {
          tracked_symbols: [],
          count: 0,
          last_updated_at: "2026-04-14T08:55:00+09:00",
        },
      });
    });
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      await route.fulfill({
        json: {
          query: "",
          count: 0,
          items: [],
        },
      });
    });

    await page.goto("/search");

    await page.getByRole("button", { name: /Open favorite search/i }).click();

    const dialog = page.getByRole("dialog", { name: /Save Symbol/i });
    await expect(dialog).toBeVisible();

    const bottomNav = page.getByRole("navigation", { name: /^Primary$/i });
    await expect(bottomNav).toBeVisible();

    const bottomNavBox = await bottomNav.boundingBox();
    expect(bottomNavBox).not.toBeNull();

    const topLayer = await page.evaluate(
      ({ x, y }) => {
        const element = document.elementFromPoint(x, y);
        const className = typeof element?.className === "string" ? element.className : "";

        return {
          className,
          isWithinBottomNav: Boolean(element?.closest('nav[aria-label="Primary"]')),
          zIndex: element ? Number.parseInt(window.getComputedStyle(element).zIndex, 10) : Number.NaN,
        };
      },
      {
        x: bottomNavBox!.x + bottomNavBox!.width / 2,
        y: bottomNavBox!.y + bottomNavBox!.height / 2,
      },
    );

    expect(topLayer.className).toContain("favoriteDialogOverlay");
    expect(topLayer.isWithinBottomNav).toBe(false);
    expect(topLayer.zIndex).toBeGreaterThan(45);
  });
});
