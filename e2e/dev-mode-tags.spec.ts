import { expect, test, type Page } from "@playwright/test";

import { DEV_MODE_PREFERENCE_KEY, LEGACY_DEV_MODE_KEY } from "@/lib/dev-mode-preference";

async function waitForAppStateRestore(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => window.setTimeout(resolve, 0)));
  await page.evaluate(() => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())));
}

test.describe("dev-mode component tags", () => {
  test("default to off for a fresh browser state", async ({ page }) => {
    await page.addInitScript(({ preferenceKey, legacyKey }) => {
      window.localStorage.removeItem(preferenceKey);
      window.localStorage.removeItem(legacyKey);
    }, { preferenceKey: DEV_MODE_PREFERENCE_KEY, legacyKey: LEGACY_DEV_MODE_KEY });

    await page.goto("/search");
    await waitForAppStateRestore(page);

    await expect(page.getByRole("button", { name: "Tags Off" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tags On" })).toHaveCount(0);
    await expect(page.locator(".component-tag")).toHaveCount(0);
  });

  test("ignore legacy dev-mode storage that could re-enable tags on revisit", async ({ page }) => {
    await page.addInitScript(({ preferenceKey, legacyKey }) => {
      window.localStorage.removeItem(preferenceKey);
      window.localStorage.setItem(legacyKey, "true");
    }, { preferenceKey: DEV_MODE_PREFERENCE_KEY, legacyKey: LEGACY_DEV_MODE_KEY });

    await page.goto("/search");
    await waitForAppStateRestore(page);

    await expect(page.getByRole("button", { name: "Tags Off" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tags On" })).toHaveCount(0);
    await expect(page.locator(".component-tag")).toHaveCount(0);
  });

  test("can still be enabled intentionally and persist across reloads", async ({ page }) => {
    await page.goto("/search");
    await waitForAppStateRestore(page);

    await page.getByRole("button", { name: "Tags Off" }).click();

    await expect(page.getByRole("button", { name: "Tags On" })).toBeVisible();
    await expect(page.locator(".component-tag").first()).toBeVisible();

    await page.reload();
    await waitForAppStateRestore(page);

    await expect(page.getByRole("button", { name: "Tags On" })).toBeVisible();
    await expect(page.locator(".component-tag").first()).toBeVisible();
  });
});
