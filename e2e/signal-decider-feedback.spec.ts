import { expect, test, type Locator, type Page } from "@playwright/test";

const now = "2026-04-27T16:30:00+09:00";

type SignalDeciderFeedbackMode = "normal" | "empty";
type MockDashboardShellOptions = {
  eodFreshnessDelayMs?: number;
  feedbackDelayMs?: number;
  failEodFreshness?: boolean;
  failSignalDeciderFeedback?: boolean;
  failSignalDeciderFeedbackRequestNumber?: number;
  failShortTermDeciderFeedback?: boolean;
  shortTermDeciderFeedbackMode?: SignalDeciderFeedbackMode;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function expectHorizontalCentersAligned(left: Locator, right: Locator, tolerancePx = 4) {
  const [leftBox, rightBox] = await Promise.all([left.boundingBox(), right.boundingBox()]);
  if (!leftBox || !rightBox) {
    throw new Error("Expected both elements to be visible before checking alignment.");
  }

  const leftCenterX = leftBox.x + leftBox.width / 2;
  const rightCenterX = rightBox.x + rightBox.width / 2;
  expect(Math.abs(leftCenterX - rightCenterX)).toBeLessThanOrEqual(tolerancePx);
}

async function getActiveElementState(page: Page) {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;

    return {
      inDialog: Boolean(element?.closest('[role="dialog"][aria-modal="true"]')),
      label: (element?.getAttribute("aria-label") || element?.textContent || "").replace(/\s+/g, " ").trim(),
    };
  });
}

