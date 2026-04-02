import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("home redirects to dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("markets shell renders", async ({ page }) => {
    await page.goto("/markets");
    await expect(page.getByRole("heading", { name: /Market Radar/i })).toBeVisible();
  });

  test("bots shell renders", async ({ page }) => {
    await page.goto("/bots");
    await expect(page.getByRole("heading", { name: /Automation Control/i })).toBeVisible();
  });

  test("dashboard renders success or upstream-missing state", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /Tracked Market Dashboard|KIS DASHBOARD ERROR/i })).toBeVisible();
  });

  test("kis dashboard renders even when an upstream section is unavailable", async ({ page }) => {
    await page.goto("/kis-dashboard");
    await expect(page.getByRole("heading", { name: /Trading Dashboard Home|All upstream sections failed/i })).toBeVisible();
  });
});
