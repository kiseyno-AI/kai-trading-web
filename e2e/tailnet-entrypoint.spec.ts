import { expect, test } from "@playwright/test";

import {
  formatTailnetBrowserNavigationEntrypoint,
  resolveTailnetBrowserNavigationEntrypoint,
} from "../src/lib/tailnet-entrypoint";

const tailnetEntrypoint = resolveTailnetBrowserNavigationEntrypoint(process.env);
const tailnetBrowserNavigationUrl = tailnetEntrypoint.navigationUrl;
const tailnetEntrypointReport = formatTailnetBrowserNavigationEntrypoint(tailnetEntrypoint);
const expectedRevision = process.env.TAILNET_EXPECTED_REVISION?.trim() ?? "";

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

function buildExpectedStaticAssetPathPrefix(entrypointUrl: string) {
  const pathname = new URL(entrypointUrl).pathname;
  const basePath = pathname.replace(/\/dashboard\/?$/, "").replace(/\/$/, "");

  return `${basePath}/_next/static/`.replace(/^\/\//, "/");
}

function buildTailnetRouteUrl(entrypointUrl: string, routePath: string) {
  const url = new URL(entrypointUrl);
  const basePath = url.pathname.replace(/\/dashboard\/?$/, "").replace(/\/$/, "");
  url.pathname = `${basePath}${routePath}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function formatStaticAssetFailures(responses: StaticAssetResponse[], failures: StaticAssetFailure[]) {
  return [
    ...responses.filter(({ status }) => status >= 400).map(({ status, url }) => `HTTP ${status} ${url}`),
    ...failures.map(({ errorText, url }) => `${errorText} ${url}`),
  ];
}

test.describe("Tailnet browser entrypoint", () => {
  test.skip(
    !tailnetBrowserNavigationUrl,
    "Set TAILNET_BROWSER_ENTRYPOINT_URL or TAILNET_ENTRYPOINT_URL to the canonical Tailnet browser URL before running this smoke check.",
  );

  test.use({
    ignoreHTTPSErrors: false,
    viewport: { width: 390, height: 844 },
  });

  test("lands Chromium on the dashboard shell", async ({ page }) => {
    test.setTimeout(120_000);
    process.stdout.write(`${tailnetEntrypointReport}\n`);

    const normalizedEntrypoint = new URL(tailnetBrowserNavigationUrl);

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
      response = await test.step(tailnetEntrypointReport, async () => {
        return page.goto(tailnetBrowserNavigationUrl, {
          waitUntil: "domcontentloaded",
          timeout: 45_000,
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Tailnet browser entrypoint did not load.\n${tailnetEntrypointReport}\nCurrent URL: ${page.url()}\n${message}`,
      );
    }

    await expect(page, `Tailnet entrypoint landed on Chrome error page: ${page.url()}`).not.toHaveURL(
      /chrome-error:\/\/chromewebdata/,
    );
    expect(response, `No browser response returned.\n${tailnetEntrypointReport}`).not.toBeNull();
    expect(response?.status(), `Unexpected Tailnet entrypoint status for ${page.url()}`).toBeLessThan(400);

    if (expectedRevision) {
      await expect(page.locator("html"), "Tailnet runtime must match the source revision selected for deployment").toHaveAttribute(
        "data-release-revision",
        expectedRevision,
      );
    }

    const expectedStaticAssetPathPrefix = buildExpectedStaticAssetPathPrefix(tailnetBrowserNavigationUrl);
    if (expectedStaticAssetPathPrefix !== "/_next/static/") {
      const documentHtml = await response!.text();
      expect(documentHtml, "Tailnet app shell must not reference root Next static assets").not.toMatch(
        /\b(?:src|href)="\/_next\/static\//,
      );
      expect(documentHtml, "Tailnet app shell should reference basePath-prefixed Next static assets").toContain(
        `"${expectedStaticAssetPathPrefix}`,
      );
    }

    await expect(page.locator("[data-dashboard-toolbar-title]").first()).toContainText(
      /Trading Command Surface|트레이딩 커맨드 서피스/,
    );
    await expect(page.getByRole("link", { name: /^Overview$/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Explore$/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Review$/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Portfolio$/i }).first()).toBeVisible();

    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

    expect(staticAssetResponses.length, "Tailnet entrypoint did not request any Next static assets").toBeGreaterThan(0);
    expect(
      formatStaticAssetFailures(staticAssetResponses, staticAssetFailures),
      "Tailnet entrypoint loaded with failed Next static assets",
    ).toEqual([]);

    const routeChecks = [
      {
        linkName: /^Explore$/i,
        pathname: /\/search$/,
        title: /Universal Search|통합 검색/i,
      },
      {
        linkName: /^Review$/i,
        pathname: /\/calendar(?:\?date=\d{4}-\d{2}-\d{2})?$/,
        title: /Review|검토/i,
      },
      {
        linkName: /^Portfolio$/i,
        pathname: /\/portfolio$/,
        title: /Portfolio|포트폴리오/i,
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

  test("maps a deployed Piotroski freshness 504 to one localized terminal state", async ({ page }) => {
    test.setTimeout(60_000);
    await page.addInitScript(() => {
      window.localStorage.setItem("trading-web.locale", JSON.stringify("ko"));
    });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        status: 504,
        contentType: "application/json",
        body: JSON.stringify({ detail: "HTTP 504: Timed out while loading /eod/freshness from trading-core." }),
      });
    });

    const piotroskiUrl = buildTailnetRouteUrl(tailnetBrowserNavigationUrl, "/dashboard/piotroski-filter");
    await page.goto(piotroskiUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await expect(page.locator("html")).toHaveAttribute("lang", "ko", { timeout: 30_000 });

    const main = page.getByRole("main");
    const errorState = page.getByTestId("piotroski-error-state");
    await expect(errorState).toContainText(
      "피오트로스키 결과 데이터를 불러오지 못했습니다. 최신 데이터 처리가 지연되었을 수 있습니다.",
      { timeout: 30_000 },
    );
    await expect(
      page.locator('[data-app-chrome-topbar="fixed"]').getByText("데이터 사용 불가", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/기준일\s*확인 불가/)).toBeVisible();
    await expect(page.getByText(/통과 종목\s*확인 불가/)).toBeVisible();
    await expect(page.getByText("최신 피오트로스키 기준일을 확인 중입니다.")).toHaveCount(0);
    await expect(page.getByText("대기 중", { exact: true })).toHaveCount(0);
    await expect(main.getByText("HTTP 504", { exact: true })).toHaveCount(0);
  });
});
