import { expect, test, type Locator, type Page } from "@playwright/test";

import { expectMobileContentClearsBottomChrome } from "./mobile-bottom-chrome";

type SignalReviewCalendarMockAction =
  | "buy"
  | "wait"
  | "reject"
  | "watch_for_trigger"
  | "avoid_chase"
  | "unknown";

type SignalReviewCalendarMockOptions = {
  calendarSummaryDelay?: Promise<void>;
  denseFeedbackActions?: Partial<Record<string, SignalReviewCalendarMockAction | SignalReviewCalendarMockAction[]>>;
  denseFeedbackDates?: Partial<Record<string, number>>;
  denseReviewedDates?: string[];
  emptyFeedbackDates?: string[];
  emptyFeedbackListDates?: string[];
  feedbackDelays?: Partial<Record<string, Promise<void>>>;
  identityFallbackDate?: string;
  issue705Date?: string;
  issue672Date?: string;
  issue623Date?: string;
  mixedHorizonDate?: string;
  pendingReplayWindowDate?: string;
  pendingRationaleDate?: string;
  pendingWaitDate?: string;
  partialResultCounts?: Partial<Record<string, number>>;
  progressResponseDateOverrides?: Partial<Record<string, string>>;
  reviewDateDelays?: Partial<Record<string, Promise<void>>>;
  reviewDateErrorMessages?: Partial<Record<string, string>>;
  runningProgressDates?: string[];
  timeoutFeedbackDates?: string[];
  timeoutReviewDateDates?: string[];
  forceFreshnessFailure?: boolean;
  forceCalendarSummaryFailure?: boolean;
  calendarSummaryFailureStatus?: number;
  freshnessActionDate?: string;
  freshnessLatestDate?: string;
  freshnessTodayDate?: string;
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

async function getActiveElementState(page: Page) {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;

    return {
      inDialog: Boolean(element?.closest('[role="dialog"][aria-modal="true"]')),
      label: (element?.getAttribute("aria-label") || element?.textContent || "").replace(/\s+/g, " ").trim(),
    };
  });
}

function parseActionPreference(value: unknown) {
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "buy" ||
    normalized === "wait" ||
    normalized === "reject" ||
    normalized === "watch_for_trigger" ||
    normalized === "avoid_chase"
  ) {
    return normalized;
  }
  if (normalized === "watch" || normalized === "hold" || normalized === "watchlist") return "wait";
  if (normalized === "avoid" || normalized === "skip") return "reject";
  return "unknown";
}

