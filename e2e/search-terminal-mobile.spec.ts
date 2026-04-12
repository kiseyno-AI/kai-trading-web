import { devices, expect, test } from "@playwright/test";

test.use({ ...devices["iPhone 13"] });

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
});
