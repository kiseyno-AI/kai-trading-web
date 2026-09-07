import assert from "node:assert/strict";
import test from "node:test";

import type { AgentFeedbackProgressResponseDto } from "@/types/trading-api";

import { isAgentFeedbackProgressResponseForMarketDate } from "./agent-feedback-progress";

function buildProgress({
  requestMarketDate = "2026-04-27",
  resultMarketDate = "2026-04-27",
}: {
  requestMarketDate?: string;
  resultMarketDate?: string | null;
} = {}): AgentFeedbackProgressResponseDto {
  return {
    request: {
      market_date: requestMarketDate,
      symbols: null,
      expected_agents: ["signal-decider"],
    },
    summary: {
      run_id: "run-1",
      run_status: "completed",
      run_table_status: "completed",
      is_live: false,
      run_started_at: "2026-04-27T07:00:00+00:00",
      run_completed_at: "2026-04-27T07:45:00+00:00",
      latest_feedback_at: "2026-04-27T07:45:00+00:00",
      seconds_since_last_feedback: 20,
      stalled_threshold_seconds: 300,
      total_symbols: 1,
      processed_symbols: 1,
      completed_symbols: 1,
      in_progress_symbols: 0,
      pending_symbols: 0,
      progress_ratio: 1,
      progress_percent: 100,
      failed_items: 0,
      completed_feedback_count: 1,
      expected_feedback_count: 1,
    },
    result: {
      market_date: resultMarketDate,
      roles: null,
    },
  };
}

test("accepts progress only when its request and available result dates match the expected market date", () => {
  assert.equal(
    isAgentFeedbackProgressResponseForMarketDate(
      buildProgress({
        requestMarketDate: "2026-04-27T00:00:00+09:00",
        resultMarketDate: "2026-04-27",
      }),
      "2026-04-27",
    ),
    true,
  );
  assert.equal(
    isAgentFeedbackProgressResponseForMarketDate(buildProgress({ resultMarketDate: null }), "2026-04-27"),
    true,
  );
});

test("rejects progress when either reported market date contradicts the expected date", () => {
  assert.equal(
    isAgentFeedbackProgressResponseForMarketDate(
      buildProgress({ requestMarketDate: "2026-04-26", resultMarketDate: "2026-04-27" }),
      "2026-04-27",
    ),
    false,
  );
  assert.equal(
    isAgentFeedbackProgressResponseForMarketDate(
      buildProgress({ requestMarketDate: "2026-04-27", resultMarketDate: "2026-04-26" }),
      "2026-04-27",
    ),
    false,
  );
  assert.equal(
    isAgentFeedbackProgressResponseForMarketDate(
      buildProgress({ requestMarketDate: "2026-04-27", resultMarketDate: "not-a-date" }),
      "2026-04-27",
    ),
    false,
  );
  assert.equal(isAgentFeedbackProgressResponseForMarketDate(null, "2026-04-27"), false);
});
