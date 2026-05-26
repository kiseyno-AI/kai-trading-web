import { expect, test, type Locator, type Page } from "@playwright/test";

import { CANONICAL_EOD_PIPELINE_STAGE_ORDER } from "@/lib/eod-pipeline-status";
import { RELEASE_VERSION_LABEL } from "@/lib/release-version";
import { chromiumIPhone13 } from "./devices";
import { expectMobileContentClearsBottomChrome } from "./mobile-bottom-chrome";

test.use(chromiumIPhone13);

const agentReviewCompletedLabel = /Agent review completed|에이전트 분석 완료/;
const agentFeedbackStopButtonLabel = /Stop|중단/;
const agentFeedbackStopDialogLabel = /Stop the agent feedback run\?|에이전트 피드백 실행을 중단할까요\?/;
const yesLabel = /Yes|예/;

type FilteringStageStatus = "completed" | "loading" | "needs-review" | "pending" | "waiting";
type MockPipelineStatus = "running" | "completed" | "partial";

async function expectFilteringStageStatusIcon(stage: Locator, status: FilteringStageStatus, label: string) {
  await expect(stage).toHaveAttribute("data-filter-status", status);
  const badge = stage.locator(`[data-filter-status-badge="${status}"]`);
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText("");
  await expect(stage.getByRole("img", { name: new RegExp(`^${label}$`, "i") })).toBeVisible();
  await expect(stage).not.toContainText(label);
}

async function openProcessMonitorDrawer(page: Page) {
  const drawer = page.getByRole("dialog", { name: /Daily process monitor|일별 프로세스 모니터/i });
  if (await drawer.isVisible().catch(() => false)) {
    return drawer;
  }

  await page.getByRole("button", { name: /Open process monitor|프로세스 모니터 열기/i }).first().click();
  await expect(drawer).toBeVisible();
  return drawer;
}

async function expectAllVisibleProcessMonitorTriggersMirrorCanonical(page: Page) {
  const processBars = page.getByRole("button", { name: /Open process monitor|프로세스 모니터 열기/i });
  const count = await processBars.count();
  expect(count).toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    const processBar = processBars.nth(index);
    await expect(processBar).toHaveAttribute("data-process-monitor-status", "partial");
    await expect(processBar).toHaveAttribute("data-process-summary-source", "canonical-pipeline");
    await expect(processBar).toContainText(/Partial|부분 완료/);
    await expect(processBar).toContainText(/15\s*\/\s*24/);
    await expect(processBar).not.toContainText(/All groups complete|모든 그룹 완료/);
    await expect(processBar).not.toContainText(/14\s*\/\s*14/);
  }
}

async function waitForProcessMonitorDrawerLayout(drawer: Locator) {
  await drawer.evaluate(async (element) => {
    const animations = element.getAnimations();
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  });

  let previousBox: string | null = null;
  await expect
    .poll(
      async () => {
        const box = await drawer.boundingBox();
        if (!box) {
          previousBox = null;
          return false;
        }

        const nextBox = [box.x, box.y, box.width, box.height].map((value) => value.toFixed(2)).join(":");
        const isStable = nextBox === previousBox;
        previousBox = nextBox;
        return isStable;
      },
      { message: "process monitor drawer layout should settle after opening" },
    )
    .toBe(true);
}

type LayoutBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function getOverlapArea(first: LayoutBox, second: LayoutBox) {
  const overlapWidth = Math.max(
    0,
    Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y),
  );

  return overlapWidth * overlapHeight;
}

async function mockDashboardProcessStatusApis(page: Page, getPipelineStatus: () => MockPipelineStatus) {
  const now = "2026-04-16T09:10:00+09:00";

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
            trade_date: "2026-04-16",
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
          price_trade_date: "2026-04-16",
          technical_market_date: "2026-04-16",
          action_market_date: "2026-04-16",
        },
        technical: {
          success: true,
          latest_date: "2026-04-16",
        },
        action: {
          success: true,
          latest_date: "2026-04-16",
        },
        fundamentals: {
          success: true,
          latest_date: "2026-04-16",
        },
      }),
    });
  });
  await page.route("**/api/trading/eod/pipeline/status**", async (route) => {
    const status = getPipelineStatus();
    const partialCompletedStageKeys = new Set([
      "master_refresh",
      "pykrx_universe_refresh",
      "price_collection",
      "pykrx_enrichment",
      "technical_snapshots",
      "action_summaries",
      "trending_ranks",
      "signal_features",
      "market_risk_filter",
      "fundamentals_daily_refresh",
      "piotroski_filter",
      "momentum_factors",
      "unified_value_factors",
      "quality_factors",
      "agent_feedback_summaries",
    ]);
    const stages = Object.fromEntries(
      CANONICAL_EOD_PIPELINE_STAGE_ORDER.map((stageKey) => {
        const isRunningAction = status === "running" && stageKey === "action_summaries";
        const isCompleted =
          status === "completed" ||
          (status === "running" && CANONICAL_EOD_PIPELINE_STAGE_ORDER.indexOf(stageKey) < 5) ||
          (status === "partial" && partialCompletedStageKeys.has(stageKey));

        return [
          stageKey,
          {
            status: isRunningAction ? "running" : isCompleted ? "completed" : "pending",
            processed: isRunningAction ? 1180 : isCompleted ? 3200 : null,
            total: isRunningAction || isCompleted ? 3200 : null,
            failed: 0,
            current_step: isRunningAction ? "build_symbol_summary" : null,
            current_activity: isRunningAction ? "Rendering EOD summaries" : null,
            current_symbol: isRunningAction ? "005930" : null,
          },
        ];
      }),
    );

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        market_date: "2026-04-16",
        status,
        stage_order: [...CANONICAL_EOD_PIPELINE_STAGE_ORDER],
        stages,
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
  await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        market_date: "2026-04-16",
        summary: {
          entries: 3200,
          requested_symbol: null,
          matched_symbols: ["005930"],
          missing_symbols: [],
          passed_count: 128,
          not_passed_count: 3072,
        },
        items: [],
      }),
    });
  });
  await page.route("**/api/trading/eod/market-risk-filters?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        market_date: "2026-04-16",
        summary: {
          entries: 3200,
          requested_symbol: null,
          matched_symbols: ["005930"],
          missing_symbols: [],
          passed_count: 3000,
          watchlist_count: 120,
          failed_count: 80,
        },
        items: [],
      }),
    });
  });
  await page.route("**/api/trading/agent-context/feedback/progress**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        request: {
          market_date: "2026-04-16",
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
}

