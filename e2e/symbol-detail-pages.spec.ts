import { expect, test, type Page } from "@playwright/test";

import { chromiumIPhone13 } from "./devices";
import { expectMobileContentClearsBottomChrome } from "./mobile-bottom-chrome";

test.use(chromiumIPhone13);

const symbolSeed =
  "name=Samsung%20Electronics&market=KOSPI&standardCode=KR7005930003&marketDate=2026-04-10";
const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const appBasePath =
  configuredBasePath && configuredBasePath !== "/"
    ? `${configuredBasePath.startsWith("/") ? "" : "/"}${configuredBasePath}`.replace(/\/+$/, "")
    : "";
const withBasePath = (pathname: string) => `${appBasePath}${pathname}`;

const detailPages = [
  {
    path: "action-summary",
    mode: "action-summary",
    eyebrow: /Action Summary Detail/i,
    heading: /Deterministic action layer/i,
    visibleSectionIds: ["action"],
    hiddenSectionIds: ["chart", "technical", "fundamentals", "disclosures", "freshness"],
  },
  {
    path: "technical-analysis",
    mode: "technical-analysis",
    eyebrow: /Technical Analysis Detail/i,
    heading: /Stored technical snapshot|Stored snapshot metrics/i,
    visibleSectionIds: ["chart", "technical"],
    hiddenSectionIds: ["action", "fundamentals", "disclosures", "freshness"],
  },
  {
    path: "fundamentals-history",
    mode: "fundamentals-history",
    eyebrow: /Fundamentals History Detail/i,
    heading: /DART fundamentals history|Stored DART filing history/i,
    visibleSectionIds: ["fundamentals"],
    hiddenSectionIds: ["chart", "action", "technical", "disclosures", "freshness"],
  },
  {
    path: "disclosure-coverage",
    mode: "disclosure-coverage",
    eyebrow: /Disclosure & Coverage Detail/i,
    heading: /Recent DART disclosure coverage|Recent filing coverage/i,
    visibleSectionIds: ["disclosures"],
    hiddenSectionIds: ["chart", "action", "technical", "fundamentals", "freshness"],
  },
  {
    path: "system-freshness",
    mode: "system-freshness",
    eyebrow: /System Freshness Detail/i,
    heading: /Layer-specific freshness registry/i,
    visibleSectionIds: ["freshness"],
    hiddenSectionIds: ["chart", "action", "technical", "fundamentals", "disclosures"],
  },
];

type PriceHistoryRequestSnapshot = {
  startDate: string | null;
  endDate: string | null;
  limit: string | null;
};

type MockDetailModeSwitchOptions = {
  actionConfidenceTier?: string;
  actionLabel?: string;
  actionReasons?: string[];
  actionRiskTier?: string;
  actionSignalScore?: number;
  marketDate?: string;
  marketStatusIsOpen?: boolean;
  marketStatusUnavailable?: boolean;
  marketStatusState?: string;
  onQuoteRequest?: () => void;
  quoteAvailable?: boolean;
  quoteMarketState?: string;
  quoteUnavailable?: boolean;
  quoteUnavailableReason?: string;
  technicalSnapshotAvailable?: boolean;
};

async function mockSystemFreshnessApis(
  page: Page,
  options: {
    fundamentalsHistoryEntries?: number;
  } = {},
) {
  const marketDate = "2026-04-10";
  const fundamentalsHistoryEntries = options.fundamentalsHistoryEntries ?? 0;

  await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
    await route.fulfill({
      json: {
        tracked_symbols: [],
        count: 0,
        last_updated_at: null,
      },
    });
  });

  await page.route("**/api/trading/quotes/005930", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        symbol: "005930",
        company_name: "Samsung Electronics",
        price: null,
        change: null,
        change_pct: null,
        volume: null,
        turnover: null,
        market_state: "CLOSED",
        source: "daily_price_bar",
        fallback: true,
        is_live: false,
        available: false,
        trade_date: marketDate,
        unavailable_reason:
          "Quote coverage is unavailable while the upstream quote cache waits for the next confirmed daily price packet.",
      }),
    });
  });

  await page.route("**/api/trading/market/status", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        state: "CLOSED",
        is_open: false,
        server_time: "2026-04-10T16:00:00+09:00",
      }),
    });
  });

  await page.route("**/api/trading/eod/freshness", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        today: {
          trade_date: marketDate,
          eod_status: "running",
          symbols_total: 2500,
          symbols_succeeded: 1840,
          symbols_failed: 0,
        },
        latest: {
          price_trade_date: marketDate,
          symbols_total: 2500,
          symbols_succeeded: 1840,
          technical_market_date: marketDate,
          action_market_date: marketDate,
        },
        technical: {
          success: true,
          latest_date: marketDate,
        },
      }),
    });
  });

  await page.route("**/api/trading/agent-context/symbol-day?**", async (route) => {
    await route.fulfill({
      json: {
        request: {
          market_date: marketDate,
          symbols: ["005930"],
          fs_div: null,
          fs_label: null,
          disclosures_limit: 4,
        },
        summary: {
          requested_symbol_count: 1,
          matched_symbol_count: 1,
          technical_snapshot_count: 0,
          action_summary_count: 0,
          fundamentals_count: fundamentalsHistoryEntries > 0 ? 1 : 0,
          recent_disclosure_symbol_count: 0,
          missing_symbols: [],
        },
        items: [
          {
            symbol: "005930",
            market_date: marketDate,
            company: {
              symbol: "005930",
              name_ko: "Samsung Electronics",
              market: "KOSPI",
              instrument_type: "stock",
              standard_code: "KR7005930003",
              source: "test",
              is_active: true,
              last_refreshed_at: null,
              dart: {
                corp_code: "00126380",
                corp_name: "Samsung Electronics",
              },
            },
            technical_snapshot: null,
            action_summary: null,
            fundamentals: {
              latest_snapshot: null,
              history_summary: {
                entries: fundamentalsHistoryEntries,
                latest_receipt_date: fundamentalsHistoryEntries > 0 ? marketDate : null,
                latest_period_end_date: fundamentalsHistoryEntries > 0 ? "2025-12-31" : null,
                available_business_years: fundamentalsHistoryEntries > 0 ? [2025, 2024] : [],
                recent_periods:
                  fundamentalsHistoryEntries > 0
                    ? [
                        {
                          business_year: 2025,
                          report_code: "11011",
                          report_label: "FY 2025",
                          period_type: "annual",
                          period_end_date: "2025-12-31",
                          receipt_date: marketDate,
                          rcept_no: "202604100001",
                        },
                      ]
                    : [],
              },
            },
            recent_disclosures: {
              count: 0,
              items: [],
            },
            availability: {
              company: true,
              technical_snapshot: false,
              action_summary: false,
              fundamentals: fundamentalsHistoryEntries > 0,
              recent_disclosures: false,
            },
          },
        ],
      },
    });
  });

  await page.route("**/api/trading/eod/action-summaries?**", async (route) => {
    await route.fulfill({
      json: {
        market_date: marketDate,
        items: [],
      },
    });
  });

  await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
    await route.fulfill({
      json: {
        market_date: marketDate,
        summary: {
          entries: 0,
          requested_symbol: "005930",
          matched_symbols: [],
          missing_symbols: [],
          passed_count: 0,
          not_passed_count: 0,
        },
        item: null,
      },
    });
  });
}

