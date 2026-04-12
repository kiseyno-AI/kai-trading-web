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
