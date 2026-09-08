import assert from "node:assert/strict";
import test from "node:test";

import {
  appendDashboardRecommendationContext,
  appendDashboardRecommendationContextToHref,
  getDashboardDecisionConflict,
  readDashboardRecommendationContext,
  type DashboardRecommendationContext,
} from "@/lib/dashboard-recommendation-context";

const conflictContext = {
  executionAction: "planned-buy-today",
  executionSource: "execution-board",
  marketDate: "2026-09-08",
  referencePrice: 133000,
  referencePriceKind: "close",
  signalDeciderEvidence: {
    action: "wait",
    marketDate: "2026-09-08",
    stopLossPrice: 123000,
    targetPrice: 135900,
  },
  source: "execution-runtime",
  stopLossPrice: 131000,
  symbol: "000720",
  targetPrice: 145000,
} satisfies DashboardRecommendationContext;

test("round-trips an execution-runtime plan and same-date signal evidence through route params", () => {
  const params = new URLSearchParams();

  appendDashboardRecommendationContext(params, conflictContext);

  assert.deepEqual(readDashboardRecommendationContext(params), conflictContext);
});

test("preserves an execution conflict context when linking to signal-decider evidence", () => {
  const href = appendDashboardRecommendationContextToHref(
    "/dashboard/signal-decider-feedback?marketDate=2026-09-08&q=000720&symbols=000720",
    conflictContext,
  );
  const [pathname, query] = href.split("?");

  assert.equal(pathname, "/dashboard/signal-decider-feedback");
  assert.equal(new URLSearchParams(query).get("marketDate"), "2026-09-08");
  assert.equal(new URLSearchParams(query).get("q"), "000720");
  assert.deepEqual(readDashboardRecommendationContext(new URLSearchParams(query)), conflictContext);
});

test("classifies same-date buy-vs-wait and risk-price disagreement as a source conflict", () => {
  assert.deepEqual(getDashboardDecisionConflict(conflictContext), {
    actionConflict: true,
    riskPlanConflict: true,
  });
});

test("does not compare a same-date buy plan with evidence for another date", () => {
  assert.equal(
    getDashboardDecisionConflict({
      ...conflictContext,
      signalDeciderEvidence: {
        ...conflictContext.signalDeciderEvidence,
        marketDate: "2026-09-07",
      },
    }),
    null,
  );
});

test("flags a same-date risk-plan disagreement even when execution direction is only monitoring", () => {
  assert.deepEqual(
    getDashboardDecisionConflict({
      ...conflictContext,
      executionAction: "monitoring",
      signalDeciderEvidence: {
        ...conflictContext.signalDeciderEvidence,
        action: "buy",
      },
    }),
    {
      actionConflict: false,
      riskPlanConflict: true,
    },
  );
});

test("ignores unrelated routes and invalid recommendation prices", () => {
  assert.equal(readDashboardRecommendationContext(new URLSearchParams("stopLossPrice=51800")), null);

  const params = new URLSearchParams(
    "recommendationSource=execution-runtime&referencePriceKind=close&stopLossPrice=invalid&targetPrice=-1&executionAction=invalid&executionSource=invalid&recommendationMarketDate=not-a-date&signalDeciderAction=wait&signalDeciderMarketDate=not-a-date",
  );
  assert.deepEqual(readDashboardRecommendationContext(params), {
    executionAction: null,
    executionSource: null,
    marketDate: null,
    referencePrice: null,
    referencePriceKind: "close",
    signalDeciderEvidence: null,
    source: "execution-runtime",
    stopLossPrice: null,
    symbol: null,
    targetPrice: null,
  });
});
