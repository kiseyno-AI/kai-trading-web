import { expect, test } from "@playwright/test";

test.describe("dashboard desktop", () => {
  test("dashboard labels match currently wired core data", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: /Tracked Market Dashboard/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Tracked quotes from the current core feed/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Largest absolute shifts inside the tracked list/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /What the current endpoints tell us/i })).toBeVisible();

    await expect(page.getByText(/Current core coverage only/i)).toBeVisible();
    await expect(page.getByText(/Tracked set facts/i)).toBeVisible();
    await expect(page.getByText(/No synthetic readiness score/i)).toBeVisible();

    await expect(page.getByText(/Readiness and breadth/i)).toHaveCount(0);
    await expect(page.getByText(/Top movers/i)).toHaveCount(0);
    await expect(page.getByText(/Connection and timing/i)).toHaveCount(0);
  });
});
