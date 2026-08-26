import { chromiumIPhone13 } from "./devices";
import { expect, test, type Page } from "@playwright/test";

async function mockPiotroskiPassList(page: Page, marketDate = "2026-05-08") {
  await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const requestedSymbol = requestUrl.searchParams.get("symbol");
    const item = {
      symbol: "004150",
      market_date: marketDate,
      passed_filter: true,
      piotroski_score: 9,
      passes_piotroski_score: true,
      captured_at: `${marketDate}T16:10:00+09:00`,
    };

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requested_market_date: marketDate,
        resolved_market_date: marketDate,
        is_latest_fallback: false,
        market_date: marketDate,
        summary: {
          entries: 2_811,
          requested_symbol: requestedSymbol,
          matched_symbols: requestedSymbol ? [requestedSymbol] : ["004150"],
          missing_symbols: [],
          passed_count: 107,
          not_passed_count: 2_704,
        },
        item: requestedSymbol === "004150" ? item : null,
        items: requestedSymbol ? [item] : [item],
      }),
    });
  });
}

async function mockHansolSymbolDetail(page: Page, marketDate = "2026-05-08") {
  await page.route("**/api/trading/quotes/004150", async (route) => {
    await route.fulfill({
      json: {
        symbol: "004150",
        company_name: "한솔홀딩스",
        price: 3050,
        change: 45,
        change_pct: 1.5,
        volume: 120000,
        turnover: 366000000,
        market_state: "CLOSED",
        source: "test",
        fallback: false,
        is_live: false,
        available: true,
        cached_at: `${marketDate}T16:00:00+09:00`,
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
  await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
    await route.fulfill({
      json: {
        tracked_symbols: [],
        count: 0,
        last_updated_at: null,
      },
    });
  });
  await page.route("**/api/trading/symbols/search?**", async (route) => {
    await route.fulfill({
      json: {
        query: "004150",
        count: 1,
        items: [
          {
            symbol: "004150",
            standard_code: "KR7004150009",
            name_ko: "한솔홀딩스",
            market: "KOSPI",
          },
        ],
      },
    });
  });
  await page.route("**/api/trading/symbols/004150/price-bars?**", async (route) => {
    await route.fulfill({
      json: {
        symbol: "004150",
        count: 1,
        start_date: marketDate,
        end_date: marketDate,
        requested_start_date: marketDate,
        requested_end_date: marketDate,
        items: [
          {
            trade_date: marketDate,
            open_price: 3000,
            high_price: 3100,
            low_price: 2990,
            close_price: 3050,
            volume: 120000,
            turnover: 366000000,
            source: "test",
            captured_at: `${marketDate}T16:00:00+09:00`,
          },
        ],
      },
    });
  });
  await page.route("**/api/trading/agent-context/symbol-day?**", async (route) => {
    await route.fulfill({
      json: {
        request: {
          market_date: marketDate,
          symbols: ["004150"],
        },
        items: [
          {
            symbol: "004150",
            company: {
              name_ko: "한솔홀딩스",
            },
            action_summary: null,
            technical_snapshot: null,
            fundamentals: {
              latest_snapshot: null,
            },
            recent_disclosures: {
              items: [],
            },
          },
        ],
      },
    });
  });
}

test.describe("Piotroski pass-list route", () => {
  test("maps a latest-date 504 to a localized terminal state and retries the request", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("trading-web.locale", JSON.stringify("ko"));
    });

    let freshnessRequestCount = 0;
    await page.route("**/api/trading/eod/freshness", async (route) => {
      freshnessRequestCount += 1;
      if (freshnessRequestCount === 1) {
        await route.fulfill({
          status: 504,
          contentType: "application/json",
          body: JSON.stringify({ detail: "HTTP 504: Timed out while loading /eod/freshness from trading-core." }),
        });
        return;
      }

      await route.fulfill({
        json: {
          today: { trade_date: "2026-05-08" },
          latest: null,
        },
      });
    });
    await mockPiotroskiPassList(page);

    await page.goto("/dashboard/piotroski-filter");

    const errorState = page.getByTestId("piotroski-error-state");
    await expect(errorState).toContainText(
      "피오트로스키 결과 데이터를 불러오지 못했습니다. 최신 데이터 처리가 지연되었을 수 있습니다.",
    );
    await expect(page.getByText("데이터 사용 불가", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/기준일\s*확인 불가/)).toBeVisible();
    await expect(page.getByText(/통과 종목\s*확인 불가/)).toBeVisible();
    await expect(page.getByText("최신 피오트로스키 기준일을 확인 중입니다.")).toHaveCount(0);
    await expect(page.getByText("기준일 대기 중", { exact: true })).toHaveCount(0);
    await expect(page.getByText("대기 중", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("main").getByText("HTTP 504")).toHaveCount(0);
    await expect(page.getByRole("main").getByText("/eod/freshness")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "대시보드로 돌아가기" })).toBeVisible();

    await page.getByRole("button", { name: "다시 시도" }).click();

    await expect(page.getByText(/확인된 종목을 기준일 기준으로 점수 내림차순 정렬해 보여줍니다. 2026-05-08/)).toBeVisible();
    await expect(page.getByText(/통과 종목\s*107/)).toBeVisible();
    await expect(errorState).toHaveCount(0);
    expect(freshnessRequestCount).toBe(2);
  });

  test("maps a pass-list 504 to unavailable values instead of loading placeholders", async ({ page }) => {
    await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
      await route.fulfill({
        status: 504,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "HTTP 504: Timed out while loading /eod/piotroski-filter-results from trading-core.",
        }),
      });
    });

    await page.goto("/dashboard/piotroski-filter?marketDate=2026-05-08");

    await expect(page.getByTestId("piotroski-error-state")).toContainText(
      "The Piotroski dataset could not be loaded. The latest results may be delayed.",
    );
    await expect(page.getByText("Dataset unavailable", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Passed symbols\s*Unavailable/)).toBeVisible();
    await expect(page.getByText("Loading Piotroski pass list...")).toHaveCount(0);
    await expect(page.getByRole("main").getByText("HTTP 504")).toHaveCount(0);
    await expect(page.getByRole("main").getByText("/eod/piotroski-filter-results")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to dashboard" })).toBeVisible();
  });

  test("renders available Piotroski rows while quote enrichment is still pending", async ({ page }) => {
    const quoteRequests: string[] = [];

    await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          requested_market_date: "2026-04-29",
          resolved_market_date: "2026-04-29",
          is_latest_fallback: false,
          market_date: "2026-04-29",
          summary: {
            entries: 2_811,
            requested_symbol: null,
            matched_symbols: ["000660", "005930"],
            missing_symbols: [],
            passed_count: 106,
            not_passed_count: 2_705,
          },
          items: [
            {
              symbol: "005930",
              market_date: "2026-04-29",
              passed_filter: true,
              piotroski_score: 8,
              passes_piotroski_score: true,
              captured_at: "2026-04-29T16:10:00+09:00",
            },
            {
              symbol: "000660",
              market_date: "2026-04-29",
              passed_filter: true,
              piotroski_score: 9,
              passes_piotroski_score: true,
              captured_at: "2026-04-29T16:10:00+09:00",
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/quotes/005930", async (route) => {
      quoteRequests.push(route.request().url());
      await new Promise(() => undefined);
    });
    await page.route("**/api/trading/quotes/000660", async (route) => {
      quoteRequests.push(route.request().url());
      await new Promise(() => undefined);
    });

    await page.goto("/dashboard/piotroski-filter?marketDate=2026-04-29");

    await expect(page.getByRole("heading", { name: /Piotroski filter pass list/i })).toBeVisible();
    await expect(page.getByText(/Showing passed symbols for 2026-04-29/)).toBeVisible();
    await expect(page.getByText("Loading Piotroski pass list...")).toHaveCount(0);
    await expect(page.getByText(/Passed symbols\s*106/)).toBeVisible();

    const rows = page.locator('a[href*="/dashboard/symbol/"]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("000660");
    await expect(rows.nth(0)).toHaveAttribute("href", /marketDate=2026-04-29.*navContext=piotroski/);
    await expect(rows.nth(0)).toContainText(/Close\s*Unavailable/);
    await expect(rows.nth(0)).toContainText("9");
    await expect(rows.nth(1)).toContainText("005930");
    await expect(rows.nth(1)).toHaveAttribute("href", /marketDate=2026-04-29.*navContext=piotroski/);
    await expect(rows.nth(1)).toContainText(/Close\s*Unavailable/);
    await expect(rows.nth(1)).toContainText("8");
    await expect.poll(() => quoteRequests.length).toBeGreaterThan(0);
  });

  test("keeps Piotroski pass-list context when a row opens symbol detail", async ({ page }) => {
    await mockPiotroskiPassList(page);
    await mockHansolSymbolDetail(page);

    await page.goto("/dashboard/piotroski-filter?marketDate=2026-05-08");

    const symbolRow = page.getByRole("link", { name: /한솔홀딩스.*004150/ });
    await expect(symbolRow).toHaveAttribute(
      "href",
      /\/dashboard\/symbol\/004150\?.*marketDate=2026-05-08.*navContext=piotroski/,
    );
    await symbolRow.click();

    await expect(page).toHaveURL(/\/dashboard\/symbol\/004150\?.*marketDate=2026-05-08.*navContext=piotroski/);
    const piotroskiReturnLink = page.getByRole("link", { name: /Back to Piotroski list/i });
    await expect(piotroskiReturnLink).toHaveAttribute(
      "href",
      /\/dashboard\/piotroski-filter\?marketDate=2026-05-08$/,
    );
    await expect(page.getByRole("link", { name: /Back to dashboard/i })).toHaveCount(0);

    await piotroskiReturnLink.click();
    await expect(page).toHaveURL(/\/dashboard\/piotroski-filter\?marketDate=2026-05-08$/);
    await expect(page.getByRole("heading", { name: /Piotroski filter pass list/i })).toBeVisible();
    await expect(page.getByText(/Showing passed symbols for 2026-05-08/)).toBeVisible();
  });
});

