import { expect, test, type Locator, type Page } from "@playwright/test";

function getQuickAccessSection(page: Page) {
  return page.locator("section", { has: page.getByRole("heading", { name: /Quick Access|빠른 접근/ }) }).first();
}

async function expectMinimumTargetSize(locator: Locator, minimumSize = 44) {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error("Expected quick-access add control to have a rendered bounding box");
  }

  expect(box.width).toBeGreaterThanOrEqual(minimumSize);
  expect(box.height).toBeGreaterThanOrEqual(minimumSize);

  return box;
}

async function expectVisibleAffordance(locator: Locator) {
  const styles = await locator.evaluate((element) => {
    const computedStyles = window.getComputedStyle(element);

    return {
      backgroundColor: computedStyles.backgroundColor,
      borderWidth: Number.parseFloat(computedStyles.borderTopWidth),
    };
  });

  expect(styles.borderWidth).toBeGreaterThanOrEqual(1);
  expect(styles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
}

test.describe("search terminal desktop", () => {
  test("renders the Stitch centered terminal layout", async ({ page }) => {
    await page.goto("/search");

    await expect(page.getByRole("navigation", { name: /Primary desktop/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Universal Search/i })).toBeVisible();
    await expect(page.getByLabel(/Search markets, symbols, or analysis/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Quick Access" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Search Results/i })).toBeVisible();
    await expect(page.getByText(/Selected Terminal Feed/i)).toHaveCount(0);
    await expect(page.getByText(/Search workspace/i)).toHaveCount(0);
  });

  test("keeps the quick-access favorite add control target sized on desktop", async ({ page }) => {
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

    const addControl = getQuickAccessSection(page).getByRole("button", { name: /Open favorite search/i });
    await expect(addControl).toHaveAccessibleDescription("No favorites");
    await expectMinimumTargetSize(addControl);
    await expectVisibleAffordance(addControl);

    await addControl.focus();
    const focusStyle = await addControl.evaluate((element) => {
      const styles = window.getComputedStyle(element);

      return {
        outlineStyle: styles.outlineStyle,
        outlineWidth: Number.parseFloat(styles.outlineWidth),
      };
    });
    expect(focusStyle.outlineStyle).not.toBe("none");
    expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(2);

    await addControl.click();
    await expect(page.getByRole("dialog", { name: /Save Symbol/i })).toBeVisible();
  });

  test("resets the header badge to the closed fallback when market status fails", async ({ page }) => {
    let marketStatusRequests = 0;
    await page.clock.install({ time: new Date("2026-04-14T09:00:00+09:00") });

    await page.route("**/api/trading/market/status", async (route) => {
      marketStatusRequests += 1;
      if (marketStatusRequests > 1) {
        await route.fulfill({
          status: 503,
          json: { error: "market status unavailable" },
        });
        return;
      }

      await route.fulfill({
        json: {
          state: "OPEN",
          is_open: true,
          server_time: "2026-04-14T09:00:00+09:00",
        },
      });
    });
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
    await page.route("**/api/trading/scanner/realtime-trending?**", async (route) => {
      await route.fulfill({
        json: {
          status: "ok",
          source: "kis",
          as_of: "2026-04-14T16:00:00+09:00",
          market: "KRX",
          summary: {
            item_count: 0,
          },
          items: [],
        },
      });
    });

    await page.goto("/search");
    const banner = page.getByRole("banner");

    await expect.poll(() => marketStatusRequests).toBe(1);
    await expect(banner.getByText("Market Open")).toBeVisible();

    await page.clock.runFor(60_000);

    await expect.poll(() => marketStatusRequests).toBe(2);
    await expect(banner.getByText("Market Closed")).toBeVisible();
    await expect(banner.getByText("Market Open")).toHaveCount(0);
  });

  test("updates the terminal result title from the query", async ({ page }) => {
    await page.goto("/search");

    await page.getByLabel(/Search markets, symbols, or analysis/i).fill("005930");
    await expect(page.getByRole("heading", { name: /Results for "005930"/i })).toBeVisible();
  });

  test("preserves suggestion avatar column when badge is hidden for KRX symbols", async ({ page }) => {
    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({ json: { count: 0, items: [] } });
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
      const query = requestUrl.searchParams.get("q");

      await route.fulfill({
        json: {
          query,
          count: query === "000660" ? 1 : 0,
          items:
            query === "000660"
              ? [
                  {
                    symbol: "000660",
                    standard_code: "KR7000660001",
                    name_ko: "SK hynix",
                    market: "KRX",
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
            item_count: 0,
          },
          items: [],
        },
      });
    });

    await page.goto("/search");
    await page.getByLabel(/Search markets, symbols, or analysis/i).fill("000660");

    const suggestion = page.getByRole("link", { name: /000660.*SK hynix/i });
    await expect(suggestion).toBeVisible();
    await expect(suggestion.locator("> *")).toHaveCount(3);
    await expect(suggestion.locator("> *").first()).toHaveAttribute("aria-hidden", "true");
    await expect(suggestion.locator("> *").first()).toHaveText("");
  });

  test("does not request blank search and reuses session cache after reload", async ({ page }) => {
    const requestCounts = {
      favorites: 0,
      metadataSearch: 0,
      tracked: 0,
      search: 0,
      trending: 0,
    };
    const interactiveSearchQueries: Array<string | null> = [];

    await page.route("**/api/trading/symbols/favorites", async (route) => {
      requestCounts.favorites += 1;
      await route.fulfill({
        json: {
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
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      requestCounts.tracked += 1;
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
      if (requestUrl.searchParams.get("limit") === "5") {
        requestCounts.metadataSearch += 1;
      } else {
        interactiveSearchQueries.push(query);
        requestCounts.search += 1;
      }
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
      requestCounts.trending += 1;
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
              symbol: "005930",
              name: "Samsung Electronics",
              market: "KRX",
              price: 71500,
              change_pct: 0.84,
              best_rank: 1,
              source_count: 1,
              sources: [
                {
                  source: "volume-rank",
                  source_label: "volume-rank",
                  rank: 1,
                  metric: { name: "volume", value: 250000, unit: "shares" },
                },
              ],
            },
          ],
        },
      });
    });

    await page.goto("/search");

    const quickSection = getQuickAccessSection(page);
    await expect(quickSection.getByRole("button", { name: /005930.*Samsung Electronics/i })).toBeVisible();
    await expect(page.getByRole("row", { name: /005930.*Samsung Electronics/i })).toHaveCount(0);
    await expect.poll(() => requestCounts).toEqual({
      favorites: 1,
      metadataSearch: 1,
      tracked: 1,
      search: 0,
      trending: 1,
    });
    expect(interactiveSearchQueries).toEqual([]);

    await page.getByLabel(/Search markets, symbols, or analysis/i).fill("005930");
    await expect(page.getByRole("row", { name: /005930.*Samsung Electronics/i })).toBeVisible();
    await expect.poll(() => requestCounts).toEqual({
      favorites: 1,
      metadataSearch: 1,
      tracked: 1,
      search: 1,
      trending: 1,
    });
    expect(interactiveSearchQueries).toEqual(["005930"]);

    await page.reload();

    await expect(quickSection.getByRole("button", { name: /005930.*Samsung Electronics/i })).toBeVisible();
    await expect(page.getByRole("row", { name: /005930.*Samsung Electronics/i })).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(requestCounts).toEqual({
      favorites: 1,
      metadataSearch: 1,
      tracked: 1,
      search: 1,
      trending: 1,
    });
    expect(interactiveSearchQueries).toEqual(["005930"]);
  });

  test("keeps the search screen composed when quick access API is unavailable", async ({ page }) => {
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

    const quickSection = getQuickAccessSection(page);
    await expect(quickSection.getByRole("button", { name: /Open favorite search/i })).toHaveAccessibleDescription(
      "Unavailable",
    );
    await expect(quickSection.locator("strong").filter({ hasText: /^Unavailable$/ })).toBeVisible();
    await expect(quickSection.getByText(/Favorite list unavailable\. HTTP 503/i)).toBeVisible();
    await expect(page.getByRole("row", { name: /005930.*Samsung Electronics/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Results for "005930"/i })).toBeVisible();
    await expect(page.getByText(/Selected Terminal Feed/i)).toHaveCount(0);
  });

  test("resolves search gateway timeouts into an unavailable state", async ({ page }) => {
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
          as_of: "2026-04-14T09:00:00Z",
          market: "KRX",
          summary: { item_count: 0 },
          items: [],
        },
      });
    });
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      await route.fulfill({
        status: 504,
        json: {
          error: "Upstream request timed out",
          message: "Timed out after 5.0s while loading /symbols/search from trading-core.",
        },
      });
    });

    await page.goto("/search");
    await page.getByLabel(/Search markets, symbols, or analysis/i).fill("삼성전자");

    await expect(page.getByText(/Search endpoint unavailable.*HTTP 504/i).first()).toBeVisible();
    await expect(page.getByText("Searching...")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Results for "삼성전자"/i })).toBeVisible();
  });

  test("Q3 renders core favorites instead of tracked or recent symbols", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "kai.search.recent-symbols",
        JSON.stringify([
          {
            symbol: "035420",
            standard_code: "KR7035420009",
            name_ko: "NAVER",
            market: "KOSPI",
          },
        ]),
      );
    });
    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({
        json: {
          count: 1,
          items: [
            {
              symbol: "005930",
              standard_code: "KR7005930003",
              name_ko: "Samsung Electronics",
              market: "KOSPI",
              instrument_type: "equity",
              is_active: true,
              sort_order: 0,
              favorited_at: "2026-04-14T13:35:00+09:00",
            },
          ],
        },
      });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      await route.fulfill({
        json: {
          tracked_symbols: ["000660"],
          count: 1,
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

    const quickSection = getQuickAccessSection(page);
    await expect(quickSection.getByText(/Core favorites/i)).toBeVisible();
    await expect(quickSection.getByRole("button", { name: /Open favorite search/i })).toHaveAccessibleDescription(
      "Core favorites",
    );
    await expect(quickSection.getByRole("button", { name: /005930.*Samsung Electronics/i })).toBeVisible();
    await expect(quickSection.getByRole("button", { name: /000660/i })).toHaveCount(0);
    await expect(quickSection.getByRole("button", { name: /035420|NAVER/i })).toHaveCount(0);
  });

  test("Q3 labels unsupported favorites before detail navigation and preserves supported favorite navigation", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("trading-web.locale", JSON.stringify("ko"));
    });
    await page.route("**/api/trading/market/status", async (route) => {
      await route.fulfill({
        json: {
          state: "CLOSED",
          is_open: false,
          server_time: "2026-04-14T16:00:00+09:00",
        },
      });
    });
    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({
        json: {
          count: 2,
          items: [
            {
              symbol: "F70100026",
              standard_code: null,
              name_ko: "한투글로벌넥스트웨이브1(A)",
              market: "KOSPI",
              instrument_type: "fund",
              is_active: true,
              sort_order: 0,
              favorited_at: "2026-05-23T06:30:00+09:00",
            },
            {
              symbol: "005930",
              standard_code: "KR7005930003",
              name_ko: "삼성전자",
              market: "KOSPI",
              instrument_type: "stock",
              is_active: true,
              sort_order: 1,
              favorited_at: "2026-04-14T13:35:00+09:00",
            },
          ],
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
          as_of: "2026-04-14T16:00:00+09:00",
          market: "KRX",
          summary: {
            item_count: 0,
          },
          items: [],
        },
      });
    });

    await page.goto("/search");

    const quickSection = getQuickAccessSection(page);
    await expect(quickSection.getByRole("heading", { name: "빠른 접근" })).toBeVisible();
    const unsupportedFavorite = quickSection.getByRole("group", {
      name: /F70100026.*한투글로벌넥스트웨이브1\(A\).*지원 제한/,
    });
    await expect(unsupportedFavorite).toBeVisible();
    await expect(unsupportedFavorite).toContainText("지원 제한");
    await expect(unsupportedFavorite).toContainText("주식 상세 커버리지 밖");
    await expect(quickSection.getByRole("button", { name: /F70100026/ })).toHaveCount(0);

    const supportedFavorite = quickSection.getByRole("button", { name: /005930.*삼성전자/ });
    await expect(supportedFavorite).toBeVisible();
    await Promise.all([page.waitForURL(/\/dashboard\/symbol\/005930\?.*navContext=search/), supportedFavorite.click()]);
  });

  test("Q3 stays empty by default and opens favorite search autocomplete from +", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "kai.search.recent-symbols",
        JSON.stringify([
          {
            symbol: "000660",
            standard_code: "KR7000660001",
            name_ko: "SK hynix",
            market: "KOSPI",
          },
        ]),
      );
    });
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
      const requestUrl = new URL(route.request().url());
      const query = requestUrl.searchParams.get("q");

      await route.fulfill({
        json: {
          query: query ?? "",
          count: query === "005930" || query === "" ? 1 : 0,
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
              : query === ""
                ? [
                    {
                      symbol: "000660",
                      standard_code: "KR7000660001",
                      name_ko: "SK hynix",
                      market: "KOSPI",
                    },
                  ]
                : [],
        },
      });
    });

    await page.goto("/search");

    const quickSection = getQuickAccessSection(page);
    await expect(quickSection.getByText(/No favorites saved/i)).toBeVisible();
    await expect(quickSection.getByRole("button", { name: /000660/i })).toHaveCount(0);
    await expect(quickSection.getByRole("button", { name: /\+ Favorite|Add Favorite|Clear All/i })).toHaveCount(0);

    await page.getByLabel(/Search markets, symbols, or analysis/i).fill("005930");
    await expect(quickSection.getByRole("button", { name: /005930/i })).toHaveCount(0);

    const openFavoriteSearch = quickSection.getByRole("button", { name: /Open favorite search/i });
    await expect(openFavoriteSearch).toContainText("+");
    await expect(openFavoriteSearch).toContainText(/No favorites/i);
    await expect(openFavoriteSearch).toHaveAccessibleDescription("No favorites");
    await openFavoriteSearch.click();

    const dialog = page.getByRole("dialog", { name: /Save Symbol/i });
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel(/Favorite symbol search/i)).toBeFocused();

    await page.getByLabel(/Favorite symbol search/i).fill("005930");
    await expect(dialog.getByRole("button", { name: /005930.*Samsung Electronics/i })).toBeVisible();
  });

  test("Q3 + favorite search saves an autocomplete result through the core tracked-symbol flow", async ({ page }) => {
    let favoriteRequests = 0;
    let trackedPostSucceeded = false;
    let postedSymbols: string[] | null = null;

    await page.route("**/api/trading/symbols/favorites", async (route) => {
      favoriteRequests += 1;
      await route.fulfill({
        json: {
          count: trackedPostSucceeded ? 1 : 0,
          items: trackedPostSucceeded
            ? [
                {
                  symbol: "005930",
                  standard_code: "KR7005930003",
                  name_ko: "Samsung Electronics DB",
                  market: "KOSPI",
                  instrument_type: "equity",
                  is_active: true,
                  sort_order: 0,
                  favorited_at: "2026-04-14T09:00:00+09:00",
                },
              ]
            : [],
        },
      });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      if (route.request().method() === "POST") {
        postedSymbols = JSON.parse(route.request().postData() ?? "{}").symbols;
        trackedPostSucceeded = true;
        await route.fulfill({
          json: {
            tracked_symbols: postedSymbols,
            count: postedSymbols?.length ?? 0,
            last_updated_at: "2026-04-14T09:00:00+09:00",
          },
        });
        return;
      }

      await route.fulfill({
        json: {
          tracked_symbols: ["000660"],
          count: 1,
          last_updated_at: "2026-04-14T08:55:00+09:00",
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

    await page.goto("/search");
    const quickSection = getQuickAccessSection(page);

    await quickSection.getByRole("button", { name: /Open favorite search/i }).click();
    const dialog = page.getByRole("dialog", { name: /Save Symbol/i });
    await page.getByLabel(/Favorite symbol search/i).fill("005930");
    await dialog.getByRole("button", { name: /005930.*Samsung Electronics/i }).click();

    await expect.poll(() => postedSymbols).toEqual(["005930", "000660"]);
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => favoriteRequests).toBe(2);
    await expect(quickSection.getByRole("button", { name: /005930.*Samsung Electronics DB/i })).toBeVisible();
    await expect(quickSection.getByText(/005930 saved to core favorites/i)).toBeVisible();
  });

  test("Q3 + favorite search saves a typed symbol through the dialog Add action", async ({ page }) => {
    let favoriteRequests = 0;
    let trackedPostSucceeded = false;
    let postedSymbols: string[] | null = null;

    await page.route("**/api/trading/symbols/favorites", async (route) => {
      favoriteRequests += 1;
      await route.fulfill({
        json: {
          count: trackedPostSucceeded ? 1 : 0,
          items: trackedPostSucceeded
            ? [
                {
                  symbol: "005930",
                  standard_code: "KR7005930003",
                  name_ko: "Samsung Electronics DB",
                  market: "KOSPI",
                  instrument_type: "equity",
                  is_active: true,
                  sort_order: 0,
                  favorited_at: "2026-04-14T09:02:00+09:00",
                },
              ]
            : [],
        },
      });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      if (route.request().method() === "POST") {
        postedSymbols = JSON.parse(route.request().postData() ?? "{}").symbols;
        trackedPostSucceeded = true;
        await route.fulfill({
          json: {
            tracked_symbols: postedSymbols,
            count: postedSymbols?.length ?? 0,
            last_updated_at: "2026-04-14T09:02:00+09:00",
          },
        });
        return;
      }

      await route.fulfill({
        json: {
          tracked_symbols: ["000660"],
          count: 1,
          last_updated_at: "2026-04-14T08:55:00+09:00",
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

    await page.goto("/search");
    const quickSection = getQuickAccessSection(page);

    await quickSection.getByRole("button", { name: /Open favorite search/i }).click();
    const dialog = page.getByRole("dialog", { name: /Save Symbol/i });
    const favoriteInput = page.getByLabel(/Favorite symbol search/i);
    await favoriteInput.fill("005930");

    await expect(dialog.getByRole("button", { name: /005930.*Samsung Electronics/i })).toBeVisible();
    await dialog.getByRole("button", { name: /^Add$/ }).click();

    await expect.poll(() => postedSymbols).toEqual(["005930", "000660"]);
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => favoriteRequests).toBe(2);
    await expect(quickSection.getByRole("button", { name: /005930.*Samsung Electronics DB/i })).toBeVisible();
    await expect(quickSection.getByText(/005930 saved to core favorites/i)).toBeVisible();
  });

  test("Q3 preserves saved tracked symbols and validates the full favorites refresh payload", async ({ page }) => {
    const postedSymbols: string[][] = [];
    let trackedSymbols = ["000660"];

    await page.route("**/api/trading/symbols/favorites", async (route) => {
      if (postedSymbols.length === 1) {
        await route.fulfill({
          status: 503,
          json: { error: "favorites unavailable" },
        });
        return;
      }

      await route.fulfill({
        json: {
          count: postedSymbols.length > 1 ? 5 : 0,
          items:
            postedSymbols.length > 1
              ? [
                  {
                    symbol: "000660",
                    standard_code: "KR7000660001",
                    name_ko: "SK hynix",
                    market: "KOSPI",
                  },
                  {
                    symbol: "005930",
                    standard_code: "KR7005930003",
                    name_ko: "Samsung Electronics",
                    market: "KOSPI",
                  },
                  {
                    symbol: "051910",
                    standard_code: "KR7051910008",
                    name_ko: "LG Chem",
                    market: "KOSPI",
                  },
                  {
                    symbol: "035720",
                    standard_code: "KR7035720002",
                    name_ko: "Kakao",
                    market: "KOSPI",
                  },
                  {
                    symbol: "035420",
                    standard_code: "KR7035420009",
                    name_ko: "NAVER",
                    market: "KOSPI",
                  },
                ]
              : [],
        },
      });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      if (route.request().method() === "POST") {
        const symbols = JSON.parse(route.request().postData() ?? "{}").symbols as string[];
        trackedSymbols = symbols;
        postedSymbols.push(symbols);
        await route.fulfill({
          json: {
            tracked_symbols: symbols,
            count: symbols.length,
            last_updated_at: "2026-04-14T09:05:00+09:00",
          },
        });
        return;
      }

      await route.fulfill({
        json: {
          tracked_symbols: trackedSymbols,
          count: trackedSymbols.length,
          last_updated_at: "2026-04-14T08:55:00+09:00",
        },
      });
    });
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const query = requestUrl.searchParams.get("q");

      await route.fulfill({
        json: {
          query: query ?? "",
          count: query === "005930" || query === "035420" ? 1 : 0,
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
              : query === "035420"
                ? [
                    {
                      symbol: "035420",
                      standard_code: "KR7035420009",
                      name_ko: "NAVER",
                      market: "KOSPI",
                    },
                  ]
                : [],
        },
      });
    });

    await page.goto("/search");
    const quickSection = getQuickAccessSection(page);

    await quickSection.getByRole("button", { name: /Open favorite search/i }).click();
    const dialog = page.getByRole("dialog", { name: /Save Symbol/i });
    const favoriteInput = page.getByLabel(/Favorite symbol search/i);

    await favoriteInput.fill("005930");
    await dialog.getByRole("button", { name: /005930.*Samsung Electronics/i }).click();

    await expect(dialog.getByText(/Favorite saved but core favorites refresh failed. HTTP 503/i)).toBeVisible();
    await expect.poll(() => postedSymbols).toEqual([["005930", "000660"]]);

    await favoriteInput.fill("035420");
    await dialog.getByRole("button", { name: /035420.*NAVER/i }).click();

    await expect.poll(() => postedSymbols).toEqual([
      ["005930", "000660"],
      ["035420", "005930", "000660"],
    ]);
    await expect(dialog).toHaveCount(0);
    await expect(quickSection.getByText(/035420 saved to core favorites/i)).toBeVisible();
    await expect(quickSection.getByText(/035420 was not returned by core favorites/i)).toHaveCount(0);
    await expect(quickSection.getByRole("button", { name: /035420.*NAVER/i })).toHaveCount(0);
  });

  test("Q3 + favorite search does not submit company-name text as a symbol", async ({ page }) => {
    let postAttempted = false;

    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({
        json: {
          count: 0,
          items: [],
        },
      });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      if (route.request().method() === "POST") {
        postAttempted = true;
        await route.fulfill({
          status: 500,
          json: { error: "unexpected POST" },
        });
        return;
      }

      await route.fulfill({
        json: {
          tracked_symbols: ["000660"],
          count: 1,
          last_updated_at: "2026-04-14T08:55:00+09:00",
        },
      });
    });
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const query = requestUrl.searchParams.get("q");

      await route.fulfill({
        json: {
          query: query ?? "",
          count: query === "Samsung Electronics" ? 1 : 0,
          items:
            query === "Samsung Electronics"
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

    await page.goto("/search");
    await page.getByLabel(/Search markets, symbols, or analysis/i).fill("Samsung Electronics");
    await expect(page.getByRole("row", { name: /005930.*Samsung Electronics/i })).toBeVisible();

    const quickSection = getQuickAccessSection(page);
    await quickSection.getByRole("button", { name: /Open favorite search/i }).click();

    const dialog = page.getByRole("dialog", { name: /Save Symbol/i });
    const favoriteInput = page.getByLabel(/Favorite symbol search/i);
    await expect(dialog).toBeVisible();
    await expect(favoriteInput).toHaveValue("");

    await favoriteInput.fill("Samsung Electronics");
    await expect(dialog.getByRole("button", { name: /005930.*Samsung Electronics/i })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Add" })).toBeDisabled();

    await favoriteInput.press("Enter");

    await expect(dialog).toBeVisible();
    expect(postAttempted).toBe(false);
  });

  test("Q3 add favorite does not post when tracked symbols fail to load", async ({ page }) => {
    let postAttempted = false;

    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({
        json: {
          count: 0,
          items: [],
        },
      });
    });
    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      if (route.request().method() === "POST") {
        postAttempted = true;
        await route.fulfill({
          status: 500,
          json: { error: "unexpected POST" },
        });
        return;
      }

      await route.fulfill({
        status: 503,
        json: { error: "tracked symbols unavailable" },
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

    await page.goto("/search");
    const quickSection = getQuickAccessSection(page);

    await quickSection.getByRole("button", { name: /Open favorite search/i }).click();
    const dialog = page.getByRole("dialog", { name: /Save Symbol/i });
    await page.getByLabel(/Favorite symbol search/i).fill("005930");
    await dialog.getByRole("button", { name: /005930.*Samsung Electronics/i }).click();

    await expect(dialog.getByText(/Favorite save blocked until tracked symbols refresh succeeds. HTTP 503/i)).toBeVisible();
    expect(postAttempted).toBe(false);
  });

  test("omits placeholder metadata from symbol detail links", async ({ page }) => {
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const query = requestUrl.searchParams.get("q");
      await route.fulfill({
        json: {
          query: query ?? "",
          count: query === "MISSING" ? 1 : 0,
          items:
            query === "MISSING"
              ? [
                  {
                    symbol: "000000",
                    standard_code: "",
                    name_ko: "",
                    market: "",
                  },
                ]
              : [],
        },
      });
    });

    await page.goto("/search");
    await page.getByLabel(/Search markets, symbols, or analysis/i).fill("MISSING");

    const resultRow = page.getByRole("row", { name: /000000/i });
    await expect(resultRow).toBeVisible();
    await expect(resultRow.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      /\/dashboard\/symbol\/000000\?.*(navContext=search.*q=MISSING|q=MISSING.*navContext=search)/,
    );
  });

  test("keeps symbol detail context when returning from search results", async ({ page }) => {
    const encodedSearchQuery = encodeURIComponent("삼성");

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
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const query = requestUrl.searchParams.get("q");

      await route.fulfill({
        json: {
          query: query ?? "",
          count: query === "삼성" ? 1 : 0,
          items:
            query === "삼성"
              ? [
                  {
                    symbol: "005930",
                    standard_code: "KR7005930003",
                    name_ko: "삼성전자",
                    market: "KOSPI",
                  },
                ]
              : [],
        },
      });
    });
    await page.route("**/api/trading/quotes/005930", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          symbol: "005930",
          company_name: "삼성전자",
          price: 71500,
          change: 700,
          change_pct: 0.99,
          volume: 120000,
          turnover: 8580000000,
          market_state: "OPEN",
          source: "kis",
          fallback: false,
          is_live: true,
          available: true,
          trade_date: "2026-04-14",
          cached_at: "2026-04-14T09:00:00+09:00",
        }),
      });
    });
    await page.route("**/api/trading/market/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          state: "OPEN",
          is_open: true,
          server_time: "2026-04-14T09:00:00+09:00",
        }),
      });
    });
    await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-14",
          summary: {
            entries: 0,
            requested_symbol: "005930",
            matched_symbols: ["005930"],
            missing_symbols: [],
            passed_count: 0,
            not_passed_count: 0,
          },
          item: null,
        }),
      });
    });
    await page.route("**/api/trading/agent-context/symbol-day?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: "2026-04-14",
            symbols: ["005930"],
            fs_div: null,
            fs_label: null,
            disclosures_limit: 4,
          },
          summary: {
            requested_symbol_count: 1,
            matched_symbol_count: 1,
            technical_snapshot_count: 0,
            action_summary_count: 0,
            fundamentals_count: 0,
            recent_disclosure_symbol_count: 0,
            missing_symbols: [],
          },
          items: [
            {
              symbol: "005930",
              market_date: "2026-04-14",
              company: {
                symbol: "005930",
                name_ko: "삼성전자",
                market: "KOSPI",
                instrument_type: "stock",
                standard_code: "KR7005930003",
                source: "test",
                is_active: true,
                last_refreshed_at: null,
                dart: {
                  corp_code: "00126380",
                  corp_name: "삼성전자",
                },
              },
              technical_snapshot: null,
              action_summary: null,
              fundamentals: {
                latest_snapshot: null,
                history_summary: {
                  entries: 0,
                  latest_receipt_date: null,
                  latest_period_end_date: null,
                  available_business_years: [],
                  recent_periods: [],
                },
              },
              recent_disclosures: {
                count: 0,
                items: [],
              },
              availability: {
                company: true,
                technical_snapshot: false,
                action_summary: false,
                fundamentals: false,
                recent_disclosures: false,
              },
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/symbols/005930/price-bars?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          symbol: "005930",
          count: 1,
          start_date: "2026-04-14",
          end_date: "2026-04-14",
          requested_start_date: "2026-01-13",
          requested_end_date: "2026-04-14",
          items: [
            {
              trade_date: "2026-04-14",
              open_price: 70500,
              high_price: 71900,
              low_price: 70300,
              close_price: 71500,
              volume: 120000,
              turnover: 8580000000,
              source: "kis",
              captured_at: "2026-04-14T16:00:00+09:00",
            },
          ],
        }),
      });
    });

    await page.goto("/search");
    await page.getByLabel(/Search markets, symbols, or analysis/i).fill("삼성");
    const suggestion = page.getByRole("link", { name: /005930.*삼성전자/i });

    await expect(suggestion).toBeVisible();
    await expect(suggestion).toHaveAttribute(
      "href",
      new RegExp(`\\/dashboard\\/symbol\\/005930\\?.*navContext=search.*q=${encodedSearchQuery}`),
    );
    await suggestion.click();

    await expect(page).toHaveURL(/\/dashboard\/symbol\/005930/);
    await expect(page).toHaveURL(/navContext=search/);
    await expect(page.getByRole("link", { name: /Back to search/i })).toBeVisible();
    await page.getByRole("link", { name: /Back to search/i }).click();
    await expect(page).toHaveURL(`/search?q=${encodedSearchQuery}`);
  });
});
