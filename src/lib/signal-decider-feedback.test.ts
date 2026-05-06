import assert from "node:assert/strict";
import test from "node:test";

import type {
  AgentFeedbackListResponseDto,
  AgentFeedbackProgressResponseDto,
  AgentFeedbackStoredItemDto,
} from "@/types/trading-api";

import {
  buildSignalDeciderFeedbackPath,
  buildSignalDeciderFeedbackSummary,
  buildCalendarSummaryQuery,
  buildSignalDeciderLatestFeedbackPath,
  buildReviewDateQuery,
  buildSignalDeciderFeedbackListFromReviewDateResponse,
  compactSignalDeciderFeedbackForDashboard,
  normalizeSignalDeciderFeedbackItems,
  resolveSignalDeciderFeedbackResultLimit,
  resolveSignalDeciderFeedbackStatus,
  resolveSignalDeciderLatestFeedbackMarketDate,
  selectSignalDeciderDashboardFeedback,
  SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
  SIGNAL_DECIDER_FEEDBACK_UPSTREAM_PATH,
  type SignalDeciderReviewDateResponse,
  type SignalDeciderAction,
} from "./signal-decider-feedback";
import {
  readLatestSignalDeciderFeedbackCache,
  readSignalDeciderFeedbackCache,
  selectSignalDeciderFeedbackResponse,
  writeSignalDeciderFeedbackCache,
} from "./signal-decider-feedback-cache";

function buildFeedbackResponse(
  overrides: Partial<AgentFeedbackListResponseDto> = {},
): AgentFeedbackListResponseDto {
  return {
    request: {
      market_date: "2026-04-27",
      symbols: [],
      agent_name: "signal-decider",
      limit: SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
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
          version: null,
          run_id: "run-1",
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
          thesis_summary: "Momentum and fundamentals align.",
          decision_risks: ["Gap-down open"],
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
            data_quality_warnings: ["Adjusted price bar in evaluation window"],
          },
          evaluation: {
            quality_verdict: "weak_buy",
            quality_reason: "Positive but underperformed the 3d hurdle.",
            target_stop_result: "target_hit_first",
            review_conclusion: "Target hit intraday first, but the multi-day hold weakened.",
            realized_results: {
              "1d": {
                return_pct: 0.8,
                verdict: "neutral",
                close_price: 82600,
              },
              "3d": {
                realized_return_pct: -1.4,
                verdict: "weak_buy",
                close_price: 80800,
              },
            },
            factors: [
              { label: "Momentum", score: 0.72, status: "positive" },
              { label: "Valuation", score: 0.35, status: "warning" },
            ],
            gate_results: {
              liquidity: { status: "pass", reason: "Turnover above floor" },
            },
          },
          upstream_evidence: [{ source: "technical_snapshot", summary: "20d breakout persisted" }],
          traceability: {
            run_id: "run-1",
            prompt_hash: "prompt-abc",
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
          run_id: "run-1",
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
          summary: "Wait for confirmation.",
          risk_flags: ["Volume confirmation missing"],
        },
        normalized_feedback: null,
        details: null,
        context: null,
        received_at: "2026-04-27T07:44:00+00:00",
      },
    ],
    ...overrides,
  };
}

function buildFeedbackResponseForMarketDate(
  marketDate: string,
  options: {
    items?: AgentFeedbackStoredItemDto[];
  } = {},
): AgentFeedbackListResponseDto {
  const base = buildFeedbackResponse();
  const items = (options.items ?? base.items).map((item) => ({
    ...item,
    market_date: marketDate,
    feedback: item.feedback
      ? {
          ...item.feedback,
          market_date: marketDate,
        }
      : item.feedback,
  }));

  return buildFeedbackResponse({
    request: {
      market_date: marketDate,
      symbols: [],
      agent_name: "signal-decider",
      limit: SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
    },
    summary: {
      count: items.length,
    },
    items,
  });
}

function buildStoredFeedbackItem({
  action,
  id,
}: {
  action: Exclude<SignalDeciderAction, "unknown">;
  id: number;
}): AgentFeedbackStoredItemDto {
  const symbol = String(id).padStart(6, "0");

  return {
    id,
    market_date: "2026-04-28",
    symbol,
    agent: {
      name: "signal-decider",
      run_id: "run-full-results",
    },
    summary: {},
    feedback: {
      role: "signal-decider",
      symbol,
      market_date: "2026-04-28",
      preferred_action: action,
      next_day_open_action: action,
      confidence_score_10: 5,
      conviction_score_10: 5,
      thesis_summary: `${action} decision ${id}`,
    },
    normalized_feedback: null,
    details: null,
    context: null,
    received_at: "2026-04-28T07:45:00+00:00",
  };
}

