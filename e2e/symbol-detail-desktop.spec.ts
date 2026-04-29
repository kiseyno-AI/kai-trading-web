import { expect, test } from "@playwright/test";

const symbolSeed =
  "name=Samsung%20Electronics&market=KOSPI&standardCode=KR7005930003&marketDate=2026-04-10";

test.describe("symbol detail desktop", () => {
  test("revisits symbol workspace with local unit refresh overlays instead of a full-page loader", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const now = "2026-04-18T09:10:00+09:00";
    const marketDate = "2026-04-18";
    let quoteRequestCount = 0;
    let priceHistoryRequestCount = 0;

    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({
        json: {
          count: 0,
          items: [],
        },
      });
    });

    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      await route.fulfill({
        json: {
          tracked_symbols: [],
          count: 0,
          last_updated_at: null,
        },
      });
    });

    await page.route("**/api/trading/scanner/realtime-trending?**", async (route) => {
      await route.fulfill({
        json: {
          status: "ok",
          source: "kis",
          as_of: now,
          market: "KRX",
          summary: {
            item_count: 0,
          },
          items: [],
        },
      });
    });

    await page.route("**/api/trading/symbols/search?**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const query = requestUrl.searchParams.get("q") ?? "";

      await route.fulfill({
        json: {
          query,
          count: query === "005930" ? 1 : 0,
          items:
            query === "005930"
              ? [
                  {
                    symbol: "005930",
                    standard_code: "KR7005930003",
                    name_ko: "Samsung Electronics",
                    market: "KOSPI",
                  },
                ]
              : [],
        },
      });
    });

    await page.route("**/api/trading/market/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          state: "OPEN",
          is_open: true,
          server_time: now,
        }),
      });
    });

    await page.route("**/api/trading/quotes/005930", async (route) => {
      quoteRequestCount += 1;
      await new Promise((resolve) => setTimeout(resolve, quoteRequestCount === 1 ? 120 : 450));
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          symbol: "005930",
          company_name: "Samsung Electronics",
          price: 71500,
          change: 500,
          change_pct: 0.7,
          volume: 1250000,
          turnover: 89375000000,
          market_state: "OPEN",
          source: "kis_live",
          fallback: false,
          is_live: true,
          available: true,
          trade_date: marketDate,
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
        }),
      });
    });

    await page.route("**/api/trading/eod/technical-snapshots?**", async (route) => {
      await route.fulfill({
        json: {
          market_date: marketDate,
          items: [],
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

    await page.route("**/api/trading/disclosures/dart/fundamentals/history?**", async (route) => {
      await route.fulfill({
        json: {
          request: {
            symbols: ["005930"],
            start_date: "2021-04-18",
            end_date: marketDate,
            fs_div: null,
          },
          companies: [],
        },
      });
    });

    await page.route("**/api/trading/symbols/005930/price-bars?**", async (route) => {
      priceHistoryRequestCount += 1;
      await new Promise((resolve) => setTimeout(resolve, priceHistoryRequestCount === 1 ? 140 : 500));
      await route.fulfill({
        json: {
          symbol: "005930",
          count: 3,
          start_date: "2026-04-14",
          end_date: marketDate,
          requested_start_date: "2025-04-18",
          requested_end_date: marketDate,
          items: [
            {
              trade_date: "2026-04-14",
              open_price: 70000,
              high_price: 71000,
              low_price: 69500,
              close_price: 70500,
              volume: 1000000,
              turnover: 70500000000,
              source: "test",
              captured_at: "2026-04-14T16:00:00+09:00",
            },
            {
              trade_date: "2026-04-17",
              open_price: 70600,
              high_price: 71600,
              low_price: 70200,
              close_price: 70900,
              volume: 1100000,
              turnover: 77990000000,
              source: "test",
              captured_at: "2026-04-17T16:00:00+09:00",
            },
            {
              trade_date: marketDate,
              open_price: 71000,
              high_price: 71800,
              low_price: 70800,
              close_price: 71500,
              volume: 1250000,
              turnover: 89375000000,
              source: "test",
              captured_at: `${marketDate}T16:00:00+09:00`,
            },
          ],
        },
      });
    });

    await page.goto("/search");
    await page.getByLabel(/Search markets, symbols, or analysis/i).fill("005930");

    const resultsRow = page.locator("tr").filter({ hasText: "005930" });
    await expect(resultsRow).toBeVisible();
    const anyFullPageLoader = page
      .getByRole("status", { name: /Loading symbol workspace|Loading next surface/i });

    await resultsRow.getByRole("link", { name: "Open" }).click();

    await expect(page).toHaveURL(/\/dashboard\/symbol\/005930\?/);
    await expect(page.getByRole("heading", { name: "Samsung Electronics" })).toBeVisible();

    const chart = page.locator("#chart");
    await expect(chart.getByRole("heading", { name: /Swipe-aware candlestick chart/i })).toBeVisible();
    await expect(anyFullPageLoader).toHaveCount(0);
    await expect(chart.getByText(/^2026\.04\.18$/)).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/search$/);
    await page.getByLabel(/Search markets, symbols, or analysis/i).fill("005930");
    await expect(resultsRow).toBeVisible();

    await resultsRow.getByRole("link", { name: "Open" }).click();

    await expect(page).toHaveURL(/\/dashboard\/symbol\/005930\?/);
    await expect(page.getByRole("heading", { name: "Samsung Electronics" })).toBeVisible();
    await expect(chart).toHaveAttribute("aria-busy", "true");
    await expect(chart.getByRole("heading", { name: /Swipe-aware candlestick chart/i })).toBeVisible();
    await expect(chart.getByText(/^2026\.04\.18$/)).toBeVisible();
    await expect(anyFullPageLoader).toHaveCount(0);
    await expect(chart).toHaveAttribute("data-refreshing", "false");
  });

  test("overview shows Insights chart, factor snapshot, and freshness sections", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/dashboard/symbol/005930?${symbolSeed}`);

    await expect(page.getByRole("navigation", { name: /Primary desktop/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Swipe-aware candlestick chart/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Explainable factor snapshot/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Layer-specific freshness registry/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Deterministic action layer/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Stored snapshot metrics/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Stored DART filing history/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Recent filing coverage/i })).toHaveCount(0);
  });

  test("hero cards swap date-only summaries for focus candle, fundamentals, and Piotroski content", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const marketDate = "2026-04-18";

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
          price: 71500,
          change: 500,
          change_pct: 0.7,
          volume: 1250000,
          turnover: 89375000000,
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
          server_time: `${marketDate}T16:00:00+09:00`,
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
            disclosures_limit: 4,
          },
          summary: {
            requested_symbol_count: 1,
            matched_symbol_count: 1,
            technical_snapshot_count: 0,
            action_summary_count: 0,
            fundamentals_count: 1,
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
                latest_snapshot: {
                  filing: {
                    rcept_no: "202604180001",
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
                count: 1,
                items: [
                  {
                    rcept_no: "202604180001",
                    corp_code: "00126380",
                    corp_name: "Samsung Electronics",
                    report_nm: "Annual report",
                    filing_category: "annual",
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
                fundamentals: true,
                recent_disclosures: true,
              },
            },
          ],
        }),
      });
    });

    await page.route("**/api/trading/eod/technical-snapshots?**", async (route) => {
      await route.fulfill({
        json: {
          market_date: marketDate,
          items: [],
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

    await page.route("**/api/trading/disclosures/dart/fundamentals/history?**", async (route) => {
      await route.fulfill({
        json: {
          request: {
            symbols: ["005930"],
            start_date: "2021-04-18",
            end_date: marketDate,
            fs_div: null,
          },
          companies: [],
        },
      });
    });

    await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
      await route.fulfill({
        json: {
          market_date: marketDate,
          summary: {
            entries: 1,
            requested_symbol: "005930",
            matched_symbols: ["005930"],
            missing_symbols: [],
            passed_count: 1,
            not_passed_count: 0,
          },
          item: {
            symbol: "005930",
            market_date: marketDate,
            passed_filter: true,
            piotroski_score: 8,
            passes_piotroski_score: true,
            captured_at: `${marketDate}T15:42:09+09:00`,
          },
        },
      });
    });

    await page.route("**/api/trading/symbols/005930/price-bars?**", async (route) => {
      await route.fulfill({
        json: {
          symbol: "005930",
          count: 1,
          start_date: marketDate,
          end_date: marketDate,
          requested_start_date: "2025-04-18",
          requested_end_date: marketDate,
          items: [
            {
              trade_date: marketDate,
              open_price: 71000,
              high_price: 71800,
              low_price: 70800,
              close_price: 71500,
              volume: 1250000,
              turnover: 89375000000,
              source: "test",
              captured_at: `${marketDate}T16:00:00+09:00`,
            },
          ],
        },
      });
    });

    await page.goto(`/dashboard/symbol/005930?${symbolSeed}`);

    const summary = page.locator("#summary");
    await expect(summary.getByText("Quote freshness")).toHaveCount(0);
    await expect(summary.getByText("TA latest")).toHaveCount(0);
    await expect(summary.getByText("Action latest")).toHaveCount(0);

    const focusCard = summary.locator("article").filter({ hasText: "Focus candle" });
    await expect(focusCard).toContainText("Open");
    await expect(focusCard).toContainText("71,000");
    await expect(focusCard).toContainText("Close");
    await expect(focusCard).toContainText("71,500");
    await expect(focusCard).toContainText("Volume");
    await expect(focusCard).toContainText("1,250,000");
    await expect(focusCard).toContainText("Highest");
    await expect(focusCard).toContainText("71,800");
    await expect(focusCard).toContainText("Lowest");
    await expect(focusCard).toContainText("70,800");

    const fundamentalsCard = summary.locator("article").filter({ hasText: "Fundamental latest" });
    await expect(fundamentalsCard).toContainText("Annual report");
    await expect(fundamentalsCard).toContainText("2026.04.18");

    const piotroskiCard = summary.locator("article").filter({ hasText: "Piotroski filter" });
    await expect(piotroskiCard).toContainText("Pass");

    const recommendationCard = summary.locator("article").filter({ hasText: "Recommendation" });
    await expect(recommendationCard).toContainText("Coming soon");
  });

  test("factor snapshot surfaces family rows and isolates partial failures", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const marketDate = "2026-04-24";

    await page.route("**/api/trading/symbols/favorites", async (route) => {
      await route.fulfill({
        json: {
          symbols: [],
          count: 0,
        },
      });
    });

    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      await route.fulfill({
        json: {
          tracked_symbols: [],
          count: 0,
          last_updated_at: null,
        },
      });
    });

    await page.route("**/api/trading/scanner/realtime-trending?**", async (route) => {
      await route.fulfill({
        json: {
          items: [],
          count: 0,
          sources: [],
        },
      });
    });

    await page.route("**/api/trading/quotes/005930", async (route) => {
      await route.fulfill({
        json: {
          symbol: "005930",
          company_name: "Samsung Electronics",
          price: 72100,
          change: 600,
          change_pct: 0.84,
          volume: 1400000,
          turnover: 100940000000,
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
      await route.fulfill({
        json: {
          market_date: marketDate,
          items: [],
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

    await page.route("**/api/trading/disclosures/dart/fundamentals/history?**", async (route) => {
      await route.fulfill({
        json: {
          request: {
            symbols: ["005930"],
            start_date: "2021-04-24",
            end_date: marketDate,
            fs_div: null,
          },
          companies: [],
        },
      });
    });

    await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
      await route.fulfill({
        json: {
          market_date: marketDate,
          summary: {
            entries: 1,
            requested_symbol: "005930",
            matched_symbols: ["005930"],
            missing_symbols: [],
            passed_count: 1,
            not_passed_count: 0,
          },
          item: {
            symbol: "005930",
            market_date: marketDate,
            passed_filter: true,
            piotroski_score: 8,
            passes_piotroski_score: true,
            captured_at: `${marketDate}T15:42:09+09:00`,
          },
        },
      });
    });

    await page.route("**/api/trading/symbols/005930/price-bars?**", async (route) => {
      await route.fulfill({
        json: {
          symbol: "005930",
          count: 1,
          start_date: marketDate,
          end_date: marketDate,
          requested_start_date: "2025-04-24",
          requested_end_date: marketDate,
          items: [
            {
              trade_date: marketDate,
              open_price: 71500,
              high_price: 72300,
              low_price: 71200,
              close_price: 72100,
              volume: 1400000,
              turnover: 100940000000,
              source: "test",
              captured_at: `${marketDate}T16:00:00+09:00`,
            },
          ],
        },
      });
    });

    await page.route("**/api/trading/eod/momentum-factors?**", async (route) => {
      await route.fulfill({
        json: {
          market_date: marketDate,
          feature_version: "momentum_factor_v2",
          summary: {
            entries: 1,
            requested_symbols: ["005930"],
            matched_symbols: ["005930"],
            missing_symbols: [],
            ranked_symbols: 1,
            eligible_symbols: 1,
          },
          items: [
            {
              symbol: "005930",
              market_date: marketDate,
              close_price: 72100,
              ma_60: 68900,
              ma_120: 66100,
              momentum_12_1: 0.221,
              return_5d: 0.031,
              return_5d_rank: 15,
              return_5d_percentile: 0.81,
              has_sufficient_history: true,
              is_price_above_ma120: true,
              is_ma60_above_ma120: true,
              is_recent_overheated: false,
              momentum_rank: 12,
              momentum_percentile: 0.92,
              is_momentum_eligible: true,
              factor_payload: {
                insufficient_history_reason: null,
              },
              captured_at: `${marketDate}T16:20:00+09:00`,
            },
          ],
        },
      });
    });

    await page.route("**/api/trading/eod/low-risk-factors?**", async (route) => {
      await route.fulfill({
        status: 503,
        json: {
          detail: "temporary low-risk outage",
        },
      });
    });

    await page.route("**/api/trading/eod/beta-factors?**", async (route) => {
      await route.fulfill({
        json: {
          market_date: marketDate,
          feature_version: "beta_v1",
          summary: {
            entries: 1,
            requested_symbol: "005930",
            matched_symbols: ["005930"],
            missing_symbols: [],
            eligible_count: 1,
            watchlist_count: 0,
            insufficient_history_count: 0,
          },
          item: {
            symbol: "005930",
            market_date: marketDate,
            benchmark_id: "KOSPI_EQW",
            benchmark_market: "KOSPI",
            beta_60d: 0.78,
            beta_120d: 0.82,
            beta_60d_rank: 22,
            beta_120d_rank: 37,
            beta_60d_percentile: 0.84,
            beta_120d_percentile: 0.76,
            low_beta_score: 0.8,
            low_beta_classification: "eligible",
            is_low_beta_eligible: true,
            history_days_available: 180,
            factor_payload: {},
            captured_at: `${marketDate}T16:20:00+09:00`,
          },
        },
      });
    });

    await page.route("**/api/trading/eod/value-factors?**", async (route) => {
      await route.fulfill({
        json: {
          market_date: marketDate,
          feature_version: "value_factor_v1",
          summary: {
            entries: 1,
            requested_symbol: "005930",
            matched_symbols: ["005930"],
            missing_symbols: [],
            scored_count: 1,
            invalid_per_count: 0,
            missing_metric_count: 0,
          },
          item: {
            symbol: "005930",
            market_date: marketDate,
            per: 11.8,
            pbr: 1.24,
            dividend_yield: 0.021,
            per_status: "available",
            pbr_status: "available",
            dividend_yield_status: "available",
            fcf_yield_status: "available",
            ev_to_ebitda_status: "available",
            per_rank: 120,
            pbr_rank: 96,
            dividend_yield_rank: 48,
            per_percentile: 0.67,
            pbr_percentile: 0.74,
            dividend_yield_percentile: 0.88,
            value_score: 0.763,
            value_rank: 54,
            value_percentile: 0.86,
            value_status: "scored",
            unified_value_score: 0.812,
            unified_value_rank: 34,
            unified_value_percentile: 0.9,
            unified_value_status: "scored",
            factor_payload: {
              metric_statuses: {
                per: "available",
                pbr: "available",
                dividend_yield: "available",
                fcf_yield: "available",
                ev_to_ebitda: "available",
              },
            },
            captured_at: `${marketDate}T16:20:00+09:00`,
          },
        },
      });
    });

    await page.route("**/api/trading/eod/advanced-value-factors?**", async (route) => {
      await route.fulfill({
        json: {
          market_date: marketDate,
          feature_version: "advanced_value_v1",
          summary: {
            entries: 0,
            requested_symbol: "005930",
            matched_symbols: [],
            missing_symbols: ["005930"],
            eligible_count: 0,
            watchlist_count: 0,
            ineligible_count: 0,
            insufficient_components_count: 0,
          },
          item: null,
          items: [],
        },
      });
    });

    await page.goto(
      `/dashboard/symbol/005930?name=Samsung%20Electronics&market=KOSPI&standardCode=KR7005930003&marketDate=${marketDate}`,
    );

    const factorSection = page.locator("#factor-snapshot");
    await expect(factorSection.getByRole("heading", { name: /Explainable factor snapshot/i })).toBeVisible();
    await expect(factorSection.getByText(/Future composite summary/i)).toBeVisible();
    await expect(factorSection.getByText("3 / 5 families ready")).toBeVisible();
    await expect(factorSection.getByText("partial failures")).toBeVisible();
    await expect(
      factorSection.locator("article").filter({ hasText: "partial failures" }).getByText("1", { exact: true }),
    ).toBeVisible();

    const momentumCard = factorSection.locator("article").filter({
      has: page.getByText("Momentum", { exact: true }),
    });
    await expect(momentumCard).toContainText("Eligible");
    await expect(momentumCard).toContainText("12-1 momentum");
    await expect(momentumCard).toContainText("22.1%");

    const lowRiskCard = factorSection.locator("article").filter({
      has: page.getByText("Low risk", { exact: true }),
    });
    await expect(lowRiskCard).toContainText("Unavailable");
    await expect(lowRiskCard).toContainText("HTTP 503");

    const betaCard = factorSection.locator("article").filter({
      has: page.getByText("Beta", { exact: true }),
    });
    await expect(betaCard).toContainText("KOSPI_EQW");
    await expect(betaCard).toContainText("Eligible");

    const valueCard = factorSection.locator("article").filter({
      has: page.getByText("Unified value", { exact: true }),
    });
    await expect(valueCard).toContainText("Scored");
    await expect(valueCard).toContainText("Unified value score");
    await expect(valueCard).toContainText("Overall status");
    await expect(valueCard).toContainText("81.2%");
    await expect(valueCard).toContainText("PER: Available");
    await expect(valueCard).toContainText("EV / EBITDA: Available");

    const advancedValueCard = factorSection.locator("article").filter({
      has: page.getByText("Advanced value components", { exact: true }),
    });
    await expect(advancedValueCard).toContainText("No row");
    await expect(advancedValueCard).toContainText("No stored factor row returned for this symbol-date.");
  });

  test("hero star reflects and toggles tracked-symbol membership", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });

    let trackedSymbols = ["005930", "000660"];
    const postedSymbols: string[][] = [];

    await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
      if (route.request().method() === "POST") {
        const payload = route.request().postDataJSON() as { symbols?: string[] };
        trackedSymbols = Array.isArray(payload.symbols) ? payload.symbols : [];
        postedSymbols.push([...trackedSymbols]);
      }

      await route.fulfill({
        json: {
          tracked_symbols: trackedSymbols,
          count: trackedSymbols.length,
          last_updated_at: "2026-04-18T09:00:00+09:00",
        },
      });
    });

    await page.goto(`/dashboard/symbol/005930?${symbolSeed}`);

    const removeButton = page.getByRole("button", { name: /Remove 005930 from tracked symbols/i });
    await expect(removeButton).toBeVisible();
    await expect(removeButton).toHaveAttribute("aria-pressed", "true");
    await expect(removeButton).toContainText("★");

    await removeButton.click();

    const addButton = page.getByRole("button", { name: /Add 005930 to tracked symbols/i });
    await expect(addButton).toHaveAttribute("aria-pressed", "false");
    await expect(addButton).toContainText("☆");
    expect(postedSymbols).toEqual([["000660"]]);

    await addButton.click();

    await expect(removeButton).toHaveAttribute("aria-pressed", "true");
    await expect(removeButton).toContainText("★");
    expect(postedSymbols).toEqual([["000660"], ["005930", "000660"]]);
  });

  test("daily price-bar fallback copy uses the latest update date", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const marketDate = "2026-04-17";

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
          server_time: `${marketDate}T16:00:00+09:00`,
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

    await page.goto(`/dashboard/symbol/005930/system-freshness?${symbolSeed}`);

    const topbar = page.locator("header.topbar");
    await expect(topbar).toContainText("Market Closed");
    await expect(topbar).not.toContainText("Stable Mode");
    await expect(page.getByText(`최신 업데이트 : ${marketDate}`).first()).toBeVisible();
    await expect(page.getByText(`Daily price-bar fallback for ${marketDate}.`)).toHaveCount(0);
  });

  test("detail tabs update in place without resetting scroll or adding a back-stack entry", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/dashboard");
    await expect(page.getByText(/Trading Dashboard/i)).toBeVisible();

    await page.goto(`/dashboard/symbol/005930?${symbolSeed}`);
    const detailUrl = page.url();
    const actionTab = page.getByRole("button", { name: /^Action$/i });
    await page.evaluate(() => window.scrollTo(0, 420));
    await actionTab.scrollIntoViewIfNeeded();
    const beforeScroll = await page.evaluate(() => window.scrollY);
    expect(beforeScroll).toBeGreaterThan(0);

    await actionTab.click();

    await expect(page).toHaveURL(detailUrl);
    await expect(page.getByText(/Action Summary Detail/i)).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

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