function getDenseFeedbackAction(date: string, options: SignalReviewCalendarMockOptions, index = 0) {
  const configuredAction = options.denseFeedbackActions?.[date];
  if (!Array.isArray(configuredAction)) return configuredAction ?? "buy";
  return configuredAction[index % configuredAction.length] ?? "buy";
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

function buildPendingReplayWindowFeedbackItems(date: string): SignalReviewCalendarFeedbackItem[] {
  return [
    { companyName: "한섬", horizon: 1, remainingDays: 1, symbol: "020000" },
    { companyName: "오성첨단소재", horizon: 3, remainingDays: 2, symbol: "052420" },
    { companyName: "카카오", horizon: 5, remainingDays: 3, symbol: "035720" },
  ].map((row) => ({
    id: `pending-replay-window-${row.horizon}d`,
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
      confidence_score_10: 6,
      conviction_score_10: 5,
      thesis_summary: `${row.horizon}D replay window is still pending.`,
      policy_version: "decider-policy-2026.07",
      evaluation: {
        review_conclusion: `Replay review is pending for the ${row.horizon}-day window.`,
        quality_reason:
          row.horizon === 1
            ? `The ${row.horizon}-day replay window is not mature yet.`
            : `The requested ${row.horizon}-day replay window is not fully observed yet, so the review remains provisional.`,
        realized_results: {
          [`${row.horizon}d`]: {
            status: "pending_maturity",
            notes: `The ${row.horizon}-day replay window is not mature yet.`,
            trading_days_remaining: row.remainingDays,
          },
        },
      },
      five_day_evaluation: {
        evaluation_status: "pending_evaluation_window",
        evaluation_status_reason: "not_mature",
        trading_days_remaining: row.horizon === 5 ? row.remainingDays : 3,
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
    received_at: `${date}T07:45:00+00:00`,
  }));
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
        preferred_action: getDenseFeedbackAction(date, options, index),
        next_day_open_action: getDenseFeedbackAction(date, options, index),
        confidence_score_10: 8,
        conviction_score_10: 7,
        thesis_summary: "Dense mobile calendar regression row.",
        ...(options.denseReviewedDates?.includes(date) && index % 2 === 0
          ? {
              quality_verdict: "Correct decision",
              review_conclusion: "Replay review completed.",
            }
          : {}),
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

  if (options.pendingReplayWindowDate === date) {
    return buildPendingReplayWindowFeedbackItems(date);
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

  if (options.issue705Date === date) {
    return [
      {
        companyName: "비상교육",
        id: "issue-705-bisang",
        review: "Wait was justified on replay.",
        stop: 4680,
        symbol: "100220",
        target: 5360,
      },
      {
        companyName: "한국주철관",
        id: "issue-705-background-row",
        review: "Wait was justified on replay.",
        stop: 9050,
        symbol: "000970",
        target: 10350,
      },
    ].map((row, index) => ({
      id: row.id,
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
        thesis_summary: "Calendar replay dialog focus trap regression row.",
        evaluation: {
          target_stop_result: "neither_hit",
          quality_reason: row.review,
          realized_results: {
            "1d": {
              status: "neither_hit",
              return_pct: index === 0 ? 0.22 : -0.14,
              target_hit: false,
              stop_hit: false,
            },
            "3d": {
              status: "neither_hit",
              return_pct: index === 0 ? 0.48 : 0.11,
              target_hit: false,
              stop_hit: false,
            },
            "5d": {
              status: "neither_hit",
              return_pct: index === 0 ? 0.72 : 0.18,
              target_hit: false,
              stop_hit: false,
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
      count: options.partialResultCounts?.[marketDate] ?? items.length,
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

function buildMismatchedStoredFeedbackItem(itemMarketDate: string): SignalReviewCalendarFeedbackItem {
  return {
    id: `mismatched-date-${itemMarketDate}`,
    market_date: itemMarketDate,
    symbol: "STALE-DATE-SYMBOL",
    agent: {
      name: "signal-decider",
      run_id: `feedback-cycle-${itemMarketDate}`,
    },
    summary: {},
    feedback: {
      role: "signal-decider",
      symbol: "STALE-DATE-SYMBOL",
      market_date: itemMarketDate,
      preferred_action: "buy",
      next_day_open_action: "buy",
      confidence_score_10: 10,
      conviction_score_10: 10,
      thesis_summary: "This stale-date row must never be applied to the requested calendar date.",
    },
    normalized_feedback: null,
    details: null,
    context: {
      symbol_day_context: {
        company: {
          name_ko: "Stale Date Company",
        },
      },
    },
    received_at: `${itemMarketDate}T07:45:00+00:00`,
  };
}

function buildMismatchedFeedbackListResponse(requestedMarketDate: string, itemMarketDate: string) {
  const item = buildMismatchedStoredFeedbackItem(itemMarketDate);
  return {
    request: {
      market_date: requestedMarketDate,
      symbols: [],
      agent_name: "signal-decider",
      limit: 200,
    },
    summary: {
      count: 1,
    },
    items: [item],
  };
}

function buildMismatchedReviewDateResponse(requestedMarketDate: string, itemMarketDate: string) {
  const item = buildMismatchedStoredFeedbackItem(itemMarketDate);
  return {
    request: {
      market_date: requestedMarketDate,
    },
    summary: {
      count: 1,
      review_status_counts: {},
    },
    items: [
      {
        snapshot_id: `${itemMarketDate}-stale-date-row`,
        symbol: item.symbol,
        market_date: item.market_date,
        run_id: item.agent.run_id,
        captured_at: item.received_at,
        decision: item.feedback,
        normalized_feedback: item.normalized_feedback,
        review: item.details,
        summary: item.summary,
        context: item.context,
      },
    ],
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
        watch_for_trigger: 0,
        avoid_chase: 0,
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
    if (options.forceFreshnessFailure) {
      await route.fulfill({
        status: 504,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Upstream request timed out",
          message: "Timed out after 5.0s while loading /eod/freshness from trading-core.",
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        today: {
          trade_date: options.freshnessTodayDate ?? "2026-04-27",
        },
        latest: {
          action_market_date: options.freshnessActionDate,
          price_trade_date: options.freshnessLatestDate ?? "2026-04-27",
        },
      }),
    });
  });

  await page.route("**/api/trading/agent-context/feedback/calendar**", async (route) => {
    requestHits.calendarSummary += 1;
    await options.calendarSummaryDelay;

    if (options.forceCalendarSummaryFailure) {
      const status = options.calendarSummaryFailureStatus ?? 502;
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({
          error: status === 504 ? "Upstream request timed out" : "Core calendar summary unavailable",
          message:
            status === 504
              ? "Timed out after 5.0s while loading /agent-context/feedback/calendar from trading-core."
              : "Fallback needed for compact month query.",
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
    await (options.reviewDateDelays?.[marketDate] ?? options.feedbackDelays?.[marketDate]);
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
    const responseMarketDate = options.progressResponseDateOverrides?.[marketDate] ?? marketDate;
    const storedDecisionCount =
      options.pendingRationaleDate === marketDate ||
      options.pendingWaitDate === marketDate ||
      options.mixedHorizonDate === marketDate
        ? 1
        : options.issue705Date === marketDate
          ? 2
        : options.pendingReplayWindowDate === marketDate
          ? 3
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
        options.issue705Date === marketDate ||
        options.identityFallbackDate === marketDate ||
        options.issue623Date === marketDate ||
        options.pendingReplayWindowDate === marketDate);
    const runStatus = hasRunningProgress ? "running" : isCompletedReviewDate ? "completed" : "pending";

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        request: {
          market_date: responseMarketDate,
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
          market_date: responseMarketDate,
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
              preferred_action: getDenseFeedbackAction(marketDate, options, index),
              next_day_open_action: getDenseFeedbackAction(marketDate, options, index),
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
        : options.emptyFeedbackDates?.includes(marketDate) || options.emptyFeedbackListDates?.includes(marketDate)
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

async function seedDashboardSignalDeciderRecoveryHint(page: Page, marketDate: string) {
  await page.addInitScript((date) => {
    window.sessionStorage.setItem(
      "kai.signalDeciderFeedbackRecovery.v1",
      JSON.stringify({
        version: 1,
        marketDate: date,
        cachedAt: Date.now(),
        source: "dashboard",
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

async function expectCompactCalendarStatusFillsCell(cell: Locator, text: string) {
  const statusPill = cell.locator('[data-calendar-cell-label="status"]');
  const compactToken = statusPill.locator('[data-calendar-label-variant="compact"]');

  await expect(compactToken).toHaveText(text);
  await expect(compactToken).toBeVisible();

  const metrics = await statusPill.evaluate((element) => {
    const cellElement = element.closest<HTMLElement>("[data-calendar-cell]");
    const token = element.querySelector<HTMLElement>('[data-calendar-label-variant="compact"]');
    const cellRect = cellElement?.getBoundingClientRect();
    const cellStyle = cellElement ? window.getComputedStyle(cellElement) : null;
    const statusRect = element.getBoundingClientRect();
    const tokenRect = token?.getBoundingClientRect();
    const cellHorizontalInset =
      (Number.parseFloat(cellStyle?.paddingLeft ?? "0") || 0) +
      (Number.parseFloat(cellStyle?.paddingRight ?? "0") || 0) +
      (Number.parseFloat(cellStyle?.borderLeftWidth ?? "0") || 0) +
      (Number.parseFloat(cellStyle?.borderRightWidth ?? "0") || 0);

    return {
      cellContentWidth: Math.max(0, (cellRect?.width ?? 0) - cellHorizontalInset),
      cellWidth: cellRect?.width ?? 0,
      statusScrollWidth: element.scrollWidth,
      statusWidth: statusRect.width,
      tokenClientWidth: token?.clientWidth ?? 0,
      tokenHeight: tokenRect?.height ?? 0,
      tokenScrollWidth: token?.scrollWidth ?? 0,
      tokenWidth: tokenRect?.width ?? 0,
    };
  });

  expect(metrics.statusWidth).toBeGreaterThanOrEqual(metrics.cellContentWidth - 1);
  expect(metrics.statusScrollWidth).toBeLessThanOrEqual(Math.ceil(metrics.statusWidth) + 1);
  expect(metrics.tokenScrollWidth).toBeLessThanOrEqual(metrics.tokenClientWidth + 1);
  expect(metrics.tokenWidth).toBeGreaterThanOrEqual(14);
  expect(metrics.tokenHeight).toBeGreaterThanOrEqual(9);
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
  await expect(page.getByRole("link", { name: "Review" }).first()).toBeVisible();

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

test("signal review calendar desktop rail does not label the month as market status", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockSignalReviewCalendar(page, {
    denseFeedbackDates: {
      "2026-07-02": 1,
    },
  });

  await page.goto("/calendar?date=2026-07-02");

  await expect(page.getByRole("heading", { name: "July 2026" })).toBeVisible();

  const railMarketStatus = page.locator('section[aria-label="Market status"]');
  await expect(railMarketStatus).toBeVisible();
  await expect(railMarketStatus).toContainText("Market status pending");
  await expect(railMarketStatus).not.toContainText("July 2026");
});

test("signal review calendar hydrates before adopting the browser-controlled product date", async ({ page }) => {
  const hydrationErrors: string[] = [];
  const isHydrationError = (message: string) =>
    /hydration|hydrated|server rendered html.*(?:did not|didn't) match/i.test(message);
  page.on("console", (message) => {
    if (message.type() === "error" && isHydrationError(message.text())) {
      hydrationErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (isHydrationError(error.message)) hydrationErrors.push(error.message);
  });

  await page.clock.setFixedTime(new Date("2026-07-05T00:34:00+09:00"));
  await mockSignalReviewCalendar(page, {
    denseFeedbackDates: {
      "2026-07-05": 1,
    },
  });

  await page.goto("/calendar?date=2026-07-05");

  await expect(page.getByRole("heading", { name: "July 2026" })).toBeVisible();
  await expect(page.locator('[data-calendar-cell="2026-07-05"]')).toBeEnabled();
  expect(hydrationErrors).toEqual([]);
});

test("signal review calendar does not disable the initial post-midnight KST current date", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-05T00:34:00+09:00"));
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSignalReviewCalendar(page, {
    denseFeedbackDates: {
      "2026-07-05": 1,
    },
  });

  await page.goto("/calendar?date=2026-07-05");
  await page.getByRole("button", { name: "Korean" }).click();

  await expect(page.getByRole("heading", { name: "시그널 리뷰 캘린더" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "July 2026" })).toBeVisible();

  const kstTodayCell = page.locator('[data-calendar-cell="2026-07-05"]');
  const kstTodayStatus = kstTodayCell.locator(
    '[data-calendar-cell-label="status"] [data-calendar-label-variant="full"]',
  );
  const kstTodayCount = kstTodayCell.locator(
    '[data-calendar-cell-label="count"] [data-calendar-label-variant="full"]',
  );
  await expect(kstTodayCell).toBeVisible();
  await expect(kstTodayCell).toBeEnabled();
  await expect(kstTodayCell).toHaveAttribute("aria-pressed", "true");
  await expect(kstTodayCell).not.toHaveAttribute("aria-label", /미래/);
  await expect(kstTodayStatus).not.toHaveText("미래");
  await expect(kstTodayStatus).toHaveText("저장됨");
  await expect(kstTodayCount).toHaveText("1 개 결정");
});

test("signal review calendar keeps bare loads pinned before KST midnight", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-13T23:57:00+09:00"));
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSignalReviewCalendar(page, {
    denseFeedbackDates: {
      "2026-07-13": 1,
      "2026-07-14": 1,
    },
    freshnessLatestDate: "2026-07-14",
    freshnessTodayDate: "2026-07-14",
  });

  await page.goto("/calendar");
  await page.getByRole("button", { name: "Korean" }).click();

  await expect(page.getByRole("heading", { name: "시그널 리뷰 캘린더" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "July 2026" })).toBeVisible();
  await expect(page).toHaveURL(/\/calendar\?date=2026-07-13$/);

  const kstTodayCell = page.locator('[data-calendar-cell="2026-07-13"]');
  const tomorrowCell = page.locator('[data-calendar-cell="2026-07-14"]');
  await expect(kstTodayCell).toBeVisible();
  await expect(kstTodayCell).toBeEnabled();
  await expect(kstTodayCell).toHaveAttribute("aria-pressed", "true");
  await expect(kstTodayCell).not.toHaveAttribute("aria-label", /미래/);
  await expect(tomorrowCell).toBeDisabled();
  await expect(
    tomorrowCell.locator('[data-calendar-cell-label="status"] [data-calendar-label-variant="full"]'),
  ).toHaveText("미래");
  await expect(page.getByRole("link", { name: "피드백 표 열기" }).first()).toHaveAttribute(
    "href",
    "/dashboard/signal-decider-feedback?marketDate=2026-07-13&navContext=calendar",
  );
});

test("signal review calendar refreshes the mounted post-midnight KST current date", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-07-02T23:55:00+09:00") });
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSignalReviewCalendar(page, {
    denseFeedbackDates: {
      "2026-07-03": 1,
    },
  });

  await page.goto("/calendar?date=2026-07-02");
  await page.getByRole("button", { name: "Korean" }).click();

  await expect(page.getByRole("heading", { name: "시그널 리뷰 캘린더" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "July 2026" })).toBeVisible();

  const mountedTodayCell = page.locator('[data-calendar-cell="2026-07-02"]');
  await expect(mountedTodayCell).toBeVisible();
  await expect(mountedTodayCell).toBeEnabled();
  await expect(mountedTodayCell).not.toHaveAttribute("aria-label", /미래/);

  await page.clock.runFor(39 * 60 * 1000);

  const kstTodayCell = page.locator('[data-calendar-cell="2026-07-03"]');
  const kstTodayStatus = kstTodayCell.locator(
    '[data-calendar-cell-label="status"] [data-calendar-label-variant="full"]',
  );
  const kstTodayCount = kstTodayCell.locator(
    '[data-calendar-cell-label="count"] [data-calendar-label-variant="full"]',
  );
  await expect(kstTodayCell).toBeVisible();
  await expect(kstTodayCell).toBeEnabled();
  await expect(kstTodayCell).not.toHaveAttribute("aria-label", /미래/);
  await expect(kstTodayStatus).not.toHaveText("미래");
  await expect(kstTodayStatus).toHaveText("저장됨");
  await expect(kstTodayCount).toHaveText("1 개 결정");

  await page.getByRole("button", { name: "오늘" }).click();

  await expect(page).toHaveURL(/\/calendar\?date=2026-07-03/);
  await expect(kstTodayCell).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "피드백 표 열기" }).first()).toHaveAttribute(
    "href",
    "/dashboard/signal-decider-feedback?marketDate=2026-07-03&navContext=calendar",
  );
});

test("signal review calendar traps replay dialog focus and restores the mobile opener", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSignalReviewCalendar(page, {
    issue705Date: "2026-05-04",
  });

  await page.goto("/calendar?date=2026-05-04");
  await page.getByRole("button", { name: /Korean/i }).click();
  await expect(page.getByRole("heading", { name: "시그널 리뷰 캘린더" })).toBeVisible();

  const openerCard = page.getByTestId("calendar-mobile-decision-card").filter({ hasText: "비상교육" });
  const opener = openerCard.locator("button").filter({ hasText: "리뷰" });
  await opener.scrollIntoViewIfNeeded();
  await opener.click();

  const dialog = page.getByRole("dialog", { name: /비상교육/ });
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
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
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
      .filter((link) => !dialog?.contains(link))
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
  expect(backgroundSuppression.outsideLinks.some((link) => link.label.includes("검토"))).toBe(true);
  for (const link of backgroundSuppression.outsideLinks) {
    expect(link.ariaHidden, `${link.label} should be directly aria-hidden`).toBe("true");
    expect(link.directInert, `${link.label} should be directly inert`).toBe(true);
    expect(link.hiddenAncestor, `${link.label} should have an aria-hidden ancestor`).toBe(true);
    expect(link.inertAncestor, `${link.label} should have an inert ancestor`).toBe(true);
  }

  const ariaSnapshot = await page.ariaSnapshot({ timeout: 5000 });
  expect(ariaSnapshot).toContain("dialog");
  expect(ariaSnapshot).toContain("비상교육");
  expect(ariaSnapshot).not.toContain("한국주철관");
  expect(ariaSnapshot).not.toMatch(/link "[^"]*(?:Review|검토|Overview|개요)/);

  for (let tabPress = 0; tabPress < 4; tabPress += 1) {
    await page.keyboard.press("Tab");
    const activeElementState = await getActiveElementState(page);
    expect(activeElementState.inDialog).toBe(true);
    expect(activeElementState.label).not.toContain("한국주철관");
  }

  await page.keyboard.press("Shift+Tab");
  const reverseTabState = await getActiveElementState(page);
  expect(reverseTabState.inDialog).toBe(true);
  expect(reverseTabState.label).not.toContain("한국주철관");

  await dialog.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByRole("dialog", { name: /비상교육/ })).toHaveCount(0);
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

test("signal review calendar bounds dense decision results and preserves the active window across replay detail", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockSignalReviewCalendar(page, {
    denseFeedbackActions: {
      "2026-10-01": ["wait", "buy"],
    },
    denseFeedbackDates: {
      "2026-10-01": 128,
    },
    denseReviewedDates: ["2026-10-01"],
  });

  await page.goto("/calendar?date=2026-10-01");
  await expect(page.getByRole("heading", { name: "Signal Review Calendar" })).toBeVisible();

  const resultWindow = page.getByTestId("calendar-result-window");
  const range = page.getByTestId("calendar-result-window-range");
  const cards = page.getByTestId("calendar-mobile-decision-card");
  await expect(resultWindow).toBeVisible();
  await expect(range).toHaveText("Showing 1–10 of 128 decisions");
  const resultsTable = page.locator("table").filter({ hasText: "Decision" });
  await expect(resultsTable).toBeVisible();
  await expect(resultsTable.locator("tbody tr")).toHaveCount(10);
  const desktopWindowOverflow = await resultWindow.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(desktopWindowOverflow).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(resultsTable).toBeHidden();
  await expect(cards).toHaveCount(10);
  await expect(cards.first()).toBeVisible();
  await expect(cards.filter({ hasText: "DENSE011" })).toHaveCount(0);

  const initialScrollHeight = await page.locator("[data-app-chrome-root] main").evaluate((main) => main.scrollHeight);
  expect(initialScrollHeight).toBeLessThan(30_000);

  await page
    .getByTestId("calendar-result-window-nav-top")
    .getByRole("button", { name: "Next" })
    .click();
  await expect(range).toHaveText("Showing 11–20 of 128 decisions");
  await expect(cards).toHaveCount(10);

  const openerCard = cards.first();
  const opener = openerCard.getByRole("button", { name: "Review" });
  await opener.scrollIntoViewIfNeeded();
  const main = page.locator("[data-app-chrome-root] main");
  const scrollTopBeforeDialog = await main.evaluate((element) => element.scrollTop);
  await opener.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(range).toHaveText("Showing 11–20 of 128 decisions");
  await expect(opener).toBeFocused();
  await expect
    .poll(async () => Math.abs((await main.evaluate((element) => element.scrollTop)) - scrollTopBeforeDialog))
    .toBeLessThanOrEqual(2);

  await resultWindow.getByLabel("Action").selectOption("buy");
  await expect(range).toHaveText("Showing 1–10 of 64 decisions");
  await resultWindow.getByLabel("Action").selectOption("all");
  await resultWindow.getByLabel("Review state").selectOption("reviewed");
  await expect(range).toHaveText("Showing 1–10 of 64 decisions");

  await resultWindow.getByRole("searchbox", { name: "Search symbols" }).fill("DENSE023");
  await expect(range).toHaveText("Showing 1–1 of 1 decisions");
  await expect(cards).toHaveCount(1);
  await expect(page.getByRole("article", { name: /Dense Regression 23 Selected-date decisions/ })).toBeVisible();
});

test("signal review calendar labels search and filters as loaded-only for partial decision results", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockSignalReviewCalendar(page, {
    denseFeedbackDates: {
      "2026-10-01": 12,
    },
    partialResultCounts: {
      "2026-10-01": 25,
    },
  });

  await page.goto("/calendar?date=2026-10-01");

  const resultWindow = page.getByTestId("calendar-result-window");
  const range = page.getByTestId("calendar-result-window-range");
  await expect(page.getByTestId("calendar-result-filter-scope")).toHaveText(
    "Search and filters apply only to 12 loaded decisions; the response reports 25 total decisions.",
  );
  await expect(range).toHaveText(
    "Showing 1–10 of 12 matching loaded decisions; search and filters cover only 12 of 25 total decisions.",
  );

  const getPartialWindowOverflow = () =>
    page.evaluate(() => {
      const resultWindowElement = document.querySelector<HTMLElement>('[data-testid="calendar-result-window"]');
      const controls = document.querySelector<HTMLElement>('[aria-label="Selected-date decision filters"]');
      return {
        controls: controls ? controls.scrollWidth - controls.clientWidth : null,
        document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        resultWindow: resultWindowElement ? resultWindowElement.scrollWidth - resultWindowElement.clientWidth : null,
      };
    });
  for (const overflow of Object.values(await getPartialWindowOverflow())) {
    expect(overflow).not.toBeNull();
    expect(overflow ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("calendar-result-filter-scope")).toBeVisible();
  await expect(range).toBeVisible();
  for (const overflow of Object.values(await getPartialWindowOverflow())) {
    expect(overflow).not.toBeNull();
    expect(overflow ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
  }

  await resultWindow.getByRole("searchbox", { name: "Search symbols" }).fill("DENSE012");
  await expect(range).toHaveText(
    "Showing 1–1 of 1 matching loaded decisions; search and filters cover only 12 of 25 total decisions.",
  );

  await resultWindow.getByRole("searchbox", { name: "Search symbols" }).fill("NOT-LOADED");
  await expect(range).toHaveText(
    "0 matches in loaded decisions; search and filters cover only 12 of 25 total decisions.",
  );
  await expect(
    page.getByText(
      "No loaded selected-date decisions match these filters. Unloaded decisions were not searched.",
    ),
  ).toHaveCount(2);
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

  await page.evaluate(() => {
    (window as Window & { __kaiFeedbackNavigationMarker?: string }).__kaiFeedbackNavigationMarker = "client-context";
  });
  await page.getByRole("link", { name: /피드백 표 열기/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/signal-decider-feedback\?marketDate=2026-04-27&navContext=calendar$/);
  await expect(page.getByRole("heading", { name: "시그널 디사이더 피드백" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { __kaiFeedbackNavigationMarker?: string }).__kaiFeedbackNavigationMarker ?? null),
    )
    .toBeNull();
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

test("calendar-sourced Korean feedback localizes pending replay-window review copy", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSignalReviewCalendar(page, {
    pendingReplayWindowDate: "2026-05-12",
  });

  await page.goto("/calendar?date=2026-05-12");
  await page.getByRole("button", { name: /Korean/i }).click();
  await expect(page.getByRole("heading", { name: "시그널 리뷰 캘린더" })).toBeVisible();

  await page.getByRole("link", { name: /피드백 표 열기/i }).first().click();

  await expect(page).toHaveURL(/\/dashboard\/signal-decider-feedback\?marketDate=2026-05-12&navContext=calendar$/);
  await expect(page.getByRole("heading", { name: "시그널 디사이더 피드백" })).toBeVisible();

  const pendingRows = [
    { companyName: "한섬", horizon: 1 },
    { companyName: "오성첨단소재", horizon: 3 },
    { companyName: "카카오", horizon: 5 },
  ];

  for (const row of pendingRows) {
    const card = page.getByRole("article", {
      name: new RegExp(`${row.companyName}.*시그널 디사이더 피드백`),
    });
    await expect(card).toBeVisible();
    await expect(card).toContainText(`${row.horizon}일 리플레이 기간 리뷰가 아직 대기 중입니다.`);
  }

  await expect(page.getByRole("article", { name: /한섬.*시그널 디사이더 피드백/ })).toContainText(
    "1일 리플레이 기간이 아직 성숙하지 않았습니다.",
  );
  await expect(page.getByRole("article", { name: /오성첨단소재.*시그널 디사이더 피드백/ })).toContainText(
    "요청한 3일 리플레이 기간이 아직 완전히 관측되지 않아 리뷰는 잠정 상태입니다.",
  );
  await expect(page.getByRole("article", { name: /카카오.*시그널 디사이더 피드백/ })).toContainText(
    "요청한 5일 리플레이 기간이 아직 완전히 관측되지 않아 리뷰는 잠정 상태입니다.",
  );

  await expect(page.locator("body")).not.toContainText("Replay review is pending for the");
  await expect(page.locator("body")).not.toContainText("not fully observed yet");
  await expect(page.locator("body")).not.toContainText("replay window is not mature yet");

  const firstCard = page.getByRole("article", { name: /한섬.*시그널 디사이더 피드백/ });
  await firstCard.getByRole("button", { name: "리뷰" }).click();
  const dialog = page.getByRole("dialog", { name: /한섬/ });
  await expect(dialog).toContainText("1일 리플레이 기간 리뷰가 아직 대기 중입니다.");
  await expect(dialog).toContainText("1일 리플레이 기간이 아직 성숙하지 않았습니다.");
  await expect(dialog).not.toContainText("Replay review is pending for the");
  await expect(dialog).not.toContainText("replay window is not mature yet");
});

test("calendar-sourced mobile feedback shows decision rows before data-gap diagnostics", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSignalReviewCalendar(page);

  await page.goto("/calendar?date=2026-04-27");
  await page.getByRole("button", { name: /Korean/i }).click();
  await page.getByRole("link", { name: /피드백 표 열기/i }).first().click();

  await expect(page).toHaveURL(/\/dashboard\/signal-decider-feedback\?marketDate=2026-04-27&navContext=calendar$/);
  const firstDecisionRow = page.getByTestId("signal-decider-result-card").first();
  const dataGapReport = page.getByTestId("decider-data-gaps-report");
  await expect(firstDecisionRow).toBeVisible();
  await expect(dataGapReport).toBeVisible();

  const orderedFeedbackBlocks = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll('[data-testid="signal-decider-result-card"], [data-testid="decider-data-gaps-report"]'),
      (element) => element.getAttribute("data-testid"),
    ),
  );
  expect(orderedFeedbackBlocks[0]).toBe("signal-decider-result-card");
  expect(orderedFeedbackBlocks).toContain("decider-data-gaps-report");

  const firstDecisionBox = await firstDecisionRow.boundingBox();
  const dataGapBox = await dataGapReport.boundingBox();
  expect(firstDecisionBox, "first decision row should have a rendered position").not.toBeNull();
  expect(dataGapBox, "data-gap report should have a rendered position").not.toBeNull();
  expect(firstDecisionBox!.y).toBeLessThan(dataGapBox!.y);
});

test("calendar keeps date-less feedback recovery disabled while the selected-date state is idle", async ({
  baseURL,
  browser,
}) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const page = await context.newPage();

  try {
    await page.goto("/calendar");

    const feedbackCta = page.getByTestId("calendar-feedback-cta");
    await expect(feedbackCta).toHaveText("Feedback table unavailable");
    await expect(feedbackCta).toBeDisabled();
    await expect(feedbackCta).toHaveAttribute("data-calendar-feedback-cta-state", "disabled");
    await expect(feedbackCta).not.toHaveAttribute("href");
    await expect(page.getByTestId("calendar-feedback-recovery-notice")).toContainText(
      "The selected date cannot open feedback rows right now.",
    );
  } finally {
    await context.close();
  }
});

test("calendar keeps date-less feedback recovery disabled while the selected-date read is loading", async ({
  page,
}) => {
  const pendingSelectedDateRead = createDeferred();

  try {
    await mockSignalReviewCalendar(page, {
      reviewDateDelays: {
        "2026-05-26": pendingSelectedDateRead.promise,
      },
    });

    await page.goto("/calendar?date=2026-05-26");

    const selectedPanel = page.locator("aside").filter({ has: page.getByRole("heading", { name: "2026-05-26" }) });
    await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveAttribute(
      "data-selected-date-status",
      "loading",
    );
    const feedbackCta = page.getByTestId("calendar-feedback-cta");
    await expect(feedbackCta).toHaveText("Feedback table unavailable");
    await expect(feedbackCta).toBeDisabled();
    await expect(feedbackCta).toHaveAttribute("data-calendar-feedback-cta-state", "disabled");
    await expect(feedbackCta).not.toHaveAttribute("href");
  } finally {
    pendingSelectedDateRead.resolve();
  }
});

test("calendar unavailable selected date delegates recovery to an exact-row latest-date resolver", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSignalReviewCalendar(page, {
    emptyFeedbackDates: ["2026-04-27"],
    forceCalendarSummaryFailure: true,
    forceFreshnessFailure: true,
    pendingWaitDate: "2026-04-24",
    runningProgressDates: ["2026-05-26"],
    timeoutFeedbackDates: ["2026-05-26"],
  });

  await page.goto("/calendar?date=2026-05-26");
  await page.getByRole("button", { name: /Korean/i }).click();

  const feedbackCta = page.getByTestId("calendar-feedback-cta");
  const selectedPanel = page.locator("aside").filter({ has: page.getByRole("heading", { name: "2026-05-26" }) });
  await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveAttribute(
    "data-selected-date-status",
    "unavailable",
  );
  await expect(feedbackCta).toHaveText("최근 검토 가능한 피드백 찾기");
  await expect(feedbackCta).toHaveAttribute("data-calendar-feedback-cta-state", "resolve-latest");
  await expect(feedbackCta).toHaveAttribute(
    "href",
    "/dashboard/signal-decider-feedback?navContext=calendar&originDate=2026-05-26",
  );
  await expect(page.getByTestId("calendar-feedback-recovery-notice")).toContainText(
    "저장된 피드백 행을 확인한 뒤에만 날짜를 선택",
  );
  const unavailableDate = page.locator('[data-calendar-cell="2026-05-26"]');
  await expect(unavailableDate).toBeDisabled();
  await expectNarrowMobileLabelsContained(page);
  await expect(page).toHaveURL(/\/calendar\?date=2026-05-26$/);
  await expect(page.getByTestId("feedback-error-primary")).toHaveCount(0);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(feedbackCta).toBeVisible();
  await expect(page.getByTestId("calendar-feedback-recovery-notice")).toBeVisible();
  await expect(unavailableDate).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });

  await page.unroute("**/api/trading/eod/freshness");
  await page.route("**/api/trading/eod/freshness", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        today: {
          trade_date: "2026-05-26",
        },
        latest: {
          action_market_date: "2026-04-24",
          price_trade_date: "2026-04-27",
        },
      }),
    });
  });

  await feedbackCta.click();
  await expect(page).toHaveURL(
    /\/dashboard\/signal-decider-feedback\?navContext=calendar&originDate=2026-05-26$/,
  );
  const resolvedFeedbackRow = page.getByTestId("signal-decider-result-card").first();
  await expect(resolvedFeedbackRow).toBeVisible();
  await expect(resolvedFeedbackRow).toContainText("003480");
  await expect(page.getByText("MD 2026-04-24")).toBeVisible();
});

test("calendar unavailable state opens backend-proven latest feedback without enabling unknown dates", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-08-17T09:00:00+09:00"));
  await page.setViewportSize({ width: 1440, height: 900 });
  const unavailableAugustDates = listMonthDates("2026-08");
  await mockSignalReviewCalendar(page, {
    forceCalendarSummaryFailure: true,
    freshnessActionDate: "2026-07-31",
    freshnessLatestDate: "2026-08-17",
    pendingWaitDate: "2026-07-31",
    timeoutFeedbackDates: unavailableAugustDates,
    timeoutReviewDateDates: unavailableAugustDates,
  });

  await page.goto("/calendar?date=2026-08-17");

  await expect(page.getByTestId("calendar-month-status")).toHaveText("Calendar scan unavailable");
  const firstPastDate = page.locator('[data-calendar-cell="2026-08-01"]');
  const selectedDate = page.locator('[data-calendar-cell="2026-08-17"]');
  await expect(firstPastDate).toHaveAttribute("aria-label", /2026-08-01 Unavailable/);
  await expect(firstPastDate).toBeDisabled();
  await expect(selectedDate).toHaveAttribute("aria-label", /2026-08-17 Unavailable/);
  await expect(selectedDate).toBeDisabled();

  const feedbackCta = page.getByTestId("calendar-feedback-cta");
  await expect(feedbackCta).toHaveAttribute("data-calendar-feedback-cta-state", "latest");
  await expect(feedbackCta).toHaveAttribute(
    "href",
    "/dashboard/signal-decider-feedback?marketDate=2026-07-31&navContext=calendar&originDate=2026-08-17",
  );
  await expect(page.getByTestId("calendar-feedback-recovery-notice")).toContainText("2026-07-31");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(feedbackCta).toBeVisible();
  await expect(firstPastDate).toBeDisabled();
  await expect(selectedDate).toBeDisabled();
  await expectNarrowMobileLabelsContained(page);

  await feedbackCta.click();
  await expect(page).toHaveURL(
    /\/dashboard\/signal-decider-feedback\?marketDate=2026-07-31&navContext=calendar&originDate=2026-08-17$/,
  );
  const destinationFeedbackRow = page.getByTestId("signal-decider-result-card").first();
  await expect(destinationFeedbackRow).toBeVisible();
  await expect(destinationFeedbackRow).toContainText("003480");
});

test("calendar feedback navigation stays idle when touch or pointer activation is cancelled", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSignalReviewCalendar(page);
  await page.goto("/calendar?date=2026-05-05");

  const feedbackCta = page.getByTestId("calendar-feedback-cta");
  await expect(feedbackCta).toHaveText("Open feedback table");

  await feedbackCta.dispatchEvent("pointerdown", {
    button: 0,
    buttons: 1,
    isPrimary: true,
    pointerId: 7,
    pointerType: "touch",
  });
  await feedbackCta.dispatchEvent("pointercancel", {
    button: 0,
    buttons: 0,
    isPrimary: true,
    pointerId: 7,
    pointerType: "touch",
  });

  await expect(feedbackCta).toHaveAttribute("data-navigation-pending", "false");
  await expect(feedbackCta).not.toHaveAttribute("aria-busy", "true");
  await expect(feedbackCta).toHaveText("Open feedback table");

  await page.setViewportSize({ width: 1440, height: 900 });
  const feedbackCtaBounds = await feedbackCta.boundingBox();
  expect(feedbackCtaBounds).not.toBeNull();
  if (!feedbackCtaBounds) return;

  await page.mouse.move(
    feedbackCtaBounds.x + feedbackCtaBounds.width / 2,
    feedbackCtaBounds.y + feedbackCtaBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(0, 0, { steps: 5 });
  await page.mouse.up();

  await expect(page).toHaveURL(/\/calendar\?date=2026-05-05$/);
  await expect(feedbackCta).toHaveAttribute("data-navigation-pending", "false");
  await expect(feedbackCta).not.toHaveAttribute("aria-busy", "true");
  await expect(feedbackCta).toHaveText("Open feedback table");
});

for (const activation of [
  { height: 900, input: "pointer", label: "desktop", width: 1440 },
  { height: 844, input: "pointer", label: "mobile", width: 390 },
  { height: 900, input: "keyboard", label: "keyboard", width: 1440 },
]) {
  test(`calendar unavailable latest-feedback navigation acknowledges routing and hands slow reads to the destination with ${activation.label} activation`, async ({
    page,
  }) => {
    const destinationDocument = createDeferred();
    const destinationRead = createDeferred();

    try {
      await page.clock.setFixedTime(new Date("2026-08-17T09:00:00+09:00"));
      await page.setViewportSize({ width: activation.width, height: activation.height });
      await seedDashboardSignalDeciderRecoveryHint(page, "2026-07-31");
      const unavailableAugustDates = listMonthDates("2026-08");
      await mockSignalReviewCalendar(page, {
        feedbackDelays: {
          "2026-07-31": destinationRead.promise,
        },
        forceCalendarSummaryFailure: true,
        runningProgressDates: ["2026-08-17"],
        timeoutFeedbackDates: [...unavailableAugustDates, "2026-07-31"],
        timeoutReviewDateDates: unavailableAugustDates,
      });
      await page.route("**/dashboard/signal-decider-feedback?**", async (route) => {
        if (!route.request().isNavigationRequest()) {
          await route.continue();
          return;
        }

        await destinationDocument.promise;
        await route.continue();
      });

      await page.goto("/calendar?date=2026-08-17");
      await expect(page.getByTestId("calendar-month-status")).toHaveText("Calendar scan unavailable");

      const feedbackCta = page.getByTestId("calendar-feedback-cta");
      await expect(feedbackCta).toHaveAttribute("data-calendar-feedback-cta-state", "latest");
      await expect(feedbackCta).toHaveText("Open latest feedback table");

      if (activation.input === "keyboard") {
        await feedbackCta.evaluate((element) => {
          const observer = new MutationObserver(() => {
            if (element.getAttribute("aria-busy") !== "true") return;

            window.requestAnimationFrame(() => {
              window.sessionStorage.setItem(
                "kai.test.calendarKeyboardNavigationAcknowledgement",
                `${element.getAttribute("data-navigation-pending")}:${element.textContent?.trim()}`,
              );
            });
            observer.disconnect();
          });
          observer.observe(element, {
            attributes: true,
            characterData: true,
            childList: true,
            subtree: true,
          });
        });
        await feedbackCta.focus();
        await page.keyboard.press("Enter");
        destinationDocument.resolve();
      } else {
        await feedbackCta.hover();
        await page.mouse.down();

        await expect(feedbackCta).toHaveAttribute("aria-busy", "true");
        await expect(feedbackCta).toHaveAttribute("data-navigation-pending", "true");
        await expect(feedbackCta).toHaveText("Opening feedback table...");
        expect(page.url()).toMatch(/\/calendar\?date=2026-08-17$/);

        await page.mouse.up();
        destinationDocument.resolve();
      }

      await expect(page).toHaveURL(
        /\/dashboard\/signal-decider-feedback\?marketDate=2026-07-31&navContext=calendar&originDate=2026-08-17$/,
      );
      await expect(page.getByRole("heading", { name: "Signal-decider feedback" })).toBeVisible();
      await expect(page.getByText("Loading Signal Decider feedback...").first()).toBeVisible();
      if (activation.input === "keyboard") {
        await expect
          .poll(() =>
            page.evaluate(() =>
              window.sessionStorage.getItem("kai.test.calendarKeyboardNavigationAcknowledgement"),
            ),
          )
          .toBe("true:Opening feedback table...");
      }

      destinationRead.resolve();

      await expect(page.getByTestId("feedback-error-primary").first()).toContainText(/timed out/i);
      await expect(page.getByTestId("feedback-error-retry").first()).toBeVisible();
    } finally {
      destinationDocument.resolve();
      destinationRead.resolve();
    }
  });
}

for (const viewport of [
  { height: 900, label: "desktop", width: 1440 },
  { height: 844, label: "mobile", width: 390 },
]) {
  test(`calendar keeps a stalled latest-feedback target acknowledged and retryable on ${viewport.label}`, async ({
    page,
  }) => {
    const backendRecoveryRead = createDeferred();

    try {
      await page.clock.install({ time: new Date("2026-08-27T09:00:00+09:00") });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await seedDashboardSignalDeciderRecoveryHint(page, "2026-07-30");
      const unavailableAugustDates = listMonthDates("2026-08");
      await mockSignalReviewCalendar(page, {
        feedbackDelays: {
          "2026-07-31": backendRecoveryRead.promise,
        },
        forceCalendarSummaryFailure: true,
        freshnessActionDate: "2026-07-31",
        freshnessLatestDate: "2026-08-27",
        pendingWaitDate: "2026-07-31",
        runningProgressDates: ["2026-08-27"],
        timeoutFeedbackDates: unavailableAugustDates,
        timeoutReviewDateDates: unavailableAugustDates,
      });

      await page.goto("/calendar?date=2026-08-27");
      await page.getByRole("button", { name: "Korean" }).click();
      await expect(page.getByTestId("calendar-month-status")).toHaveText("캘린더 스캔 사용 불가");

      const feedbackCta = page.getByTestId("calendar-feedback-cta");
      const attemptedHref =
        "/dashboard/signal-decider-feedback?marketDate=2026-07-30&navContext=calendar&originDate=2026-08-27";
      await expect(feedbackCta).toHaveText("최근 피드백 표 열기");
      await expect(feedbackCta).toHaveAttribute("href", attemptedHref);

      await page.evaluate((expectedHref) => {
        document.addEventListener(
          "click",
          (event) => {
            const anchor = (event.target as Element | null)?.closest("a[href]");
            if (anchor?.getAttribute("href") === expectedHref) {
              event.preventDefault();
            }
          },
          { once: true },
        );
      }, attemptedHref);

      await feedbackCta.hover();
      await page.mouse.down();
      await expect(feedbackCta).toHaveAttribute("data-navigation-pending", "true");
      await expect(feedbackCta).toHaveText("피드백 표 여는 중...");
      await page.mouse.up();
      await expect(page).toHaveURL(/\/calendar\?date=2026-08-27$/);

      backendRecoveryRead.resolve();
      await expect
        .poll(() =>
          page.evaluate(() => {
            const value = window.sessionStorage.getItem("kai.signalDeciderFeedback.v1:dates");
            return value ? (JSON.parse(value) as { marketDates?: string[] }).marketDates?.[0] : null;
          }),
        )
        .toBe("2026-07-31");

      await expect(feedbackCta).toHaveAttribute("href", attemptedHref);
      await expect(feedbackCta).toHaveAttribute("data-navigation-pending", "true");
      await expect(page.getByTestId("calendar-feedback-recovery-notice")).toContainText("2026-07-30");

      await page.clock.fastForward(12_000);

      await expect(feedbackCta).toHaveAttribute("data-navigation-failed", "true");
      await expect(feedbackCta).toHaveAttribute("data-navigation-pending", "false");
      await expect(feedbackCta).toHaveText("피드백 표 열기 다시 시도");
      await expect(page.getByTestId("calendar-feedback-navigation-failure")).toHaveText(
        "피드백 표가 열리지 않았습니다. 연결을 확인하고 이 작업을 다시 시도하세요.",
      );

      await feedbackCta.hover();
      await page.mouse.down();
      await expect(feedbackCta).toHaveAttribute("data-navigation-pending", "true");
      await page.mouse.up();

      await expect(page).toHaveURL(
        /\/dashboard\/signal-decider-feedback\?marketDate=2026-07-30&navContext=calendar&originDate=2026-08-27$/,
      );
      await expect(page.getByRole("heading", { name: "시그널 디사이더 피드백" })).toBeVisible();
    } finally {
      backendRecoveryRead.resolve();
    }
  });
}

test("calendar unavailable scan avoids a false zero and surfaces mobile shell recovery", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-08-16T09:00:00+09:00"));
  await page.setViewportSize({ width: 390, height: 844 });
  const unavailableAugustDates = listMonthDates("2026-08");
  const requestHits = await mockSignalReviewCalendar(page, {
    forceCalendarSummaryFailure: true,
    runningProgressDates: ["2026-08-16"],
    timeoutFeedbackDates: unavailableAugustDates,
    timeoutReviewDateDates: unavailableAugustDates,
  });

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Korean" }).click();
  await page.locator('[data-mobile-nav-item="calendar"]').click();

  await expect(page).toHaveURL(/\/calendar\?date=2026-08-16$/);
  await expect(page.getByRole("heading", { name: "시그널 리뷰 캘린더" })).toBeVisible();
  await expect(page.getByTestId("calendar-month-status")).toHaveText("캘린더 스캔 사용 불가");
  await expect(page.getByTestId("calendar-month-decision-count")).toHaveText("월간 결정 수 사용 불가");
  await expect(page.getByText("0 월간 결정", { exact: true })).toHaveCount(0);
  const firstPastDate = page.locator('[data-calendar-cell="2026-08-01"]');
  const selectedDate = page.locator('[data-calendar-cell="2026-08-16"]');
  await expect(firstPastDate).toHaveAttribute("aria-label", /2026-08-01 사용 불가/);
  await expect(firstPastDate).toBeDisabled();
  await expect(selectedDate).toHaveAttribute("aria-label", /2026-08-16 사용 불가/);
  await expect(selectedDate).toBeDisabled();
  const feedbackCta = page.getByTestId("calendar-feedback-cta");
  await expect(feedbackCta).toHaveAttribute(
    "data-calendar-feedback-cta-state",
    "latest",
  );
  await expect(feedbackCta).toHaveAttribute(
    "href",
    "/dashboard/signal-decider-feedback?marketDate=2026-04-27&navContext=calendar&originDate=2026-08-16",
  );
  await expect(page.getByTestId("calendar-feedback-recovery-notice")).toContainText(
    "2026-04-27",
  );
  await expect(page.getByTestId("calendar-month-recovery")).toContainText(
    "이 달과 선택한 날짜의 캘린더 조회를 다시 시도하세요.",
  );

  const initialCalendarSummaryHits = requestHits.calendarSummary;
  const initialReviewDateHits = requestHits.reviewDate;
  await page.getByTestId("calendar-month-retry").click();
  await expect.poll(async () => requestHits.calendarSummary).toBeGreaterThan(initialCalendarSummaryHits);
  await expect.poll(async () => requestHits.reviewDate).toBeGreaterThan(initialReviewDateHits);
  await expectNarrowMobileLabelsContained(page);

  await feedbackCta.click();
  await expect(page).toHaveURL(
    /\/dashboard\/signal-decider-feedback\?marketDate=2026-04-27&navContext=calendar&originDate=2026-08-16$/,
  );
});

test("calendar partial scan keeps failed dates and a zero month total unavailable", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-08-16T09:00:00+09:00"));
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSignalReviewCalendar(page, {
    forceCalendarSummaryFailure: true,
    timeoutFeedbackDates: ["2026-08-16"],
    timeoutReviewDateDates: ["2026-08-16"],
  });

  await page.goto("/calendar?date=2026-08-16");

  await expect(page.getByTestId("calendar-month-status")).toHaveText("Month loaded with partial coverage");
  await expect(page.getByTestId("calendar-month-decision-count")).toHaveText(
    "Month decision count unavailable",
  );
  await expect(page.getByText("0 month decisions", { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-calendar-cell="2026-08-15"]')).toHaveAttribute(
    "aria-label",
    /2026-08-15 No rows/,
  );
  await expect(page.locator('[data-calendar-cell="2026-08-16"]')).toHaveAttribute(
    "aria-label",
    /2026-08-16 Unavailable/,
  );
  await expect(page.getByTestId("calendar-month-recovery")).toContainText(
    "Some dates could not be read, so the month decision count is incomplete.",
  );
  await expect(page.getByTestId("calendar-month-retry")).toHaveText("Retry calendar reads");
  await expect(page.getByTestId("calendar-empty-month-notice")).toHaveCount(0);
});

test("calendar unavailable selected date routes feedback CTA to latest cached usable date", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedDashboardSignalDeciderCache(page, "2026-04-27");
  await mockSignalReviewCalendar(page, {
    forceCalendarSummaryFailure: true,
    runningProgressDates: ["2026-05-26"],
    timeoutFeedbackDates: ["2026-05-26"],
    timeoutReviewDateDates: ["2026-05-26"],
  });

  await page.goto("/calendar?date=2026-05-26");
  await page.getByRole("button", { name: /Korean/i }).click();

  const feedbackCta = page.getByTestId("calendar-feedback-cta");
  await expect(feedbackCta).toHaveText("최근 피드백 표 열기");
  await expect(feedbackCta).toHaveAttribute("data-calendar-feedback-cta-state", "latest");
  await expect(feedbackCta).toHaveAttribute(
    "href",
    "/dashboard/signal-decider-feedback?marketDate=2026-04-27&navContext=calendar&originDate=2026-05-26",
  );
  await expect(page.getByTestId("calendar-feedback-recovery-notice")).toContainText("2026-04-27");

  await feedbackCta.click();

  await expect(page).toHaveURL(
    /\/dashboard\/signal-decider-feedback\?marketDate=2026-04-27&navContext=calendar&originDate=2026-05-26$/,
  );
  await expect(page.getByRole("heading", { name: "시그널 디사이더 피드백" })).toBeVisible();
  await expect(
    page
      .getByLabel("캘린더 피드백 컨텍스트")
      .getByText("캘린더 / 선택 날짜 2026-05-26 / 피드백 기준일 2026-04-27"),
  ).toBeVisible();
  await expect(page.getByTestId("signal-decider-result-card").first()).toBeVisible();
  const calendarReturnLink = page.getByRole("link", {
    name: "캘린더로 돌아가기 (선택 날짜 2026-05-26)",
  });
  await expect(calendarReturnLink).toHaveAttribute("href", "/calendar?date=2026-05-26");

  await calendarReturnLink.click();
  await expect(page).toHaveURL(/\/calendar\?date=2026-05-26$/);
});

test("calendar unavailable scan routes to the latest dashboard-known feedback date without cached rows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const unavailableAugustDates = Array.from(
    { length: 31 },
    (_, index) => `2026-08-${String(index + 1).padStart(2, "0")}`,
  );
  await seedDashboardSignalDeciderRecoveryHint(page, "2026-07-31");
  await mockSymbolDetailApis(page, {
    companyName: "한진중공업홀딩스",
    marketDate: "2026-07-31",
    symbol: "003480",
  });
  await mockSignalReviewCalendar(page, {
    forceCalendarSummaryFailure: true,
    pendingWaitDate: "2026-07-31",
    runningProgressDates: ["2026-08-03"],
    timeoutFeedbackDates: unavailableAugustDates,
    timeoutReviewDateDates: unavailableAugustDates,
  });

  await page.goto("/calendar?date=2026-08-03");
  await page.getByRole("button", { name: /Korean/i }).click();

  await expect(page.getByText("캘린더 스캔 사용 불가", { exact: true })).toBeVisible();
  const feedbackCta = page.getByTestId("calendar-feedback-cta");
  await expect(feedbackCta).toHaveText("최근 피드백 표 열기");
  await expect(feedbackCta).toHaveAttribute("data-calendar-feedback-cta-state", "latest");
  await expect(feedbackCta).toHaveAttribute(
    "href",
    "/dashboard/signal-decider-feedback?marketDate=2026-07-31&navContext=calendar&originDate=2026-08-03",
  );
  await expect(page.getByTestId("calendar-feedback-recovery-notice")).toHaveText(
    "캘린더 조회를 사용할 수 없어 대시보드에서 마지막으로 확인한 피드백 기준일 2026-07-31을 엽니다.",
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.sessionStorage.getItem("kai.signalDeciderFeedback.v1:2026-07-31")),
    )
    .toBeNull();

  await feedbackCta.click();

  await expect(page).toHaveURL(
    /\/dashboard\/signal-decider-feedback\?marketDate=2026-07-31&navContext=calendar&originDate=2026-08-03$/,
  );
  await expect(page.getByRole("heading", { name: "시그널 디사이더 피드백" })).toBeVisible();
  await expect(
    page
      .getByLabel("캘린더 피드백 컨텍스트")
      .getByText("캘린더 / 선택 날짜 2026-08-03 / 피드백 기준일 2026-07-31"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "캘린더로 돌아가기 (선택 날짜 2026-08-03)" })).toHaveAttribute(
    "href",
    "/calendar?date=2026-08-03",
  );
  const feedbackCard = page.getByRole("article", { name: /한진중공업홀딩스 .*피드백/i });
  await expect(feedbackCard).toBeVisible();
  const symbolLink = feedbackCard.getByRole("link", { name: /한진중공업홀딩스.*003480/ });
  await expect(symbolLink).toHaveAttribute(
    "href",
    /\/dashboard\/symbol\/003480\?.*marketDate=2026-07-31.*feedbackNavContext=calendar.*feedbackOriginDate=2026-08-03.*feedbackRoute=signal-decider-feedback/,
  );

  await symbolLink.click();
  const feedbackReturnLink = page.getByRole("link", { name: /피드백으로 돌아가기/i });
  await expect(feedbackReturnLink).toHaveAttribute(
    "href",
    /\/dashboard\/signal-decider-feedback\?(?=.*marketDate=2026-07-31)(?=.*navContext=calendar)(?=.*originDate=2026-08-03)/,
  );

  await feedbackReturnLink.click();
  const restoredCalendarReturnLink = page.getByRole("link", {
    name: "캘린더로 돌아가기 (선택 날짜 2026-08-03)",
  });
  await expect(restoredCalendarReturnLink).toHaveAttribute("href", "/calendar?date=2026-08-03");

  await restoredCalendarReturnLink.click();
  await expect(page).toHaveURL(/\/calendar\?date=2026-08-03$/);
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
  await expect(feedbackLink).toHaveAttribute(
    "href",
    /\/dashboard\/signal-decider-feedback\?marketDate=2026-05-05/,
  );

  const previousDateCell = page.getByRole("button", { name: /2026-05-04/ });
  await expect(previousDateCell).toBeEnabled();
  await previousDateCell.click();
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
    /\/dashboard\/symbol\/003480\?.*marketDate=2026-05-06.*navContext=signal-decider-feedback.*feedbackNavContext=calendar.*feedbackRoute=signal-decider-feedback/,
  );

  await symbolLink.click();
  await expect(page).toHaveURL(/\/dashboard\/symbol\/003480\?.*navContext=signal-decider-feedback/);
  const feedbackReturnLink = page.getByRole("link", { name: /피드백으로 돌아가기/i });
  await expect(feedbackReturnLink).toHaveAttribute(
    "href",
    /\/dashboard\/signal-decider-feedback\?(?=.*marketDate=2026-05-06)(?=.*navContext=calendar)/,
  );
  await expect(page.getByRole("link", { name: /대시보드로 돌아가기/i })).toHaveCount(0);

  await feedbackReturnLink.click();
  await expect(page).toHaveURL(/\/dashboard\/signal-decider-feedback\?(?=.*marketDate=2026-05-06)(?=.*navContext=calendar)/);
  await expect(page.getByRole("heading", { name: /^시그널 디사이더 피드백$/i })).toBeVisible();
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

