import assert from "node:assert/strict";
import test from "node:test";

import {
  appendDashboardRecommendationContext,
  readDashboardRecommendationContext,
} from "@/lib/dashboard-recommendation-context";

test("round-trips a dashboard recommendation context through route params", () => {
  const params = new URLSearchParams();

  appendDashboardRecommendationContext(params, {
    referencePrice: 52400,
    referencePriceKind: "current",
    stopLossPrice: 51800,
    targetPrice: 55200,
  });

  assert.deepEqual(readDashboardRecommendationContext(params), {
    referencePrice: 52400,
    referencePriceKind: "current",
    stopLossPrice: 51800,
    targetPrice: 55200,
  });
});

test("ignores unrelated routes and invalid recommendation prices", () => {
  assert.equal(readDashboardRecommendationContext(new URLSearchParams("stopLossPrice=51800")), null);

  const params = new URLSearchParams(
    "recommendationSource=dashboard-decider&referencePriceKind=close&stopLossPrice=invalid&targetPrice=-1",
  );
  assert.deepEqual(readDashboardRecommendationContext(params), {
    referencePrice: null,
    referencePriceKind: "close",
    stopLossPrice: null,
    targetPrice: null,
  });
});
