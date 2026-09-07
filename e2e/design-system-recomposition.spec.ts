import { expect, test } from "@playwright/test";

test.describe("KAI design-system recomposition", () => {
  test("shared shell uses the restrained high-contrast terminal tokens", async ({ page }) => {
    await page.goto("/dashboard");

    const tokens = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        accent: root.getPropertyValue("--accent").trim(),
        background: root.getPropertyValue("--background").trim(),
        canvas: root.getPropertyValue("--app-canvas-background").trim(),
        radius: root.getPropertyValue("--radius-xl").trim(),
        surface: root.getPropertyValue("--surface").trim(),
        text: root.getPropertyValue("--text").trim(),
      };
    });

    expect(tokens).toEqual({
      accent: "#4c7dff",
      background: "#080b10",
      canvas: "#080b10",
      radius: "12px",
      surface: "#111821",
      text: "#dfe6ef",
    });
    const dashboardNavItem = page.locator('aside[aria-label="Desktop navigation"] a[href="/dashboard"]');
    await expect(dashboardNavItem).toBeVisible();
    await expect(dashboardNavItem).toHaveAttribute("aria-current", "page");
    await expect(dashboardNavItem).toHaveCSS("box-shadow", /rgb\(76, 125, 255\)|rgba\(76, 125, 255/);
  });

  test("major surfaces expose the unified state and panel primitives", async ({ page }) => {
    await page.goto("/portfolio");
    await expect(page.locator(".surface-state").first()).toBeVisible();

    await page.goto("/search");
    await expect(page.locator('[class*="heroPanel"]').first()).toBeVisible();

    await page.goto("/dashboard/symbol/005930?name=Samsung%20Electronics&market=KOSPI&standardCode=KR7005930003");
    await expect(page.locator('[class*="heroCard"]').first()).toBeVisible();
  });
});