test("signal review calendar rejects stale item dates from the per-date month fallback", async ({ page }) => {
  const requestedMarketDate = "2026-05-05";
  const staleItemMarketDate = "2026-05-04";
  const requestHits = await mockSignalReviewCalendar(page, {
    forceCalendarSummaryFailure: true,
  });
  await page.route("**/api/trading/agent-context/feedback?**", async (route) => {
    const marketDate = new URL(route.request().url()).searchParams.get("market_date");
    if (marketDate !== requestedMarketDate) {
      await route.fallback();
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(buildMismatchedFeedbackListResponse(requestedMarketDate, staleItemMarketDate)),
    });
  });

  await page.goto("/calendar?date=2026-05-06");

  await expect.poll(async () => requestHits.feedback).toBe(listMonthDates("2026-05").length - 1);
  const mismatchedDateCell = page.locator(`[data-calendar-cell="${requestedMarketDate}"]`);
  await expect(mismatchedDateCell).toHaveAttribute("aria-label", new RegExp(`${requestedMarketDate} Unavailable`));
  await expect(mismatchedDateCell).toBeDisabled();
  await expect(mismatchedDateCell).not.toContainText("1 decision");
  await expect(page.getByText("Stale Date Company")).toHaveCount(0);
});

test("signal review calendar keeps exact-date cache when the dedicated review returns stale item dates", async ({
  page,
}) => {
  const requestedMarketDate = "2026-05-07";
  const staleItemMarketDate = "2026-05-06";
  await seedDashboardSignalDeciderCache(page, requestedMarketDate);
  const requestHits = await mockSignalReviewCalendar(page, {
    denseFeedbackDates: {
      [requestedMarketDate]: 1,
    },
    emptyFeedbackListDates: [requestedMarketDate],
  });
  await page.route("**/api/trading/agent-context/feedback/review?**", async (route) => {
    const marketDate = new URL(route.request().url()).searchParams.get("market_date");
    if (marketDate !== requestedMarketDate) {
      await route.fallback();
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(buildMismatchedReviewDateResponse(requestedMarketDate, staleItemMarketDate)),
    });
  });

  await page.goto(`/calendar?date=${requestedMarketDate}`);

  await expect.poll(async () => requestHits.reviewDate).toBe(0);
  await expect.poll(async () => requestHits.feedback).toBe(1);
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("calendar-feedback-cta")).toHaveText("Open 1 rows in feedback table");
  await expect(page.getByText("Stale Date Company")).toHaveCount(0);
  await expect(page.getByText("STALE-DATE-SYMBOL")).toHaveCount(0);
});

