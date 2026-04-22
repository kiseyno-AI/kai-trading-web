import { expect, test } from "@playwright/test";

import {
  buildInitialSymbolMeta,
  createSymbolMetaResetToken,
  getDisclosureSectionState,
  shouldFetchSymbolMeta,
} from "@/app/dashboard/symbol/[symbol]/symbol-detail-state";
import { warmMobileToolbarViewData } from "@/lib/mobile-toolbar-data";
import { getForwardableSymbolMetaSeedValue } from "@/lib/symbol-meta";
import { getTradingApiCacheTtlMs } from "@/lib/trading-api-cache";
import { sanitizeDiagnosticUrl } from "@/lib/web-diagnostics";

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
    await expect(page).toHaveTitle(/Trading Dashboard Home/i);
    await expect(page.getByText(/Trading Dashboard/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Operational Integrity/i })).toBeVisible();
    await expect(page.getByText(/Sovereign Desk/i)).toHaveCount(0);
  });

  test("symbol detail route renders as an in-app screen", async ({ page }) => {
    await page.goto("/dashboard/symbol/005930?name=Samsung%20Electronics&market=KRX&standardCode=KR7005930003");
    await expect(page.getByRole("heading", { name: "Samsung Electronics" })).toBeVisible();
    await expect(page.getByText("005930", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Swipe-aware candlestick chart/i })).toBeVisible();
    await expect(page.getByText(/Layer-specific freshness stays explicit/i)).toHaveCount(0);
    await expect(page.getByText(/Each detail page uses the same source packets/i)).toHaveCount(0);
    await expect(page.getByText(/No technical snapshot resolved yet/i)).toHaveCount(0);
    await expect(page.getByText(/No deterministic action summary resolved yet/i)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Back to dashboard/i })).toBeVisible();
  });

  test("symbol detail only shows the relevant market status pill", async ({ page }) => {
    await page.route("**/api/trading/quotes/005930", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          symbol: "005930",
          company_name: "Samsung Electronics",
          price: 71000,
          change: 500,
          change_pct: 0.71,
          volume: 1000,
          turnover: 71000000,
          market_state: "OPEN",
          source: "kis_live",
          fallback: false,
          is_live: true,
          available: true,
          trade_date: "2026-04-10",
        }),
      });
    });

    await page.route("**/api/trading/market/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          state: "OPEN",
          is_open: true,
          server_time: "2026-04-10T09:30:00+09:00",
          markets: [
            { market: "KRX", state: "OPEN", available: true, ready: true },
            { market: "KOSDAQ", state: "OPEN", available: true, ready: true },
            { market: "NASDAQ", state: null, available: false, ready: false },
          ],
        }),
      });
    });

    await page.goto(
      "/dashboard/symbol/005930?name=Samsung%20Electronics&market=KOSPI&standardCode=KR7005930003&marketDate=2026-04-10",
    );

    await expect(page.getByText("KRX: OPEN", { exact: true })).toBeVisible();
    await expect(page.getByText("KOSPI: Not ready", { exact: true })).toHaveCount(0);
    await expect(page.getByText("KOSDAQ: OPEN", { exact: true })).toHaveCount(0);
    await expect(page.getByText("NASDAQ: Not ready", { exact: true })).toHaveCount(0);
  });

  test("symbol detail state helpers reset and refetch when symbol changes without query params", async () => {
    const seededMeta = buildInitialSymbolMeta("005930", {
      name: "Samsung Electronics",
      market: "KOSPI",
      standardCode: "KR7005930003",
    });
    const partialMeta = buildInitialSymbolMeta("005930", {
      name: "Samsung Electronics",
      market: null,
      standardCode: null,
    });
    const unknownMeta = buildInitialSymbolMeta("005930", {
      name: "[확인 필요]",
      market: "[확인 필요]",
      standardCode: "[확인 필요]",
    });
    const emptyMetaA = buildInitialSymbolMeta("005930", {
      name: null,
      market: null,
      standardCode: null,
    });
    const emptyMetaB = buildInitialSymbolMeta("000660", {
      name: null,
      market: null,
      standardCode: null,
    });

    expect(seededMeta?.standard_code).toBe("KR7005930003");
    expect(partialMeta?.name_ko).toBe("Samsung Electronics");
    expect(emptyMetaA).toBeNull();
    expect(emptyMetaB).toBeNull();
    expect(shouldFetchSymbolMeta(partialMeta)).toBe(true);
    expect(shouldFetchSymbolMeta(unknownMeta)).toBe(true);
    expect(shouldFetchSymbolMeta(emptyMetaA)).toBe(true);
    expect(shouldFetchSymbolMeta(seededMeta)).toBe(false);
    expect(getForwardableSymbolMetaSeedValue("[확인 필요]")).toBeNull();
    expect(createSymbolMetaResetToken("005930", emptyMetaA)).not.toBe(createSymbolMetaResetToken("000660", emptyMetaB));
  });

  test("disclosure section only shows an empty state after aggregate context succeeds", async () => {
    expect(getDisclosureSectionState("loading", false, 0)).toBe("loading");
    expect(getDisclosureSectionState("error", false, 0)).toBe("unavailable");
    expect(getDisclosureSectionState("success", false, 0)).toBe("unavailable");
    expect(getDisclosureSectionState("success", true, 0)).toBe("empty");
    expect(getDisclosureSectionState("success", true, 2)).toBe("list");
  });

  test("trading API cache policy uses daily status TTLs without caching live price paths", async () => {
    expect(getTradingApiCacheTtlMs("/api/trading/eod/freshness")).toBe(10 * 60 * 1000);
    expect(
      getTradingApiCacheTtlMs("/api/trading/disclosures/dart/fundamentals/daily/inspect?runs_limit=1"),
    ).toBe(10 * 60 * 1000);
    expect(getTradingApiCacheTtlMs("/api/trading/disclosures/dart/fundamentals/history?symbols=005930")).toBe(60 * 60 * 1000);
    expect(getTradingApiCacheTtlMs("/api/trading/eod/technical-snapshots?symbols=005930")).toBe(60 * 60 * 1000);
    expect(getTradingApiCacheTtlMs("/api/trading/scanner/realtime-trending?limit=5")).toBe(10 * 60 * 1000);
    expect(getTradingApiCacheTtlMs("/api/trading/scanner/trending-stocks?period=5d")).toBe(10 * 60 * 1000);
    expect(getTradingApiCacheTtlMs("/api/trading/quotes/005930")).toBeNull();
    expect(getTradingApiCacheTtlMs("/api/trading/market/status")).toBeNull();
    expect(getTradingApiCacheTtlMs("/api/trading/scanner/tracked-symbols", { method: "POST" })).toBeNull();
  });

  test("mobile toolbar warm-up resolves client base paths before fetching", async () => {
    const originalBaseUrl = process.env.NEXT_PUBLIC_TRADING_API_BASE_URL;
    const originalFetch = globalThis.fetch;
    const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
    const requestedUrls: string[] = [];

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: { origin: "https://desk.example.com" },
        sessionStorage: {
          getItem: () => null,
          setItem: () => undefined,
        },
      },
    });

    process.env.NEXT_PUBLIC_TRADING_API_BASE_URL = "https://api.example.com/custom/trading";
    globalThis.fetch = async (input: string | URL | Request) => {
      requestedUrls.push(String(input));
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    try {
      await warmMobileToolbarViewData("dashboard");
      await warmMobileToolbarViewData("search");
    } finally {
      if (originalBaseUrl === undefined) {
        delete process.env.NEXT_PUBLIC_TRADING_API_BASE_URL;
      } else {
        process.env.NEXT_PUBLIC_TRADING_API_BASE_URL = originalBaseUrl;
      }

      globalThis.fetch = originalFetch;

      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, "window", originalWindowDescriptor);
      } else {
        delete (globalThis as { window?: unknown }).window;
      }
    }

    expect(requestedUrls).toEqual([
      "https://api.example.com/custom/trading/symbols/favorites",
      "https://api.example.com/custom/trading/scanner/tracked-symbols",
      "https://api.example.com/custom/trading/scanner/realtime-trending?limit=5&market_code=J&sources=volume-rank%2Cfluctuation%2Chts-top-view",
      "https://api.example.com/custom/trading/quotes/tracked",
    ]);
  });

  test("web diagnostics URL sanitizer redacts current screen and hash secrets", async () => {
    const sanitized = sanitizeDiagnosticUrl(
      "/dashboard?token=secret-token#access_token=secret-fragment&tab=overview",
    );

    expect(sanitized).toContain("token=%5Bredacted%5D");
    expect(sanitized).toContain("tab=overview");
    expect(sanitized).toContain("access_token=%5Bredacted%5D");
    expect(sanitized).not.toContain("secret-token");
    expect(sanitized).not.toContain("secret-fragment");
  });

  test("web diagnostics URL sanitizer redacts sensitive query values", async () => {
    const sanitized = sanitizeDiagnosticUrl(
      "/api/trading/symbols/search?q=005930&token=secret-token&api_key=secret-key",
    );

    expect(sanitized).toContain("q=005930");
    expect(sanitized).toContain("token=%5Bredacted%5D");
    expect(sanitized).toContain("api_key=%5Bredacted%5D");
    expect(sanitized).not.toContain("secret-token");
    expect(sanitized).not.toContain("secret-key");
  });

  test("kis dashboard renders even when an upstream section is unavailable", async ({ page }) => {
    await page.goto("/kis-dashboard");
    await expect(page.getByRole("heading", { name: /Trading Dashboard Home|All upstream sections failed/i })).toBeVisible();
  });
});
