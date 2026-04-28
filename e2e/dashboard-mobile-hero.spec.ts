import { expect, test, type Page } from "@playwright/test";

import { chromiumIPhone13 } from "./devices";

test.use(chromiumIPhone13);

async function openProcessMonitorDrawer(page: Page) {
  await page.getByRole("button", { name: /Open process monitor/i }).first().click();
  const drawer = page.getByRole("dialog", { name: /Daily process monitor/i });
  await expect(drawer).toBeVisible();
  return drawer;
}

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
    await expect(page.getByRole("heading", { name: /Decider, portfolio, and market state/i })).toBeVisible();

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
    await expect(hero.getByText(/Insight cockpit/i)).toBeVisible();
    await expect(hero.getByRole("heading", { name: /Decider recommendations/i })).toBeVisible();
    await expect(hero.getByRole("heading", { name: /Portfolio state/i })).toBeVisible();
    await expect(hero.getByRole("heading", { name: /Market condition/i })).toBeVisible();
    await expect(hero.getByText(/EOD Status/i)).toHaveCount(0);
    await expect(hero.getByRole("heading", { name: /Daily Data Fetch/i })).toHaveCount(0);
    await expect(hero.getByRole("heading", { name: /Filtering/i })).toHaveCount(0);
    await expect(hero.getByRole("heading", { name: /Piotroski/i })).toHaveCount(0);
    await expect(hero.getByRole("heading", { name: /KIS Risk/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Open process monitor/i })).toBeVisible();

    const processDrawer = await openProcessMonitorDrawer(page);
    await expect(processDrawer.getByText(/EOD Status/i)).toBeVisible();
    await expect(processDrawer.getByRole("heading", { name: /Daily Data Fetch/i })).toBeVisible();
    await expect(processDrawer.getByRole("heading", { name: /Filtering/i })).toBeVisible();
    await expect(processDrawer.getByRole("heading", { name: /Piotroski/i })).toBeVisible();
    await expect(processDrawer.getByRole("heading", { name: /KIS Risk/i })).toBeVisible();
    await expect(processDrawer.locator('[aria-label="Price Fetch freshness"]')).toBeVisible();
    await expect(processDrawer.locator('[aria-label="Technical Analysis freshness"]')).toBeVisible();
    await expect(processDrawer.locator('[aria-label="Action Summary freshness"]')).toBeVisible();
    await expect(processDrawer.locator('[aria-label="Fundamentals freshness"]')).toBeVisible();
    await expect(hero.getByText(/Succeeded/i)).toHaveCount(0);
    await expect(hero.getByText(/Price Module/i)).toHaveCount(0);
  });
});