test("signal review calendar rejects stale item dates from the generic selected-date fallback", async ({
  page,
}) => {
  const requestedMarketDate = "2026-05-08";
  const staleItemMarketDate = "2026-05-07";
  const requestHits = await mockSignalReviewCalendar(page, {
    reviewDateErrorMessages: {
      [requestedMarketDate]: "Dedicated selected-date review is unavailable.",
    },
  });
  await page.route("**/api/trading/agent-context/feedback?**", async (route) => {
    const marketDate = new URL(route.request().url()).searchParams.get("market_date");
    if (marketDate !== requestedMarketDate) {
      await route.fallback();
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(buildMismatchedFeedbackListResponse(requestedMarketDate, staleItemMarketDate)),
    });
  });

  await page.goto(`/calendar?date=${requestedMarketDate}`);

  await expect.poll(async () => requestHits.reviewDate).toBe(1);
  await page.waitForLoadState("networkidle");
  const selectedPanel = page.locator("aside").filter({
    has: page.getByRole("heading", { name: requestedMarketDate }),
  });
  await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveAttribute(
    "data-selected-date-status",
    "unavailable",
  );
  const requestedDateCell = page.locator(`[data-calendar-cell="${requestedMarketDate}"]`);
  await expect(requestedDateCell).not.toContainText("1 decision");
  await expect(page.getByText("Stale Date Company")).toHaveCount(0);
  await expect(page.getByText("STALE-DATE-SYMBOL")).toHaveCount(0);
});