async function mockDashboardShell(page: Page, options: MockDashboardShellOptions = {}) {
  let signalDeciderFeedbackRequestCount = 0;
  let shouldFailSignalDeciderFeedback = options.failSignalDeciderFeedback ?? false;
  let signalDeciderFeedbackMode: SignalDeciderFeedbackMode = "normal";

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
        market_date: "2026-04-27",
        items: [],
      }),
    });
  });
  await page.route("**/api/trading/execution/runtime/daily-board**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        market_date: "2026-04-27",
        items: [
          {
            symbol: "005930",
            name: "Samsung Electronics",
            market: "KOSPI",
            intent: "next_open_buy",
            status: "scheduled",
            target_trade_date: "2026-04-28",
            target_price: 82000,
            stop_loss_price: 73500,
            market_close_price: 79500,
          },
          {
            symbol: "000660",
            name: "SK hynix",
            market: "KOSPI",
            intent: "next_open_buy",
            status: "scheduled",
            target_trade_date: "2026-04-28",
            target_price: 124000,
            stop_loss_price: 116500,
            market_close_price: 120000,
          },
        ],
      }),
    });
  });
  await page.route("**/api/trading/eod/freshness", async (route) => {
    if (options.eodFreshnessDelayMs) {
      await delay(options.eodFreshnessDelayMs);
    }

    if (options.failEodFreshness) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "freshness temporarily unavailable",
        }),
      });
      return;
    }

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
    const url = new URL(route.request().url());
    const marketDate = url.searchParams.get("market_date") ?? "2026-04-27";

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        request: {
          market_date: marketDate,
          symbols: null,
          expected_agents: ["eod-summarizer", "technical-summarizer", "fundamental-summarizer", "signal-decider"],
        },
        summary: {
          run_id: "feedback-cycle-2026-04-27",
          run_status: "completed",
          run_table_status: "completed",
          cycle_status: "completed",
          is_live: false,
          run_started_at: "2026-04-27T06:50:00+00:00",
          run_completed_at: "2026-04-27T07:45:00+00:00",
          current_role: null,
          completed_roles: ["eod-summarizer", "technical-summarizer", "fundamental-summarizer", "signal-decider"],
          remaining_roles: [],
          latest_feedback_at: "2026-04-27T07:45:00+00:00",
          seconds_since_last_feedback: 120,
          stalled_threshold_seconds: 300,
          total_symbols: 3,
          processed_symbols: 3,
          completed_symbols: 2,
          in_progress_symbols: 0,
          pending_symbols: 0,
          progress_ratio: 1,
          progress_percent: 100,
          failed_items: 0,
          completed_feedback_count: 15,
          expected_feedback_count: 15,
        },
        result: {
          market_date: marketDate,
          roles: {
            "signal-decider": {
              requested_count: 3,
              completed_count: 3,
              error_count: 0,
            },
          },
        },
      }),
    });
  });
  await page.route("**/api/trading/agent-context/feedback?**", async (route) => {
    const url = new URL(route.request().url());
    const hasMarketDate = url.searchParams.has("market_date");
    const marketDate = url.searchParams.get("market_date") ?? "2026-04-27";
    const agentName = url.searchParams.get("agent_name") ?? "signal-decider";
    const isSignalDeciderRead = agentName === "signal-decider";
    const isShortTermDeciderRead = agentName === "short-term-decider";

    if (hasMarketDate && isSignalDeciderRead) {
      signalDeciderFeedbackRequestCount += 1;
    }

    if (hasMarketDate && options.feedbackDelayMs) {
      await delay(options.feedbackDelayMs);
    }

    if (
      hasMarketDate &&
      isSignalDeciderRead &&
      (shouldFailSignalDeciderFeedback ||
        signalDeciderFeedbackRequestCount === options.failSignalDeciderFeedbackRequestNumber)
    ) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "temporary feedback outage",
        }),
      });
      return;
    }

    if (hasMarketDate && isShortTermDeciderRead && options.failShortTermDeciderFeedback) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "temporary feedback outage",
        }),
      });
      return;
    }

    if (hasMarketDate && isShortTermDeciderRead && options.shortTermDeciderFeedbackMode === "empty") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: marketDate,
            symbols: [],
            agent_name: "short-term-decider",
            limit: 200,
          },
          summary: {
            count: 0,
          },
          items: [],
        }),
      });
      return;
    }

    if (signalDeciderFeedbackMode === "empty") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: marketDate,
            symbols: [],
            agent_name: agentName,
            limit: 200,
          },
          summary: {
            count: 0,
          },
          items: [],
        }),
      });
      return;
    }

    if (agentName === "short-term-decider") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: marketDate,
            symbols: [],
            agent_name: "short-term-decider",
            limit: 200,
          },
          summary: {
            count: 2,
          },
          items: [
            {
              id: "short-005930",
              market_date: marketDate,
              symbol: "005930",
              agent: {
                name: "short-term-decider",
                run_id: "short-term-cycle-2026-04-27",
              },
              summary: {},
              feedback: {
                role: "short-term-decider",
                symbol: "005930",
                market_date: marketDate,
                short_term_label: "watch_for_trigger",
                confidence_score_10: 8,
                conviction_score_10: 6,
                thesis_summary: "Trigger only if Samsung clears the opening range with foreign flow confirmation.",
                trigger_condition: "Break above 82,000 with turnover expansion",
                entry_condition: "Enter after trigger confirmation",
                target_price: 85000,
                stop_loss_price: 79000,
                invalidation_condition: "Avoid if it gaps above target before entry",
                suggested_holding_period: "1-3 sessions",
                supporting_evidence: ["Opening range held", { label: "Flow", summary: "Foreign flow positive" }],
                risk_flags: ["Avoid chase after gap-up open"],
                missing_factor_score: true,
                turnover_liquidity_anomaly: "Turnover spike versus 20d average",
                recent_external_news_count: 2,
                dart_events_count: 1,
                investor_flow_context: "Foreign net buy improved",
                sector_context: "Semiconductor tape firm",
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
              received_at: "2026-04-27T07:47:00+00:00",
            },
            {
              id: "short-000660",
              market_date: marketDate,
              symbol: "000660",
              agent: {
                name: "short-term-decider",
                run_id: "short-term-cycle-2026-04-27",
              },
              summary: {},
              feedback: {
                role: "short-term-decider",
                symbol: "000660",
                market_date: marketDate,
                short_term_label: "avoid_chase",
                confidence_score_10: 7,
                conviction_score_10: 6,
                thesis_summary: "Avoid chasing SK hynix until a clean pullback appears.",
                trigger_condition: "Wait for pullback near support",
                entry_condition: "No entry unless liquidity normalizes",
                target_price: 128000,
                stop_loss_price: 118000,
                invalidation_condition: "Reject if spread widens into the open",
                suggested_holding_period: "Intraday to 2 sessions",
                supporting_evidence: ["Liquidity spike is unstable"],
                risk_flags: ["Liquidity anomaly"],
                signal_feature_absence: true,
                incomplete_intraday_context: true,
                recent_external_news_count: 0,
                dart_events_count: 0,
                sector_context: "Memory names mixed",
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
              received_at: "2026-04-27T07:46:00+00:00",
            },
          ],
        }),
      });
      return;
    }

    if (marketDate === "2026-05-06") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: marketDate,
            symbols: [],
            agent_name: "signal-decider",
            limit: 200,
          },
          summary: {
            count: 1,
          },
          items: [
            {
              id: "insufficient-wait-row",
              market_date: marketDate,
              symbol: "003480",
              agent: {
                name: "signal-decider",
                run_id: "feedback-cycle-2026-05-06",
                version: "agent-2026.05",
              },
              summary: {},
              feedback: {
                role: "signal-decider",
                symbol: "003480",
                market_date: marketDate,
                preferred_action: "wait",
                next_day_open_action: "wait",
                target_price: 4100,
                stop_loss_price: 3700,
                confidence_score_10: 5,
                conviction_score_10: 4,
                thesis_summary: "Wait while the forward replay window matures.",
                policy_version: "decider-policy-2026.05",
                risk_flags: ["Follow-up price data is still maturing"],
                five_day_evaluation: {
                  evaluation_status: "insufficient_data",
                  evaluation_status_reason: "not_mature",
                  trading_days_remaining: 3,
                  expected_evaluation_window_start: "2026-05-07",
                  expected_evaluation_window_end: "2026-05-13",
                },
              },
              normalized_feedback: null,
              details: null,
              context: {
                symbol_day_context: {
                  company: {
                    name_ko: "한진중공업홀딩스",
                  },
                },
              },
              received_at: "2026-05-06T07:45:00+00:00",
            },
          ],
        }),
      });
      return;
    }

    if (marketDate === "2026-05-07") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: marketDate,
            symbols: [],
            agent_name: "signal-decider",
            limit: 200,
          },
          summary: {
            count: 1,
          },
          items: [
            {
              id: "insufficient-price-row",
              market_date: marketDate,
              symbol: "003480",
              agent: {
                name: "signal-decider",
                run_id: "feedback-cycle-2026-05-07",
                version: "agent-2026.05",
              },
              summary: {},
              feedback: {
                role: "signal-decider",
                symbol: "003480",
                market_date: marketDate,
                preferred_action: "wait",
                next_day_open_action: "wait",
                target_price: 4100,
                stop_loss_price: 3700,
                confidence_score_10: 5,
                conviction_score_10: 4,
                thesis_summary: "Wait row with a mature replay window but missing price bars.",
                policy_version: "decider-policy-2026.05",
                risk_flags: ["Follow-up price data is incomplete"],
                five_day_evaluation: {
                  evaluation_status: "insufficient_data",
                  window_mature: true,
                  evaluation_window_start: "2026-05-08",
                  evaluation_window_end: "2026-05-14",
                  missing_price_dates: ["2026-05-11", "2026-05-12"],
                },
              },
              normalized_feedback: null,
              details: null,
              context: {
                symbol_day_context: {
                  company: {
                    name_ko: "한진중공업홀딩스",
                  },
                },
              },
              received_at: "2026-05-07T07:45:00+00:00",
            },
          ],
        }),
      });
      return;
    }

    if (marketDate === "2026-04-24" && agentName === "signal-decider") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: marketDate,
            symbols: [],
            agent_name: "signal-decider",
            limit: 200,
          },
          summary: {
            count: 1,
          },
          items: [
            {
              id: "previous-gap-005930",
              market_date: marketDate,
              symbol: "005930",
              agent: {
                name: "signal-decider",
                run_id: "feedback-cycle-2026-04-24",
              },
              summary: {},
              feedback: {
                role: "signal-decider",
                symbol: "005930",
                market_date: marketDate,
                preferred_action: "wait",
                next_day_open_action: "wait",
                confidence_score_10: 6,
                conviction_score_10: 5,
                thesis_summary: "Wait while factor score is missing.",
                data_gap_flags: ["factor score missing"],
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
              received_at: "2026-04-24T07:45:00+00:00",
            },
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        request: {
          market_date: marketDate,
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
            market_date: marketDate,
            symbol: "005930",
            agent: {
              name: "signal-decider",
              run_id: "feedback-cycle-2026-04-27",
            },
            summary: {},
            feedback: {
              role: "signal-decider",
              symbol: "005930",
              market_date: marketDate,
              preferred_action: "buy",
              next_day_open_action: "buy",
              target_price: 82000,
              stop_loss_price: 73500,
              confidence_score_10: 8,
              conviction_score_10: 7,
              thesis_summary: "Momentum and fundamentals align for a tactical next-day setup.",
              decision_risks: ["Gap-down open", "Liquidity fade"],
              data_gap_flags: ["factor score missing", "DART disclosures absent"],
              policy_version: "decider-policy-2026.04",
              five_day_evaluation: {
                evaluation_status: "target_hit_before_stop",
                target_hit_within_5d: true,
                stop_hit_within_5d: false,
                first_hit: "target",
                max_favorable_excursion_pct: 4.25,
                max_adverse_excursion_pct: -1.2,
                evaluation_window_start: "2026-04-28",
                evaluation_window_end: "2026-05-06",
                data_quality_warnings: ["One daily bar was adjusted after the replay."],
              },
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
            market_date: marketDate,
            symbol: "000660",
            agent: {
              name: "signal-decider",
              run_id: "feedback-cycle-2026-04-27",
            },
            summary: {},
            feedback: {
              role: "signal-decider",
              symbol: "000660",
              market_date: marketDate,
              preferred_action: "wait",
              next_day_open_action: "wait",
              target_price: 124000,
              stop_loss_price: 116500,
              confidence_score_10: 6,
              conviction_score_10: 5,
              thesis_summary: "Wait for confirmation after the opening print.",
              risk_flags: ["Volume confirmation missing"],
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
    setSignalDeciderFeedbackFailure: (shouldFail: boolean) => {
      shouldFailSignalDeciderFeedback = shouldFail;
    },
    setSignalDeciderFeedbackMode: (mode: SignalDeciderFeedbackMode) => {
      signalDeciderFeedbackMode = mode;
    },
  };
}

async function seedDashboardSignalDeciderCache(page: Page, marketDate: string) {
  await page.addInitScript((date) => {
    const feedback = {
      request: {
        market_date: date,
        symbols: [],
        agent_name: "signal-decider",
        limit: 200,
      },
      summary: {
        count: 1,
      },
      items: [
        {
          id: "cached-dashboard-row",
          market_date: date,
          symbol: "005930",
          agent: {
            name: "signal-decider",
            run_id: `feedback-cycle-${date}`,
          },
          summary: {},
          feedback: {
            role: "signal-decider",
            symbol: "005930",
            market_date: date,
            preferred_action: "wait",
            next_day_open_action: "wait",
            confidence_score_10: 7,
            conviction_score_10: 6,
            thesis_summary: "Dashboard already loaded this stored signal-decider row.",
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
          received_at: `${date}T07:45:00+00:00`,
        },
      ],
    };

    window.sessionStorage.setItem(
      `kai.signalDeciderFeedback.v1:${date}`,
      JSON.stringify({
        version: 1,
        marketDate: date,
        cachedAt: Date.now(),
        source: "dashboard",
        feedback,
        progress: null,
      }),
    );
    window.sessionStorage.setItem(
      "kai.signalDeciderFeedback.v1:dates",
      JSON.stringify({
        version: 1,
        marketDates: [date],
      }),
    );
  }, marketDate);
}

test("dashboard signal-decider card shows planned board rows and links to the detail page", async ({ page }) => {
  await mockDashboardShell(page);

  await page.goto("/dashboard");

  const card = page.locator("#dashboard-freshness article[data-signal-decider-status]");
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("data-decider-overview-mode", "closed-planned");
  await expect(card).not.toContainText("일별 프로세스 진행 중");
  await expect(card).toContainText("Planned trades");
  await expect(card).toContainText("Samsung Electronics");
  await expect(card).toContainText("SK hynix");
  await expect(card).toContainText("Next-open buy");
  await expect(card).toContainText("Stop-loss");
  await expect(card).toContainText("Target");
  await expect(card).toContainText("Close price");
  await expect(card).not.toContainText("Momentum and fundamentals align");
  await expect(card).not.toContainText("2 / 3");
  await expect(card).not.toContainText("Buy 1 · Wait 1");
  const detailLink = card.getByRole("link", { name: /Open the signal-decider feedback detail page/i });
  await expect(detailLink).toHaveText("More");
  await expect(detailLink).toHaveAttribute("href", "/dashboard/signal-decider-feedback?marketDate=2026-04-27");
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

  await page.evaluate(() => {
    (window as Window & { __kaiFeedbackNavigationMarker?: string }).__kaiFeedbackNavigationMarker = "client-context";
  });
  await detailLink.click();
  await expect(page).toHaveURL(/\/dashboard\/signal-decider-feedback\?marketDate=2026-04-27/);
  await expect(page.getByRole("heading", { name: /Signal-decider feedback/i })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { __kaiFeedbackNavigationMarker?: string }).__kaiFeedbackNavigationMarker ?? null),
    )
    .toBeNull();
  await expect(page.getByRole("link", { name: /Back to dashboard/i })).toHaveCount(0);

  const samsungCard = page.getByRole("article", { name: /Samsung Electronics signal-decider feedback/i });
  await expect(samsungCard).toContainText("Buy");
  await expect(samsungCard).toContainText("Weak buy");
  await expect(samsungCard).toContainText(/Conviction\s*7\/10/);
  await expect(samsungCard).toContainText(/Target\s*₩82,000/);
  await expect(samsungCard).toContainText(/Stop-loss\s*₩73,500/);
  await expect(samsungCard).toContainText("1d +0.82%");
  await expect(samsungCard.getByTestId("signal-decider-horizon-outcomes")).toContainText(/1D.*Evaluated/);
  await expect(samsungCard.getByTestId("signal-decider-horizon-outcomes")).toContainText(/3D.*Evaluated/);
  await expect(samsungCard.getByTestId("signal-decider-horizon-outcomes")).toContainText(/5D.*Target hit/);
  await expect(samsungCard.getByTestId("signal-decider-horizon-outcomes")).not.toContainText(/1D computed|3D computed|5D computed/i);
  await expect(samsungCard).toContainText("5-day evaluation");
  await expect(samsungCard).toContainText(/Evaluation status\s*Target before stop/);
  await expect(samsungCard).toContainText(/Target hit within 5d\s*Yes/);
  await expect(samsungCard).toContainText(/Stop hit within 5d\s*No/);
  await expect(samsungCard).toContainText(/First event\s*Target first/);
  await expect(samsungCard).toContainText(/Max favorable excursion\s*\+4\.25%/);
  await expect(samsungCard).toContainText(/Max adverse excursion\s*-1\.20%/);
  await expect(samsungCard).toContainText(/Evaluation window\s*2026-04-28 -> 2026-05-06/);
  await expect(samsungCard).toContainText("One daily bar was adjusted after the replay.");
  await expect(samsungCard).toContainText("decider-policy-2026.04");
  await expect(samsungCard.getByTestId("signal-decider-score-area")).toContainText(/Confidence\s*8\/10/);

  const filters = page.getByLabel("Decider feedback filters");
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
  await expect(hynixCard).toContainText(/Verdict\s*Review pending/);
  await expect(hynixCard).toContainText(/Outcome\s*Review pending/);
  await expect(hynixCard).toContainText("Evaluation not computed");
  await expect(hynixCard).toContainText(/Policy\s*\[확인 필요\]/);
  await expect(hynixCard.getByTestId("signal-decider-review-pending")).toContainText(
    "Verdict and realized outcome are not present",
  );
  await expect(hynixCard).not.toContainText("Narrative-only review text is not result evidence.");
  await expect(hynixCard).not.toContainText("No verdict or realized outcome is stored yet.");
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

test("signal-decider feedback review dialog traps focus and hides mobile background controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDashboardShell(page);

  await page.goto("/dashboard/signal-decider-feedback?marketDate=2026-04-27&navContext=calendar");
  await page.getByRole("button", { name: /Korean/i }).click({ force: true });
  await expect(page.getByRole("heading", { name: "시그널 디사이더 피드백" })).toBeVisible();

  const openerCard = page.getByTestId("signal-decider-result-card").filter({ hasText: "Samsung Electronics" });
  const opener = openerCard.locator("button").filter({ hasText: "리뷰" });
  await opener.scrollIntoViewIfNeeded();
  await opener.click();

  const dialog = page.getByRole("dialog", { name: /Samsung Electronics/i });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.getByRole("button", { name: "닫기" })).toBeFocused();

  const openerSuppression = await opener.evaluate((element) => ({
    hiddenAncestor: Boolean(element.closest("[aria-hidden='true']")),
    inertAncestor: Boolean(element.closest("[inert]")),
  }));
  const bottomNavSuppression = await page.locator('[data-mobile-nav-item="calendar"]').evaluate((element) => ({
    ariaHidden: element.getAttribute("aria-hidden"),
    directInert: element.hasAttribute("inert"),
    hiddenAncestor: Boolean(element.closest("[aria-hidden='true']")),
    inertAncestor: Boolean(element.closest("[inert]")),
  }));
  expect(openerSuppression).toEqual({ hiddenAncestor: true, inertAncestor: true });
  expect(bottomNavSuppression).toEqual({
    ariaHidden: "true",
    directInert: true,
    hiddenAncestor: true,
    inertAncestor: true,
  });

  const backgroundSuppression = await page.evaluate(() => {
    const dialogElement = document.querySelector('[role="dialog"][aria-modal="true"]');
    const describeElement = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      return element
        ? {
            ariaHidden: element.getAttribute("aria-hidden"),
            inert: element.hasAttribute("inert"),
          }
        : null;
    };
    const outsideLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .filter((link) => !dialogElement?.contains(link))
      .map((link) => ({
        ariaHidden: link.getAttribute("aria-hidden"),
        directInert: link.hasAttribute("inert"),
        hiddenAncestor: Boolean(link.closest("[aria-hidden='true']")),
        inertAncestor: Boolean(link.closest("[inert]")),
        label: (link.getAttribute("aria-label") || link.textContent || "").replace(/\s+/g, " ").trim(),
      }));

    return {
      bottomNav: describeElement("[data-app-chrome-bottom-nav]"),
      bottomNavFrame: describeElement("[data-app-chrome-bottom-nav-frame]"),
      header: describeElement("[data-app-chrome-topbar]"),
      main: describeElement("main"),
      outsideLinks,
    };
  });
  expect(backgroundSuppression.main).toEqual({ ariaHidden: "true", inert: true });
  expect(backgroundSuppression.header).toEqual({ ariaHidden: "true", inert: true });
  expect(backgroundSuppression.bottomNavFrame).toEqual({ ariaHidden: "true", inert: true });
  expect(backgroundSuppression.bottomNav).toEqual({ ariaHidden: "true", inert: true });
  expect(backgroundSuppression.outsideLinks.length).toBeGreaterThan(0);
  expect(backgroundSuppression.outsideLinks.some((link) => link.label.includes("캘린더"))).toBe(true);
  for (const link of backgroundSuppression.outsideLinks) {
    expect(link.ariaHidden, `${link.label} should be directly aria-hidden`).toBe("true");
    expect(link.directInert, `${link.label} should be directly inert`).toBe(true);
    expect(link.hiddenAncestor, `${link.label} should have an aria-hidden ancestor`).toBe(true);
    expect(link.inertAncestor, `${link.label} should have an inert ancestor`).toBe(true);
  }

  const ariaSnapshot = await page.ariaSnapshot({ timeout: 5000 });
  expect(ariaSnapshot).toContain("dialog");
  expect(ariaSnapshot).toContain("Samsung Electronics");
  expect(ariaSnapshot).not.toContain("SK hynix");
  expect(ariaSnapshot).not.toMatch(/link "[^"]*(?:Calendar|캘린더|Dashboard|대시보드)/);

  for (let tabPress = 0; tabPress < 4; tabPress += 1) {
    await page.keyboard.press("Tab");
    const activeElementState = await getActiveElementState(page);
    expect(activeElementState.inDialog).toBe(true);
    expect(activeElementState.label).not.toContain("SK hynix");
  }

  await page.keyboard.press("Shift+Tab");
  const reverseTabState = await getActiveElementState(page);
  expect(reverseTabState.inDialog).toBe(true);
  expect(reverseTabState.label).not.toContain("SK hynix");

  await dialog.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByRole("dialog", { name: /Samsung Electronics/i })).toHaveCount(0);
  const restoredSuppression = await page.evaluate(() => {
    const describeElement = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      return element
        ? {
            ariaHidden: element.getAttribute("aria-hidden"),
            inert: element.hasAttribute("inert"),
          }
        : null;
    };

    return {
      bottomNav: describeElement("[data-app-chrome-bottom-nav]"),
      bottomNavFrame: describeElement("[data-app-chrome-bottom-nav-frame]"),
      bottomNavItem: describeElement('[data-mobile-nav-item="calendar"]'),
      header: describeElement("[data-app-chrome-topbar]"),
      main: describeElement("main"),
    };
  });
  expect(restoredSuppression).toEqual({
    bottomNav: { ariaHidden: null, inert: false },
    bottomNavFrame: { ariaHidden: null, inert: false },
    bottomNavItem: { ariaHidden: null, inert: false },
    header: { ariaHidden: null, inert: false },
    main: { ariaHidden: null, inert: false },
  });
  await expect(opener).toBeFocused();
});

