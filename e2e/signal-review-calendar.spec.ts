import { expect, test, type Page } from "@playwright/test";

type SignalReviewCalendarMockOptions = {
  calendarSummaryDelay?: Promise<void>;
  denseFeedbackActions?: Partial<Record<string, "buy" | "wait" | "reject" | "unknown">>;
  denseFeedbackDates?: Partial<Record<string, number>>;
  emptyFeedbackDates?: string[];
  feedbackDelays?: Partial<Record<string, Promise<void>>>;
  identityFallbackDate?: string;
  issue672Date?: string;
  issue623Date?: string;
  mixedHorizonDate?: string;
  pendingRationaleDate?: string;
  pendingWaitDate?: string;
  reviewDateErrorMessages?: Partial<Record<string, string>>;
  runningProgressDates?: string[];
  timeoutFeedbackDates?: string[];
  timeoutReviewDateDates?: string[];
  forceCalendarSummaryFailure?: boolean;
};

type SignalReviewCalendarRequestHits = {
  calendarSummary: number;
  feedback: number;
  progress: number;
  reviewDate: number;
};

type SignalReviewCalendarPayload = Record<string, unknown> & {
  evaluation?: Record<string, unknown>;
  next_day_open_action?: unknown;
  preferred_action?: unknown;
  quality_reason?: unknown;
  quality_verdict?: unknown;
  review_conclusion?: unknown;
  target_stop_result?: unknown;
};

type SignalReviewCalendarFeedbackItem = {
  id: string | number;
  market_date: string;
  symbol: string;
  agent: {
    name: string;
    run_id: string;
  };
  summary: Record<string, unknown>;
  feedback: SignalReviewCalendarPayload;
  normalized_feedback: SignalReviewCalendarPayload | null;
  details: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
  received_at: string;
};

function parseActionPreference(value: unknown) {
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim().toLowerCase();
  if (normalized === "buy" || normalized === "wait" || normalized === "reject") return normalized;
  if (normalized === "watch" || normalized === "hold" || normalized === "watchlist") return "wait";
  if (normalized === "avoid" || normalized === "skip") return "reject";
  return "unknown";
}

function getDenseFeedbackAction(date: string, options: SignalReviewCalendarMockOptions) {
  return options.denseFeedbackActions?.[date] ?? "buy";
}

function hasReviewEvidence(item: SignalReviewCalendarFeedbackItem) {
  const feedback = item.feedback;
  return (
    typeof feedback.quality_reason === "string" ||
    typeof feedback.quality_verdict === "string" ||
    typeof feedback.review_conclusion === "string" ||
    typeof feedback.target_stop_result === "string" ||
    typeof feedback.evaluation?.quality_reason === "string" ||
    typeof feedback.evaluation?.quality_verdict === "string" ||
    typeof feedback.evaluation?.review_conclusion === "string"
  );
}

function listMonthDates(month: string) {
  const [yearString, monthString] = month.split("-", 2);
  const year = Number(yearString);
  const monthNumber = Number(monthString);
  if (!Number.isFinite(year) || !Number.isFinite(monthNumber) || monthString.length !== 2 || monthNumber < 1 || monthNumber > 12) {
    return [];
  }

  const maxDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: maxDay }, (_, index) => `${yearString}-${monthString}-${String(index + 1).padStart(2, "0")}`);
}

