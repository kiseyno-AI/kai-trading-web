import { expect, test } from "@playwright/test";

const symbolSeed =
  "name=Samsung%20Electronics&market=KOSPI&standardCode=KR7005930003&marketDate=2026-04-10";

test.describe("symbol detail desktop", () => {
  test("overview uses desktop rail and wide Stitch sections", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/dashboard/symbol/005930?${symbolSeed}`);

    await expect(page.getByRole("navigation", { name: /Primary desktop/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Swipe-aware candlestick chart/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Deterministic action layer/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Stored snapshot metrics/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Stored DART filing history/i })).toBeVisible();
  });

  test("action detail button does not add a back-stack entry", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/dashboard");
    await expect(page.getByText(/Trading Dashboard/i)).toBeVisible();

    await page.goto(`/dashboard/symbol/005930?${symbolSeed}`);
    await page.getByRole("link", { name: /Open action detail/i }).click();

    await expect(page).toHaveURL(/\/dashboard\/symbol\/005930\/action-summary\?/);
    await expect(page.getByText(/Action Summary Detail/i)).toBeVisible();

    await page.goBack();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(/Trading Dashboard/i)).toBeVisible();
  });

  test("technical detail renders the desktop candlestick view", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const priceBarsRequest = page.waitForRequest((request) =>
      request.url().includes("/api/trading/symbols/005930/price-bars"),
    );

    await page.goto(`/dashboard/symbol/005930/technical-analysis?${symbolSeed}`);

    await expect(page.getByText(/Technical Analysis Detail/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Candlestick view/i })).toBeVisible();
    await priceBarsRequest;
    await expect(page.getByText(/Swipe or drag the chart to move date focus/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Stored snapshot metrics/i }).first()).toBeVisible();
  });

  test("fundamentals and action desktop routes keep their dedicated sections", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.goto(`/dashboard/symbol/005930/fundamentals-history?${symbolSeed}`);
    await expect(page.getByText(/Fundamentals History Detail/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Stored DART filing history/i })).toBeVisible();

    await page.goto(`/dashboard/symbol/005930/action-summary?${symbolSeed}`);
    await expect(page.getByText(/Action Summary Detail/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Deterministic action layer/i }).first()).toBeVisible();
  });

  test("fundamentals route tolerates object-shaped highlights", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const pageErrors: string[] = [];
    const marketDate = "2026-04-10";

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

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
            fundamentals_count: 1,
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
                latest_snapshot: {
                  filing: {
                    rcept_no: "202604100001",
                    report_name: "Annual report",
                    filing_category: "annual",
                    receipt_date: marketDate,
                    captured_at: null,
                  },
                  period: {
                    business_year: 2025,
                    report_code: "11011",
                    report_label: "FY 2025",
                    period_type: "annual",
                    period_scope: null,
                    quarter: null,
                    period_end_month: 12,
                    period_end_date: "2025-12-31",
                  },
                  statement: {
                    fs_div: "CFS",
                    fs_label: "Consolidated",
                    statement_type: "income_statement",
                    currency: "KRW",
                    source_status: "ok",
                    source_message: null,
                    row_count: 2,
                  },
                  highlights: {},
                },
                history_summary: {
                  entries: 1,
                  latest_receipt_date: marketDate,
                  latest_period_end_date: "2025-12-31",
                  available_business_years: [2025],
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
                fundamentals: true,
                recent_disclosures: false,
              },
            },
          ],
        }),
      });
    });

    await page.route("**/api/trading/disclosures/dart/fundamentals/history?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
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
                  highlights: {
                    revenue: 279600000000000,
                    operating_profit: {
                      label: "Operating Profit",
                      value: 32600000000000,
                    },
                  },
                },
              ],
            },
          ],
        }),
      });
    });

    await page.goto(`/dashboard/symbol/005930/fundamentals-history?${symbolSeed}`);

    await expect(page.getByText(/Fundamentals History Detail/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Stored DART filing history/i })).toBeVisible();
    await expect(page.getByText("Revenue").first()).toBeVisible();
    await expect(page.getByText("Operating Profit").first()).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