function buildProgress(
  overrides: Partial<AgentFeedbackProgressResponseDto> = {},
): AgentFeedbackProgressResponseDto {
  return {
    request: {
      market_date: "2026-04-27",
      symbols: null,
      expected_agents: ["eod-summarizer", "technical-summarizer", "fundamental-summarizer", "signal-decider"],
    },
    summary: {
      run_id: "run-1",
      run_status: "completed",
      run_table_status: "completed",
      is_live: false,
      run_started_at: "2026-04-27T07:00:00+00:00",
      run_completed_at: "2026-04-27T07:45:00+00:00",
      current_role: null,
      completed_roles: ["eod-summarizer", "technical-summarizer", "fundamental-summarizer", "signal-decider"],
      remaining_roles: [],
      latest_feedback_at: "2026-04-27T07:45:00+00:00",
      seconds_since_last_feedback: 20,
      stalled_threshold_seconds: 300,
      total_symbols: 2,
      processed_symbols: 2,
      completed_symbols: 2,
      in_progress_symbols: 0,
      pending_symbols: 0,
      progress_ratio: 1,
      progress_percent: 100,
      failed_items: 0,
      completed_feedback_count: 8,
      expected_feedback_count: 8,
    },
    result: {
      market_date: "2026-04-27",
      roles: {
        "signal-decider": {
          requested_count: 2,
          completed_count: 2,
          error_count: 0,
        },
      },
    },
    ...overrides,
  };
}

function buildMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

function buildSignalDeciderReviewDateResponse(
  marketDate: string,
  options: {
    items?: number;
    decisionAction?: SignalDeciderAction;
  } = {},
) {
  const itemCount = options.items ?? 2;
  return {
    request: {
      market_date: marketDate,
    },
    summary: {
      count: itemCount,
      review_status_counts: {
        reviewed: itemCount,
      },
    },
    items: Array.from({ length: itemCount }, (_, index) => ({
      snapshot_id: `snapshot-${marketDate}-${index + 1}`,
      symbol: `005930`,
      market_date: marketDate,
      run_id: `run-${marketDate}-${index + 1}`,
      captured_at: `${marketDate}T07:45:00+00:00`,
      decision: {
        role: "signal-decider",
        symbol: `005930`,
        market_date: marketDate,
        preferred_action: options.decisionAction ?? "buy",
      } as const,
    })),
  } satisfies SignalDeciderReviewDateResponse;
}

test("normalizes stored signal-decider rows into operator-facing items", () => {
  const items = normalizeSignalDeciderFeedbackItems(buildFeedbackResponse());

  assert.equal(items[0]?.symbol, "005930");
  assert.equal(items[0]?.companyName, "Samsung Electronics");
  assert.equal(items[0]?.action, "buy");
  assert.equal(items[0]?.preferredAction, "buy");
  assert.equal(items[0]?.nextDayOpenAction, "buy");
  assert.equal(items[0]?.confidenceScore, 8);
  assert.equal(items[0]?.convictionScore, 7);
  assert.equal(items[0]?.thesisSummary, "Momentum and fundamentals align.");
  assert.deepEqual(items[0]?.riskFlags, ["Gap-down open"]);
  assert.equal(items[0]?.targetPrice, 82000);
  assert.equal(items[0]?.stopLossPrice, 73500);
  assert.equal(items[0]?.policyVersion, "decider-policy-2026.04");
  assert.equal(items[0]?.qualityTag?.kind, "weak-buy");
  assert.equal(items[0]?.qualityVerdict, "Weak Buy");
  assert.equal(items[0]?.qualityReason, "Positive but underperformed the 3d hurdle.");
  assert.equal(items[0]?.fiveDayEvaluation.status, "target_hit_before_stop");
  assert.equal(items[0]?.fiveDayEvaluation.label, "Target before stop");
  assert.equal(items[0]?.fiveDayEvaluation.targetHitWithin5d, true);
  assert.equal(items[0]?.fiveDayEvaluation.stopHitWithin5d, false);
  assert.equal(items[0]?.fiveDayEvaluation.firstHitLabel, "Target first");
  assert.equal(items[0]?.fiveDayEvaluation.maxFavorableExcursionPct, 4.25);
  assert.equal(items[0]?.fiveDayEvaluation.maxAdverseExcursionPct, -1.2);
  assert.equal(items[0]?.fiveDayEvaluation.windowLabel, "2026-04-28 -> 2026-05-06");
  assert.deepEqual(items[0]?.fiveDayEvaluation.dataQualityWarnings, ["Adjusted price bar in evaluation window"]);
  assert.equal(items[0]?.pathOutcome?.kind, "target-first");
  assert.equal(items[0]?.reviewConclusion, "Target hit intraday first, but the multi-day hold weakened.");
  assert.equal(items[0]?.outcomeHorizons.length, 2);
  assert.equal(items[0]?.outcomeHorizons[1]?.horizon, "3d");
  assert.equal(items[0]?.outcomeHorizons[1]?.returnPct, -1.4);
  assert.equal(items[0]?.factorAttributions[0]?.label, "Momentum");
  assert.equal(items[0]?.gateResults[0]?.label, "Liquidity");
  assert.equal(items[0]?.upstreamEvidence[0]?.label, "Technical Snapshot");
  assert.equal(items[0]?.traceability[0]?.label, "Run Id");
});

