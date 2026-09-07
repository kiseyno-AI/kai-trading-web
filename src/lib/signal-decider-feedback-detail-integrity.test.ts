import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { AgentFeedbackListResponseDto } from "@/types/trading-api";

import {
  selectSignalDeciderFeedbackResponseForMarketDate,
  type SignalDeciderFeedbackCacheEntry,
} from "./signal-decider-feedback-cache";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function buildFeedback(marketDate: string): AgentFeedbackListResponseDto {
  return {
    request: {
      market_date: marketDate,
      symbols: [],
      agent_name: "signal-decider",
      limit: 200,
    },
    summary: { count: 1 },
    items: [
      {
        id: `feedback-${marketDate}`,
        market_date: marketDate,
        symbol: "005930",
        agent: { name: "signal-decider", run_id: `run-${marketDate}` },
        summary: {},
        feedback: {
          role: "signal-decider",
          symbol: "005930",
          market_date: marketDate,
          preferred_action: "wait",
        },
        normalized_feedback: null,
        details: null,
        context: null,
        received_at: null,
      },
    ],
  };
}

function buildCacheEntry(marketDate: string): SignalDeciderFeedbackCacheEntry {
  return {
    version: 1,
    cachedAt: 1_000,
    source: "detail",
    marketDate,
    feedback: buildFeedback(marketDate),
    progress: null,
  };
}

test("falls back only to an exact-date cached response when the direct detail response contains stale rows", () => {
  const cached = buildCacheEntry("2026-04-27");
  const staleFetched = {
    ...buildFeedback("2026-04-26"),
    request: {
      ...buildFeedback("2026-04-26").request,
      market_date: "2026-04-27",
    },
  };

  assert.equal(
    selectSignalDeciderFeedbackResponseForMarketDate({
      cached,
      fetched: staleFetched,
      marketDate: "2026-04-27",
    }),
    cached.feedback,
  );
  assert.equal(
    selectSignalDeciderFeedbackResponseForMarketDate({
      cached: null,
      fetched: staleFetched,
      marketDate: "2026-04-27",
    }),
    null,
  );
});

test("detail feedback loaders guard every visible response by its exact requested market date", () => {
  const source = readFileSync(
    join(repoRoot, "src/app/dashboard/signal-decider-feedback/signal-decider-feedback-page-client.tsx"),
    "utf8",
  );

  assert.match(source, /selectSignalDeciderFeedbackResponseForMarketDate\(\{[\s\S]*?fetched: feedbackData,[\s\S]*?marketDate,/);
  assert.match(source, /isSignalDeciderFeedbackResponseForMarketDate\(loadedComparisonData, marketDate\)/);
  assert.match(source, /isSignalDeciderFeedbackResponseForMarketDate\(loadedPreviousFeedbackData, previousMarketDate\)/);
  assert.match(source, /isAgentFeedbackProgressResponseForMarketDate\(progressData, marketDate\)/);
  assert.match(source, /isAgentFeedbackProgressResponseForMarketDate\(cachedSnapshot\.progress, marketDate\)/);
});
