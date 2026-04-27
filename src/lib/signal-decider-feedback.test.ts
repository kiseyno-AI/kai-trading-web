import assert from "node:assert/strict";
import test from "node:test";

import type {
  AgentFeedbackListResponseDto,
  AgentFeedbackProgressResponseDto,
} from "@/types/trading-api";

import {
  buildSignalDeciderFeedbackSummary,
  normalizeSignalDeciderFeedbackItems,
  resolveSignalDeciderFeedbackStatus,
} from "./signal-decider-feedback";

function buildFeedbackResponse(
  overrides: Partial<AgentFeedbackListResponseDto> = {},
): AgentFeedbackListResponseDto {
  return {
    request: {
      market_date: "2026-04-27",
      symbols: [],
      agent_name: "signal-decider",
      limit: 100,
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

test("normalizes stored signal-decider rows into operator-facing items", () => {
  const items = normalizeSignalDeciderFeedbackItems(buildFeedbackResponse());

  assert.equal(items[0]?.symbol, "005930");
  assert.equal(items[0]?.companyName, "Samsung Electronics");
  assert.equal(items[0]?.action, "buy");
  assert.equal(items[0]?.confidenceScore, 8);
  assert.equal(items[0]?.convictionScore, 7);
  assert.equal(items[0]?.thesisSummary, "Momentum and fundamentals align.");
  assert.deepEqual(items[0]?.riskFlags, ["Gap-down open"]);
  assert.equal(items[0]?.targetPrice, 82000);
  assert.equal(items[0]?.stopLossPrice, 73500);
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
