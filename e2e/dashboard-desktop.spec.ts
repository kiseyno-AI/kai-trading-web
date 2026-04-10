import { expect, test } from "@playwright/test";

test.describe("dashboard desktop", () => {
  test("dashboard labels match currently wired core data", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: /Tracked Market Dashboard/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Operational Integrity/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Priority symbol cards/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /What the current APIs support today/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Open any symbol detail quickly/i })).toBeVisible();

    await expect(page.getByText(/Market Freshness Registry/i)).toBeVisible();
    await expect(page.getByText(/Each card keeps price freshness and technical freshness separate/i)).toBeVisible();
    await expect(page.getByText(/Results open the symbol detail screen/i)).toBeVisible();

    await expect(page.getByText(/Readiness and breadth/i)).toHaveCount(0);
    await expect(page.getByText(/Top movers/i)).toHaveCount(0);
    await expect(page.getByText(/Connection and timing/i)).toHaveCount(0);
  });
});
