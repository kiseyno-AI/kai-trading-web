import { devices, expect, test } from "@playwright/test";

test.use({ ...devices["iPhone 13"] });

test.describe("dashboard mobile hero", () => {
  test("mobile shell and overview stay within the first viewport", async ({ page }) => {
    await page.goto("/dashboard");

    const topbar = page.locator("header.topbar");
    const hero = page.locator('section[aria-label="Dashboard overview"]');

    await expect(topbar).toBeVisible();
    await expect(hero).toBeVisible();

    const [viewport, topbarBox, heroBox] = await Promise.all([
      page.viewportSize(),
      topbar.boundingBox(),
      hero.boundingBox(),
    ]);

    expect(viewport).not.toBeNull();
    expect(topbarBox).not.toBeNull();
    expect(heroBox).not.toBeNull();

    expect(topbarBox!.height).toBeLessThan(360);
    expect(heroBox!.height).toBeLessThan(360);
    expect(heroBox!.y).toBeLessThan(viewport!.height - 40);
  });
});