function buildMockFeedbackItemsForDate(
  date: string,
  options: SignalReviewCalendarMockOptions,
): SignalReviewCalendarFeedbackItem[] {
  const denseFeedbackCount = options.denseFeedbackDates?.[date] ?? 0;
  if (denseFeedbackCount > 0) {
    const denseFeedbackAction = getDenseFeedbackAction(date, options);
    return Array.from({ length: denseFeedbackCount }, (_, index) => ({
      id: `dense-${date}-${index}`,
      market_date: date,
      symbol: `DENSE${String(index + 1).padStart(3, "0")}`,
      agent: {
        name: "signal-decider",
        run_id: `feedback-cycle-${date}`,
      },
      summary: {},
      feedback: {
        role: "signal-decider",
        symbol: `DENSE${String(index + 1).padStart(3, "0")}`,
        market_date: date,
        preferred_action: denseFeedbackAction,
        next_day_open_action: denseFeedbackAction,
        confidence_score_10: 8,
        conviction_score_10: 7,
        thesis_summary: "Dense mobile calendar regression row.",
      },
      normalized_feedback: null,
      details: null,
      context: {
        symbol_day_context: {
          company: {
            name_ko: `Dense Regression ${index + 1}`,
          },
        },
      },
      received_at: `${date}T07:45:00+00:00`,
    }));
  }

  if (options.pendingRationaleDate === date) {
    return [
      {
        id: "pending-rationale",
        market_date: date,
        symbol: "000850",
        agent: {
          name: "signal-decider",
          run_id: `feedback-cycle-${date}`,
        },
        summary: {},
        feedback: {
          role: "signal-decider",
          symbol: "000850",
          market_date: date,
          preferred_action: "buy",
          next_day_open_action: "buy",
          target_price: 49200,
          stop_loss_price: 45100,
          confidence_score_10: 7,
          conviction_score_10: 6,
          thesis_summary:
            "Fresh breakout-style strength is encouraging, but the replay verdict is not available yet.",
          decision_risks: [
            "Price action needs confirmation before the replay verdict is trusted.",
            "fresh_breakout_needs_follow_through",
            "range_to_trend_transition_risk",
          ],
          risk_flags: ["price_move_outpacing_fundamental_change", "missing_signal_features"],
          policy_version: "decider-policy-2026.04",
        },
        normalized_feedback: null,
        details: null,
        context: {
          symbol_day_context: {
            company: {
              name_ko: "Hwacheon Machinery",
            },
          },
        },
        received_at: `${date}T07:45:00+00:00`,
      },
    ];
  }

  if (options.mixedHorizonDate === date) {
    return [
      {
        id: "mixed-horizon",
        market_date: date,
        symbol: "051910",
        agent: {
          name: "signal-decider",
          run_id: `feedback-cycle-${date}`,
        },
        summary: {},
        feedback: {
          role: "signal-decider",
          symbol: "051910",
          market_date: date,
          preferred_action: "buy",
          next_day_open_action: "buy",
          target_price: 405000,
          stop_loss_price: 382000,
          confidence_score_10: 8,
          conviction_score_10: 7,
          thesis_summary: "Shorter replay horizons are available while the 5D window is still maturing.",
          policy_version: "decider-policy-2026.04",
          evaluation: {
            target_stop_result: "pending_maturity",
            quality_reason: "Shorter horizons are available before the 5D primary window matures.",
            realized_results: {
              "1d": {
                status: "target_hit",
                return_pct: 2.15,
                target_hit: true,
                stop_hit: false,
              },
              "3d": {
                status: "neither_hit",
                return_pct: 0.42,
                target_hit: false,
                stop_hit: false,
              },
            },
          },
          five_day_evaluation: {
            evaluation_status: "pending_evaluation_window",
            evaluation_status_reason: "not_mature",
            trading_days_remaining: 2,
            expected_evaluation_window_start: "2026-05-01",
            expected_evaluation_window_end: "2026-05-08",
          },
        },
        normalized_feedback: null,
        details: null,
        context: {
          symbol_day_context: {
            company: {
              name_ko: "LG Chem",
            },
          },
        },
        received_at: `${date}T07:45:00+00:00`,
      },
      {
        id: "mixed-horizon-stop-insufficient",
        market_date: date,
        symbol: "035420",
        agent: {
          name: "signal-decider",
          run_id: `feedback-cycle-${date}`,
        },
        summary: {},
        feedback: {
          role: "signal-decider",
          symbol: "035420",
          market_date: date,
          preferred_action: "buy",
          next_day_open_action: "buy",
          target_price: 222000,
          stop_loss_price: 209000,
          confidence_score_10: 7,
          conviction_score_10: 6,
          thesis_summary: "The first replay horizon hit the stop and later windows lack price bars.",
          policy_version: "decider-policy-2026.04",
          evaluation: {
            quality_reason: "The short replay failed before later horizons could be fully evaluated.",
            realized_results: {
              "1d": {
                status: "stop_hit",
                return_pct: -3.05,
                target_hit: false,
                stop_hit: true,
              },
              "3d": {
                evaluation_status: "insufficient_data",
                evaluation_status_reason: "missing_price_bars",
                notes: "Missing 3D replay bars.",
              },
            },
          },
          five_day_evaluation: {
            evaluation_status: "insufficient_data",
            evaluation_status_reason: "missing_price_bars",
            window_mature: true,
            missing_price_dates: ["2026-05-06"],
            evaluation_window_start: "2026-05-01",
            evaluation_window_end: "2026-05-08",
          },
        },
        normalized_feedback: null,
        details: null,
        context: {
          symbol_day_context: {
            company: {
              name_ko: "NAVER",
            },
          },
        },
        received_at: `${date}T07:46:00+00:00`,
      },
    ];
  }

  if (options.pendingWaitDate === date) {
    return [
      {
        id: "pending-wait",
        market_date: date,
        symbol: "003480",
        agent: {
          name: "signal-decider",
          run_id: `feedback-cycle-${date}`,
        },
        summary: {},
        feedback: {
          role: "signal-decider",
          symbol: "003480",
          market_date: date,
          preferred_action: "wait",
          next_day_open_action: "wait",
          confidence_score_10: 5,
          conviction_score_10: 4,
          thesis_summary: "Waiting for confirmation before any operator action is needed.",
          policy_version: "decider-policy-2026.05",
          five_day_evaluation: {
            evaluation_status: "pending_evaluation_window",
            evaluation_status_reason: "not_mature",
            trading_days_remaining: 2,
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
        received_at: `${date}T07:45:00+00:00`,
      },
    ];
  }

  if (options.issue672Date === date) {
    return [
      { companyName: "신영와코루", review: "1D target hit first; keep the wait call under review.", stop: 16200, symbol: "005800", target: 17900 },
      { companyName: "엔피케이", review: "Stop guard held while the 3D window stays unresolved.", stop: 1850, symbol: "048830", target: 2100 },
      { companyName: "나라셀라", review: "5D replay is pending; compare target and stop before feedback review.", stop: 4250, symbol: "405920", target: 4890 },
      { companyName: "조흥", review: "Sideways result needs a symbol drill-in before operator feedback.", stop: 172000, symbol: "002600", target: 190000 },
      { companyName: "성창오토텍", review: "Target/stop context must remain readable at the mobile edge.", stop: 4010, symbol: "080470", target: 4560 },
    ].map((row, index) => ({
      id: `issue-672-${row.symbol}`,
      market_date: date,
      symbol: row.symbol,
      agent: {
        name: "signal-decider",
        run_id: `feedback-cycle-${date}`,
      },
      summary: {},
      feedback: {
        role: "signal-decider",
        symbol: row.symbol,
        market_date: date,
        preferred_action: "wait",
        next_day_open_action: "wait",
        target_price: row.target,
        stop_loss_price: row.stop,
        confidence_score_10: 6,
        conviction_score_10: 5,
        thesis_summary: "Mobile selected-date decision context regression coverage.",
        evaluation: {
          target_stop_result: index === 0 ? "target_hit_first" : index === 1 ? "stop_hit_first" : "neither_hit",
          quality_reason: row.review,
          realized_results: {
            "1d": {
              status: index === 0 ? "target_hit" : index === 1 ? "stop_hit" : "neither_hit",
              return_pct: index === 1 ? -1.35 : 0.64 + index / 10,
              target_hit: index === 0,
              stop_hit: index === 1,
            },
          },
        },
      },
      normalized_feedback: null,
      details: null,
      context: {
        symbol_day_context: {
          company: {
            name_ko: row.companyName,
          },
        },
      },
      received_at: `${date}T07:${String(45 + index).padStart(2, "0")}:00+00:00`,
    }));
  }

  if (options.issue623Date === date) {
    return [
      {
        id: "issue-623-review-company",
        market_date: date,
        symbol: "004150",
        agent: {
          name: "signal-decider",
          run_id: `feedback-cycle-${date}`,
        },
        summary: {},
        feedback: {
          role: "signal-decider",
          symbol: "004150",
          market_date: date,
          preferred_action: "wait",
          next_day_open_action: "wait",
          confidence_score_10: 6,
          conviction_score_10: 5,
          thesis_summary: "Wait row with company metadata supplied by the review payload.",
        },
        normalized_feedback: null,
        details: {
          company_name: "한솔홀딩스",
          review_conclusion: "Replay review is pending for the 5-day window.",
          horizon_evaluations: {
            "5d": {
              evaluation_status: "pending_evaluation_window",
              evaluation_status_reason: "not_mature",
              notes: "Replay review is pending for the 5-day window.",
              trading_days_remaining: 2,
            },
          },
        },
        context: null,
        received_at: `${date}T07:45:00+00:00`,
      },
      {
        id: "issue-623-summary-company",
        market_date: date,
        symbol: "012630",
        agent: {
          name: "signal-decider",
          run_id: `feedback-cycle-${date}`,
        },
        summary: {
          name_ko: "HDC",
          horizon_evaluations: {
            "1d": {
              evaluation_status: "pending_evaluation_window",
              evaluation_status_reason: "not_mature",
              notes: "The 1-day replay window is not mature yet.",
              trading_days_remaining: 1,
            },
          },
        },
        feedback: {
          role: "signal-decider",
          symbol: "012630",
          market_date: date,
          preferred_action: "wait",
          next_day_open_action: "wait",
          confidence_score_10: 6,
          conviction_score_10: 5,
          thesis_summary: "Wait row with company metadata supplied by the summary payload.",
        },
        normalized_feedback: null,
        details: null,
        context: null,
        received_at: `${date}T07:46:00+00:00`,
      },
      {
        id: "issue-623-normalized-company",
        market_date: date,
        symbol: "000050",
        agent: {
          name: "signal-decider",
          run_id: `feedback-cycle-${date}`,
        },
        summary: {},
        feedback: {
          role: "signal-decider",
          symbol: "000050",
          market_date: date,
          preferred_action: "wait",
          next_day_open_action: "wait",
          confidence_score_10: 6,
          conviction_score_10: 5,
          thesis_summary: "Wait row with company metadata supplied by normalized feedback.",
        },
        normalized_feedback: {
          role: "signal-decider",
          symbol: "000050",
          market_date: date,
          preferred_action: "wait",
          next_day_open_action: "wait",
          company_name: "경방",
          quality_reason: "Replay review is pending for the 5-day window.",
        },
        details: null,
        context: null,
        received_at: `${date}T07:47:00+00:00`,
      },
    ];
  }

  if (options.identityFallbackDate === date) {
    return [
      {
        id: "identity-distinct-name",
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
          preferred_action: "buy",
          next_day_open_action: "buy",
          confidence_score_10: 8,
          conviction_score_10: 7,
          thesis_summary: "Distinct company metadata should render as name plus symbol.",
          company_name: "Samsung Electronics",
        },
        normalized_feedback: null,
        details: null,
        context: null,
        received_at: `${date}T07:45:00+00:00`,
      },
      {
        id: "identity-missing-name",
        market_date: date,
        symbol: "004150",
        agent: {
          name: "signal-decider",
          run_id: `feedback-cycle-${date}`,
        },
        summary: {},
        feedback: {
          role: "signal-decider",
          symbol: "004150",
          market_date: date,
          preferred_action: "wait",
          next_day_open_action: "wait",
          confidence_score_10: 6,
          conviction_score_10: 5,
          thesis_summary: "Missing company metadata should not duplicate the symbol.",
        },
        normalized_feedback: null,
        details: null,
        context: null,
        received_at: `${date}T07:46:00+00:00`,
      },
      {
        id: "identity-symbol-name",
        market_date: date,
        symbol: "010170",
        agent: {
          name: "signal-decider",
          run_id: `feedback-cycle-${date}`,
        },
        summary: {},
        feedback: {
          role: "signal-decider",
          symbol: "010170",
          market_date: date,
          preferred_action: "reject",
          next_day_open_action: "reject",
          confidence_score_10: 5,
          conviction_score_10: 4,
          thesis_summary: "Symbol-like company metadata should be treated as unavailable.",
          company_name: "010170",
        },
        normalized_feedback: null,
        details: null,
        context: {
          symbol_day_context: {
            company: {
              name_ko: "010170",
            },
          },
        },
        received_at: `${date}T07:47:00+00:00`,
      },
    ];
  }

  if (options.emptyFeedbackDates?.includes(date)) return [];

  if (date === "2026-04-27") {
    return [
      {
        id: 1,
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
          preferred_action: "buy",
          next_day_open_action: "buy",
          target_price: 82000,
          stop_loss_price: 73500,
          confidence_score_10: 8,
          conviction_score_10: 7,
          thesis_summary: "Momentum and fundamentals align for a tactical next-day setup.",
          decision_risks: ["Gap-down open"],
          policy_version: "decider-policy-2026.04",
          evaluation: {
            quality_verdict: "weak_buy",
            quality_reason: "The buy worked intraday but failed the 3d realized hurdle.",
            target_stop_result: "target_hit_first",
            review_conclusion: "Target hit intraday first, but the multi-day hold weakened.",
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
        market_date: date,
        symbol: "000660",
        agent: {
          name: "signal-decider",
          run_id: `feedback-cycle-${date}`,
        },
        summary: {},
        feedback: {
          role: "signal-decider",
          symbol: "000660",
          market_date: date,
          preferred_action: "wait",
          next_day_open_action: "wait",
          confidence_score_10: 6,
          conviction_score_10: 5,
          thesis_summary: "Wait for confirmation after the opening print.",
          risk_flags: ["Volume confirmation missing"],
          evaluation: {
            quality_verdict: "missed_opportunity",
            missed_opportunity: true,
            quality_reason: "Price cleared the confirmation band before the 3d horizon.",
            realized_results: {
              "3d": {
                return_pct: 4.18,
                verdict: "missed_opportunity",
              },
            },
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
    ];
  }

  return [];
}

function buildReviewDateResponse(marketDate: string, options: SignalReviewCalendarMockOptions) {
  const items = buildMockFeedbackItemsForDate(marketDate, options);
  const reviewedCount = items.filter(hasReviewEvidence).length;
  return {
    request: {
      market_date: marketDate,
    },
    summary: {
      count: items.length,
      review_status_counts: reviewedCount > 0 ? { reviewed: reviewedCount } : {},
    },
    items: items.map((item, index) => ({
      snapshot_id: `${marketDate}-${String(index + 1).padStart(3, "0")}`,
      symbol: item.symbol,
      market_date: item.market_date,
      run_id: item.agent.run_id,
      captured_at: item.received_at,
      decision: item.feedback,
      normalized_feedback: item.normalized_feedback,
      review: item.details,
      summary: item.summary,
      context: item.context,
    })),
  };
}

function buildCalendarSummaryResponse(month: string, options: SignalReviewCalendarMockOptions) {
  const monthDates = listMonthDates(month);
  const summaryItems = monthDates
    .map((date) => {
      const items = buildMockFeedbackItemsForDate(date, options);
      if (items.length === 0) return null;

      const actionCounts: Record<string, number> = {
        buy: 0,
        wait: 0,
        reject: 0,
        unknown: 0,
      };

      for (const item of items) {
        const action = parseActionPreference(item.feedback.next_day_open_action ?? item.feedback.preferred_action);
        actionCounts[action] += 1;
      }

      return {
        market_date: date,
        decision_count: items.length,
        decision_actions: actionCounts,
        review_status_counts: {
          reviewed: items.filter(hasReviewEvidence).length,
        },
        calendar_status: items.length > 0 ? "completed" : "empty",
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const decisionCount = summaryItems.reduce((sum, item) => sum + Number(item.decision_count), 0);
  const reviewedCount = summaryItems.reduce((sum, item) => sum + Number(item.review_status_counts.reviewed), 0);

  return {
    request: {
      month,
    },
    summary: {
      month,
      decision_count: decisionCount,
      reviewed_count: reviewedCount,
    },
    items: summaryItems,
  };
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

async function mockSignalReviewCalendar(page: Page, options: SignalReviewCalendarMockOptions = {}) {
  const requestHits: SignalReviewCalendarRequestHits = {
    calendarSummary: 0,
    feedback: 0,
    progress: 0,
    reviewDate: 0,
  };

  await page.route("**/api/trading/eod/freshness", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        today: {
          trade_date: "2026-04-27",
        },
        latest: {
          price_trade_date: "2026-04-27",
        },
      }),
    });
  });

  await page.route("**/api/trading/agent-context/feedback/calendar**", async (route) => {
    requestHits.calendarSummary += 1;
    await options.calendarSummaryDelay;

    if (options.forceCalendarSummaryFailure) {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Core calendar summary unavailable",
          message: "Fallback needed for compact month query.",
        }),
      });
      return;
    }

    const url = new URL(route.request().url());
    const month = url.searchParams.get("month") ?? "2026-04";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(buildCalendarSummaryResponse(month, options)),
    });
  });

  await page.route("**/api/trading/agent-context/feedback/review**", async (route) => {
    requestHits.reviewDate += 1;
    const url = new URL(route.request().url());
    const marketDate = url.searchParams.get("market_date") ?? "2026-04-27";
    const reviewDateErrorMessage = options.reviewDateErrorMessages?.[marketDate];
    if (reviewDateErrorMessage) {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Core feedback review unavailable",
          message: reviewDateErrorMessage,
        }),
      });
      return;
    }
    await options.feedbackDelays?.[marketDate];
    if (options.timeoutReviewDateDates?.includes(marketDate)) {
      await route.fulfill({
        status: 504,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Upstream request timed out",
          message: "Timed out after 5.0s while loading /agent-context/feedback/review from trading-core.",
        }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(buildReviewDateResponse(marketDate, options)),
    });
  });

  await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
    requestHits.progress += 1;
    const url = new URL(route.request().url());
    const marketDate = url.searchParams.get("market_date") ?? "2026-04-27";
    const storedDecisionCount =
      options.pendingRationaleDate === marketDate ||
      options.pendingWaitDate === marketDate ||
      options.mixedHorizonDate === marketDate
        ? 1
        : options.identityFallbackDate === marketDate || options.issue623Date === marketDate
          ? 3
        : marketDate === "2026-04-27"
          ? 2
          : 0;
    const hasRunningProgress = options.runningProgressDates?.includes(marketDate) ?? false;
    const isCompletedReviewDate =
      !hasRunningProgress &&
      (marketDate === "2026-04-27" ||
        options.mixedHorizonDate === marketDate ||
        options.identityFallbackDate === marketDate ||
        options.issue623Date === marketDate);
    const runStatus = hasRunningProgress ? "running" : isCompletedReviewDate ? "completed" : "pending";

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        request: {
          market_date: marketDate,
          symbols: null,
          expected_agents: ["signal-decider"],
        },
        summary: {
          run_id: `feedback-cycle-${marketDate}`,
          run_status: runStatus,
          run_table_status: runStatus,
          is_live: hasRunningProgress,
          run_started_at: "2026-04-27T06:50:00+00:00",
          run_completed_at: "2026-04-27T07:45:00+00:00",
          current_role: hasRunningProgress ? "signal-decider" : null,
          completed_roles: isCompletedReviewDate ? ["signal-decider"] : [],
          remaining_roles: isCompletedReviewDate ? [] : ["signal-decider"],
          latest_feedback_at: "2026-04-27T07:45:00+00:00",
          seconds_since_last_feedback: 120,
          stalled_threshold_seconds: 300,
          total_symbols: storedDecisionCount,
          processed_symbols: isCompletedReviewDate ? storedDecisionCount : 0,
          completed_symbols: isCompletedReviewDate ? storedDecisionCount : 0,
          in_progress_symbols: 0,
          pending_symbols: isCompletedReviewDate ? 0 : storedDecisionCount,
          progress_ratio: isCompletedReviewDate ? 1 : 0,
          progress_percent: isCompletedReviewDate ? 100 : 0,
          failed_items: 0,
          completed_feedback_count: isCompletedReviewDate ? storedDecisionCount : 0,
          expected_feedback_count: storedDecisionCount,
        },
        result: {
          market_date: marketDate,
          roles: {
            "signal-decider": {
              requested_count: storedDecisionCount,
              completed_count: isCompletedReviewDate ? storedDecisionCount : 0,
              error_count: 0,
            },
          },
        },
      }),
    });
  });

  await page.route("**/api/trading/agent-context/feedback?**", async (route) => {
    requestHits.feedback += 1;
    const url = new URL(route.request().url());
    const marketDate = url.searchParams.get("market_date") ?? "2026-04-27";
    await options.feedbackDelays?.[marketDate];
    if (options.timeoutFeedbackDates?.includes(marketDate)) {
      await route.fulfill({
        status: 504,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Upstream request timed out",
          message: "Timed out after 5.0s while loading /agent-context/feedback from trading-core.",
        }),
      });
      return;
    }
    const denseFeedbackCount = options.denseFeedbackDates?.[marketDate] ?? 0;
    const denseFeedbackAction = getDenseFeedbackAction(marketDate, options);
    const items =
      denseFeedbackCount > 0
        ? Array.from({ length: denseFeedbackCount }, (_, index) => ({
            id: `dense-${marketDate}-${index}`,
            market_date: marketDate,
            symbol: `DENSE${String(index + 1).padStart(3, "0")}`,
            agent: {
              name: "signal-decider",
              run_id: `feedback-cycle-${marketDate}`,
            },
            summary: {},
            feedback: {
              role: "signal-decider",
              symbol: `DENSE${String(index + 1).padStart(3, "0")}`,
              market_date: marketDate,
              preferred_action: denseFeedbackAction,
              next_day_open_action: denseFeedbackAction,
              confidence_score_10: 8,
              conviction_score_10: 7,
              thesis_summary: "Dense mobile calendar regression row.",
            },
            normalized_feedback: null,
            details: null,
            context: {
              symbol_day_context: {
                company: {
                  name_ko: `Dense Regression ${index + 1}`,
                },
              },
            },
            received_at: `${marketDate}T07:45:00+00:00`,
          }))
        : options.pendingRationaleDate === marketDate
        ? [
            {
              id: "pending-rationale",
              market_date: marketDate,
              symbol: "000850",
              agent: {
                name: "signal-decider",
                run_id: `feedback-cycle-${marketDate}`,
              },
              summary: {},
              feedback: {
                role: "signal-decider",
                symbol: "000850",
                market_date: marketDate,
                preferred_action: "buy",
                next_day_open_action: "buy",
                target_price: 49200,
                stop_loss_price: 45100,
                confidence_score_10: 7,
                conviction_score_10: 6,
                thesis_summary:
                  "Fresh breakout-style strength is encouraging, but the replay verdict is not available yet.",
                decision_risks: [
                  "Price action needs confirmation before the replay verdict is trusted.",
                  "fresh_breakout_needs_follow_through",
                  "range_to_trend_transition_risk",
                ],
                risk_flags: ["price_move_outpacing_fundamental_change", "missing_signal_features"],
                policy_version: "decider-policy-2026.04",
              },
              normalized_feedback: null,
              details: null,
              context: {
                symbol_day_context: {
                  company: {
                    name_ko: "Hwacheon Machinery",
                  },
                },
              },
              received_at: `${marketDate}T07:45:00+00:00`,
            },
          ]
        : options.pendingWaitDate === marketDate
        ? [
            {
              id: "pending-wait",
              market_date: marketDate,
              symbol: "003480",
              agent: {
                name: "signal-decider",
                run_id: `feedback-cycle-${marketDate}`,
              },
              summary: {},
              feedback: {
                role: "signal-decider",
                symbol: "003480",
                market_date: marketDate,
                preferred_action: "wait",
                next_day_open_action: "wait",
                confidence_score_10: 5,
                conviction_score_10: 4,
                thesis_summary: "Waiting for confirmation before any operator action is needed.",
                policy_version: "decider-policy-2026.05",
                five_day_evaluation: {
                  evaluation_status: "pending_evaluation_window",
                  evaluation_status_reason: "not_mature",
                  trading_days_remaining: 2,
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
              received_at: `${marketDate}T07:45:00+00:00`,
            },
          ]
        : options.emptyFeedbackDates?.includes(marketDate)
        ? []
        : marketDate === "2026-04-27"
        ? [
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
                decision_risks: ["Gap-down open"],
                policy_version: "decider-policy-2026.04",
                evaluation: {
                  quality_verdict: "weak_buy",
                  quality_reason: "The buy worked intraday but failed the 3d realized hurdle.",
                  target_stop_result: "target_hit_first",
                  review_conclusion: "Target hit intraday first, but the multi-day hold weakened.",
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
                confidence_score_10: 6,
                conviction_score_10: 5,
                thesis_summary: "Wait for confirmation after the opening print.",
                risk_flags: ["Volume confirmation missing"],
                evaluation: {
                  quality_verdict: "missed_opportunity",
                  missed_opportunity: true,
                  quality_reason: "Price cleared the confirmation band before the 3d horizon.",
                  realized_results: {
                    "3d": {
                      return_pct: 4.18,
                      verdict: "missed_opportunity",
                    },
                  },
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
          ]
        : [];

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
          count: items.length,
        },
        items,
      }),
    });
  });

  return requestHits;
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