test("signal review calendar ignores running progress reported for a different market date", async ({ page }) => {
  const selectedDate = "2026-05-08";
  await mockSignalReviewCalendar(page, {
    denseFeedbackDates: { [selectedDate]: 1 },
    progressResponseDateOverrides: { [selectedDate]: "2026-05-07" },
    runningProgressDates: [selectedDate],
  });

  await page.goto(`/calendar?date=${selectedDate}`);

  const selectedPanel = page.locator("aside").filter({
    has: page.getByRole("heading", { name: selectedDate }),
  });
  await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveAttribute(
    "data-selected-date-status",
    "completed",
  );
  await expect(selectedPanel.locator("[data-selected-date-status]")).not.toHaveText("Run active");
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
    await page.setViewportSize({ width: 390, height: 844 });
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
    await expect(page.getByText("최소 118 월간 결정")).toBeVisible();
    await expect(page.getByRole("heading", { name: "2026-05-22" })).toBeVisible();
    await expect(page.getByRole("link", { name: /피드백 표 열기/i }).first()).toHaveAttribute(
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
    await expect(delayedPastCell.locator('[data-calendar-cell-label="count"]')).toBeHidden();
    await expect(delayedPastCell.locator('[data-calendar-cell-label="action-mix"]')).toBeHidden();
    await expect(delayedPastCell).toHaveAttribute("aria-label", "2026-05-01 부분");
    await expect(delayedPastCell).not.toContainText(/부분\s*--\s*부분/);
    await expect(delayedPastCell).not.toContainText("로딩 중");
  } finally {
    delayedHistoricalDateFetch.resolve();
  }
});

test("signal review calendar avoids repeated partial fragments in Korean mobile fallback cells", async ({ page }) => {
  const delayedIssueDateFetch = createDeferred();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSignalReviewCalendar(page, {
      denseFeedbackDates: {
        "2026-05-27": 5,
      },
      forceCalendarSummaryFailure: true,
      feedbackDelays: {
        "2026-05-08": delayedIssueDateFetch.promise,
      },
    });

    await page.goto("/calendar?date=2026-05-27");
    await page.getByRole("button", { name: "Korean" }).click();

    await expect(page.getByText("월간 커버리지가 부분적으로 로드됨")).toBeVisible();
    const unresolvedCell = page.locator('[data-calendar-cell="2026-05-08"]');
    await expect(
      unresolvedCell.locator('[data-calendar-cell-label="status"] [data-calendar-label-variant="compact"]'),
    ).toHaveText("부분");
    await expect(unresolvedCell.locator('[data-calendar-cell-label="count"]')).toBeHidden();
    await expect(unresolvedCell.locator('[data-calendar-cell-label="action-mix"]')).toBeHidden();
    await expect(unresolvedCell).toHaveAttribute("aria-label", "2026-05-08 부분");
    await expect(unresolvedCell).not.toContainText(/부분\s*--\s*부분/);
  } finally {
    delayedIssueDateFetch.resolve();
  }
});

