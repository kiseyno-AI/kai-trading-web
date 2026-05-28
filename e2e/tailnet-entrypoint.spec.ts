import { expect, test } from "@playwright/test";

const tailnetEntrypointUrl = process.env.TAILNET_ENTRYPOINT_URL?.trim() ?? "";

test.describe("Tailnet browser entrypoint", () => {
  test.skip(
    !tailnetEntrypointUrl,
    "Set TAILNET_ENTRYPOINT_URL to the canonical Tailnet browser URL before running this smoke check.",
  );

  test.use({
    ignoreHTTPSErrors: false,
    viewport: { width: 390, height: 844 },
  });

  test("lands Chromium on the dashboard shell", async ({ page }) => {
    let response: Awaited<ReturnType<typeof page.goto>>;

    try {
      response = await page.goto(tailnetEntrypointUrl, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Tailnet browser entrypoint did not load: ${tailnetEntrypointUrl}\nCurrent URL: ${page.url()}\n${message}`,
      );
    }

    await expect(page, `Tailnet entrypoint landed on Chrome error page: ${page.url()}`).not.toHaveURL(
      /chrome-error:\/\/chromewebdata/,
    );
    expect(response, `No browser response returned for ${tailnetEntrypointUrl}`).not.toBeNull();
    expect(response?.status(), `Unexpected Tailnet entrypoint status for ${page.url()}`).toBeLessThan(400);
    await expect(page.locator("[data-dashboard-toolbar-title]").first()).toContainText(
      /Trading Command Surface|트레이딩 커맨드 서피스/,
    );
    await expect(page.getByRole("link", { name: /^Dashboard$/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Search$/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Calendar$/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Assets$/i }).first()).toBeVisible();
  });
});
