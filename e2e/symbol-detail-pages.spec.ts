import { expect, test, type Page } from "@playwright/test";

import { chromiumIPhone13 } from "./devices";

test.use(chromiumIPhone13);

const symbolSeed =
  "name=Samsung%20Electronics&market=KOSPI&standardCode=KR7005930003&marketDate=2026-04-10";

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

async function mockDetailModeSwitchApis(
  page: Page,
  requestCounts: { priceHistory: number; technical: number; action: number; fundamentals: number },
  priceHistoryRequests: PriceHistoryRequestSnapshot[],
) {
  const marketDate = "2026-04-10";
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
    await route.fulfill({
      json: {
        symbol: "005930",
        company_name: "Samsung Electronics",
        price: 70000,
        change: 500,
        change_pct: 0.72,
        volume: 1250000,
        turnover: 87500000000,
        market_state: "CLOSED",
        source: "daily_price_bar",
        fallback: true,
        is_live: false,
        available: true,
        trade_date: marketDate,
      },
    });
  });

  await page.route("**/api/trading/market/status", async (route) => {
    await route.fulfill({
      json: {
        state: "CLOSED",
        is_open: false,
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
        items: [
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
        ],
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
            action_label: "strong_buy",
            bias_direction: "long",
            signal_score: 94,
            confidence_tier: "high",
            risk_tier: "medium",
            trigger_price: 70100,
            invalidation_price: 68000,
            support_price: 69000,
            resistance_price: 72000,
            reasons: ["Trend support confirmed", "Volume expansion detected"],
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
    await expect(runningStatus).toHaveCSS("color", "rgb(74, 168, 255)");

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
    await expect(actionSection).toBeVisible();
    await expect(actionSection).toContainText("Unavailable");
    await expect(actionSection).toContainText("No current action resolved");
    await expect(actionSection).toContainText("Action summary is not resolved for this symbol-date packet.");
    await expect(actionSection).not.toContainText(/\bSell\b/);
    await expect(actionSection).not.toContainText("Strong Buy");
    await expect(actionSection.getByRole("meter")).toHaveCount(0);
    await expect(actionSection.locator('[role="status"][aria-label="Signal score: No current action resolved"]')).toBeVisible();
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
        action: 0,
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

    await page.goto(`/dashboard/symbol/005930/disclosure-coverage?${symbolSeed}`);
    await page.getByRole("link", { name: /Open report detail for Quarterly report/i }).click();

    await expect(page).toHaveURL(/\/dashboard\/symbol\/005930\/disclosure-coverage\/202604100001\?/);
    await expect(page.getByText(/DART Report Detail/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Quarterly report/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Back to disclosures/i })).toBeVisible();
    await expect(page.frameLocator('iframe[title="Quarterly report filing document"]').getByText(/Mock filing document body/i)).toBeVisible();
  });
});