test("signal-decider feedback detail localizes into Korean and keeps English default mode", async ({ page }) => {
  await mockDashboardShell(page);

  await page.goto("/dashboard/signal-decider-feedback?marketDate=2026-04-27");

  await expect(page.getByRole("heading", { name: /Signal-decider feedback/i })).toBeVisible();
  await expect(page.getByText(/Action mix/i)).toBeVisible();
  await expect(page.getByText(/Decision-support results/i)).toBeVisible();
  await expect(
    page
      .getByRole("form", { name: /Decider feedback filters/i })
      .getByRole("textbox", { name: /Search/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: /Samsung Electronics signal-decider feedback/i }).getByRole("button", { name: "Review" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Korean/i }).click({ force: true });

  await expect(page.getByRole("heading", { name: "시그널 디사이더 피드백" })).toBeVisible();
  await expect(page.getByText("액션 믹스")).toBeVisible();
  await expect(
    page
      .getByRole("form", { name: /디사이더 피드백 필터/i })
      .getByRole("textbox", { name: /검색/i }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "시그널 디사이더 피드백" })).toBeVisible();
  await expect(page.getByText("결정").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Signal-decider feedback");
  await expect(page.locator("body")).not.toContainText("Decision-support results");

  const koreanSamsungCard = page.getByRole("article", { name: /Samsung Electronics 시그널 디사이더 피드백/i });
  await expect(koreanSamsungCard.getByRole("button", { name: "리뷰" })).toBeVisible();
  await koreanSamsungCard.getByRole("button", { name: "리뷰" }).click();
  await expect(page.getByRole("dialog", { name: /Samsung Electronics/i })).toContainText("결정 리뷰");
  await expect(page.getByRole("dialog", { name: /Samsung Electronics/i })).toContainText("액션 플랜");
  await expect(page.getByRole("dialog", { name: /Samsung Electronics/i })).toContainText("닫기");
});

test("locale switch does not refetch feedback data or close the detail dialog", async ({ page }) => {
  const shell = await mockDashboardShell(page);

  await page.goto("/dashboard/signal-decider-feedback?marketDate=2026-04-27");
  const samsungCard = page.getByRole("article", { name: /Samsung Electronics signal-decider feedback/i });
  await expect(samsungCard.getByRole("button", { name: "Review" })).toBeVisible();
  await samsungCard.getByRole("button", { name: /Review|리뷰/ }).click();
  const dialog = page.getByRole("dialog", { name: /Samsung Electronics/i });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("The buy worked intraday");

  const requestCountBeforeLocale = shell.getSignalDeciderFeedbackRequestCount();
  await expect.poll(() => shell.getSignalDeciderFeedbackRequestCount()).toBe(requestCountBeforeLocale);

  await page
    .getByTestId("dashboard-header-language-switch")
    .locator('button[aria-label="Korean"]')
    .dispatchEvent("click");

  await expect(dialog).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(dialog).toContainText("결정 리뷰");
  await expect.poll(() => shell.getSignalDeciderFeedbackRequestCount()).toBe(requestCountBeforeLocale);
});

test("dashboard signal-decider card shows latest completed rows while the current cycle is running", async ({ page }) => {
  await mockDashboardShell(page);
  await page.unroute("**/api/trading/eod/freshness");
  await page.route("**/api/trading/eod/freshness", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        today: {
          trade_date: "2026-04-30",
          price: {
            status: "running",
            symbols_total: 3,
            symbols_succeeded: 1,
            symbols_failed: 0,
          },
          technical_analysis: {
            status: "pending",
            symbols_total: 3,
            symbols_succeeded: 0,
            symbols_failed: 0,
          },
          action_summary: {
            status: "pending",
            symbols_total: 3,
            symbols_succeeded: 0,
            symbols_failed: 0,
          },
        },
        latest: {
          price_trade_date: "2026-04-30",
          technical_market_date: "2026-04-29",
          action_market_date: "2026-04-29",
        },
      }),
    });
  });
  await page.unroute("**/api/trading/eod/pipeline/status?**");
  await page.route("**/api/trading/eod/pipeline/status?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        market_date: "2026-04-30",
        status: "running",
        stage_order: ["price_collection", "technical_snapshots", "action_summaries"],
        stages: {
          price_collection: { status: "running", processed: 1, total: 3, failed: 0 },
          technical_snapshots: { status: "pending", processed: 0, total: 3, failed: 0 },
          action_summaries: { status: "pending", processed: 0, total: 3, failed: 0 },
        },
      }),
    });
  });
  await page.unroute("**/api/trading/agent-context/feedback/progress?**");
  await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        request: {
          market_date: "2026-04-30",
          symbols: null,
          expected_agents: ["signal-decider"],
        },
        summary: {
          run_id: "feedback-cycle-2026-04-30",
          run_status: "running",
          run_table_status: "running",
          cycle_status: "running",
          is_live: true,
          run_started_at: "2026-04-30T06:50:00+00:00",
          run_completed_at: null,
          current_role: "signal-decider",
          completed_roles: [],
          remaining_roles: ["signal-decider"],
          latest_feedback_at: null,
          seconds_since_last_feedback: null,
          stalled_threshold_seconds: 300,
          total_symbols: 3,
          processed_symbols: 0,
          completed_symbols: 0,
          in_progress_symbols: 0,
          pending_symbols: 3,
          progress_ratio: 0,
          progress_percent: 0,
          failed_items: 0,
          completed_feedback_count: 0,
          expected_feedback_count: 3,
        },
        result: {
          market_date: "2026-04-30",
          roles: {
            "signal-decider": {
              requested_count: 3,
              completed_count: 0,
              error_count: 0,
            },
          },
        },
      }),
    });
  });
  await page.unroute("**/api/trading/agent-context/feedback?**");
  const feedbackQueries: string[] = [];
  await page.route("**/api/trading/agent-context/feedback?**", async (route) => {
    const url = new URL(route.request().url());
    feedbackQueries.push(url.search);
    const marketDate = url.searchParams.get("market_date");

    if (!marketDate) {
      await route.fulfill({
        contentType: "application/json",
        status: 422,
        body: JSON.stringify({
          detail: "market_date is required",
        }),
      });
      return;
    }

    if (marketDate === "2026-04-30") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: "2026-04-30",
            symbols: [],
            agent_name: "signal-decider",
            limit: 200,
          },
          summary: { count: 0 },
          items: [],
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        request: {
          market_date: "2026-04-29",
          symbols: [],
          agent_name: "signal-decider",
          limit: 200,
        },
        summary: { count: 1 },
        items: [
          {
            id: "previous-cycle-row",
            market_date: "2026-04-29",
            symbol: "005930",
            agent: {
              name: "signal-decider",
              run_id: "feedback-cycle-2026-04-29",
            },
            summary: {},
            feedback: {
              role: "signal-decider",
              symbol: "005930",
              market_date: "2026-04-29",
              preferred_action: "buy",
              next_day_open_action: "buy",
              confidence_score_10: 8,
              conviction_score_10: 7,
              thesis_summary: "Previous completed cycle row remains visible during today's run.",
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
            received_at: "2026-04-29T07:45:00+00:00",
          },
        ],
      }),
    });
  });

  await page.goto("/dashboard");

  const card = page.locator("#dashboard-freshness article[data-signal-decider-status]");
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("data-signal-decider-status", "running");
  await expect(card).toContainText("일별 프로세스 진행 중");
  await expect(card).not.toContainText("Latest completed recommendations: 2026-04-29");
  await expect(card).not.toContainText("Current cycle: 2026-04-30 signal-decider running");
  await expect(card).not.toContainText("Previous completed cycle row remains visible during today's run.");
  await expect(card).not.toContainText("Buy 1");
  await expect(card).not.toContainText("0 / 3");
  await expect(card.getByRole("link", { name: /Open the signal-decider feedback detail page/i })).toHaveAttribute(
    "href",
    "/dashboard/signal-decider-feedback?marketDate=2026-04-29",
  );
  await expect.poll(() => feedbackQueries.some((query) => query.includes("market_date=2026-04-29"))).toBe(true);
  expect(feedbackQueries.every((query) => query.includes("market_date="))).toBe(true);
});