test("preserves decision fields when review verdict and outcome are absent", () => {
  const response = buildFeedbackResponse({
    items: [
      {
        id: "decision-only",
        market_date: "2026-04-29",
        symbol: "123456",
        agent: {
          name: "signal-decider",
          run_id: "feedback-cycle-2026-04-29",
        },
        summary: {},
        feedback: {
          role: "signal-decider",
          symbol: "123456",
          market_date: "2026-04-29",
          preferred_action: "buy",
          target_price: "82,000",
          stop_loss_price: "73,500",
          thesis_summary: "Decision payload has thesis, target, and stop before review data exists.",
        },
        normalized_feedback: null,
        details: null,
        context: null,
        received_at: "2026-04-29T07:45:00+00:00",
      },
    ],
    summary: { count: 1 },
  });

  const items = normalizeSignalDeciderFeedbackItems(response);
  const item = items[0];

  assert.ok(item);
  assert.equal(item.action, "buy");
  assert.equal(item.preferredAction, "buy");
  assert.equal(item.nextDayOpenAction, "unknown");
  assert.equal(item.thesisSummary, "Decision payload has thesis, target, and stop before review data exists.");
  assert.equal(item.targetPrice, 82000);
  assert.equal(item.stopLossPrice, 73500);
  assert.equal(item.qualityVerdict, null);
  assert.equal(item.qualityTag, null);
  assert.equal(item.reviewConclusion, null);
  assert.equal(item.pathOutcome, null);
  assert.equal(item.fiveDayEvaluation.status, "not_computed_yet");
  assert.equal(item.fiveDayEvaluation.label, "Not computed yet");
  assert.deepEqual(item.outcomeHorizons, []);
});

test("uses raw persisted five-day evaluation when normalized feedback omits it", () => {
  const response = buildFeedbackResponse({
    items: [
      {
        id: "normalized-with-raw-evaluation",
        market_date: "2026-04-29",
        symbol: "123456",
        agent: {
          name: "signal-decider",
          run_id: "feedback-cycle-2026-04-29",
        },
        summary: {},
        feedback: {
          role: "signal-decider",
          symbol: "123456",
          market_date: "2026-04-29",
          preferred_action: "buy",
          five_day_evaluation: {
            evaluation_status: "target_hit_before_stop",
            target_hit_within_5d: true,
            stop_hit_within_5d: false,
            first_hit: "target",
            max_favorable_excursion_pct: 6.4,
            max_adverse_excursion_pct: -0.8,
            evaluation_window_start: "2026-04-30",
            evaluation_window_end: "2026-05-08",
          },
        },
        normalized_feedback: {
          role: "signal-decider",
          symbol: "123456",
          market_date: "2026-04-29",
          preferred_action: "wait",
          thesis_summary: "Normalized feedback remains the primary decision payload.",
        },
        details: null,
        context: null,
        received_at: "2026-04-29T07:45:00+00:00",
      },
    ],
    summary: { count: 1 },
  });

  const item = normalizeSignalDeciderFeedbackItems(response)[0];

  assert.ok(item);
  assert.equal(item.action, "wait");
  assert.equal(item.thesisSummary, "Normalized feedback remains the primary decision payload.");
  assert.equal(item.fiveDayEvaluation.status, "target_hit_before_stop");
  assert.equal(item.fiveDayEvaluation.label, "Target before stop");
  assert.equal(item.fiveDayEvaluation.targetHitWithin5d, true);
  assert.equal(item.fiveDayEvaluation.stopHitWithin5d, false);
  assert.equal(item.fiveDayEvaluation.firstHitLabel, "Target first");
  assert.equal(item.fiveDayEvaluation.maxFavorableExcursionPct, 6.4);
  assert.equal(item.fiveDayEvaluation.maxAdverseExcursionPct, -0.8);
  assert.equal(item.fiveDayEvaluation.windowLabel, "2026-04-30 -> 2026-05-08");
});

test("normalizes persisted ambiguous 5-day target-stop evaluation warnings", () => {
  const response = buildFeedbackResponse({
    items: [
      {
        id: "ambiguous-evaluation",
        market_date: "2026-04-29",
        symbol: "123456",
        agent: {
          name: "signal-decider",
          run_id: "feedback-cycle-2026-04-29",
        },
        summary: {},
        feedback: {
          role: "signal-decider",
          symbol: "123456",
          market_date: "2026-04-29",
          preferred_action: "buy",
          target_price: null,
          stop_loss_price: null,
          five_day_evaluation: {
            outcome: "target_and_stop_same_day_ambiguous",
            target_hit_within_5d: true,
            stop_hit_within_5d: true,
            ambiguous_same_day: true,
            mfe_pct: "7.5",
            mae_pct: "-3.25",
            evaluation_window: {
              start: "2026-04-30",
              end: "2026-05-08",
            },
          },
        },
        normalized_feedback: null,
        details: null,
        context: null,
        received_at: "2026-04-29T07:45:00+00:00",
      },
    ],
    summary: { count: 1 },
  });

  const item = normalizeSignalDeciderFeedbackItems(response)[0];

  assert.ok(item);
  assert.equal(item.targetPrice, null);
  assert.equal(item.stopLossPrice, null);
  assert.equal(item.fiveDayEvaluation.status, "target_and_stop_same_day_ambiguous");
  assert.equal(item.fiveDayEvaluation.tone, "warning");
  assert.equal(item.fiveDayEvaluation.targetHitWithin5d, true);
  assert.equal(item.fiveDayEvaluation.stopHitWithin5d, true);
  assert.equal(item.fiveDayEvaluation.firstHitLabel, "Same-day ambiguous");
  assert.equal(item.fiveDayEvaluation.maxFavorableExcursionPct, 7.5);
  assert.equal(item.fiveDayEvaluation.maxAdverseExcursionPct, -3.25);
  assert.equal(item.fiveDayEvaluation.windowLabel, "2026-04-30 -> 2026-05-08");
  assert.deepEqual(item.fiveDayEvaluation.dataQualityWarnings, [
    "Target and stop were inside the same daily candle; intraday sequence cannot be proven.",
  ]);
});

