import { devices, expect, test } from "@playwright/test";

test.use({ ...devices["iPhone 13"] });

test.describe("dashboard mobile chrome", () => {
  test("dashboard top chrome is compact and fixed on mobile", async ({ page }) => {
    await page.goto("/dashboard");

    const topbar = page.locator("header.topbar");
    const bottomNav = page.getByRole("navigation", { name: /Primary/i });
    await expect(topbar).toBeVisible();

    const [topbarBox, topbarPosition] = await Promise.all([
      topbar.boundingBox(),
      topbar.evaluate((element) => window.getComputedStyle(element).position),
    ]);

    expect(topbarPosition).toBe("fixed");
    expect(topbarBox).not.toBeNull();
    expect(topbarBox!.height).toBeLessThan(112);
    expect(topbarBox!.x).toBeGreaterThanOrEqual(0);

    await expect(bottomNav).toBeVisible();
    await expect(page.getByText(/Trading Dashboard/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Operational Integrity/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Dashboard/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Search/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /My Symbols/i })).toBeVisible();
  });
});
