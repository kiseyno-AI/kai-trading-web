import { expect, test, type Locator, type Page } from "@playwright/test";

const now = "2026-04-27T16:30:00+09:00";

type MockDashboardShellOptions = {
  failSignalDeciderFeedbackRequestNumber?: number;
};

async function openProcessMonitorDrawer(page: Page) {
  const drawer = page.getByRole("dialog", { name: /Daily process monitor/i });
  if (await drawer.isVisible().catch(() => false)) {
    return drawer;
  }

  await page.getByRole("button", { name: /Open process monitor/i }).first().click();
  await expect(drawer).toBeVisible();
  return drawer;
}

async function expectVerticalCentersAligned(left: Locator, right: Locator, tolerancePx = 3) {
  const [leftBox, rightBox] = await Promise.all([left.boundingBox(), right.boundingBox()]);
  if (!leftBox || !rightBox) {
    throw new Error("Expected both elements to be visible before checking alignment.");
  }

  const leftCenterY = leftBox.y + leftBox.height / 2;
  const rightCenterY = rightBox.y + rightBox.height / 2;
  expect(Math.abs(leftCenterY - rightCenterY)).toBeLessThanOrEqual(tolerancePx);
}

async function expectHorizontalCentersAligned(left: Locator, right: Locator, tolerancePx = 4) {
  const [leftBox, rightBox] = await Promise.all([left.boundingBox(), right.boundingBox()]);
  if (!leftBox || !rightBox) {
    throw new Error("Expected both elements to be visible before checking alignment.");
  }

  const leftCenterX = leftBox.x + leftBox.width / 2;
  const rightCenterX = rightBox.x + rightBox.width / 2;
  expect(Math.abs(leftCenterX - rightCenterX)).toBeLessThanOrEqual(tolerancePx);
}

