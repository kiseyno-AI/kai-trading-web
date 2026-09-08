import { expect, test } from "@playwright/test";

import {
  buildInitialSymbolMeta,
  createSymbolMetaResetToken,
  getDisclosureSectionState,
  shouldFetchSymbolMeta,
} from "@/app/dashboard/symbol/[symbol]/symbol-detail-state";
import { getAgentFeedbackProgressMarketDate } from "@/lib/agent-feedback-progress";
import {
  getEodSymbolsFailed,
  getEodSymbolsSucceeded,
  getEodSymbolsTotal,
  getFundamentalsStageDisplayCounts,
  shouldUseTodayStageData,
} from "@/lib/dashboard-eod-stage-data";
import { getLatestEodPatchSummary, getLatestPriceTradeDate } from "@/lib/eod-freshness-latest";
import { warmMobileToolbarViewData } from "@/lib/mobile-toolbar-data";
import { getForwardableSymbolMetaSeedValue } from "@/lib/symbol-meta";
import { getTradingApiCacheTtlMs } from "@/lib/trading-api-cache";
import { sanitizeDiagnosticUrl } from "@/lib/web-diagnostics";

test.describe("smoke", () => {
  test("home renders the dashboard shell", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("[data-dashboard-toolbar-title]").first()).toContainText(
      /Trading Command Surface|트레이딩 커맨드 서피스/,
    );
  });

  test("markets alias renders the canonical factor workspace", async ({ page }) => {
    await page.goto("/markets");
    await expect(page).toHaveURL(/\/markets\/factors$/);
    await expect(page.getByRole("heading", { name: /Factor ranking workspace/i })).toBeVisible();
  });

  test("crypto markets shell renders pending read-only state", async ({ page }) => {
    await page.route("**/api/trading/crypto/markets/overview**", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "crypto market overview pending" }),
      });
    });
    await page.route("**/api/trading/crypto/strategies/overview**", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "crypto strategy overview pending" }),
      });
    });
    await page.route("**/api/trading/execution/runtime/crypto/readiness**", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "crypto runtime readiness pending" }),
      });
    });
    await page.route("**/api/trading/execution/runtime/crypto/paper**", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "crypto paper runtime pending" }),
      });
    });

    await page.goto("/markets/crypto");
    await expect(page.getByRole("heading", { name: /^Crypto Markets$/i })).toBeVisible();
    await expect(page.getByText("No crypto rows are available.")).toBeVisible();
    await expect(page.getByText("No crypto strategy or paper runtime rows are available.")).toBeVisible();
    await expect(page.getByText("Not exposed", { exact: true })).toBeVisible();
  });

  test("crypto markets shell renders BTC and ETH strategy and paper runtime rows", async ({ page }) => {
    await page.route("**/api/trading/crypto/markets/overview**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              assetClass: "crypto",
              lastPrice: 95000000,
              name: "Bitcoin",
              quoteCurrency: "KRW",
              symbol: "BTC/KRW",
              venue: "UPBIT",
            },
            {
              assetClass: "crypto",
              lastPrice: 4900000,
              name: "Ethereum",
              quoteCurrency: "KRW",
              symbol: "ETH/KRW",
              venue: "UPBIT",
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/crypto/strategies/overview**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              assetClass: "crypto",
              momentumScore: 72,
              provider: "core",
              readiness: "ready",
              riskTier: "moderate",
              strategyName: "BTC weekend momentum",
              symbol: "KRW-BTC",
              trendState: "uptrend",
              venue: "UPBIT",
              volatilityTier: "medium",
            },
            {
              assetClass: "crypto",
              momentumScore: 51,
              provider: "core",
              readiness: "pending",
              riskTier: "high",
              strategyName: "ETH range watch",
              symbol: "KRW-ETH",
              trendState: "range",
              venue: "UPBIT",
              volatilityTier: "high",
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/execution/runtime/crypto/readiness**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              paperTradingEnabled: true,
              readiness: "paper_ready",
              symbol: "KRW-BTC",
              venue: "UPBIT",
            },
            {
              paperTradingEnabled: false,
              readiness: "pending",
              symbol: "KRW-ETH",
              venue: "UPBIT",
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/execution/runtime/crypto/paper**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              activePaperJobCount: 1,
              lastHeartbeatAt: "2026-06-14T09:15:00Z",
              mode: "paper",
              openPaperOrderCount: 0,
              paperRuntimeState: "paper_ready",
              paperTradingEnabled: true,
              provider: "UPBIT",
              symbol: "KRW-BTC",
              venue: "UPBIT",
            },
            {
              activePaperJobCount: 0,
              mode: "paper",
              openPaperOrderCount: 0,
              paperRuntimeState: "pending",
              paperTradingEnabled: false,
              provider: "UPBIT",
              symbol: "KRW-ETH",
              venue: "UPBIT",
            },
          ],
        }),
      });
    });

    await page.goto("/markets/crypto");
    await expect(page.getByRole("heading", { name: /^Crypto Markets$/i })).toBeVisible();
    await expect(page.getByText("BTC weekend momentum")).toBeVisible();
    await expect(page.getByText("ETH range watch")).toBeVisible();
    await expect(page.getByText("paper_ready").first()).toBeVisible();
    await expect(page.getByText("No web controls").first()).toBeVisible();
  });

  test("bots alias resolves to the canonical dashboard", async ({ page }) => {
    await page.goto("/bots");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: /Execution plans/i })).toBeVisible();
  });

  test("dashboard renders success or upstream-missing state", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveTitle(/Trading Dashboard Home/i);
    await expect(page.locator("[data-dashboard-toolbar-title]").first()).toContainText(
      /Trading Command Surface|트레이딩 커맨드 서피스/,
    );
    await expect(page.getByRole("heading", { name: /Decider, portfolio, and market state/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Execution plans/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Portfolio status/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Market condition/i })).toBeVisible();
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

    await expect(page.getByText("KRX: Open", { exact: true })).toBeVisible();
    await expect(page.getByText("KOSPI: Not ready", { exact: true })).toHaveCount(0);
    await expect(page.getByText("KOSDAQ: Open", { exact: true })).toHaveCount(0);
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

  test("dashboard EOD helpers prefer latest snapshot counts when today is stale and idle", async () => {
    const freshness = {
      today: {
        trade_date: "2026-04-23",
        price: {
          status: "missing",
          symbols_total: 3581,
          symbols_succeeded: 0,
          symbols_failed: 0,
        },
        technical_analysis: {
          status: "missing",
          symbols_total: 3581,
          symbols_succeeded: 0,
          symbols_failed: 0,
        },
        action_summary: {
          status: "missing",
          symbols_total: 3581,
          symbols_succeeded: 0,
          symbols_failed: 0,
        },
        fundamentals: {
          status: "missing",
          symbols_total: 3581,
          symbols_succeeded: 0,
          symbols_failed: 0,
        },
      },
      latest: {
        price_trade_date: "2026-04-22",
        symbols_total: 3581,
        symbols_succeeded: 3577,
        symbols_failed: 4,
        technical_market_date: "2026-04-22",
        action_market_date: "2026-04-22",
      },
      technical: {
        success: true,
        latest_date: "2026-04-22",
      },
      action: {
        success: true,
        latest_date: "2026-04-22",
      },
      fundamentals: {
        success: true,
        latest_date: "2026-04-22",
      },
    };

    expect(
      shouldUseTodayStageData(freshness.today.trade_date, freshness.latest.price_trade_date ?? null, {
        status: "completed",
        processed: 0,
        total: 3581,
        failed: 0,
      }),
    ).toBe(false);
    expect(getEodSymbolsTotal(freshness, true)).toBe(3581);
    expect(getEodSymbolsSucceeded(freshness, true)).toBe(3577);
    expect(getEodSymbolsFailed(freshness, true)).toBe(4);
    expect(getEodSymbolsSucceeded(freshness)).toBe(0);
  });

  test("dashboard EOD helpers keep today-stage data when the same-day pipeline is running", async () => {
    expect(
      shouldUseTodayStageData("2026-04-23", "2026-04-22", {
        status: "running",
        processed: 42,
        total: 3581,
        failed: 1,
      }),
    ).toBe(true);
  });

  test("latest price date prefers price_trade_date and preserves richer latest payload fallback", async () => {
    const freshnessWithDivergedSummary = {
      today: null,
      latest: {
        price_trade_date: "2026-04-24",
        summary: {
          trade_date: "2026-04-23",
        },
        stages: {
          price: {
            summary: {
              price_trade_date: "2026-04-24",
            },
          },
        },
      },
    };

    expect(getLatestPriceTradeDate(freshnessWithDivergedSummary)).toBe("2026-04-24");
    expect(getAgentFeedbackProgressMarketDate(freshnessWithDivergedSummary)).toBe("2026-04-24");

    const freshnessWithRichStageOnly = {
      today: null,
      latest: {
        summary: {
          trade_date: "2026-04-22",
        },
        stages: {
          price: {
            summary: {
              trade_date: "2026-04-23",
            },
          },
        },
      },
    };

    expect(getLatestPriceTradeDate(freshnessWithRichStageOnly)).toBe("2026-04-23");
    expect(getAgentFeedbackProgressMarketDate(freshnessWithRichStageOnly)).toBe("2026-04-23");
  });

  test("latest EOD summary helpers read the richer flat latest payload", async () => {
    const freshness = {
      today: {
        trade_date: "2026-04-24",
      },
      latest: {
        trade_date: "2026-04-23",
        updated_at: "2026-04-23T16:31:55+09:00",
        eod_status: "completed_with_errors",
        total: 3577,
        succeeded: 3570,
        failed: 7,
      },
    };

    expect(getLatestEodPatchSummary(freshness)).toEqual({
      tradeDate: "2026-04-23",
      updatedAt: "2026-04-23T16:31:55+09:00",
      status: "completed_with_errors",
      symbolsTotal: 3577,
      symbolsSucceeded: 3570,
      symbolsFailed: 7,
      stageDetails: [],
    });
    expect(getAgentFeedbackProgressMarketDate(freshness)).toBe("2026-04-23");
  });

  test("dashboard EOD helpers use nested latest summary and stage details when flat fields are absent", async () => {
    const freshness = {
      today: {
        trade_date: "2026-04-24",
        price: {
          status: "missing",
          symbols_total: 3577,
          symbols_succeeded: 0,
          symbols_failed: 0,
        },
      },
      latest: {
        summary: {
          market_date: "2026-04-23",
          updated_at: "2026-04-23T17:10:00+09:00",
          status: "completed_with_errors",
          symbols_total: 3577,
          symbols_succeeded: 3570,
          symbols_failed: 7,
        },
        stages: {
          price: {
            market_date: "2026-04-23",
            updated_at: "2026-04-23T17:10:00+09:00",
            status: "completed_with_errors",
            symbols_total: 3577,
            symbols_succeeded: 3570,
            symbols_failed: 7,
          },
          technical: {
            summary: {
              market_date: "2026-04-23",
              updated_at: "2026-04-23T17:12:00+09:00",
              status: "completed",
              symbols_total: 3577,
              symbols_succeeded: 3577,
              symbols_failed: 0,
            },
          },
        },
      },
    };

    expect(getEodSymbolsTotal(freshness, true)).toBe(3577);
    expect(getEodSymbolsSucceeded(freshness, true)).toBe(3570);
    expect(getEodSymbolsFailed(freshness, true)).toBe(7);
    expect(getAgentFeedbackProgressMarketDate(freshness)).toBe("2026-04-23");
    expect(getLatestEodPatchSummary(freshness)?.stageDetails).toEqual([
      {
        key: "price",
        sourceKey: "price",
        tradeDate: "2026-04-23",
        updatedAt: "2026-04-23T17:10:00+09:00",
        status: "completed_with_errors",
        symbolsTotal: 3577,
        symbolsSucceeded: 3570,
        symbolsFailed: 7,
      },
      {
        key: "technical_analysis",
        sourceKey: "technical",
        tradeDate: "2026-04-23",
        updatedAt: "2026-04-23T17:12:00+09:00",
        status: "completed",
        symbolsTotal: 3577,
        symbolsSucceeded: 3577,
        symbolsFailed: 0,
      },
    ]);
  });

  test("dashboard fundamentals counts prefer latest coverage unless the UI explicitly asks for today", async () => {
    const freshness = {
      today: null,
      latest: {
        stage_details: {
          fundamentals: {
            market_date: "2026-04-18",
            status: "completed_with_errors",
            symbols_total: 3581,
            symbols_checked: 3570,
            symbols_failed: 7,
          },
        },
      },
    };
    const todayFundamentalsStage = {
      status: "missing",
      symbols_total: 3581,
      symbols_succeeded: 0,
      symbols_failed: 0,
    };

    expect(getFundamentalsStageDisplayCounts(freshness, { latest_run: null, runs: [] }, todayFundamentalsStage, false))
      .toEqual({
        symbolsTotal: 3581,
        symbolsChecked: 3570,
        symbolsFailed: 7,
      });
    expect(getFundamentalsStageDisplayCounts(freshness, { latest_run: null, runs: [] }, todayFundamentalsStage, true))
      .toEqual({
        symbolsTotal: 3581,
        symbolsChecked: 0,
        symbolsFailed: 0,
      });
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

  test("kis dashboard alias resolves to the canonical dashboard", async ({ page }) => {
    await page.goto("/kis-dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: /Execution plans/i })).toBeVisible();
  });
});
