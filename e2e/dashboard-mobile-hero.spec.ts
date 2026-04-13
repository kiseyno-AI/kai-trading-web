import { devices, expect, test } from "@playwright/test";

test.use({ ...devices["iPhone 13"] });

test.describe("dashboard mobile hero", () => {
  test("mobile shell and overview stay within the first viewport", async ({ page }) => {
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-13",
            eod_status: "completed",
            symbols_total: 4,
            symbols_succeeded: 4,
            symbols_failed: 0,
            received: true,
          },
          latest: {
            price_trade_date: "2026-04-10",
            technical_market_date: "2026-04-10",
            action_market_date: "2026-04-10",
          },
          price: {
            success: true,
            latest_date: "2026-04-10",
          },
          technical: {
            success: true,
            latest_date: "2026-04-10",
          },
          action: {
            success: true,
            latest_date: "2026-04-10",
          },
        }),
      });
    });

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
    await expect(hero.getByText(/EOD Recent Update/i)).toBeVisible();
    await expect(hero.locator("strong").filter({ hasText: /^Received$/ })).toBeVisible();
    await expect(hero.getByText(/Latest stored EOD/i)).toBeVisible();
    await expect(hero.locator("dd").filter({ hasText: /^2026-04-10$/ })).toBeVisible();
    await expect(hero.getByText(/Market date/i)).toBeVisible();
    await expect(hero.locator("dd").filter({ hasText: /^2026-04-13$/ })).toBeVisible();
    await expect(hero.getByText(/Price Module/i)).toHaveCount(0);
  });
});