async function mockSignalDeciderRecommendationEvidence(page: Page) {
  await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
    await route.fulfill({
      json: {
        request: {
          market_date: "2026-04-10",
          agent_names: ["signal-decider"],
        },
        result: {
          market_date: "2026-04-10",
          roles: {
            "signal-decider": {
              requested_count: 1,
              completed_count: 1,
              error_count: 0,
            },
          },
        },
      },
    });
  });

  await page.route("**/api/trading/agent-context/feedback?**", async (route) => {
    const url = new URL(route.request().url());
    const marketDate = url.searchParams.get("market_date");
    const agentName = url.searchParams.get("agent_name");
    const requestedSymbols = url.searchParams.getAll("symbols");
    const hasMatchingEvidence = marketDate === "2026-04-10" && agentName === "signal-decider";
    const highVolumeRows = hasMatchingEvidence
      ? [
          ...Array.from({ length: 200 }, (_, index) => ({
            id: `earlier-dashboard-evidence-${index}`,
            market_date: marketDate,
            symbol: String(100000 + index),
            agent: {
              name: "signal-decider",
              run_id: "dashboard-decider-2026-04-10",
            },
            summary: {},
            feedback: {
              role: "signal-decider",
              symbol: String(100000 + index),
              market_date: marketDate,
              preferred_action: "wait",
              thesis_summary: `Earlier stored recommendation ${index + 1}`,
            },
            normalized_feedback: null,
            details: null,
            context: null,
            received_at: `2026-04-10T07:${String(59 - Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}+00:00`,
          })),
          {
            id: "dashboard-evidence-005930",
            market_date: marketDate,
            symbol: "005930",
            agent: {
              name: "signal-decider",
              run_id: "dashboard-decider-2026-04-10",
            },
            summary: {},
            feedback: {
              role: "signal-decider",
              symbol: "005930",
              market_date: marketDate,
              preferred_action: "buy",
              next_day_open_action: "buy",
              target_price: 55200,
              stop_loss_price: 51800,
              confidence_score_10: 8,
              conviction_score_10: 7,
              thesis_summary: "Insurance momentum and valuation support the same-date recommendation.",
              decision_risks: ["Opening gap could invalidate the setup"],
              policy_version: "decider-policy-2026.04",
            },
            normalized_feedback: null,
            details: null,
            context: {
              symbol_day_context: {
                company: {
                  name_ko: "현대해상",
                },
              },
            },
            received_at: "2026-04-10T07:00:00+00:00",
          },
        ]
      : [];
    const scopedRows = requestedSymbols.length
      ? highVolumeRows.filter((item) => requestedSymbols.includes(item.symbol))
      : highVolumeRows;
    const returnedRows = scopedRows.slice(0, 200);

    await route.fulfill({
      json: {
        request: {
          market_date: marketDate,
          symbols: requestedSymbols,
          agent_name: agentName,
          limit: 200,
        },
        summary: {
          count: returnedRows.length,
        },
        items: returnedRows,
      },
    });
  });
}