test("dashboard signal-decider card hides current cycle on closed-market weekend days", async ({ page }) => {
  await mockDashboardShell(page);
  await page.unroute("**/api/trading/market/status");
  await page.route("**/api/trading/market/status", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        state: "WEEKEND",
        is_open: false,
        is_trading_day: false,
        server_time: "2026-05-09T09:00:00+09:00",
      }),
    });
  });
  await page.unroute("**/api/trading/eod/freshness");
  await page.route("**/api/trading/eod/freshness", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        today: {
          trade_date: "2026-05-09",
          price: {
            status: "pending",
            symbols_total: 3,
            symbols_succeeded: 0,
            symbols_failed: 0,
          },
          technical_analysis: {
            status: "pending",
            symbols_total: 3,
            symbols_succeeded: 0,
            symbols_failed: 0,
          },
          action_summary: {
            status: "pending",
            symbols_total: 3,
            symbols_succeeded: 0,
            symbols_failed: 0,
          },
        },
        latest: {
          price_trade_date: "2026-05-08",
          technical_market_date: "2026-05-08",
          action_market_date: "2026-05-08",
        },
      }),
    });
  });
  await page.unroute("**/api/trading/eod/pipeline/status?**");
  await page.route("**/api/trading/eod/pipeline/status?**", async (route) => {
    const url = new URL(route.request().url());
    const marketDate = url.searchParams.get("market_date") ?? "2026-05-09";

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        market_date: marketDate,
        status: marketDate === "2026-05-08" ? "completed" : "pending",
        stage_order: ["price_collection", "technical_snapshots", "action_summaries"],
        stages: {
          price_collection: {
            status: marketDate === "2026-05-08" ? "completed" : "pending",
            processed: marketDate === "2026-05-08" ? 3 : 0,
            total: 3,
            failed: 0,
          },
          technical_snapshots: {
            status: marketDate === "2026-05-08" ? "completed" : "pending",
            processed: marketDate === "2026-05-08" ? 3 : 0,
            total: 3,
            failed: 0,
          },
          action_summaries: {
            status: marketDate === "2026-05-08" ? "completed" : "pending",
            processed: marketDate === "2026-05-08" ? 3 : 0,
            total: 3,
            failed: 0,
          },
        },
      }),
    });
  });
  await page.unroute("**/api/trading/agent-context/feedback/progress?**");
  await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        request: {
          market_date: "2026-05-08",
          symbols: null,
          expected_agents: ["signal-decider"],
        },
        summary: {
          run_id: "feedback-cycle-2026-05-08",
          run_status: "completed",
          run_table_status: "completed",
          cycle_status: "completed",
          is_live: false,
          run_started_at: "2026-05-08T06:50:00+00:00",
          run_completed_at: "2026-05-08T07:45:00+00:00",
          current_role: "signal-decider",
          completed_roles: ["signal-decider"],
          remaining_roles: [],
          latest_feedback_at: "2026-05-08T07:45:00+00:00",
          seconds_since_last_feedback: 60,
          stalled_threshold_seconds: 300,
          total_symbols: 3,
          processed_symbols: 3,
          completed_symbols: 3,
          in_progress_symbols: 0,
          pending_symbols: 0,
          progress_ratio: 1,
          progress_percent: 100,
          failed_items: 0,
          completed_feedback_count: 3,
          expected_feedback_count: 3,
        },
        result: {
          market_date: "2026-05-08",
          roles: {
            "signal-decider": {
              requested_count: 3,
              completed_count: 3,
              error_count: 0,
            },
          },
        },
      }),
    });
  });
  await page.unroute("**/api/trading/agent-context/feedback?**");
  await page.route("**/api/trading/agent-context/feedback?**", async (route) => {
    const url = new URL(route.request().url());
    const marketDate = url.searchParams.get("market_date") ?? "2026-05-08";

    if (marketDate !== "2026-05-08") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: marketDate,
            symbols: [],
            agent_name: "signal-decider",
            limit: 200,
          },
          summary: { count: 0 },
          items: [],
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        request: {
          market_date: "2026-05-08",
          symbols: [],
          agent_name: "signal-decider",
          limit: 200,
        },
        summary: { count: 1 },
        items: [
          {
            id: "latest-friday-row",
            market_date: "2026-05-08",
            symbol: "005930",
            agent: {
              name: "signal-decider",
              run_id: "feedback-cycle-2026-05-08",
            },
            summary: {},
            feedback: {
              role: "signal-decider",
              symbol: "005930",
              market_date: "2026-05-08",
              preferred_action: "wait",
              next_day_open_action: "wait",
              confidence_score_10: 7,
              conviction_score_10: 6,
              thesis_summary: "Latest Friday recommendation remains the dashboard basis on the weekend.",
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
            received_at: "2026-05-08T07:45:00+00:00",
          },
        ],
      }),
    });
  });

  await page.goto("/dashboard");

  const card = page.locator("#dashboard-freshness article[data-signal-decider-status]");
  await expect(card).toBeVisible();
  await expect(card).toContainText(/Next-day exec|Today's plan|Planned trades|Samsung Electronics/);
  await expect(card).not.toContainText("일별 프로세스 진행 중");
  await expect(card).not.toContainText("Latest completed recommendations: 2026-05-08");
  await expect(card).not.toContainText("Current cycle");
  await expect(card).not.toContainText("2026-05-09 signal-decider");
  await expect(card).not.toContainText("Latest Friday recommendation remains the dashboard basis on the weekend.");
  await expect(card.getByRole("link", { name: /Open the signal-decider feedback detail page/i })).toHaveAttribute(
    "href",
    "/dashboard/signal-decider-feedback?marketDate=2026-05-08",
  );
});

