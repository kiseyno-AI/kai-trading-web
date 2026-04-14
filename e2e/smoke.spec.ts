import { expect, test } from "@playwright/test";

import {
  buildInitialSymbolMeta,
  createSymbolMetaResetToken,
  getDisclosureSectionState,
  shouldFetchSymbolMeta,
} from "@/app/dashboard/symbol/[symbol]/symbol-detail-state";
import { getForwardableSymbolMetaSeedValue } from "@/lib/symbol-meta";
import { getTradingApiCacheTtlMs } from "@/lib/trading-api-cache";

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
    await expect(page.getByRole("heading", { name: /Swipe-aware candlestick chart/i })).toBeVisible();
    await expect(page.getByText(/Layer-specific freshness stays explicit/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Back to dashboard/i })).toBeVisible();
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

  test("trading API cache policy keeps live status and price paths uncached", async () => {
    expect(getTradingApiCacheTtlMs("/api/trading/eod/freshness")).toBeNull();
    expect(
      getTradingApiCacheTtlMs("/api/trading/disclosures/dart/fundamentals/daily/inspect?runs_limit=1"),
    ).toBeNull();
    expect(getTradingApiCacheTtlMs("/api/trading/disclosures/dart/fundamentals/history?symbols=005930")).toBe(60 * 60 * 1000);
    expect(getTradingApiCacheTtlMs("/api/trading/eod/technical-snapshots?symbols=005930")).toBe(60 * 60 * 1000);
    expect(getTradingApiCacheTtlMs("/api/trading/scanner/realtime-trending?limit=5")).toBe(10 * 60 * 1000);
    expect(getTradingApiCacheTtlMs("/api/trading/scanner/trending-stocks?period=5d")).toBe(10 * 60 * 1000);
    expect(getTradingApiCacheTtlMs("/api/trading/quotes/005930")).toBeNull();
    expect(getTradingApiCacheTtlMs("/api/trading/market/status")).toBeNull();
    expect(getTradingApiCacheTtlMs("/api/trading/scanner/tracked-symbols", { method: "POST" })).toBeNull();
  });

  test("kis dashboard renders even when an upstream section is unavailable", async ({ page }) => {
    await page.goto("/kis-dashboard");
    await expect(page.getByRole("heading", { name: /Trading Dashboard Home|All upstream sections failed/i })).toBeVisible();
  });
});