async function mockDashboardShell(page: Page, options: MockDashboardShellOptions = {}) {
  let signalDeciderFeedbackRequestCount = 0;

  await page.route("**/api/trading/market/status", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        state: "CLOSED",
        is_open: false,
        is_trading_day: true,
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
            symbols_total: 3,
            symbols_succeeded: 3,
            symbols_failed: 0,
          },
          technical_analysis: {
            status: "ready",
            symbols_total: 3,
            symbols_succeeded: 3,
            symbols_failed: 0,
          },
          action_summary: {
            status: "ready",
            symbols_total: 3,
            symbols_succeeded: 3,
            symbols_failed: 0,
          },
          fundamentals: {
            status: "ready",
            symbols_total: 3,
            symbols_succeeded: 3,
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
        status: "completed",
        stage_order: ["price_collection", "technical_snapshots", "action_summaries", "trending_ranks", "signal_features"],
        stages: {
          price_collection: { status: "completed", processed: 3, total: 3, failed: 0 },
          technical_snapshots: { status: "completed", processed: 3, total: 3, failed: 0 },
          action_summaries: { status: "completed", processed: 3, total: 3, failed: 0 },
        },
      }),
    });
  });
  await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        market_date: "2026-04-27",
        summary: {
          entries: 3,
          requested_symbol: null,
          matched_symbols: [],
          missing_symbols: [],
          passed_count: 3,
          not_passed_count: 0,
        },
        items: [],
      }),
    });
  });
  await page.route("**/api/trading/eod/market-risk-filters?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        market_date: "2026-04-27",
        summary: {
          entries: 3,
          requested_symbol: null,
          matched_symbols: [],
          missing_symbols: [],
          passed_count: 3,
          watchlist_count: 0,
          failed_count: 0,
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
          market_date: "2026-04-27",
          symbols: null,
          expected_agents: ["eod-summarizer", "technical-summarizer", "fundamental-summarizer", "signal-decider"],
        },
        summary: {
          run_id: "feedback-cycle-2026-04-27",
          run_status: "partial",
          run_table_status: "partial",
          cycle_status: "partial",
          is_live: false,
          run_started_at: "2026-04-27T06:50:00+00:00",
          run_completed_at: "2026-04-27T07:45:00+00:00",
          current_role: "signal-decider",
          completed_roles: ["eod-summarizer", "technical-summarizer", "fundamental-summarizer"],
          remaining_roles: ["signal-decider"],
          latest_feedback_at: "2026-04-27T07:45:00+00:00",
          seconds_since_last_feedback: 120,
          stalled_threshold_seconds: 300,
          total_symbols: 3,
          processed_symbols: 3,
          completed_symbols: 2,
          in_progress_symbols: 0,
          pending_symbols: 1,
          progress_ratio: 0.66,
          progress_percent: 66,
          failed_items: 0,
          completed_feedback_count: 14,
          expected_feedback_count: 15,
        },
        result: {
          market_date: "2026-04-27",
          roles: {
            "signal-decider": {
              requested_count: 3,
              completed_count: 2,
              error_count: 0,
            },
          },
        },
      }),
    });
  });
  await page.route("**/api/trading/agent-context/feedback?**", async (route) => {
    signalDeciderFeedbackRequestCount += 1;

    if (signalDeciderFeedbackRequestCount === options.failSignalDeciderFeedbackRequestNumber) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "temporary feedback outage",
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        request: {
          market_date: "2026-04-27",
          symbols: [],
          agent_name: "signal-decider",
          limit: 200,
        },
        summary: {
          count: 2,
        },
        items: [
          {
            id: 1,
            market_date: "2026-04-27",
            symbol: "005930",
            agent: {
              name: "signal-decider",
              run_id: "feedback-cycle-2026-04-27",
            },
            summary: {},
            feedback: {
              role: "signal-decider",
              symbol: "005930",
              market_date: "2026-04-27",
              preferred_action: "buy",
              next_day_open_action: "buy",
              target_price: 82000,
              stop_loss_price: 73500,
              confidence_score_10: 8,
              conviction_score_10: 7,
              thesis_summary: "Momentum and fundamentals align for a tactical next-day setup.",
              decision_risks: ["Gap-down open", "Liquidity fade"],
              policy_version: "decider-policy-2026.04",
              evaluation: {
                quality_verdict: "weak_buy",
                quality_reason: "The buy worked intraday but failed the 3d realized hurdle.",
                realized_results: {
                  "1d": {
                    return_pct: 0.82,
                    verdict: "neutral",
                    close_price: 82600,
                  },
                  "3d": {
                    realized_return_pct: -1.44,
                    verdict: "weak_buy",
                    close_price: 80800,
                  },
                },
                factors: [
                  { label: "Momentum", score: 0.74, status: "positive" },
                  { label: "Valuation", score: 0.32, status: "warning" },
                ],
                gate_results: {
                  liquidity: { status: "pass", reason: "Turnover above floor" },
                },
              },
              upstream_evidence: [{ source: "technical_snapshot", summary: "20d breakout persisted" }],
              traceability: {
                prompt_hash: "prompt-abc",
                feature_snapshot_id: "feature-005930-2026-04-27",
              },
            },
            normalized_feedback: null,
            details: null,
            context: {
              symbol_day_context: {
                company: {
                  name_ko: "Samsung Electronics",
                },
              },
            },
            received_at: "2026-04-27T07:45:00+00:00",
          },
          {
            id: 2,
            market_date: "2026-04-27",
            symbol: "000660",
            agent: {
              name: "signal-decider",
              run_id: "feedback-cycle-2026-04-27",
            },
            summary: {},
            feedback: {
              role: "signal-decider",
              symbol: "000660",
              market_date: "2026-04-27",
              preferred_action: "wait",
              next_day_open_action: "wait",
              target_price: 124000,
              stop_loss_price: 116500,
              confidence_score_10: 6,
              conviction_score_10: 5,
              thesis_summary: "Wait for confirmation after the opening print.",
              risk_flags: ["Volume confirmation missing"],
              policy_version: "decider-policy-2026.04",
              evaluation: {
                quality_reason: "Narrative-only review text is not result evidence.",
                review_conclusion: "No verdict or realized outcome is stored yet.",
              },
            },
            normalized_feedback: null,
            details: null,
            context: {
              symbol_day_context: {
                company: {
                  name_ko: "SK hynix",
                },
              },
            },
            received_at: "2026-04-27T07:44:00+00:00",
          },
        ],
      }),
    });
  });

  return {
    getSignalDeciderFeedbackRequestCount: () => signalDeciderFeedbackRequestCount,
  };
}