async function mockDetailModeSwitchApis(
  page: Page,
  requestCounts: { priceHistory: number; technical: number; action: number; fundamentals: number },
  priceHistoryRequests: PriceHistoryRequestSnapshot[],
  options: MockDetailModeSwitchOptions = {},
) {
  const marketDate = options.marketDate ?? "2026-04-10";
  const marketStatusState = options.marketStatusState ?? "CLOSED";
  const marketStatusIsOpen = options.marketStatusIsOpen ?? marketStatusState === "OPEN";
  const quoteMarketState = options.quoteMarketState ?? "CLOSED";
  const quoteAvailable = options.quoteAvailable ?? true;
  const technicalSnapshotAvailable = options.technicalSnapshotAvailable ?? true;
  let aggregateRequestCount = 0;

  await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
    await route.fulfill({
      json: {
        tracked_symbols: [],
        count: 0,
        last_updated_at: null,
      },
    });
  });

  await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
    await route.fulfill({
      json: {
        market_date: marketDate,
        summary: {
          entries: 0,
          requested_symbol: "005930",
          matched_symbols: [],
          missing_symbols: [],
          passed_count: 0,
          not_passed_count: 0,
        },
        item: null,
      },
    });
  });

  await page.route("**/api/trading/quotes/005930", async (route) => {
    options.onQuoteRequest?.();
    if (options.quoteUnavailable) {
      await route.fulfill({ status: 503, json: { detail: "Quote unavailable" } });
      return;
    }
    await route.fulfill({
      json: {
        symbol: "005930",
        company_name: "Samsung Electronics",
        price: quoteAvailable ? 70000 : null,
        change: quoteAvailable ? 500 : null,
        change_pct: quoteAvailable ? 0.72 : null,
        volume: quoteAvailable ? 1250000 : null,
        turnover: quoteAvailable ? 87500000000 : null,
        market_state: quoteMarketState,
        source: quoteMarketState === "OPEN" ? "kis_live" : "daily_price_bar",
        fallback: quoteMarketState !== "OPEN",
        is_live: quoteMarketState === "OPEN",
        available: quoteAvailable,
        trade_date: marketDate,
        unavailable_reason: quoteAvailable
          ? null
          : options.quoteUnavailableReason ?? "no_live_quote_or_fresh_fallback",
      },
    });
  });

  await page.route("**/api/trading/market/status", async (route) => {
    if (options.marketStatusUnavailable) {
      await route.fulfill({ status: 503, json: { detail: "Market status unavailable" } });
      return;
    }
    await route.fulfill({
      json: {
        state: marketStatusState,
        is_open: marketStatusIsOpen,
        server_time: `${marketDate}T16:00:00+09:00`,
      },
    });
  });

  await page.route("**/api/trading/eod/freshness", async (route) => {
    await route.fulfill({
      json: {
        today: {
          trade_date: marketDate,
          eod_status: "completed",
          symbols_total: 1,
          symbols_succeeded: 1,
          symbols_failed: 0,
        },
        latest: {
          price_trade_date: marketDate,
          technical_market_date: marketDate,
          action_market_date: marketDate,
        },
        technical: {
          success: true,
          latest_date: marketDate,
        },
      },
    });
  });

  await page.route("**/api/trading/agent-context/symbol-day?**", async (route) => {
    aggregateRequestCount += 1;
    if (aggregateRequestCount > 1) {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    await route.fulfill({
      json: {
        request: {
          market_date: marketDate,
          symbols: ["005930"],
          fs_div: null,
          fs_label: null,
          disclosures_limit: 4,
        },
        summary: {
          requested_symbol_count: 1,
          matched_symbol_count: 1,
          technical_snapshot_count: 0,
          action_summary_count: 0,
          fundamentals_count: 0,
          recent_disclosure_symbol_count: 0,
          missing_symbols: [],
        },
        items: [
          {
            symbol: "005930",
            market_date: marketDate,
            company: {
              symbol: "005930",
              name_ko: "Samsung Electronics",
              market: "KOSPI",
              instrument_type: "stock",
              standard_code: "KR7005930003",
              source: "test",
              is_active: true,
              last_refreshed_at: null,
              dart: {
                corp_code: "00126380",
                corp_name: "Samsung Electronics",
              },
            },
            technical_snapshot: null,
            action_summary: null,
            fundamentals: {
              latest_snapshot: null,
              history_summary: {
                entries: 0,
                latest_receipt_date: null,
                latest_period_end_date: null,
                available_business_years: [],
                recent_periods: [],
              },
            },
            recent_disclosures: {
              count: 0,
              items: [],
            },
            availability: {
              company: true,
              technical_snapshot: false,
              action_summary: false,
              fundamentals: false,
              recent_disclosures: false,
            },
          },
        ],
      },
    });
  });

  await page.route("**/api/trading/eod/technical-snapshots?**", async (route) => {
    requestCounts.technical += 1;
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      json: {
        market_date: marketDate,
        items: technicalSnapshotAvailable
          ? [
              {
                symbol: "005930",
                market_date: marketDate,
                source: "test",
                close_price: 70000,
                volume: 1250000,
                trend_state: "uptrend",
                ma_alignment: "bullish_stack",
                breakout_20d: true,
                breakdown_20d: false,
                return_5d: 1.5,
                return_20d: 4.2,
                volume_ratio_20d: 1.3,
                atr_14: 1200,
                atr_pct_14: 1.7,
                signal_payload: {
                  trend: "uptrend",
                },
                captured_at: `${marketDate}T16:00:00+09:00`,
              },
            ]
          : [],
      },
    });
  });

  await page.route("**/api/trading/eod/action-summaries?**", async (route) => {
    requestCounts.action += 1;
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      json: {
        market_date: marketDate,
        items: [
          {
            symbol: "005930",
            market_date: marketDate,
            source: "test",
            action_label: options.actionLabel ?? "strong_buy",
            bias_direction: "long",
            signal_score: options.actionSignalScore ?? 94,
            confidence_tier: options.actionConfidenceTier ?? "high",
            risk_tier: options.actionRiskTier ?? "medium",
            trigger_price: 70100,
            invalidation_price: 68000,
            support_price: 69000,
            resistance_price: 72000,
            reasons: options.actionReasons ?? ["Trend support confirmed", "Volume expansion detected"],
            summary_payload: {
              trigger: "breakout",
            },
            captured_at: `${marketDate}T16:00:00+09:00`,
          },
        ],
      },
    });
  });

  await page.route("**/api/trading/disclosures/dart/fundamentals/history?**", async (route) => {
    requestCounts.fundamentals += 1;
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      json: {
        request: {
          symbols: ["005930"],
          start_date: "2021-04-10",
          end_date: marketDate,
          fs_div: null,
        },
        companies: [
          {
            symbol: "005930",
            name: "Samsung Electronics",
            entries: [
              {
                filing: {
                  rcept_no: "202604100001",
                  report_nm: "Annual report",
                  receipt_date: marketDate,
                },
                period: {
                  business_year: 2025,
                  report_code: "11011",
                  report_label: "FY 2025",
                  period_end_date: "2025-12-31",
                },
                statement: {
                  fs_div: "CFS",
                },
                highlights: [
                  {
                    metric_key: "revenue",
                    label: "Revenue",
                    value: "302T KRW",
                  },
                ],
              },
            ],
          },
        ],
      },
    });
  });

  await page.route("**/api/trading/symbols/005930/price-bars?**", async (route) => {
    requestCounts.priceHistory += 1;
    const requestUrl = new URL(route.request().url());
    const startDate = requestUrl.searchParams.get("start_date");
    const endDate = requestUrl.searchParams.get("end_date");
    const limit = requestUrl.searchParams.get("limit");

    priceHistoryRequests.push({
      startDate,
      endDate,
      limit,
    });

    const isBootstrapRequest = startDate === marketDate && endDate === marketDate && limit === null;
    await new Promise((resolve) => setTimeout(resolve, isBootstrapRequest ? 150 : 400));
    await route.fulfill({
      json: {
        symbol: "005930",
        count: isBootstrapRequest ? 1 : 3,
        start_date: isBootstrapRequest ? marketDate : "2026-04-08",
        end_date: marketDate,
        requested_start_date: startDate,
        requested_end_date: marketDate,
        items: isBootstrapRequest
          ? [
              {
                trade_date: marketDate,
                open_price: 69600,
                high_price: 70300,
                low_price: 69400,
                close_price: 70000,
                volume: 1250000,
                turnover: 87500000000,
                source: "test",
                captured_at: `${marketDate}T16:00:00+09:00`,
              },
            ]
          : [
              {
                trade_date: "2026-04-08",
                open_price: 68400,
                high_price: 69400,
                low_price: 68000,
                close_price: 68900,
                volume: 1000000,
                turnover: 68900000000,
                source: "test",
                captured_at: "2026-04-08T16:00:00+09:00",
              },
              {
                trade_date: "2026-04-09",
                open_price: 69000,
                high_price: 69900,
                low_price: 68800,
                close_price: 69500,
                volume: 1110000,
                turnover: 77145000000,
                source: "test",
                captured_at: "2026-04-09T16:00:00+09:00",
              },
              {
                trade_date: marketDate,
                open_price: 69600,
                high_price: 70300,
                low_price: 69400,
                close_price: 70000,
                volume: 1250000,
                turnover: 87500000000,
                source: "test",
                captured_at: `${marketDate}T16:00:00+09:00`,
              },
            ],
      },
    });
  });
}

