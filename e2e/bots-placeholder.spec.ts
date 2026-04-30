import { expect, test } from "@playwright/test";

const unsupportedLiveValues = [
  /Registered bots/i,
  /Execution mode/i,
  /Risk lock/i,
  /Momentum Breakout/i,
  /Mean Reversion/i,
  /Funding Capture/i,
  /Armed/i,
  /Standby/i,
  /Monitoring/i,
  /28% capital/i,
  /14% capital/i,
  /9% capital/i,
];

test.describe("bots placeholder truthfulness", () => {
  test("does not present unsupported automation state as live data", async ({ page }) => {
    await page.goto("/bots");

    await expect(page.getByRole("heading", { name: /No live bot roster connected/i })).toBeVisible();
    await expect(page.getByText(/Bot read API not connected/i)).toBeVisible();
    await expect(page.getByText(/Not exposed on placeholder/i)).toBeVisible();
    await expect(page.getByText(/Not displayed without source data/i)).toBeVisible();

    for (const value of unsupportedLiveValues) {
      await expect(page.getByText(value)).toHaveCount(0);
    }
  });

  test("keeps the mobile scaffold conservative", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/bots");

    await expect(page.getByRole("heading", { name: /No live bot roster connected/i })).toBeVisible();
    await expect(page.getByText(/Hidden until API-backed/i)).toBeVisible();
    await expect(page.getByText(/API-backed roster/i)).toBeVisible();

    for (const value of unsupportedLiveValues) {
      await expect(page.getByText(value)).toHaveCount(0);
    }
  });
});