test("signal review calendar synchronizes selected context when navigating to the previous month", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-23T09:00:00+09:00"));
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSignalReviewCalendar(page);

  await page.goto("/calendar?date=2026-07-23");
  await expect(page.getByRole("heading", { name: "2026-07-23" })).toBeVisible();

  await page.getByRole("button", { name: "Previous month" }).click();

  await expect(page).toHaveURL(/\/calendar\?date=2026-06-23$/);
  await expect(page.getByRole("heading", { name: "June 2026" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "2026-06-23" })).toBeVisible();
  await expect(page.locator("[data-dashboard-toolbar-subtitle]")).toHaveText("2026-06-23");
  await expect(page.locator('[data-calendar-cell="2026-06-23"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-calendar-cell="2026-07-23"][aria-pressed="true"]')).toHaveCount(0);
});

test("signal review calendar clamps the selected day to the target month", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-23T09:00:00+09:00"));
  await mockSignalReviewCalendar(page);

  await page.goto("/calendar?date=2026-03-31");
  await page.getByRole("button", { name: "Previous month" }).click();

  await expect(page).toHaveURL(/\/calendar\?date=2026-02-28$/);
  await expect(page.getByRole("heading", { name: "February 2026" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "2026-02-28" })).toBeVisible();
  await expect(page.locator('[data-calendar-cell="2026-02-28"]')).toHaveAttribute("aria-pressed", "true");
});

test("signal review calendar clamps current-month navigation to today", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-23T09:00:00+09:00"));
  await mockSignalReviewCalendar(page);

  await page.goto("/calendar?date=2026-06-30");
  await page.getByRole("button", { name: "Next month" }).click();

  await expect(page).toHaveURL(/\/calendar\?date=2026-07-23$/);
  await expect(page.getByRole("heading", { name: "July 2026" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "2026-07-23" })).toBeVisible();
  await expect(page.locator('[data-calendar-cell="2026-07-23"]')).toHaveAttribute("aria-pressed", "true");
});

test("signal review calendar labels unresolved month loading cells as loading instead of run", async ({ page }) => {
  const delayedMonthSummary = createDeferred();
  const delayedSelectedDateFetch = createDeferred();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSignalReviewCalendar(page, {
      calendarSummaryDelay: delayedMonthSummary.promise,
      feedbackDelays: {
        "2026-05-26": delayedSelectedDateFetch.promise,
      },
    });

    await page.goto("/calendar?date=2026-05-26");
    await expect(page.getByRole("heading", { name: "Signal Review Calendar" })).toBeVisible();
    await expect(page.getByTestId("calendar-month-status")).toHaveText("Loading decision dates");
    await expect(page.getByTestId("calendar-month-decision-count")).toHaveText("Month decision count pending");
    await expect(page.getByText("0 month decisions", { exact: true })).toHaveCount(0);

    const unresolvedPastCell = page.locator('[data-calendar-cell="2026-05-01"]');
    await expect(
      unresolvedPastCell.locator('[data-calendar-cell-label="status"] [data-calendar-label-variant="full"]'),
    ).toHaveText("Loading");
    await expect(
      unresolvedPastCell.locator('[data-calendar-cell-label="status"] [data-calendar-label-variant="compact"]'),
    ).toHaveText("LOAD");
    await expect(unresolvedPastCell.locator('[data-calendar-cell-label="count"]')).toBeHidden();
    await expect(unresolvedPastCell.locator('[data-calendar-cell-label="action-mix"]')).toBeHidden();
    await expect(unresolvedPastCell).not.toContainText("RUN");
  } finally {
    delayedMonthSummary.resolve();
    delayedSelectedDateFetch.resolve();
  }
});

test("signal review calendar keeps no-date current-month loading cells out of run state", async ({ page }) => {
  const delayedMonthSummary = createDeferred();
  const delayedSelectedDateFetch = createDeferred();
  try {
    await page.clock.setFixedTime(new Date("2026-06-29T09:00:00+09:00"));
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSignalReviewCalendar(page, {
      calendarSummaryDelay: delayedMonthSummary.promise,
      feedbackDelays: {
        "2026-06-29": delayedSelectedDateFetch.promise,
      },
      forceFreshnessFailure: true,
    });

    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Signal Review Calendar" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "June 2026" })).toBeVisible();
    await expect(page.getByTestId("calendar-month-status")).toHaveText("Loading decision dates");
    await expect(page.getByTestId("calendar-month-decision-count")).toHaveText("Month decision count pending");
    await expect(page.getByText("0 month decisions", { exact: true })).toHaveCount(0);

    const unresolvedPastCell = page.locator('[data-calendar-cell="2026-06-01"]');
    await expect(
      unresolvedPastCell.locator('[data-calendar-cell-label="status"] [data-calendar-label-variant="full"]'),
    ).toHaveText("Loading");
    await expect(
      unresolvedPastCell.locator('[data-calendar-cell-label="status"] [data-calendar-label-variant="compact"]'),
    ).toHaveText("LOAD");
    await expect(unresolvedPastCell.locator('[data-calendar-cell-label="count"]')).toBeHidden();
    await expect(unresolvedPastCell.locator('[data-calendar-cell-label="action-mix"]')).toBeHidden();
    await expect(unresolvedPastCell).not.toContainText("RUN");
    await expect(
      page.locator('[data-calendar-cell-label="status"] [data-calendar-label-variant="compact"]', { hasText: "RUN" }),
    ).toHaveCount(0);
  } finally {
    delayedMonthSummary.resolve();
    delayedSelectedDateFetch.resolve();
  }
});

test("signal review calendar keeps timed-out current-month fallback cells scannable on mobile", async ({ page }) => {
  const delayedFallbackFeedback = createDeferred();
  try {
    await page.clock.setFixedTime(new Date("2026-06-29T09:00:00+09:00"));
    await page.setViewportSize({ width: 390, height: 844 });
    const juneDates = listMonthDates("2026-06");
    const requestHits = await mockSignalReviewCalendar(page, {
      calendarSummaryFailureStatus: 504,
      feedbackDelays: Object.fromEntries(juneDates.map((date) => [date, delayedFallbackFeedback.promise])),
      forceCalendarSummaryFailure: true,
      forceFreshnessFailure: true,
      runningProgressDates: ["2026-06-29"],
      timeoutFeedbackDates: juneDates,
    });

    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Signal Review Calendar" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "June 2026" })).toBeVisible();
    await expect(page.getByTestId("calendar-month-status")).toHaveText("Loading decision dates");
    await expect(page.getByTestId("calendar-month-decision-count")).toHaveText("Month decision count pending");
    await expect(page.getByText("0 month decisions", { exact: true })).toHaveCount(0);
    await expect.poll(async () => requestHits.calendarSummary).toBeGreaterThanOrEqual(1);
    await expect.poll(async () => requestHits.feedback).toBeGreaterThan(0);

    const firstPastCell = page.locator('[data-calendar-cell="2026-06-01"]');
    await expect(
      firstPastCell.locator('[data-calendar-cell-label="status"] [data-calendar-label-variant="full"]'),
    ).toHaveText("Loading");
    await expect(
      firstPastCell.locator('[data-calendar-cell-label="status"] [data-calendar-label-variant="compact"]'),
    ).toHaveText("LOAD");
    await expectCompactCalendarStatusFillsCell(firstPastCell, "LOAD");
    await expect(firstPastCell.locator('[data-calendar-cell-label="count"]')).toBeHidden();
    await expect(firstPastCell.locator('[data-calendar-cell-label="action-mix"]')).toBeHidden();
    await expect(firstPastCell).not.toContainText("RUN");

    const selectedTodayCell = page.locator('[data-calendar-cell="2026-06-29"]');
    await expect(
      selectedTodayCell.locator('[data-calendar-cell-label="status"] [data-calendar-label-variant="compact"]'),
    ).toHaveText("LOAD");
    await expectCompactCalendarStatusFillsCell(selectedTodayCell, "LOAD");
    await expect(selectedTodayCell).not.toContainText("RUN");
    await expect(
      page.locator('[data-calendar-cell-label="status"] [data-calendar-label-variant="compact"]', { hasText: "RUN" }),
    ).toHaveCount(0);

    delayedFallbackFeedback.resolve();

    await expect(page.getByTestId("calendar-month-status")).toHaveText("Calendar scan unavailable");
    await expect(firstPastCell).toHaveAttribute("aria-label", /2026-06-01 Unavailable/);
    await expect(firstPastCell).toBeDisabled();
    await expectCompactCalendarStatusFillsCell(firstPastCell, "ERR");
    await expect(selectedTodayCell).toHaveAttribute("aria-label", /2026-06-29 Unavailable/);
    await expect(selectedTodayCell).toBeDisabled();
    await expectCompactCalendarStatusFillsCell(selectedTodayCell, "ERR");
    await expect(page.getByTestId("calendar-month-decision-count")).toHaveText(
      "Month decision count unavailable",
    );
    await expect(page.getByText("0 month decisions", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("calendar-month-recovery")).toContainText(
      "Retry calendar reads for this month and the selected date",
    );
    await expect(page.getByTestId("calendar-month-retry")).toHaveText("Retry calendar reads");

    await page.getByRole("button", { name: "Korean" }).click();
    await expect(page.getByRole("heading", { name: "시그널 리뷰 캘린더" })).toBeVisible();
    await expect(page.getByTestId("calendar-month-status")).toHaveText("캘린더 스캔 사용 불가");
    await expect(firstPastCell).toHaveAttribute("aria-label", /2026-06-01 사용 불가/);
    await expect(firstPastCell).toBeDisabled();
    await expectCompactCalendarStatusFillsCell(firstPastCell, "불가");
    await expect(selectedTodayCell).toHaveAttribute("aria-label", /2026-06-29 사용 불가/);
    await expect(selectedTodayCell).toBeDisabled();
    await expectCompactCalendarStatusFillsCell(selectedTodayCell, "불가");
    await expect(page.getByTestId("calendar-month-decision-count")).toHaveText("월간 결정 수 사용 불가");
    await expect(page.getByText("0 월간 결정", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("calendar-month-recovery")).toContainText(
      "이 달과 선택한 날짜의 캘린더 조회를 다시 시도하세요.",
    );
    const initialCalendarSummaryHits = requestHits.calendarSummary;
    const initialReviewDateHits = requestHits.reviewDate;
    await page.getByTestId("calendar-month-retry").click();
    await expect.poll(async () => requestHits.calendarSummary).toBeGreaterThan(initialCalendarSummaryHits);
    await expect.poll(async () => requestHits.reviewDate).toBeGreaterThan(initialReviewDateHits);
    await expectNarrowMobileLabelsContained(page);
  } finally {
    delayedFallbackFeedback.resolve();
  }
});

test("signal review calendar keeps failed dates disabled but separately retryable during a partial month", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requestHits = await mockSignalReviewCalendar(page, {
    denseFeedbackDates: {
      "2026-05-04": 3,
    },
    forceCalendarSummaryFailure: true,
    timeoutFeedbackDates: ["2026-05-05"],
    timeoutReviewDateDates: ["2026-05-05"],
  });

  await page.goto("/calendar?date=2026-05-05");
  await expect(page.getByTestId("calendar-month-status")).toHaveText("Month loaded with partial coverage");

  const successfulDateCell = page.locator('[data-calendar-cell="2026-05-04"]');
  await expect(successfulDateCell).toBeEnabled();

  const failedDateCell = page.locator('[data-calendar-cell="2026-05-05"]');
  await expect(failedDateCell).toHaveAttribute("aria-label", /2026-05-05 Unavailable/);
  await expect(failedDateCell).toBeDisabled();
  await expect(failedDateCell).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\/calendar\?date=2026-05-05$/);
  const selectedPanel = page.locator("aside").filter({ has: page.getByRole("heading", { name: "2026-05-05" }) });
  await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveAttribute(
    "data-selected-date-status",
    "unavailable",
  );
  await expect(selectedPanel).toContainText(
    "The selected-date read failed. This does not confirm that no decisions are stored.",
  );
  await expect(page.getByTestId("calendar-selected-date-retry")).toHaveText("Retry calendar reads");

  await page.getByRole("button", { name: "Korean" }).click();
  await expect(failedDateCell).toHaveAttribute("aria-label", /2026-05-05 사용 불가/);
  await expect(failedDateCell).toBeDisabled();
  await expect(selectedPanel).toContainText("선택한 날짜 조회에 실패했습니다.");
  await expect(page.getByTestId("calendar-selected-date-retry")).toHaveText("캘린더 조회 다시 시도");

  const initialCalendarSummaryHits = requestHits.calendarSummary;
  const initialReviewDateHits = requestHits.reviewDate;
  await page.getByTestId("calendar-selected-date-retry").click();
  await expect.poll(async () => requestHits.calendarSummary).toBeGreaterThan(initialCalendarSummaryHits);
  await expect.poll(async () => requestHits.reviewDate).toBeGreaterThan(initialReviewDateHits);
});