test("dashboard signal-decider card previews partial results and links to the detail page", async ({ page }) => {
  await mockDashboardShell(page);

  await page.goto("/dashboard");

  const card = page.locator("#dashboard-freshness article[data-signal-decider-status]");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Partial");
  await expect(card).toContainText("2 / 3");
  await expect(card).toContainText("Buy 1 · Wait 1");
  await expect(card).toContainText("Samsung Electronics");
  await expect(card).toContainText("Momentum and fundamentals align");

  const samsungPreviewRow = page.getByRole("listitem", { name: /Samsung Electronics signal-decider feedback/i });
  await expectVerticalCentersAligned(
    samsungPreviewRow.getByText("Buy", { exact: true }),
    samsungPreviewRow.getByText("7/10", { exact: true }),
  );
  const hynixPreviewRow = page.getByRole("listitem", { name: /SK hynix signal-decider feedback/i });
  await expectVerticalCentersAligned(
    hynixPreviewRow.getByText("Wait", { exact: true }),
    hynixPreviewRow.getByText("5/10", { exact: true }),
  );
  const detailLink = card.getByRole("link", { name: /Open the signal-decider feedback detail page/i });
  await expect(detailLink).toHaveText("More");
  await expectHorizontalCentersAligned(card, detailLink);
  const detailLinkBox = await detailLink.boundingBox();
  expect(detailLinkBox).not.toBeNull();
  expect(detailLinkBox!.height).toBeLessThanOrEqual(32);

  const processDrawer = await openProcessMonitorDrawer(page);
  const agentFeedbackCard = processDrawer.locator("article").filter({ hasText: "Agent Feedback" });
  await expect(agentFeedbackCard).toBeVisible();
  await expect(agentFeedbackCard.getByRole("listitem", { name: /Signal Decider/i })).toBeVisible();
  await expect(agentFeedbackCard.getByRole("progressbar")).toHaveCount(4);
  await expect(agentFeedbackCard.getByRole("progressbar", { name: /Signal Decider progress/i })).toBeVisible();
  await processDrawer.getByRole("button", { name: /Close monitor/i }).click();
  await expect(processDrawer).toHaveCount(0);

  await detailLink.click();
  await expect(page).toHaveURL(/\/dashboard\/signal-decider-feedback\?marketDate=2026-04-27/);
  await expect(page.getByRole("heading", { name: /Signal-decider feedback/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Back to dashboard/i })).toHaveCount(0);

  const samsungCard = page.getByRole("article", { name: /Samsung Electronics signal-decider feedback/i });
  await expect(samsungCard).toContainText("Buy");
  await expect(samsungCard).toContainText("Weak buy");
  await expect(samsungCard).toContainText(/Conviction\s*7\/10/);
  await expect(samsungCard).toContainText(/Target\s*₩82,000/);
  await expect(samsungCard).toContainText(/Stop-loss\s*₩73,500/);
  await expect(samsungCard).toContainText("1d +0.82%");
  await expect(samsungCard).toContainText("decider-policy-2026.04");
  await expect(samsungCard.getByTestId("signal-decider-score-area")).toContainText(/Confidence\s*8\/10/);

  const filters = page.getByLabel("Signal-decider feedback filters");
  await expect(filters.getByLabel("Verdict")).toHaveCount(0);
  await expect(filters.getByLabel("Policy")).toHaveCount(0);

  const actionFilter = filters.getByRole("combobox").first();
  await actionFilter.selectOption("wait");
  const hynixCard = page.getByRole("article", { name: /SK hynix signal-decider feedback/i });
  await expect(hynixCard).toBeVisible();
  await expect(hynixCard).toContainText("Wait for confirmation after the opening print.");
  await expect(hynixCard).toContainText(/Target\s*₩124,000/);
  await expect(hynixCard).toContainText(/Stop-loss\s*₩116,500/);
  await expect(hynixCard).toContainText("Review pending");
  await expect(hynixCard.getByTestId("signal-decider-review-pending")).toContainText(
    "Verdict and realized outcome are not present",
  );
  await expect(hynixCard).not.toContainText("Narrative-only review text is not result evidence.");
  await expect(hynixCard).not.toContainText("No verdict or realized outcome is stored yet.");
  await expect(hynixCard).not.toContainText("[확인 필요]");
  await expect(page.getByRole("article", { name: /Samsung Electronics signal-decider feedback/i })).toHaveCount(0);

  await actionFilter.selectOption("buy");
  await expect(samsungCard).toBeVisible();
  await samsungCard.getByRole("button", { name: "Review" }).click();
  await expect(page.getByRole("dialog", { name: /Samsung Electronics/i })).toContainText("The buy worked intraday");
  await expect(page.getByRole("dialog", { name: /Samsung Electronics/i })).toContainText("3d");
  await expect(page.getByRole("dialog", { name: /Samsung Electronics/i })).toContainText("-1.44%");
  await expect(page.getByRole("dialog", { name: /Samsung Electronics/i })).toContainText("Momentum");
  await expect(page.getByRole("dialog", { name: /Samsung Electronics/i })).toContainText("Liquidity");
  await expect(page.getByRole("dialog", { name: /Samsung Electronics/i })).toContainText("Technical Snapshot");
  await expect(page.getByRole("dialog", { name: /Samsung Electronics/i })).toContainText("Feature Snapshot Id");
});

