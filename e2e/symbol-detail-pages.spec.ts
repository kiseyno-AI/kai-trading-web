import { expect, test, type Page } from "@playwright/test";

import { chromiumIPhone13 } from "./devices";

test.use(chromiumIPhone13);

const symbolSeed =
  "name=Samsung%20Electronics&market=KOSPI&standardCode=KR7005930003&marketDate=2026-04-10";

const detailPages = [
  {
    path: "action-summary",
    eyebrow: /Action Summary Detail/i,
    heading: /Deterministic action layer/i,
  },
  {
    path: "technical-analysis",
    eyebrow: /Technical Analysis Detail/i,
    heading: /Stored technical snapshot|Stored snapshot metrics/i,
  },
  {
    path: "fundamentals-history",
    eyebrow: /Fundamentals History Detail/i,
    heading: /DART fundamentals history|Stored DART filing history/i,
  },
  {
    path: "disclosure-coverage",
    eyebrow: /Disclosure & Coverage Detail/i,
    heading: /Recent DART disclosure coverage|Recent filing coverage/i,
  },
  {
    path: "system-freshness",
    eyebrow: /System Freshness Detail/i,
    heading: /Layer-specific freshness registry/i,
  },
];

async function mockSystemFreshnessApis(page: Page) {
  const marketDate = "2026-04-10";

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
      await expect(page.getByRole("link", { name: /Insights/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Freshness/i })).toBeVisible();
    }
  });

  test("system freshness card keeps status text readable and contained on mobile", async ({ page }) => {
    await mockSystemFreshnessApis(page);

    await page.goto(`/dashboard/symbol/005930/system-freshness?${symbolSeed}`);

    const freshnessCard = page.locator("#freshness");
    await expect(freshnessCard.getByRole("heading", { name: /Layer-specific freshness registry/i })).toBeVisible();

    const runningStatus = freshnessCard.locator(".pill.info", { hasText: "Running" });
    await expect(runningStatus).toBeVisible();
    await expect(runningStatus).toHaveCSS("color", "rgb(207, 228, 255)");

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

  test("disclosure detail requests the same row cap it can render", async ({ page }) => {
    const aggregateRequest = page.waitForRequest((request) => {
      const url = request.url();
      return url.includes("/api/trading/agent-context/symbol-day") && url.includes("disclosures_limit=8");
    });

    await page.goto(`/dashboard/symbol/005930/disclosure-coverage?${symbolSeed}`);
    await expect(page.getByText(/Disclosure & Coverage Detail/i)).toBeVisible();
    await aggregateRequest;
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