async function mockSymbolDetailApis(
  page: Page,
  {
    companyName,
    marketDate,
    symbol,
  }: {
    companyName: string;
    marketDate: string;
    symbol: string;
  },
) {
  await page.route(`**/api/trading/quotes/${symbol}`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        symbol,
        company_name: companyName,
        price: 4100,
        change: 0,
        change_pct: 0,
        volume: 120000,
        turnover: 492000000,
        market_state: "CLOSED",
        source: "test",
        fallback: false,
        is_live: false,
        available: true,
        cached_at: `${marketDate}T16:00:00+09:00`,
        trade_date: marketDate,
      }),
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
        query: symbol,
        count: 1,
        items: [
          {
            symbol,
            standard_code: `KR7${symbol}00000`,
            name_ko: companyName,
            market: "KOSPI",
          },
        ],
      },
    });
  });

  await page.route(`**/api/trading/symbols/${symbol}/price-bars?**`, async (route) => {
    await route.fulfill({
      json: {
        symbol,
        count: 1,
        start_date: marketDate,
        end_date: marketDate,
        requested_start_date: marketDate,
        requested_end_date: marketDate,
        items: [
          {
            trade_date: marketDate,
            open_price: 4100,
            high_price: 4140,
            low_price: 4050,
            close_price: 4100,
            volume: 120000,
            turnover: 492000000,
            source: "test",
            captured_at: `${marketDate}T16:00:00+09:00`,
          },
        ],
      },
    });
  });

  await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
    await route.fulfill({
      json: {
        market_date: marketDate,
        summary: {
          entries: 0,
          requested_symbol: symbol,
          matched_symbols: [],
          missing_symbols: [symbol],
          passed_count: 0,
          not_passed_count: 0,
        },
        item: null,
        items: [],
      },
    });
  });

  await page.route("**/api/trading/agent-context/symbol-day?**", async (route) => {
    await route.fulfill({
      json: {
        request: {
          market_date: marketDate,
          symbols: [symbol],
        },
        items: [
          {
            symbol,
            company: {
              name_ko: companyName,
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

async function expectNarrowMobileLabelsContained(page: Page) {
  const overflowingLabels = await page.locator("body").evaluate(() => {
    const labels = Array.from(
      document.querySelectorAll<HTMLElement>("[data-calendar-cell-label], [data-mobile-nav-label]"),
    );

    return labels.flatMap((label) => {
      const style = window.getComputedStyle(label);
      const rect = label.getBoundingClientRect();

      if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) {
        return [];
      }

      const parent = label.closest<HTMLElement>("[data-calendar-cell], [data-mobile-nav-item]");
      const parentRect = parent?.getBoundingClientRect();
      const crossesParent =
        parentRect !== undefined &&
        (rect.left < parentRect.left - 0.75 ||
          rect.right > parentRect.right + 0.75 ||
          rect.top < parentRect.top - 0.75 ||
          rect.bottom > parentRect.bottom + 0.75);
      const clipsOwnText = label.scrollWidth > label.clientWidth + 1;

      if (!crossesParent && !clipsOwnText) return [];

      return [
        {
          clientWidth: label.clientWidth,
          parent: parent?.getAttribute("data-calendar-cell") ?? parent?.getAttribute("data-mobile-nav-item") ?? "unknown",
          scrollWidth: label.scrollWidth,
          text: label.innerText.trim().replace(/\s+/g, " "),
        },
      ];
    });
  });

  expect(overflowingLabels).toEqual([]);
}

async function expectMobileToolbarRouteContextContained(
  page: Page,
  {
    subtitle,
    title,
  }: {
    subtitle: string;
    title: string;
  },
) {
  const toolbar = page.locator("[data-dashboard-toolbar]").first();
  await expect(toolbar.locator("[data-dashboard-toolbar-title]")).toHaveText(title);
  await expect(toolbar.locator("[data-dashboard-toolbar-subtitle]")).toHaveText(subtitle);

  const overflowingContext = await toolbar.evaluate((element) => {
    const labels = Array.from(
      element.querySelectorAll<HTMLElement>("[data-dashboard-toolbar-title], [data-dashboard-toolbar-subtitle]"),
    );
    const toolbarRect = element.getBoundingClientRect();

    return labels.flatMap((label) => {
      const style = window.getComputedStyle(label);
      const rect = label.getBoundingClientRect();

      if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) {
        return [];
      }

      const clipsOwnText = label.scrollWidth > label.clientWidth + 1;
      const crossesToolbar =
        rect.left < toolbarRect.left - 0.75 ||
        rect.right > toolbarRect.right + 0.75 ||
        rect.top < toolbarRect.top - 0.75 ||
        rect.bottom > toolbarRect.bottom + 0.75;

      if (!clipsOwnText && !crossesToolbar) return [];

      return [
        {
          clientWidth: label.clientWidth,
          scrollWidth: label.scrollWidth,
          text: label.innerText.trim().replace(/\s+/g, " "),
        },
      ];
    });
  });

  expect(overflowingContext).toEqual([]);
}

async function expectMobileDecisionCardsContained(page: Page) {
  const overflowMetrics = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="calendar-mobile-decision-card"]'));
    const visibleTables = Array.from(document.querySelectorAll<HTMLElement>("table")).filter((table) => {
      const style = window.getComputedStyle(table);
      const rect = table.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });

    return {
      cardOverflows: cards.map((card) => card.scrollWidth - card.clientWidth),
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      visibleTableCount: visibleTables.length,
    };
  });

  expect(overflowMetrics.documentOverflow).toBeLessThanOrEqual(1);
  expect(overflowMetrics.visibleTableCount).toBe(0);
  expect(overflowMetrics.cardOverflows.length).toBeGreaterThan(0);
  for (const overflow of overflowMetrics.cardOverflows) {
    expect(overflow).toBeLessThanOrEqual(1);
  }
}

test("signal review calendar shows date metadata, selected decisions, and symbol replay detail", async ({ page }) => {
  await mockSignalReviewCalendar(page);

  await page.goto("/calendar?date=2026-04-27");

  await expect(page.getByRole("heading", { name: "Signal Review Calendar" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Calendar" }).first()).toBeVisible();

  const selectedDateCell = page.getByRole("button", { name: /2026-04-27/ });
  await expect(selectedDateCell).toContainText("2 decisions");
  await expect(selectedDateCell).toContainText("Buy 1 · Wait 1");

  await expect(page.getByText("Target hit 1 · Stop hit 0 · Sideways 0")).toBeVisible();
  await expect(page.getByText(/pending maturity 0 · insufficient price data 0 · not computed 1/i)).toBeVisible();
  const samsungRow = page.locator("tr").filter({ hasText: "Samsung Electronics" });
  await expect(samsungRow).toContainText("Buy");
  await expect(samsungRow).toContainText("+0.82%");
  await expect(samsungRow).toContainText("-1.44%");
  await expect(samsungRow).toContainText("Target first");
  await expect(samsungRow).toContainText("Target hit intraday first");

  await samsungRow.getByRole("button", { name: "Review" }).click();
  const dialog = page.getByRole("dialog", { name: /Samsung Electronics/i });
  await expect(dialog).toContainText("Target hit intraday first, but the multi-day hold weakened.");
  await expect(dialog).toContainText("Following sessions");
  await expect(dialog).toContainText("Gap-down open");

  await dialog.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: /2026-04-26/ }).click();
  await expect(page).toHaveURL(/\/calendar\?date=2026-04-26/);
  await expect(page.getByText("No signal-decider decisions are stored for the selected date.").first()).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/calendar\?date=2026-04-27/);
  await expect(samsungRow).toContainText("Target hit intraday first");
});

test("signal review calendar does not repeat symbols when company names are unavailable", async ({ page }) => {
  await mockSignalReviewCalendar(page, {
    identityFallbackDate: "2026-05-07",
  });

  await page.goto("/calendar?date=2026-05-07");

  await expect(page.getByRole("heading", { name: "Signal Review Calendar" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Samsung Electronics\s+005930\s+Buy/i })).toBeVisible();
  await expect(page.getByRole("row", { name: /Samsung Electronics\s+005930\s+Buy/i })).toBeVisible();

  await expect(page.getByRole("button", { name: /004150\s+Name unavailable\s+Wait/i })).toBeVisible();
  await expect(page.getByRole("row", { name: /004150\s+Name unavailable\s+Wait/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /004150\s+004150\s+Wait/i })).toHaveCount(0);
  await expect(page.getByRole("row", { name: /004150\s+004150\s+Wait/i })).toHaveCount(0);

  await expect(page.getByRole("button", { name: /010170\s+Name unavailable\s+Reject/i })).toBeVisible();
  await expect(page.getByRole("row", { name: /010170\s+Name unavailable\s+Reject/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /010170\s+010170\s+Reject/i })).toHaveCount(0);
  await expect(page.getByRole("row", { name: /010170\s+010170\s+Reject/i })).toHaveCount(0);

  const symbolOnlyLink = page.getByRole("link", { name: /004150\s+Name unavailable/i });
  await expect(symbolOnlyLink).toHaveAttribute("href", /\/dashboard\/symbol\/004150\?marketDate=2026-05-07&navContext=calendar$/);
  await expect(symbolOnlyLink).not.toHaveAttribute("href", /name=/);
});

test("signal review calendar keeps review-date company names and Korean pending copy", async ({ page }) => {
  await mockSignalReviewCalendar(page, {
    issue623Date: "2026-05-08",
  });

  await page.goto("/calendar?date=2026-05-08");
  await expect(page.getByRole("heading", { name: "Signal Review Calendar" })).toBeVisible();
  await page.getByRole("button", { name: /Korean/i }).click();

  await expect(page.getByRole("heading", { name: "시그널 리뷰 캘린더" })).toBeVisible();
  await expect(page.getByRole("button", { name: /한솔홀딩스\s+004150/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /한솔홀딩스\s+004150/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /HDC\s+012630/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /HDC\s+012630/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /경방\s+000050/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /경방\s+000050/ })).toBeVisible();

  await expect(page.getByRole("button", { name: /004150\s+종목명 미제공/ })).toHaveCount(0);
  await expect(page.getByRole("row", { name: /004150\s+종목명 미제공/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /012630\s+종목명 미제공/ })).toHaveCount(0);
  await expect(page.getByRole("row", { name: /012630\s+종목명 미제공/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /000050\s+종목명 미제공/ })).toHaveCount(0);
  await expect(page.getByRole("row", { name: /000050\s+종목명 미제공/ })).toHaveCount(0);

  await expect(page.locator("body")).not.toContainText("Replay review is pending for the 5-day window.");
  await expect(page.locator("body")).not.toContainText("The 1-day replay window is not mature yet.");
  await expect(page.getByText("리플레이 판정은 아직 저장되지 않았습니다.").first()).toBeVisible();
  await expect(page.getByText(/1D 성숙 대기/).first()).toBeVisible();
});

test("signal review calendar uses compact calendar summary for month load", async ({ page }) => {
  const requestHits = await mockSignalReviewCalendar(page);

  await page.goto("/calendar?date=2026-04-27");

  const selectedDateCell = page.getByRole("button", { name: /2026-04-27/ });
  await expect(selectedDateCell).toContainText("2 decisions");
  await expect(selectedDateCell).toContainText("Buy 1 · Wait 1");

  await expect
    .poll(async () => requestHits.calendarSummary)
    .toBe(1);
  await expect
    .poll(async () => requestHits.reviewDate)
    .toBe(1);
  await expect
    .poll(async () => requestHits.feedback)
    .toBe(0);
});

test("calendar opens the feedback table in Korean locale", async ({ page }) => {
  await mockSignalReviewCalendar(page);

  await page.goto("/calendar?date=2026-04-27");
  await expect(page.getByRole("heading", { name: "Signal Review Calendar" })).toBeVisible();

  await page.getByRole("button", { name: /Korean/i }).click();
  await expect(page.getByRole("heading", { name: "시그널 리뷰 캘린더" })).toBeVisible();

  await page.getByRole("link", { name: /피드백 표 열기/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/signal-decider-feedback\?marketDate=2026-04-27&navContext=calendar$/);
  await expect(page.getByRole("heading", { name: "시그널 디사이더 피드백" })).toBeVisible();
  await expect(
    page.getByLabel("캘린더 피드백 컨텍스트").getByText("캘린더 / 2026-04-27 / 피드백"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "캘린더로 돌아가기" })).toHaveAttribute(
    "href",
    "/calendar?date=2026-04-27",
  );
  await expect(page.getByText("액션 믹스")).toBeVisible();
  await expect(page.getByRole("form", { name: "디사이더 피드백 필터" }).getByText("검색")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Signal-decider feedback");
});

test("feedback table link keeps the selected calendar date in navigation", async ({ page }) => {
  await mockSignalReviewCalendar(page, {
    denseFeedbackDates: {
      "2026-05-05": 2,
    },
  });

  await page.goto("/calendar?date=2026-05-05");
  await expect(page.getByRole("heading", { name: "Signal Review Calendar" })).toBeVisible();
  await page.getByRole("button", { name: /Korean/i }).click();
  await expect(page.getByRole("heading", { name: "시그널 리뷰 캘린더" })).toBeVisible();

  const feedbackLink = page.getByRole("link", { name: /피드백 표 열기/i });
  await expect(feedbackLink).toHaveAttribute("href", /\/dashboard\/signal-decider-feedback\?marketDate=2026-05-05/);

  await feedbackLink.click();
  await expect(page).toHaveURL(/\/dashboard\/signal-decider-feedback\?marketDate=2026-05-05/);
  await expect(page.getByText("MD 2026-05-05").first()).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/calendar\?date=2026-05-05/);

  await page.getByRole("button", { name: /2026-05-04/ }).click();
  await expect(page).toHaveURL(/\/calendar\?date=2026-05-04/);
  await expect(feedbackLink).toHaveAttribute("href", /\/dashboard\/signal-decider-feedback\?marketDate=2026-05-04/);
});

test("calendar-sourced feedback symbol detail returns to the selected feedback date", async ({ page }) => {
  await mockSignalReviewCalendar(page, {
    pendingWaitDate: "2026-05-06",
  });
  await mockSymbolDetailApis(page, {
    companyName: "한진중공업홀딩스",
    marketDate: "2026-05-06",
    symbol: "003480",
  });

  await page.goto("/calendar?date=2026-05-06");
  await page.getByRole("button", { name: /Korean/i }).click();
  await page.getByRole("link", { name: /피드백 표 열기/i }).click();

  await expect(page).toHaveURL(/\/dashboard\/signal-decider-feedback\?marketDate=2026-05-06/);
  const waitCard = page.getByRole("article", { name: /한진중공업홀딩스 .*피드백/i });
  await expect(waitCard).toBeVisible();
  const symbolLink = waitCard.getByRole("link", { name: /한진중공업홀딩스.*003480/ });
  await expect(symbolLink).toHaveAttribute(
    "href",
    /\/dashboard\/symbol\/003480\?.*marketDate=2026-05-06.*navContext=signal-decider-feedback/,
  );

  await symbolLink.click();
  await expect(page).toHaveURL(/\/dashboard\/symbol\/003480\?.*navContext=signal-decider-feedback/);
  const feedbackReturnLink = page.getByRole("link", { name: /피드백으로 돌아가기/i });
  await expect(feedbackReturnLink).toHaveAttribute(
    "href",
    /\/dashboard\/decider-feedback\?(?=.*marketDate=2026-05-06)(?=.*agent=signal-decider)/,
  );
  await expect(page.getByRole("link", { name: /대시보드로 돌아가기/i })).toHaveCount(0);

  await feedbackReturnLink.click();
  await expect(page).toHaveURL(/\/dashboard\/decider-feedback\?(?=.*marketDate=2026-05-06)(?=.*agent=signal-decider)/);
  await expect(page.getByText("MD 2026-05-06").first()).toBeVisible();
  await expect(page.getByRole("article", { name: /한진중공업홀딩스 .*피드백/i })).toBeVisible();
});

test("signal review calendar falls back to per-date feedback calls only when month summary fails", async ({ page }) => {
  const requestHits = await mockSignalReviewCalendar(page, {
    forceCalendarSummaryFailure: true,
  });

  await page.goto("/calendar?date=2026-04-27");

  const selectedDateCell = page.getByRole("button", { name: /2026-04-27/ });
  await expect(selectedDateCell).toContainText("2 decisions");
  await expect(selectedDateCell).toContainText("Buy 1 · Wait 1");

  await expect
    .poll(async () => requestHits.calendarSummary)
    .toBe(1);
  await expect
    .poll(async () => requestHits.feedback)
    .toBe(listMonthDates("2026-04").length);
  await expect
    .poll(async () => requestHits.reviewDate)
    .toBe(1);
});

test("signal review calendar clears global loading once stored month data is available during partial fallback", async ({ page }) => {
  const delayedDateFetch = createDeferred();
  await mockSignalReviewCalendar(page, {
    denseFeedbackDates: {
      "2026-05-04": 85,
    },
    forceCalendarSummaryFailure: true,
    feedbackDelays: {
      "2026-05-05": delayedDateFetch.promise,
    },
  });

  await page.goto("/calendar?date=2026-05-04");

  const selectedDateCell = page.getByRole("button", { name: /2026-05-04/ });
  await expect(selectedDateCell).toContainText("85 decisions");
  await expect(selectedDateCell).toContainText("Stored");
  await expect(page.getByText("Loading decision dates")).toHaveCount(0);

  const emptyNeighborCell = page.getByRole("button", { name: /2026-05-01/ });
  await expect(emptyNeighborCell).toContainText("No rows");
  await expect(
    emptyNeighborCell.locator('[data-calendar-cell-label="status"] [data-calendar-label-variant="compact"]'),
  ).toHaveText("NO");

  delayedDateFetch.resolve();
  await expect(emptyNeighborCell).toContainText("No rows");
});

test("signal review calendar settles unresolved past cells after stored selected rows render in partial coverage", async ({
  page,
}) => {
  const delayedHistoricalDateFetch = createDeferred();
  try {
    await mockSignalReviewCalendar(page, {
      denseFeedbackDates: {
        "2026-05-22": 118,
      },
      forceCalendarSummaryFailure: true,
      feedbackDelays: {
        "2026-05-01": delayedHistoricalDateFetch.promise,
      },
    });

    await page.goto("/calendar?date=2026-05-22");
    await page.getByRole("button", { name: /Korean/i }).click();

    await expect(page.getByText("월간 커버리지가 부분적으로 로드됨")).toBeVisible();
    await expect(page.getByText("118 월간 결정")).toBeVisible();
    await expect(page.getByRole("heading", { name: "2026-05-22" })).toBeVisible();
    await expect(page.getByRole("link", { name: /피드백 표 열기/i })).toHaveAttribute(
      "href",
      /\/dashboard\/signal-decider-feedback\?marketDate=2026-05-22/,
    );

    const delayedPastCell = page.getByRole("button", { name: /2026-05-01/ });
    await expect(
      delayedPastCell.locator('[data-calendar-cell-label="status"] [data-calendar-label-variant="full"]'),
    ).toHaveText("부분");
    await expect(
      delayedPastCell.locator('[data-calendar-cell-label="status"] [data-calendar-label-variant="compact"]'),
    ).toHaveText("부분");
    await expect(
      delayedPastCell.locator('[data-calendar-cell-label="count"] [data-calendar-label-variant="compact"]'),
    ).toHaveText("--");
    await expect(delayedPastCell).not.toContainText("로딩 중");
  } finally {
    delayedHistoricalDateFetch.resolve();
  }
});

test("signal review calendar keeps a different month loading while the selected ready date belongs to the previous month", async ({
  page,
}) => {
  const delayedPreviousMonthFetch = createDeferred();
  try {
    await mockSignalReviewCalendar(page, {
      denseFeedbackDates: {
        "2026-05-22": 118,
      },
      forceCalendarSummaryFailure: true,
      feedbackDelays: {
        "2026-04-01": delayedPreviousMonthFetch.promise,
      },
    });

    await page.goto("/calendar?date=2026-05-22");

    const selectedDateCell = page.getByRole("button", { name: /2026-05-22/ });
    await expect(selectedDateCell).toContainText("118 decisions");
    await expect(page.getByRole("heading", { name: "2026-05-22" })).toBeVisible();

    await page.getByRole("button", { name: "Previous month" }).click();
    await expect(page.getByRole("heading", { name: "April 2026" })).toBeVisible();
    await expect(page.getByText("Month loaded with partial coverage")).toBeVisible();
    await expect(page.getByText("2 month decisions")).toBeVisible();

    const delayedPastCell = page.getByRole("button", { name: /2026-04-01/ });
    await expect(
      delayedPastCell.locator('[data-calendar-cell-label="status"] [data-calendar-label-variant="full"]'),
    ).toHaveText("Loading");
    await expect(
      delayedPastCell.locator('[data-calendar-cell-label="status"] [data-calendar-label-variant="compact"]'),
    ).toHaveText("RUN");
    await expect(
      delayedPastCell.locator('[data-calendar-cell-label="count"] [data-calendar-label-variant="compact"]'),
    ).toHaveText("...");
    await expect(delayedPastCell).not.toContainText("Partial");
  } finally {
    delayedPreviousMonthFetch.resolve();
  }
});

test("signal review calendar keeps zero-row selected-date summary running while the month snapshot is unresolved", async ({
  page,
}) => {
  const delayedMonthSummary = createDeferred();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    const requestHits = await mockSignalReviewCalendar(page, {
      calendarSummaryDelay: delayedMonthSummary.promise,
      forceCalendarSummaryFailure: true,
      runningProgressDates: ["2026-05-26"],
    });

    await page.goto("/calendar?date=2026-05-26");
    await page.getByRole("button", { name: "Korean" }).click();
    await expect(page.getByRole("heading", { name: "시그널 리뷰 캘린더" })).toBeVisible();
    await expect.poll(async () => requestHits.reviewDate).toBeGreaterThanOrEqual(1);
    await expect.poll(async () => requestHits.progress).toBeGreaterThanOrEqual(1);

    const selectedPanel = page.locator("aside").filter({ has: page.getByRole("heading", { name: "2026-05-26" }) });
    await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveAttribute(
      "data-selected-date-status",
      "running",
    );
    await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveText("로딩 중");
    await expect(selectedPanel.locator("div").filter({ hasText: /^액션 믹스\s*대기$/ }).locator("strong")).toHaveText(
      "대기",
    );
    await expect(selectedPanel).toContainText("선택한 날짜의 결정을 불러오는 중...");
    await expect(selectedPanel).not.toContainText("선택한 날짜에 저장된 시그널 디사이더 결정이 없습니다.");

    delayedMonthSummary.resolve();

    await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveAttribute(
      "data-selected-date-status",
      "empty",
    );
    await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveText("행 없음");
    await expect(selectedPanel.locator("div").filter({ hasText: /^액션 믹스\s*행 없음$/ }).locator("strong")).toHaveText(
      "행 없음",
    );
    await expect(selectedPanel).toContainText("선택한 날짜에 저장된 시그널 디사이더 결정이 없습니다.");
  } finally {
    delayedMonthSummary.resolve();
  }
});

test("signal review calendar settles unavailable zero-row selected-date summary", async ({ page }) => {
  const unavailableDateFetch = createDeferred();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSignalReviewCalendar(page, {
      feedbackDelays: {
        "2026-05-26": unavailableDateFetch.promise,
      },
      forceCalendarSummaryFailure: true,
      runningProgressDates: ["2026-05-26"],
      timeoutFeedbackDates: ["2026-05-26"],
    });

    await page.goto("/calendar?date=2026-05-26");
    await page.getByRole("button", { name: "Korean" }).click();
    await expect(page.getByRole("heading", { name: "시그널 리뷰 캘린더" })).toBeVisible();

    unavailableDateFetch.resolve();

    const selectedDateCell = page.locator('[data-calendar-cell="2026-05-26"]');
    await expect(selectedDateCell).toHaveAttribute("aria-label", /2026-05-26 사용 불가/);
    await expect(
      selectedDateCell.locator('[data-calendar-cell-label="status"] [data-calendar-label-variant="compact"]'),
    ).toHaveText("불가");

    const selectedPanel = page.locator("aside").filter({ has: page.getByRole("heading", { name: "2026-05-26" }) });
    await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveText("사용 불가");
    await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveAttribute(
      "data-selected-date-status",
      "unavailable",
    );
    await expect(
      selectedPanel.locator("div").filter({ hasText: /^액션 믹스\s*사용 불가$/ }).locator("strong"),
    ).toHaveText("사용 불가");
    await expect(selectedPanel).toContainText("총 결정");
    await expect(selectedPanel).toContainText("0");
    await expect(selectedPanel).toContainText("선택한 날짜에 저장된 시그널 디사이더 결정이 없습니다.");
    await expect(selectedPanel).not.toContainText("로딩 중");
    await expect(page.getByRole("link", { name: /피드백 표 열기/i })).toHaveAttribute(
      "href",
      /\/dashboard\/signal-decider-feedback\?marketDate=2026-05-26&navContext=calendar$/,
    );
  } finally {
    unavailableDateFetch.resolve();
  }
});

test("signal review calendar separates pending replay state from available rationale and diagnostic risks", async ({
  page,
}) => {
  await mockSignalReviewCalendar(page, { pendingRationaleDate: "2026-04-28" });

  await page.goto("/calendar?date=2026-04-28");

  const pendingRow = page.locator("tr").filter({ hasText: "Hwacheon Machinery" });
  await expect(pendingRow).toContainText("Path unavailable");
  await expect(pendingRow).toContainText("[확인 필요]");

  await pendingRow.getByRole("button", { name: "Review" }).click();
  const dialog = page.getByRole("dialog", { name: /Hwacheon Machinery/i });

  await expect(dialog.getByRole("heading", { name: "Signal rationale" })).toBeVisible();
  await expect(dialog.getByText("Fresh breakout-style strength is encouraging")).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Replay verdict" })).toBeVisible();
  await expect(dialog).toContainText("Replay verdict is not stored yet.");
  await expect(dialog).toContainText("Path unavailable");
  await expect(dialog).toContainText(/1D\s*not computed/);
  await expect(dialog).toContainText(/3D\s*not computed/);
  await expect(dialog).toContainText(/5D\s*not computed/);

  await expect(dialog.getByRole("heading", { name: "Risk context" })).toBeVisible();
  await expect(dialog).toContainText("Price action needs confirmation before the replay verdict is trusted.");
  await expect(dialog.getByRole("heading", { name: "Diagnostic risk tags" })).toBeVisible();
  await expect(dialog).toContainText("Fresh breakout needs follow through");
  await expect(dialog).toContainText("Range to trend transition risk");
  await expect(dialog).not.toContainText("fresh_breakout_needs_follow_through");
  await expect(dialog).not.toContainText("range_to_trend_transition_risk");
});

test("signal review calendar leaves normal wait pending rows as pending instead of check-needed", async ({ page }) => {
  await mockSignalReviewCalendar(page, { pendingWaitDate: "2026-05-06" });

  await page.goto("/calendar?date=2026-05-06");

  const waitRow = page.getByRole("button", { name: /한진중공업홀딩스/ });
  await expect(waitRow).toContainText("Wait");
  await expect(waitRow).toContainText("pending maturity");
  await expect(waitRow).not.toContainText("[확인 필요]");

  const waitTableRow = page.locator("tr").filter({ hasText: "한진중공업홀딩스" });
  await expect(waitTableRow).toContainText("pending maturity");

  await page.getByRole("button", { name: /Korean/i }).click();
  await expect(page.getByRole("heading", { name: "시그널 리뷰 캘린더" })).toBeVisible();
  const localizedWaitRow = page.getByRole("button", { name: /한진중공업홀딩스/ });
  await expect(localizedWaitRow).toContainText("대기");
  await expect(localizedWaitRow).toContainText("성숙 대기");
  await expect(localizedWaitRow).not.toContainText("[확인 필요]");
});

test("signal review calendar shows outcome badges while preserving pending and insufficient horizons", async ({ page }) => {
  await mockSignalReviewCalendar(page, { mixedHorizonDate: "2026-04-30" });

  await page.goto("/calendar?date=2026-04-30");

  await expect(page.getByText("Target hit 0 · Stop hit 0 · Sideways 0")).toBeVisible();
  await expect(page.getByText(/pending maturity 1/i)).toBeVisible();
  await expect(page.getByText(/insufficient price data 1/i)).toBeVisible();
  await expect(page.getByText("1D/3D outcomes 2")).toBeVisible();

  const mixedCard = page.getByRole("button", { name: /LG Chem/ });
  await expect(mixedCard).toContainText("1D");
  await expect(mixedCard).toContainText("3D");
  await expect(mixedCard).toContainText("5D");
  await expect(mixedCard).toContainText("1D Target hit · 3D Sideways · 5D pending maturity");
  await expect(mixedCard).toContainText("pending maturity");
  await expect(mixedCard).not.toContainText("computed");
  await expect(mixedCard).not.toContainText("Unresolved path");

  const mixedTableRow = page.locator("tr").filter({ hasText: "LG Chem" });
  await expect(mixedTableRow).toContainText("+2.15%");
  await expect(mixedTableRow).toContainText("Sideways");
  await expect(mixedTableRow).toContainText("pending maturity");

  const insufficientCard = page.getByRole("button", { name: /NAVER/ });
  await expect(insufficientCard).toContainText("1D Stop hit · 3D insufficient price data · 5D insufficient price data");
  await expect(insufficientCard).not.toContainText("computed");

  const insufficientTableRow = page.locator("tr").filter({ hasText: "NAVER" });
  await expect(insufficientTableRow).toContainText("Stop hit");
  await expect(insufficientTableRow).toContainText("insufficient price data");
  await expect(page.locator("body")).not.toContainText("Replay review is pending for the 5-day window.");
});

test("signal review calendar hides previous selected-date rows while a new date is loading", async ({ page }) => {
  const delayedFeedback = createDeferred();
  await mockSignalReviewCalendar(page, {
    feedbackDelays: {
      "2026-04-26": delayedFeedback.promise,
    },
  });

  await page.goto("/calendar?date=2026-04-27");
  await expect(page.getByText("Samsung Electronics").first()).toBeVisible();

  await page.getByRole("button", { name: /2026-04-26/ }).click();
  await expect(page).toHaveURL(/\/calendar\?date=2026-04-26/);
  await expect(page.getByText("Loading selected-date decisions...").first()).toBeVisible();
  await expect(page.getByText("Samsung Electronics")).toHaveCount(0);

  delayedFeedback.resolve();
  await expect(page.getByText("No signal-decider decisions are stored for the selected date.").first()).toBeVisible();
});

test("signal review calendar keeps dashboard cached rows when the direct selected-date read is empty", async ({ page }) => {
  await seedDashboardSignalDeciderCache(page, "2026-04-27");
  await mockSignalReviewCalendar(page, {
    emptyFeedbackDates: ["2026-04-27"],
  });

  await page.goto("/calendar?date=2026-04-27");

  const selectedDateCell = page.getByRole("button", { name: /2026-04-27/ });
  await expect(selectedDateCell).toContainText("1 decisions");
  await expect(selectedDateCell).toContainText("Wait 1");
  await expect(page.getByText("Samsung Electronics").first()).toBeVisible();
  await expect(page.getByText("Loading selected-date decisions...")).toHaveCount(0);
  await expect(page.getByText("No signal-decider decisions are stored for the selected date.")).toHaveCount(0);
});

test("signal review calendar keeps narrow mobile toolbar, cell, and bottom-nav labels contained in English and Korean", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await mockSignalReviewCalendar(page, {
    denseFeedbackActions: {
      "2026-05-04": "wait",
      "2026-05-06": "wait",
      "2026-05-07": "wait",
      "2026-05-08": "wait",
    },
    denseFeedbackDates: {
      "2026-05-04": 85,
      "2026-05-06": 76,
      "2026-05-07": 90,
      "2026-05-08": 111,
    },
  });

  await page.goto("/calendar?date=2026-05-08");

  const selectedDateCell = page.locator('[data-calendar-cell="2026-05-08"]');
  await expectMobileToolbarRouteContextContained(page, {
    subtitle: "2026-05-08",
    title: "Calendar",
  });
  await expect(selectedDateCell).toBeVisible();
  await expect(selectedDateCell.locator('[data-calendar-cell-label="status"] [data-calendar-label-variant="compact"]')).toBeVisible();
  await expect(selectedDateCell.locator('[data-calendar-cell-label="count"] [data-calendar-label-variant="compact"]')).toHaveText("111");
  await expect(selectedDateCell.locator('[data-calendar-cell-label="action-mix"] [data-calendar-label-variant="compact"]')).toHaveText("W");

  const navLabels = page.locator("[data-mobile-nav-label]");
  await expect(navLabels).toHaveCount(5);
  await expect
    .poll(() =>
      navLabels.evaluateAll((labels) =>
        labels.map((label) => {
          const style = window.getComputedStyle(label);
          const rect = label.getBoundingClientRect();
          return {
            lineHeight: Number.parseFloat(style.lineHeight),
            text: label.textContent?.trim() ?? "",
            whiteSpace: style.whiteSpace,
            wraps: rect.height > Number.parseFloat(style.lineHeight) + 1,
          };
        }),
      ),
    )
    .toEqual([
      { lineHeight: expect.any(Number), text: "Dashboard", whiteSpace: "nowrap", wraps: false },
      { lineHeight: expect.any(Number), text: "Search", whiteSpace: "nowrap", wraps: false },
      { lineHeight: expect.any(Number), text: "Calendar", whiteSpace: "nowrap", wraps: false },
      { lineHeight: expect.any(Number), text: "Assets", whiteSpace: "nowrap", wraps: false },
      { lineHeight: expect.any(Number), text: "My Symbols", whiteSpace: "nowrap", wraps: false },
    ]);
  await expectNarrowMobileLabelsContained(page);

  await page.getByRole("button", { name: "Korean" }).click();
  await expect(page.getByRole("heading", { name: "시그널 리뷰 캘린더" })).toBeVisible();
  await expectMobileToolbarRouteContextContained(page, {
    subtitle: "2026-05-08",
    title: "캘린더",
  });
  await expect(page.getByRole("button", { name: /English|영어/ })).toBeVisible();
  await expect(selectedDateCell.locator('[data-calendar-cell-label="count"] [data-calendar-label-variant="compact"]')).toHaveText("111");
  await expect(
    page.locator('[data-calendar-cell="2026-05-04"] [data-calendar-cell-label="count"] [data-calendar-label-variant="compact"]'),
  ).toHaveText("85");
  await expect(
    page.locator('[data-calendar-cell="2026-05-04"] [data-calendar-cell-label="action-mix"] [data-calendar-label-variant="compact"]'),
  ).toHaveText("대기");
  await expect(
    page.locator('[data-calendar-cell="2026-05-06"] [data-calendar-cell-label="count"] [data-calendar-label-variant="compact"]'),
  ).toHaveText("76");
  await expect(
    page.locator('[data-calendar-cell="2026-05-06"] [data-calendar-cell-label="action-mix"] [data-calendar-label-variant="compact"]'),
  ).toHaveText("대기");
  await expect(
    page.locator('[data-calendar-cell="2026-05-07"] [data-calendar-cell-label="count"] [data-calendar-label-variant="compact"]'),
  ).toHaveText("90");
  await expect(
    page.locator('[data-calendar-cell="2026-05-07"] [data-calendar-cell-label="action-mix"] [data-calendar-label-variant="compact"]'),
  ).toHaveText("대기");
  await expect(
    selectedDateCell.locator('[data-calendar-cell-label="action-mix"] [data-calendar-label-variant="compact"]'),
  ).toHaveText("대기");
  const compactCalendarLabels = await page.locator('[data-calendar-label-variant="compact"]').evaluateAll((labels) =>
    labels.map((label) => label.textContent?.trim() ?? ""),
  );
  expect(compactCalendarLabels.some((label) => ["대85", "대76", "대90", "대+"].includes(label))).toBe(false);
  await expectNarrowMobileLabelsContained(page);
});

