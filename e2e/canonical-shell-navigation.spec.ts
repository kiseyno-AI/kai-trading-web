import { expect, test, type Page } from "@playwright/test";

const expectedFullPageChromeNavIds = ["dashboard", "search", "calendar", "portfolio", "symbols"];
const fullPageMobileRoutes = [
  { label: "dashboard", path: "/dashboard" },
  { label: "search", path: "/search" },
  { label: "calendar", path: "/calendar" },
  { label: "portfolio", path: "/portfolio" },
  { label: "my symbols", path: "/my-symbols" },
  {
    label: "symbol detail",
    path: "/dashboard/symbol/005930?name=Samsung%20Electronics&market=KOSPI&standardCode=KR7005930003&marketDate=2026-04-10",
  },
  { label: "feedback", path: "/dashboard/signal-decider-feedback" },
  { label: "markets route chrome", path: "/markets" },
];

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function expectFullPageMobileBottomNav(page: Page, routeLabel: string) {
  const primaryNav = page.getByRole("navigation", { name: /^Primary$/i });
  await expect(primaryNav, `${routeLabel} primary mobile nav`).toBeVisible();
  await expect(primaryNav.getByRole("link"), `${routeLabel} primary mobile nav count`).toHaveCount(5);

  const navIds = await primaryNav.locator("[data-mobile-nav-item]").evaluateAll((items) =>
    items.map((item) => item.getAttribute("data-mobile-nav-item")),
  );

  expect(navIds, `${routeLabel} primary mobile nav ids`).toEqual(expectedFullPageChromeNavIds);
  await expect(primaryNav.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
  await expect(primaryNav.getByRole("link", { name: "Search", exact: true })).toBeVisible();
  await expect(primaryNav.getByRole("link", { name: "Calendar", exact: true })).toBeVisible();
  await expect(primaryNav.getByRole("link", { name: "Assets", exact: true })).toBeVisible();
  await expect(primaryNav.getByRole("link", { name: "My Symbols", exact: true })).toBeVisible();
  await expect(primaryNav.getByRole("link", { name: "Markets", exact: true })).toHaveCount(0);
  await expect(primaryNav.getByRole("link", { name: "Bots", exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
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

  test("mobile bottom nav keeps full-page chrome routes scoped to primary destinations", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const route of fullPageMobileRoutes) {
      await page.goto(route.path);
      await expectFullPageMobileBottomNav(page, route.label);
    }
  });

  test("dashboard actions reach Markets and Factor Screening by visible clicks", async ({ page }) => {
    const viewports = [
      { width: 1365, height: 900 },
      { width: 390, height: 844 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto("/dashboard");

      await page.getByRole("link", { name: "Open markets", exact: true }).click();
      await expect(page).toHaveURL(/\/markets$/);
      await expect(page.getByRole("heading", { name: "Markets", exact: true })).toBeVisible();

      await page.getByRole("link", { name: "Open factor screening", exact: true }).first().click();
      await expect(page).toHaveURL(/\/markets\/factors$/);
      await expect(page.getByRole("heading", { name: /Factor ranking workspace/i })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
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