test.describe("symbol detail mobile pages", () => {
  test("remaining Stitch detail pages render with mobile chrome and section tabs", async ({ page }) => {
    for (const detailPage of detailPages) {
      await page.goto(`/dashboard/symbol/005930/${detailPage.path}?${symbolSeed}`);

      const topbar = page.locator("header.topbar");
      await expect(topbar).toBeVisible();
      await expect(topbar).toContainText("Samsung Electronics");
      await expect(topbar).not.toContainText("005930");
      await expect(page.getByRole("navigation", { name: /Primary/i })).toBeVisible();
      await expect(page.getByText(detailPage.eyebrow)).toBeVisible();
      await expect(page.getByRole("heading", { name: detailPage.heading }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /Insights/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Freshness/i })).toBeVisible();
    }
  });

  test("disabled trade placeholder is visibly read-only in the mobile hero", async ({ page }) => {
    const requestCounts = {
      priceHistory: 0,
      technical: 0,
      action: 0,
      fundamentals: 0,
    };
    const priceHistoryRequests: PriceHistoryRequestSnapshot[] = [];

    await mockDetailModeSwitchApis(page, requestCounts, priceHistoryRequests);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dashboard/symbol/005930?${symbolSeed}`);
    await page.getByRole("button", { name: /Korean/i }).click();

    const hero = page.locator("#summary");
    const tradeButton = hero.getByRole("button", { name: "거래 비활성 · 읽기 전용" });
    await expect(tradeButton).toBeDisabled();
    await expect(tradeButton).toHaveAttribute("aria-disabled", "true");
    await expect(tradeButton).toHaveAttribute("aria-describedby", "symbol-trade-disabled-description");
    await expect(hero.locator("#symbol-trade-disabled-description")).toHaveText(
      "읽기 전용 화면입니다. 주문 실행은 제공되지 않습니다.",
    );
    await expect(page.getByRole("button", { name: "005930를 추적 종목에 추가" })).toBeVisible();

    const tradeTreatment = await tradeButton.evaluate((button) => {
      const accentProbe = document.createElement("span");
      accentProbe.style.backgroundColor = getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim();
      document.body.append(accentProbe);
      const accentBackground = getComputedStyle(accentProbe).backgroundColor;
      accentProbe.remove();

      const buttonStyle = getComputedStyle(button);
      return {
        accentBackground,
        background: buttonStyle.backgroundColor,
        borderStyle: buttonStyle.borderStyle,
        cursor: buttonStyle.cursor,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(tradeTreatment.background).not.toBe(tradeTreatment.accentBackground);
    expect(tradeTreatment.borderStyle).toBe("solid");
    expect(tradeTreatment.cursor).toBe("not-allowed");
    expect(tradeTreatment.documentOverflow).toBeLessThanOrEqual(1);
  });

  test("lower insight cards scroll clear of the mobile bottom nav", async ({ page }) => {
    const requestCounts = {
      priceHistory: 0,
      technical: 0,
      action: 0,
      fundamentals: 0,
    };
    const priceHistoryRequests: PriceHistoryRequestSnapshot[] = [];

    await mockDetailModeSwitchApis(page, requestCounts, priceHistoryRequests);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dashboard/symbol/005930?${symbolSeed}`);

    const freshnessCard = page.locator("#freshness");
    await expect(freshnessCard.getByRole("heading", { name: /Layer-specific freshness registry/i })).toBeVisible();

    await expectMobileContentClearsBottomChrome(page, freshnessCard);
  });

  test("detail tabs keep long labels readable at narrow mobile widths", async ({ page }) => {
    const requestCounts = {
      priceHistory: 0,
      technical: 0,
      action: 0,
      fundamentals: 0,
    };
    const priceHistoryRequests: PriceHistoryRequestSnapshot[] = [];

    await mockDetailModeSwitchApis(page, requestCounts, priceHistoryRequests);
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto(`/dashboard/symbol/005930/action-summary?${symbolSeed}`);

    const tabNav = page.getByRole("navigation", { name: /Symbol detail pages/i });
    await expect(tabNav).toBeVisible();
    await expect(page.getByRole("button", { name: "Fundamentals" })).toBeVisible();

    const clippedTabs = await tabNav.evaluate((nav) => {
      const navRect = nav.getBoundingClientRect();

      return Array.from(nav.querySelectorAll("button")).flatMap((button) => {
        const rect = button.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(button);
        const labelLineCount = new Set(
          Array.from(range.getClientRects())
            .filter((lineRect) => lineRect.width > 0 && lineRect.height > 0)
            .map((lineRect) => Math.round(lineRect.top)),
        ).size;
        const clipsInline = button.scrollWidth > button.clientWidth + 1;
        const clipsBlock = button.scrollHeight > button.clientHeight + 1;
        const outsideNav = rect.left < navRect.left - 1 || rect.right > navRect.right + 1;
        const wrapsLabel = labelLineCount > 1;

        if (!clipsInline && !clipsBlock && !outsideNav && !wrapsLabel) return [];

        return [
          {
            label: button.textContent?.trim() ?? "",
            labelLineCount,
            clientWidth: button.clientWidth,
            scrollWidth: button.scrollWidth,
            clientHeight: button.clientHeight,
            scrollHeight: button.scrollHeight,
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            navLeft: Math.round(navRect.left),
            navRight: Math.round(navRect.right),
          },
        ];
      });
    });

    expect(clippedTabs).toEqual([]);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
      .toBeLessThanOrEqual(1);
  });

  test("chart header keeps Korean title and range controls readable at 390px", async ({ page }) => {
    const requestCounts = {
      priceHistory: 0,
      technical: 0,
      action: 0,
      fundamentals: 0,
    };
    const priceHistoryRequests: PriceHistoryRequestSnapshot[] = [];

    await mockDetailModeSwitchApis(page, requestCounts, priceHistoryRequests);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dashboard/symbol/005930?${symbolSeed}`);

    const chart = page.locator("#chart");
    await expect(chart.getByRole("heading", { name: /Swipe-aware candlestick chart/i })).toBeVisible();
    await page.getByRole("button", { name: /Korean/i }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");

    const chartTitle = chart.getByRole("heading", { name: "스와이프형 캔들 차트" });
    await expect(chartTitle).toBeVisible();
    for (const range of ["3M", "1Y", "5Y", "MAX"]) {
      await expect(chart.getByRole("button", { name: range })).toBeVisible();
    }

    const headerLayout = await chart.evaluate((section) => {
      const title = Array.from(section.querySelectorAll("h2")).find(
        (node) => node.textContent?.trim() === "스와이프형 캔들 차트",
      );
      const buttons = Array.from(section.querySelectorAll("button")).filter((button) =>
        /^(3M|1Y|5Y|MAX)$/.test(button.textContent?.trim() ?? ""),
      );

      if (!(title instanceof HTMLElement) || buttons.length !== 4) {
        return {
          missing: true,
          titleLineCount: 0,
          controlsStartBelowTitle: false,
          overflow: ["chart header controls"],
          buttonOverflow: [],
          documentOverflow: Number.POSITIVE_INFINITY,
        };
      }

      const chartRect = section.getBoundingClientRect();
      const titleRange = document.createRange();
      titleRange.selectNodeContents(title);
      const titleLineTops = new Set(
        Array.from(titleRange.getClientRects())
          .filter((rect) => rect.width > 0 && rect.height > 0)
          .map((rect) => Math.round(rect.top)),
      );
      titleRange.detach();

      const titleRect = title.getBoundingClientRect();
      const buttonRects = buttons.map((button) => button.getBoundingClientRect());
      const controlsTop = Math.min(...buttonRects.map((rect) => rect.top));
      const measuredNodes = [title, ...buttons] as HTMLElement[];
      const overflow = measuredNodes.flatMap((node) => {
        const rect = node.getBoundingClientRect();
        const overflowsInline = rect.left < chartRect.left - 1 || rect.right > chartRect.right + 1;
        if (!overflowsInline) return [];
        return [node.textContent?.trim() || node.nodeName];
      });
      const buttonOverflow = buttons.flatMap((button) => {
        const clipsInline = button.scrollWidth > button.clientWidth + 1;
        const clipsBlock = button.scrollHeight > button.clientHeight + 1;
        if (!clipsInline && !clipsBlock) return [];
        return [button.textContent?.trim() || "range button"];
      });

      return {
        missing: false,
        titleLineCount: titleLineTops.size,
        controlsStartBelowTitle: controlsTop >= titleRect.bottom - 1,
        overflow,
        buttonOverflow,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    expect(headerLayout).toEqual({
      missing: false,
      titleLineCount: 1,
      controlsStartBelowTitle: true,
      overflow: [],
      buttonOverflow: [],
      documentOverflow: expect.any(Number),
    });
    expect(headerLayout.documentOverflow).toBeLessThanOrEqual(1);
  });

  test("weekend quote state shows closed session instead of active polling at 390px", async ({ page }) => {
    const requestCounts = {
      priceHistory: 0,
      technical: 0,
      action: 0,
      fundamentals: 0,
    };
    const priceHistoryRequests: PriceHistoryRequestSnapshot[] = [];
    const marketDate = "2026-05-08";
    let quoteRequestCount = 0;

    await mockDetailModeSwitchApis(page, requestCounts, priceHistoryRequests, {
      marketDate,
      marketStatusIsOpen: false,
      marketStatusState: "WEEKEND",
      onQuoteRequest: () => {
        quoteRequestCount += 1;
      },
      quoteMarketState: "WEEKEND",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      `/dashboard/symbol/005930?name=Samsung%20Electronics&market=KOSPI&standardCode=KR7005930003&marketDate=${marketDate}&navContext=piotroski`,
    );
    await page.getByRole("button", { name: /Korean/i }).click();

    const topbar = page.locator("header.topbar");
    const hero = page.locator("#summary");
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(topbar).toContainText("마켓 닫힘");
    await expect(hero).toContainText("KOSPI: WEEKEND");
    await expect(hero).toContainText("휴장 세션");
    await expect(hero).not.toContainText("폴링 활성");
    await expect.poll(() => quoteRequestCount).toBe(1);

    await page.waitForTimeout(1_800);
    expect(quoteRequestCount).toBe(1);
  });

  test("keeps the dashboard closed state when symbol live reads are unavailable at 390px", async ({ page }) => {
    const requestCounts = {
      priceHistory: 0,
      technical: 0,
      action: 0,
      fundamentals: 0,
    };
    const priceHistoryRequests: PriceHistoryRequestSnapshot[] = [];
    let quoteRequestCount = 0;

    await page.addInitScript(() => {
      const now = Date.now();
      window.localStorage.setItem("trading-web.locale", JSON.stringify("ko"));
      window.sessionStorage.setItem(
        "kai.trading-api.cache.v1",
        JSON.stringify({
          "SNAPSHOT GET /api/trading/market/status": {
            cachedAt: now,
            expiresAt: now + 60_000,
            data: {
              state: "CLOSED",
              is_open: false,
              server_time: "2026-08-29T00:00:00+09:00",
            },
          },
        }),
      );
    });
    await mockDetailModeSwitchApis(page, requestCounts, priceHistoryRequests, {
      marketDate: "2026-08-28",
      marketStatusUnavailable: true,
      onQuoteRequest: () => {
        quoteRequestCount += 1;
      },
      quoteUnavailable: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      "/dashboard/symbol/005930?name=Samsung%20Electronics&market=KOSPI&standardCode=KR7005930003&marketDate=2026-08-28&navContext=piotroski",
    );

    const topbar = page.locator("header.topbar");
    const hero = page.locator("#summary");
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(topbar).toContainText("마켓 닫힘");
    await expect(hero).toContainText("휴장 세션");
    await expect(hero).not.toContainText("폴링 활성");
    await expect.poll(() => quoteRequestCount).toBe(1);

    await page.waitForTimeout(1_800);
    expect(quoteRequestCount).toBe(1);
  });

  test("technical unavailable state in Korean hides backend tokens on mobile", async ({ page }) => {
    const requestCounts = {
      priceHistory: 0,
      technical: 0,
      action: 0,
      fundamentals: 0,
    };
    const priceHistoryRequests: PriceHistoryRequestSnapshot[] = [];

    await page.addInitScript(() => {
      window.localStorage.setItem("trading-web.locale", JSON.stringify("ko"));
    });
    await mockDetailModeSwitchApis(page, requestCounts, priceHistoryRequests, {
      quoteAvailable: false,
      quoteUnavailableReason: "no_live_quote_or_fresh_fallback",
      technicalSnapshotAvailable: false,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dashboard/symbol/005930/technical-analysis?${symbolSeed}`);

    const hero = page.locator("#summary");
    const technical = page.locator("#technical");
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(hero).toContainText("최신 호가 소스를 기다리는 중");
    await expect(hero).toContainText("호가 커버리지를 확인할 수 없습니다. 최신 호가 소스를 기다리는 중.");
    await expect(technical.getByRole("heading", { name: "저장된 스냅샷 지표" })).toBeVisible();
    await expect(technical).toContainText("사용할 수 없음");
    await expect(technical).toContainText("스냅샷 없음");
    await expect(technical).toContainText("소스 날짜 없음 · 레이어 신선도는 가격 신선도와 별개입니다.");

    await expect(hero).not.toContainText("no_live_quote_or_fresh_fallback");
    await expect(technical).not.toContainText("no_live_quote_or_fresh_fallback");
    await expect(technical).not.toContainText("Unavailable");
    await expect(technical).not.toContainText("No payload keys");
    await expect(technical).not.toContainText("소스 날짜 소스 날짜 없음");
  });

  test("deep detail routes preserve their active mode and dedicated sections", async ({ page }) => {
    const requestCounts = {
      priceHistory: 0,
      technical: 0,
      action: 0,
      fundamentals: 0,
    };
    const priceHistoryRequests: PriceHistoryRequestSnapshot[] = [];

    await mockDetailModeSwitchApis(page, requestCounts, priceHistoryRequests);

    for (const detailPage of detailPages) {
      await page.goto(`/dashboard/symbol/005930/${detailPage.path}?${symbolSeed}`);

      await expect(page.locator(`[data-mode="${detailPage.mode}"]`)).toBeVisible();
      await expect(page.getByRole("status", { name: /Loading symbol workspace|Loading next surface/i })).toHaveCount(0);

      for (const sectionId of detailPage.visibleSectionIds) {
        await expect(page.locator(`#${sectionId}`)).toBeVisible();
      }

      for (const sectionId of detailPage.hiddenSectionIds) {
        await expect(page.locator(`#${sectionId}`)).toHaveCount(0);
      }
    }
  });

  test("system freshness card keeps status text readable and contained on mobile", async ({ page }) => {
    await mockSystemFreshnessApis(page);

    await page.goto(`/dashboard/symbol/005930/system-freshness?${symbolSeed}`);

    const freshnessCard = page.locator("#freshness");
    await expect(freshnessCard.getByRole("heading", { name: /Layer-specific freshness registry/i })).toBeVisible();

    const runningStatus = freshnessCard.locator(".pill.info", { hasText: "Running" });
    await expect(runningStatus).toBeVisible();
    await expect(runningStatus).toHaveCSS("color", "rgb(107, 167, 255)");

    const overflowingNodes = await freshnessCard.evaluate((card) => {
      const cardRect = card.getBoundingClientRect();
      return Array.from(
        card.querySelectorAll(".moduleRow, .metricCard, .moduleAside, .moduleApi, .pill, strong, p, span"),
      ).flatMap((node) => {
        const rect = node.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return [];
        if (rect.left >= cardRect.left - 1 && rect.right <= cardRect.right + 1) return [];

        const label = node.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ?? node.nodeName;
        return [label];
      });
    });

    expect(overflowingNodes).toEqual([]);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
      .toBeLessThanOrEqual(1);
  });

  test("system freshness fundamentals row preserves the history-loaded state without a latest snapshot", async ({
    page,
  }) => {
    await mockSystemFreshnessApis(page, { fundamentalsHistoryEntries: 3 });

    await page.goto(`/dashboard/symbol/005930/system-freshness?${symbolSeed}`);

    const fundamentalsRow = page.locator("#freshness article").filter({ hasText: /Fundamentals/i });
    await expect(fundamentalsRow).toContainText("History loaded");
    await expect(fundamentalsRow.locator(".pill.info", { hasText: "History loaded" })).toBeVisible();
    await expect(fundamentalsRow).not.toContainText("No history");
  });

  test("unavailable action summary hides directional endpoint labels", async ({ page }) => {
    await mockSystemFreshnessApis(page);

    await page.goto(`/dashboard/symbol/005930/action-summary?${symbolSeed}`);

    const actionSection = page.locator("#action");
    const recommendationCard = page.locator("#summary article").filter({ hasText: "Recommendation" });
    await expect(recommendationCard).toHaveAttribute("data-action-state", "unavailable");
    await expect(recommendationCard).toContainText("Unavailable");
    await expect(recommendationCard).not.toContainText("Coming soon");
    await expect(actionSection).toBeVisible();
    await expect(actionSection).toContainText("Unavailable");
    await expect(actionSection).toContainText("No current action resolved");
    await expect(actionSection).toContainText("Action summary is not resolved for this symbol-date packet.");
    await expect(actionSection).not.toContainText(/\bSell\b/);
    await expect(actionSection).not.toContainText("Strong Buy");
    await expect(actionSection.getByRole("meter")).toHaveCount(0);
    await expect(actionSection.locator('[role="status"][aria-label="Signal score: No current action resolved"]')).toBeVisible();
  });

  for (const viewport of [
    { label: "desktop", width: 1280, height: 900 },
    { label: "390x844 mobile", width: 390, height: 844 },
  ]) {
    test(`dashboard recommendation fallback retrieves same-date evidence beyond the 200-row cap on ${viewport.label}`, async ({
      page,
    }) => {
      await mockSystemFreshnessApis(page);
      await mockSignalDeciderRecommendationEvidence(page);
      await page.route("**/api/trading/quotes/005930", async (route) => {
        await route.fulfill({ status: 503, json: { detail: "Quote unavailable" } });
      });
      await page.route("**/api/trading/symbols/search?**", async (route) => {
        await route.fulfill({ status: 503, json: { detail: "Symbol search unavailable" } });
      });

      const recommendationQuery = new URLSearchParams({
        name: "현대해상",
        market: "KOSPI",
        marketDate: "2026-04-10",
        recommendationSource: "dashboard-decider",
        referencePriceKind: "current",
        stopLossPrice: "51800",
        targetPrice: "55200",
        referencePrice: "52400",
      });

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/dashboard/symbol/005930/action-summary?${recommendationQuery}`);

      const context = page.getByRole("region", { name: /현대해상 · Selected recommendation context/i });
      const actionSection = page.locator("#action");
      await expect(page.getByRole("heading", { name: "현대해상", exact: true })).toBeVisible();
      await expect(context).toBeVisible();
      await expect(context).toContainText("Dashboard Decider");
      await expect(context).toContainText("Market date 2026-04-10");
      await expect(context).toContainText("51,800");
      await expect(context).toContainText("55,200");
      await expect(context).toContainText("52,400");
      await expect(actionSection).toHaveAttribute("data-action-state", "unavailable");

      const evidenceLink = actionSection.getByRole("link", {
        name: /Action-summary rationale unavailable · Review same-date signal-decider evidence/i,
      });
      await expect(evidenceLink).toHaveAttribute(
        "href",
        "/dashboard/signal-decider-feedback?marketDate=2026-04-10&q=005930&symbols=005930",
      );
      await evidenceLink.click();

      await expect(page).toHaveURL(
        /\/dashboard\/signal-decider-feedback\?marketDate=2026-04-10&q=005930&symbols=005930$/,
      );
      const evidenceCard = page.getByTestId("signal-decider-result-card");
      await expect(evidenceCard).toHaveCount(1);
      await expect(evidenceCard).toContainText("현대해상");
      await expect(evidenceCard).toContainText("005930");
      await expect(evidenceCard).toContainText(
        "Insurance momentum and valuation support the same-date recommendation.",
      );
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
        .toBeLessThanOrEqual(1);

      if (viewport.width === 390) {
        await expectMobileContentClearsBottomChrome(page, evidenceCard);
      }
    });
  }

  test("Korean hero and Action tab deduplicate mapped reasons in the terminal insufficient-history state", async ({
    page,
  }) => {
    const requestCounts = {
      priceHistory: 0,
      technical: 0,
      action: 0,
      fundamentals: 0,
    };
    const priceHistoryRequests: PriceHistoryRequestSnapshot[] = [];

    await page.addInitScript(() => {
      window.localStorage.setItem("trading-web.locale", JSON.stringify("ko"));
    });
    await mockDetailModeSwitchApis(page, requestCounts, priceHistoryRequests, {
      actionConfidenceTier: "low",
      actionLabel: "insufficient_data",
      actionReasons: [
        "insufficient_history",
        "missing_price_history",
        "missing_technical_history",
        "missing_factor_history",
      ],
      actionRiskTier: "unknown",
      actionSignalScore: 0,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dashboard/symbol/005930/action-summary?${symbolSeed}`);

    const recommendationCard = page.locator("#summary article").filter({ hasText: "추천" });
    const actionSection = page.locator("#action");
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(recommendationCard).toContainText("준비 중");
    await expect(recommendationCard).toHaveAttribute("data-action-state", "insufficient-history");
    await expect(recommendationCard).toContainText("데이터 부족 · 신뢰도 낮음");
    await expect(recommendationCard).not.toContainText("준비 중");
    await expect(actionSection).toHaveAttribute("data-action-state", "insufficient-history");
    await expect(actionSection).toContainText("데이터 부족 · 신뢰도 낮음");
    await expect(actionSection).toContainText("현재 액션: 저장된 과거 데이터 부족");
    await expect(actionSection).toContainText(
      "저장된 과거 데이터 부족 · 기타 액션 근거 · 저장 데이터가 부족해 액션을 판단할 신뢰도가 아직 충분하지 않습니다.",
    );
    await expect(actionSection.getByText("기타 액션 근거", { exact: true })).toHaveCount(1);
    await expect(actionSection).toContainText("점수 계산 불가");
  });

  test("Korean action summary localizes watch-long decision reasons on mobile", async ({ page }) => {
    const requestCounts = {
      priceHistory: 0,
      technical: 0,
      action: 0,
      fundamentals: 0,
    };
    const priceHistoryRequests: PriceHistoryRequestSnapshot[] = [];

    await page.addInitScript(() => {
      window.localStorage.setItem("trading-web.locale", JSON.stringify("ko"));
    });
    await mockDetailModeSwitchApis(page, requestCounts, priceHistoryRequests, {
      actionLabel: "watch_long",
      actionReasons: [
        "Mixed Ma Alignment",
        "Range Bound State",
        "Fresh 20d Breakout",
        "High Atr Risk",
      ],
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dashboard/symbol/005930/action-summary?${symbolSeed}`);

    const actionSection = page.locator("#action");
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(actionSection).toContainText("롱 관찰");
    await expect(actionSection).toContainText("이동평균선 배열 혼조");
    await expect(actionSection).toContainText("박스권 상태");
    await expect(actionSection).toContainText("신규 20일 돌파");
    await expect(actionSection).toContainText("높은 ATR 리스크");
    await expect(actionSection).not.toContainText(
      /Watch Long|Mixed Ma Alignment|Range Bound State|Fresh 20d Breakout|High Atr Risk|watch_long/i,
    );
  });

  test("disclosure detail requests the same row cap it can render", async ({ page }) => {
    const aggregateRequest = page.waitForRequest((request) => {
      const url = request.url();
      return url.includes("/api/trading/agent-context/symbol-day") && url.includes("disclosures_limit=8");
    });

    await page.goto(`/dashboard/symbol/005930/disclosure-coverage?${symbolSeed}`);
    await expect(page.getByText(/Disclosure & Coverage Detail/i)).toBeVisible();
    await aggregateRequest;
  });

  test("detail tabs switch in place and localize disclosure refresh overlays", async ({ page }) => {
    const requestCounts = {
      priceHistory: 0,
      technical: 0,
      action: 0,
      fundamentals: 0,
    };
    const priceHistoryRequests: PriceHistoryRequestSnapshot[] = [];

    await mockDetailModeSwitchApis(page, requestCounts, priceHistoryRequests);
    await page.goto(`/dashboard/symbol/005930?${symbolSeed}`);

    const workspaceLoader = page.getByRole("status", { name: /Loading symbol workspace/i });
    const anyFullPageLoader = page
      .getByRole("status", { name: /Loading symbol workspace|Loading next surface/i });

    await expect(page.getByRole("heading", { name: "Samsung Electronics" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Swipe-aware candlestick chart/i })).toBeVisible();
    await expect(workspaceLoader).toHaveCount(0);
    const chartImage = page.getByRole("img", { name: /Historical candlestick chart for 005930/i });
    const focusDateValue = page.locator("#chart article").first().locator("strong");
    const latestFocusDate = "2026.04.10";
    await expect(focusDateValue).toHaveText(latestFocusDate);
    const chartBounds = await chartImage.boundingBox();
    expect(chartBounds).not.toBeNull();

    let preservedFocusDate: string | null = null;
    for (const xRatio of [0.02, 0.05, 0.08, 0.12, 0.16, 0.2, 0.24, 0.28]) {
      await chartImage.hover({
        position: {
          x: Math.round((chartBounds?.width ?? 0) * xRatio),
          y: Math.round((chartBounds?.height ?? 0) * 0.45),
        },
      });

      const nextFocusDate = (await focusDateValue.textContent())?.trim() ?? "";
      if (nextFocusDate && nextFocusDate !== latestFocusDate) {
        preservedFocusDate = nextFocusDate;
        await chartImage.click({
          position: {
            x: Math.round((chartBounds?.width ?? 0) * xRatio),
            y: Math.round((chartBounds?.height ?? 0) * 0.45),
          },
        });
        break;
      }
    }

    expect(preservedFocusDate).not.toBeNull();
    await expect(focusDateValue).toHaveText(preservedFocusDate!);

    let latestFocusDateRestored = false;
    for (const xRatio of [0.5, 0.55, 0.6, 0.7, 0.8, 0.9]) {
      await chartImage.hover({
        position: {
          x: Math.round((chartBounds?.width ?? 0) * xRatio),
          y: Math.round((chartBounds?.height ?? 0) * 0.45),
        },
      });

      const nextFocusDate = (await focusDateValue.textContent())?.trim() ?? "";
      if (nextFocusDate === latestFocusDate) {
        latestFocusDateRestored = true;
        await chartImage.click({
          position: {
            x: Math.round((chartBounds?.width ?? 0) * xRatio),
            y: Math.round((chartBounds?.height ?? 0) * 0.45),
          },
        });
        break;
      }
    }

    expect(latestFocusDateRestored).toBe(true);
    await expect(focusDateValue).toHaveText(latestFocusDate);
    const initialDetailUrl = page.url();
    await page.evaluate(() => {
      const state = window as Window & {
        __symbolDetailLoaderSeen?: boolean;
        __symbolDetailLoaderObserver?: MutationObserver;
      };
      const selector =
        '[role="status"][aria-label="Loading symbol workspace"], [role="status"][aria-label="Loading next surface"]';
      const markIfLoaderAppears = () => {
        if (document.querySelector(selector)) {
          state.__symbolDetailLoaderSeen = true;
        }
      };

      state.__symbolDetailLoaderSeen = false;
      state.__symbolDetailLoaderObserver?.disconnect();
      state.__symbolDetailLoaderObserver = new MutationObserver(markIfLoaderAppears);
      state.__symbolDetailLoaderObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["aria-label", "role"],
        childList: true,
        subtree: true,
      });
    });
    await expect
      .poll(() => ({ ...requestCounts }))
      .toEqual({
        priceHistory: 1,
        technical: 0,
        action: 1,
        fundamentals: 0,
      });
    expect(priceHistoryRequests).toEqual([
      {
        startDate: "2025-04-10",
        endDate: "2026-04-10",
        limit: null,
      },
    ]);

    const actionTab = page.getByRole("button", { name: "Action" });
    await actionTab.scrollIntoViewIfNeeded();
    await actionTab.click();
    await page.waitForTimeout(100);
    await expect(page).toHaveURL(initialDetailUrl);
    await expect(page.locator('[data-mode="action-summary"]')).toBeVisible();
    await expect(page.locator("#action")).toBeVisible();
    await expect(page.locator("#action")).toContainText("Signal score");
    await expect(page.locator("#action")).toContainText("94 / 100");
    await expect(page.locator("#action")).toContainText("Current action: Strong Buy · Bias Long");
    await expect(page.locator("#action")).not.toContainText("Sell");
    await expect(page.getByRole("meter", { name: /Signal score: 94 \/ 100/i })).toBeVisible();
    await expect(workspaceLoader).toHaveCount(0);
    await expect.poll(() => requestCounts.action).toBe(1);
    expect(requestCounts.technical).toBe(0);
    expect(requestCounts.fundamentals).toBe(0);

    const technicalTab = page.getByRole("button", { name: "Technical" });
    await technicalTab.scrollIntoViewIfNeeded();
    await technicalTab.click();
    await page.waitForTimeout(100);
    await expect(page).toHaveURL(initialDetailUrl);
    await expect(page.locator('[data-mode="technical-analysis"]')).toBeVisible();
    await expect(page.locator("#technical")).toBeVisible();
    await expect(focusDateValue).toHaveText(latestFocusDate);
    await expect(workspaceLoader).toHaveCount(0);
    await expect.poll(() => requestCounts.technical).toBe(1);
    expect(requestCounts.fundamentals).toBe(0);

    await actionTab.click();
    await page.waitForTimeout(50);
    await actionTab.click();
    await page.waitForTimeout(50);
    await technicalTab.click();
    await page.waitForTimeout(100);
    await expect(page).toHaveURL(initialDetailUrl);
    await expect(page.locator('[data-mode="technical-analysis"]')).toBeVisible();
    await expect(anyFullPageLoader).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const state = window as Window & { __symbolDetailLoaderSeen?: boolean };
          return state.__symbolDetailLoaderSeen ?? false;
        }),
      )
      .toBe(false);

    const fundamentalsTab = page.getByRole("button", { name: "Fundamentals" });
    await fundamentalsTab.scrollIntoViewIfNeeded();
    await fundamentalsTab.click();
    await page.waitForTimeout(100);
    await expect(page).toHaveURL(initialDetailUrl);
    await expect(page.locator('[data-mode="fundamentals-history"]')).toBeVisible();
    await expect(page.locator("#fundamentals")).toBeVisible();
    await expect(workspaceLoader).toHaveCount(0);
    await expect.poll(() => requestCounts.fundamentals).toBe(1);

    const disclosureTab = page.getByRole("button", { name: "Disclosures" });
    await disclosureTab.scrollIntoViewIfNeeded();
    await disclosureTab.click();
    const disclosuresSection = page.locator("#disclosures");
    await expect(page).toHaveURL(initialDetailUrl);
    await expect(page.locator('[data-mode="disclosure-coverage"]')).toBeVisible();
    await expect(disclosuresSection).toHaveAttribute("aria-busy", "true");
    await expect(disclosuresSection.locator("strong", { hasText: /No Disclosure Found/i })).toBeVisible();
    await expect(anyFullPageLoader).toHaveCount(0);
    await expect(disclosuresSection).toHaveAttribute("data-refreshing", "false");

    expect(requestCounts.priceHistory).toBeGreaterThanOrEqual(1);
    expect(requestCounts.priceHistory).toBeLessThanOrEqual(2);
    expect(requestCounts.technical).toBe(1);
    expect(requestCounts.action).toBe(1);
    expect(requestCounts.fundamentals).toBe(1);
  });

  test("disclosure report cards open a readable report detail screen", async ({ page }) => {
    const marketDate = "2026-04-10";

    await page.route("**/api/trading/quotes/005930", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          symbol: "005930",
          company_name: "Samsung Electronics",
          price: 70000,
          change: 0,
          change_pct: 0,
          volume: 1000,
          turnover: 70000000,
          market_state: "CLOSED",
          source: "daily_price_bar",
          fallback: true,
          is_live: false,
          available: true,
          trade_date: marketDate,
        }),
      });
    });

    await page.route("**/api/trading/market/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          state: "CLOSED",
          is_open: false,
          server_time: "2026-04-10T16:00:00+09:00",
        }),
      });
    });

    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: marketDate,
            eod_status: "completed",
            symbols_total: 1,
            symbols_succeeded: 1,
            symbols_failed: 0,
          },
          latest: {
            price_trade_date: marketDate,
            technical_market_date: marketDate,
            action_market_date: marketDate,
          },
          technical: {
            success: true,
            latest_date: marketDate,
          },
        }),
      });
    });

    await page.route("**/api/trading/agent-context/symbol-day?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: marketDate,
            symbols: ["005930"],
            fs_div: null,
            fs_label: null,
            disclosures_limit: 8,
          },
          summary: {
            requested_symbol_count: 1,
            matched_symbol_count: 1,
            technical_snapshot_count: 0,
            action_summary_count: 0,
            fundamentals_count: 0,
            recent_disclosure_symbol_count: 1,
            missing_symbols: [],
          },
          items: [
            {
              symbol: "005930",
              market_date: marketDate,
              company: {
                symbol: "005930",
                name_ko: "Samsung Electronics",
                market: "KOSPI",
                instrument_type: "stock",
                standard_code: "KR7005930003",
                source: "test",
                is_active: true,
                last_refreshed_at: null,
                dart: {
                  corp_code: "00126380",
                  corp_name: "Samsung Electronics",
                },
              },
              technical_snapshot: null,
              action_summary: null,
              fundamentals: {
                latest_snapshot: null,
                history_summary: {
                  entries: 0,
                  latest_receipt_date: null,
                  latest_period_end_date: null,
                  available_business_years: [],
                  recent_periods: [],
                },
              },
              recent_disclosures: {
                count: 1,
                items: [
                  {
                    rcept_no: "202604100001",
                    corp_code: "00126380",
                    corp_name: "Samsung Electronics",
                    report_nm: "Quarterly report",
                    filing_category: "quarterly",
                    is_financial_report: true,
                    receipt_date: marketDate,
                    remark: null,
                    fundamentals_capture_status: "captured",
                  },
                ],
              },
              availability: {
                company: true,
                technical_snapshot: false,
                action_summary: false,
                fundamentals: false,
                recent_disclosures: true,
              },
            },
          ],
        }),
      });
    });

    await page.route("**/api/trading/disclosures/dart/filings/document?**", async (route) => {
      await route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><html><body><main>Mock filing document body</main></body></html>",
      });
    });

    await page.goto(withBasePath(`/dashboard/symbol/005930/disclosure-coverage?${symbolSeed}`));
    await page.getByRole("link", { name: /Open report detail for Quarterly report/i }).click();

    const expectedDocumentUrl =
      `${appBasePath}/api/trading/disclosures/dart/filings/document?rcept_no=202604100001`;
    const reportFrame = page.locator('iframe[title="Quarterly report filing document"]');

    await expect(page).toHaveURL(/\/dashboard\/symbol\/005930\/disclosure-coverage\/202604100001\?/);
    await expect(page.getByText(/DART Report Detail/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Quarterly report/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Back to disclosures/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Download document/i })).toHaveAttribute(
      "href",
      expectedDocumentUrl,
    );
    await expect(reportFrame).toHaveAttribute("src", expectedDocumentUrl);
    await expect(page.frameLocator('iframe[title="Quarterly report filing document"]').getByText(/Mock filing document body/i)).toBeVisible();
  });
});