test("supports short-term-decider 5-day outcome statuses embedded in stored rows", () => {
  const response = buildFeedbackResponse({
    request: {
      market_date: "2026-04-29",
      symbols: [],
      agent_name: "short-term-decider",
      limit: SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
    },
    items: [
      {
        id: "short-term-evaluation",
        market_date: "2026-04-29",
        symbol: "654321",
        agent: {
          name: "short-term-decider",
          run_id: "short-term-run",
        },
        summary: {},
        feedback: {
          role: "short-term-decider",
          symbol: "654321",
          market_date: "2026-04-29",
          preferred_action: "wait",
          short_term_decider_evaluation: {
            status: "avoid_chase_missed_upside",
            target_hit_within_5d: true,
            stop_hit_within_5d: false,
            first_hit: "target",
            max_favorable_excursion_pct: 5.4,
            max_adverse_excursion_pct: -0.7,
            window_start: "2026-04-30",
            window_end: "2026-05-08",
          },
        },
        normalized_feedback: null,
        details: null,
        context: null,
        received_at: "2026-04-29T07:45:00+00:00",
      },
    ],
    summary: { count: 1 },
  });

  const item = normalizeSignalDeciderFeedbackItems(response)[0];

  assert.ok(item);
  assert.equal(item.fiveDayEvaluation.status, "avoid_chase_missed_upside");
  assert.equal(item.fiveDayEvaluation.label, "Avoid-chase missed upside");
  assert.equal(item.fiveDayEvaluation.tone, "negative");
  assert.equal(item.fiveDayEvaluation.targetHitWithin5d, true);
  assert.equal(item.fiveDayEvaluation.stopHitWithin5d, false);
});

test("preserves nested outcome horizons when a horizon map also includes direct metadata", () => {
  const response = buildFeedbackResponse();
  const firstItem = response.items[0];
  assert.ok(firstItem);
  assert.ok(firstItem.feedback);

  firstItem.feedback = {
    ...firstItem.feedback,
    evaluation: {
      quality_verdict: "weak_buy",
      quality_reason: "Metadata lives beside horizon records.",
      realized_results: {
        summary: "Do not collapse nested horizon records.",
        "1d": {
          return_pct: 0.8,
          verdict: "neutral",
          close_price: 82600,
        },
        "3d": {
          realized_return_pct: -1.4,
          verdict: "weak_buy",
          close_price: 80800,
        },
      },
    },
  };

  const items = normalizeSignalDeciderFeedbackItems(response);
  const samsung = items.find((item) => item.symbol === "005930");

  assert.deepEqual(
    samsung?.outcomeHorizons.map((outcome) => ({
      horizon: outcome.horizon,
      returnPct: outcome.returnPct,
      verdict: outcome.verdict,
    })),
    [
      { horizon: "1d", returnPct: 0.8, verdict: "Neutral" },
      { horizon: "3d", returnPct: -1.4, verdict: "Weak Buy" },
    ],
  );
});

test("marks decider feedback complete when stored rows satisfy progress role counts", () => {
  assert.equal(
    resolveSignalDeciderFeedbackStatus({
      feedback: buildFeedbackResponse(),
      progress: buildProgress(),
    }),
    "completed",
  );
});

