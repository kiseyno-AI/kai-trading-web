import { expect, type Page, test } from "@playwright/test";

const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const appBasePath =
  configuredBasePath && configuredBasePath !== "/"
    ? `${configuredBasePath.startsWith("/") ? "" : "/"}${configuredBasePath}`.replace(/\/+$/, "")
    : "";
const withBasePath = (pathname: string) => `${appBasePath}${pathname}`;

async function mockTradingApiForToolbar(page: Page) {
  await page.route("**/api/trading/**", async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    const now = "2026-04-10T16:00:00+09:00";
    const marketDate = "2026-04-10";

    if (pathname.endsWith("/api/trading/market/status")) {
      await route.fulfill({
        json: {
          state: "CLOSED",
          is_open: false,
          server_time: now,
        },
      });
      return;
    }

    if (pathname.endsWith("/api/trading/quotes/005930")) {
      await route.fulfill({
        json: {
          symbol: "005930",
          company_name: "삼성전자",
          price: 71500,
          change: -500,
          change_pct: -0.7,
          volume: 1250000,
          turnover: 89375000000,
          market_state: "CLOSED",
          source: "daily_price_bar",
          fallback: false,
          is_live: false,
          available: true,
          trade_date: marketDate,
        },
      });
      return;
    }

    if (pathname.endsWith("/api/trading/quotes/tracked")) {
      await route.fulfill({
        json: {
          market_state: "CLOSED",
          as_of: now,
          items: [
            {
              symbol: "005930",
              company_name: "삼성전자",
              price: 71500,
              change: -500,
              change_pct: -0.7,
              volume: 1250000,
              turnover: 89375000000,
              market_state: "CLOSED",
              source: "daily_price_bar",
              fallback: false,
              is_live: false,
              available: true,
              trade_date: marketDate,
            },
          ],
        },
      });
      return;
    }

    if (pathname.endsWith("/api/trading/scanner/tracked-symbols")) {
      await route.fulfill({
        json: {
          tracked_symbols: [],
          count: 0,
          last_updated_at: now,
        },
      });
      return;
    }

    if (pathname.endsWith("/api/trading/scanner/realtime-trending")) {
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
      return;
    }

    if (pathname.endsWith("/api/trading/symbols/search")) {
      const query = url.searchParams.get("q") ?? "";
      await route.fulfill({
        json: {
          query,
          count: query === "005930" || query === "삼성" ? 1 : 0,
          items:
            query === "005930" || query === "삼성"
              ? [
                  {
                    symbol: "005930",
                    standard_code: "KR7005930003",
                    name_ko: "삼성전자",
                    market: "KOSPI",
                  },
                ]
              : [],
        },
      });
      return;
    }

    if (pathname.endsWith("/api/trading/eod/freshness")) {
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
            symbols_total: 1,
            symbols_succeeded: 1,
            technical_market_date: marketDate,
            action_market_date: marketDate,
          },
          technical: {
            success: true,
            latest_date: marketDate,
          },
        },
      });
      return;
    }

    if (pathname.endsWith("/api/trading/symbols/005930/price-bars")) {
      await route.fulfill({
        json: {
          symbol: "005930",
          market_date: marketDate,
          items: [
            {
              trade_date: marketDate,
              open_price: 71000,
              high_price: 72000,
              low_price: 70500,
              close_price: 71500,
              volume: 1250000,
              turnover: 89375000000,
            },
          ],
        },
      });
      return;
    }

    if (pathname.endsWith("/api/trading/agent-context/symbol-day")) {
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
                name_ko: "삼성전자",
                market: "KOSPI",
                instrument_type: "stock",
                standard_code: "KR7005930003",
                source: "test",
                is_active: true,
                last_refreshed_at: null,
                dart: {
                  corp_code: "00126380",
                  corp_name: "삼성전자",
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
      return;
    }

    await route.fulfill({ json: { items: [], count: 0, summary: { entries: 0 } } });
  });
}

async function expectToolbarTitleToFit(page: Page, expectedTitle: string) {
  const toolbar = page.locator("[data-dashboard-toolbar]").first();
  const title = toolbar.locator("[data-dashboard-toolbar-title]").first();

  await expect(toolbar).toBeVisible();
  await expect(title).toHaveText(expectedTitle);

  const metrics = await toolbar.evaluate((element) => {
    const titleElement = element.querySelector<HTMLElement>("[data-dashboard-toolbar-title]");
    const toolbarRect = element.getBoundingClientRect();
    const pageScrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const viewportWidth = window.innerWidth;

    if (!titleElement) {
      return {
        clipped: true,
        escapedToolbar: true,
        pageScrollWidth,
        text: "",
        titleClientWidth: 0,
        titleScrollWidth: 0,
        viewportWidth,
      };
    }

    const titleRect = titleElement.getBoundingClientRect();
    const titleStyle = window.getComputedStyle(titleElement);
    const clipped = titleElement.scrollWidth > titleElement.clientWidth + 1;
    const escapedToolbar =
      titleRect.left < toolbarRect.left - 0.75 ||
      titleRect.right > toolbarRect.right + 0.75 ||
      titleRect.top < toolbarRect.top - 0.75 ||
      titleRect.bottom > toolbarRect.bottom + 0.75;

    return {
      clipped,
      escapedToolbar,
      pageScrollWidth,
      text: titleElement.innerText.trim(),
      titleClientWidth: titleElement.clientWidth,
      titleScrollWidth: titleElement.scrollWidth,
      viewportWidth,
      whiteSpace: titleStyle.whiteSpace,
    };
  });

  expect(metrics).toMatchObject({
    clipped: false,
    escapedToolbar: false,
    text: expectedTitle,
    whiteSpace: "nowrap",
  });
  expect(metrics.titleClientWidth).toBeGreaterThanOrEqual(metrics.titleScrollWidth);
  expect(metrics.pageScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

test.describe("mobile toolbar route title fit", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockTradingApiForToolbar(page);
  });

  test("keeps Dashboard, Search, and Samsung symbol titles recognizable at 390px", async ({ page }) => {
    await page.goto(withBasePath("/dashboard"));
    await expectToolbarTitleToFit(page, "Trading Command Surface");

    await page.getByRole("button", { name: "Korean" }).click();
    await expectToolbarTitleToFit(page, "트레이딩 커맨드 서피스");

    await page.evaluate(() => {
      window.sessionStorage.removeItem("kai.trading-api.cache.v1");
    });

    await page.goto(withBasePath("/search"));
    await expectToolbarTitleToFit(page, "통합 검색");

    await page.getByRole("button", { name: "영어" }).click();
    await expectToolbarTitleToFit(page, "Universal Search");

    await page.goto(
      withBasePath(
        `/dashboard/symbol/005930?name=${encodeURIComponent("삼성전자")}&market=KOSPI&standardCode=KR7005930003&marketDate=2026-04-10`,
      ),
    );
    await expectToolbarTitleToFit(page, "삼성전자");
  });
});
