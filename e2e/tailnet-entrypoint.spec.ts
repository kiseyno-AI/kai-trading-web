import { expect, test } from "@playwright/test";

import { normalizeTailnetBrowserEntrypointUrl } from "../src/lib/tailnet-entrypoint";

const configuredTailnetEntrypointUrl = process.env.TAILNET_ENTRYPOINT_URL?.trim() ?? "";
const tailnetEntrypointUrl = normalizeTailnetBrowserEntrypointUrl(configuredTailnetEntrypointUrl);

type StaticAssetResponse = {
  status: number;
  url: string;
};

type StaticAssetFailure = {
  errorText: string;
  url: string;
};

function isNextStaticAssetUrl(url: string) {
  try {
    return new URL(url).pathname.includes("/_next/static/");
  } catch {
    return url.includes("/_next/static/");
  }
}

function formatStaticAssetFailures(responses: StaticAssetResponse[], failures: StaticAssetFailure[]) {
  return [
    ...responses.filter(({ status }) => status >= 400).map(({ status, url }) => `HTTP ${status} ${url}`),
    ...failures.map(({ errorText, url }) => `${errorText} ${url}`),
  ];
}

test.describe("Tailnet browser entrypoint", () => {
  test.skip(
    !configuredTailnetEntrypointUrl,
    "Set TAILNET_ENTRYPOINT_URL to the canonical Tailnet browser URL before running this smoke check.",
  );

  test.use({
    ignoreHTTPSErrors: false,
    viewport: { width: 390, height: 844 },
  });

  test("lands Chromium on the dashboard shell", async ({ page }) => {
    test.setTimeout(120_000);
    const normalizedEntrypoint = new URL(tailnetEntrypointUrl);

    if (normalizedEntrypoint.hostname.endsWith(".ts.net")) {
      expect(normalizedEntrypoint.protocol, "Tailnet browser smoke must start from direct HTTPS").toBe("https:");
    }

    const staticAssetResponses: StaticAssetResponse[] = [];
    const staticAssetFailures: StaticAssetFailure[] = [];

    page.on("response", (response) => {
      const url = response.url();
      if (!isNextStaticAssetUrl(url)) return;

      staticAssetResponses.push({
        status: response.status(),
        url,
      });
    });

    page.on("requestfailed", (request) => {
      const url = request.url();
      if (!isNextStaticAssetUrl(url)) return;

      staticAssetFailures.push({
        errorText: request.failure()?.errorText ?? "Request failed",
        url,
      });
    });

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

    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

    expect(staticAssetResponses.length, "Tailnet entrypoint did not request any Next static assets").toBeGreaterThan(0);
    expect(
      formatStaticAssetFailures(staticAssetResponses, staticAssetFailures),
      "Tailnet entrypoint loaded with failed Next static assets",
    ).toEqual([]);

    const routeChecks = [
      {
        linkName: /^Search$/i,
        pathname: /\/search$/,
        title: /Universal Search|통합 검색/i,
      },
      {
        linkName: /^Calendar$/i,
        pathname: /\/calendar$/,
        title: /Calendar|Signal Review Calendar|캘린더|시그널 리뷰 캘린더/i,
      },
      {
        linkName: /^Assets$/i,
        pathname: /\/portfolio$/,
        title: /^Portfolio$|^포트폴리오$/i,
      },
    ];

    for (const routeCheck of routeChecks) {
      await page.getByRole("link", { name: routeCheck.linkName }).first().click();
      await expect(page).toHaveURL(routeCheck.pathname, { timeout: 30_000 });
      await expect(page.locator("[data-dashboard-toolbar-title]").first()).toContainText(routeCheck.title, {
        timeout: 45_000,
      });
      expect(
        formatStaticAssetFailures(staticAssetResponses, staticAssetFailures),
        `Tailnet route ${routeCheck.pathname} loaded with failed Next static assets`,
      ).toEqual([]);
      await expect(page, `Tailnet route ${routeCheck.pathname} landed on Chrome error page: ${page.url()}`).not.toHaveURL(
        /chrome-error:\/\/chromewebdata/,
      );
    }
  });
});