test("marks decider feedback partial when some requested rows are still missing", () => {
  assert.equal(
    resolveSignalDeciderFeedbackStatus({
      feedback: buildFeedbackResponse({
        summary: { count: 2 },
      }),
      progress: buildProgress({
        summary: {
          ...buildProgress().summary,
          run_status: "partial",
          run_table_status: "partial",
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
    }),
    "partial",
  );
});

test("marks decider feedback as needs review when progress exposes signal-decider errors", () => {
  assert.equal(
    resolveSignalDeciderFeedbackStatus({
      feedback: buildFeedbackResponse(),
      progress: buildProgress({
        result: {
          market_date: "2026-04-27",
          roles: {
            "signal-decider": {
              requested_count: 3,
              completed_count: 2,
              error_count: 1,
            },
          },
        },
      }),
    }),
    "needs-review",
  );
});

test("builds signal-decider feedback paths with the full result window by default", () => {
  const path = buildSignalDeciderFeedbackPath({
    basePath: SIGNAL_DECIDER_FEEDBACK_UPSTREAM_PATH,
    marketDate: "2026-04-28",
  });
  const url = new URL(`https://example.test${path}`);

  assert.equal(url.searchParams.get("agent_name"), "signal-decider");
  assert.equal(url.searchParams.get("limit"), String(SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT));
});

test("builds latest signal-decider feedback paths with a resolved market date", () => {
  const path = buildSignalDeciderLatestFeedbackPath({
    basePath: SIGNAL_DECIDER_FEEDBACK_UPSTREAM_PATH,
    limit: 50,
    marketDate: "2026-04-29T15:30:00+09:00",
  });
  assert.ok(path, "expected a latest feedback request path");
  const url = new URL(`https://example.test${path}`);

  assert.equal(url.pathname, SIGNAL_DECIDER_FEEDBACK_UPSTREAM_PATH);
  assert.equal(url.searchParams.get("market_date"), "2026-04-29");
  assert.equal(url.searchParams.get("agent_name"), "signal-decider");
  assert.equal(url.searchParams.get("limit"), "50");
});

test("builds compact calendar summary query strings", () => {
  const query = buildCalendarSummaryQuery({
    month: "2026-04",
    horizons: ["1d", "3d", " 5d "],
    primaryHorizonDays: 3,
    evaluationVersion: "v2",
  });
  const params = new URLSearchParams(query);

  assert.equal(params.get("month"), "2026-04");
  assert.deepStrictEqual(params.getAll("horizons"), ["1d", "3d", "5d"]);
  assert.equal(params.get("primary_horizon_days"), "3");
  assert.equal(params.get("evaluation_version"), "v2");
});

test("builds dedicated review-date query strings", () => {
  const query = buildReviewDateQuery({
    marketDate: "2026-04-27T15:00:00+09:00",
    horizons: ["1d", "3d"],
    primaryHorizonDays: 7,
    evaluationVersion: "v2",
  });
  const params = new URLSearchParams(query);

  assert.equal(params.get("market_date"), "2026-04-27");
  assert.deepStrictEqual(params.getAll("horizons"), ["1d", "3d"]);
  assert.equal(params.get("primary_horizon_days"), "7");
  assert.equal(params.get("evaluation_version"), "v2");
});

test("builds signal-decider feedback list payloads from dedicated review-date responses", () => {
  const reviewDateResponse = buildSignalDeciderReviewDateResponse("2026-04-27", { items: 2, decisionAction: "wait" });
  const feedbackResponse = buildSignalDeciderFeedbackListFromReviewDateResponse({
    response: reviewDateResponse,
    fallbackMarketDate: "2026-04-26",
  });

  assert.equal(feedbackResponse.request.market_date, "2026-04-27");
  assert.equal(feedbackResponse.summary.count, 2);
  assert.equal(feedbackResponse.items.length, 2);
  assert.equal(feedbackResponse.items[0]?.feedback?.preferred_action, "wait");
  assert.equal(feedbackResponse.items[0]?.market_date, "2026-04-27");
  assert.equal(feedbackResponse.items[0]?.agent.run_id, "run-2026-04-27-1");
});

test("keeps review-date summary counts when response supplies a larger requested count", () => {
  const reviewDateResponse = {
    ...buildSignalDeciderReviewDateResponse("2026-04-27", { items: 1 }),
    summary: {
      count: 9,
      review_status_counts: {
        reviewed: 1,
      },
    },
  } satisfies SignalDeciderReviewDateResponse;

  const feedbackResponse = buildSignalDeciderFeedbackListFromReviewDateResponse({
    response: reviewDateResponse,
  });

  assert.equal(feedbackResponse.summary.count, 9);
  assert.equal(feedbackResponse.items.length, 1);
});

test("does not build a latest signal-decider feedback path without a resolved market date", () => {
  const path = buildSignalDeciderLatestFeedbackPath({
    basePath: SIGNAL_DECIDER_FEEDBACK_UPSTREAM_PATH,
    limit: 50,
    marketDate: null,
  });

  assert.equal(path, null);
});

test("resolves latest dashboard feedback date from already-known process dates", () => {
  assert.equal(
    resolveSignalDeciderLatestFeedbackMarketDate({
      currentMarketDate: "2026-04-30",
      latestCompletedMarketDate: "2026-04-29",
      progressMarketDate: "2026-04-30",
      resolvedProcessMarketDate: "2026-04-30",
    }),
    "2026-04-29",
  );
  assert.equal(
    resolveSignalDeciderLatestFeedbackMarketDate({
      currentMarketDate: "2026-04-30",
      latestCompletedMarketDate: null,
      progressMarketDate: "2026-04-30",
      resolvedProcessMarketDate: "2026-04-29",
    }),
    "2026-04-29",
  );
  assert.equal(
    resolveSignalDeciderLatestFeedbackMarketDate({
      currentMarketDate: "2026-04-30",
      latestCompletedMarketDate: null,
      progressMarketDate: "2026-04-29",
      resolvedProcessMarketDate: "2026-04-30",
    }),
    "2026-04-29",
  );
  assert.equal(
    resolveSignalDeciderLatestFeedbackMarketDate({
      currentMarketDate: "2026-04-30",
      latestCompletedMarketDate: null,
      progressMarketDate: null,
      resolvedProcessMarketDate: null,
    }),
    "2026-04-30",
  );
  assert.equal(
    resolveSignalDeciderLatestFeedbackMarketDate({
      currentMarketDate: null,
      latestCompletedMarketDate: null,
      progressMarketDate: null,
      resolvedProcessMarketDate: null,
    }),
    null,
  );
});

test("sizes signal-decider feedback fetches from progress counts when available", () => {
  assert.equal(
    resolveSignalDeciderFeedbackResultLimit(
      buildProgress({
        result: {
          market_date: "2026-04-28",
          roles: {
            "signal-decider": {
              requested_count: 109,
              completed_count: 105,
              error_count: 4,
            },
          },
        },
      }),
    ),
    109,
  );

  assert.equal(
    resolveSignalDeciderFeedbackResultLimit(
      buildProgress({
        result: {
          market_date: "2026-04-28",
          roles: {
            "signal-decider": {
              requested_count: 250,
              completed_count: 250,
              error_count: 0,
            },
          },
        },
      }),
    ),
    SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
  );
});

test("builds a compact summary with preview, action counts, and detail href", () => {
  const model = buildSignalDeciderFeedbackSummary({
    feedback: buildFeedbackResponse(),
    marketDate: "2026-04-27",
    previewLimit: 1,
    progress: buildProgress(),
  });

  assert.equal(model.resultCount, 2);
  assert.equal(model.previewItems.length, 1);
  assert.equal(model.actionCounts.buy, 1);
  assert.equal(model.actionCounts.wait, 1);
  assert.equal(model.detailHref, "/dashboard/signal-decider-feedback?marketDate=2026-04-27");
});

test("keeps signal-decider feedback status transparent when progress is running but no rows are stored yet", () => {
  const model = buildSignalDeciderFeedbackSummary({
    feedback: buildFeedbackResponse({
      summary: {
        count: 0,
      },
      items: [],
    }),
    marketDate: "2026-04-30",
    progress: buildProgress({
      summary: {
        ...buildProgress().summary,
        run_status: "running",
        run_table_status: "running",
        is_live: true,
        current_role: "signal-decider",
        remaining_roles: ["signal-decider"],
        progress_percent: 10,
      },
      result: {
        market_date: "2026-04-30",
        roles: {
          "signal-decider": {
            requested_count: 4,
            completed_count: 0,
            error_count: 0,
          },
        },
      },
    }),
    previewLimit: 5,
  });

  assert.equal(model.resultCount, 0);
  assert.equal(model.status, "running");
  assert.deepEqual(model.actionCounts, { buy: 0, wait: 0, reject: 0, unknown: 0 });
});

test("keeps signal-decider headline action counts independent from preview truncation", () => {
  const items = Array.from({ length: 105 }, (_, index) =>
    buildStoredFeedbackItem({
      action: index === 104 ? "reject" : "wait",
      id: index + 1,
    }),
  );
  const model = buildSignalDeciderFeedbackSummary({
    feedback: buildFeedbackResponse({
      request: {
        market_date: "2026-04-28",
        symbols: [],
        agent_name: "signal-decider",
        limit: 109,
      },
      summary: { count: items.length },
      items,
    }),
    marketDate: "2026-04-28",
    previewLimit: 3,
    progress: buildProgress({
      request: {
        market_date: "2026-04-28",
        symbols: null,
        expected_agents: ["signal-decider"],
      },
      result: {
        market_date: "2026-04-28",
        roles: {
          "signal-decider": {
            requested_count: 109,
            completed_count: 105,
            error_count: 4,
          },
        },
      },
    }),
  });

  assert.equal(model.resultCount, 105);
  assert.equal(model.previewItems.length, 3);
  assert.equal(model.actionCounts.buy, 0);
  assert.equal(model.actionCounts.wait, 104);
  assert.equal(model.actionCounts.reject, 1);
  assert.equal(model.completedCount, 105);
  assert.equal(model.requestedCount, 109);
  assert.equal(model.errorCount, 4);
});

test("compacts dashboard signal-decider feedback rows to a preview-safe shape", () => {
  const compactPayload = compactSignalDeciderFeedbackForDashboard(
    buildFeedbackResponse({
      summary: {
        count: 2,
        requested_count: 2,
        completed_count: 2,
        error_count: 0,
      },
    }),
  );

  assert.ok(compactPayload);
  assert.equal(compactPayload.summary.count, 2);
  assert.equal(compactPayload.request.limit, SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT);
  assert.deepEqual(compactPayload.request.symbols, ["005930", "000660"]);
  assert.equal(compactPayload.request.market_date, "2026-04-27");

  const firstCompactItem = compactPayload.items[0];
  const compactJson = JSON.stringify(compactPayload);

  assert.ok(firstCompactItem);
  assert.equal(String(firstCompactItem.id), "1");
  assert.equal(firstCompactItem.summary.quality_tag?.kind, "weak-buy");
  assert.equal(firstCompactItem.feedback?.preferred_action, "buy");
  assert.equal(firstCompactItem.feedback?.risk_flags?.join(","), "Gap-down open");
  assert.equal(firstCompactItem.details, null);
  assert.equal(firstCompactItem.context?.symbol_day_context?.company?.name, "Samsung Electronics");
  assert.equal(compactJson.includes('"traceability"'), false);
  assert.equal(compactJson.includes('"decision_risks"'), false);
  assert.equal(compactJson.includes('"upstream_evidence"'), false);
  assert.equal(compactJson.includes('"normalized_feedback"'), true);
});

test("selects latest completed dashboard recommendations while the current signal-decider cycle is running", () => {
  const currentMarketDate = "2026-04-30";
  const latestCompletedFeedback = buildFeedbackResponseForMarketDate("2026-04-29");
  const currentFeedback = buildFeedbackResponseForMarketDate(currentMarketDate, { items: [] });
  const runningProgress = buildProgress({
    request: {
      market_date: currentMarketDate,
      symbols: null,
      expected_agents: ["signal-decider"],
    },
    summary: {
      ...buildProgress().summary,
      run_status: "running",
      run_table_status: "running",
      is_live: true,
      run_completed_at: null,
      current_role: "signal-decider",
      completed_roles: [],
      remaining_roles: ["signal-decider"],
      progress_percent: 20,
    },
    result: {
      market_date: currentMarketDate,
      roles: {
        "signal-decider": {
          requested_count: 2,
          completed_count: 0,
          error_count: 0,
        },
      },
    },
  });

  const selection = selectSignalDeciderDashboardFeedback({
    currentFeedback,
    currentMarketDate,
    latestCompletedFeedback,
    progress: runningProgress,
  });
  const model = buildSignalDeciderFeedbackSummary({
    currentMarketDate: selection.currentMarketDate,
    feedback: selection.feedback,
    isLatestCompletedFallback: selection.isLatestCompletedFallback,
    marketDate: selection.feedback?.request.market_date ?? currentMarketDate,
    progress: runningProgress,
  });

  assert.equal(selection.isLatestCompletedFallback, true);
  assert.equal(model.status, "running");
  assert.equal(model.marketDate, "2026-04-29");
  assert.equal(model.currentMarketDate, currentMarketDate);
  assert.equal(model.resultCount, 2);
  assert.equal(model.requestedCount, null);
  assert.equal(model.detailHref, "/dashboard/signal-decider-feedback?marketDate=2026-04-29");
});

test("uses loaded previous-date signal-decider rows as the dashboard fallback on no-new-EOD days", () => {
  const currentMarketDate = "2026-05-05";
  const previousCompletedFeedback = buildFeedbackResponseForMarketDate("2026-05-04");
  const completedProgress = buildProgress({
    request: {
      market_date: "2026-05-04",
      symbols: null,
      expected_agents: ["signal-decider"],
    },
    result: {
      market_date: "2026-05-04",
      roles: {
        "signal-decider": {
          requested_count: 2,
          completed_count: 2,
          error_count: 0,
        },
      },
    },
  });

  const selection = selectSignalDeciderDashboardFeedback({
    currentFeedback: previousCompletedFeedback,
    currentMarketDate,
    latestCompletedFeedback: null,
    progress: completedProgress,
  });
  const model = buildSignalDeciderFeedbackSummary({
    currentMarketDate: selection.currentMarketDate,
    feedback: selection.feedback,
    isLatestCompletedFallback: selection.isLatestCompletedFallback,
    marketDate: selection.feedback?.request.market_date ?? currentMarketDate,
    progress: completedProgress,
  });

  assert.equal(selection.isLatestCompletedFallback, true);
  assert.equal(model.marketDate, "2026-05-04");
  assert.equal(model.currentMarketDate, currentMarketDate);
  assert.equal(model.resultCount, 2);
  assert.equal(model.actionCounts.buy, 1);
  assert.equal(model.actionCounts.wait, 1);
  assert.equal(model.previewItems.length, 2);
  assert.equal(model.requestedCount, null);
});

test("keeps dashboard fallback rows scoped to the effective completed recommendation date", () => {
  const currentMarketDate = "2026-04-30";
  const currentFeedback = buildFeedbackResponseForMarketDate(currentMarketDate, { items: [] });
  const currentPartialItem = buildFeedbackResponseForMarketDate(currentMarketDate).items[0];
  const previousCompletedFeedback = buildFeedbackResponseForMarketDate("2026-04-29");
  const mixedLatestFeedback = buildFeedbackResponse({
    request: {
      market_date: currentMarketDate,
      symbols: [],
      agent_name: "signal-decider",
      limit: SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
    },
    summary: {
      count: 3,
    },
    items: [currentPartialItem, ...previousCompletedFeedback.items],
  });
  const runningProgress = buildProgress({
    request: {
      market_date: currentMarketDate,
      symbols: null,
      expected_agents: ["signal-decider"],
    },
    summary: {
      ...buildProgress().summary,
      run_status: "running",
      run_table_status: "running",
      is_live: true,
      run_completed_at: null,
      current_role: "signal-decider",
      completed_roles: [],
      remaining_roles: ["signal-decider"],
    },
    result: {
      market_date: currentMarketDate,
      roles: {
        "signal-decider": {
          requested_count: 3,
          completed_count: 0,
          error_count: 0,
        },
      },
    },
  });

  const selection = selectSignalDeciderDashboardFeedback({
    currentFeedback,
    currentMarketDate,
    latestCompletedFeedback: mixedLatestFeedback,
    progress: runningProgress,
  });
  const model = buildSignalDeciderFeedbackSummary({
    currentMarketDate: selection.currentMarketDate,
    feedback: selection.feedback,
    isLatestCompletedFallback: selection.isLatestCompletedFallback,
    marketDate: selection.feedback?.request.market_date ?? currentMarketDate,
    progress: runningProgress,
  });

  assert.equal(selection.isLatestCompletedFallback, true);
  assert.equal(selection.feedback?.request.market_date, "2026-04-29");
  assert.equal(selection.feedback?.items.every((item) => item.market_date === "2026-04-29"), true);
  assert.equal(model.marketDate, "2026-04-29");
  assert.equal(model.resultCount, 2);
});

test("promotes dashboard recommendations to the current date once current signal-decider rows complete", () => {
  const currentMarketDate = "2026-04-30";
  const currentFeedback = buildFeedbackResponseForMarketDate(currentMarketDate);
  const latestCompletedFeedback = buildFeedbackResponseForMarketDate("2026-04-29");
  const completedProgress = buildProgress({
    request: {
      market_date: currentMarketDate,
      symbols: null,
      expected_agents: ["signal-decider"],
    },
    result: {
      market_date: currentMarketDate,
      roles: {
        "signal-decider": {
          requested_count: 2,
          completed_count: 2,
          error_count: 0,
        },
      },
    },
  });

  const selection = selectSignalDeciderDashboardFeedback({
    currentFeedback,
    currentMarketDate,
    latestCompletedFeedback,
    progress: completedProgress,
  });
  const model = buildSignalDeciderFeedbackSummary({
    currentMarketDate: selection.currentMarketDate,
    feedback: selection.feedback,
    isLatestCompletedFallback: selection.isLatestCompletedFallback,
    marketDate: selection.feedback?.request.market_date ?? currentMarketDate,
    progress: completedProgress,
  });

  assert.equal(selection.isLatestCompletedFallback, false);
  assert.equal(model.status, "completed");
  assert.equal(model.marketDate, currentMarketDate);
  assert.equal(model.currentMarketDate, currentMarketDate);
  assert.equal(model.resultCount, 2);
  assert.equal(model.requestedCount, 2);
});

test("keeps the current dashboard cycle empty when no completed signal-decider fallback exists", () => {
  const currentMarketDate = "2026-04-30";
  const currentFeedback = buildFeedbackResponseForMarketDate(currentMarketDate, { items: [] });
  const latestCompletedFeedback = buildFeedbackResponseForMarketDate("2026-04-29", { items: [] });
  const runningProgress = buildProgress({
    request: {
      market_date: currentMarketDate,
      symbols: null,
      expected_agents: ["signal-decider"],
    },
    summary: {
      ...buildProgress().summary,
      run_status: "running",
      run_table_status: "running",
      is_live: true,
      run_completed_at: null,
      current_role: "signal-decider",
      remaining_roles: ["signal-decider"],
      progress_percent: 10,
    },
    result: {
      market_date: currentMarketDate,
      roles: {
        "signal-decider": {
          requested_count: 2,
          completed_count: 0,
          error_count: 0,
        },
      },
    },
  });

  const selection = selectSignalDeciderDashboardFeedback({
    currentFeedback,
    currentMarketDate,
    latestCompletedFeedback,
    progress: runningProgress,
  });
  const model = buildSignalDeciderFeedbackSummary({
    currentMarketDate: selection.currentMarketDate,
    feedback: selection.feedback,
    isLatestCompletedFallback: selection.isLatestCompletedFallback,
    marketDate: selection.feedback?.request.market_date ?? currentMarketDate,
    progress: runningProgress,
  });

  assert.equal(selection.isLatestCompletedFallback, false);
  assert.equal(model.status, "running");
  assert.equal(model.marketDate, currentMarketDate);
  assert.equal(model.currentMarketDate, currentMarketDate);
  assert.equal(model.resultCount, 0);
});

test("caches same-date dashboard feedback for clicked-through review surfaces", () => {
  const storage = buildMemoryStorage();
  const feedback = buildFeedbackResponse();
  const progress = buildProgress();

  assert.equal(
    writeSignalDeciderFeedbackCache({
      feedback,
      marketDate: "2026-04-27",
      now: 1000,
      progress,
      source: "dashboard",
      storage,
    }),
    true,
  );

  const cached = readSignalDeciderFeedbackCache("2026-04-27", { now: 2000, storage });
  assert.equal(cached?.source, "dashboard");
  assert.equal(cached?.feedback.summary.count, 2);
  assert.equal(cached?.progress?.summary.run_id, "run-1");
  assert.equal(readLatestSignalDeciderFeedbackCache({ now: 2000, storage })?.marketDate, "2026-04-27");
});

test("does not replace cached stored rows with a contradictory empty direct read", () => {
  const cachedFeedback = buildFeedbackResponse();
  const emptyFeedback = buildFeedbackResponse({
    summary: {
      count: 0,
    },
    items: [],
  });

  const selected = selectSignalDeciderFeedbackResponse({
    cached: {
      version: 1,
      cachedAt: 1000,
      source: "dashboard",
      marketDate: "2026-04-27",
      feedback: cachedFeedback,
      progress: buildProgress(),
    },
    fetched: emptyFeedback,
  });

  assert.equal(selected, cachedFeedback);
});

test("expires cached signal-decider feedback instead of serving stale rows", () => {
  const storage = buildMemoryStorage();

  writeSignalDeciderFeedbackCache({
    feedback: buildFeedbackResponse(),
    marketDate: "2026-04-27",
    now: 1000,
    progress: buildProgress(),
    source: "dashboard",
    storage,
  });

  assert.equal(readSignalDeciderFeedbackCache("2026-04-27", { now: 31 * 60 * 1000, storage }), null);
});
