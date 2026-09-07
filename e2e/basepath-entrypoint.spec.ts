import { expect, test } from "@playwright/test";

const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const canonicalBasePath =
  configuredBasePath && configuredBasePath !== "/"
    ? `${configuredBasePath.startsWith("/") ? "" : "/"}${configuredBasePath}`.replace(/\/+$/, "")
    : "/";
const dashboardPath = canonicalBasePath === "/" ? "/dashboard" : `${canonicalBasePath}/dashboard`;
const canonicalEntrypoints =
  canonicalBasePath === "/"
    ? ["/", dashboardPath, `${dashboardPath}/`]
    : [canonicalBasePath, `${canonicalBasePath}/`, dashboardPath, `${dashboardPath}/`];

test.describe("base-path entrypoint", () => {
  for (const entrypoint of canonicalEntrypoints) {
    test(`renders dashboard shell at ${entrypoint}`, async ({ page }) => {
      const response = await page.goto(entrypoint);

      expect(response?.status()).toBe(200);
      await expect(page).not.toHaveURL(/chrome-error:\/\/chromewebdata/);
      await expect(page.locator("[data-dashboard-toolbar-title]").first()).toContainText(
        /Trading Command Surface|트레이딩 커맨드 서피스/,
      );
      await expect(page.getByRole("link", { name: /^Overview$/i }).first()).toBeVisible();
      await expect(page.getByRole("link", { name: /^Explore$/i }).first()).toBeVisible();
      await expect(page.getByRole("link", { name: /^Review$/i }).first()).toBeVisible();
      await expect(page.getByRole("link", { name: /^Portfolio$/i }).first()).toBeVisible();
    });
  }
});