test("signal review calendar confirms a completed empty month without disabling usable dates", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSignalReviewCalendar(page);

  await page.goto("/calendar?date=2026-05-26");
  await expect(page.getByRole("heading", { name: "Signal Review Calendar" })).toBeVisible();
  await expect(page.getByTestId("calendar-month-status")).toHaveText("Month scan ready");
  await expect(page.getByTestId("calendar-empty-month-notice")).toHaveText(
    "Month scan completed: no stored decisions were found.",
  );

  const selectedDateCell = page.locator('[data-calendar-cell="2026-05-26"]');
  await expect(selectedDateCell).toBeEnabled();
  await expect(selectedDateCell).toHaveAttribute("aria-label", /2026-05-26 No rows/);
  await expect(page.getByTestId("calendar-month-recovery")).toHaveCount(0);

  await page.getByRole("button", { name: "Korean" }).click();
  await expect(page.getByTestId("calendar-empty-month-notice")).toHaveText(
    "월간 스캔이 완료되었으며 저장된 결정이 없습니다.",
  );
});

test("signal review calendar settles zero-row selected-date summary while the month snapshot is unresolved", async ({
  page,
}) => {
  const delayedMonthSummary = createDeferred();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    const requestHits = await mockSignalReviewCalendar(page, {
      calendarSummaryDelay: delayedMonthSummary.promise,
      forceCalendarSummaryFailure: true,
    });

    await page.goto("/calendar?date=2026-05-26");
    await page.getByRole("button", { name: "Korean" }).click();
    await expect(page.getByRole("heading", { name: "시그널 리뷰 캘린더" })).toBeVisible();
    await expect.poll(async () => requestHits.reviewDate).toBeGreaterThanOrEqual(1);
    await expect.poll(async () => requestHits.progress).toBeGreaterThanOrEqual(1);

    const selectedPanel = page.locator("aside").filter({ has: page.getByRole("heading", { name: "2026-05-26" }) });
    await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveAttribute(
      "data-selected-date-status",
      "empty",
    );
    await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveText("행 없음");
    await expect(selectedPanel.locator("div").filter({ hasText: /^액션 믹스\s*행 없음$/ }).locator("strong")).toHaveText(
      "행 없음",
    );
    await expect(selectedPanel).toContainText("선택한 날짜에 저장된 시그널 디사이더 결정이 없습니다.");
    await expect(selectedPanel).not.toContainText("선택한 날짜의 결정을 불러오는 중...");

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
    await expect(selectedDateCell).toBeDisabled();
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
    await expect(
      selectedPanel.locator("div").filter({ hasText: /^총 결정\s*사용 불가$/ }).locator("strong"),
    ).toHaveText("사용 불가");
    await expect(
      selectedPanel.locator("div").filter({ hasText: /^리뷰된 행\s*사용 불가$/ }).locator("strong"),
    ).toHaveText("사용 불가");
    await expect(
      selectedPanel.locator("div").filter({ hasText: /^5D 목표 \/ 손절\s*사용 불가$/ }).locator("strong"),
    ).toHaveText("사용 불가");
    await expect(
      selectedPanel.locator("div").filter({ hasText: /^5D 대기 상태\s*사용 불가$/ }).locator("strong"),
    ).toHaveText("사용 불가");
    await expect(
      selectedPanel.locator("div").filter({ hasText: /^단기 기간\s*사용 불가$/ }).locator("strong"),
    ).toHaveText("사용 불가");
    await expect(selectedPanel).toContainText("선택한 날짜 조회에 실패했습니다.");
    await expect(selectedPanel).toContainText("저장된 결정이 없다는 뜻은 아닙니다.");
    await expect(selectedPanel).not.toContainText("선택한 날짜에 저장된 시그널 디사이더 결정이 없습니다.");
    await expect(selectedPanel).not.toContainText("로딩 중");
    await expect(page.getByTestId("calendar-selected-date-retry")).toHaveText("캘린더 조회 다시 시도");
    const feedbackCta = page.getByTestId("calendar-feedback-cta");
    await expect(feedbackCta).toHaveText("최근 피드백 표 열기");
    await expect(feedbackCta).toHaveAttribute("data-calendar-feedback-cta-state", "latest");
    await expect(feedbackCta).toHaveAttribute(
      "href",
      "/dashboard/signal-decider-feedback?marketDate=2026-04-27&navContext=calendar&originDate=2026-05-26",
    );
    await expect(page.getByTestId("calendar-feedback-recovery-notice")).toContainText("2026-04-27");
    await expect(page).toHaveURL(/\/calendar\?date=2026-05-26$/);
  } finally {
    unavailableDateFetch.resolve();
  }
});

test("signal review calendar settles selected-date body and review rows when month fallback is unavailable", async ({
  page,
}) => {
  const pendingSelectedReview = createDeferred();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSignalReviewCalendar(page, {
      forceCalendarSummaryFailure: true,
      reviewDateDelays: {
        "2026-05-26": pendingSelectedReview.promise,
      },
      timeoutFeedbackDates: ["2026-05-26"],
    });

    await page.goto("/calendar?date=2026-05-26");
    await expect(page.getByRole("heading", { name: "Signal Review Calendar" })).toBeVisible();

    const selectedPanel = page.locator("aside").filter({ has: page.getByRole("heading", { name: "2026-05-26" }) });
    await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveAttribute(
      "data-selected-date-status",
      "unavailable",
    );
    await expect(selectedPanel).toContainText(
      "The selected-date read failed. This does not confirm that no decisions are stored.",
    );
    await expect(selectedPanel).not.toContainText("Loading selected-date decisions...");
    await expect(page.getByTestId("calendar-selected-date-retry")).toHaveText("Retry calendar reads");

    const reviewRowsSection = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Selected-date decisions" }) });
    await expect(reviewRowsSection).toContainText(
      "The selected-date read failed. This does not confirm that no decisions are stored.",
    );
    await expect(reviewRowsSection).not.toContainText("Loading selected-date decisions...");
    await expect(page.getByText("Loading selected-date decisions...")).toHaveCount(0);
  } finally {
    pendingSelectedReview.resolve();
  }
});

test("signal review calendar uses stored month evidence while selected-date details remain pending", async ({ page }) => {
  const pendingSelectedReview = createDeferred();
  const denseFeedbackDates = Object.fromEntries(
    Array.from({ length: 15 }, (_, index) => [`2026-08-${String(index + 2).padStart(2, "0")}`, 12]),
  );

  try {
    await page.clock.setFixedTime(new Date("2026-08-16T09:00:00+09:00"));
    await page.setViewportSize({ width: 1365, height: 900 });
    await mockSignalReviewCalendar(page, {
      denseFeedbackDates,
      reviewDateDelays: {
        "2026-08-16": pendingSelectedReview.promise,
      },
    });

    await page.goto("/calendar?date=2026-08-16");

    await expect(page.getByTestId("calendar-month-status")).toHaveText("Month scan ready");
    await expect(page.getByTestId("calendar-month-decision-count")).toHaveText("180 month decisions");

    const selectedPanel = page.locator("aside").filter({ has: page.getByRole("heading", { name: "2026-08-16" }) });
    await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveAttribute(
      "data-selected-date-status",
      "partial",
    );
    await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveText("Partial");
    await expect(
      selectedPanel.locator("div").filter({ hasText: /^Total decisions\s*12$/ }).locator("strong"),
    ).toHaveText("12");
    await expect(
      selectedPanel.locator("div").filter({ hasText: /^5D target \/ stop\s*Unavailable$/ }).locator("strong"),
    ).toHaveText("Unavailable");
    await expect(selectedPanel).toContainText(
      "The inline review summary is unavailable, but 12 stored feedback rows are available in the feedback table.",
    );
    await expect(selectedPanel).not.toContainText("Loading selected-date decisions...");

    const reviewRowsSection = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Selected-date decisions" }) });
    await expect(reviewRowsSection).toContainText(
      "The inline review summary is unavailable, but 12 stored feedback rows are available in the feedback table.",
    );
    await expect(reviewRowsSection).not.toContainText("Loading selected-date decisions...");
    await expect(page.getByText("Loading selected-date decisions...")).toHaveCount(0);

    const feedbackCta = page.getByTestId("calendar-feedback-cta");
    await expect(feedbackCta).toHaveAttribute("data-calendar-feedback-cta-state", "selected");
    await expect(feedbackCta).toHaveText("Open 12 rows in feedback table");
    await expect(feedbackCta).toHaveAttribute(
      "href",
      "/dashboard/signal-decider-feedback?marketDate=2026-08-16&navContext=calendar",
    );
  } finally {
    pendingSelectedReview.resolve();
  }
});

test("signal review calendar keeps calendar evidence when selected-date review times out", async ({ page }) => {
  await mockSignalReviewCalendar(page, {
    denseFeedbackDates: {
      "2026-05-27": 5,
    },
    timeoutReviewDateDates: ["2026-05-27"],
  });

  await page.goto("/calendar?date=2026-05-27");
  await expect(page.getByRole("heading", { name: "Signal Review Calendar" })).toBeVisible();

  const selectedPanel = page.locator("aside").filter({ has: page.getByRole("heading", { name: "2026-05-27" }) });
  await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveAttribute(
    "data-selected-date-status",
    "partial",
  );
  await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveText("Partial");
  await expect(
    selectedPanel.locator("div").filter({ hasText: /^Total decisions\s*5$/ }).locator("strong"),
  ).toHaveText("5");
  await expect(
    selectedPanel.locator("div").filter({ hasText: /^Action mix\s*Buy 5$/ }).locator("strong"),
  ).toHaveText("Buy 5");
  await expect(
    selectedPanel.locator("div").filter({ hasText: /^Reviewed rows\s*0$/ }).locator("strong"),
  ).toHaveText("0");
  await expect(
    selectedPanel.locator("div").filter({ hasText: /^5D target \/ stop\s*Unavailable$/ }).locator("strong"),
  ).toHaveText("Unavailable");
  await expect(
    selectedPanel.locator("div").filter({ hasText: /^5D pending state\s*Unavailable$/ }).locator("strong"),
  ).toHaveText("Unavailable");
  await expect(
    selectedPanel.locator("div").filter({ hasText: /^Shorter horizons\s*Unavailable$/ }).locator("strong"),
  ).toHaveText("Unavailable");
  await expect(selectedPanel).not.toContainText(/pending maturity 0/i);
  await expect(selectedPanel).toContainText(
    "The inline review summary is unavailable, but 5 stored feedback rows are available in the feedback table.",
  );
  await expect(page.getByTestId("calendar-feedback-cta")).toHaveText("Open 5 rows in feedback table");
  await expect(page.getByTestId("calendar-feedback-cta")).toHaveAttribute(
    "href",
    "/dashboard/signal-decider-feedback?marketDate=2026-05-27&navContext=calendar",
  );
  await expect(selectedPanel).not.toContainText("Loading selected-date decisions...");

  const reviewRowsSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Selected-date decisions" }) });
  await expect(reviewRowsSection).toContainText(
    "The inline review summary is unavailable, but 5 stored feedback rows are available in the feedback table.",
  );
  await expect(reviewRowsSection).not.toContainText("Loading selected-date decisions...");
  await expect(reviewRowsSection).not.toContainText("Dense Regression");
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

test("signal review calendar keeps Korean selected-date summary words intact across responsive widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockSignalReviewCalendar(page, { mixedHorizonDate: "2026-04-30" });

  await page.goto("/calendar?date=2026-04-30");
  await page.getByRole("button", { name: "Korean" }).click();

  const selectedPanel = page.locator("aside").filter({ has: page.getByRole("heading", { name: "2026-04-30" }) });
  const pendingMetric = selectedPanel
    .locator("div")
    .filter({ hasText: /^5D 대기 상태\s*성숙 대기 1 · 가격 데이터 부족 1 · 미계산 0$/ })
    .locator("strong");

  await expect(pendingMetric).toHaveText("성숙 대기 1 · 가격 데이터 부족 1 · 미계산 0");
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1280, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(pendingMetric).toHaveCSS("word-break", "keep-all");

    const layoutMetrics = await pendingMetric.evaluate((element) => {
      const textNode = element.firstChild;
      const text = textNode?.textContent ?? "";
      const wordStart = text.indexOf("데이터");

      if (!(textNode instanceof Text) || wordStart < 0) {
        throw new Error("Expected the Korean data status word in the selected-date metric.");
      }

      const range = document.createRange();
      range.setStart(textNode, wordStart);
      range.setEnd(textNode, wordStart + "데이터".length);

      const selectedPanel = element.closest("aside");
      return {
        panelFits: selectedPanel instanceof HTMLElement && selectedPanel.scrollWidth <= selectedPanel.clientWidth,
        priceDataLineCount: range.getClientRects().length,
      };
    });
    expect(layoutMetrics.priceDataLineCount).toBe(1);
    expect(layoutMetrics.panelFits).toBe(true);
  }
});