test("signal review calendar stacks selected-date decision context on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSignalReviewCalendar(page, {
    issue672Date: "2026-05-22",
  });

  await page.goto("/calendar?date=2026-05-22");
  await page.getByRole("button", { name: "Korean" }).click();
  await expect(page.getByRole("heading", { name: "시그널 리뷰 캘린더" })).toBeVisible();

  await page.getByRole("heading", { name: "선택 날짜 결정" }).scrollIntoViewIfNeeded();
  const wideTable = page.locator("table").filter({ hasText: "결정" });
  await expect(wideTable).toHaveCount(1);
  await expect(wideTable).toBeHidden();

  const mobileCards = page.getByTestId("calendar-mobile-decision-card");
  await expect(mobileCards).toHaveCount(5);

  const firstCard = page.getByRole("article", { name: /신영와코루.*선택 날짜 결정/ });
  await expect(firstCard).toBeVisible();
  await expect(firstCard.getByRole("link", { name: /신영와코루\s+005800/ })).toHaveAttribute(
    "href",
    /\/dashboard\/symbol\/005800\?name=/,
  );
  await expect(firstCard).toContainText("대기");
  await expect(firstCard).toContainText(/목표\s*₩17,900/);
  await expect(firstCard).toContainText(/손절\s*₩16,200/);
  await expect(firstCard).toContainText("D+1");
  await expect(firstCard).toContainText("리뷰 인사이트");
  await expect(firstCard).toContainText("Later price action favored a buy");
  await expect(firstCard.getByRole("link", { name: "피드백 표 열기" })).toHaveAttribute(
    "href",
    "/dashboard/signal-decider-feedback?marketDate=2026-05-22&navContext=calendar",
  );
  await expect(firstCard.getByRole("button", { name: "리뷰" })).toBeVisible();

  const lastCard = page.getByRole("article", { name: /성창오토텍.*선택 날짜 결정/ });
  await lastCard.scrollIntoViewIfNeeded();
  await expect(lastCard).toBeVisible();
  await expect(lastCard).toContainText(/목표\s*₩4,560/);
  await expect(lastCard).toContainText(/손절\s*₩4,010/);
  await expect(lastCard).toContainText("Replay outcome is still unresolved");

  await expectMobileDecisionCardsContained(page);
});

