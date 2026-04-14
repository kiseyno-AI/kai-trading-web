import { expect, test } from "@playwright/test";

test.describe("search terminal desktop", () => {
  test("renders the Stitch centered terminal layout", async ({ page }) => {
    await page.goto("/search");

    await expect(page.getByRole("navigation", { name: /Primary desktop/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Universal Search/i })).toBeVisible();
    await expect(page.getByLabel(/Search markets, symbols, or analysis/i)).toBeVisible();
    await expect(page.getByText(/Quick Access \/ Recent/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Search Results/i })).toBeVisible();
    await expect(page.getByText(/Selected Terminal Feed/i)).toBeVisible();
    await expect(page.getByText(/Search workspace/i)).toHaveCount(0);
  });

  test("updates the terminal result title from the query", async ({ page }) => {
    await page.goto("/search");

    await page.getByLabel(/Search markets, symbols, or analysis/i).fill("005930");
    await expect(page.getByRole("heading", { name: /Results for "005930"/i })).toBeVisible();
  });

  test("Q3 clear all empties quick access even when query results are loaded", async ({ page }) => {
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

    const quickSection = page.locator("section").filter({ hasText: "Quick Access / Recent" }).first();
    await expect(quickSection.getByRole("button", { name: /000660/i })).toBeVisible();

    await page.getByLabel(/Search markets, symbols, or analysis/i).fill("005930");
    await expect(quickSection.getByRole("button", { name: /005930/i })).toBeVisible();

    await quickSection.getByRole("button", { name: /Clear All/i }).click();

    await expect(quickSection.getByRole("button", { name: /000660/i })).toHaveCount(0);
    await expect(quickSection.getByRole("button", { name: /005930/i })).toHaveCount(0);
    await expect(quickSection.getByText(/No recent symbols/i)).toBeVisible();
    await expect(quickSection.getByRole("button", { name: /Add Favorite/i })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("kai.search.recent-symbols")))
      .toBeNull();
  });

  test("Q3 add favorite saves the current symbol through the core tracked-symbol flow", async ({ page }) => {
    let postedSymbols: string[] | null = null;

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
        postedSymbols = JSON.parse(route.request().postData() ?? "{}").symbols;
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
    const quickSection = page.locator("section").filter({ hasText: "Quick Access / Recent" }).first();

    await page.getByLabel(/Search markets, symbols, or analysis/i).fill("005930");
    await expect(quickSection.getByRole("button", { name: /005930/i })).toBeVisible();

    await quickSection.getByRole("button", { name: /Clear All/i }).click();
    await expect(quickSection.getByText(/No recent symbols/i)).toBeVisible();

    await quickSection.getByRole("button", { name: "Add Favorite" }).click();

    await expect.poll(() => postedSymbols).toEqual(["005930", "000660"]);
    await expect(quickSection.getByRole("button", { name: /005930/i })).toBeVisible();
    await expect(quickSection.getByText(/005930 saved to core favorites/i)).toBeVisible();
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
    const quickSection = page.locator("section").filter({ hasText: "Quick Access / Recent" }).first();

    await page.getByLabel(/Search markets, symbols, or analysis/i).fill("005930");
    await expect(quickSection.getByRole("button", { name: /005930/i })).toBeVisible();

    await quickSection.getByRole("button", { name: "+ Favorite" }).click();

    await expect(quickSection.getByText(/Favorite save blocked until tracked symbols load successfully. HTTP 503/i)).toBeVisible();
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
    await expect(resultRow.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/dashboard/symbol/000000");
  });
});
