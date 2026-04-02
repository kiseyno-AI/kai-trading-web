import { devices, expect, test } from "@playwright/test";

test.use({ ...devices["iPhone 13"] });

test.describe("dashboard mobile hero", () => {
  test("mobile shell and overview stay within the first viewport", async ({ page }) => {
    await page.goto("/dashboard");

    const topbar = page.locator("header.topbar");
    const fallbackBanner = page.locator("section").filter({ hasText: "Mock snapshot active" }).first();
    const hero = page.locator('section[aria-label="Dashboard overview"]');
    const insightCard = page.locator("article").filter({ hasText: "Lead quote" }).first();
    const searchHeading = page.getByRole("heading", { name: /Search the master list and open symbol detail/i });
    const heroToggle = page.getByRole("button", { name: "Show overview" });

    await expect(topbar).toBeVisible();
    await expect(hero).toBeVisible();
    await expect(heroToggle).toBeVisible();
    await expect(searchHeading).toBeVisible();

    const [viewport, topbarBox, fallbackVisible, heroBox, insightBox, searchHeadingBox] = await Promise.all([
      page.viewportSize(),
      topbar.boundingBox(),
      fallbackBanner.isVisible(),
      hero.boundingBox(),
      insightCard.boundingBox(),
      searchHeading.boundingBox(),
    ]);

    expect(viewport).not.toBeNull();
    expect(topbarBox).not.toBeNull();
    expect(heroBox).not.toBeNull();
    expect(insightBox).not.toBeNull();
    expect(searchHeadingBox).not.toBeNull();

    expect(topbarBox!.height).toBeLessThan(180);
    expect(heroBox!.height).toBeLessThan(220);
    expect(heroBox!.y).toBeLessThan(viewport!.height - 40);
    expect(insightBox!.y).toBeLessThan(viewport!.height - 40);
    expect(searchHeadingBox!.y).toBeLessThan(viewport!.height - 40);

    if (fallbackVisible) {
      const fallbackBox = await fallbackBanner.boundingBox();

      expect(fallbackBox).not.toBeNull();
      expect(fallbackBox!.height).toBeLessThan(96);
    }

    await heroToggle.click();
    await expect(page.getByRole("button", { name: "Hide overview" })).toBeVisible();
  });
});