async function expectStatusChromeSeparated(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto("/dashboard");

  const topbar = page.locator("header.topbar");
  const processBar = page.getByRole("button", { name: /Open process monitor/i }).first();
  const releaseBadge = page.getByTestId("dashboard-header-release");
  const localeSwitch = page.getByTestId("dashboard-header-language-switch");
  const bottomNav = page.getByRole("navigation", { name: /Primary/i });

  await expect(topbar).toBeVisible();
  await expect(processBar).toBeVisible();
  await expect(releaseBadge).toBeVisible();
  await expect(releaseBadge).toContainText(RELEASE_VERSION_LABEL);
  await expect(localeSwitch).toBeVisible();
  await expect(bottomNav).toBeVisible();

  const [topbarBox, processBarBox, releaseBox, localeBox, bottomNavBox] = await Promise.all([
    topbar.boundingBox(),
    processBar.boundingBox(),
    releaseBadge.boundingBox(),
    localeSwitch.boundingBox(),
    bottomNav.boundingBox(),
  ]);

  if (!topbarBox || !processBarBox || !releaseBox || !localeBox || !bottomNavBox) {
    throw new Error(`Expected visible dashboard chrome boxes at ${viewport.width}x${viewport.height}.`);
  }

  expect(getOverlapArea(topbarBox, processBarBox)).toBe(0);
  expect(getOverlapArea(processBarBox, releaseBox)).toBe(0);
  expect(getOverlapArea(processBarBox, localeBox)).toBe(0);
  expect(getOverlapArea(processBarBox, bottomNavBox)).toBe(0);
  expect(releaseBox.y).toBeLessThan(processBarBox.y);
  expect(localeBox.y).toBeLessThan(processBarBox.y);

  const processBarGapToBottomNav = bottomNavBox.y - (processBarBox.y + processBarBox.height);
  expect(processBarGapToBottomNav).toBeGreaterThanOrEqual(0);
  expect(processBarGapToBottomNav).toBeLessThanOrEqual(12);
}

async function openEodStatusCard(page: Page) {
  const processDrawer = await openProcessMonitorDrawer(page);
  const eodStatusCard = processDrawer.locator("article").filter({ hasText: "EOD Status" });
  await expect(eodStatusCard).toBeVisible();
  return eodStatusCard;
}

