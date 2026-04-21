import { expect, test } from "@playwright/test";

const symbolSeed =
  "name=Samsung%20Electronics&market=KOSPI&standardCode=KR7005930003&marketDate=2026-04-10";

test.describe("symbol detail desktop", () => {
  test("full-page loading screen covers symbol workspace transitions", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const now = "2026-04-18T09:10:00+09:00";
    const marketDate = "2026-04-18";

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
      await new Promise((resolve) => setTimeout(resolve, 700));
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

    await resultsRow.getByRole("link", { name: "Open" }).click();

    const loader = page.getByRole("status", { name: /Loading symbol workspace/i });
    await expect(loader).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/symbol\/005930\?/);
    await expect(page.getByRole("heading", { name: "Samsung Electronics" })).toBeVisible();
    await expect(loader).toHaveCount(0);
  });

  test("overview shows only Insights chart and freshness sections", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/dashboard/symbol/005930?${symbolSeed}`);

    await expect(page.getByRole("navigation", { name: /Primary desktop/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Swipe-aware candlestick chart/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Layer-specific freshness registry/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Deterministic action layer/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Stored snapshot metrics/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Stored DART filing history/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Recent filing coverage/i })).toHaveCount(0);
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
    const actionTab = page.getByRole("link", { name: /^Action$/i });
    await page.evaluate(() => window.scrollTo(0, 420));
    await actionTab.scrollIntoViewIfNeeded();
    const beforeScroll = await page.evaluate(() => window.scrollY);
    expect(beforeScroll).toBeGreaterThan(0);

    await actionTab.click();

    await expect(page).toHaveURL(/\/dashboard\/symbol\/005930\/action-summary\?/);
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
