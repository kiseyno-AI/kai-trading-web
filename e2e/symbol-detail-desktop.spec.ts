import { expect, test } from "@playwright/test";

const symbolSeed =
  "name=Samsung%20Electronics&market=KOSPI&standardCode=KR7005930003&marketDate=2026-04-10";

test.describe("symbol detail desktop", () => {
  test("overview uses desktop rail and wide Stitch sections", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/dashboard/symbol/005930?${symbolSeed}`);

    await expect(page.getByRole("navigation", { name: /Primary desktop/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Swipe-aware candlestick chart/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Deterministic action layer/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Stored snapshot metrics/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Stored DART filing history/i })).toBeVisible();
  });

  test("technical detail renders the desktop candlestick view", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const priceBarsRequest = page.waitForRequest((request) =>
      request.url().includes("/api/trading/symbols/005930/price-bars"),
    );

    await page.goto(`/dashboard/symbol/005930/technical-analysis?${symbolSeed}`);

    await expect(page.getByText(/Technical Analysis Detail/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Candlestick view/i })).toBeVisible();
    await priceBarsRequest;
    await expect(page.getByText(/Swipe or drag the chart to move date focus/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Stored snapshot metrics/i }).first()).toBeVisible();
  });

  test("fundamentals and action desktop routes keep their dedicated sections", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.goto(`/dashboard/symbol/005930/fundamentals-history?${symbolSeed}`);
    await expect(page.getByText(/Fundamentals History Detail/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Stored DART filing history/i })).toBeVisible();

    await page.goto(`/dashboard/symbol/005930/action-summary?${symbolSeed}`);
    await expect(page.getByText(/Action Summary Detail/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Deterministic action layer/i }).first()).toBeVisible();
  });
});