test.describe("dashboard mobile chrome", () => {
  test("dashboard top chrome is compact and fixed on mobile", async ({ page }) => {
    await page.goto("/dashboard");

    const topbar = page.locator("header.topbar");
    const bottomNav = page.getByRole("navigation", { name: /Primary/i });
    await expect(topbar).toBeVisible();

    await expect
      .poll(() => topbar.evaluate((element) => window.getComputedStyle(element).position))
      .toBe("fixed");

    const topbarBox = await topbar.boundingBox();
    expect(topbarBox).not.toBeNull();
    expect(topbarBox!.height).toBeLessThan(112);
    expect(topbarBox!.x).toBeGreaterThanOrEqual(0);

    await expect(bottomNav).toBeVisible();
    const dashboardTitle = page.locator("[data-dashboard-toolbar-title]").first();
    const headerRelease = page.getByTestId("dashboard-header-release");
    const headerLanguageSwitch = page.getByTestId("dashboard-header-language-switch");
    await expect(dashboardTitle).toContainText(/Trading Command Surface|트레이딩 커맨드 서피스/);
    await expect(headerRelease).toContainText(RELEASE_VERSION_LABEL);
    await expect(headerLanguageSwitch).toBeVisible();

    const [titleBox, releaseBox] = await Promise.all([dashboardTitle.boundingBox(), headerRelease.boundingBox()]);
    expect(titleBox).not.toBeNull();
    expect(releaseBox).not.toBeNull();
    expect(releaseBox!.y).toBeGreaterThanOrEqual(titleBox!.y + titleBox!.height - 1);

    await expect(page.getByRole("heading", { name: /Decider, portfolio, and market state/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Decider recommendations/i })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Search", exact: true })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Assets", exact: true })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Calendar", exact: true })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "My Symbols", exact: true })).toBeVisible();
    await expect(page.getByText(/Live Connection/i)).toHaveCount(0);
  });

  test("dashboard content scrolls clear of the process monitor accessory and bottom nav", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");

    const routeContent = page.locator("[data-app-chrome-root] main > div").first();
    await expect(page.getByRole("button", { name: /Open process monitor/i }).first()).toBeVisible();
    await expect(routeContent.getByRole("heading", { name: /Decider recommendations/i })).toBeVisible();

    await expectMobileContentClearsBottomChrome(page, routeContent);
  });

  test("monitored symbol prices use one compact mobile line", async ({ page }) => {
    const pipelineStatus: "running" | "completed" = "completed";
    await mockDashboardProcessStatusApis(page, () => pipelineStatus);
    await page.route("**/api/trading/execution/runtime/status**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          status: "ready",
          mode: "paper",
          exec_connected: true,
        }),
      });
    });
    await page.route("**/api/trading/execution/runtime/monitored-symbols**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-16",
          items: [
            {
              symbol: "000660",
              name: "SK hynix",
              market: "KRX",
              monitoring_state: "watching_target_stop",
              planned_intents: ["buy"],
              target_price: 184000,
              stop_loss_price: 174000,
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/execution/runtime/daily-board**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-16",
          items: [],
        }),
      });
    });

    await page.goto("/dashboard");

    const deciderCard = page.locator("article").filter({
      has: page.getByRole("heading", { name: /Decider recommendations/i }),
    });
    const compactPriceLine = deciderCard.getByText("Stop 174,000 · Target 184,000 · Now —", { exact: true });
    await expect(compactPriceLine).toBeVisible();
    await expect(deciderCard.getByText("Current price", { exact: true })).toBeHidden();
    await expect
      .poll(() => compactPriceLine.evaluate((element) => getComputedStyle(element).whiteSpace))
      .toBe("nowrap");
  });

  test("bottom assets navigation lands in shared mobile portfolio chrome", async ({ page }) => {
    await page.goto("/dashboard");

    const assetsLink = page
      .getByRole("navigation", { name: /^(Primary|기본 내비게이션)$/i })
      .getByRole("link", { name: "Assets", exact: true });
    await expect(assetsLink).toHaveAttribute("href", "/portfolio");
    await page.goto("/portfolio");

    await expect(page.getByRole("heading", { name: "Portfolio" })).toBeVisible();

    const bottomNav = page.getByRole("navigation", { name: /^(Primary|기본 내비게이션)$/i });
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Assets", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(bottomNav.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Search", exact: true })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Calendar", exact: true })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "My Symbols", exact: true })).toBeVisible();

    await expect(page.getByText("KAI Desk")).toHaveCount(0);
    await expect(page.getByText(/Trading workstation shell/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Open navigation/i })).toHaveCount(0);
    await expect(page.getByText(/Feed On|Alpha Desk|Placeholder route|Market Surface|Ready for API wiring/i)).toHaveCount(0);

    const viewportMetrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(viewportMetrics.scrollWidth).toBeLessThanOrEqual(viewportMetrics.clientWidth + 1);
  });

  test("mobile process monitor shows a loading indicator instead of stale progress while running", async ({ page }) => {
    let pipelineStatus: "running" | "completed" = "running";
    await mockDashboardProcessStatusApis(page, () => pipelineStatus);

    await page.goto("/dashboard");

    const processBar = page.getByRole("button", { name: /Open process monitor/i }).first();
    await expect(processBar).toHaveAttribute("data-process-monitor-status", "running");
    await expect(processBar).toHaveAccessibleName(/\(Running\)$/);
    await expect(processBar).not.toHaveAccessibleName(/\d+\s*\/\s*\d+/);
    await expect(processBar).not.toContainText(/Patch\s*\/\s*Filter(?:\s*\/\s*Scoring)?\s*\/\s*Agent Feedback/);

    const loadingSummary = processBar.locator('[data-process-summary-mode="loading"]');
    await expect(loadingSummary).toBeVisible();
    await expect(loadingSummary).toContainText(/Running/);
    await expect(loadingSummary).toHaveText(/^Running$/);
    await expect(loadingSummary).not.toContainText(/\d+\s*\/\s*\d+/);

    const loadingSpinner = loadingSummary.locator('[aria-hidden="true"]').first();
    await expect(loadingSpinner).toBeVisible();
    await expect
      .poll(() => loadingSpinner.evaluate((element) => getComputedStyle(element).animationName))
      .toMatch(/agentRoleSpin$/);

    pipelineStatus = "completed";

    await expect(processBar).toHaveAttribute("data-process-monitor-status", "completed");
    await expect(processBar).toHaveAttribute("data-process-summary-source", "canonical-pipeline");
    const completedSummary = processBar.locator('[data-process-summary-mode="progress"]');
    await expect(completedSummary).toBeVisible();
    await expect(completedSummary).toContainText(/24\s*\/\s*24/);
    await expect(processBar).toHaveAccessibleName(/24\s*\/\s*24/);
    await expect(processBar).not.toContainText(/All groups complete|모든 그룹 완료/);
    await expect(processBar).not.toContainText(/14\s*\/\s*14/);
  });

  test("mobile process monitor trigger mirrors partial canonical pipeline counts", async ({ page }) => {
    const pipelineStatus: MockPipelineStatus = "partial";
    await mockDashboardProcessStatusApis(page, () => pipelineStatus);
    await page.addInitScript(() => {
      window.localStorage.setItem("trading-web.locale", JSON.stringify("ko"));
    });

    await page.goto("/dashboard");

    await expectAllVisibleProcessMonitorTriggersMirrorCanonical(page);

    const processDrawer = await openProcessMonitorDrawer(page);
    const canonicalPipeline = processDrawer.getByLabel(/Canonical daily pipeline status|표준 일별 파이프라인 상태/);
    await expect(canonicalPipeline).toContainText(/Partial|부분 완료/);
    await expect(canonicalPipeline).toContainText(/15\s*\/\s*24/);
    await expect(canonicalPipeline).toContainText(/fallback inference|fallback 추론/);
    await expectAllVisibleProcessMonitorTriggersMirrorCanonical(page);
  });

  test("expanded mobile process monitor keeps a single close arrow and dismisses from outside click", async ({ page }) => {
    let pipelineStatus: "running" | "completed" = "running";
    await mockDashboardProcessStatusApis(page, () => pipelineStatus);

    await page.goto("/dashboard");

    const processBar = page.getByRole("button", { name: /Open process monitor/i }).first();
    const processDrawer = await openProcessMonitorDrawer(page);
    await expect(processDrawer).toBeVisible();

    await processDrawer.getByRole("heading", { name: /Daily process monitor/i }).click();
    await expect(processDrawer).toBeVisible();

    pipelineStatus = "completed";

    await expect(processBar).toHaveAttribute("data-process-monitor-status", "completed");
    await expect(processDrawer).toBeVisible();

    const collapseButton = processDrawer.getByRole("button", { name: /Close monitor/i });
    await expect(collapseButton.locator('[data-process-monitor-collapse-icon="down"]')).toBeVisible();
    await expect.poll(() => collapseButton.evaluate((button) => button.children.length)).toBe(1);
    await page.mouse.click(8, 8);
    await expect(processDrawer).toHaveAttribute("data-process-monitor-state", "closing");
    await expect
      .poll(() => processDrawer.evaluate((element) => getComputedStyle(element).animationName).catch(() => ""))
      .toMatch(/processMonitorFloatingSheetOut$|^$/);
    await expect(processDrawer).toBeHidden();
  });

  test("mobile status bar stays clear of release and language controls", async ({ page }) => {
    for (const viewport of [
      { width: 360, height: 640 },
      { width: 390, height: 664 },
      { width: 768, height: 900 },
    ]) {
      await expectStatusChromeSeparated(page, viewport);
    }
  });

  test("mobile process monitor opens above the toolbar as a floating half-height sheet", async ({ page }) => {
    await page.goto("/dashboard");

    const processBar = page.getByRole("button", { name: /Open process monitor/i }).first();
    const bottomNav = page.getByRole("navigation", { name: /Primary/i });
    const processDrawer = await openProcessMonitorDrawer(page);
    await waitForProcessMonitorDrawerLayout(processDrawer);
    const [viewport, drawerBox, processBarBox, bottomNavBox, backdropAlpha] = await Promise.all([
      page.viewportSize(),
      processDrawer.boundingBox(),
      processBar.boundingBox(),
      bottomNav.boundingBox(),
      processDrawer.evaluate((element) => {
        const backdrop = element.parentElement;
        const backgroundColor = backdrop ? window.getComputedStyle(backdrop).backgroundColor : "";
        const match = backgroundColor.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/);
        return match ? Number(match[1]) : 1;
      }),
    ]);

    expect(viewport).not.toBeNull();
    expect(drawerBox).not.toBeNull();
    expect(processBarBox).not.toBeNull();
    expect(bottomNavBox).not.toBeNull();

    if (!viewport || !drawerBox || !processBarBox || !bottomNavBox) {
      throw new Error("Expected mobile process monitor and toolbar to have layout boxes.");
    }

    expect(backdropAlpha).toBeLessThan(0.5);
    expect(drawerBox.y).toBeGreaterThan(36);
    expect(drawerBox.height).toBeLessThanOrEqual(viewport.height * 0.52);
    expect(drawerBox.y + drawerBox.height).toBeLessThanOrEqual(processBarBox.y + 2);
    expect(processBarBox.y + processBarBox.height).toBeLessThanOrEqual(bottomNavBox.y + 12);

    await expect(processDrawer).toHaveAttribute("data-process-monitor-state", "open");
    await expect
      .poll(() => processDrawer.evaluate((element) => getComputedStyle(element).animationName))
      .toMatch(/processMonitorFloatingSheetIn$/);

    const collapseButton = processDrawer.getByRole("button", { name: /Close monitor/i });
    await expect(collapseButton.locator('[data-process-monitor-collapse-icon="down"]')).toBeVisible();
    await collapseButton.click();
    await expect(processDrawer).toHaveAttribute("data-process-monitor-state", "closing");
    await expect
      .poll(() => processDrawer.evaluate((element) => getComputedStyle(element).animationName).catch(() => ""))
      .toMatch(/processMonitorFloatingSheetOut$|^$/);
    await expect(processDrawer).toBeHidden();
  });

  test("D2 EOD counts fit mobile cards with four-digit totals", async ({ page }) => {
    const now = "2026-04-16T09:10:00+09:00";

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
              trade_date: "2026-04-16",
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
              symbols_total: 3583,
              symbols_succeeded: 3570,
              symbols_failed: 13,
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
              symbols_succeeded: 3579,
              symbols_failed: 4,
            },
            fundamentals: {
              status: "ready",
              symbols_total: 3583,
              symbols_succeeded: 10,
              symbols_failed: 1406,
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
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: {
            id: 17,
            market_date: "2026-04-16",
            trigger: "internal_ops_cli",
            status: "completed",
            fs_div: "CFS",
            force: false,
            symbol_limit: null,
            symbol_offset: 0,
            symbols_total: 3583,
            symbols_checked: 3583,
            symbols_missing: 0,
            symbols_stale: 0,
            symbols_fresh: 3583,
            symbols_refreshed: 10,
            symbols_failed: 1406,
            events_detected: 13786,
            events_captured: 10,
            events_failed: 490,
            error_message: null,
            run_metadata: {},
            started_at: "2026-04-16T08:56:58.357390+09:00",
            completed_at: "2026-04-16T09:11:08.375335+09:00",
          },
          runs: [],
        }),
      });
    });
    await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-16",
          summary: {
            entries: 3583,
            requested_symbol: null,
            matched_symbols: Array.from({ length: 3583 }, (_, index) => `SYM${index + 1}`),
            missing_symbols: [],
            passed_count: 132,
            not_passed_count: 3451,
          },
          items: [],
        }),
      });
    });
    await page.route("**/api/trading/eod/market-risk-filters?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-16",
          summary: {
            entries: 3583,
            requested_symbol: null,
            matched_symbols: Array.from({ length: 3583 }, (_, index) => `SYM${index + 1}`),
            missing_symbols: [],
            passed_count: 3200,
            watchlist_count: 180,
            failed_count: 383,
          },
          items: [],
        }),
      });
    });
    await page.route("**/api/trading/agent-context/feedback/progress**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: "2026-04-16",
            symbols: null,
            expected_agents: ["eod-summarizer", "technical-summarizer", "fundamental-summarizer"],
          },
          summary: {
            run_status: "completed",
            is_live: false,
            latest_feedback_at: now,
            seconds_since_last_feedback: 120,
            stalled_threshold_seconds: 300,
            total_symbols: 3583,
            processed_symbols: 3583,
            completed_symbols: 3583,
            in_progress_symbols: 0,
            pending_symbols: 0,
            progress_ratio: 1,
            progress_percent: 100,
            failed_items: 0,
            completed_feedback_count: 3583,
            expected_feedback_count: 3583,
          },
        }),
      });
    });

    await page.goto("/dashboard");

    const processDrawer = await openProcessMonitorDrawer(page);
    const eodStatusCard = processDrawer.locator("article").filter({ hasText: "EOD Status" });
    const priceStage = eodStatusCard.locator('[aria-label="Price Fetch freshness"]');
    const technicalStage = eodStatusCard.locator('[aria-label="Technical Analysis freshness"]');
    const actionStage = eodStatusCard.locator('[aria-label="Action Summary freshness"]');
    const fundamentalsStage = eodStatusCard.locator('[aria-label="Fundamentals freshness"]');
    const filteringCard = processDrawer.locator("article").filter({ hasText: "Filtering" });
    const piotroskiSection = filteringCard.locator('[data-filter-stage="piotroski"]');
    const marketRiskSection = filteringCard.locator('[data-filter-stage="kis-risk"]');
    const scoringCard = processDrawer.locator("article").filter({ hasText: "Scoring" });
    const unifiedValueScoringSection = scoringCard.locator('[data-scoring-stage="unified-value"]');
    const qualityScoringSection = scoringCard.locator('[data-scoring-stage="quality"]');
    const momentumScoringSection = scoringCard.locator('[data-scoring-stage="momentum"]');
    const agentFeedbackCard = processDrawer.locator("article").filter({ hasText: "Agent Feedback" });

    await expect(priceStage).toContainText(/3,570\s*\/\s*3,583/);
    await expect(priceStage).not.toContainText(/Succeeded/);
    await expect(technicalStage).toContainText(/3,583\s*\/\s*3,583/);
    await expect(technicalStage).not.toContainText(/Succeeded/);
    await expect(actionStage).toContainText(/3,579\s*\/\s*3,583/);
    await expect(actionStage).not.toContainText(/Succeeded/);
    await expect(fundamentalsStage).toContainText(/Checked\s*3,583/);
    await expect(priceStage).toContainText(/Failed\s*13/);
    await expect(fundamentalsStage).toContainText(/Failed\s*1,406/);
    await expect(piotroskiSection).toContainText("Piotroski");
    await expectFilteringStageStatusIcon(piotroskiSection, "completed", "Completed");
    await expect(piotroskiSection).toContainText(/Filtered\s*132/);
    await expect(piotroskiSection).not.toContainText(/Checked|Not pass/);
    await expect(marketRiskSection).toContainText("KIS Risk");
    await expectFilteringStageStatusIcon(marketRiskSection, "completed", "Completed");
    await expect(marketRiskSection).toContainText(/Filtered\s*3,200/);
    await expect(marketRiskSection).not.toContainText(/Watchlist|Fail/);
    await expect(filteringCard).toContainText(/Final filtered symbols\s*3,583/);
    await expect(scoringCard).toBeVisible();
    await expect(unifiedValueScoringSection).toContainText("Unified value scoring");
    await expect(qualityScoringSection).toContainText("Quality scoring");
    await expect(momentumScoringSection).toContainText("Momentum scoring");
    await expect(unifiedValueScoringSection).toContainText(/Progress\s*\[확인 필요\]/);
    await expect(agentFeedbackCard).not.toContainText("Latest Run");
    await expect(agentFeedbackCard).toContainText(agentReviewCompletedLabel);
    await expect(agentFeedbackCard.getByRole("img", { name: agentReviewCompletedLabel })).toHaveCount(0);
    await expect(agentFeedbackCard).toContainText("EOD summarizer");
    await expect(agentFeedbackCard).toContainText("Technical summarizer");
    await expect(agentFeedbackCard).toContainText("Fundamental summarizer");
    await expect(agentFeedbackCard.locator("[data-role-icon]")).toHaveCount(0);
    await expect(agentFeedbackCard.locator("[data-role-progress-icon]")).toHaveCount(3);
    await expect(agentFeedbackCard.locator('[data-role-progress-icon="completed"]')).toHaveCount(3);
    await expect(agentFeedbackCard.getByRole("progressbar")).toHaveCount(3);
    await expect(agentFeedbackCard.getByRole("progressbar", { name: "EOD summarizer progress" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    await expect(
      agentFeedbackCard.getByRole("progressbar", { name: "Technical summarizer progress" }),
    ).toHaveAttribute("aria-valuenow", "100");
    await expect(
      agentFeedbackCard.getByRole("progressbar", { name: "Fundamental summarizer progress" }),
    ).toHaveAttribute("aria-valuenow", "100");
    await expect(agentFeedbackCard.getByText(/^Complete$/)).toHaveCount(3);
    await expect(agentFeedbackCard.getByText("3,583", { exact: true })).toHaveCount(3);

    for (const stageCard of [priceStage, technicalStage, actionStage, fundamentalsStage]) {
      const overflow = await stageCard.evaluate((element) => {
        const cardRect = element.getBoundingClientRect();
        const tolerance = 1;
        const overflowedText = [...element.querySelectorAll("span, button")]
          .filter((child) => child.getClientRects().length > 0)
          .map((child) => {
            const childRect = child.getBoundingClientRect();
            const overflows =
              childRect.left < cardRect.left - tolerance ||
              childRect.right > cardRect.right + tolerance ||
              childRect.top < cardRect.top - tolerance ||
              childRect.bottom > cardRect.bottom + tolerance;

            return overflows ? child.textContent?.trim() ?? child.tagName : null;
          })
          .filter(Boolean);

        return {
          clientWidth: element.clientWidth,
          overflowedText,
          scrollWidth: element.scrollWidth,
        };
      });

      expect(overflow.overflowedText).toEqual([]);
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

      const titleToCountGap = await stageCard.evaluate((element) => {
        const title = element.querySelector("span");
        const countLine = element.querySelector('[data-detail-tone="count"]');

        if (!title || !countLine) return null;

        return countLine.getBoundingClientRect().top - title.getBoundingClientRect().bottom;
      });

      expect(titleToCountGap).not.toBeNull();
      expect(titleToCountGap!).toBeLessThanOrEqual(24);
    }
  });

  test("running EOD stages animate the current step badge and keep the count detail under the title on mobile", async ({
    page,
  }) => {
    const now = "2026-04-27T15:43:03+09:00";
    await page.setViewportSize({ width: 320, height: 740 });

    await page.route("**/api/trading/market/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market: "KRX",
          state: "CLOSED",
          is_trading_day: true,
          is_open: false,
          server_time: now,
        }),
      });
    });
    await page.route("**/api/trading/quotes/tracked", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_state: "CLOSED",
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
            trade_date: "2026-04-27",
            price: {
              status: "ready",
              symbols_total: 2812,
              symbols_succeeded: 2812,
              symbols_failed: 0,
            },
            technical_analysis: {
              status: "running",
              symbols_total: 2812,
              symbols_succeeded: 206,
              symbols_failed: 0,
            },
            action_summary: {
              status: "ready",
              symbols_total: 2812,
              symbols_succeeded: 2812,
              symbols_failed: 0,
            },
            fundamentals: {
              status: "ready",
              symbols_total: 2273,
              symbols_succeeded: 2273,
              symbols_failed: 0,
            },
          },
          latest: {
            price_trade_date: "2026-04-24",
            technical_market_date: "2026-04-24",
            action_market_date: "2026-04-24",
          },
          fundamentals: {
            success: true,
            latest_date: "2026-04-24",
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
              processed: 2812,
              total: 2812,
              failed: 0,
            },
            technical_snapshots: {
              status: "running",
              processed: 206,
              total: 2812,
              failed: 0,
              current_step: "computing_technical_snapshot",
              current_activity: "Computing technical snapshot",
              current_symbol: "005930",
            },
          },
        }),
      });
    });
    await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-24",
          summary: {
            entries: 2812,
            requested_symbol: null,
            matched_symbols: [],
            missing_symbols: [],
            passed_count: 132,
            not_passed_count: 2680,
          },
          items: [],
        }),
      });
    });
    await page.route("**/api/trading/eod/market-risk-filters?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-24",
          summary: {
            entries: 2812,
            requested_symbol: null,
            matched_symbols: [],
            missing_symbols: [],
            passed_count: 2410,
            watchlist_count: 210,
            failed_count: 192,
          },
          items: [],
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: {
            id: 17,
            market_date: "2026-04-24",
            trigger: "internal_ops_cli",
            status: "completed",
            fs_div: "CFS",
            force: false,
            symbol_limit: null,
            symbol_offset: 0,
            symbols_total: 2273,
            symbols_checked: 2273,
            symbols_missing: 0,
            symbols_stale: 0,
            symbols_fresh: 2273,
            symbols_refreshed: 0,
            symbols_failed: 0,
            events_detected: 0,
            events_captured: 0,
            events_failed: 0,
            error_message: null,
            run_metadata: {},
            started_at: "2026-04-24T08:56:58.357390+09:00",
            completed_at: "2026-04-24T09:11:58.357390+09:00",
          },
          runs: [],
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
            expected_agents: ["eod-summarizer", "technical-summarizer", "fundamental-summarizer"],
          },
          summary: {
            run_status: "completed",
            is_live: false,
            latest_feedback_at: now,
            seconds_since_last_feedback: 120,
            stalled_threshold_seconds: 300,
            total_symbols: 2812,
            processed_symbols: 2812,
            completed_symbols: 2812,
            in_progress_symbols: 0,
            pending_symbols: 0,
            progress_ratio: 1,
            progress_percent: 100,
            failed_items: 0,
            completed_feedback_count: 2812,
            expected_feedback_count: 2812,
          },
        }),
      });
    });

    await page.goto("/dashboard");

    const eodStatusCard = await openEodStatusCard(page);
    const technicalStage = eodStatusCard.locator('[aria-label="Technical Analysis freshness"]');
    const runningPill = technicalStage.locator('.pill[data-status-badge="running"]');

    await expect(technicalStage).toContainText(/Computing Technical Snapshot/i);
    await expect(technicalStage).toContainText("206 / 2,812");
    await expect(runningPill).toBeVisible();

    const runningAnimations = await runningPill.evaluate((element) => {
      const spinner = element.querySelector('[aria-hidden="true"]');

      return {
        badgeSweep: getComputedStyle(element, "::after").animationName,
        spinner: spinner ? getComputedStyle(spinner).animationName : null,
      };
    });

    expect(runningAnimations.badgeSweep).toMatch(/eodRunningStatusSweep$/);
    expect(runningAnimations.spinner).toMatch(/agentRoleSpin$/);

    const stageLayout = await technicalStage.evaluate((element) => {
      const title = [...element.querySelectorAll("span")].find(
        (child) => child.textContent?.trim() === "Technical Analysis",
      );
      const detail = element.querySelector('[data-detail-tone="count"]');
      const pill = element.querySelector('.pill[data-status-badge="running"]');

      if (!title || !detail || !pill) return null;

      const cardRect = element.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const detailRect = detail.getBoundingClientRect();
      const pillRect = pill.getBoundingClientRect();
      const overlapWidth = Math.max(0, Math.min(titleRect.right, pillRect.right) - Math.max(titleRect.left, pillRect.left));
      const overlapHeight = Math.max(0, Math.min(titleRect.bottom, pillRect.bottom) - Math.max(titleRect.top, pillRect.top));

      return {
        cardClientWidth: element.clientWidth,
        cardRight: cardRect.right,
        cardScrollWidth: element.scrollWidth,
        detailBottom: detailRect.bottom,
        detailLeft: detailRect.left,
        detailRight: detailRect.right,
        detailTop: detailRect.top,
        pillHeight: pillRect.height,
        pillLeft: pillRect.left,
        pillRight: pillRect.right,
        pillTop: pillRect.top,
        titleBadgeOverlapArea: overlapWidth * overlapHeight,
        titleBottom: titleRect.bottom,
        titleLeft: titleRect.left,
        titleWidth: titleRect.width,
      };
    });

    expect(stageLayout).not.toBeNull();
    expect(stageLayout!.titleBadgeOverlapArea).toBe(0);
    expect(stageLayout!.cardScrollWidth).toBeLessThanOrEqual(stageLayout!.cardClientWidth + 1);
    expect(stageLayout!.pillRight).toBeLessThanOrEqual(stageLayout!.cardRight + 1);
    expect(stageLayout!.pillHeight).toBeGreaterThan(28);
    expect(stageLayout!.titleWidth).toBeGreaterThan(80);
    expect(stageLayout!.detailTop).toBeGreaterThanOrEqual(stageLayout!.titleBottom - 1);
    expect(Math.abs(stageLayout!.detailLeft - stageLayout!.titleLeft)).toBeLessThanOrEqual(2);
    expect(stageLayout!.pillTop).toBeGreaterThanOrEqual(stageLayout!.detailBottom - 1);
  });

  test("EOD stage cards stay readable on mobile when today and latest differ without the latest patch card", async ({
    page,
  }) => {
    const now = "2026-04-24T09:20:00+09:00";

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
          },
          latest: {
            trade_date: "2026-04-23",
            updated_at: "2026-04-23T16:31:55+09:00",
            eod_status: "completed_with_errors",
            total: 3577,
            succeeded: 3570,
            failed: 7,
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
          stages: {},
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
            matched_symbols: [],
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
            matched_symbols: [],
            missing_symbols: [],
            passed_count: 3200,
            watchlist_count: 177,
            failed_count: 377,
          },
          items: [],
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: {
            id: 12,
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
            roles: {},
          },
        }),
      });
    });

    await page.goto("/dashboard");

    const processDrawer = await openProcessMonitorDrawer(page);
    const eodStatusCard = processDrawer.locator("article").filter({ hasText: "EOD Status" });
    const priceStage = eodStatusCard.locator('[data-stage="price"]');

    await expect(eodStatusCard.getByText("Latest EOD patch")).toHaveCount(0);
    await expect(eodStatusCard.locator("[data-stage]")).toHaveCount(4);
    await expect(priceStage).toContainText("3,570 / 3,577");
    await expect(priceStage).toContainText("Failed 7");

    const overflow = await priceStage.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const tolerance = 1;
      const overflowedText = [...element.querySelectorAll("span, strong, button")]
        .filter((child) => child.getClientRects().length > 0)
        .map((child) => {
          const childRect = child.getBoundingClientRect();
          const overflows =
            childRect.left < rect.left - tolerance ||
            childRect.right > rect.right + tolerance ||
            childRect.top < rect.top - tolerance ||
            childRect.bottom > rect.bottom + tolerance;

          return overflows ? child.textContent?.trim() ?? child.tagName : null;
        })
        .filter(Boolean);

      return {
        clientWidth: element.clientWidth,
        overflowedText,
        scrollWidth: element.scrollWidth,
      };
    });

    expect(overflow.overflowedText).toEqual([]);
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });

  test("agent feedback stop confirmation posts the core control request on mobile", async ({ page }) => {
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

    const processDrawer = await openProcessMonitorDrawer(page);
    const progressCard = processDrawer.locator("article").filter({ hasText: "Agent Feedback" });
    const stopButton = progressCard.getByRole("button", { name: agentFeedbackStopButtonLabel });
    await expect(stopButton).toBeVisible();
    await stopButton.click();

    const stopDialog = page.getByRole("dialog", { name: agentFeedbackStopDialogLabel });
    await expect(stopDialog).toBeVisible();
    await expect(stopDialog.getByRole("button", { name: /close/i })).toHaveCount(0);
    await expect(stopDialog).not.toContainText("실제 중단 동작은 추후 연결할 예정입니다.");

    await stopDialog.getByRole("button", { name: yesLabel }).click();

    await expect.poll(() => JSON.stringify(stopControlRequestBody)).toBe(
      JSON.stringify({
        action: "kill",
        signal_name: "SIGKILL",
        port: 8000,
      }),
    );
    await expect(stopDialog).toHaveCount(0);
  });
});

test.describe("dashboard desktop process monitor canonical truth", () => {
  test.use({
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });

  test("desktop process monitor trigger mirrors partial canonical pipeline counts", async ({ page }) => {
    const pipelineStatus: MockPipelineStatus = "partial";
    await mockDashboardProcessStatusApis(page, () => pipelineStatus);
    await page.addInitScript(() => {
      window.localStorage.setItem("trading-web.locale", JSON.stringify("ko"));
    });

    await page.goto("/dashboard");

    await expectAllVisibleProcessMonitorTriggersMirrorCanonical(page);

    const processDrawer = await openProcessMonitorDrawer(page);
    const canonicalPipeline = processDrawer.getByLabel(/Canonical daily pipeline status|표준 일별 파이프라인 상태/);
    await expect(canonicalPipeline).toContainText(/Partial|부분 완료/);
    await expect(canonicalPipeline).toContainText(/15\s*\/\s*24/);
    await expect(canonicalPipeline).toContainText(/fallback inference|fallback 추론/);
    await expectAllVisibleProcessMonitorTriggersMirrorCanonical(page);
  });
});
