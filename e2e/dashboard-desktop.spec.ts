import { expect, test, type Locator, type Page } from "@playwright/test";

import { RELEASE_VERSION_LABEL } from "@/lib/release-version";

type EodStageStatus = "synced" | "running" | "break day" | "not synced" | "waiting";

const agentReviewRunningLabel = /Agent review running\.\.\.|에이전트 분석 중\.\.\./;
const agentReviewNeedsAttentionLabel = /Agent review needs attention|에이전트 확인 필요/;
const agentReviewPendingLabel = /Agent review pending|에이전트 분석 대기/;
const agentReviewCompletedLabel = /Agent review completed|에이전트 분석 완료/;
const agentFeedbackStopButtonLabel = /Stop|중단/;
const agentFeedbackStopDialogLabel = /Stop the agent feedback run\?|에이전트 피드백 실행을 중단할까요\?/;
const yesLabel = /Yes|예/;
const noLabel = /No|아니요/;

async function expectEodStageStatus(stage: Locator, status: EodStageStatus) {
  await expect(stage).toHaveAttribute("data-status", status);
  const badge = stage.locator(`[data-status-badge="${status}"]`);
  await expect(badge).toBeVisible();

  if (status === "break day") {
    await expect(badge).toContainText(/break day/i);
    return;
  }

  if (status === "running") {
    await expect(badge).toContainText(/\S+/);
    return;
  }

  if (status === "waiting") {
    await expect(badge).toContainText(/waiting/i);
    return;
  }

  await expect(stage.getByRole("img", { name: new RegExp(`^${status}`, "i") })).toBeVisible();
}

async function openProcessMonitorDrawer(page: Page) {
  const drawer = page.getByRole("dialog", { name: /Daily process monitor/i });
  if (await drawer.isVisible().catch(() => false)) {
    return drawer;
  }

  await page.getByRole("button", { name: /Open process monitor/i }).first().click();
  await expect(drawer).toBeVisible();
  return drawer;
}

async function openEodStatusCard(page: Page) {
  const processDrawer = await openProcessMonitorDrawer(page);
  const eodStatusCard = processDrawer.locator("article").filter({ hasText: "EOD Status" });
  await expect(eodStatusCard).toBeVisible();
  return eodStatusCard;
}

