import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

test.describe("canonical shell navigation", () => {
  test("desktop rail keeps full-page chrome scoped to primary destinations", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard");

    const desktopNav = page.getByRole("navigation", { name: /Primary desktop/i });
    await expect(desktopNav.getByRole("link")).toHaveCount(5);
    await expect(desktopNav.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "Search", exact: true })).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "Calendar", exact: true })).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "Assets", exact: true })).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "My Symbols", exact: true })).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "Markets", exact: true })).toHaveCount(0);
    await expect(desktopNav.getByRole("link", { name: "Bots", exact: true })).toHaveCount(0);
  });

  test("mobile bottom nav keeps full-page chrome scoped to primary destinations", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");

    const primaryNav = page.getByRole("navigation", { name: /^Primary$/i });
    await expect(primaryNav.getByRole("link")).toHaveCount(5);
    await expect(primaryNav.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(primaryNav.getByRole("link", { name: "Search", exact: true })).toBeVisible();
    await expect(primaryNav.getByRole("link", { name: "Calendar", exact: true })).toBeVisible();
    await expect(primaryNav.getByRole("link", { name: "Assets", exact: true })).toBeVisible();
    await expect(primaryNav.getByRole("link", { name: "My Symbols", exact: true })).toBeVisible();
    await expect(primaryNav.getByRole("link", { name: "Markets", exact: true })).toHaveCount(0);
    await expect(primaryNav.getByRole("link", { name: "Bots", exact: true })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("AppShell workspace sidebar still exposes Markets and Bots", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/bots");

    await expect(page.getByRole("heading", { name: /No live bot roster connected/i })).toBeVisible();
    const workspaceNav = page.locator(".side-nav");
    await expect(workspaceNav.getByRole("link", { name: "Markets", exact: true })).toHaveAttribute("href", "/markets");
    await expect(workspaceNav.getByRole("link", { name: "Bots", exact: true })).toHaveAttribute("href", "/bots");
  });
});
