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
    await expect(page.getByText(/Network Integrity/i)).toHaveCount(0);
  });

  test("keeps Q2 empty for a blank search even if the endpoint has default matches", async ({ page }) => {
    const searchRequests: string[] = [];

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
          last_updated_at: null,
        },
      });
    });
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const query = requestUrl.searchParams.get("q") ?? "";
      searchRequests.push(query);

      await route.fulfill({
        json: {
          query,
          count: query === "005930" ? 1 : 20,
          items:
            query === "005930"
              ? [
                  {
                    symbol: "005930",
                    standard_code: "KR7005930003",
                    name_ko: "Samsung Electronics",
                    market: "KOSPI",
                  },
                ]
              : [
                  {
                    symbol: "000001",
                    standard_code: "KR7000000001",
                    name_ko: "Default Result",
                    market: "KOSPI",
                  },
                ],
        },
      });
    });
    await page.route("**/api/trading/scanner/realtime-trending?**", async (route) => {
      await route.fulfill({
        json: {
          status: "ok",
          source: "kis",
          as_of: "2026-04-14T09:00:00Z",
          market: "KRX",
          summary: {
            item_count: 0,
          },
          items: [],
        },
      });
    });

    await page.goto("/search");

    await expect(page.getByText(/Start typing to search the symbol master/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /000001.*Default Result/i })).toHaveCount(0);
    await page.waitForTimeout(250);
    expect(searchRequests).toEqual([]);

    await page.getByLabel(/Search markets, symbols, or analysis/i).fill("005930");

    await expect(page.getByRole("link", { name: /005930.*Samsung Electronics/i }).first()).toBeVisible();
    await expect.poll(() => searchRequests).toEqual(["005930"]);
  });

  test("keeps mobile search content visible when quick access API is unavailable", async ({ page }) => {
    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({
        status: 503,
        json: { error: "favorites unavailable" },
      });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      await route.fulfill({
        json: {
          tracked_symbols: ["005930"],
          count: 1,
          last_updated_at: "2026-04-14T09:00:00+09:00",
        },
      });
    });
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const query = requestUrl.searchParams.get("q");

      await route.fulfill({
        json: {
          query: query ?? "",
          count: query === "005930" ? 1 : 0,
          items:
            query === "005930"
              ? [
                  {
                    symbol: "005930",
                    standard_code: "KR7005930003",
                    name_ko: "Samsung Electronics",
                    market: "KOSPI",
                  },
                ]
              : [],
        },
      });
    });
    await page.route("**/api/trading/scanner/realtime-trending?**", async (route) => {
      await route.fulfill({
        json: {
          status: "ok",
          source: "kis",
          as_of: "2026-04-14T09:00:00Z",
          market: "KRX",
          summary: {
            item_count: 1,
          },
          items: [
            {
              symbol: "000660",
              name: "SK hynix",
              market: "KRX",
              price: 182000,
              change_pct: -1.5,
              best_rank: 1,
              source_count: 1,
              sources: [
                {
                  source: "fluctuation",
                  source_label: "fluctuation",
                  rank: 1,
                  metric: { name: "change_pct", value: -1.5, unit: "percent" },
                },
              ],
            },
          ],
        },
      });
    });

    await page.goto("/search");
    await page.getByLabel(/Search markets, symbols, or analysis/i).fill("005930");

    const quickSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Quick Access" }) }).first();
    await expect(quickSection.locator("strong").filter({ hasText: /^Unavailable$/ })).toBeVisible();
    await expect(quickSection.getByText(/Favorite list unavailable\. HTTP 503/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /005930.*Samsung Electronics/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Trending Symbols/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /000660.*SK hynix/i })).toBeVisible();
    await expect(page.getByText(/Network Integrity/i)).toHaveCount(0);
  });

  test("Q4 shows exact trending symbols by source and extends from the More button", async ({ page }) => {
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
          last_updated_at: null,
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
    await page.route("**/api/trading/scanner/realtime-trending?**", async (route) => {
      await route.fulfill({
        json: {
          status: "ok",
          source: "kis",
          as_of: "2026-04-14T09:00:00Z",
          market_code: "J",
          market: "KRX",
          limit_per_source: 5,
          sources: [],
          summary: {
            item_count: 6,
          },
          items: [
            {
              symbol: "005930",
              name: "Samsung Electronics",
              market: "KRX",
              price: 71500,
              change_pct: 0.84,
              best_rank: 1,
              source_count: 2,
              sources: [
                {
                  source: "volume-rank",
                  source_label: "volume-rank",
                  rank: 1,
                  metric: { name: "volume", value: 250000, unit: "shares" },
                },
              ],
            },
            {
              symbol: "000660",
              name: "SK hynix",
              market: "KRX",
              price: 182000,
              change_pct: -1.5,
              best_rank: 2,
              source_count: 1,
              sources: [
                {
                  source: "fluctuation",
                  source_label: "fluctuation",
                  rank: 2,
                  metric: { name: "change_pct", value: -1.5, unit: "percent" },
                },
              ],
            },
            {
              symbol: "373220",
              name: "LG Energy Solution",
              market: "KRX",
              change_pct: 2.12,
              best_rank: 3,
              source_count: 1,
              sources: [
                {
                  source: "volume-rank",
                  source_label: "volume-rank",
                  rank: 3,
                  metric: { name: "volume", value: 180000, unit: "shares" },
                },
              ],
            },
            {
              symbol: "207940",
              name: "Samsung Biologics",
              market: "KRX",
              change_pct: 1.42,
              best_rank: 4,
              source_count: 1,
              sources: [
                {
                  source: "hts-top-view",
                  source_label: "hts-top-view",
                  rank: 4,
                  metric: { name: "view_rank", value: 4, unit: "rank" },
                },
              ],
            },
            {
              symbol: "006400",
              name: "Samsung SDI",
              market: "KRX",
              change_pct: -0.32,
              best_rank: 5,
              source_count: 1,
              sources: [
                {
                  source: "volume-rank",
                  source_label: "volume-rank",
                  rank: 5,
                  metric: { name: "volume", value: 130000, unit: "shares" },
                },
              ],
            },
            {
              symbol: "035420",
              name: "NAVER",
              market: "KRX",
              change_pct: 0.21,
              best_rank: 6,
              source_count: 1,
              sources: [
                {
                  source: "fluctuation",
                  source_label: "fluctuation",
                  rank: 6,
                  metric: { name: "change_pct", value: 0.21, unit: "percent" },
                },
              ],
            },
          ],
        },
      });
    });
    await page.route("**/api/trading/scanner/trending-stocks?**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const period = requestUrl.searchParams.get("period") ?? "5d";
      const items =
        period === "5d"
          ? [
              {
                rank: 1,
                symbol: "086520",
                name_ko: "EcoPro",
                market: "KOSDAQ",
                market_date: "2026-04-14",
                trend_direction: "up",
                metric: { period: "5d", name: "return_5d_pct", value: 12.45 },
                price: null,
                technical: { close_price: 94200 },
                action_summary: null,
              },
            ]
          : [
              {
                rank: 1,
                symbol: "068270",
                name_ko: "Celltrion",
                market: "KOSPI",
                market_date: "2026-04-14",
                trend_direction: "up",
                metric: { period, name: `${period}_return_pct`, value: 4.2 },
                price: null,
                technical: { close_price: 184500 },
                action_summary: null,
              },
            ];

      await route.fulfill({
        json: {
          request: {
            resolved_market_date: "2026-04-14",
            period,
            direction: "both",
            limit: Number(requestUrl.searchParams.get("limit") ?? 5),
            markets: null,
          },
          summary: {
            count: items.length,
            data_available: true,
          },
          items,
        },
      });
    });

    await page.goto("/search");

    const trendingSection = page.locator("section").filter({ has: page.getByRole("heading", { name: /Trending Symbols/i }) }).first();
    const trendingMetricFor = (symbol: string) =>
      trendingSection.getByRole("button", { name: new RegExp(symbol) }).locator("[class*='trendingMetric'] strong");

    await expect(trendingSection.getByText("005930", { exact: true })).toBeVisible();
    await expect(trendingMetricFor("005930")).toHaveText("250,000");
    await expect(trendingSection.getByText("000660", { exact: true })).toBeVisible();
    await expect(trendingMetricFor("000660")).toHaveText("-1.50%");
    await expect(trendingMetricFor("207940")).toHaveText("#4");
    await expect(trendingSection.getByText("035420", { exact: true })).toHaveCount(0);

    await trendingSection.getByRole("tab", { name: /KIS/i }).click();
    await expect(trendingSection.getByText("005930", { exact: true })).toBeVisible();
    await expect(trendingSection.getByText("000660", { exact: true })).toBeVisible();

    await trendingSection.getByRole("button", { name: /^More$/i }).click();
    await expect(trendingSection.getByText("035420", { exact: true })).toBeVisible();
    await expect(trendingMetricFor("035420")).toHaveText("+0.21%");

    await trendingSection.getByRole("tab", { name: /5D/i }).click();
    await expect(trendingSection.getByText("086520", { exact: true })).toBeVisible();
    await expect(trendingSection.getByText("005930", { exact: true })).toHaveCount(0);
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