test("signal-decider feedback detail stacks content without horizontal scrolling on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDashboardShell(page);

  await page.goto("/dashboard/signal-decider-feedback?marketDate=2026-04-27");

  await expect(page.getByRole("heading", { name: /Signal-decider feedback/i })).toBeVisible();
  await expect(page.locator("table").filter({ hasText: "Decision" })).toHaveCount(0);

  const samsungCard = page.getByRole("article", { name: /Samsung Electronics signal-decider feedback/i });
  await expect(samsungCard).toBeVisible();
  await expect(samsungCard).toContainText("Thesis");
  await expect(samsungCard).toContainText(/Conviction\s*7\/10/);
  await expect(samsungCard).toContainText(/Confidence\s*8\/10/);
  await expect(samsungCard).toContainText(/Target\s*₩82,000/);
  await expect(samsungCard).toContainText(/Stop-loss\s*₩73,500/);
  await expect(samsungCard).toContainText(/Verdict\s*Weak buy/);
  await expect(samsungCard).toContainText(/Outcome\s*1d \+0\.82%/);
  await expect(samsungCard).toContainText(/Trace evidence\s*2 risks · 2 factors · 1 gates · 1 evidence/);
  await expect(samsungCard).toContainText(/Policy\s*decider-policy-2026\.04/);
  await expect(samsungCard).toContainText("Captured");
  await expect(samsungCard.getByRole("button", { name: "Review" })).toBeVisible();

  const hynixCard = page.getByRole("article", { name: /SK hynix signal-decider feedback/i });
  await expect(hynixCard).toBeVisible();
  await expect(hynixCard).toContainText(/Verdict\s*Review pending/);
  await expect(hynixCard).toContainText(/Outcome\s*Review pending/);
  await expect(hynixCard).toContainText(/Policy\s*\[확인 필요\]/);
  await expect(hynixCard).toContainText(/Trace evidence\s*1 risks/);
  await expect(hynixCard).toContainText("Captured");
  await expect(hynixCard.getByRole("button", { name: "Review" })).toBeVisible();

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

test("signal-decider symbol links preserve feedback filters for the return path", async ({ page }) => {
  await mockDashboardShell(page);

  await page.goto("/dashboard/signal-decider-feedback?marketDate=2026-04-27&q=SK&feedbackAction=wait&feedbackSort=symbol");

  await expect(page.getByRole("heading", { name: /Signal-decider feedback/i })).toBeVisible();
  const hynixCard = page.getByRole("article", { name: /SK hynix signal-decider feedback/i });
  await expect(hynixCard).toBeVisible();
  await expect(page.getByRole("article", { name: /Samsung Electronics signal-decider feedback/i })).toHaveCount(0);
  await expect(hynixCard.getByRole("link", { name: /SK hynix.*000660/i })).toHaveAttribute(
    "href",
    /\/dashboard\/symbol\/000660\?.*marketDate=2026-04-27.*navContext=signal-decider-feedback.*q=SK.*feedbackAction=wait.*feedbackSort=symbol/,
  );
});

test("signal-decider feedback detail shows pending maturity copy instead of insufficient data", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDashboardShell(page);

  await page.goto("/dashboard/signal-decider-feedback?marketDate=2026-05-06");

  const waitCard = page.getByRole("article", { name: /한진중공업홀딩스 signal-decider feedback/i });
  await expect(waitCard).toBeVisible();
  await expect(waitCard.getByRole("link", { name: /한진중공업홀딩스.*003480/i })).toHaveAttribute(
    "href",
    /\/dashboard\/symbol\/003480\?.*marketDate=2026-05-06.*navContext=signal-decider-feedback/,
  );
  await expect(waitCard).toContainText("Wait");
  await expect(waitCard.getByTestId("signal-decider-horizon-outcomes")).toContainText(/5D.*Pending/);
  await expect(waitCard.getByTestId("signal-decider-horizon-outcomes")).not.toContainText(/5D computed/i);
  await expect(waitCard).toContainText(/Evaluation status\s*Pending 5D window/);
  await expect(waitCard).toContainText(/Evaluation window\s*2026-05-07 -> 2026-05-13/);
  await expect(waitCard).toContainText("Needs 3 more trading days before 5-day outcome can be computed.");
  await expect(waitCard).toContainText(/Verdict\s*Review pending/);
  await expect(waitCard).toContainText(/Outcome\s*Review pending/);
  await expect(waitCard).toContainText(/Target hit within 5d\s*Pending/);
  await expect(waitCard).toContainText(/Stop hit within 5d\s*Pending/);
  await expect(waitCard).toContainText(/First event\s*Pending/);
  await expect(waitCard).toContainText(/Max favorable excursion\s*Pending/);
  await expect(waitCard).not.toContainText("Insufficient data");
  await expect(waitCard).not.toContainText("[확인 필요]");

  await page.getByRole("button", { name: /Korean/i }).click({ force: true });

  const localizedWaitCard = page.getByRole("article", { name: /한진중공업홀딩스 시그널 디사이더 피드백/i });
  await expect(localizedWaitCard).toContainText("대기");
  await expect(localizedWaitCard).toContainText(/평가 상태\s*5D 기간 대기/);
  await expect(localizedWaitCard).toContainText("5일 결과를 계산하려면 거래일 3일이 더 필요합니다.");
  await expect(localizedWaitCard).toContainText(/판정\s*리뷰 대기/);
  await expect(localizedWaitCard).toContainText(/결과\s*리뷰 대기/);
  await expect(localizedWaitCard).toContainText(/5일 내 목표 도달\s*대기/);
  await expect(localizedWaitCard).toContainText(/5일 내 손절 도달\s*대기/);
  await expect(localizedWaitCard).toContainText(/선행 이벤트\s*대기/);
  await expect(localizedWaitCard).toContainText(/최대 유리 변동\s*대기/);
  await expect(localizedWaitCard).not.toContainText("[확인 필요]");
});