test.describe("Piotroski pass-list route on mobile", () => {
  test.use(chromiumIPhone13);

  test("maps quote unavailable reason tokens to compact change copy", async ({ page }) => {
    await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          requested_market_date: "2026-04-29",
          resolved_market_date: "2026-04-29",
          is_latest_fallback: false,
          market_date: "2026-04-29",
          summary: {
            entries: 2_811,
            requested_symbol: null,
            matched_symbols: ["000660"],
            missing_symbols: [],
            passed_count: 1,
            not_passed_count: 0,
          },
          items: [
            {
              symbol: "000660",
              market_date: "2026-04-29",
              passed_filter: true,
              piotroski_score: 9,
              passes_piotroski_score: true,
              captured_at: "2026-04-29T16:10:00+09:00",
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/quotes/000660", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          symbol: "000660",
          price: null,
          change: null,
          change_pct: null,
          volume: null,
          turnover: null,
          market_state: "closed",
          source: "api",
          fallback: false,
          is_live: false,
          available: false,
          unavailable_reason: "no_live_quote_or_fresh_fallback",
        }),
      });
    });

    await page.goto("/dashboard/piotroski-filter?marketDate=2026-04-29");

    const row = page.locator('a[href*="/dashboard/symbol/000660"]');
    await expect(row).toContainText("변동 미제공");
    await expect(row).not.toContainText("no_live_quote_or_fresh_fallback");
  });
});
