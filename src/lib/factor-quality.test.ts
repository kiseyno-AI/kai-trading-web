import assert from "node:assert/strict";
import test from "node:test";

import { buildFactorQualitySummary } from "./factor-quality";

test("buildFactorQualitySummary maps complete quality score contract fields", () => {
  const quality = buildFactorQualitySummary({
    quality_score: 0.78,
    quality_rank: 12,
    quality_percentile: 0.91,
    quality_status: "scored_complete",
    components_possible: 6,
    components_used: 6,
    is_quality_score_complete: true,
    quality_component_statuses: {
      roe: "scored",
      roa: "scored",
      gross_profit_to_assets: "scored",
      operating_cash_flow_to_net_income: "scored",
      debt_ratio: "scored",
      accruals_ratio: "scored",
    },
    factor_payload: null,
  });

  assert.equal(quality?.calculationState, "complete");
  assert.equal(quality?.calculationLabel, "Calculation complete");
  assert.equal(quality?.statusLabel, "Complete");
  assert.equal(quality?.tone, "positive");
  assert.equal(quality?.componentsPossible, 6);
  assert.equal(quality?.componentsUsed, 6);
  assert.equal(quality?.componentStatuses.length, 6);
});

test("buildFactorQualitySummary maps partial and payload-hosted component statuses", () => {
  const quality = buildFactorQualitySummary({
    quality_score: 0.64,
    quality_rank: 55,
    quality_percentile: 0.72,
    quality_status: "scored_partial",
    components_possible: 6,
    components_used: 4,
    is_quality_score_complete: false,
    factor_payload: {
      quality_component_statuses: {
        roe: "scored",
        roa: "scored",
        gross_profit_to_assets: "missing_metric",
        ocf_to_net_income: "invalid_net_income",
        debt_ratio: "scored",
        accruals: "scored",
      },
    },
  });

  assert.equal(quality?.calculationState, "partial");
  assert.equal(quality?.calculationLabel, "Partial calculation");
  assert.equal(quality?.statusLabel, "Partial");
  assert.equal(quality?.tone, "warning");
  assert.deepEqual(
    quality?.componentStatuses.map((component) => `${component.label}: ${component.statusLabel}`),
    [
      "ROE: Scored",
      "ROA: Scored",
      "Gross profit / assets: Missing metric",
      "OCF / net income: Invalid net income",
      "Debt ratio: Scored",
      "Accruals: Scored",
    ],
  );
});

test("buildFactorQualitySummary can force an unavailable status for value rows before core exposes quality fields", () => {
  const quality = buildFactorQualitySummary(
    {
      factor_payload: null,
    },
    { force: true },
  );

  assert.equal(quality?.hasQualityFields, false);
  assert.equal(quality?.calculationState, "unavailable");
  assert.equal(quality?.calculationLabel, "Calculation unavailable");
  assert.equal(quality?.statusLabel, "Unavailable");
});
