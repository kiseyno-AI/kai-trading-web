import { expect, test } from "@playwright/test";

import { chromiumIPhone13 } from "./devices";

test.use(chromiumIPhone13);

test.describe("dashboard mobile hero", () => {
  test("mobile shell and overview stay within the first viewport", async ({ page }) => {
    await page.goto("/dashboard");

    const topbar = page.locator("header.topbar");
    const hero = page.locator("#dashboard-freshness");
    const bottomNav = page.getByRole("navigation", { name: /Primary/i });

    await expect(topbar).toBeVisible();
    await expect(hero).toBeVisible();
    await expect(bottomNav).toBeVisible();
    await expect(page.getByText(/Trading Dashboard/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Operational Integrity/i })).toBeVisible();

    const [viewport, topbarBox, heroBox] = await Promise.all([
      page.viewportSize(),
      topbar.boundingBox(),
      hero.boundingBox(),
    ]);

    expect(viewport).not.toBeNull();
    expect(topbarBox).not.toBeNull();
    expect(heroBox).not.toBeNull();

    expect(topbarBox!.height).toBeLessThan(120);
    expect(heroBox!.y).toBeLessThan(viewport!.height - 40);
    expect(heroBox!.x).toBeGreaterThanOrEqual(0);
    await expect(hero.getByText(/Market Freshness Registry/i)).toBeVisible();
    await expect(hero.getByText(/EOD Status/i)).toBeVisible();
    await expect(hero.getByText(/Price Fetch/i)).toBeVisible();
    await expect(hero.getByText(/Technical Analysis/i)).toBeVisible();
    await expect(hero.getByText(/Action Summary/i)).toBeVisible();
    await expect(hero.getByText(/Fundamentals/i)).toBeVisible();
    await expect(hero.getByText(/Succeeded/i).first()).toBeVisible();
    await expect(hero.getByText(/Price Module/i)).toHaveCount(0);
  });
});