test("signal-decider feedback detail distinguishes true insufficient price bars", async ({ page }) => {
  await mockDashboardShell(page);

  await page.goto("/dashboard/signal-decider-feedback?marketDate=2026-05-07");

  const waitCard = page.getByRole("article", { name: /한진중공업홀딩스 signal-decider feedback/i });
  await expect(waitCard).toBeVisible();
  await expect(waitCard.getByTestId("signal-decider-horizon-outcomes")).toContainText(/5D.*Insufficient price data/);
  await expect(waitCard.getByTestId("signal-decider-horizon-outcomes")).not.toContainText(/5D computed/i);
  await expect(waitCard).toContainText(/Evaluation status\s*Insufficient price data/);
  await expect(waitCard).toContainText(/Target hit within 5d\s*Missing price data/);
  await expect(waitCard).toContainText(/Evaluation window\s*2026-05-08 -> 2026-05-14/);
  await expect(waitCard).toContainText("Price bars required for the 5-day window are missing.");
  await expect(waitCard).toContainText("2026-05-11");
  await expect(waitCard).toContainText("2026-05-12");
  await expect(waitCard).not.toContainText("Pending 5D window");
  await expect(waitCard).not.toContainText("Window not stored");
});

test("shared decider feedback route uses the pending 5D copy for signal rows", async ({ page }) => {
  await mockDashboardShell(page);

  await page.goto("/dashboard/decider-feedback?agent=signal-decider&marketDate=2026-05-06");

  await expect(page.getByRole("heading", { name: "Decider Feedback" })).toBeVisible();
  const waitCard = page.getByRole("article", { name: /한진중공업홀딩스 Decider Feedback/i });
  await expect(waitCard).toBeVisible();
  await expect(waitCard).toContainText(/Evaluation status\s*Pending 5D window/);
  await expect(waitCard).toContainText("Needs 3 more trading days before 5-day outcome can be computed.");
  await expect(waitCard).not.toContainText("Insufficient data");
  await expect(waitCard).not.toContainText("Window not stored");
});

test("signal-decider detail keeps dashboard stored rows when the direct detail read is empty", async ({ page }) => {
  const shell = await mockDashboardShell(page);

  await page.goto("/dashboard");

  const card = page.locator("#dashboard-freshness article[data-signal-decider-status]");
  await expect(card).toContainText("Samsung Electronics");
  await expect(card).not.toContainText("일별 프로세스 진행 중");
  await expect
    .poll(async () =>
      page.evaluate(() => window.sessionStorage.getItem("kai.signalDeciderFeedback.v1:2026-04-27") !== null),
    )
    .toBe(true);

  shell.setSignalDeciderFeedbackMode("empty");
  const detailLink = card.getByRole("link", { name: /Open the signal-decider feedback detail page/i });
  await expect(detailLink).toHaveAttribute("href", "/dashboard/signal-decider-feedback?marketDate=2026-04-27");

  await page.goto("/dashboard/signal-decider-feedback?marketDate=2026-04-27");
  await expect(page).toHaveURL(/\/dashboard\/signal-decider-feedback\?marketDate=2026-04-27/);
  await expect(page.getByRole("article", { name: /Samsung Electronics signal-decider feedback/i })).toBeVisible();
  await expect(page.getByRole("article", { name: /SK hynix signal-decider feedback/i })).toBeVisible();
  await expect(page.getByText("Loading Signal Decider feedback...")).toHaveCount(0);
  await expect(page.getByText(/No Signal Decider rows are stored/)).toHaveCount(0);
});

test("signal-decider detail stays anchored to an explicitly selected empty date", async ({ page }) => {
  await mockDashboardShell(page);
  const feedbackMarketDateRequests: Array<string | null> = [];
  await page.unroute("**/api/trading/agent-context/feedback?**");
  await page.route("**/api/trading/agent-context/feedback?**", async (route) => {
    const url = new URL(route.request().url());
    const marketDate = url.searchParams.get("market_date");
    feedbackMarketDateRequests.push(marketDate);

    if (marketDate === "2026-04-26") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: "2026-04-26",
            symbols: [],
            agent_name: "signal-decider",
            limit: 200,
          },
          summary: { count: 0 },
          items: [],
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
        summary: { count: 1 },
        items: [
          {
            id: "latest-row-should-not-drift",
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
              thesis_summary: "This latest row must not replace the explicitly selected empty date.",
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
        ],
      }),
    });
  });

  await page.goto("/dashboard/signal-decider-feedback?marketDate=2026-04-26");

  await expect(page.getByRole("heading", { name: /Signal-decider feedback/i })).toBeVisible();
  await expect(
    page.getByText(/available, but no rows matched the current filters|No Signal Decider feedback rows were returned for|No Signal Decider rows are stored/i),
  ).toBeVisible();
  await expect(page.getByRole("article", { name: /Samsung Electronics signal-decider feedback/i })).toHaveCount(0);
  expect(feedbackMarketDateRequests.every((marketDate) => marketDate === "2026-04-26")).toBe(true);
});

