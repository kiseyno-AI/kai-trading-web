import { devices, expect, test } from "@playwright/test";

test.use({ ...devices["iPhone 13"] });

test.describe("dashboard mobile chrome", () => {
  test("dashboard top card is compact and scrolls with the page on mobile", async ({ page }) => {
    await page.goto("/dashboard");

    const topbar = page.locator("header.topbar");
    await expect(topbar).toBeVisible();

    const [topbarBox, topbarPosition] = await Promise.all([
      topbar.boundingBox(),
      topbar.evaluate((element) => window.getComputedStyle(element).position),
    ]);

    expect(topbarPosition).toBe("static");
    expect(topbarBox).not.toBeNull();
    expect(topbarBox!.height).toBeLessThan(96);
    expect(topbarBox!.x).toBeGreaterThanOrEqual(12);

    await expect(page.getByRole("button", { name: "NAV" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Tracked Market Dashboard/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "More" })).toBeVisible();
    await expect(topbar.locator(".search-wrap")).toBeHidden();
    await expect(topbar.locator(".topbar-actions")).toBeHidden();
  });
});
