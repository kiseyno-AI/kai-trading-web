import assert from "node:assert/strict";
import test from "node:test";

import { getSignalDeciderFeedbackRecoveryCandidateDates } from "./signal-decider-feedback-recovery";
import { isSignalDeciderFeedbackResponseForMarketDate } from "./signal-decider-feedback-cache";
import type { AgentFeedbackListResponseDto, EodFreshnessResponseDto } from "@/types/trading-api";

function buildFreshness(latest: Record<string, unknown>) {
  return {
    today: {
      trade_date: "2026-08-17",
    },
    latest,
  } as unknown as EodFreshnessResponseDto;
}

test("orders distinct backend-reported recovery candidates newest first", () => {
  assert.deepEqual(
    getSignalDeciderFeedbackRecoveryCandidateDates({
      freshness: buildFreshness({
        action_market_date: "2026-08-14T16:00:00+09:00",
        price_trade_date: "2026-08-17",
      }),
      unavailableMarketDate: "2026-08-16",
    }),
    ["2026-08-17", "2026-08-14"],
  );
});

test("never treats the unavailable date or malformed values as recovery candidates", () => {
  assert.deepEqual(
    getSignalDeciderFeedbackRecoveryCandidateDates({
      freshness: buildFreshness({
        action_market_date: "2026-08-17",
        price_trade_date: "2026-99-99",
      }),
      unavailableMarketDate: "2026-08-17",
    }),
    [],
  );
});

test("requires stored feedback rows to match the exact recovery candidate date", () => {
  const feedback = {
    request: {
      market_date: "2026-07-31",
      symbols: [],
      agent_name: "signal-decider",
      limit: 200,
    },
    summary: { count: 1 },
    items: [
      {
        market_date: "2026-07-30",
        symbol: "005930",
        agent: { name: "signal-decider", run_id: "run-1" },
        feedback: {
          role: "signal-decider",
          symbol: "005930",
          market_date: "2026-07-30",
          preferred_action: "wait",
        },
      },
    ],
  } as unknown as AgentFeedbackListResponseDto;

  assert.equal(isSignalDeciderFeedbackResponseForMarketDate(feedback, "2026-07-31"), false);
  assert.equal(isSignalDeciderFeedbackResponseForMarketDate(feedback, "2026-07-30"), true);
});
