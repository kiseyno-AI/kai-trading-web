import { expect, test, type Page } from "@playwright/test";

import { chromiumIPhone13 } from "./devices";

test.use(chromiumIPhone13);

async function mockMobileToolbarApis(page: Page) {
  await page.route("**/api/trading/market/status", async (route) => {
    await route.fulfill({
      json: {
        state: "OPEN",
        is_open: true,
        server_time: "2026-04-21T09:12:00+09:00",
      },
    });
  });
  await page.route("**/api/trading/symbols/favorites", async (route) => {
    await route.fulfill({
      json: {
        count: 2,
        items: [
          {
            symbol: "005930",
            standard_code: "KR7005930003",
            name_ko: "Samsung Electronics",
            market: "KOSPI",
          },
          {
            symbol: "000660",
            standard_code: "KR7000660001",
            name_ko: "SK hynix",
            market: "KOSPI",
          },
        ],
      },
    });
  });
  await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
    await route.fulfill({
      json: {
        tracked_symbols: ["005930", "000660"],
        count: 2,
        last_updated_at: "2026-04-21T09:12:00+09:00",
      },
    });
  });
  await page.route("**/api/trading/symbols/search?**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const query = requestUrl.searchParams.get("q") ?? "";

    await route.fulfill({
      json: {
        query,
        count: 0,
        items: [],
      },
    });
  });
  await page.route("**/api/trading/scanner/realtime-trending?**", async (route) => {
    await route.fulfill({
      json: {
        status: "ok",
        source: "kis",
        as_of: "2026-04-21T09:12:00+09:00",
        market: "KRX",
        summary: {
          item_count: 0,
        },
        items: [],
      },
    });
  });
  await page.route("**/api/trading/quotes/tracked", async (route) => {
    await route.fulfill({
      json: {
        market_state: "OPEN",
        as_of: "2026-04-21T09:12:00+09:00",
        items: [
          {
            symbol: "005930",
            company_name: "Samsung Electronics",
            price: 71500,
            change: 700,
            change_pct: 0.99,
            volume: 120000,
            turnover: 8580000000,
            as_of: "2026-04-21T09:12:00+09:00",
            market_state: "OPEN",
            source: "kis",
            fallback: false,
            is_live: true,
            available: true,
            trade_date: "2026-04-21",
            cached_at: "2026-04-21T09:12:00+09:00",
            unavailable_reason: null,
          },
          {
            symbol: "000660",
            company_name: "SK hynix",
            price: 183400,
            change: -1200,
            change_pct: -0.65,
            volume: 94000,
            turnover: 17239600000,
            as_of: "2026-04-21T09:12:00+09:00",
            market_state: "OPEN",
            source: "db_cache",
            fallback: true,
            is_live: false,
            available: true,
            trade_date: "2026-04-21",
            cached_at: "2026-04-21T09:12:00+09:00",
            unavailable_reason: null,
          },
        ],
      },
    });
  });
}

test.describe("my symbols mobile flow", () => {
  test("bottom toolbar opens the full My Symbols screen instead of the dashboard section anchor", async ({ page }) => {
    await mockMobileToolbarApis(page);

    await page.goto("/search");

    await expect(page.getByRole("heading", { name: "Quick Access" })).toBeVisible();
    await page.getByRole("link", { name: "My Symbols", exact: true }).click();

    await expect(page).toHaveURL(/\/my-symbols$/);
    await expect(page.getByRole("heading", { name: "My Symbols" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Universal Search" })).toHaveCount(0);
    await expect(page.getByText("Samsung Electronics").first()).toBeVisible();
    await expect(page.getByText("SK hynix").first()).toBeVisible();
    await expect(page.getByText("Full tracked list")).toBeVisible();
    await expect(page.getByText("Core favorite").first()).toBeVisible();
  });

  test("dashboard navigation keeps loading feedback local to the toolbar and avoids any full-page loader", async ({
    page,
  }) => {
    await mockMobileToolbarApis(page);
    await page.route("**/dashboard", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.continue();
    });
    await page.route("**/dashboard?*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.continue();
    });

    await page.goto("/search");
    await expect(page.getByRole("heading", { name: "Quick Access" })).toBeVisible();

    await page.evaluate(() => {
      const state = window as Window & {
        __dashboardNavPendingSeen?: boolean;
        __globalLoaderSeen?: boolean;
        __navigationUxObserver?: MutationObserver;
      };
      const fullPageLoaderSelector =
        '[role="status"][aria-label="Loading symbol workspace"], [role="status"][aria-label="Loading next surface"]';
      const dashboardNavSelector = 'a[href="/dashboard"][aria-busy="true"]';
      const markLoadingSignals = () => {
        if (document.querySelector(fullPageLoaderSelector)) {
          state.__globalLoaderSeen = true;
        }
        if (document.querySelector(dashboardNavSelector)) {
          state.__dashboardNavPendingSeen = true;
        }
      };

      state.__dashboardNavPendingSeen = false;
      state.__globalLoaderSeen = false;
      state.__navigationUxObserver?.disconnect();
      state.__navigationUxObserver = new MutationObserver(markLoadingSignals);
      state.__navigationUxObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["aria-busy", "aria-label", "role", "href"],
        childList: true,
        subtree: true,
      });
      markLoadingSignals();
    });

    const dashboardLink = page.getByRole("link", { name: "Dashboard", exact: true });
    await dashboardLink.click();

    await expect.poll(() => page.evaluate(() => (window as Window & { __dashboardNavPendingSeen?: boolean }).__dashboardNavPendingSeen ?? false)).toBe(true);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: /Operational Integrity/i })).toBeVisible();
    await expect(page.getByRole("status", { name: /Loading symbol workspace|Loading next surface/i })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => (window as Window & { __globalLoaderSeen?: boolean }).__globalLoaderSeen ?? false)).toBe(false);

    await page.goBack();

    await expect(page).toHaveURL(/\/search$/);
    await expect(page.getByRole("heading", { name: "Quick Access" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("data-navigation-pending", "false");
    await expect(page.getByRole("link", { name: "Dashboard", exact: true })).not.toHaveAttribute("aria-busy", "true");
  });
});
