import { expect, test } from "@playwright/test";

test.describe("KAI design-system recomposition", () => {
  test("shared shell uses the blue financial terminal tokens", async ({ page }) => {
    await page.goto("/markets");

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
      accent: "#0052ff",
      background: "#050b14",
      canvas: "#050b14",
      radius: "12px",
      surface: "#101c2e",
      text: "#d6e2f2",
    });
    await expect(page.getByRole("navigation").first()).toBeVisible();
    await expect(page.locator(".nav-icon.active")).toHaveCSS("box-shadow", /rgb\(0, 82, 255\)|rgba\(0, 82, 255/);
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
