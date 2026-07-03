import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

test.describe("canonical shell navigation", () => {
  test("desktop rail reaches Markets, Factor Screening, and Bots from the dashboard shell", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard");

    const desktopNav = page.getByRole("navigation", { name: /Primary desktop/i });
    await expect(desktopNav.getByRole("link", { name: "Markets", exact: true })).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "Bots", exact: true })).toBeVisible();

    await desktopNav.getByRole("link", { name: "Markets", exact: true }).click();
    await expect(page).toHaveURL(/\/markets$/);
    await expect(page.getByRole("heading", { name: "Markets" })).toBeVisible();

    await page.getByRole("link", { name: "Open factor screening" }).first().click();
    await expect(page).toHaveURL(/\/markets\/factors$/);
    await expect(page.getByRole("heading", { name: /Factor ranking workspace/i })).toBeVisible();

    await page.getByRole("navigation", { name: /Primary desktop/i }).getByRole("link", { name: "Bots", exact: true }).click();
    await expect(page).toHaveURL(/\/bots$/);
    await expect(page.getByRole("heading", { name: /No live bot roster connected/i })).toBeVisible();
  });

  test("mobile bottom nav reaches Markets, Factor Screening, and Bots from the dashboard shell", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");

    const primaryNav = page.getByRole("navigation", { name: /^Primary$/i });
    await expect(primaryNav.getByRole("link", { name: "Markets", exact: true })).toBeVisible();
    await expect(primaryNav.getByRole("link", { name: "Bots", exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await primaryNav.getByRole("link", { name: "Markets", exact: true }).click();
    await expect(page).toHaveURL(/\/markets$/);
    await expect(page.getByRole("heading", { name: "Markets" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("link", { name: "Open factor screening" }).first().click();
    await expect(page).toHaveURL(/\/markets\/factors$/);
    await expect(page.getByRole("heading", { name: /Factor ranking workspace/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("navigation", { name: /^Primary$/i }).getByRole("link", { name: "Bots", exact: true }).click();
    await expect(page).toHaveURL(/\/bots$/);
    await expect(page.getByRole("heading", { name: /No live bot roster connected/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