test("signal-decider detail resolves feedback gateway timeouts into an explicit error state", async ({ page }) => {
  await mockDashboardShell(page);
  await page.unroute("**/api/trading/agent-context/feedback?**");
  await page.route("**/api/trading/agent-context/feedback?**", async (route) => {
    await route.fulfill({
      status: 504,
      json: {
        error: "Upstream request timed out",
        message: "Timed out after 5.0s while loading /agent-context/feedback from trading-core.",
      },
    });
  });

  await page.goto("/dashboard/signal-decider-feedback?marketDate=2026-04-29");

  await expect(page.getByRole("heading", { name: /Signal-decider feedback/i })).toBeVisible();
  await expect(page.getByRole("main").getByText(/Timed out after 5\.0s while loading \/agent-context\/feedback/i)).toBeVisible();
  await expect(page.getByText("Loading Signal Decider feedback...")).toHaveCount(0);
  await expect(page.getByText("Unavailable").first()).toBeVisible();
  await expect(page.getByRole("article", { name: /Samsung Electronics signal-decider feedback/i })).toHaveCount(0);
});

test("signal-decider detail keeps cached latest rows when fallback freshness fails", async ({ page }) => {
  await seedDashboardSignalDeciderCache(page, "2026-04-27");
  await mockDashboardShell(page, {
    eodFreshnessDelayMs: 150,
    failEodFreshness: true,
    failSignalDeciderFeedbackRequestNumber: 1,
  });

  await page.goto("/dashboard/signal-decider-feedback");

  const cachedCard = page.getByRole("article", { name: /Samsung Electronics signal-decider feedback/i });
  await expect(cachedCard).toBeVisible();
  await expect(cachedCard).toContainText("Dashboard already loaded this stored signal-decider row.");
  await expect(page.getByText("Loading Signal Decider feedback...")).toHaveCount(0);
  await expect(page.getByText("freshness temporarily unavailable")).toHaveCount(0);
  await expect(page.getByText("Signal Decider feedback is unavailable.")).toHaveCount(0);

  await page.waitForTimeout(250);
  await expect(cachedCard).toBeVisible();
  await expect(cachedCard).toContainText("Dashboard already loaded this stored signal-decider row.");
  await expect(page.getByText("freshness temporarily unavailable")).toHaveCount(0);
});

test("signal-decider detail preserves market-date context for fallback freshness errors", async ({ page }) => {
  await mockDashboardShell(page, {
    failEodFreshness: true,
  });

  await page.goto("/dashboard/signal-decider-feedback");

  await expect(page.getByRole("heading", { name: /Signal-decider feedback/i })).toBeVisible();
  await expect(page.locator("body")).toContainText("Signal Decider market date is unavailable.");
  await expect(page.locator("body")).toContainText("freshness temporarily unavailable");
  await expect(page.locator("body")).not.toContainText("Signal Decider feedback is unavailable.");
});

test("dashboard signal-decider card retries after a transient completed-run feedback error", async ({ page }) => {
  const shell = await mockDashboardShell(page, {
    failSignalDeciderFeedback: true,
  });

  await page.goto("/dashboard");

  const card = page.locator("#dashboard-freshness article[data-signal-decider-status]");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Samsung Electronics");
  await expect(card).not.toContainText("일별 프로세스 진행 중");
  await expect(card).not.toContainText("Signal-decider feedback is unavailable.");

  const failedRequestCount = shell.getSignalDeciderFeedbackRequestCount();
  shell.setSignalDeciderFeedbackFailure(false);

  await expect
    .poll(shell.getSignalDeciderFeedbackRequestCount, { timeout: 7_000 })
    .toBeGreaterThan(failedRequestCount);
  await expect(card).toHaveAttribute("data-signal-decider-status", "completed");
  await expect(card).not.toContainText("Signal-decider feedback is unavailable.");
});

test("shared decider feedback route loads short-term decider rows and comparison", async ({ page }) => {
  const requestedAgents: string[] = [];
  await mockDashboardShell(page);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!url.pathname.endsWith("/api/trading/agent-context/feedback")) return;
    const agentName = url.searchParams.get("agent_name");
    if (agentName) requestedAgents.push(agentName);
  });

  await page.goto("/dashboard/decider-feedback?agent=short-term-decider&marketDate=2026-04-27&q=Samsung&feedbackAction=watch_for_trigger&feedbackSort=confidence");

  await expect(page.getByRole("heading", { name: "Decider Feedback" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Signal Decider" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Short-term Decider" })).toHaveAttribute("aria-current", "page");
  await expect.poll(() => requestedAgents).toContain("short-term-decider");

  const samsungCard = page.getByRole("article", { name: /Samsung Electronics Decider Feedback/i });
  await expect(samsungCard).toBeVisible();
  await expect(samsungCard).toContainText("Watch for trigger");
  await expect(samsungCard).toContainText("Tactical Decision");
  await expect(samsungCard).toContainText("Trigger Plan");
  await expect(samsungCard).toContainText("Short-term Thesis");
  await expect(samsungCard).toContainText("Break above 82,000 with turnover expansion");
  await expect(samsungCard).toContainText("Avoid if it gaps above target before entry");
  await expect(samsungCard).toContainText("Risk & Data Gaps");
  await expect(samsungCard).toContainText("Missing factor score");
  await expect(samsungCard).toContainText("Context badges");
  await expect(samsungCard).toContainText("External news · 2 recent");
  await expect(samsungCard.getByTestId("decider-comparison-row")).toContainText("Cross-decider comparison");
  await expect(samsungCard.getByTestId("decider-comparison-row")).toContainText("Signal action");
});

test("signal-decider feedback lifts unavailable comparison warning out of result cards", async ({ page }) => {
  await mockDashboardShell(page, {
    failShortTermDeciderFeedback: true,
  });

  await page.goto("/dashboard/signal-decider-feedback?marketDate=2026-04-27");

  const resultCards = page.getByTestId("signal-decider-result-card");
  await expect(resultCards).toHaveCount(2);

  const notice = page.getByTestId("decider-comparison-global-notice");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("Cross-decider comparison");
  await expect(notice).toContainText("No pair");

  const unavailableCopy =
    "Comparison is unavailable because the opposite-decider feedback read failed or has not returned.";
  await expect(page.getByText(unavailableCopy, { exact: true })).toHaveCount(1);
  await expect(page.getByTestId("decider-comparison-empty")).toHaveCount(0);
  await expect(resultCards.first()).toContainText("Momentum and fundamentals align for a tactical next-day setup.");
});

test("signal-decider feedback shows one no-pair notice when comparison count is zero", async ({ page }) => {
  await mockDashboardShell(page, {
    shortTermDeciderFeedbackMode: "empty",
  });

  await page.goto("/dashboard/signal-decider-feedback?marketDate=2026-04-27");

  const resultCards = page.getByTestId("signal-decider-result-card");
  await expect(resultCards).toHaveCount(2);

  const emptyCopy = "No matching opposite-decider output is stored for this symbol/date while viewing Signal Decider.";
  const notice = page.getByTestId("decider-comparison-global-notice");
  await expect(notice).toContainText("Cross-decider comparison");
  await expect(notice).toContainText(emptyCopy);
  await expect(page.getByText(emptyCopy, { exact: true })).toHaveCount(1);
  await expect(page.getByTestId("decider-comparison-empty")).toHaveCount(0);
  await expect(resultCards.first()).toContainText("Decision");
});

test("shared decider feedback route names the selected short-term agent while loading in Korean", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("trading-web.locale", JSON.stringify("ko"));
  });
  await mockDashboardShell(page, {
    feedbackDelayMs: 3_000,
  });

  await page.goto("/dashboard/decider-feedback?agent=short-term-decider&marketDate=2026-05-08&navContext=calendar");

  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.getByRole("link", { name: "단기 디사이더" })).toHaveAttribute("aria-current", "page");

  const report = page.getByTestId("decider-data-gaps-report");
  await expect(report).toContainText("단기 디사이더 피드백을 불러오는 중...");
  await expect(report).not.toContainText("시그널 디사이더 피드백을 불러오는 중...");
  await expect(page.locator("body")).toContainText("단기 디사이더 피드백을 불러오는 중...");
});

