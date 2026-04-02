import { devices, expect, test } from "@playwright/test";

test.use({ ...devices["iPhone 13"] });

test.describe("dashboard mobile hero", () => {
  test("mobile shell and overview stay within the first viewport", async ({ page }) => {
    await page.goto("/dashboard");

    const topbar = page.locator("header.topbar");
    const hero = page.locator('section[aria-label="Dashboard overview"]');
    const insightCard = page.locator("article").filter({ hasText: "Lead quote" }).first();
    const heroToggle = page.getByRole("button", { name: "Show overview" });

    await expect(topbar).toBeVisible();
    await expect(hero).toBeVisible();
    await expect(heroToggle).toBeVisible();

    const [viewport, topbarBox, heroBox, insightBox] = await Promise.all([
      page.viewportSize(),
      topbar.boundingBox(),
      hero.boundingBox(),
      insightCard.boundingBox(),
    ]);

    expect(viewport).not.toBeNull();
    expect(topbarBox).not.toBeNull();
    expect(heroBox).not.toBeNull();
    expect(insightBox).not.toBeNull();

    expect(topbarBox!.height).toBeLessThan(180);
    expect(heroBox!.height).toBeLessThan(220);
    expect(heroBox!.y).toBeLessThan(viewport!.height - 40);
    expect(insightBox!.y).toBeLessThan(viewport!.height - 40);

    await heroToggle.click();
    await expect(page.getByRole("button", { name: "Hide overview" })).toBeVisible();
  });
});
