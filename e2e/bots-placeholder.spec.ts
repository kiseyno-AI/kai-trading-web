import { expect, test } from "@playwright/test";

test.describe("retired route aliases", () => {
  for (const [legacyPath, canonicalPath] of [
    ["/bots", "/dashboard"],
    ["/real-dashboard", "/dashboard"],
    ["/kis-dashboard", "/dashboard"],
    ["/scanner-tracker", "/my-symbols"],
    ["/markets", "/markets/factors"],
  ] as const) {
    test(`${legacyPath} redirects to ${canonicalPath}`, async ({ page }) => {
      await page.goto(legacyPath);
      await expect(page).toHaveURL(new RegExp(`${canonicalPath.replaceAll("/", "\\/")}$`));
    });
  }

  test("shared decider feedback route preserves short-term query state", async ({ page }) => {
    await page.goto(
      "/dashboard/decider-feedback?agent=short-term-decider&marketDate=2026-04-27&q=Samsung&symbols=005930&symbols=000660",
    );

    await expect(page).toHaveURL(
      /\/dashboard\/decider-feedback\?agent=short-term-decider&marketDate=2026-04-27&q=Samsung&symbols=005930&symbols=000660$/,
    );
    await expect(page.getByRole("link", { name: "Short-term Decider" })).toHaveAttribute("aria-current", "page");
  });
});
