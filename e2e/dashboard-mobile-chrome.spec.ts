import { expect, test, type Locator, type Page } from "@playwright/test";

import { RELEASE_DISPLAY_LABEL } from "@/lib/release-version";
import { chromiumIPhone13 } from "./devices";

test.use(chromiumIPhone13);

const agentReviewCompletedLabel = /Agent review completed|에이전트 분석 완료/;
const agentFeedbackStopButtonLabel = /Stop|중단/;
const agentFeedbackStopDialogLabel = /Stop the agent feedback run\?|에이전트 피드백 실행을 중단할까요\?/;
const yesLabel = /Yes|예/;

async function openProcessMonitorDrawer(page: Page) {
  const drawer = page.getByRole("dialog", { name: /Daily process monitor/i });
  if (await drawer.isVisible().catch(() => false)) {
    return drawer;
  }

  await page.getByRole("button", { name: /Open process monitor/i }).first().click();
  await expect(drawer).toBeVisible();
  return drawer;
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

async function expectStatusChromeSeparated(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto("/dashboard");

  const processBar = page.getByRole("button", { name: /Open process monitor/i }).first();
  const releaseBadge = page.locator('[aria-label="Release version"]:visible').first();
  const localeSwitch = page.locator('[aria-label="Locale switcher"]:visible').first();
  const bottomNav = page.getByRole("navigation", { name: /Primary/i });

  await expect(processBar).toBeVisible();
  await expect(releaseBadge).toBeVisible();
  await expect(localeSwitch).toBeVisible();
  await expect(bottomNav).toBeVisible();

  const [processBarBox, releaseBox, localeBox, bottomNavBox] = await Promise.all([
    processBar.boundingBox(),
    releaseBadge.boundingBox(),
    localeSwitch.boundingBox(),
    bottomNav.boundingBox(),
  ]);

  if (!processBarBox || !releaseBox || !localeBox || !bottomNavBox) {
    throw new Error(`Expected visible dashboard chrome boxes at ${viewport.width}x${viewport.height}.`);
  }

  const processBarBottom = processBarBox.y + processBarBox.height;
  const auxiliaryControlsTop = Math.min(releaseBox.y, localeBox.y);

  expect(getOverlapArea(processBarBox, releaseBox)).toBe(0);
  expect(getOverlapArea(processBarBox, localeBox)).toBe(0);
  expect(getOverlapArea(processBarBox, bottomNavBox)).toBe(0);
  expect(auxiliaryControlsTop - processBarBottom).toBeGreaterThanOrEqual(4);
  expect(releaseBox.y).toBeLessThan(bottomNavBox.y);
  expect(localeBox.y).toBeLessThan(bottomNavBox.y);
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
    await expect(page.getByText(/Trading Dashboard/i)).toBeVisible();
    await expect(page.locator('[aria-label="Release version"]:visible')).toContainText(RELEASE_DISPLAY_LABEL);
    await expect(page.getByRole("heading", { name: /Decider, portfolio, and market state/i })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Search", exact: true })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Assets", exact: true })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "My Symbols", exact: true })).toBeVisible();
    await expect(page.getByText(/Live Connection/i)).toHaveCount(0);
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

  test("mobile process monitor grows above the toolbar as a floating overlay", async ({ page }) => {
    await page.goto("/dashboard");

    const bottomNav = page.getByRole("navigation", { name: /Primary/i });
    const processDrawer = await openProcessMonitorDrawer(page);
    await waitForProcessMonitorDrawerLayout(processDrawer);
    const [viewport, drawerBox, bottomNavBox, backdropAlpha] = await Promise.all([
      page.viewportSize(),
      processDrawer.boundingBox(),
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
    expect(bottomNavBox).not.toBeNull();

    if (!viewport || !drawerBox || !bottomNavBox) {
      throw new Error("Expected mobile process monitor and toolbar to have layout boxes.");
    }

    expect(backdropAlpha).toBeLessThan(0.5);
    expect(drawerBox.y).toBeGreaterThan(36);
    expect(drawerBox.height).toBeLessThan(viewport.height - 110);
    expect(drawerBox.y + drawerBox.height).toBeLessThanOrEqual(bottomNavBox.y + 2);
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

    const priceStage = page.locator('[aria-label="Price Fetch freshness"]');
    const technicalStage = page.locator('[aria-label="Technical Analysis freshness"]');
    const actionStage = page.locator('[aria-label="Action Summary freshness"]');
    const fundamentalsStage = page.locator('[aria-label="Fundamentals freshness"]');
    const processDrawer = await openProcessMonitorDrawer(page);
    const filteringCard = processDrawer.locator("article").filter({ hasText: "Filtering" });
    const piotroskiSection = filteringCard.locator('[data-filter-stage="piotroski"]');
    const marketRiskSection = filteringCard.locator('[data-filter-stage="kis-risk"]');
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
    await expect(piotroskiSection).toContainText("Completed");
    await expect(piotroskiSection).toContainText(/Checked\s*3,583/);
    await expect(piotroskiSection).toContainText(/Pass\s*132/);
    await expect(marketRiskSection).toContainText("KIS Risk");
    await expect(marketRiskSection).toContainText(/Pass\s*3,200/);
    await expect(marketRiskSection).toContainText(/Watchlist\s*180/);
    await expect(marketRiskSection).toContainText(/Fail\s*383/);
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
              status: "running",
              symbols_total: 2812,
              symbols_succeeded: 206,
              symbols_failed: 0,
            },
            technical_analysis: {
              status: "ready",
              symbols_total: 2812,
              symbols_succeeded: 2812,
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
              status: "running",
              processed: 206,
              total: 2812,
              failed: 0,
              current_step: "fetch_symbol_ohlcv",
              current_activity: "Loading historical candles",
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
    const priceStage = eodStatusCard.locator('[aria-label="Price Fetch freshness"]');
    const runningPill = priceStage.locator('.pill[data-status-badge="running"]');

    await expect(priceStage).toContainText(/Fetch Symbol Ohlcv/i);
    await expect(priceStage).toContainText("206 / 2,812");
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

    const stageLayout = await priceStage.evaluate((element) => {
      const title = [...element.querySelectorAll("span")].find((child) => child.textContent?.trim() === "Price Fetch");
      const detail = element.querySelector('[data-detail-tone="count"]');
      const pill = element.querySelector('.pill[data-status-badge="running"]');

      if (!title || !detail || !pill) return null;

      const titleRect = title.getBoundingClientRect();
      const detailRect = detail.getBoundingClientRect();
      const pillRect = pill.getBoundingClientRect();

      return {
        detailLeft: detailRect.left,
        detailRight: detailRect.right,
        detailTop: detailRect.top,
        pillLeft: pillRect.left,
        titleBottom: titleRect.bottom,
        titleLeft: titleRect.left,
      };
    });

    expect(stageLayout).not.toBeNull();
    expect(stageLayout!.detailTop).toBeGreaterThanOrEqual(stageLayout!.titleBottom - 1);
    expect(Math.abs(stageLayout!.detailLeft - stageLayout!.titleLeft)).toBeLessThanOrEqual(2);
    expect(stageLayout!.detailRight).toBeLessThanOrEqual(stageLayout!.pillLeft + 1);
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