test("shared decider feedback route uses selected-agent empty copy for both decider tabs", async ({ page }) => {
  const shell = await mockDashboardShell(page);
  shell.setSignalDeciderFeedbackMode("empty");

  await page.goto("/dashboard/decider-feedback?agent=short-term-decider&marketDate=2026-04-27");

  await expect(page.getByRole("link", { name: "Short-term Decider" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("body")).toContainText("No Short-term Decider feedback rows were returned for 2026-04-27.");
  await expect(page.locator("body")).not.toContainText("No signal-decider feedback rows");
  await expect(page.getByTestId("decider-data-gaps-report")).toContainText(
    "No feedback rows are available for this date and agent",
  );

  await page.getByRole("link", { name: "Signal Decider" }).click();

  await expect(page.getByRole("link", { name: "Signal Decider" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("body")).toContainText("No Signal Decider feedback rows were returned for 2026-04-27.");
});

test("shared decider feedback route names short-term decider in unavailable copy", async ({ page }) => {
  await mockDashboardShell(page, {
    failShortTermDeciderFeedback: true,
  });

  await page.goto("/dashboard/decider-feedback?agent=short-term-decider&marketDate=2026-04-27");

  await expect(page.getByRole("link", { name: "Short-term Decider" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("body")).toContainText("Short-term Decider feedback is unavailable.");
  await expect(page.locator("body")).toContainText("temporary feedback outage");
  await expect(page.locator("body")).not.toContainText("Signal Decider feedback is unavailable.");
  await expect(page.locator("body")).not.toContainText("Signal-decider feedback is unavailable.");
});

test("decider data gaps report aggregates categories and filters symbol drilldown", async ({ page }) => {
  await mockDashboardShell(page);

  await page.goto("/dashboard/decider-feedback?agent=signal-decider&marketDate=2026-04-27");

  const report = page.getByTestId("decider-data-gaps-report");
  await expect(report.getByRole("heading", { name: "Decider Data Gaps" })).toBeVisible();
  await expect(report).toContainText(/Total feedback rows\s*2/);
  await expect(report).toContainText(/Rows with data-gap flags\s*2/);
  await expect(report).toContainText("Factor scores");
  await expect(report).toContainText("DART disclosures");
  await expect(report).toContainText("Turnover / liquidity");
  await expect(report).toContainText("+1 rows vs 2026-04-24");
  await expect(report.locator("tbody")).toContainText("factor score missing");
  await expect(report.locator("tbody")).toContainText("Factor scoring pipeline");

  await report.getByLabel("Gap category").selectOption("turnover_liquidity");
  await expect(report.locator("tbody")).toContainText("Turnover / liquidity");
  await expect(report.locator("tbody")).toContainText("000660");
  await expect(report.locator("tbody")).not.toContainText("DART disclosures");

  await report.getByLabel("Gap category").selectOption("all");
  await report.locator("select").nth(1).selectOption("005930");
  await expect(report).toContainText("signal-decider · factor score missing");
  await expect(report).toContainText("signal-decider · DART disclosures absent");

  await report.locator("select").nth(1).selectOption("all");
  await page.getByRole("link", { name: "Short-term Decider" }).click();
  const shortTermReport = page.getByTestId("decider-data-gaps-report");
  await expect(shortTermReport).toContainText("Short-term Decider");
  await expect(shortTermReport).toContainText("Signal features");
});

test("decider data gaps report keeps category context readable at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await mockDashboardShell(page);

  await page.goto("/dashboard/decider-feedback?agent=signal-decider&marketDate=2026-04-27");

  const report = page.getByTestId("decider-data-gaps-report");
  await expect(report.getByRole("heading", { name: "Decider Data Gaps" })).toBeVisible();
  await expect(report.locator("table")).toBeHidden();

  const factorCard = report.getByTestId("decider-data-gap-category-card").filter({ hasText: "Factor scores" });
  await expect(factorCard).toBeVisible();
  await expect(factorCard).toContainText("Affected symbols");
  await expect(factorCard).toContainText("005930");
  await expect(factorCard).toContainText("Affected agents");
  await expect(factorCard).toContainText("signal-decider");
  await expect(factorCard).toContainText("Example flag/reason");
  await expect(factorCard).toContainText("factor score missing");
  await expect(factorCard).toContainText("Suggested owner/source");
  await expect(factorCard).toContainText("Factor scoring pipeline");

  const overflow = await report.evaluate((element) => {
    const viewportWidth = window.innerWidth;
    return Array.from(element.querySelectorAll<HTMLElement>("*"))
      .filter((node) => {
        const style = window.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const rect = node.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        return rect.left < -1 || rect.right > viewportWidth + 1;
      })
      .map((node) => ({
        testId: node.getAttribute("data-testid"),
        text: node.textContent?.trim().slice(0, 80) ?? "",
      }));
  });
  expect(overflow).toEqual([]);

  const bodyOverflow = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
  expect(bodyOverflow).toBeLessThanOrEqual(1);
});

test("decider tabs preserve market date and filter context", async ({ page }) => {
  await mockDashboardShell(page);

  await page.goto("/dashboard/decider-feedback?agent=short-term-decider&marketDate=2026-04-27&q=Samsung&feedbackAction=watch_for_trigger&feedbackStatus=with-risk&feedbackSort=confidence");

  await page.getByRole("link", { name: "Signal Decider" }).click();
  await expect(page).toHaveURL(
    /\/dashboard\/decider-feedback\?agent=signal-decider&marketDate=2026-04-27&q=Samsung&feedbackAction=watch_for_trigger&feedbackStatus=with-risk&feedbackSort=confidence/,
  );
  await page.getByRole("link", { name: "Short-term Decider" }).click();
  await expect(page).toHaveURL(
    /\/dashboard\/decider-feedback\?agent=short-term-decider&marketDate=2026-04-27&q=Samsung&feedbackAction=watch_for_trigger&feedbackStatus=with-risk&feedbackSort=confidence/,
  );
});

test("dashboard short-term decider progress row links to shared short-term feedback tab", async ({ page }) => {
  await mockDashboardShell(page);
  await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        request: {
          market_date: "2026-04-27",
          symbols: null,
          expected_agents: ["signal-decider", "short-term-decider"],
        },
        summary: {
          run_id: "feedback-cycle-2026-04-27-deciders",
          run_status: "completed",
          run_table_status: "completed",
          cycle_status: "completed",
          is_live: false,
          run_started_at: "2026-04-27T06:50:00+00:00",
          run_completed_at: "2026-04-27T07:45:00+00:00",
          current_role: null,
          completed_roles: ["signal-decider", "short-term-decider"],
          remaining_roles: [],
          latest_feedback_at: "2026-04-27T07:45:00+00:00",
          seconds_since_last_feedback: 120,
          stalled_threshold_seconds: 300,
          total_symbols: 3,
          processed_symbols: 3,
          completed_symbols: 3,
          in_progress_symbols: 0,
          pending_symbols: 0,
          progress_ratio: 1,
          progress_percent: 100,
          failed_items: 0,
          completed_feedback_count: 4,
          expected_feedback_count: 4,
        },
        result: {
          market_date: "2026-04-27",
          roles: {
            "signal-decider": {
              requested_count: 2,
              completed_count: 2,
              error_count: 0,
            },
            "short-term-decider": {
              requested_count: 2,
              completed_count: 2,
              error_count: 0,
            },
          },
        },
      }),
    });
  });

  await page.goto("/dashboard");
  const processDrawer = await openProcessMonitorDrawer(page);
  const shortTermLink = processDrawer.getByRole("link", { name: /Short-term Decider/i });
  await expect(shortTermLink).toHaveAttribute(
    "href",
    /\/dashboard\/decider-feedback\?agent=short-term-decider&marketDate=2026-04-27/,
  );

  await shortTermLink.click();
  await expect(page).toHaveURL(/\/dashboard\/decider-feedback\?agent=short-term-decider&marketDate=2026-04-27/);
  await expect(page.getByRole("heading", { name: "Decider Feedback" })).toBeVisible();
});