test("signal-decider feedback detail stacks content without horizontal scrolling on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDashboardShell(page);

  await page.goto("/dashboard/signal-decider-feedback?marketDate=2026-04-27");

  await expect(page.getByRole("heading", { name: /Signal-decider feedback/i })).toBeVisible();
  await expect(page.locator("table")).toHaveCount(0);

  const samsungCard = page.getByRole("article", { name: /Samsung Electronics signal-decider feedback/i });
  await expect(samsungCard).toBeVisible();
  await expect(samsungCard).toContainText("Thesis");
  await expect(samsungCard).toContainText(/Conviction\s*7\/10/);
  await expect(samsungCard).toContainText(/Confidence\s*8\/10/);
  await expect(samsungCard).toContainText(/Target\s*₩82,000/);
  await expect(samsungCard).toContainText(/Stop-loss\s*₩73,500/);
  await expect(samsungCard).toContainText(/Outcome\s*1d \+0\.82%/);
  await expect(samsungCard).toContainText(/Policy\s*decider-policy-2026\.04/);
  await expect(samsungCard).toContainText("Captured");

  const overflowMetrics = await page.evaluate(() => ({
    documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    cardOverflows: Array.from(document.querySelectorAll('[data-testid="signal-decider-result-card"]')).map(
      (element) => element.scrollWidth - element.clientWidth,
    ),
  }));

  expect(overflowMetrics.documentOverflow).toBeLessThanOrEqual(1);
  expect(overflowMetrics.cardOverflows.length).toBeGreaterThan(0);
  for (const overflow of overflowMetrics.cardOverflows) {
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

test("dashboard signal-decider card retries after a transient completed-run feedback error", async ({ page }) => {
  const shell = await mockDashboardShell(page, {
    failSignalDeciderFeedbackRequestNumber: 2,
  });

  await page.goto("/dashboard");

  const card = page.locator("#dashboard-freshness article[data-signal-decider-status]");
  await expect(card).toBeVisible();
  await expect.poll(shell.getSignalDeciderFeedbackRequestCount, { timeout: 2_500 }).toBe(2);
  await expect(card).toContainText("Signal-decider feedback is unavailable. temporary feedback outage", {
    timeout: 1_000,
  });
  await expect.poll(shell.getSignalDeciderFeedbackRequestCount, { timeout: 7_000 }).toBeGreaterThanOrEqual(3);
  await expect(card).toContainText("Partial");
  await expect(card).toContainText("Samsung Electronics");
  await expect(card).not.toContainText("Signal-decider feedback is unavailable.");
});
