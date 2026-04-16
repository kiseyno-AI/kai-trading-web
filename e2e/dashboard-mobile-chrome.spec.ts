import { expect, test } from "@playwright/test";

import { RELEASE_DISPLAY_LABEL } from "@/lib/release-version";
import { chromiumIPhone13 } from "./devices";

test.use(chromiumIPhone13);

test.describe("dashboard mobile chrome", () => {
  test("dashboard top chrome is compact and fixed on mobile", async ({ page }) => {
    await page.goto("/dashboard");

    const topbar = page.locator("header.topbar");
    const bottomNav = page.getByRole("navigation", { name: /Primary/i });
    await expect(topbar).toBeVisible();

    await expect
      .poll(() => topbar.evaluate((element) => window.getComputedStyle(element).position))
      .toBe("fixed");

    const topbarBox = await topbar.boundingBox();
    expect(topbarBox).not.toBeNull();
    expect(topbarBox!.height).toBeLessThan(112);
    expect(topbarBox!.x).toBeGreaterThanOrEqual(0);

    await expect(bottomNav).toBeVisible();
    await expect(page.getByText(/Trading Dashboard/i)).toBeVisible();
    await expect(page.locator('[aria-label="Release version"]:visible')).toContainText(RELEASE_DISPLAY_LABEL);
    await expect(page.getByRole("heading", { name: /Operational Integrity/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Dashboard/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Search/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /My Symbols/i })).toBeVisible();
    await expect(page.getByText(/Live Connection/i)).toHaveCount(0);
  });
});