test.describe("dashboard desktop", () => {
  test("dashboard labels match currently wired core data", async ({ page }) => {
    await page.route("**/api/trading/market/snapshot", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          as_of: "2026-04-28T10:15:00+09:00",
          indices: {
            kospi: { level: 2742.31, change: 18.42, change_rate: 0.68 },
            kosdaq: { level: 842.17, change: -4.11, change_rate: -0.51 },
          },
          fx: {
            usdkrw: { rate: 1378.2, change: 1.4, change_rate: 0.1 },
          },
          flows: {
            foreign: { summary: "+₩248B net buy" },
            institutional: { summary: "-₩91B net sell" },
          },
          summary: {
            market_bias: "Constructive",
            breadth: "Large caps leading",
          },
        }),
      });
    });

    await page.goto("/dashboard");

    await expect(page.getByText(/Trading Dashboard/i)).toBeVisible();
    const desktopNav = page.getByRole("navigation", { name: /Primary desktop/i });
    await expect(desktopNav).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: /Market Status/i })).toHaveCount(0);
    await expect(desktopNav.getByRole("link", { name: /My Symbols/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Decider, portfolio, and market state/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Decider recommendations/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Portfolio state/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Market condition/i })).toBeVisible();
    const marketCard = page.locator("article").filter({ has: page.getByRole("heading", { name: /Market condition/i }) });
    await expect(marketCard.getByText("KOSPI", { exact: true })).toBeVisible();
    await expect(marketCard.getByText("KOSDAQ", { exact: true })).toBeVisible();
    await expect(marketCard.getByText("USD/KRW", { exact: true })).toBeVisible();
    await expect(marketCard.getByText("Foreign flow", { exact: true })).toBeVisible();
    await expect(marketCard.getByText("Institutional flow", { exact: true })).toBeVisible();
    await expect(marketCard.getByText("2,742.31", { exact: true })).toBeVisible();
    await expect(marketCard.getByText("+18.42 (+0.68%)", { exact: true })).toBeVisible();
    await expect(marketCard.getByText("842.17", { exact: true })).toBeVisible();
    await expect(marketCard.getByText("-4.11 (-0.51%)", { exact: true })).toBeVisible();
    await expect(marketCard.getByText("1,378.20", { exact: true })).toBeVisible();
    await expect(marketCard.getByText("+₩248B net buy", { exact: true })).toBeVisible();
    await expect(marketCard.getByText("-₩91B net sell", { exact: true })).toBeVisible();
    await expect(marketCard.getByText("Constructive · Large caps leading", { exact: true })).toBeVisible();
    await expect(marketCard.getByText(/Piotroski pass|KIS risk pass|Risk watchlist/i)).toHaveCount(0);
    await expect(page.locator("#tracked-symbols")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Today's ledger recommendations/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Daily Data Fetch/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Filtering/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Piotroski/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /KIS Risk/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Ledger coverage notes/i })).toHaveCount(0);

    await expect(page.getByText(/Insight cockpit/i)).toBeVisible();
    await expect(page.locator('#dashboard-freshness [class*="supportingCopy"]')).toHaveCount(0);
    const deciderCard = page.locator("article").filter({ has: page.getByRole("heading", { name: /Decider recommendations/i }) });
    await expect(deciderCard).toHaveCount(1);
    await expect(deciderCard.getByText("Results", { exact: true })).toBeVisible();
    await expect(deciderCard.getByText("Market date", { exact: true })).toBeVisible();
    await expect(deciderCard.getByText("Action mix", { exact: true })).toBeVisible();
    await expect(deciderCard.getByText("Run", { exact: true })).toHaveCount(0);
    await expect(deciderCard.getByText("Errors", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Open the full My Symbols screen/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Open process monitor/i })).toBeVisible();

    const processDrawer = await openProcessMonitorDrawer(page);
    await expect(processDrawer.getByRole("heading", { name: /Daily Data Fetch/i })).toBeVisible();
    await expect(processDrawer.getByRole("heading", { name: /Filtering/i })).toBeVisible();
    await expect(processDrawer.getByRole("heading", { name: /Piotroski/i })).toBeVisible();
    await expect(processDrawer.getByRole("heading", { name: /KIS Risk/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Open the full Piotroski filter pass list/i })).toBeVisible();
    await expect(page.locator('[aria-label="Release version"]:visible')).toContainText(RELEASE_VERSION_LABEL);

    await expect(page.getByRole("heading", { name: /Layer sync events/i })).toHaveCount(0);
    await expect(page.getByText(/Real-Time Audit Feed/i)).toHaveCount(0);
    await expect(page.getByText(/Readiness and breadth/i)).toHaveCount(0);
    await expect(page.getByText(/Top movers/i)).toHaveCount(0);
    await expect(page.getByText(/Connection and timing/i)).toHaveCount(0);
    await expect(page.getByText(/Live Connection/i)).toHaveCount(0);
  });

  test("desktop process monitor expands as a floating overlay over dashboard context", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/dashboard");

    const processDrawer = await openProcessMonitorDrawer(page);
    const [viewport, drawerBox, freshnessPanelBox, backdropAlpha] = await Promise.all([
      page.viewportSize(),
      processDrawer.boundingBox(),
      page.locator("#dashboard-freshness").boundingBox(),
      processDrawer.evaluate((element) => {
        const backdrop = element.parentElement;
        const backgroundColor = backdrop ? window.getComputedStyle(backdrop).backgroundColor : "";
        const match = backgroundColor.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/);
        return match ? Number(match[1]) : 1;
      }),
    ]);

    expect(viewport).not.toBeNull();
    expect(drawerBox).not.toBeNull();
    expect(freshnessPanelBox).not.toBeNull();

    if (!viewport || !drawerBox || !freshnessPanelBox) {
      throw new Error("Expected process monitor and dashboard context to have layout boxes.");
    }

    expect(backdropAlpha).toBeLessThan(0.5);
    expect(drawerBox.y).toBeGreaterThan(72);
    expect(drawerBox.height).toBeLessThan(viewport.height - 72);
    expect(drawerBox.x).toBeGreaterThanOrEqual(freshnessPanelBox.x - 1);
    expect(drawerBox.width).toBeLessThanOrEqual(freshnessPanelBox.width + 1);
  });

  test("desktop process monitor drawer keeps detailed process cards grouped", async ({ page }) => {
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
            fundamentals: {
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
          action: {
            success: true,
            latest_date: "2026-04-15",
          },
          fundamentals: {
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
          status: "completed",
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
              status: "completed",
              processed: 3200,
              total: 3200,
              failed: 0,
            },
            fundamentals_daily_refresh: {
              status: "completed",
              processed: 3200,
              total: 3200,
              failed: 0,
            },
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
            entries: 3200,
            requested_symbol: null,
            matched_symbols: ["005930"],
            missing_symbols: [],
            passed_count: 128,
            not_passed_count: 3072,
          },
          items: [
            {
              symbol: "005930",
              market_date: "2026-04-15",
              passed_filter: true,
              piotroski_score: 8,
              passes_piotroski_score: true,
              captured_at: now,
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/eod/market-risk-filters?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-15",
          summary: {
            entries: 3200,
            requested_symbol: null,
            matched_symbols: ["005930"],
            missing_symbols: [],
            passed_count: 3000,
            watchlist_count: 120,
            failed_count: 200,
          },
          items: [],
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
            expected_agents: ["eod-summarizer", "technical-summarizer", "fundamental-summarizer"],
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
            completed_feedback_count: 3200,
            expected_feedback_count: 3200,
          },
          result: {
            roles: {
              "eod-summarizer": {
                requested_count: 3200,
                completed_count: 3200,
                error_count: 0,
              },
              "technical-summarizer": {
                requested_count: 3200,
                completed_count: 3200,
                error_count: 0,
              },
              "fundamental-summarizer": {
                requested_count: 3200,
                completed_count: 3200,
                error_count: 0,
              },
            },
          },
        }),
      });
    });

    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto("/dashboard");

    const freshnessPanel = page.locator("#dashboard-freshness");
    await expect(freshnessPanel.locator("article").filter({ hasText: "Daily Data Fetch" })).toHaveCount(0);
    await expect(freshnessPanel.locator("article").filter({ hasText: "Filtering" })).toHaveCount(0);
    await expect(freshnessPanel.locator("article").filter({ hasText: "Agent Feedback" })).toHaveCount(0);

    const processDrawer = await openProcessMonitorDrawer(page);
    const eodCard = processDrawer.locator("article").filter({ hasText: "Daily Data Fetch" });
    const filteringCard = processDrawer.locator("article").filter({ hasText: "Filtering" });
    const agentFeedbackCard = processDrawer.locator("article").filter({ hasText: "Agent Feedback" });

    await expect(eodCard).toBeVisible();
    await expect(filteringCard).toBeVisible();
    await expect(agentFeedbackCard).toBeVisible();
    await expect(processDrawer.getByRole("listitem", { name: /^Patch / })).toHaveCount(0);
    await expect(processDrawer.getByRole("listitem", { name: /^Filter / })).toHaveCount(0);
    await expect(processDrawer.getByRole("listitem", { name: /^Agent Feedback / })).toHaveCount(0);

    const [eodBox, filteringBox, agentFeedbackBox] = await Promise.all([
      eodCard.boundingBox(),
      filteringCard.boundingBox(),
      agentFeedbackCard.boundingBox(),
    ]);

    expect(eodBox).not.toBeNull();
    expect(filteringBox).not.toBeNull();
    expect(agentFeedbackBox).not.toBeNull();

    if (!eodBox || !filteringBox || !agentFeedbackBox) {
      throw new Error("Expected dashboard cards to have layout boxes.");
    }

    expect(Math.abs(eodBox.y - filteringBox.y)).toBeLessThan(24);
    expect(Math.abs(agentFeedbackBox.x - eodBox.x)).toBeLessThan(24);
    expect(agentFeedbackBox.y).toBeGreaterThan(eodBox.y + eodBox.height - 24);
    expect(agentFeedbackBox.width).toBeGreaterThan(filteringBox.width * 1.5);
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
      const requestUrl = new URL(route.request().url());

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: requestUrl.searchParams.get("market_date"),
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
    const eodStatusCard = await openEodStatusCard(page);
    const actionStage = eodStatusCard.locator('[aria-label="Action Summary freshness"]');
    const fundamentalsStage = eodStatusCard.locator('[aria-label="Fundamentals freshness"]');
    await expect(actionStage).toContainText(/Build Symbol Summary/i);
    await expect(actionStage).toContainText(/1,180 \/ 3,200/i);
    await expect(actionStage).toContainText(/Failed 12/i);
    await expectEodStageStatus(fundamentalsStage, "waiting");
    await expect(fundamentalsStage).not.toContainText(/Refresh Company Metrics/i);

    const runningActionPill = actionStage.locator('.pill[data-status-badge="running"]');
    const runningPillAnimations = await runningActionPill.evaluate((element) => {
      const spinner = element.querySelector('[aria-hidden="true"]');

      return {
        badgeSweep: getComputedStyle(element, "::after").animationName,
        spinner: spinner ? getComputedStyle(spinner).animationName : null,
      };
    });

    expect(runningPillAnimations.badgeSweep).toMatch(/eodRunningStatusSweep$/);
    expect(runningPillAnimations.spinner).toMatch(/agentRoleSpin$/);
  });

  test("dashboard filtering stays clean after removing the ledger recommendation card", async ({ page }) => {
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
    await page.route("**/api/trading/eod/market-risk-filters?**", async (route) => {
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
            watchlist_count: 1,
            failed_count: 1,
          },
          items: [],
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

    await expect(page.locator("#tracked-symbols")).toHaveCount(0);
    await expect(page.getByText("Acme Precision")).toHaveCount(0);

    const processDrawer = await openProcessMonitorDrawer(page);
    const filteringCard = processDrawer.locator("article").filter({ hasText: "Filtering" });
    const piotroskiSection = filteringCard.locator('[data-filter-stage="piotroski"]');
    const marketRiskSection = filteringCard.locator('[data-filter-stage="kis-risk"]');
    await expect(piotroskiSection).toContainText("Piotroski");
    await expect(piotroskiSection).toContainText("Completed");
    await expect(piotroskiSection).not.toContainText(/Market date\s*2026-04-15/);
    await expect(processDrawer.getByLabel("Patch date")).toContainText("2026-04-15");
    await expect(piotroskiSection).toContainText(/Filtered\s*1/);
    await expect(piotroskiSection).not.toContainText(/Checked|Not pass/);
    await expect(marketRiskSection).toContainText("KIS Risk");
    await expect(marketRiskSection).toContainText(/Filtered\s*1/);
    await expect(marketRiskSection).not.toContainText(/Watchlist|Fail/);
    await expect(filteringCard).toContainText(/Final filtered symbols\s*1/);
    await expect(filteringCard).not.toContainText("Requested");

    expect(searchRequests).toEqual([]);
  });

  test("D2 Filtering More opens the full pass list and rows navigate to the symbol detail page", async ({ page }) => {
    const now = "2026-04-16T09:10:00+09:00";
    const piotroskiRequestedMarketDates: string[] = [];

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
              trade_date: "2026-04-16",
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
              trade_date: "2026-04-16",
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
          trade_date: "2026-04-16",
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
          trade_date: "2026-04-16",
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
          trade_date: "2026-04-16",
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
          trade_date: "2026-04-16",
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
            trade_date: "2026-04-16",
            eod_status: "completed",
            symbols_total: 4,
            symbols_succeeded: 4,
            symbols_failed: 0,
          },
          latest: {
            price_trade_date: "2026-04-16",
            technical_market_date: "2026-04-16",
            action_market_date: "2026-04-16",
          },
          technical: {
            success: true,
            latest_date: "2026-04-16",
          },
        }),
      });
    });
    await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const requestedMarketDate = requestUrl.searchParams.get("market_date");
      piotroskiRequestedMarketDates.push(requestedMarketDate ?? "");

      const effectiveMarketDate = "2026-04-15";
      const isLatestFallback = requestedMarketDate === "2026-04-16";

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          requested_market_date: requestedMarketDate,
          resolved_market_date: effectiveMarketDate,
          is_latest_fallback: isLatestFallback,
          market_date: effectiveMarketDate,
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
    await page.route("**/api/trading/eod/market-risk-filters?**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const requestedMarketDate = requestUrl.searchParams.get("market_date");
      const effectiveMarketDate = "2026-04-15";
      const isLatestFallback = requestedMarketDate === "2026-04-16";

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          requested_market_date: requestedMarketDate,
          resolved_market_date: effectiveMarketDate,
          is_latest_fallback: isLatestFallback,
          market_date: effectiveMarketDate,
          summary: {
            entries: 4,
            requested_symbol: null,
            matched_symbols: ["000660", "005930", "005380", "035420"],
            missing_symbols: [],
            passed_count: 3,
            watchlist_count: 1,
            failed_count: 1,
          },
          items: [],
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

    const processDrawer = await openProcessMonitorDrawer(page);
    const filteringCard = processDrawer.locator("article").filter({ hasText: "Filtering" });
    const piotroskiSection = filteringCard.locator('[data-filter-stage="piotroski"]');
    const marketRiskSection = filteringCard.locator('[data-filter-stage="kis-risk"]');
    await expect.poll(() => piotroskiRequestedMarketDates.includes("2026-04-16")).toBe(true);
    await expect(piotroskiSection).toContainText("Completed");
    await expect(piotroskiSection).toContainText(/Market date\s*2026-04-15/);
    await expect(processDrawer.getByLabel("Patch date")).toContainText("2026-04-16");
    await expect(piotroskiSection).toContainText(/Filtered\s*4/);
    await expect(piotroskiSection).not.toContainText(/Checked|Not pass/);
    await expect(piotroskiSection).toContainText("Requested 2026-04-16");
    await expect(piotroskiSection).toContainText("Latest available 2026-04-15");
    await expect(marketRiskSection).toContainText(/Filtered\s*3/);
    await expect(marketRiskSection).not.toContainText(/Watchlist|Fail/);
    await expect(marketRiskSection).toContainText("Requested 2026-04-16");
    await expect(filteringCard).toContainText(/Final filtered symbols\s*3/);

    await filteringCard
      .getByRole("link", { name: /Open the full Piotroski filter pass list/i })
      .click();

    await expect(page).toHaveURL(/\/dashboard\/piotroski-filter\?marketDate=2026-04-15$/);
    await expect(page.getByRole("heading", { name: /Piotroski filter pass list/i })).toBeVisible();
    await expect(page.getByText(/Showing passed symbols for 2026-04-15/)).toBeVisible();
    await expect(page.getByText(/Requested 2026-04-16/)).toHaveCount(0);

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
    expect(piotroskiRequestedMarketDates).toContain("2026-04-15");
    await expect(page.getByRole("heading", { name: "SK hynix" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Swipe-aware candlestick chart/i })).toBeVisible();
  });

  test("D2 Filtering revalidates a same-day Piotroski fallback once real same-day results arrive", async ({ page }) => {
    const now = "2026-04-27T10:15:00+09:00";
    let piotroskiRequestCount = 0;
    let marketRiskRequestCount = 0;
    let releaseSameDayResults: () => void = () => {};
    const sameDayResultsReady = new Promise<void>((resolve) => {
      releaseSameDayResults = resolve;
    });

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
              change: 900,
              change_pct: 1.27,
              volume: 120000,
              turnover: 8580000000,
              as_of: now,
              market_state: "OPEN",
              source: "daily_price_bar",
              fallback: true,
              is_live: false,
              available: true,
              trade_date: "2026-04-27",
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
            trade_date: "2026-04-27",
            price: {
              status: "ready",
              symbols_total: 3583,
              symbols_succeeded: 3583,
              symbols_failed: 0,
            },
            technical_analysis: {
              status: "ready",
              symbols_total: 3583,
              symbols_succeeded: 3583,
              symbols_failed: 0,
            },
            action_summary: {
              status: "ready",
              symbols_total: 3583,
              symbols_succeeded: 3583,
              symbols_failed: 0,
            },
            fundamentals: {
              status: "running",
              symbols_total: 3583,
              symbols_succeeded: 2400,
              symbols_failed: 0,
            },
          },
          latest: {
            price_trade_date: "2026-04-27",
            technical_market_date: "2026-04-27",
            action_market_date: "2026-04-27",
          },
          technical: {
            success: true,
            latest_date: "2026-04-27",
          },
          action: {
            success: true,
            latest_date: "2026-04-27",
          },
          fundamentals: {
            success: true,
            latest_date: "2026-04-27",
          },
        }),
      });
    });
    await page.route("**/api/trading/eod/pipeline/status?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-27",
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
              processed: 3583,
              total: 3583,
              failed: 0,
            },
            technical_snapshots: {
              status: "completed",
              processed: 3583,
              total: 3583,
              failed: 0,
            },
            action_summaries: {
              status: "completed",
              processed: 3583,
              total: 3583,
              failed: 0,
            },
            fundamentals_daily_refresh: {
              status: "running",
              processed: 2400,
              total: 3583,
              failed: 0,
            },
          },
        }),
      });
    });
    await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
      const requestedMarketDate = new URL(route.request().url()).searchParams.get("market_date") ?? "2026-04-27";

      if (requestedMarketDate !== "2026-04-27") {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            requested_market_date: requestedMarketDate,
            resolved_market_date: requestedMarketDate,
            is_latest_fallback: false,
            market_date: requestedMarketDate,
            summary: {
              entries: 0,
              requested_symbol: null,
              matched_symbols: [],
              missing_symbols: [],
              passed_count: 0,
              not_passed_count: 0,
            },
            items: [],
          }),
        });
        return;
      }

      piotroskiRequestCount += 1;

      if (piotroskiRequestCount === 1) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            requested_market_date: "2026-04-27",
            resolved_market_date: "2026-04-24",
            is_latest_fallback: true,
            market_date: "2026-04-24",
            summary: {
              entries: 3200,
              requested_symbol: null,
              matched_symbols: ["005930"],
              missing_symbols: [],
              passed_count: 14,
              not_passed_count: 3186,
            },
            items: [],
          }),
        });
        return;
      }

      await sameDayResultsReady;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          requested_market_date: "2026-04-27",
          resolved_market_date: "2026-04-27",
          is_latest_fallback: false,
          market_date: "2026-04-27",
          summary: {
            entries: 3583,
            requested_symbol: null,
            matched_symbols: ["005930"],
            missing_symbols: [],
            passed_count: 27,
            not_passed_count: 3556,
          },
          items: [],
        }),
      });
    });
    await page.route("**/api/trading/eod/market-risk-filters?**", async (route) => {
      const requestedMarketDate = new URL(route.request().url()).searchParams.get("market_date") ?? "2026-04-27";

      if (requestedMarketDate !== "2026-04-27") {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            requested_market_date: requestedMarketDate,
            resolved_market_date: requestedMarketDate,
            is_latest_fallback: false,
            market_date: requestedMarketDate,
            summary: {
              entries: 0,
              requested_symbol: null,
              matched_symbols: [],
              missing_symbols: [],
              passed_count: 0,
              watchlist_count: 0,
              failed_count: 0,
            },
            items: [],
          }),
        });
        return;
      }

      marketRiskRequestCount += 1;

      if (marketRiskRequestCount === 1) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            requested_market_date: "2026-04-27",
            resolved_market_date: "2026-04-24",
            is_latest_fallback: true,
            market_date: "2026-04-24",
            summary: {
              entries: 3200,
              requested_symbol: null,
              matched_symbols: ["005930"],
              missing_symbols: [],
              passed_count: 3000,
              watchlist_count: 100,
              failed_count: 100,
            },
            items: [],
          }),
        });
        return;
      }

      await sameDayResultsReady;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          requested_market_date: "2026-04-27",
          resolved_market_date: "2026-04-27",
          is_latest_fallback: false,
          market_date: "2026-04-27",
          summary: {
            entries: 3583,
            requested_symbol: null,
            matched_symbols: ["005930"],
            missing_symbols: [],
            passed_count: 3300,
            watchlist_count: 150,
            failed_count: 133,
          },
          items: [],
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: {
            id: 17,
            market_date: "2026-04-27",
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
            symbols_refreshed: 2400,
            symbols_failed: 0,
            events_detected: 0,
            events_captured: 0,
            events_failed: 0,
            error_message: null,
            run_metadata: {},
            started_at: "2026-04-27T09:30:00+09:00",
            completed_at: null,
          },
          runs: [],
        }),
      });
    });
    await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: "2026-04-27",
            symbols: null,
            expected_agents: [],
          },
          summary: {
            run_id: "run-364",
            run_status: "completed",
            run_table_status: "completed",
            is_live: false,
            run_started_at: "2026-04-27T09:30:00+09:00",
            run_completed_at: "2026-04-27T10:00:00+09:00",
            latest_feedback_at: "2026-04-27T10:00:00+09:00",
            seconds_since_last_feedback: 900,
            stalled_threshold_seconds: 300,
            total_symbols: 3583,
            processed_symbols: 3583,
            completed_symbols: 3583,
            in_progress_symbols: 0,
            pending_symbols: 0,
            progress_ratio: 1,
            progress_percent: 100,
            failed_items: 0,
            completed_feedback_count: 0,
            expected_feedback_count: 0,
          },
          result: null,
        }),
      });
    });

    await page.goto("/dashboard");

    const processDrawer = await openProcessMonitorDrawer(page);
    const filteringCard = processDrawer.locator("article").filter({ hasText: "Filtering" });
    const piotroskiSection = filteringCard.locator('[data-filter-stage="piotroski"]');
    const marketRiskSection = filteringCard.locator('[data-filter-stage="kis-risk"]');

    await expect(piotroskiSection).toContainText(/Market date\s*2026-04-24/);
    await expect(piotroskiSection).toContainText("Requested 2026-04-27");
    await expect(piotroskiSection).toContainText("Latest available 2026-04-24");
    await expect(piotroskiSection).toContainText(/Filtered\s*14/);
    await expect(marketRiskSection).toContainText("Requested 2026-04-27");

    releaseSameDayResults();
    await expect.poll(() => piotroskiRequestCount, { timeout: 9000 }).toBeGreaterThanOrEqual(2);
    await expect.poll(() => marketRiskRequestCount, { timeout: 9000 }).toBeGreaterThanOrEqual(2);

    await expect(piotroskiSection).not.toContainText(/Market date\s*2026-04-27/);
    await expect(piotroskiSection).toContainText(/Filtered\s*27/);
    await expect(piotroskiSection).not.toContainText("Latest available 2026-04-24");
    await expect(piotroskiSection).not.toContainText("Requested 2026-04-27");
    await expect(marketRiskSection).not.toContainText(/Market date\s*2026-04-27/);
    await expect(marketRiskSection).not.toContainText("Latest available 2026-04-24");

    const piotroskiRequestsAfterResolve = piotroskiRequestCount;
    const marketRiskRequestsAfterResolve = marketRiskRequestCount;
    await page.waitForTimeout(5500);

    expect(piotroskiRequestCount).toBe(piotroskiRequestsAfterResolve);
    expect(marketRiskRequestCount).toBe(marketRiskRequestsAfterResolve);
  });

  test("D2 EOD status keeps ready stale latest dates synced and missing stages not synced", async ({ page }) => {
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
              status: "missing",
              symbols_total: 250,
              symbols_succeeded: 0,
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

    const processDrawer = await openProcessMonitorDrawer(page);
    const eodStatusCard = processDrawer.locator("article").filter({ hasText: "EOD Status" });
    await expect(eodStatusCard).toBeVisible();
    await expect(eodStatusCard.getByText("Current market date")).toHaveCount(0);

    const priceStage = page.locator('[aria-label="Price Fetch freshness"]');
    await expectEodStageStatus(priceStage, "synced");
    await expect(priceStage).toContainText("237 / 250");
    await expect(priceStage).not.toContainText("Succeeded");
    await expect(priceStage).toContainText(/Failed\s*13/);
    await expect(priceStage.getByText("Latest date")).toHaveCount(0);

    const technicalStage = page.locator('[aria-label="Technical Analysis freshness"]');
    await expectEodStageStatus(technicalStage, "synced");
    await expect(technicalStage).toContainText("250 / 250");
    await expect(technicalStage).not.toContainText("Succeeded");
    await expect(technicalStage).toContainText(/Latest date\s*2026-04-16/);

    const actionStage = page.locator('[aria-label="Action Summary freshness"]');
    await expectEodStageStatus(actionStage, "not synced");
    await expect(actionStage).toContainText(/Failed\s*2/);
    await expect(actionStage).toContainText(/Latest date\s*2026-04-14/);

    const fundamentalsStage = page.locator('[aria-label="Fundamentals freshness"]');
    await expectEodStageStatus(fundamentalsStage, "synced");
    await expect(fundamentalsStage).toContainText(/Checked\s*42/);
    await expect(fundamentalsStage).toContainText(/Failed\s*1/);
  });

  test("D2 cards keep the daily market date semantics while resolving status from the latest pipeline market date", async ({
    page,
  }) => {
    let pipelineRequestedMarketDate: string | null = null;
    let fundamentalsRequestedMarketDate: string | null = null;
    let piotroskiRequestedMarketDate: string | null = null;

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
            technical_market_date: "2026-04-15",
            action_market_date: "2026-04-15",
          },
        }),
      });
    });
    await page.route("**/api/trading/eod/pipeline/status?**", async (route) => {
      const requestUrl = new URL(route.request().url());
      pipelineRequestedMarketDate = requestUrl.searchParams.get("market_date");

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-15",
          status: "completed",
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
              processed: 250,
              total: 250,
              failed: 0,
            },
            technical_snapshots: {
              status: "completed",
              processed: 250,
              total: 250,
              failed: 0,
            },
            action_summaries: {
              status: "completed",
              processed: 250,
              total: 250,
              failed: 0,
            },
            fundamentals_daily_refresh: {
              status: "completed",
              processed: 42,
              total: 42,
              failed: 0,
            },
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      const requestUrl = new URL(route.request().url());
      fundamentalsRequestedMarketDate = requestUrl.searchParams.get("market_date");

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: {
            id: 7,
            market_date: "2026-04-15",
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
            started_at: "2026-04-15T08:56:58.357390+09:00",
            completed_at: "2026-04-15T09:11:08.375335+09:00",
          },
          runs: [],
        }),
      });
    });
    await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
      const requestUrl = new URL(route.request().url());
      piotroskiRequestedMarketDate = requestUrl.searchParams.get("market_date");

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-15",
          summary: {
            entries: 2,
            requested_symbol: null,
            matched_symbols: ["005930", "000660"],
            missing_symbols: [],
            passed_count: 1,
            not_passed_count: 1,
          },
          items: [
            {
              symbol: "005930",
              market_date: "2026-04-15",
              passed_filter: true,
              piotroski_score: 8,
              passes_piotroski_score: true,
              captured_at: "2026-04-15T09:11:08.375335+09:00",
            },
            {
              symbol: "000660",
              market_date: "2026-04-15",
              passed_filter: false,
              piotroski_score: 5,
              passes_piotroski_score: false,
              captured_at: "2026-04-15T09:11:08.375335+09:00",
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/eod/market-risk-filters?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-15",
          summary: {
            entries: 2,
            requested_symbol: null,
            matched_symbols: ["005930", "000660"],
            missing_symbols: [],
            passed_count: 1,
            watchlist_count: 1,
            failed_count: 1,
          },
          items: [],
        }),
      });
    });
    await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
      const requestUrl = new URL(route.request().url());

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: requestUrl.searchParams.get("market_date"),
            symbols: null,
            expected_agents: [],
          },
          summary: {
            run_status: "completed",
            is_live: false,
            latest_feedback_at: "2026-04-15T10:18:00+09:00",
            seconds_since_last_feedback: 15,
            stalled_threshold_seconds: 300,
            total_symbols: 250,
            processed_symbols: 250,
            completed_symbols: 250,
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

    await expect.poll(() => pipelineRequestedMarketDate).toBe("2026-04-16");
    await expect.poll(() => fundamentalsRequestedMarketDate).toBe("2026-04-15");
    await expect.poll(() => piotroskiRequestedMarketDate).toBe("2026-04-15");

    const processDrawer = await openProcessMonitorDrawer(page);
    const eodStatusCard = processDrawer.locator("article").filter({ hasText: "EOD Status" });
    await expect(eodStatusCard.getByText("Current market date")).toHaveCount(0);
    await expectEodStageStatus(page.locator('[aria-label="Price Fetch freshness"]'), "synced");
    await expectEodStageStatus(page.locator('[aria-label="Technical Analysis freshness"]'), "synced");
    await expectEodStageStatus(page.locator('[aria-label="Action Summary freshness"]'), "synced");
    await expectEodStageStatus(page.locator('[aria-label="Fundamentals freshness"]'), "synced");

    const filteringCard = processDrawer.locator("article").filter({ hasText: "Filtering" });
    const piotroskiSection = filteringCard.locator('[data-filter-stage="piotroski"]');
    const marketRiskSection = filteringCard.locator('[data-filter-stage="kis-risk"]');
    await expect(piotroskiSection).not.toContainText(/Market date\s*2026-04-15/);
    await expect(processDrawer.getByLabel("Patch date")).toContainText("2026-04-15");
    await expect(piotroskiSection).toContainText("Completed");
    await expect(piotroskiSection).toContainText(/Filtered\s*1/);
    await expect(piotroskiSection).not.toContainText(/Checked|Not pass/);
    await expect(marketRiskSection).toContainText(/Filtered\s*1/);
    await expect(marketRiskSection).not.toContainText(/Watchlist|Fail/);
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

    const processDrawer = await openProcessMonitorDrawer(page);
    const eodStatusCard = processDrawer.locator("article").filter({ hasText: "EOD Status" });
    await expect(eodStatusCard).toBeVisible();
    await expect(eodStatusCard.getByText("Current market date")).toHaveCount(0);

    const priceStage = page.locator('[aria-label="Price Fetch freshness"]');
    await expectEodStageStatus(priceStage, "break day");
    await expect(priceStage.getByText("Latest date")).toHaveCount(0);

    const technicalStage = page.locator('[aria-label="Technical Analysis freshness"]');
    await expectEodStageStatus(technicalStage, "break day");
    await expect(technicalStage.getByText("Latest date")).toHaveCount(0);

    const actionStage = page.locator('[aria-label="Action Summary freshness"]');
    await expectEodStageStatus(actionStage, "not synced");
    await expect(actionStage.getByText("Latest date")).toHaveCount(0);

    const fundamentalsStage = page.locator('[aria-label="Fundamentals freshness"]');
    await expectEodStageStatus(fundamentalsStage, "break day");
    await expect(fundamentalsStage.getByText("Latest date")).toHaveCount(0);
  });

  test("D2 EOD status keeps missing weekend stages as not synced while fundamentals retains latest coverage", async ({
    page,
  }) => {
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

    const processDrawer = await openProcessMonitorDrawer(page);
    const eodStatusCard = processDrawer.locator("article").filter({ hasText: "EOD Status" });
    await expect(eodStatusCard).toBeVisible();

    const priceStage = page.locator('[aria-label="Price Fetch freshness"]');
    await expectEodStageStatus(priceStage, "not synced");

    const technicalStage = page.locator('[aria-label="Technical Analysis freshness"]');
    await expectEodStageStatus(technicalStage, "not synced");
    await expect(technicalStage.getByText("Latest date")).toHaveCount(0);

    const actionStage = page.locator('[aria-label="Action Summary freshness"]');
    await expectEodStageStatus(actionStage, "not synced");

    const fundamentalsStage = page.locator('[aria-label="Fundamentals freshness"]');
    await expectEodStageStatus(fundamentalsStage, "break day");
    await expect(fundamentalsStage).toContainText(/Checked\s*42/);
    await expect(fundamentalsStage.getByText("Latest date")).toHaveCount(0);
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

    const processDrawer = await openProcessMonitorDrawer(page);
    const eodStatusCard = processDrawer.locator("article").filter({ hasText: "EOD Status" });
    await expect(eodStatusCard).toBeVisible();
    const priceStage = page.locator('[aria-label="Price Fetch freshness"]');
    const technicalStage = page.locator('[aria-label="Technical Analysis freshness"]');
    await expectEodStageStatus(priceStage, "running");
    await expect(priceStage).toContainText("80 / 250");
    await expect(priceStage).not.toContainText("Progress");
    await expectEodStageStatus(technicalStage, "running");
    await expect(technicalStage).toContainText("0 / 250");
    await expect(technicalStage).not.toContainText("Progress");
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

    const processDrawer = await openProcessMonitorDrawer(page);
    const eodStatusCard = processDrawer.locator("article").filter({ hasText: "EOD Status" });
    await expect(eodStatusCard).toBeVisible();
    await expect(eodStatusCard.getByText("Current market date")).toHaveCount(0);
    await expectEodStageStatus(page.locator('[aria-label="Price Fetch freshness"]'), "not synced");
    await expect(page.locator('[aria-label="Price Fetch freshness"]')).toContainText("250 / 250");
    await expect(page.locator('[aria-label="Price Fetch freshness"]')).not.toContainText("Succeeded");
    await expect(eodStatusCard.getByText("Freshness available")).toHaveCount(0);
  });

  test("D2 EOD status keeps stage freshness details and omits the latest patch card", async ({ page }) => {
    const now = "2026-04-24T09:20:00+09:00";
    let requestedMarketDate: string | null = null;

    await page.route("**/api/trading/market/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market: "KRX",
          state: "OPEN",
          is_trading_day: true,
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
              price: 71900,
              change: 500,
              change_pct: 0.7,
              volume: 120000,
              turnover: 8580000000,
              as_of: now,
              market_state: "OPEN",
              source: "daily_price_bar",
              fallback: true,
              is_live: false,
              available: true,
              trade_date: "2026-04-24",
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
            trade_date: "2026-04-24",
            price: {
              status: "missing",
              symbols_total: 3577,
              symbols_succeeded: 0,
              symbols_failed: 0,
            },
            technical_analysis: {
              status: "missing",
              symbols_total: 3577,
              symbols_succeeded: 0,
              symbols_failed: 0,
            },
            action_summary: {
              status: "missing",
              symbols_total: 3577,
              symbols_succeeded: 0,
              symbols_failed: 0,
            },
            fundamentals: {
              status: "missing",
              symbols_total: 3577,
              symbols_succeeded: 0,
              symbols_failed: 0,
            },
          },
          latest: {
            technical_market_date: "2026-04-23",
            action_market_date: "2026-04-23",
            summary: {
              trade_date: "2026-04-23",
              updated_at: "2026-04-23T16:31:55+09:00",
              status: "completed_with_errors",
              symbols_total: 3577,
              symbols_succeeded: 3570,
              symbols_failed: 7,
            },
            stages: {
              price: {
                trade_date: "2026-04-23",
                updated_at: "2026-04-23T16:31:55+09:00",
                status: "completed_with_errors",
                symbols_total: 3577,
                symbols_succeeded: 3570,
                symbols_failed: 7,
              },
              technical: {
                summary: {
                  market_date: "2026-04-23",
                  updated_at: "2026-04-23T16:38:00+09:00",
                  status: "completed",
                  symbols_total: 3577,
                  symbols_succeeded: 3577,
                  symbols_failed: 0,
                },
              },
            },
          },
          technical: {
            success: true,
            latest_date: "2026-04-23",
          },
          action: {
            success: true,
            latest_date: "2026-04-23",
          },
          fundamentals: {
            success: true,
            latest_date: "2026-04-23",
          },
        }),
      });
    });
    await page.route("**/api/trading/eod/pipeline/status?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-23",
          status: "completed",
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
              processed: 3577,
              total: 3577,
              failed: 7,
            },
            technical_snapshots: {
              status: "completed",
              processed: 3577,
              total: 3577,
              failed: 0,
            },
            action_summaries: {
              status: "completed",
              processed: 3577,
              total: 3577,
              failed: 0,
            },
            fundamentals_daily_refresh: {
              status: "completed",
              processed: 3577,
              total: 3577,
              failed: 0,
            },
          },
        }),
      });
    });
    await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-23",
          summary: {
            entries: 3577,
            requested_symbol: null,
            matched_symbols: ["005930"],
            missing_symbols: [],
            passed_count: 132,
            not_passed_count: 3445,
          },
          items: [],
        }),
      });
    });
    await page.route("**/api/trading/eod/market-risk-filters?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-23",
          summary: {
            entries: 3577,
            requested_symbol: null,
            matched_symbols: ["005930"],
            missing_symbols: [],
            passed_count: 3200,
            watchlist_count: 180,
            failed_count: 377,
          },
          items: [],
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: {
            id: 11,
            market_date: "2026-04-23",
            trigger: "internal_ops_cli",
            status: "completed",
            fs_div: "CFS",
            force: false,
            symbol_limit: null,
            symbol_offset: 0,
            symbols_total: 3577,
            symbols_checked: 3577,
            symbols_missing: 0,
            symbols_stale: 0,
            symbols_fresh: 3577,
            symbols_refreshed: 3577,
            symbols_failed: 0,
            events_detected: 0,
            events_captured: 0,
            events_failed: 0,
            error_message: null,
            run_metadata: {},
            started_at: "2026-04-23T16:00:00+09:00",
            completed_at: "2026-04-23T16:40:00+09:00",
          },
          runs: [],
        }),
      });
    });
    await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
      requestedMarketDate = new URL(route.request().url()).searchParams.get("market_date");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: "2026-04-23",
            expected_agents: ["eod-summarizer", "technical-summarizer", "fundamental-summarizer"],
          },
          summary: {
            run_status: "completed",
            is_live: false,
            progress_percent: 100,
            total_symbols: 3577,
            completed_symbols: 3577,
            failed_items: 0,
            current_role: null,
          },
          result: {
            roles: {
              "eod-summarizer": {
                requested_count: 3577,
                completed_count: 3577,
                error_count: 0,
              },
            },
          },
        }),
      });
    });

    await page.goto("/dashboard");

    const processDrawer = await openProcessMonitorDrawer(page);
    const eodStatusCard = processDrawer.locator("article").filter({ hasText: "EOD Status" });
    const priceStage = page.locator('[aria-label="Price Fetch freshness"]');
    const technicalStage = page.locator('[aria-label="Technical Analysis freshness"]');
    const actionStage = page.locator('[aria-label="Action Summary freshness"]');
    const fundamentalsStage = page.locator('[aria-label="Fundamentals freshness"]');

    await expect(eodStatusCard).toBeVisible();
    await expect(eodStatusCard.getByText("Current market date")).toHaveCount(0);
    await expect(eodStatusCard.getByText("Latest EOD patch")).toHaveCount(0);
    await expect(processDrawer.getByLabel("Patch date")).toContainText("2026-04-23");
    await expectEodStageStatus(priceStage, "synced");
    await expectEodStageStatus(technicalStage, "synced");
    await expectEodStageStatus(actionStage, "synced");
    await expectEodStageStatus(fundamentalsStage, "synced");
    await expect(priceStage).toContainText("3,577 / 3,577");
    await expect(priceStage).toContainText("Failed 7");
    await expect(technicalStage).toContainText("3,577 / 3,577");
    await expect(technicalStage).not.toContainText("Failed 7");
    await expect(actionStage).toContainText("3,577 / 3,577");
    await expect(actionStage).not.toContainText("Failed 7");
    await expect(fundamentalsStage).toContainText("Checked 3,577");

    await expect.poll(() => requestedMarketDate).toBe("2026-04-23");
  });

  test("D2 agent feedback progress uses the latest price trade date and preserves backend role order", async ({
    page,
  }) => {
    const marketDateLabel = /(?:Market date|기준일) 2026-04-15/;
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
    let agentProgressResult: Record<string, unknown> | null = null;
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
          ...(agentProgressResult
            ? {
                role_progress: {
                  "eod-summarizer": {
                    processed_symbols: 250,
                    completed_symbols: 250,
                    error_count: 0,
                    progress_percent: 100,
                    status: "running",
                  },
                  "technical-summarizer": {
                    processed_symbols: 250,
                    completed_symbols: 250,
                    error_count: 0,
                    progress_percent: 100,
                    status: "running",
                  },
                  "fundamental-summarizer": {
                    processed_symbols: 250,
                    completed_symbols: 250,
                    error_count: 0,
                    progress_percent: 100,
                    status: "running",
                  },
                },
                result: agentProgressResult,
              }
            : {}),
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
    await expect(page.getByRole("banner").getByText("Market Open")).toBeVisible();

    const processDrawer = await openProcessMonitorDrawer(page);
    const progressCard = processDrawer.locator("article").filter({ hasText: "Agent Feedback" });
    const stopButton = progressCard.getByRole("button", { name: agentFeedbackStopButtonLabel });
    await expect(progressCard).toBeVisible();
    await expect(progressCard).not.toContainText("Latest Run");
    await expect(progressCard).toContainText(agentReviewRunningLabel);
    await expect(stopButton).toBeVisible();
    await stopButton.click();
    const stopDialog = page.getByRole("dialog", { name: agentFeedbackStopDialogLabel });
    await expect(stopDialog).toBeVisible();
    await expect(stopDialog.getByRole("button", { name: /close/i })).toHaveCount(0);
    await expect(stopDialog).not.toContainText("실제 중단 동작은 추후 연결할 예정입니다.");
    await stopDialog.getByRole("button", { name: noLabel }).click();
    await expect(stopDialog).toHaveCount(0);
    expect(stopControlRequestBody).toBeNull();
    await stopButton.click();
    await expect(stopDialog).toBeVisible();
    await stopDialog.getByRole("button", { name: yesLabel }).click();
    await expect.poll(() => JSON.stringify(stopControlRequestBody)).toBe(
      JSON.stringify({
        action: "kill",
        signal_name: "SIGKILL",
        port: 8000,
      }),
    );
    await expect(stopDialog).toHaveCount(0);
    await expect(progressCard).not.toContainText(marketDateLabel);
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
    await expect(activeTechnicalRole).toContainText(/(?:Progress|진행률)\s*50\.40%/);
    await expect(activeTechnicalRole).toContainText(/(?:Total|전체 대상)\s*250(?:개)?/);
    await expect(activeTechnicalRole).toContainText(/(?:Failed|실패)\s*3(?:개)?/);
    await expect(activeTechnicalRole).toContainText(/(?:Completed|완료)\s*126(?:개)?/);
    await expect(activeTechnicalRole).not.toContainText("무응답 경과");
    await expect(activeTechnicalRole).not.toContainText("마지막 적재");
    await expect(progressCard.locator("[data-role-icon]")).toHaveCount(0);
    await expect(progressCard.locator("[data-role-progress-icon]")).toHaveCount(3);
    await expect(activeTechnicalRole.locator('[data-role-progress-icon="running"]')).toBeVisible();
    await expect(progressCard.getByRole("progressbar")).toHaveCount(3);
    await expect(progressCard.getByRole("progressbar", { name: "EOD summarizer progress" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    await expect(progressCard.getByRole("progressbar", { name: "Technical summarizer progress" })).toHaveAttribute(
      "aria-valuenow",
      "50.4",
    );
    await expect(progressCard.getByRole("progressbar", { name: "Technical summarizer progress" })).toHaveAttribute(
      "aria-valuetext",
      "50.40%",
    );
    await expect(progressCard.getByRole("progressbar", { name: "Fundamental summarizer progress" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    const activeRoleTitle = activeTechnicalRole.getByText("Technical summarizer", { exact: true });
    const activeRoleTitleBox = await activeRoleTitle.boundingBox();
    const activeRoleIcon = activeTechnicalRole.locator('[data-role-progress-icon="running"]');
    const activeRoleIconBox = await activeRoleIcon.boundingBox();

    expect(activeRoleTitleBox).not.toBeNull();
    expect(activeRoleIconBox).not.toBeNull();
    expect(activeRoleIconBox!.width).toBeLessThanOrEqual(22);
    expect(activeRoleTitleBox!.x + activeRoleTitleBox!.width).toBeLessThanOrEqual(activeRoleIconBox!.x + 1);

    const activeRoleProgress = activeTechnicalRole.getByRole("progressbar", {
      name: /Technical summarizer progress/i,
    });
    const activeRoleProgressBox = await activeRoleProgress.boundingBox();

    expect(activeRoleProgressBox).not.toBeNull();
    expect(activeRoleProgressBox!.width).toBeGreaterThan(40);
    expect(activeRoleTitleBox!.y + activeRoleTitleBox!.height).toBeLessThanOrEqual(activeRoleProgressBox!.y + 1);
    await expect(activeTechnicalRole).not.toContainText("EOD 확인");
    await expect(
      progressCard.locator('[data-role-status="pending"]').filter({ hasText: "Fundamental summarizer" }),
    ).toBeVisible();
    await expect(roleRows.nth(0)).not.toContainText("진행률");
    await expect(roleRows.nth(1)).not.toContainText("진행률");
    await expect(roleRows.nth(3)).not.toContainText("진행률");
    await expect.poll(() => progressRequestCount, { timeout: 2500 }).toBeGreaterThanOrEqual(2);

    async function reloadAndExpectAgentStatus(expectedLabel: RegExp) {
      const previousProgressRequestCount = progressRequestCount;
      await page.reload();
      await expect.poll(() => progressRequestCount).toBeGreaterThan(previousProgressRequestCount);
      await openProcessMonitorDrawer(page);
      await expect(progressCard).toContainText(expectedLabel);
    }

    async function reloadAndExpectAgentCompletedHeader() {
      const previousProgressRequestCount = progressRequestCount;
      await page.reload();
      await expect.poll(() => progressRequestCount).toBeGreaterThan(previousProgressRequestCount);
      await openProcessMonitorDrawer(page);
      await expect(progressCard).toContainText(agentReviewCompletedLabel);
      await expect(progressCard.getByRole("img", { name: agentReviewCompletedLabel })).toHaveCount(0);

      const titleBox = await progressCard.getByRole("heading", { name: "Agent Feedback" }).boundingBox();
      const statusBox = await progressCard
        .getByText(agentReviewCompletedLabel, { exact: true })
        .boundingBox();

      expect(titleBox).not.toBeNull();
      expect(statusBox).not.toBeNull();
      expect(titleBox!.x + titleBox!.width).toBeLessThanOrEqual(statusBox!.x + 1);
    }

    agentProgressSummary = {
      ...agentProgressSummary,
      run_status: "legacy-running",
      is_live: true,
      failed_items: 3,
      latest_feedback_at: "2026-04-15T10:19:55+09:00",
      seconds_since_last_feedback: 5,
    };
    await reloadAndExpectAgentStatus(agentReviewRunningLabel);
    await expect(progressCard).not.toContainText(agentReviewNeedsAttentionLabel);
    await expect(stopButton).toBeVisible();

    agentProgressSummary = {
      ...agentProgressSummary,
      run_status: "stalled",
      is_live: true,
      failed_items: 0,
      latest_feedback_at: "2026-04-15T10:10:00+09:00",
      seconds_since_last_feedback: 600,
    };
    await reloadAndExpectAgentStatus(agentReviewNeedsAttentionLabel);
    await expect(progressCard).not.toContainText(agentReviewRunningLabel);
    await expect(progressCard).not.toContainText(marketDateLabel);
    await expect(progressCard).not.toContainText("피드백 완료");
    await expect(
      progressCard.locator('[data-role-status="completed"]').filter({ hasText: "Preflight Gate" }),
    ).toContainText(/(?:Complete|완료)\s*250(?:개)?/);
    await expect(
      progressCard.locator('[data-role-status="completed"]').filter({ hasText: "EOD summarizer" }),
    ).toContainText(/(?:Complete|완료)\s*250(?:개)?/);
    await expect(
      progressCard.locator('[data-role-status="attention"]').filter({ hasText: "Technical summarizer" }),
    ).toContainText(/(?:Complete|완료)\s*88(?:개)?/);
    await expect(
      progressCard.locator('[data-role-status="pending"]').filter({ hasText: "Fundamental summarizer" }),
    ).toContainText(/(?:Complete|완료)\s*0(?:개)?/);
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
    await reloadAndExpectAgentStatus(agentReviewPendingLabel);
    await expect(progressCard).not.toContainText(marketDateLabel);
    await expect(progressCard).not.toContainText("피드백 완료");
    await expect(progressCard.locator('[data-role-status="pending"]')).toHaveCount(4);
    await expect(progressCard.getByText(/(?:Complete|완료)\s*0(?:개)?/)).toHaveCount(4);
    await expect(progressCard.getByRole("progressbar")).toHaveCount(3);
    await expect(progressCard.getByRole("progressbar", { name: "EOD summarizer progress" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    await expect(stopButton).toHaveCount(0);

    agentProgressResult = {
      market_date: "2026-04-15",
      roles: {
        "eod-summarizer": {
          requested_count: 2812,
          completed_count: 96,
          error_count: 0,
        },
        "technical-summarizer": {
          requested_count: 2812,
          completed_count: 96,
          error_count: 0,
        },
        "fundamental-summarizer": {
          requested_count: 2812,
          completed_count: 96,
          error_count: 0,
        },
      },
    };
    await reloadAndExpectAgentCompletedHeader();
    await expect(progressCard).not.toContainText(agentReviewPendingLabel);
    await expect(
      progressCard.locator('[data-role-status="completed"]').filter({ hasText: "EOD summarizer" }),
    ).toContainText(/(?:Completed|완료)[\s\S]*(?:Completed|완료)\s*96(?:개)?[\s\S]*(?:Errors|오류)\s*0(?:개)?/);
    await expect(
      progressCard.locator('[data-role-status="completed"]').filter({ hasText: "Technical summarizer" }),
    ).toContainText(/(?:Completed|완료)[\s\S]*(?:Completed|완료)\s*96(?:개)?[\s\S]*(?:Errors|오류)\s*0(?:개)?/);
    await expect(
      progressCard.locator('[data-role-status="completed"]').filter({ hasText: "Fundamental summarizer" }),
    ).toContainText(/(?:Completed|완료)[\s\S]*(?:Completed|완료)\s*96(?:개)?[\s\S]*(?:Errors|오류)\s*0(?:개)?/);
    await expect(progressCard).not.toContainText("Requested");
    await expect(progressCard.getByRole("progressbar", { name: "EOD summarizer progress" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    await expect(progressCard.getByRole("progressbar", { name: "Technical summarizer progress" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    await expect(
      progressCard.getByRole("progressbar", { name: "Fundamental summarizer progress" }),
    ).toHaveAttribute("aria-valuenow", "100");

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
    agentProgressResult = {
      market_date: "2026-04-15",
      roles: {
        "eod-summarizer": {
          requested_count: 96,
          completed_count: 96,
          error_count: 0,
        },
        "technical-summarizer": {
          requested_count: 96,
          completed_count: 96,
          error_count: 0,
        },
        "fundamental-summarizer": {
          requested_count: 96,
          completed_count: 95,
          error_count: 1,
        },
      },
    };
    await reloadAndExpectAgentStatus(agentReviewCompletedLabel);
    await expect(progressCard).not.toContainText(marketDateLabel);
    await expect(progressCard.getByRole("img", { name: agentReviewCompletedLabel })).toHaveCount(0);
    await expect(progressCard).not.toContainText("피드백 완료");
    await expect(progressCard.locator('[data-role-status="completed"]')).toHaveCount(4);
    await expect(
      progressCard.locator('[data-role-status="completed"]').filter({ hasText: "EOD summarizer" }),
    ).toContainText(/(?:Completed|완료)\s*96(?:개)?[\s\S]*(?:Errors|오류)\s*0(?:개)?/);
    await expect(
      progressCard.locator('[data-role-status="completed"]').filter({ hasText: "Technical summarizer" }),
    ).toContainText(/(?:Completed|완료)\s*96(?:개)?[\s\S]*(?:Errors|오류)\s*0(?:개)?/);
    await expect(
      progressCard.locator('[data-role-status="completed"]').filter({ hasText: "Fundamental summarizer" }),
    ).toContainText(/(?:Completed|완료)\s*95(?:개)?[\s\S]*(?:Errors|오류)\s*1(?:개)?/);
    await expect(
      progressCard.locator('[data-role-status="completed"]').filter({ hasText: "EOD summarizer" }),
    ).not.toContainText(/(?:Complete|완료)\s*250(?:개)?/);
    await expect(
      progressCard.locator('[data-role-status="completed"]').filter({ hasText: "Technical summarizer" }),
    ).not.toContainText(/(?:Complete|완료)\s*250(?:개)?/);
    await expect(
      progressCard.locator('[data-role-status="completed"]').filter({ hasText: "Fundamental summarizer" }),
    ).not.toContainText(/(?:Complete|완료)\s*250(?:개)?/);
    await expect(progressCard).not.toContainText("Requested");
    await expect(progressCard.getByRole("progressbar")).toHaveCount(3);
    await expect(progressCard.getByRole("progressbar", { name: "EOD summarizer progress" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    await expect(progressCard.getByRole("progressbar", { name: "Technical summarizer progress" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    await expect(progressCard.getByRole("progressbar", { name: "Fundamental summarizer progress" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
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

    const processDrawer = await openProcessMonitorDrawer(page);
    const progressCard = processDrawer.locator("article").filter({ hasText: "Agent Feedback" });
    const stopButton = progressCard.getByRole("button", { name: agentFeedbackStopButtonLabel });
    await expect(progressCard).toContainText(agentReviewRunningLabel);
    await expect(stopButton).toBeVisible();
    await stopButton.click();

    const stopDialog = page.getByRole("dialog", { name: agentFeedbackStopDialogLabel });
    await expect(stopDialog).toBeVisible();
    await stopDialog.getByRole("button", { name: yesLabel }).click();

    await expect.poll(() => JSON.stringify(stopControlRequestBody)).toBe(
      JSON.stringify({
        action: "kill",
        signal_name: "SIGKILL",
        port: 8000,
      }),
    );
    await expect(stopDialog).toHaveCount(0);
    await expect(progressCard).toContainText(agentReviewNeedsAttentionLabel);
    await expect(stopButton).toHaveCount(0);
    await expect(progressCard).not.toContainText("fetch failed");
  });

  test("agent feedback stop acceptance falls back to idle retry cadence after progress fetch failures on desktop", async ({
    page,
  }) => {
    const now = "2026-04-15T10:20:00+09:00";
    let progressRequestCount = 0;
    let stopControlRequestBody: Record<string, unknown> | null = null;
    let shouldFailProgressPolling = false;

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
      progressRequestCount += 1;

      if (shouldFailProgressPolling) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ detail: "temporarily unavailable" }),
        });
        return;
      }

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
      shouldFailProgressPolling = true;
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

    const processDrawer = await openProcessMonitorDrawer(page);
    const progressCard = processDrawer.locator("article").filter({ hasText: "Agent Feedback" });
    const stopButton = progressCard.getByRole("button", { name: agentFeedbackStopButtonLabel });
    await expect(progressCard).toContainText(agentReviewRunningLabel);
    await expect(stopButton).toBeVisible();
    await stopButton.click();

    const stopDialog = page.getByRole("dialog", { name: agentFeedbackStopDialogLabel });
    await expect(stopDialog).toBeVisible();
    await stopDialog.getByRole("button", { name: yesLabel }).click();

    await expect.poll(() => JSON.stringify(stopControlRequestBody)).toBe(
      JSON.stringify({
        action: "kill",
        signal_name: "SIGKILL",
        port: 8000,
      }),
    );
    await expect(stopDialog).toHaveCount(0);
    await expect(progressCard).toContainText(agentReviewNeedsAttentionLabel);
    await expect(stopButton).toHaveCount(0);

    const progressRequestsAtStop = progressRequestCount;
    await expect.poll(() => progressRequestCount, { timeout: 2500 }).toBeGreaterThan(progressRequestsAtStop);
    const progressRequestsAfterFirstFailure = progressRequestCount;
    await page.waitForTimeout(1500);
    expect(progressRequestCount).toBe(progressRequestsAfterFirstFailure);
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

    const processDrawer = await openProcessMonitorDrawer(page);
    const progressCard = processDrawer.locator("article").filter({ hasText: "Agent Feedback" });
    const stopButton = progressCard.getByRole("button", { name: agentFeedbackStopButtonLabel });
    await expect(progressCard).toContainText(agentReviewRunningLabel);
    await expect(stopButton).toBeVisible();
    await stopButton.click();

    const stopDialog = page.getByRole("dialog", { name: agentFeedbackStopDialogLabel });
    await expect(stopDialog).toBeVisible();
    await stopDialog.getByRole("button", { name: yesLabel }).click();

    await expect.poll(() => JSON.stringify(stopControlRequestBody)).toBe(
      JSON.stringify({
        action: "kill",
        signal_name: "SIGKILL",
        port: 8000,
      }),
    );
    await expect(stopDialog).toBeVisible();
    await expect(stopDialog).toContainText("HTTP 502 for /api/trading/agent-context/internal/core/control");
    await expect(progressCard).toContainText(agentReviewRunningLabel);
    await expect(stopButton).toBeVisible();
  });

  test("D2 agent feedback omits dependency confirmation labels and failure-count pills", async ({
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

    const processDrawer = await openProcessMonitorDrawer(page);
    const progressCard = processDrawer.locator("article").filter({ hasText: "Agent Feedback" });
    const activeFundamentalRole = progressCard
      .locator('[data-role-status="running"]')
      .filter({ hasText: "Fundamental summarizer" });

    await expect(progressCard).toContainText(agentReviewRunningLabel);
    await expect(
      progressCard.locator('[data-role-status="completed"]').filter({ hasText: "Technical summarizer" }),
    ).toBeVisible();
    await expect(activeFundamentalRole).toBeVisible();
    await expect(activeFundamentalRole).not.toContainText("EOD 확인");
    await expect(activeFundamentalRole).not.toContainText("Tech 확인");
    await expect(activeFundamentalRole).not.toContainText("EOD -- 실패 13");
    await expect(activeFundamentalRole).not.toContainText("Tech -- 실패 2");
  });

  test("D2 agent feedback omits running dependency labels and failure-count pills", async ({ page }) => {
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

    const processDrawer = await openProcessMonitorDrawer(page);
    const progressCard = processDrawer.locator("article").filter({ hasText: "Agent Feedback" });
    const activeTechnicalRole = progressCard
      .locator('[data-role-status="running"]')
      .filter({ hasText: "Technical summarizer" });
    const pendingFundamentalRole = progressCard
      .locator('[data-role-status="pending"]')
      .filter({ hasText: "Fundamental summarizer" });

    await expect(progressCard).toContainText(agentReviewRunningLabel);
    await expect(activeTechnicalRole).toBeVisible();
    await expect(activeTechnicalRole).not.toContainText("EOD 진행 중");
    await expect(activeTechnicalRole).not.toContainText("EOD -- 실패 13");
    await expect(pendingFundamentalRole).toBeVisible();
    await expect(pendingFundamentalRole).not.toContainText("EOD 진행 중");
    await expect(pendingFundamentalRole).not.toContainText("Tech 진행 중");
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

  test("D2 fundamentals subcard maps the ready stage to synced and expands structured update previews", async ({
    page,
  }) => {
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
            symbols_refreshed: 5,
            symbols_failed: 1,
            events_detected: 0,
            events_captured: 0,
            events_failed: 0,
            updated_entries_summary: {
              updated_count: 5,
              visible_preview_limit: 3,
            },
            updated_entries: [
              {
                symbol: "005930",
                company_name: "Samsung Electronics",
                category_label: "Financial statement refresh",
              },
              {
                symbol: "000660",
                company_name: "SK hynix",
                category_label: "Quarterly filing capture",
              },
              {
                symbol: "035420",
                company_name: "NAVER",
                category_label: "Correction filing refresh",
              },
              {
                symbol: "005380",
                company_name: "Hyundai Motor",
                category_label: "Annual filing capture",
              },
              {
                symbol: "012450",
                company_name: "Hanwha Aerospace",
                category_label: "Financial statement refresh",
              },
            ],
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

    const eodStatusCard = await openEodStatusCard(page);
    const fundamentalsStage = eodStatusCard.locator('[aria-label="Fundamentals freshness"]');
    await expect(fundamentalsStage).toBeVisible();
    await expectEodStageStatus(fundamentalsStage, "synced");
    await expect(fundamentalsStage.locator('.pill[data-status-badge="synced"]')).toHaveCount(0);
    const updatedTodayDetail = fundamentalsStage.locator('[data-detail-tone="count"]').filter({
      hasText: "Updated today",
    });
    await expect(updatedTodayDetail).toContainText("Updated today");
    await expect(updatedTodayDetail).toContainText("5");
    const updatedCompanyList = fundamentalsStage.getByRole("list", { name: "Updated companies" });
    await expect(updatedCompanyList).toContainText("Samsung Electronics");
    await expect(updatedCompanyList).toContainText("Financial statement refresh");
    await expect(updatedCompanyList).toContainText("SK hynix");
    await expect(updatedCompanyList).toContainText("Quarterly filing capture");
    await expect(updatedCompanyList).toContainText("NAVER");
    await expect(updatedCompanyList).toContainText("Correction filing refresh");
    await expect(updatedCompanyList).not.toContainText("Hyundai Motor");
    const moreButton = fundamentalsStage.getByRole("button", { name: /Show all updated companies/i });
    await expect(moreButton).toBeVisible();
    await expect(moreButton).toContainText("More");
    await moreButton.click();
    await expect(updatedCompanyList).toContainText("Hyundai Motor");
    await expect(updatedCompanyList).toContainText("Annual filing capture");
    await expect(updatedCompanyList).toContainText("Hanwha Aerospace");
    await expect(
      fundamentalsStage.getByRole("button", { name: /Show fewer updated companies/i }),
    ).toContainText("Less");
    const failedDetail = fundamentalsStage.locator('[data-detail-tone="count"]').filter({
      hasText: "Failed",
    });
    await expect(failedDetail).toContainText("Failed");
    await expect(failedDetail).toContainText("1");
    await expect(fundamentalsStage.getByText(/Run status/i)).toHaveCount(0);
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

    const eodStatusCard = await openEodStatusCard(page);
    const fundamentalsStage = eodStatusCard.locator('[aria-label="Fundamentals freshness"]');
    await expect(fundamentalsStage).toBeVisible();
    await expectEodStageStatus(fundamentalsStage, "not synced");
    const latestDateDetail = fundamentalsStage.locator('[data-detail-tone="text"]').filter({
      hasText: "Latest date",
    });
    await expect(latestDateDetail).toContainText("Latest date");
    await expect(latestDateDetail).toContainText("2026-04-14");
    await expect(fundamentalsStage.getByText(/Run status/i)).toHaveCount(0);
    await expect(fundamentalsStage.getByText("Updated today")).toHaveCount(0);
    await expect(fundamentalsStage.getByRole("button", { name: /View fundamentals run details/i })).toBeVisible();
    await expect(fundamentalsStage.getByText("view detail")).toBeVisible();
    await expect(fundamentalsStage.getByText("[확인 필요]")).toHaveCount(0);
  });

  test("D2 fundamentals subcard keeps recent update activity after the process date rolls forward", async ({ page }) => {
    const now = "2026-04-21T10:15:00+09:00";

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
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-21",
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
              symbols_total: 3583,
              symbols_succeeded: 0,
              symbols_failed: 0,
            },
          },
          latest: {
            price_trade_date: "2026-04-21",
            technical_market_date: "2026-04-21",
            action_market_date: "2026-04-21",
            stage_details: {
              fundamentals: {
                market_date: "2026-04-18",
                status: "completed",
                symbols_total: 3583,
                symbols_checked: 1,
                symbols_failed: 0,
              },
            },
          },
          fundamentals: {
            success: true,
            latest_date: "2026-04-18",
          },
        }),
      });
    });
    await page.route("**/api/trading/eod/pipeline/status?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-21",
          status: "completed",
          stage_order: [
            "price_collection",
            "technical_snapshots",
            "action_summaries",
            "trending_ranks",
            "signal_features",
            "fundamentals_daily_refresh",
          ],
          stages: {},
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: {
            id: 24,
            market_date: "2026-04-18",
            trigger: "internal_ops_cli",
            status: "completed",
            fs_div: "CFS",
            force: false,
            symbol_limit: null,
            symbol_offset: 0,
            symbols_total: 3583,
            symbols_checked: 1,
            symbols_missing: 0,
            symbols_stale: 0,
            symbols_fresh: 1,
            symbols_refreshed: 1,
            symbols_failed: 0,
            events_detected: 0,
            events_captured: 0,
            events_failed: 0,
            updated_entries_summary: {
              updated_count: 1,
              visible_preview_limit: 3,
            },
            updated_entries: [
              {
                symbol: "005930",
                company_name: "Samsung Electronics",
                category_label: "Financial statement refresh",
              },
            ],
            error_message: null,
            run_metadata: {},
            started_at: "2026-04-18T08:56:58.357390+09:00",
            completed_at: "2026-04-18T09:11:08.375335+09:00",
          },
          runs: [],
        }),
      });
    });

    await page.goto("/dashboard");

    const eodStatusCard = await openEodStatusCard(page);
    const fundamentalsStage = eodStatusCard.locator('[aria-label="Fundamentals freshness"]');
    await expect(fundamentalsStage).toBeVisible();
    await expectEodStageStatus(fundamentalsStage, "synced");
    await expect(fundamentalsStage.getByText("Checked")).toHaveCount(0);
    await expect(fundamentalsStage).toContainText(/Recently updated\s*1/);
    await expect(fundamentalsStage).toContainText(/Latest date\s*2026-04-18/);
    await expect(fundamentalsStage.getByRole("list", { name: "Updated companies" })).toContainText(
      "Samsung Electronics",
    );
    await expect(fundamentalsStage.getByText("Updated today")).toHaveCount(0);
    await expect(fundamentalsStage.getByText("[확인 필요]")).toHaveCount(0);
  });

  test("D2 fundamentals running status uses a readable spinner pill and truncates the title", async ({ page }) => {
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

    const eodStatusCard = await openEodStatusCard(page);
    const fundamentalsStage = eodStatusCard.locator('[aria-label="Fundamentals freshness"]');
    const fundamentalsTitle = fundamentalsStage.getByText("Fundamentals", { exact: true });
    const runningPill = fundamentalsStage.locator('.pill[data-status-badge="running"]');

    await expect(fundamentalsStage).toBeVisible();
    await expectEodStageStatus(fundamentalsStage, "running");
    await expect(fundamentalsTitle).toHaveCSS("overflow-x", "hidden");
    await expect(fundamentalsTitle).toHaveCSS("text-overflow", "ellipsis");
    await expect(fundamentalsTitle).toHaveCSS("white-space", "nowrap");
    await expect(runningPill).toBeVisible();
    await expect(runningPill).toHaveCSS("color", "rgb(243, 247, 255)");
    await expect(runningPill).toHaveCSS("background-color", "rgba(127, 184, 255, 0.24)");
    await expect(runningPill).toHaveCSS("border-top-color", "rgba(127, 184, 255, 0.45)");

    const titleRowLayout = await fundamentalsStage.evaluate((element) => {
      const title = [...element.querySelectorAll("span")].find((child) => child.textContent?.trim() === "Fundamentals");
      const pill = element.querySelector('.pill[data-status-badge="running"]');

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

  test("D2 not synced status icon is standalone and stays compact without colliding with long stage titles", async ({
    page,
  }) => {
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
              status: "missing",
              symbols_total: 250,
              symbols_succeeded: 0,
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

    const eodStatusCard = await openEodStatusCard(page);
    const actionStage = eodStatusCard.locator('[aria-label="Action Summary freshness"]');
    await expectEodStageStatus(actionStage, "not synced");
    await expect(actionStage.locator('.pill[data-status-badge="not synced"]')).toHaveCount(0);

    const titleRowLayout = await actionStage.evaluate((element) => {
      const title = [...element.querySelectorAll("span")].find(
        (child) => child.textContent?.trim() === "Action Summary",
      );
      const icon = element.querySelector('[data-status-badge="not synced"]');

      if (!title || !icon) return null;

      const titleRect = title.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();

      return {
        iconWidth: iconRect.width,
        iconHeight: iconRect.height,
        iconLeft: iconRect.left,
        titleRight: titleRect.right,
      };
    });

    expect(titleRowLayout).not.toBeNull();
    expect(titleRowLayout!.iconWidth).toBeLessThanOrEqual(22);
    expect(titleRowLayout!.iconHeight).toBeLessThanOrEqual(22);
    expect(titleRowLayout!.titleRight).toBeLessThanOrEqual(titleRowLayout!.iconLeft);
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

    const eodStatusCard = await openEodStatusCard(page);
    for (const [label, status] of [
      ["Price Fetch", "synced"],
      ["Technical Analysis", "synced"],
      ["Action Summary", "synced"],
      ["Fundamentals", "not synced"],
    ] as const) {
      const stageCard = eodStatusCard.locator(`[aria-label="${label} freshness"]`);
      await expect(stageCard).toBeVisible();
      await expectEodStageStatus(stageCard, status);

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

    const eodStatusCard = await openEodStatusCard(page);
    const fundamentalsStage = eodStatusCard.locator('[aria-label="Fundamentals freshness"]');
    await expect(fundamentalsStage).toBeVisible();

    await fundamentalsStage.getByRole("button", { name: /View fundamentals run details/i }).click();

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
