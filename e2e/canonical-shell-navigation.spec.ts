import { expect, test, type Page } from "@playwright/test";

const expectedFullPageChromeNavIds = ["dashboard", "search", "calendar", "portfolio"];
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
  await expect(primaryNav.getByRole("link"), `${routeLabel} primary mobile nav count`).toHaveCount(4);

  const navIds = await primaryNav.locator("[data-mobile-nav-item]").evaluateAll((items) =>
    items.map((item) => item.getAttribute("data-mobile-nav-item")),
  );

  expect(navIds, `${routeLabel} primary mobile nav ids`).toEqual(expectedFullPageChromeNavIds);
  await expect(primaryNav.getByRole("link", { name: "Overview", exact: true })).toBeVisible();
  await expect(primaryNav.getByRole("link", { name: "Explore", exact: true })).toBeVisible();
  await expect(primaryNav.getByRole("link", { name: "Review", exact: true })).toBeVisible();
  await expect(primaryNav.getByRole("link", { name: "Portfolio", exact: true })).toBeVisible();
  await expect(primaryNav.getByRole("link", { name: "My Symbols", exact: true })).toHaveCount(0);
  await expect(primaryNav.getByRole("link", { name: "Markets", exact: true })).toHaveCount(0);
  await expect(primaryNav.getByRole("link", { name: "Bots", exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
}

test.describe("canonical shell navigation", () => {
  test("desktop rail keeps full-page chrome scoped to primary destinations", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard");

    const desktopNav = page.getByRole("navigation", { name: /Primary desktop/i });
    await expect(desktopNav.getByRole("link")).toHaveCount(4);
    await expect(desktopNav.getByRole("link", { name: "Overview", exact: true })).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "Explore", exact: true })).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "Review", exact: true })).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "Portfolio", exact: true })).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "My Symbols", exact: true })).toHaveCount(0);
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

  test("dashboard market action resolves to the canonical exploration workspace", async ({ page }) => {
    test.setTimeout(60_000);

    const viewports = [
      { width: 1365, height: 900 },
      { width: 390, height: 844 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto("/dashboard");

      const marketConditionCard = page.locator("article").filter({
        has: page.getByRole("heading", { name: /Market condition/i }),
      });
      const exploreSymbolsLink = marketConditionCard.getByRole("link", { name: "Explore symbols", exact: true });
      await expect(exploreSymbolsLink).toHaveAttribute("href", "/search");
      await Promise.all([page.waitForURL(/\/search$/, { timeout: 15_000 }), exploreSymbolsLink.click()]);
      await expect(page).toHaveURL(/\/search$/);
      await expect(page.locator("[data-dashboard-toolbar-title]").first()).toContainText(/Universal Search/i);
      await expectNoHorizontalOverflow(page);

      const workspaceNav = page.getByRole("navigation", {
        name: viewport.width >= 1024 ? /Primary desktop/i : /^Primary$/i,
      });
      await expect(workspaceNav.getByRole("link", { name: "Explore", exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expectNoHorizontalOverflow(page);
    }
  });
});
