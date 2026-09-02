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
    await page.route("**/api/trading/market/snapshot", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          status: "ready",
          as_of: "2026-04-28T10:15:00+09:00",
          indices: {
            kospi: { level: 2742.31, change: 18.42, change_rate: 0.68 },
            kosdaq: { level: 842.17, change: -4.11, change_rate: -0.51 },
          },
          fx: { usdkrw: { value: 1378.2, change: 1.4, change_rate: 0.1 } },
          flows: {
            foreign: { value: 248_000_000_000, unit: "KRW" },
            institutional: { value: -91_000_000_000, unit: "KRW" },
          },
          summary: { line: "Constructive breadth with selective risk." },
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
    await expect(page.locator("[data-dashboard-toolbar-title]").first()).toContainText(
      /Trading Command Surface|트레이딩 커맨드 서피스/,
    );
    await expect(page.getByRole("heading", { name: /Decider, portfolio, and market state/i })).toHaveCount(0);

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
    await expect(hero.getByText(/Insight cockpit/i)).toHaveCount(0);
    await expect(hero.locator('[class*="supportingCopy"]')).toHaveCount(0);
    await expect(hero.getByRole("heading", { name: /Decider recommendations/i })).toBeVisible();
    const deciderCard = hero.locator("article").filter({ has: page.getByRole("heading", { name: /Decider recommendations/i }) });
    await expect(deciderCard).toHaveCount(1);
    await expect(deciderCard.getByText("Results", { exact: true })).toHaveCount(0);
    await expect(deciderCard.getByText("Market date", { exact: true })).toHaveCount(0);
    await expect(deciderCard.getByText("Action mix", { exact: true })).toHaveCount(0);
    await expect(deciderCard.getByText("Run", { exact: true })).toHaveCount(0);
    await expect(deciderCard.getByText("Errors", { exact: true })).toHaveCount(0);
    await expect(hero.getByRole("heading", { name: /Portfolio status/i })).toBeVisible();
    const portfolioCard = hero.locator("article").filter({ has: page.getByRole("heading", { name: /Portfolio status/i }) });
    await expect(portfolioCard).toBeVisible();
    const marketCard = hero.locator("article").filter({ has: page.getByRole("heading", { name: /Market condition/i }) });
    await expect(marketCard).toHaveAttribute("data-market-snapshot-status", "ready");
    await expect(marketCard.getByText("KOSPI", { exact: true })).toBeVisible();
    await expect(marketCard.getByText("KOSDAQ", { exact: true })).toBeVisible();
    await expect(marketCard.getByText("USD/KRW", { exact: true })).toBeVisible();
    await expect(marketCard.getByText("Foreign flow", { exact: true })).toBeVisible();
    await expect(marketCard.getByText("Institutional flow", { exact: true })).toBeVisible();
    await expect(marketCard.getByRole("link", { name: /Open markets/i })).toBeVisible();
    await expect(hero.getByRole("heading", { name: /^Exec runtime$/i })).toHaveCount(0);
    await expect(hero.getByRole("heading", { name: /Monitored symbols/i })).toHaveCount(0);
    await expect(hero.getByRole("heading", { name: /Same-day execution board/i })).toHaveCount(0);
    await expect(hero.locator('[data-dashboard-operational-integrity="inline"]')).toHaveCount(0);
    await expect(hero.getByText(/EOD Status/i)).toHaveCount(0);
    const filteringScoring = hero.locator('[data-dashboard-filtering-scoring="inline"]');
    const filteringCard = filteringScoring.locator("article").filter({ hasText: "Filtering" });
    const scoringCard = filteringScoring.locator("article").filter({ hasText: "Scoring" });
    await expect(filteringScoring).toBeVisible();
    await expect(filteringCard.getByRole("heading", { name: /Piotroski/i })).toBeVisible();
    await expect(scoringCard.getByRole("heading", { name: /Unified value scoring/i })).toBeVisible();
    await expect(
      filteringCard.getByRole("link", { name: /Open the full Piotroski filter pass list/i }),
    ).toBeVisible();
    await expect(page.locator("#tracked-symbols")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Today's ledger recommendations/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Open process monitor/i })).toBeVisible();

    const [deciderBox, portfolioBox, marketBox, filteringBox, scoringBox] = await Promise.all([
      deciderCard.boundingBox(),
      portfolioCard.boundingBox(),
      marketCard.boundingBox(),
      filteringCard.boundingBox(),
      scoringCard.boundingBox(),
    ]);

    expect(deciderBox).not.toBeNull();
    expect(portfolioBox).not.toBeNull();
    expect(marketBox).not.toBeNull();
    expect(filteringBox).not.toBeNull();
    expect(scoringBox).not.toBeNull();

    if (!deciderBox || !portfolioBox || !marketBox || !filteringBox || !scoringBox) {
      throw new Error("Expected mobile dashboard cards to have layout boxes.");
    }

    expect(portfolioBox.y).toBeGreaterThan(deciderBox.y + deciderBox.height - 1);
    expect(Math.abs(portfolioBox.x - deciderBox.x)).toBeLessThan(8);
    expect(marketBox.y).toBeGreaterThan(portfolioBox.y + portfolioBox.height - 1);
    expect(Math.abs(marketBox.x - deciderBox.x)).toBeLessThan(8);
    expect(filteringBox.y).toBeGreaterThan(marketBox.y + marketBox.height - 1);
    expect(scoringBox.y).toBeGreaterThan(filteringBox.y + filteringBox.height - 1);
    expect(Math.abs(filteringBox.x - scoringBox.x)).toBeLessThan(8);

    const marketCardFitsViewport = await marketCard.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    );
    expect(marketCardFitsViewport).toBe(true);

    const processDrawer = await openProcessMonitorDrawer(page);
    await expect(processDrawer.locator('[class*="processMonitorDrawerSummary"]')).toHaveCount(0);
    await expect(processDrawer.getByText(/EOD Status/i)).toBeVisible();
    await expect(processDrawer.getByRole("heading", { name: /Daily Data Fetch/i })).toBeVisible();
    await expect(processDrawer.getByRole("heading", { name: /Filtering/i })).toBeVisible();
    await expect(processDrawer.getByRole("heading", { name: /^Scoring$/i })).toBeVisible();
    await expect(processDrawer.getByRole("heading", { name: /Unified value scoring/i })).toBeVisible();
    await expect(processDrawer.getByRole("heading", { name: /Quality scoring/i })).toBeVisible();
    await expect(processDrawer.getByRole("heading", { name: /Momentum scoring/i })).toBeVisible();
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