test("signal review calendar shows a partial selected-date state from stored evidence when inline review is unavailable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSignalReviewCalendar(page, {
    denseFeedbackActions: {
      "2026-07-30": ["watch_for_trigger", "avoid_chase"],
    },
    denseFeedbackDates: {
      "2026-07-30": 60,
    },
    timeoutFeedbackDates: ["2026-07-30"],
    timeoutReviewDateDates: ["2026-07-30"],
  });

  await page.goto("/calendar?date=2026-07-30");
  await page.getByRole("button", { name: "Korean" }).click();

  await expect(page.getByTestId("calendar-month-state")).toContainText("60 월간 결정");

  const selectedDateCell = page.locator('[data-calendar-cell="2026-07-30"]');
  await expect(selectedDateCell).toHaveAttribute("aria-label", /2026-07-30 저장됨.*60 개 결정/);

  const selectedPanel = page.locator("aside").filter({ has: page.getByRole("heading", { name: "2026-07-30" }) });
  await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveAttribute(
    "data-selected-date-status",
    "partial",
  );
  await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveText("부분");
  await expect(
    selectedPanel.locator("div").filter({ hasText: /^총 결정\s*60$/ }).locator("strong"),
  ).toHaveText("60");
  const actionMixMetric = selectedPanel
    .locator("div")
    .filter({ hasText: /^액션 믹스\s*대기 30 · 제외 30$/ })
    .locator("strong");
  await expect(actionMixMetric).toHaveText("대기 30 · 제외 30");
  await expect(actionMixMetric).not.toHaveText("대기 중");
  await expect(
    selectedPanel.locator("div").filter({ hasText: /^리뷰된 행\s*0$/ }).locator("strong"),
  ).toHaveText("0");
  await expect(
    selectedPanel.locator("div").filter({ hasText: /^5D 목표 \/ 손절\s*사용 불가$/ }).locator("strong"),
  ).toHaveText("사용 불가");
  await expect(selectedPanel).toContainText(
    "인라인 리뷰 요약을 불러오지 못했지만 피드백 표에서 저장된 60개 행을 확인할 수 있습니다.",
  );
  await expect(selectedPanel).not.toContainText("선택한 날짜 리뷰를 불러오지 못했습니다. 날짜를 다시 선택해");

  const feedbackCta = page.getByTestId("calendar-feedback-cta");
  await expect(feedbackCta).toHaveText("피드백 표에서 60개 행 열기");
  await expect(feedbackCta).toHaveAttribute("data-calendar-feedback-cta-state", "selected");
  await expect(feedbackCta).toHaveAttribute(
    "href",
    "/dashboard/signal-decider-feedback?marketDate=2026-07-30&navContext=calendar",
  );

  const reviewRowsSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "선택 날짜 결정" }) });
  await expect(reviewRowsSection).toContainText(
    "인라인 리뷰 요약을 불러오지 못했지만 피드백 표에서 저장된 60개 행을 확인할 수 있습니다.",
  );
});

test("signal review calendar caps the stored feedback rows promised by the recovery CTA", async ({ page }) => {
  await mockSignalReviewCalendar(page, {
    denseFeedbackActions: {
      "2026-05-27": "wait",
    },
    denseFeedbackDates: {
      "2026-05-27": 275,
    },
    timeoutFeedbackDates: ["2026-05-27"],
    timeoutReviewDateDates: ["2026-05-27"],
  });

  await page.goto("/calendar?date=2026-05-27");

  const feedbackCta = page.getByTestId("calendar-feedback-cta");
  await expect(feedbackCta).toHaveText("Open up to 200 rows in feedback table");
  await expect(feedbackCta).not.toContainText("275");
  await expect(feedbackCta).toHaveAttribute(
    "href",
    "/dashboard/signal-decider-feedback?marketDate=2026-05-27&navContext=calendar",
  );
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
    title: "Review",
  });
  await expect(selectedDateCell).toBeVisible();
  await expect(selectedDateCell.locator('[data-calendar-cell-label="status"] [data-calendar-label-variant="compact"]')).toBeVisible();
  await expect(selectedDateCell.locator('[data-calendar-cell-label="count"] [data-calendar-label-variant="compact"]')).toHaveText("111");
  await expect(selectedDateCell.locator('[data-calendar-cell-label="action-mix"] [data-calendar-label-variant="compact"]')).toHaveText("W");

  const navLabels = page.locator("[data-mobile-nav-label]");
  await expect(navLabels).toHaveCount(4);
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
      { lineHeight: expect.any(Number), text: "Overview", whiteSpace: "nowrap", wraps: false },
      { lineHeight: expect.any(Number), text: "Explore", whiteSpace: "nowrap", wraps: false },
      { lineHeight: expect.any(Number), text: "Review", whiteSpace: "nowrap", wraps: false },
      { lineHeight: expect.any(Number), text: "Portfolio", whiteSpace: "nowrap", wraps: false },
    ]);
  await expectNarrowMobileLabelsContained(page);

  await page.getByRole("button", { name: "Korean" }).click();
  await expect(page.getByRole("heading", { name: "시그널 리뷰 캘린더" })).toBeVisible();
  await expectMobileToolbarRouteContextContained(page, {
    subtitle: "2026-05-08",
    title: "검토",
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

test("signal review calendar wraps partial month status on 390px mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSignalReviewCalendar(page, {
    denseFeedbackDates: {
      "2026-05-08": 111,
    },
    forceCalendarSummaryFailure: true,
    timeoutFeedbackDates: ["2026-05-09"],
  });

  await page.goto("/calendar?date=2026-05-08");

  const monthStatus = page.getByTestId("calendar-month-status");
  await expect(monthStatus).toHaveText("Month loaded with partial coverage");
  const statusFit = await monthStatus.evaluate((element) => {
    const parent = element.closest<HTMLElement>("[data-testid='calendar-month-state']");
    const rect = element.getBoundingClientRect();
    const parentRect = parent?.getBoundingClientRect();

    return {
      crossesParent:
        parentRect !== undefined &&
        (rect.left < parentRect.left - 1 ||
          rect.right > parentRect.right + 1 ||
          rect.top < parentRect.top - 1 ||
          rect.bottom > parentRect.bottom + 1),
      horizontalClip: element.scrollWidth > element.clientWidth + 1,
      text: element.textContent?.trim() ?? "",
    };
  });
  expect(statusFit).toEqual({
    crossesParent: false,
    horizontalClip: false,
    text: "Month loaded with partial coverage",
  });
});

test("signal review calendar keeps month cells and replay rows above the mobile bottom nav", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSignalReviewCalendar(page, {
    issue672Date: "2026-05-27",
  });

  await page.goto("/calendar?date=2026-05-27");
  await expect(page.getByRole("heading", { name: "Signal Review Calendar" })).toBeVisible();

  const scrollportMetrics = await page.locator("[data-app-chrome-root]").evaluate((root) => {
    const main = root.querySelector("main");
    const bottomNav = root.querySelector('nav[aria-label="Primary"], nav[aria-label="기본 내비게이션"]');
    const bottomChrome = bottomNav?.parentElement;

    if (!(main instanceof HTMLElement) || !(bottomChrome instanceof HTMLElement)) {
      return null;
    }

    const mainRect = main.getBoundingClientRect();
    const chromeRect = bottomChrome.getBoundingClientRect();
    const mainStyle = window.getComputedStyle(main);

    return {
      chromeTop: chromeRect.top,
      mainBottom: mainRect.bottom,
      mainClientHeight: main.clientHeight,
      mainOverflowY: mainStyle.overflowY,
      mainScrollHeight: main.scrollHeight,
    };
  });

  expect(scrollportMetrics).not.toBeNull();
  expect(scrollportMetrics!.mainOverflowY).toBe("auto");
  expect(scrollportMetrics!.mainScrollHeight).toBeGreaterThan(scrollportMetrics!.mainClientHeight);
  expect(scrollportMetrics!.mainBottom).toBeLessThanOrEqual(scrollportMetrics!.chromeTop);

  const selectedDateCell = page.locator('[data-calendar-cell="2026-05-27"]');
  await selectedDateCell.evaluate((element) => element.scrollIntoView({ block: "end" }));
  const selectedCellClearance = await selectedDateCell.evaluate((element) => {
    const bottomNav = document.querySelector('nav[aria-label="Primary"], nav[aria-label="기본 내비게이션"]');
    const bottomChrome = bottomNav?.parentElement;

    if (!(bottomChrome instanceof HTMLElement)) {
      throw new Error("Expected mobile bottom chrome to be rendered.");
    }

    return bottomChrome.getBoundingClientRect().top - element.getBoundingClientRect().bottom;
  });
  expect(selectedCellClearance).toBeGreaterThanOrEqual(8);

  const lastReplayCard = page.getByRole("article", { name: /성창오토텍.*Selected-date decisions/ });
  await expect(lastReplayCard).toBeVisible();
  await expectMobileContentClearsBottomChrome(page, lastReplayCard);
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
  await expect(
    page.getByText(
      "The selected-date read failed. This does not confirm that no decisions are stored. Retry calendar reads instead of selecting another unavailable date.",
    ).first(),
  ).toBeVisible();
  await expect(page.getByText("Loading selected-date decisions...")).toHaveCount(0);
  await expect(page.getByText("No signal-decider decisions are stored for the selected date.")).toHaveCount(0);
});

test("signal review calendar resolves a successful empty fallback on the initial selected-date load", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requestHits = await mockSignalReviewCalendar(page, {
    reviewDateErrorMessages: {
      "2026-08-05":
        "Timed out after 5.0s while loading /agent-context/feedback/review from trading-core.",
    },
  });

  await page.goto("/calendar?date=2026-08-05");

  const selectedPanel = page.locator("aside").filter({ has: page.getByRole("heading", { name: "2026-08-05" }) });
  await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveAttribute(
    "data-selected-date-status",
    "empty",
  );
  await expect(selectedPanel).toContainText("No signal-decider decisions are stored for the selected date.");
  await expect(page.getByTestId("calendar-selected-date-retry")).toHaveCount(0);
  await expect.poll(async () => requestHits.reviewDate).toBe(1);
  await expect.poll(async () => requestHits.feedback).toBe(1);

  const feedbackCta = page.getByTestId("calendar-feedback-cta");
  await expect(feedbackCta).toHaveAttribute("data-calendar-feedback-cta-state", "selected");
  await expect(feedbackCta).toHaveAttribute(
    "href",
    "/dashboard/signal-decider-feedback?marketDate=2026-08-05&navContext=calendar",
  );

  await feedbackCta.click();
  await expect(page).toHaveURL(
    /\/dashboard\/signal-decider-feedback\?marketDate=2026-08-05&navContext=calendar$/,
  );
  await expect(page.getByRole("heading", { name: "Signal-decider feedback" })).toBeVisible();
  await expect(page.getByText("No Signal Decider feedback rows were returned for 2026-08-05.")).toBeVisible();
});

test("signal review calendar keeps review failures visible while an empty fallback date is still running", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSignalReviewCalendar(page, {
    reviewDateErrorMessages: {
      "2026-08-05":
        "Timed out after 5.0s while loading /agent-context/feedback/review from trading-core.",
    },
    runningProgressDates: ["2026-08-05"],
  });

  await page.goto("/calendar?date=2026-08-05");

  const selectedPanel = page.locator("aside").filter({ has: page.getByRole("heading", { name: "2026-08-05" }) });
  await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveAttribute(
    "data-selected-date-status",
    "unavailable",
  );
  await expect(selectedPanel).toContainText(
    "The selected-date read failed. This does not confirm that no decisions are stored.",
  );
  await expect(selectedPanel).not.toContainText("No signal-decider decisions are stored for the selected date.");
  await expect(page.getByTestId("calendar-selected-date-retry")).toHaveText("Retry calendar reads");
});

test("signal review calendar keeps review failures visible when an empty fallback contradicts stored decisions", async ({
  page,
}) => {
  const delayedFeedback = createDeferred();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSignalReviewCalendar(page, {
      denseFeedbackDates: {
        "2026-05-27": 5,
      },
      emptyFeedbackListDates: ["2026-05-27"],
      feedbackDelays: {
        "2026-05-27": delayedFeedback.promise,
      },
      reviewDateErrorMessages: {
        "2026-05-27":
          "Timed out after 5.0s while loading /agent-context/feedback/review from trading-core.",
      },
    });

    await page.goto("/calendar?date=2026-05-27");
    await expect(page.locator('[data-calendar-cell="2026-05-27"]')).toHaveAttribute(
      "aria-label",
      /2026-05-27 Stored/,
    );
    delayedFeedback.resolve();

    const selectedPanel = page.locator("aside").filter({ has: page.getByRole("heading", { name: "2026-05-27" }) });
    await expect(selectedPanel.locator("[data-selected-date-status]")).toHaveAttribute(
      "data-selected-date-status",
      "partial",
    );
    await expect(selectedPanel).toContainText(
      "The inline review summary is unavailable, but 5 stored feedback rows are available in the feedback table.",
    );
    await expect(selectedPanel).not.toContainText("No signal-decider decisions are stored for the selected date.");
    await expect(page.getByTestId("calendar-feedback-cta")).toHaveText("Open 5 rows in feedback table");
  } finally {
    delayedFeedback.resolve();
  }
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
