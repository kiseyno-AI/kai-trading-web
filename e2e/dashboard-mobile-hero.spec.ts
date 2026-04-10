import { devices, expect, test } from "@playwright/test";

test.use({ ...devices["iPhone 13"] });

test.describe("dashboard mobile hero", () => {
  test("mobile shell and overview stay within the first viewport", async ({ page }) => {
    await page.goto("/dashboard");

    const topbar = page.locator("header.topbar");
    const hero = page.locator("#dashboard-freshness");
    const navButton = topbar.getByRole("button", { name: /Open navigation/i });

    await expect(topbar).toBeVisible();
    await expect(hero).toBeVisible();
    await expect(navButton).toBeVisible();
    await expect(page.getByRole("heading", { name: /Tracked Market Dashboard/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Operational Integrity/i })).toBeVisible();

    const [viewport, topbarBox, heroBox] = await Promise.all([
      page.viewportSize(),
      topbar.boundingBox(),
      hero.boundingBox(),
    ]);

    expect(viewport).not.toBeNull();
    expect(topbarBox).not.toBeNull();
    expect(heroBox).not.toBeNull();

    expect(topbarBox!.height).toBeLessThan(360);
    expect(heroBox!.y).toBeLessThan(viewport!.height - 40);
    expect(heroBox!.x).toBeGreaterThanOrEqual(0);
    await expect(hero.getByText(/Market Freshness Registry/i)).toBeVisible();
    await expect(hero.getByText(/Price Module/i)).toBeVisible();
  });
});
