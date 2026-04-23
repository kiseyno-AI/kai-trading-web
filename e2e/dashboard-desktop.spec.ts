import { expect, test } from "@playwright/test";

import { RELEASE_VERSION_LABEL } from "@/lib/release-version";

test.describe("dashboard desktop", () => {
  test("dashboard labels match currently wired core data", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText(/Trading Dashboard/i)).toBeVisible();
    const desktopNav = page.getByRole("navigation", { name: /Primary desktop/i });
    await expect(desktopNav).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: /Market Status/i })).toHaveCount(0);
    await expect(desktopNav.getByRole("link", { name: /My Symbols/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Operational Integrity/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Today's ledger recommendations/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Daily Data Fetch/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Filtering/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Ledger coverage notes/i })).toHaveCount(0);

    await expect(page.getByText(/Market Freshness Registry/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Open the full My Symbols screen/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Open the full Piotroski filter pass list/i })).toBeVisible();
    await expect(page.locator('[aria-label="Release version"]:visible')).toContainText(RELEASE_VERSION_LABEL);

    await expect(page.getByRole("heading", { name: /Layer sync events/i })).toHaveCount(0);
    await expect(page.getByText(/Real-Time Audit Feed/i)).toHaveCount(0);
    await expect(page.getByText(/Readiness and breadth/i)).toHaveCount(0);
    await expect(page.getByText(/Top movers/i)).toHaveCount(0);
    await expect(page.getByText(/Connection and timing/i)).toHaveCount(0);
    await expect(page.getByText(/Live Connection/i)).toHaveCount(0);
  });

  test("dashboard surfaces running EOD pipeline progress inside the matching stage cards", async ({ page }) => {
    const now = "2026-04-15T09:10:00+09:00";

    await page.route("**/api/trading/market/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          state: "OPEN",
          is_open: true,
          is_trading_day: true,
          server_time: now,
        }),
      });
    });
    await page.route("**/api/trading/quotes/tracked", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_state: "OPEN",
          as_of: now,
          items: [
            {
              symbol: "005930",
              company_name: "Samsung Electronics",
              price: 71500,
              change: 1900,
              change_pct: 2.73,
              volume: 120000,
              turnover: 8580000000,
              as_of: now,
              market_state: "OPEN",
              source: "daily_price_bar",
              fallback: true,
              is_live: false,
              available: true,
              trade_date: "2026-04-15",
              fallback_reason: "daily_price_bar_current_trade_date",
              unavailable_reason: null,
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-15",
            price: {
              status: "ready",
              symbols_total: 3200,
              symbols_succeeded: 3200,
              symbols_failed: 0,
            },
            technical_analysis: {
              status: "ready",
              symbols_total: 3200,
              symbols_succeeded: 3200,
              symbols_failed: 0,
            },
            action_summary: {
              status: "ready",
              symbols_total: 3200,
              symbols_succeeded: 3200,
              symbols_failed: 0,
            },
          },
          latest: {
            price_trade_date: "2026-04-15",
            technical_market_date: "2026-04-15",
            action_market_date: "2026-04-15",
          },
          technical: {
            success: true,
            latest_date: "2026-04-15",
          },
        }),
      });
    });
    await page.route("**/api/trading/eod/pipeline/status?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-15",
          status: "running",
          stage_order: [
            "price_collection",
            "technical_snapshots",
            "action_summaries",
            "trending_ranks",
            "signal_features",
            "fundamentals_daily_refresh",
          ],
          stages: {
            price_collection: {
              status: "completed",
              processed: 3200,
              total: 3200,
              failed: 0,
            },
            technical_snapshots: {
              status: "completed",
              processed: 3200,
              total: 3200,
              failed: 0,
            },
            action_summaries: {
              status: "running",
              processed: 1180,
              total: 3200,
              failed: 12,
              current_step: "build_symbol_summary",
              current_activity: "Rendering EOD summaries",
              current_symbol: "005930",
            },
            trending_ranks: {
              status: "pending",
              processed: 0,
              total: 3200,
              failed: 0,
            },
            signal_features: {
              status: "pending",
              processed: 0,
              total: 3200,
              failed: 0,
            },
            fundamentals_daily_refresh: {
              status: "running",
              processed: 42,
              total: 60,
              failed: 1,
              current_step: "refresh_company_metrics",
              current_activity: "Refreshing DART fundamentals",
              current_symbol: "000660",
            },
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          runs: [],
          latest_run: null,
        }),
      });
    });
    await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: "2026-04-15",
            symbols: null,
            expected_agents: [],
          },
          summary: {
            run_status: "completed",
            is_live: false,
            latest_feedback_at: now,
            seconds_since_last_feedback: 120,
            stalled_threshold_seconds: 300,
            total_symbols: 3200,
            processed_symbols: 3200,
            completed_symbols: 3200,
            in_progress_symbols: 0,
            pending_symbols: 0,
            progress_ratio: 1,
            progress_percent: 100,
            failed_items: 0,
            completed_feedback_count: 0,
            expected_feedback_count: 0,
          },
        }),
      });
    });

    await page.goto("/dashboard");

    await expect(page.getByRole("list", { name: /EOD pipeline stages/i })).toHaveCount(0);
    await expect(page.getByText(/Pipeline activity/i)).toHaveCount(0);
    await expect(page.getByText(/Current step/i)).toHaveCount(0);
    await expect(page.getByText(/Current activity/i)).toHaveCount(0);
    await expect(page.locator('[aria-label="Action Summary freshness"]')).toContainText(/Build Symbol Summary/i);
    await expect(page.locator('[aria-label="Action Summary freshness"]')).toContainText(/1,180 \/ 3,200/i);
    await expect(page.locator('[aria-label="Action Summary freshness"]')).toContainText(/Failed 12/i);
    await expect(page.locator('[aria-label="Fundamentals freshness"]')).toContainText(/Refresh Company Metrics/i);
  });

  test("dashboard quote surfaces use symbol metadata when quote payload names fall back to the symbol", async ({ page }) => {
    const now = "2026-04-15T09:10:00+09:00";
    const searchRequests: string[] = [];

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
    await page.route("**/api/trading/quotes/tracked", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_state: "OPEN",
          as_of: now,
          items: [
            {
              symbol: "123456",
              company_name: "123456",
              price: 42100,
              change: 300,
              change_pct: 0.72,
              volume: 1200,
              turnover: 50520000,
              as_of: now,
              market_state: "OPEN",
              source: "daily_price_bar",
              fallback: true,
              is_live: false,
              available: true,
              trade_date: "2026-04-15",
              fallback_reason: "daily_price_bar_current_trade_date",
              unavailable_reason: null,
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/quotes/123456", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          symbol: "123456",
          company_name: "123456",
          price: 43100,
          change: 530,
          change_pct: 1.25,
          volume: 2400,
          turnover: 103440000,
          market_state: "OPEN",
          source: "daily_price_bar",
          fallback: true,
          is_live: false,
          available: true,
          cached_at: now,
          trade_date: "2026-04-15",
          fallback_reason: "daily_price_bar_current_trade_date",
          unavailable_reason: null,
        }),
      });
    });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-15",
            eod_status: "completed",
            symbols_total: 1,
            symbols_succeeded: 1,
            symbols_failed: 0,
          },
          latest: {
            price_trade_date: "2026-04-15",
            technical_market_date: "2026-04-15",
            action_market_date: "2026-04-15",
          },
          technical: {
            success: true,
            latest_date: "2026-04-15",
          },
        }),
      });
    });
    await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-15",
          summary: {
            entries: 2,
            requested_symbol: null,
            matched_symbols: ["123456", "654321"],
            missing_symbols: [],
            passed_count: 1,
            not_passed_count: 1,
          },
          items: [
            {
              symbol: "123456",
              market_date: "2026-04-15",
              passed_filter: true,
              piotroski_score: 8,
              passes_piotroski_score: true,
              captured_at: now,
            },
            {
              symbol: "654321",
              market_date: "2026-04-15",
              passed_filter: false,
              piotroski_score: 5,
              passes_piotroski_score: false,
              captured_at: now,
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get("q") ?? "";
      searchRequests.push(query);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          query,
          count: query === "123456" ? 1 : 0,
          items:
            query === "123456"
              ? [
                  {
                    symbol: "123456",
                    standard_code: "KR7123456000",
                    name_ko: "Acme Precision",
                    market: "KOSPI",
                  },
                ]
              : [],
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          runs: [],
          latest_run: null,
        }),
      });
    });
    await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: "2026-04-15",
            symbols: null,
            expected_agents: [],
          },
          summary: {
            run_status: "completed",
            is_live: false,
            latest_feedback_at: now,
            seconds_since_last_feedback: 120,
            stalled_threshold_seconds: 300,
            total_symbols: 1,
            processed_symbols: 1,
            completed_symbols: 1,
            in_progress_symbols: 0,
            pending_symbols: 0,
            progress_ratio: 1,
            progress_percent: 100,
            failed_items: 0,
            completed_feedback_count: 0,
            expected_feedback_count: 0,
          },
        }),
      });
    });

    await page.goto("/dashboard");

    const symbolCard = page
      .locator("a")
      .filter({ hasText: "123456" })
      .filter({ hasText: "Acme Precision" })
      .first();
    await expect(symbolCard).toBeVisible();
    await expect(symbolCard.getByText("123456", { exact: true })).toHaveCount(1);

    const filteringCard = page.locator("#dashboard-freshness article").filter({ hasText: "Filtering" });
    await expect(filteringCard).toContainText("Completed");
    await expect(filteringCard).toContainText(/Checked\s*2/);
    await expect(filteringCard).toContainText(/Pass\s*1/);

    await expect.poll(() => searchRequests).toContain("123456");
  });

  test("D2 Filtering More opens the full pass list and rows navigate to the symbol detail page", async ({ page }) => {
    const now = "2026-04-15T09:10:00+09:00";

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
    await page.route("**/api/trading/quotes/tracked", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_state: "OPEN",
          as_of: now,
          items: [
            {
              symbol: "005930",
              company_name: "Samsung Electronics",
              price: 71500,
              change: 1900,
              change_pct: 2.73,
              volume: 120000,
              turnover: 8580000000,
              as_of: now,
              market_state: "OPEN",
              source: "daily_price_bar",
              fallback: true,
              is_live: false,
              available: true,
              trade_date: "2026-04-15",
              fallback_reason: "daily_price_bar_current_trade_date",
              unavailable_reason: null,
            },
            {
              symbol: "000660",
              company_name: "SK hynix",
              price: 183400,
              change: -900,
              change_pct: -0.49,
              volume: 98000,
              turnover: 17973200000,
              as_of: now,
              market_state: "OPEN",
              source: "daily_price_bar",
              fallback: true,
              is_live: false,
              available: true,
              trade_date: "2026-04-15",
              fallback_reason: "daily_price_bar_current_trade_date",
              unavailable_reason: null,
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/quotes/005930", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          symbol: "005930",
          company_name: "Samsung Electronics",
          price: 71500,
          change: 1900,
          change_pct: 2.73,
          volume: 120000,
          turnover: 8580000000,
          market_state: "OPEN",
          source: "daily_price_bar",
          fallback: true,
          is_live: false,
          available: true,
          cached_at: now,
          trade_date: "2026-04-15",
          fallback_reason: "daily_price_bar_current_trade_date",
          unavailable_reason: null,
        }),
      });
    });
    await page.route("**/api/trading/quotes/000660", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          symbol: "000660",
          company_name: "SK hynix",
          price: 183400,
          change: -900,
          change_pct: -0.49,
          volume: 98000,
          turnover: 17973200000,
          market_state: "OPEN",
          source: "daily_price_bar",
          fallback: true,
          is_live: false,
          available: true,
          cached_at: now,
          trade_date: "2026-04-15",
          fallback_reason: "daily_price_bar_current_trade_date",
          unavailable_reason: null,
        }),
      });
    });
    await page.route("**/api/trading/quotes/035420", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          symbol: "035420",
          company_name: "NAVER",
          price: 202500,
          change: 2200,
          change_pct: 1.10,
          volume: 54000,
          turnover: 10935000000,
          market_state: "OPEN",
          source: "daily_price_bar",
          fallback: true,
          is_live: false,
          available: true,
          cached_at: now,
          trade_date: "2026-04-15",
          fallback_reason: "daily_price_bar_current_trade_date",
          unavailable_reason: null,
        }),
      });
    });
    await page.route("**/api/trading/quotes/005380", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          symbol: "005380",
          company_name: "Hyundai Motor",
          price: 238000,
          change: 800,
          change_pct: 0.34,
          volume: 46000,
          turnover: 10948000000,
          market_state: "OPEN",
          source: "daily_price_bar",
          fallback: true,
          is_live: false,
          available: true,
          cached_at: now,
          trade_date: "2026-04-15",
          fallback_reason: "daily_price_bar_current_trade_date",
          unavailable_reason: null,
        }),
      });
    });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-15",
            eod_status: "completed",
            symbols_total: 4,
            symbols_succeeded: 4,
            symbols_failed: 0,
          },
          latest: {
            price_trade_date: "2026-04-15",
            technical_market_date: "2026-04-15",
            action_market_date: "2026-04-15",
          },
          technical: {
            success: true,
            latest_date: "2026-04-15",
          },
        }),
      });
    });
    await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-15",
          summary: {
            entries: 4,
            requested_symbol: null,
            matched_symbols: ["000660", "005930", "005380", "035420"],
            missing_symbols: [],
            passed_count: 4,
            not_passed_count: 0,
          },
          items: [
            {
              symbol: "000660",
              market_date: "2026-04-15",
              passed_filter: true,
              piotroski_score: 9,
              passes_piotroski_score: true,
              captured_at: now,
            },
            {
              symbol: "005930",
              market_date: "2026-04-15",
              passed_filter: true,
              piotroski_score: 8,
              passes_piotroski_score: true,
              captured_at: now,
            },
            {
              symbol: "005380",
              market_date: "2026-04-15",
              passed_filter: true,
              piotroski_score: 7,
              passes_piotroski_score: true,
              captured_at: now,
            },
            {
              symbol: "035420",
              market_date: "2026-04-15",
              passed_filter: true,
              piotroski_score: 6,
              passes_piotroski_score: true,
              captured_at: now,
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          runs: [],
          latest_run: null,
        }),
      });
    });
    await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: "2026-04-15",
            symbols: null,
            expected_agents: [],
          },
          summary: {
            run_status: "completed",
            is_live: false,
            latest_feedback_at: now,
            seconds_since_last_feedback: 120,
            stalled_threshold_seconds: 300,
            total_symbols: 4,
            processed_symbols: 4,
            completed_symbols: 4,
            in_progress_symbols: 0,
            pending_symbols: 0,
            progress_ratio: 1,
            progress_percent: 100,
            failed_items: 0,
            completed_feedback_count: 0,
            expected_feedback_count: 0,
          },
        }),
      });
    });

    await page.goto("/dashboard");

    const filteringCard = page.locator("#dashboard-freshness article").filter({ hasText: "Filtering" });
    await expect(filteringCard).toContainText("Completed");
    await expect(filteringCard).toContainText(/Checked\s*4/);
    await expect(filteringCard).toContainText(/Pass\s*4/);

    await filteringCard
      .getByRole("link", { name: /Open the full Piotroski filter pass list/i })
      .click();

    await expect(page).toHaveURL(/\/dashboard\/piotroski-filter\?marketDate=2026-04-15$/);
    await expect(page.getByRole("heading", { name: /Piotroski filter pass list/i })).toBeVisible();

    const fullListRows = page.locator('a[href*="/dashboard/symbol/"]');
    await expect(fullListRows).toHaveCount(4);
    await expect(fullListRows.nth(0)).toContainText("SK hynix");
    await expect(fullListRows.nth(1)).toContainText("Samsung Electronics");
    await expect(fullListRows.nth(2)).toContainText("Hyundai Motor");
    await expect(fullListRows.nth(3)).toContainText("NAVER");

    await fullListRows.nth(0).click();

    await expect(page).toHaveURL(
      /\/dashboard\/symbol\/000660\?name=SK(?:\+|%20)hynix&marketDate=2026-04-15$/,
    );
  });

  test("tracked symbol cards keep quote content inside the card during desktop resizes", async ({ page }) => {
    const now = "2026-04-15T09:10:00+09:00";

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
    await page.route("**/api/trading/quotes/tracked", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_state: "OPEN",
          as_of: now,
          items: [
            {
              symbol: "005930",
              company_name: "Samsung Electronics",
              price: 71500,
              change: 600,
              change_pct: 0.84,
              volume: 120000,
              turnover: 8580000000,
              as_of: now,
              market_state: "OPEN",
              source: "daily_price_bar",
              fallback: true,
              is_live: false,
              available: true,
              trade_date: "2026-04-15",
              fallback_reason: "daily_price_bar_current_trade_date",
              unavailable_reason: null,
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-16",
            eod_status: "completed",
            symbols_total: 250,
            symbols_succeeded: 250,
            symbols_failed: 0,
            received: true,
          },
          latest: {
            price_trade_date: "2026-04-15",
            symbols_total: 250,
            symbols_succeeded: 250,
            technical_market_date: "2026-04-15",
            action_market_date: "2026-04-15",
          },
          technical: {
            success: true,
            latest_date: "2026-04-15",
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          runs: [],
          latest_run: null,
        }),
      });
    });
    await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: "2026-04-15",
            symbols: null,
            expected_agents: [],
          },
          summary: {
            run_status: "completed",
            is_live: false,
            latest_feedback_at: "2026-04-15T10:20:00+09:00",
            seconds_since_last_feedback: 120,
            stalled_threshold_seconds: 300,
            total_symbols: 1,
            processed_symbols: 1,
            completed_symbols: 1,
            in_progress_symbols: 0,
            pending_symbols: 0,
            progress_ratio: 1,
            progress_percent: 100,
            failed_items: 0,
            completed_feedback_count: 3,
            expected_feedback_count: 3,
          },
        }),
      });
    });

    await page.setViewportSize({ width: 1920, height: 980 });
    await page.goto("/dashboard");

    const symbolCard = page
      .locator("a")
      .filter({ hasText: "005930" })
      .filter({ hasText: "Samsung Electronics" })
      .first();
    await expect(symbolCard).toBeVisible();

    for (const width of [1920, 1500, 1280, 1024]) {
      await page.setViewportSize({ width, height: 980 });
      await symbolCard.scrollIntoViewIfNeeded();
      await expect(symbolCard).toBeVisible();

      const metrics = await symbolCard.evaluate((card) => {
        const cardRect = card.getBoundingClientRect();
        const tolerance = 1;
        const overflowingChildren = Array.from(card.children)
          .filter((child) => !child.classList.contains("component-tag"))
          .map((child) => {
            const rect = child.getBoundingClientRect();
            return {
              tag: child.tagName.toLowerCase(),
              left: rect.left - cardRect.left,
              right: rect.right - cardRect.right,
              top: rect.top - cardRect.top,
              bottom: rect.bottom - cardRect.bottom,
            };
          })
          .filter(
            (rect) =>
              rect.left < -tolerance ||
              rect.right > tolerance ||
              rect.top < -tolerance ||
              rect.bottom > tolerance,
          );

        return {
          clientHeight: card.clientHeight,
          clientWidth: card.clientWidth,
          overflowingChildren,
          scrollHeight: card.scrollHeight,
          scrollWidth: card.scrollWidth,
        };
      });

      expect(metrics.overflowingChildren).toEqual([]);
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
      expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 1);
    }
  });

  test("D2 EOD status maps stage dates to synced and not synced subcards", async ({ page }) => {
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-16",
            price: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 237,
              symbols_failed: 13,
            },
            technical_analysis: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            action_summary: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 248,
              symbols_failed: 2,
            },
            fundamentals: {
              status: "ready",
              symbols_total: 42,
              symbols_succeeded: 42,
              symbols_failed: 1,
            },
          },
          latest: {
            price_trade_date: "2026-04-15",
            technical_market_date: "2026-04-16",
            action_market_date: "2026-04-14",
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: {
            id: 7,
            market_date: "2026-04-16",
            trigger: "internal_ops_cli",
            status: "completed",
            fs_div: "CFS",
            force: false,
            symbol_limit: null,
            symbol_offset: 0,
            symbols_total: 42,
            symbols_checked: 42,
            symbols_missing: 0,
            symbols_stale: 0,
            symbols_fresh: 42,
            symbols_refreshed: 42,
            symbols_failed: 1,
            events_detected: 0,
            events_captured: 0,
            events_failed: 0,
            error_message: null,
            run_metadata: {},
            started_at: "2026-04-16T08:56:58.357390+09:00",
            completed_at: "2026-04-16T09:11:08.375335+09:00",
          },
          runs: [],
        }),
      });
    });

    await page.goto("/dashboard");

    const eodStatusCard = page.locator("#dashboard-freshness article").filter({ hasText: "EOD Status" });
    await expect(eodStatusCard).toBeVisible();
    await expect(eodStatusCard.getByText("Market date 2026-04-16")).toBeVisible();

    const priceStage = page.locator('[aria-label="Price Fetch freshness"]');
    await expect(priceStage).toContainText("not synced");
    await expect(priceStage).toContainText("Succeeded 237 / 250");
    await expect(priceStage).toContainText("Failed 13");
    await expect(priceStage).toContainText("Latest date 2026-04-15");

    const technicalStage = page.locator('[aria-label="Technical Analysis freshness"]');
    await expect(technicalStage).toContainText("synced");
    await expect(technicalStage).toContainText("Succeeded 250 / 250");
    await expect(technicalStage.getByText("Latest date")).toHaveCount(0);

    const actionStage = page.locator('[aria-label="Action Summary freshness"]');
    await expect(actionStage).toContainText("not synced");
    await expect(actionStage).toContainText("Failed 2");
    await expect(actionStage).toContainText("Latest date 2026-04-14");

    const fundamentalsStage = page.locator('[aria-label="Fundamentals freshness"]');
    await expect(fundamentalsStage).toContainText("synced");
    await expect(fundamentalsStage).toContainText("Checked 42");
    await expect(fundamentalsStage).toContainText("Failed 1");
  });

  test("D2 EOD status shows break day on non-trading market days", async ({ page }) => {
    const now = "2026-04-18T10:00:00+09:00";

    await page.route("**/api/trading/market/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market: "KRX",
          state: "WEEKEND",
          is_trading_day: false,
          is_open: false,
          server_time: now,
          session_open_at: null,
          session_close_at: null,
          reason: "weekend",
        }),
      });
    });
    await page.route("**/api/trading/quotes/tracked", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_state: "WEEKEND",
          as_of: now,
          items: [
            {
              symbol: "005930",
              company_name: "Samsung Electronics",
              price: 71500,
              change: 0,
              change_pct: 0,
              volume: 120000,
              turnover: 8580000000,
              as_of: now,
              market_state: "WEEKEND",
              source: "daily_price_bar",
              fallback: true,
              is_live: false,
              available: true,
              trade_date: "2026-04-17",
              fallback_reason: "daily_price_bar_current_trade_date",
              unavailable_reason: null,
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-18",
            eod_status: "completed",
            symbols_total: 250,
            symbols_succeeded: 250,
            symbols_failed: 0,
          },
          latest: {
            price_trade_date: "2026-04-17",
            technical_market_date: "2026-04-17",
            action_market_date: "2026-04-17",
          },
          technical: {
            success: true,
            latest_date: "2026-04-17",
          },
          fundamentals: {
            success: true,
            latest_date: "2026-04-17",
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: {
            id: 8,
            market_date: "2026-04-17",
            trigger: "internal_ops_cli",
            status: "completed",
            fs_div: "CFS",
            force: false,
            symbol_limit: null,
            symbol_offset: 0,
            symbols_total: 42,
            symbols_checked: 42,
            symbols_missing: 0,
            symbols_stale: 0,
            symbols_fresh: 42,
            symbols_refreshed: 42,
            symbols_failed: 0,
            events_detected: 0,
            events_captured: 0,
            events_failed: 0,
            error_message: null,
            run_metadata: {},
            started_at: "2026-04-17T08:56:58.357390+09:00",
            completed_at: "2026-04-17T09:11:08.375335+09:00",
          },
          runs: [],
        }),
      });
    });

    await page.goto("/dashboard");

    const eodStatusCard = page.locator("#dashboard-freshness article").filter({ hasText: "EOD Status" });
    await expect(eodStatusCard).toBeVisible();
    await expect(eodStatusCard.getByText("Market date 2026-04-18")).toBeVisible();

    const priceStage = page.locator('[aria-label="Price Fetch freshness"]');
    await expect(priceStage).toContainText("break day");
    await expect(priceStage).toContainText("Latest date 2026-04-17");
    await expect(priceStage.getByText("not synced")).toHaveCount(0);

    const technicalStage = page.locator('[aria-label="Technical Analysis freshness"]');
    await expect(technicalStage).toContainText("break day");
    await expect(technicalStage).toContainText("Latest date 2026-04-17");
    await expect(technicalStage.getByText("not synced")).toHaveCount(0);

    const actionStage = page.locator('[aria-label="Action Summary freshness"]');
    await expect(actionStage).toContainText("break day");
    await expect(actionStage).toContainText("Latest date 2026-04-17");
    await expect(actionStage.getByText("not synced")).toHaveCount(0);

    const fundamentalsStage = page.locator('[aria-label="Fundamentals freshness"]');
    await expect(fundamentalsStage).toContainText("break day");
    await expect(fundamentalsStage).toContainText("Latest date 2026-04-17");
    await expect(fundamentalsStage.getByText("not synced")).toHaveCount(0);
  });

  test("D2 EOD status keeps missing weekend stages as not synced", async ({ page }) => {
    const now = "2026-04-18T10:00:00+09:00";

    await page.route("**/api/trading/market/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market: "KRX",
          state: "WEEKEND",
          is_trading_day: false,
          is_open: false,
          server_time: now,
          session_open_at: null,
          session_close_at: null,
          reason: "weekend",
        }),
      });
    });
    await page.route("**/api/trading/quotes/tracked", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_state: "WEEKEND",
          as_of: now,
          items: [
            {
              symbol: "005930",
              company_name: "Samsung Electronics",
              price: 71500,
              change: 0,
              change_pct: 0,
              volume: 120000,
              turnover: 8580000000,
              as_of: now,
              market_state: "WEEKEND",
              source: "daily_price_bar",
              fallback: true,
              is_live: false,
              available: true,
              trade_date: "2026-04-17",
              fallback_reason: "daily_price_bar_current_trade_date",
              unavailable_reason: null,
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-18",
            price: {
              status: "missing",
              symbols_total: 250,
              symbols_succeeded: 0,
              symbols_failed: 0,
            },
            action_summary: {
              status: "failed",
              symbols_total: 250,
              symbols_succeeded: 0,
              symbols_failed: 250,
            },
            fundamentals: {
              status: "missing",
              symbols_total: 42,
              symbols_succeeded: 0,
              symbols_failed: 0,
            },
          },
          latest: {
            price_trade_date: "2026-04-17",
            technical_market_date: "2026-04-17",
            action_market_date: "2026-04-17",
          },
          technical: {
            success: false,
            latest_date: "2026-04-17",
          },
          fundamentals: {
            success: true,
            latest_date: "2026-04-17",
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: {
            id: 8,
            market_date: "2026-04-17",
            trigger: "internal_ops_cli",
            status: "completed",
            fs_div: "CFS",
            force: false,
            symbol_limit: null,
            symbol_offset: 0,
            symbols_total: 42,
            symbols_checked: 42,
            symbols_missing: 0,
            symbols_stale: 0,
            symbols_fresh: 42,
            symbols_refreshed: 42,
            symbols_failed: 0,
            events_detected: 0,
            events_captured: 0,
            events_failed: 0,
            error_message: null,
            run_metadata: {},
            started_at: "2026-04-17T08:56:58.357390+09:00",
            completed_at: "2026-04-17T09:11:08.375335+09:00",
          },
          runs: [],
        }),
      });
    });

    await page.goto("/dashboard");

    const eodStatusCard = page.locator("#dashboard-freshness article").filter({ hasText: "EOD Status" });
    await expect(eodStatusCard).toBeVisible();

    const priceStage = page.locator('[aria-label="Price Fetch freshness"]');
    await expect(priceStage).toContainText("not synced");
    await expect(priceStage.getByText("break day")).toHaveCount(0);

    const technicalStage = page.locator('[aria-label="Technical Analysis freshness"]');
    await expect(technicalStage).toContainText("not synced");
    await expect(technicalStage).toContainText("Latest date 2026-04-17");
    await expect(technicalStage.getByText("break day")).toHaveCount(0);

    const actionStage = page.locator('[aria-label="Action Summary freshness"]');
    await expect(actionStage).toContainText("not synced");
    await expect(actionStage.getByText("break day")).toHaveCount(0);

    const fundamentalsStage = page.locator('[aria-label="Fundamentals freshness"]');
    await expect(fundamentalsStage).toContainText("not synced");
    await expect(fundamentalsStage.getByText("break day")).toHaveCount(0);
  });

  test("D2 EOD status shows running before stale latest-date checks", async ({ page }) => {
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-16",
            price: {
              status: "running",
              symbols_total: 250,
              symbols_succeeded: 80,
              symbols_failed: 0,
            },
            technical_analysis: {
              status: "running",
              symbols_total: 250,
              symbols_succeeded: 0,
              symbols_failed: 0,
            },
            action_summary: {
              status: "missing",
              symbols_total: 250,
              symbols_succeeded: 0,
              symbols_failed: 0,
            },
            fundamentals: {
              status: "missing",
              symbols_total: 0,
              symbols_succeeded: 0,
              symbols_failed: 0,
            },
          },
          latest: {
            price_trade_date: "2026-04-15",
            technical_market_date: "2026-04-15",
            action_market_date: "2026-04-15",
          },
        }),
      });
    });

    await page.goto("/dashboard");

    const eodStatusCard = page.locator("#dashboard-freshness article").filter({ hasText: "EOD Status" });
    await expect(eodStatusCard).toBeVisible();
    const priceStage = page.locator('[aria-label="Price Fetch freshness"]');
    const technicalStage = page.locator('[aria-label="Technical Analysis freshness"]');
    await expect(priceStage).toContainText("running");
    await expect(priceStage).toContainText("Progress 80 / 250");
    await expect(priceStage.getByText("not synced")).toHaveCount(0);
    await expect(technicalStage).toContainText("running");
    await expect(technicalStage).toContainText("Progress 0 / 250");
    await expect(technicalStage.getByText("not synced")).toHaveCount(0);
  });

  test("D2 EOD status keeps ready price not synced without a latest price date", async ({ page }) => {
    await page.route("**/api/trading/quotes/tracked", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_state: "OPEN",
          as_of: "2026-04-14T09:10:00+09:00",
          items: [
            {
              symbol: "005930",
              company_name: "Samsung Electronics",
              price: 71500,
              change: 600,
              change_pct: 0.84,
              volume: 120000,
              turnover: 8580000000,
              as_of: "2026-04-14T09:10:00+09:00",
              market_state: "OPEN",
              source: "daily_price_bar",
              fallback: true,
              is_live: false,
              available: true,
              trade_date: "2026-04-14",
              fallback_reason: "daily_price_bar_current_trade_date",
              unavailable_reason: null,
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-14",
            price: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
          },
          latest: {
            price_trade_date: null,
            technical_market_date: null,
            action_market_date: null,
          },
        }),
      });
    });

    await page.goto("/dashboard");

    const eodStatusCard = page.locator("#dashboard-freshness article").filter({ hasText: "EOD Status" });
    await expect(eodStatusCard).toBeVisible();
    await expect(eodStatusCard.getByText("Market date 2026-04-14")).toBeVisible();
    await expect(page.locator('[aria-label="Price Fetch freshness"]')).toContainText("not synced");
    await expect(page.locator('[aria-label="Price Fetch freshness"]')).toContainText("Succeeded 250 / 250");
    await expect(eodStatusCard.getByText("Freshness available")).toHaveCount(0);
  });

  test("D2 agent feedback progress uses the latest price trade date and preserves backend role order", async ({
    page,
  }) => {
    const now = "2026-04-15T10:20:00+09:00";
    let requestedMarketDate: string | null = null;
    let progressRequestCount = 0;
    let stopControlRequestBody: Record<string, unknown> | null = null;
    let agentProgressSummary = {
      run_status: "running",
      is_live: false,
      latest_feedback_at: "2026-04-15T10:18:00+09:00",
      seconds_since_last_feedback: 15,
      stalled_threshold_seconds: 300,
      total_symbols: 250,
      processed_symbols: 126,
      completed_symbols: 88,
      in_progress_symbols: 38,
      pending_symbols: 124,
      progress_ratio: 0.504,
      progress_percent: 50.4,
      failed_items: 3,
      completed_feedback_count: 302,
      expected_feedback_count: 1000,
      current_role: "technical-summarizer",
    };
    const freshnessPayload = {
      today: {
        trade_date: "2026-04-16",
        price: {
          status: "ready",
          symbols_total: 250,
          symbols_succeeded: 250,
          symbols_failed: 0,
        },
        technical_analysis: {
          status: "ready",
          symbols_total: 250,
          symbols_succeeded: 250,
          symbols_failed: 0,
        },
        action_summary: {
          status: "ready",
          symbols_total: 250,
          symbols_succeeded: 250,
          symbols_failed: 0,
        },
        fundamentals: {
          status: "ready",
          symbols_total: 42,
          symbols_succeeded: 42,
          symbols_failed: 0,
        },
      },
      latest: {
        price_trade_date: "2026-04-15",
        symbols_total: 250,
        symbols_succeeded: 250,
        technical_market_date: "2026-04-15",
        action_market_date: "2026-04-15",
      },
    };

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
    await page.route("**/api/trading/quotes/tracked", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_state: "OPEN",
          as_of: now,
          items: [
            {
              symbol: "005930",
              company_name: "Samsung Electronics",
              price: 71500,
              change: 600,
              change_pct: 0.84,
              volume: 120000,
              turnover: 8580000000,
              as_of: now,
              market_state: "OPEN",
              source: "daily_price_bar",
              fallback: true,
              is_live: false,
              available: true,
              trade_date: "2026-04-15",
              fallback_reason: "daily_price_bar_current_trade_date",
              unavailable_reason: null,
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(freshnessPayload),
      });
    });
    await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
      const url = new URL(route.request().url());
      requestedMarketDate = url.searchParams.get("market_date");
      progressRequestCount += 1;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: requestedMarketDate,
            symbols: null,
            expected_agents: [
              "preflight-gate",
              "eod-summarizer",
              "technical-summarizer",
              "fundamental-summarizer",
            ],
          },
          summary: agentProgressSummary,
        }),
      });
    });
    await page.route("**/api/trading/agent-context/internal/core/control", async (route) => {
      stopControlRequestBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          status: "killed",
          port: 8000,
          signal: "SIGKILL",
          pids: [12345],
          self_targeted: false,
        }),
      });
    });

    await page.goto("/dashboard");

    await expect.poll(() => requestedMarketDate).toBe("2026-04-15");
    const freshnessPanel = page.locator("#dashboard-freshness");
    await expect(page.getByText("Market Open")).toBeVisible();
    await expect(freshnessPanel.getByText(/^Market state\b/)).toHaveCount(0);
    await expect(freshnessPanel.getByText(/Server time/)).toBeVisible();

    const progressCard = freshnessPanel.locator("article").filter({ hasText: "Agent Feedback" });
    const stopButton = progressCard.getByRole("button", { name: "중단" });
    await expect(progressCard).toBeVisible();
    await expect(progressCard).toContainText("에이전트 분석 중...");
    await expect(stopButton).toBeVisible();
    await stopButton.click();
    const stopDialog = page.getByRole("dialog", { name: "중단하시겠습니까?" });
    await expect(stopDialog).toBeVisible();
    await expect(stopDialog.getByRole("button", { name: /close/i })).toHaveCount(0);
    await expect(stopDialog).not.toContainText("실제 중단 동작은 추후 연결할 예정입니다.");
    await stopDialog.getByRole("button", { name: "아니요" }).click();
    await expect(stopDialog).toHaveCount(0);
    expect(stopControlRequestBody).toBeNull();
    await stopButton.click();
    await expect(stopDialog).toBeVisible();
    await stopDialog.getByRole("button", { name: "예" }).click();
    await expect.poll(() => JSON.stringify(stopControlRequestBody)).toBe(
      JSON.stringify({
        action: "kill",
        signal_name: "SIGKILL",
        port: 8000,
      }),
    );
    await expect(stopDialog).toHaveCount(0);
    await expect(progressCard).toContainText("기준일 2026-04-15");
    await expect(progressCard).not.toContainText("피드백 완료 302개 / 1,000개");
    await expect(progressCard).not.toContainText("예상 기준");
    await expect(progressCard).not.toContainText("현재 롤");
    await expect(progressCard).not.toContainText("롤당 병렬");
    await expect(progressCard).not.toContainText("Run ID");
    const roleRows = progressCard.locator('[aria-label="Agent role progress"] [role="listitem"]');
    await expect(roleRows).toHaveCount(4);
    await expect(roleRows.nth(0)).toContainText("Preflight Gate");
    await expect(roleRows.nth(1)).toContainText("EOD summarizer");
    await expect(roleRows.nth(2)).toContainText("Technical summarizer");
    await expect(roleRows.nth(3)).toContainText("Fundamental summarizer");
    await expect(
      progressCard.locator('[data-role-status="completed"]').filter({ hasText: "Preflight Gate" }),
    ).toBeVisible();
    await expect(
      progressCard.locator('[data-role-status="completed"]').filter({ hasText: "EOD summarizer" }),
    ).toBeVisible();
    const activeTechnicalRole = progressCard
      .locator('[data-role-status="running"]')
      .filter({ hasText: "Technical summarizer" });
    await expect(activeTechnicalRole).toBeVisible();
    await expect(activeTechnicalRole).toContainText(/진행률\s*50\.40%/);
    await expect(activeTechnicalRole).toContainText(/전체 대상\s*250개/);
    await expect(activeTechnicalRole).toContainText(/실패\s*3개/);
    await expect(activeTechnicalRole).toContainText(/완료\s*88개/);
    await expect(activeTechnicalRole).toContainText(/무응답 경과\s*15s/);
    await expect(activeTechnicalRole).toContainText(/마지막 적재\s*26-04-15 : 10:18:00/);
    await expect(activeTechnicalRole.locator('[data-role-icon="running"]')).toBeVisible();
    await expect(activeTechnicalRole).toContainText("EOD 확인");
    await expect(
      progressCard.locator('[data-role-status="pending"]').filter({ hasText: "Fundamental summarizer" }),
    ).toBeVisible();
    await expect(roleRows.nth(0)).not.toContainText("진행률");
    await expect(roleRows.nth(1)).not.toContainText("진행률");
    await expect(roleRows.nth(3)).not.toContainText("진행률");
    const activeRoleAnimation = await activeTechnicalRole
      .locator('[data-role-icon="running"]')
      .evaluate((element) => getComputedStyle(element).animationName);
    expect(activeRoleAnimation).toContain("agentRoleSpin");
    await expect.poll(() => progressRequestCount, { timeout: 2500 }).toBeGreaterThanOrEqual(2);

    async function reloadAndExpectAgentStatus(expectedLabel: string) {
      const previousProgressRequestCount = progressRequestCount;
      await page.reload();
      await expect.poll(() => progressRequestCount).toBeGreaterThan(previousProgressRequestCount);
      await expect(progressCard).toContainText(expectedLabel);
    }

    agentProgressSummary = {
      ...agentProgressSummary,
      run_status: "legacy-running",
      is_live: true,
      failed_items: 3,
      latest_feedback_at: "2026-04-15T10:19:55+09:00",
      seconds_since_last_feedback: 5,
    };
    await reloadAndExpectAgentStatus("에이전트 분석 중...");
    await expect(progressCard).not.toContainText("에이전트 확인 필요");
    await expect(stopButton).toBeVisible();

    agentProgressSummary = {
      ...agentProgressSummary,
      run_status: "stalled",
      is_live: true,
      failed_items: 0,
      latest_feedback_at: "2026-04-15T10:10:00+09:00",
      seconds_since_last_feedback: 600,
    };
    await reloadAndExpectAgentStatus("에이전트 확인 필요");
    await expect(progressCard).not.toContainText("에이전트 분석 중...");
    await expect(progressCard).toContainText("기준일 2026-04-15");
    await expect(progressCard).not.toContainText("피드백 완료");
    await expect(
      progressCard.locator('[data-role-status="completed"]').filter({ hasText: "Preflight Gate" }),
    ).toContainText(/Complete\s*250개/);
    await expect(
      progressCard.locator('[data-role-status="completed"]').filter({ hasText: "EOD summarizer" }),
    ).toContainText(/Complete\s*250개/);
    await expect(
      progressCard.locator('[data-role-status="attention"]').filter({ hasText: "Technical summarizer" }),
    ).toContainText(/Complete\s*88개/);
    await expect(
      progressCard.locator('[data-role-status="pending"]').filter({ hasText: "Fundamental summarizer" }),
    ).toContainText(/Complete\s*0개/);
    await expect(stopButton).toHaveCount(0);

    agentProgressSummary = {
      ...agentProgressSummary,
      run_status: "pending",
      is_live: false,
      processed_symbols: 0,
      completed_symbols: 0,
      in_progress_symbols: 0,
      pending_symbols: 250,
      progress_ratio: 0,
      progress_percent: 0,
      completed_feedback_count: 0,
    };
    await reloadAndExpectAgentStatus("에이전트 분석 대기");
    await expect(progressCard).toContainText("기준일 2026-04-15");
    await expect(progressCard).not.toContainText("피드백 완료");
    await expect(progressCard.locator('[data-role-status="pending"]')).toHaveCount(4);
    await expect(progressCard.getByText("Complete0개")).toHaveCount(4);
    await expect(stopButton).toHaveCount(0);

    agentProgressSummary = {
      ...agentProgressSummary,
      run_status: "completed",
      is_live: false,
      processed_symbols: 250,
      completed_symbols: 250,
      in_progress_symbols: 0,
      pending_symbols: 0,
      progress_ratio: 1,
      progress_percent: 100,
      completed_feedback_count: 750,
    };
    await reloadAndExpectAgentStatus("에이전트 분석 완료");
    await expect(progressCard).toContainText("기준일 2026-04-15");
    await expect(progressCard).not.toContainText("피드백 완료");
    await expect(progressCard.locator('[data-role-status="completed"]')).toHaveCount(4);
    await expect(progressCard.getByText("Complete250개")).toHaveCount(4);
    await expect(stopButton).toHaveCount(0);
  });

  test("agent feedback stop confirmation accepts an upstream disconnect on desktop", async ({ page }) => {
    const now = "2026-04-15T10:20:00+09:00";
    let stopControlRequestBody: Record<string, unknown> | null = null;

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
    await page.route("**/api/trading/quotes/tracked", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_state: "OPEN",
          as_of: now,
          items: [
            {
              symbol: "005930",
              company_name: "Samsung Electronics",
              price: 71500,
              change: 600,
              change_pct: 0.84,
              volume: 120000,
              turnover: 8580000000,
              as_of: now,
              market_state: "OPEN",
              source: "daily_price_bar",
              fallback: true,
              is_live: false,
              available: true,
              trade_date: "2026-04-15",
              fallback_reason: "daily_price_bar_current_trade_date",
              unavailable_reason: null,
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-16",
            price: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            technical_analysis: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            action_summary: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            fundamentals: {
              status: "ready",
              symbols_total: 42,
              symbols_succeeded: 42,
              symbols_failed: 0,
            },
          },
          latest: {
            price_trade_date: "2026-04-15",
            symbols_total: 250,
            symbols_succeeded: 250,
            technical_market_date: "2026-04-15",
            action_market_date: "2026-04-15",
          },
        }),
      });
    });
    await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
      const url = new URL(route.request().url());
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: url.searchParams.get("market_date"),
            symbols: null,
            expected_agents: [
              "preflight-gate",
              "eod-summarizer",
              "technical-summarizer",
              "fundamental-summarizer",
            ],
          },
          summary: {
            run_id: "run_246",
            run_status: "running",
            run_table_status: "running",
            is_live: false,
            run_started_at: "2026-04-15T10:00:00+09:00",
            run_completed_at: null,
            latest_feedback_at: "2026-04-15T10:18:00+09:00",
            seconds_since_last_feedback: 15,
            stalled_threshold_seconds: 300,
            total_symbols: 250,
            processed_symbols: 126,
            completed_symbols: 88,
            in_progress_symbols: 38,
            pending_symbols: 124,
            progress_ratio: 0.504,
            progress_percent: 50.4,
            failed_items: 3,
            completed_feedback_count: 302,
            expected_feedback_count: 1000,
            current_role: "technical-summarizer",
          },
        }),
      });
    });
    await page.route("**/api/trading/eod/pipeline/status?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-15",
          status: "completed",
          stage_order: [],
          stages: {},
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: null,
          runs: [],
        }),
      });
    });
    await page.route("**/api/trading/agent-context/internal/core/control", async (route) => {
      stopControlRequestBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Upstream fetch failed",
          message: "fetch failed",
          path: "/agent-context/internal/core/control",
        }),
      });
    });

    await page.goto("/dashboard");

    const progressCard = page.locator("#dashboard-freshness article").filter({ hasText: "Agent Feedback" });
    const stopButton = progressCard.getByRole("button", { name: "중단" });
    await expect(progressCard).toContainText("에이전트 분석 중...");
    await expect(stopButton).toBeVisible();
    await stopButton.click();

    const stopDialog = page.getByRole("dialog", { name: "중단하시겠습니까?" });
    await expect(stopDialog).toBeVisible();
    await stopDialog.getByRole("button", { name: "예" }).click();

    await expect.poll(() => JSON.stringify(stopControlRequestBody)).toBe(
      JSON.stringify({
        action: "kill",
        signal_name: "SIGKILL",
        port: 8000,
      }),
    );
    await expect(stopDialog).toHaveCount(0);
    await expect(progressCard).toContainText("에이전트 확인 필요");
    await expect(stopButton).toHaveCount(0);
    await expect(progressCard).not.toContainText("fetch failed");
  });

  test("agent feedback stop confirmation keeps real upstream 502 failures visible on desktop", async ({
    page,
  }) => {
    const now = "2026-04-15T10:20:00+09:00";
    let stopControlRequestBody: Record<string, unknown> | null = null;

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
    await page.route("**/api/trading/quotes/tracked", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_state: "OPEN",
          as_of: now,
          items: [
            {
              symbol: "005930",
              company_name: "Samsung Electronics",
              price: 71500,
              change: 600,
              change_pct: 0.84,
              volume: 120000,
              turnover: 8580000000,
              as_of: now,
              market_state: "OPEN",
              source: "daily_price_bar",
              fallback: true,
              is_live: false,
              available: true,
              trade_date: "2026-04-15",
              fallback_reason: "daily_price_bar_current_trade_date",
              unavailable_reason: null,
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-16",
            price: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            technical_analysis: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            action_summary: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            fundamentals: {
              status: "ready",
              symbols_total: 42,
              symbols_succeeded: 42,
              symbols_failed: 0,
            },
          },
          latest: {
            price_trade_date: "2026-04-15",
            symbols_total: 250,
            symbols_succeeded: 250,
            technical_market_date: "2026-04-15",
            action_market_date: "2026-04-15",
          },
        }),
      });
    });
    await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
      const url = new URL(route.request().url());
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: url.searchParams.get("market_date"),
            symbols: null,
            expected_agents: [
              "preflight-gate",
              "eod-summarizer",
              "technical-summarizer",
              "fundamental-summarizer",
            ],
          },
          summary: {
            run_status: "running",
            is_live: false,
            latest_feedback_at: "2026-04-15T10:18:00+09:00",
            seconds_since_last_feedback: 15,
            stalled_threshold_seconds: 300,
            total_symbols: 250,
            processed_symbols: 126,
            completed_symbols: 88,
            in_progress_symbols: 38,
            pending_symbols: 124,
            progress_ratio: 0.504,
            progress_percent: 50.4,
            failed_items: 3,
            completed_feedback_count: 302,
            expected_feedback_count: 1000,
            current_role: "technical-summarizer",
          },
        }),
      });
    });
    await page.route("**/api/trading/eod/pipeline/status?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-15",
          status: "completed",
          stage_order: [],
          stages: {},
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: null,
          runs: [],
        }),
      });
    });
    await page.route("**/api/trading/agent-context/internal/core/control", async (route) => {
      stopControlRequestBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Upstream kill failed",
        }),
      });
    });

    await page.goto("/dashboard");

    const progressCard = page.locator("#dashboard-freshness article").filter({ hasText: "Agent Feedback" });
    const stopButton = progressCard.getByRole("button", { name: "중단" });
    await expect(progressCard).toContainText("에이전트 분석 중...");
    await expect(stopButton).toBeVisible();
    await stopButton.click();

    const stopDialog = page.getByRole("dialog", { name: "중단하시겠습니까?" });
    await expect(stopDialog).toBeVisible();
    await stopDialog.getByRole("button", { name: "예" }).click();

    await expect.poll(() => JSON.stringify(stopControlRequestBody)).toBe(
      JSON.stringify({
        action: "kill",
        signal_name: "SIGKILL",
        port: 8000,
      }),
    );
    await expect(stopDialog).toBeVisible();
    await expect(stopDialog).toContainText("HTTP 502 for /api/trading/agent-context/internal/core/control");
    await expect(progressCard).toContainText("에이전트 분석 중...");
    await expect(stopButton).toBeVisible();
  });

  test("D2 agent feedback role dependencies keep confirmation badges without separate failure-count pills", async ({
    page,
  }) => {
    const now = "2026-04-15T10:20:00+09:00";

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
    await page.route("**/api/trading/quotes/tracked", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_state: "OPEN",
          as_of: now,
          items: [],
        }),
      });
    });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-15",
            price: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 237,
              symbols_failed: 13,
            },
            technical_analysis: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 248,
              symbols_failed: 2,
            },
            action_summary: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
          },
          latest: {
            price_trade_date: "2026-04-15",
            technical_market_date: "2026-04-15",
            action_market_date: "2026-04-15",
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: null,
          runs: [],
        }),
      });
    });
    await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: "2026-04-15",
            symbols: null,
            expected_agents: ["eod-summarizer", "technical-summarizer", "fundamental-summarizer"],
          },
          summary: {
            run_status: "running",
            is_live: false,
            latest_feedback_at: "2026-04-15T10:18:00+09:00",
            seconds_since_last_feedback: 15,
            stalled_threshold_seconds: 300,
            total_symbols: 250,
            processed_symbols: 126,
            completed_symbols: 88,
            in_progress_symbols: 38,
            pending_symbols: 124,
            progress_ratio: 0.504,
            progress_percent: 50.4,
            failed_items: 3,
            completed_feedback_count: 302,
            expected_feedback_count: 750,
            current_role: "fundamental-summarizer",
          },
        }),
      });
    });

    await page.goto("/dashboard");

    const progressCard = page.locator("#dashboard-freshness article").filter({ hasText: "Agent Feedback" });
    const activeFundamentalRole = progressCard
      .locator('[data-role-status="running"]')
      .filter({ hasText: "Fundamental summarizer" });

    await expect(progressCard).toContainText("에이전트 분석 중...");
    await expect(
      progressCard.locator('[data-role-status="completed"]').filter({ hasText: "Technical summarizer" }),
    ).toBeVisible();
    await expect(activeFundamentalRole).toBeVisible();
    await expect(activeFundamentalRole).toContainText("EOD 확인");
    await expect(activeFundamentalRole).toContainText("Tech 확인");
    await expect(activeFundamentalRole).not.toContainText("EOD -- 실패 13");
    await expect(activeFundamentalRole).not.toContainText("Tech -- 실패 2");
  });

  test("D2 agent feedback role dependencies hide upstream failure counts while EOD is running", async ({ page }) => {
    const now = "2026-04-15T10:20:00+09:00";

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
    await page.route("**/api/trading/quotes/tracked", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_state: "OPEN",
          as_of: now,
          items: [],
        }),
      });
    });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-15",
            price: {
              status: "running",
              symbols_total: 250,
              symbols_succeeded: 120,
              symbols_failed: 13,
            },
            technical_analysis: {
              status: "running",
              symbols_total: 250,
              symbols_succeeded: 30,
              symbols_failed: 2,
            },
            action_summary: {
              status: "missing",
              symbols_total: 250,
              symbols_succeeded: 0,
              symbols_failed: 0,
            },
          },
          latest: {
            price_trade_date: "2026-04-15",
            technical_market_date: "2026-04-15",
            action_market_date: null,
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: null,
          runs: [],
        }),
      });
    });
    await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: "2026-04-15",
            symbols: null,
            expected_agents: ["eod-summarizer", "technical-summarizer", "fundamental-summarizer"],
          },
          summary: {
            run_status: "running",
            is_live: false,
            latest_feedback_at: "2026-04-15T10:18:00+09:00",
            seconds_since_last_feedback: 15,
            stalled_threshold_seconds: 300,
            total_symbols: 250,
            processed_symbols: 126,
            completed_symbols: 88,
            in_progress_symbols: 38,
            pending_symbols: 124,
            progress_ratio: 0.504,
            progress_percent: 50.4,
            failed_items: 3,
            completed_feedback_count: 302,
            expected_feedback_count: 750,
            current_role: "technical-summarizer",
          },
        }),
      });
    });

    await page.goto("/dashboard");

    const progressCard = page.locator("#dashboard-freshness article").filter({ hasText: "Agent Feedback" });
    const activeTechnicalRole = progressCard
      .locator('[data-role-status="running"]')
      .filter({ hasText: "Technical summarizer" });
    const pendingFundamentalRole = progressCard
      .locator('[data-role-status="pending"]')
      .filter({ hasText: "Fundamental summarizer" });

    await expect(progressCard).toContainText("에이전트 분석 중...");
    await expect(activeTechnicalRole).toBeVisible();
    await expect(activeTechnicalRole).toContainText("EOD 진행 중");
    await expect(activeTechnicalRole).not.toContainText("EOD -- 실패 13");
    await expect(pendingFundamentalRole).toBeVisible();
    await expect(pendingFundamentalRole).toContainText("EOD 진행 중");
    await expect(pendingFundamentalRole).toContainText("Tech 진행 중");
    await expect(pendingFundamentalRole).not.toContainText("EOD -- 실패 13");
    await expect(pendingFundamentalRole).not.toContainText("Tech -- 실패 2");
  });

  test("D2 agent feedback progress preserves active polling cadence after a transient fetch error", async ({ page }) => {
    const now = "2026-04-15T10:20:00+09:00";
    let progressRequestCount = 0;
    const runningSummary = {
      run_status: "running",
      is_live: false,
      latest_feedback_at: "2026-04-15T10:18:00+09:00",
      seconds_since_last_feedback: 15,
      stalled_threshold_seconds: 300,
      total_symbols: 250,
      processed_symbols: 126,
      completed_symbols: 88,
      in_progress_symbols: 38,
      pending_symbols: 124,
      progress_ratio: 0.504,
      progress_percent: 50.4,
      failed_items: 3,
      completed_feedback_count: 302,
      expected_feedback_count: 750,
    };

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
    await page.route("**/api/trading/quotes/tracked", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_state: "OPEN",
          as_of: now,
          items: [],
        }),
      });
    });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-16",
            price: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
          },
          latest: {
            price_trade_date: "2026-04-15",
            symbols_total: 250,
            symbols_succeeded: 250,
            technical_market_date: "2026-04-15",
            action_market_date: "2026-04-15",
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: null,
          runs: [],
        }),
      });
    });
    await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
      progressRequestCount += 1;

      if (progressRequestCount === 2) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ detail: "temporarily unavailable" }),
        });
        return;
      }

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: "2026-04-15",
            symbols: null,
            expected_agents: ["eod-summarizer", "technical-summarizer", "fundamental-summarizer"],
          },
          summary: runningSummary,
        }),
      });
    });

    await page.goto("/dashboard");

    await expect.poll(() => progressRequestCount, { timeout: 2500 }).toBeGreaterThanOrEqual(2);
    await expect.poll(() => progressRequestCount, { timeout: 2500 }).toBeGreaterThanOrEqual(3);
  });

  test("D2 fundamentals subcard maps the ready stage to synced", async ({ page }) => {
    const fundamentalsMarketDateRequests: Array<string | null> = [];

    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-16",
            price: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            technical_analysis: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            action_summary: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            fundamentals: {
              status: "ready",
              symbols_total: 42,
              symbols_succeeded: 42,
              symbols_failed: 1,
            },
          },
          latest: {
            price_trade_date: "2026-04-16",
            technical_market_date: "2026-04-16",
            action_market_date: "2026-04-16",
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      const requestUrl = new URL(route.request().url());
      fundamentalsMarketDateRequests.push(requestUrl.searchParams.get("market_date"));

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: {
            id: 7,
            market_date: "2026-04-16",
            trigger: "internal_ops_cli",
            status: "completed",
            fs_div: "CFS",
            force: false,
            symbol_limit: null,
            symbol_offset: 0,
            symbols_total: 42,
            symbols_checked: 42,
            symbols_missing: 0,
            symbols_stale: 0,
            symbols_fresh: 42,
            symbols_refreshed: 42,
            symbols_failed: 1,
            events_detected: 0,
            events_captured: 0,
            events_failed: 0,
            error_message: null,
            run_metadata: {
              refreshed_symbols_sample: ["005930", "000660", "035420", "005380", "012450"],
            },
            started_at: "2026-04-16T08:56:58.357390+09:00",
            completed_at: "2026-04-16T09:11:08.375335+09:00",
          },
          runs: [],
        }),
      });
    });

    await page.goto("/dashboard");

    const fundamentalsStage = page.locator('[aria-label="Fundamentals freshness"]');
    await expect(fundamentalsStage).toBeVisible();
    await expect(fundamentalsStage).toContainText("synced");
    await expect(fundamentalsStage).toContainText("Checked 42");
    await expect(fundamentalsStage).toContainText("Updated today 42 (005930, 000660, 035420, 005380 +38)");
    await expect(fundamentalsStage).toContainText("Failed 1");
    await expect(fundamentalsStage).toContainText("Run status Completed");
    await expect(fundamentalsStage.getByText("[확인 필요]")).toHaveCount(0);
    await expect.poll(() => fundamentalsMarketDateRequests).toContain("2026-04-16");
  });

  test("D2 fundamentals subcard uses daily inspect date for stale checks", async ({ page }) => {
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-15",
            price: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            technical_analysis: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            action_summary: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            fundamentals: {
              status: "ready",
              symbols_total: 10,
              symbols_succeeded: 10,
              symbols_failed: 1406,
            },
          },
          latest: {
            price_trade_date: "2026-04-15",
            technical_market_date: "2026-04-15",
            action_market_date: "2026-04-15",
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: {
            id: 7,
            market_date: "2026-04-14",
            trigger: "internal_ops_cli",
            status: "partial",
            fs_div: "CFS",
            force: false,
            symbol_limit: null,
            symbol_offset: 0,
            symbols_total: 3583,
            symbols_checked: 3583,
            symbols_missing: 1388,
            symbols_stale: 100,
            symbols_fresh: 2095,
            symbols_refreshed: 10,
            symbols_failed: 1406,
            events_detected: 13786,
            events_captured: 10,
            events_failed: 490,
            error_message: null,
            run_metadata: {},
            started_at: "2026-04-14T08:56:58.357390+09:00",
            completed_at: "2026-04-14T09:11:08.375335+09:00",
          },
          runs: [],
        }),
      });
    });

    await page.goto("/dashboard");

    const fundamentalsStage = page.locator('[aria-label="Fundamentals freshness"]');
    await expect(fundamentalsStage).toBeVisible();
    await expect(fundamentalsStage).toContainText("not synced");
    await expect(fundamentalsStage).toContainText("Latest date 2026-04-14");
    await expect(fundamentalsStage).toContainText("Run status Partial");
    await expect(fundamentalsStage.getByText("Updated today")).toHaveCount(0);
    await expect(fundamentalsStage.getByRole("button", { name: /Review fundamentals run details/i })).toBeVisible();
    await expect(fundamentalsStage.getByText("[확인 필요]")).toHaveCount(0);
  });

  test("D2 fundamentals running status uses readable pill colors and truncates the title", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-14",
            price: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            technical_analysis: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            action_summary: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            fundamentals: {
              status: "running",
              symbols_total: 5,
              symbols_succeeded: 5,
              symbols_failed: 1,
            },
          },
          latest: {
            price_trade_date: "2026-04-14",
            technical_market_date: "2026-04-14",
            action_market_date: "2026-04-14",
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: {
            id: 9,
            market_date: "2026-04-14",
            trigger: "internal_ops_cli",
            status: "running",
            fs_div: "CFS",
            force: false,
            symbol_limit: null,
            symbol_offset: 0,
            symbols_total: 3583,
            symbols_checked: 2400,
            symbols_missing: 0,
            symbols_stale: 0,
            symbols_fresh: 2400,
            symbols_refreshed: 0,
            symbols_failed: 0,
            events_detected: 0,
            events_captured: 0,
            events_failed: 0,
            error_message: null,
            run_metadata: {},
            started_at: "2026-04-14T08:56:58.357390+09:00",
            completed_at: null,
          },
          runs: [],
        }),
      });
    });

    await page.goto("/dashboard");

    const fundamentalsStage = page.locator('[aria-label="Fundamentals freshness"]');
    const fundamentalsTitle = fundamentalsStage.getByText("Fundamentals", { exact: true });
    const runningPill = fundamentalsStage.locator(".pill").filter({ hasText: "running" });

    await expect(fundamentalsStage).toBeVisible();
    await expect(fundamentalsTitle).toHaveCSS("overflow-x", "hidden");
    await expect(fundamentalsTitle).toHaveCSS("text-overflow", "ellipsis");
    await expect(fundamentalsTitle).toHaveCSS("white-space", "nowrap");
    await expect(runningPill).toBeVisible();
    await expect(runningPill).toHaveCSS("color", "rgb(243, 247, 255)");
    await expect(runningPill).toHaveCSS("background-color", "rgba(127, 184, 255, 0.24)");
    await expect(runningPill).toHaveCSS("border-top-color", "rgba(127, 184, 255, 0.45)");

    const titleRowLayout = await fundamentalsStage.evaluate((element) => {
      const title = [...element.querySelectorAll("span")].find((child) => child.textContent?.trim() === "Fundamentals");
      const pill = [...element.querySelectorAll(".pill")].find((child) => child.textContent?.trim() === "running");

      if (!title || !pill) return null;

      const titleRect = title.getBoundingClientRect();
      const pillRect = pill.getBoundingClientRect();

      return {
        pillLeft: pillRect.left,
        titleRight: titleRect.right,
      };
    });

    expect(titleRowLayout).not.toBeNull();
    expect(titleRowLayout!.titleRight).toBeLessThanOrEqual(titleRowLayout!.pillLeft);
  });

  test("D2 not synced status wraps without colliding with long stage titles", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-16",
            price: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 237,
              symbols_failed: 13,
            },
            technical_analysis: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            action_summary: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 248,
              symbols_failed: 2,
            },
            fundamentals: {
              status: "ready",
              symbols_total: 42,
              symbols_succeeded: 42,
              symbols_failed: 1,
            },
          },
          latest: {
            price_trade_date: "2026-04-15",
            technical_market_date: "2026-04-15",
            action_market_date: "2026-04-14",
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: {
            id: 7,
            market_date: "2026-04-16",
            trigger: "internal_ops_cli",
            status: "completed",
            fs_div: "CFS",
            force: false,
            symbol_limit: null,
            symbol_offset: 0,
            symbols_total: 42,
            symbols_checked: 42,
            symbols_missing: 0,
            symbols_stale: 0,
            symbols_fresh: 42,
            symbols_refreshed: 42,
            symbols_failed: 1,
            events_detected: 0,
            events_captured: 0,
            events_failed: 0,
            error_message: null,
            run_metadata: {},
            started_at: "2026-04-16T08:56:58.357390+09:00",
            completed_at: "2026-04-16T09:11:08.375335+09:00",
          },
          runs: [],
        }),
      });
    });

    await page.goto("/dashboard");

    const actionStage = page.locator('[aria-label="Action Summary freshness"]');
    await expect(actionStage).toContainText("not synced");

    const titleRowLayout = await actionStage.evaluate((element) => {
      const title = [...element.querySelectorAll("span")].find(
        (child) => child.textContent?.trim() === "Action Summary",
      );
      const pill = [...element.querySelectorAll(".pill")].find(
        (child) => child.textContent?.replace(/\s+/g, " ").trim() === "not synced",
      );

      if (!title || !pill) return null;

      const titleRect = title.getBoundingClientRect();
      const pillRect = pill.getBoundingClientRect();

      return {
        pillHeight: pillRect.height,
        pillLeft: pillRect.left,
        titleRight: titleRect.right,
      };
    });

    expect(titleRowLayout).not.toBeNull();
    expect(titleRowLayout!.pillHeight).toBeGreaterThan(28);
    expect(titleRowLayout!.titleRight).toBeLessThanOrEqual(titleRowLayout!.pillLeft);
  });

  test("D2 EOD stage subcards keep content inside cards at the narrow desktop breakpoint", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-14",
            price: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            technical_analysis: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            action_summary: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            fundamentals: {
              status: "ready",
              symbols_total: 42,
              symbols_succeeded: 42,
              symbols_failed: 0,
            },
          },
          latest: {
            price_trade_date: "2026-04-14",
            technical_market_date: "2026-04-14",
            action_market_date: "2026-04-14",
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: null,
          runs: [],
        }),
      });
    });

    await page.goto("/dashboard");

    for (const label of ["Price Fetch", "Technical Analysis", "Action Summary", "Fundamentals"]) {
      const stageCard = page.locator(`[aria-label="${label} freshness"]`);
      await expect(stageCard).toBeVisible();
      await expect(stageCard).toContainText("synced");

      const overflowedText = await stageCard.evaluate((element) => {
        const rowRect = element.getBoundingClientRect();
        const tolerance = 1;

        return [...element.querySelectorAll("strong, p, span, button")]
          .filter((child) => child.getClientRects().length > 0)
          .map((child) => {
            const childRect = child.getBoundingClientRect();
            const overflows =
              childRect.left < rowRect.left - tolerance ||
              childRect.right > rowRect.right + tolerance ||
              childRect.top < rowRect.top - tolerance ||
              childRect.bottom > rowRect.bottom + tolerance;

            return overflows ? child.textContent?.trim() ?? child.tagName : null;
          })
          .filter(Boolean);
      });

      expect(overflowedText).toEqual([]);

      const titleToCountGap = await stageCard.evaluate((element, expectedLabel) => {
        const title = [...element.querySelectorAll("span")].find(
          (child) => child.textContent?.trim() === expectedLabel,
        );
        const countLine = element.querySelector('[data-detail-tone="count"]');

        if (!title || !countLine) return null;

        return countLine.getBoundingClientRect().top - title.getBoundingClientRect().bottom;
      }, label);

      expect(titleToCountGap).not.toBeNull();
      expect(titleToCountGap!).toBeLessThanOrEqual(24);
    }
  });

  test("D2 fundamentals failed control opens the 2026-04-14 failure reason dialog", async ({ page }) => {
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-14",
            price: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            technical_analysis: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            action_summary: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            fundamentals: {
              status: "ready",
              symbols_total: 10,
              symbols_succeeded: 10,
              symbols_failed: 1406,
            },
          },
          latest: {
            price_trade_date: "2026-04-14",
            technical_market_date: "2026-04-14",
            action_market_date: "2026-04-14",
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: {
            id: 85,
            market_date: "2026-04-14",
            trigger: "internal_ops_cli",
            status: "failed",
            fs_div: "CFS",
            force: false,
            symbol_limit: null,
            symbol_offset: 0,
            symbols_total: 3583,
            symbols_checked: 3583,
            symbols_missing: 1388,
            symbols_stale: 100,
            symbols_fresh: 2095,
            symbols_refreshed: 10,
            symbols_failed: 1406,
            events_detected: 13786,
            events_captured: 10,
            events_failed: 490,
            error_message: null,
            run_metadata: {
              failure_reason: "DART fundamentals capture reported failed symbols and events.",
            },
            started_at: "2026-04-14T08:56:58.357390+09:00",
            completed_at: "2026-04-14T09:11:08.375335+09:00",
          },
          runs: [],
        }),
      });
    });

    await page.goto("/dashboard");

    const fundamentalsStage = page.locator('[aria-label="Fundamentals freshness"]');
    await expect(fundamentalsStage).toBeVisible();

    await fundamentalsStage.getByRole("button", { name: /Review fundamentals run details/i }).click();

    const dialog = page.getByRole("dialog", { name: /DART fundamentals failed/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Trading-core reported 1,406 failed symbols and 490 failed events");
    await expect(dialog).toContainText("Run date");
    await expect(dialog).toContainText("2026-04-14");
    await expect(dialog).toContainText("Symbols failed");
    await expect(dialog).toContainText("1,406");
    await expect(dialog).toContainText("Events failed");
    await expect(dialog).toContainText("490");
    await expect(dialog).toContainText("Failure Reason");
    await expect(dialog).toContainText("DART fundamentals capture reported failed symbols and events.");

    await dialog.getByRole("button", { name: /Close/i }).click();
    await expect(dialog).toHaveCount(0);
  });

});
