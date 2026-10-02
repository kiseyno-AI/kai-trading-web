import assert from "node:assert/strict";
import test from "node:test";

import {
  getReviewEvidenceCount,
  getReviewedStatusCount,
  hasReviewEvidence,
  type CalendarReviewEvidenceItem,
} from "../app/calendar/signal-review-calendar-aggregation";
import { normalizeSignalDeciderFeedbackItems } from "./signal-decider-feedback";
import type { AgentFeedbackListResponseDto } from "../types/trading-api";

test("pending-only horizons do not count as reviewed decisions", () => {
  const pendingOnlyItem: CalendarReviewEvidenceItem = {
    horizonEvaluations: [{ state: "pending" }],
    outcomeHorizons: [
      {
        horizon: "1d",
        notes: "The evaluation window is still pending.",
        realizedPrice: null,
        returnPct: null,
        verdict: "Pending maturity",
      },
    ],
    pathOutcome: null,
    qualityReason: "The evaluation window is still pending.",
    qualityVerdict: null,
    reviewConclusion: "Review outcome is available by horizon.",
  };

  assert.equal(getReviewEvidenceCount([pendingOnlyItem]), 0);
  assert.equal(hasReviewEvidence(pendingOnlyItem), false);
});

test("completed replay evidence is reusable for per-row review filtering", () => {
  const reviewedItem: CalendarReviewEvidenceItem = {
    horizonEvaluations: [{ state: "computed" }],
    outcomeHorizons: [],
    pathOutcome: null,
    qualityReason: null,
    qualityVerdict: "Correct decision",
    reviewConclusion: "The replay confirmed the stored decision.",
  };

  assert.equal(hasReviewEvidence(reviewedItem), true);
  assert.equal(getReviewEvidenceCount([reviewedItem]), 1);
});

test("normalized pending-only realized results do not become reviewed evidence", () => {
  const response = {
    request: {
      market_date: "2026-05-12",
      symbols: [],
      agent_name: "signal-decider",
      limit: 100,
    },
    summary: { count: 1 },
    items: [
      {
        id: "pending-only",
        market_date: "2026-05-12",
        symbol: "020000",
        agent: { name: "signal-decider", run_id: "pending-only-run" },
        summary: {},
        feedback: {
          role: "signal-decider",
          symbol: "020000",
          market_date: "2026-05-12",
          preferred_action: "wait",
          next_day_open_action: "wait",
          evaluation: {
            realized_results: {
              "1d": {
                status: "pending_maturity",
                notes: "The evaluation window is still pending.",
              },
            },
          },
        },
        normalized_feedback: null,
        details: null,
        context: null,
        received_at: "2026-05-12T07:45:00+00:00",
      },
    ],
  } satisfies AgentFeedbackListResponseDto;

  const normalized = normalizeSignalDeciderFeedbackItems(response, {
    evaluationReferenceDate: "2026-05-12",
  });

  assert.equal(normalized[0]?.reviewConclusion, null);
  assert.equal(getReviewEvidenceCount(normalized), 0);
});

test("calendar review status counts exclude pending decisions", () => {
  assert.equal(getReviewedStatusCount({ reviewed: 1, pending: 9 }), 1);
});