test("signal review calendar resolves selected-date gateway timeouts into an explicit error state", async ({ page }) => {
  await mockSignalReviewCalendar(page, {
    timeoutReviewDateDates: ["2026-04-29"],
    timeoutFeedbackDates: ["2026-04-29"],
  });

  await page.goto("/calendar?date=2026-04-29");

  await expect(page.getByRole("heading", { name: "Signal Review Calendar" })).toBeVisible();
  await expect(page.getByText("Unable to load selected-date reviews. Re-select the date to retry.").first()).toBeVisible();
  await expect(page.getByText("Loading selected-date decisions...")).toHaveCount(0);
  await expect(page.getByText("No signal-decider decisions are stored for the selected date.")).toHaveCount(0);
});

test("signal review calendar does not expose dependency-gap warning text in English", async ({ page }) => {
  await mockSignalReviewCalendar(page, {
    reviewDateErrorMessages: {
      "2026-04-27":
        "Calendar index is not a dedicated Core contract yet. This page uses the real generic signal-decider feedback read for each visible date, while a dedicated calendar/replay endpoint is still a dependency gap.",
    },
  });

  await page.goto("/calendar?date=2026-04-27");

  await expect(page.getByRole("heading", { name: "Signal Review Calendar" })).toBeVisible();
  await expect(page.getByText("Samsung Electronics").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Calendar index is not a dedicated Core contract yet.");
  await expect(page.locator("body")).not.toContainText("dependency gap");
});

test("시그널 리뷰 캘린더는 한국어 화면에서 내부 의존성 경고 문구를 노출하지 않는다", async ({ page }) => {
  await mockSignalReviewCalendar(page, {
    reviewDateErrorMessages: {
      "2026-04-27": "캘린더 인덱스는 아직 전용 Core 계약이 아닙니다.",
    },
  });

  await page.goto("/calendar?date=2026-04-27");
  await page.getByRole("button", { name: "Korean" }).click();

  await expect(page.getByRole("heading", { name: "시그널 리뷰 캘린더" })).toBeVisible();
  await expect(page.getByText("Samsung Electronics").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("캘린더 인덱스는 아직 전용 Core 계약이 아닙니다.");
  await expect(page.locator("body")).not.toContainText("dedicated Core contract");
});
