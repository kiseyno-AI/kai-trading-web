import assert from "node:assert/strict";
import test from "node:test";

import type { EodPipelineStageDto, EodPipelineStatusResponseDto } from "@/types/trading-api";

import {
  CANONICAL_EOD_PIPELINE_STAGE_ORDER,
  buildDailyPipelineTimelineModel,
  isDailyPipelineStatusRunning,
  normalizeDailyPipelineStatusToken,
} from "./eod-pipeline-status";

function buildStage(
  status: string,
  overrides: Partial<EodPipelineStageDto> = {},
): EodPipelineStageDto {
  return {
    status,
    processed: null,
    total: null,
    failed: null,
    ...overrides,
  };
}

function buildPipelineStatus(
  overrides: Partial<EodPipelineStatusResponseDto> = {},
): EodPipelineStatusResponseDto {
  return {
    market_date: "2026-05-15",
    status: "running",
    stage_order: [...CANONICAL_EOD_PIPELINE_STAGE_ORDER],
    stages: {},
    ...overrides,
  };
}

test("normalizes supported live pipeline status tokens to running", () => {
  for (const token of ["running", "in_progress", "started", "active"] as const) {
    assert.equal(normalizeDailyPipelineStatusToken(token), "running", token);
    assert.equal(isDailyPipelineStatusRunning(token), true, token);
  }
});

test("keeps a live running stage running when persisted rows are still zero", () => {
  const model = buildDailyPipelineTimelineModel(
    buildPipelineStatus({
      stages: {
        market_risk_filter: buildStage("running", {
          processed: 0,
          total: 2809,
          failed: 0,
          current_activity: "filtering market risk",
          details: {
            rows_persisted: 0,
            expected_rows: 2809,
            expected_rows_source: "price universe",
          },
          source_run_ids: {
            eod_run_id: "eod-20260515",
          },
        }),
      },
    }),
    "en-US",
  );
  const stage = model.stages.find((item) => item.key === "market_risk_filter");

  assert.equal(stage?.status, "running");
  assert.equal(stage?.progressLabel, "0 / 2,809");
  assert.equal(stage?.progressSource, "live_run_metadata");
  assert.match(stage?.reason ?? "", /stored rows are still 0/);
});

test("marks downstream fundamentals-dependent stages blocked when DART fundamentals are missing", () => {
  const model = buildDailyPipelineTimelineModel(
    buildPipelineStatus({
      stages: {
        fundamentals_daily_refresh: buildStage("failed", {
          processed: 0,
          total: 3583,
          failed: 3583,
          details: {
            error_message: "DART fundamentals are missing for the market date.",
          },
        }),
        piotroski_filter: buildStage("pending"),
        advanced_value_factors: buildStage("pending"),
        quality_factors: buildStage("pending"),
      },
    }),
    "en-US",
  );
  const piotroski = model.stages.find((item) => item.key === "piotroski_filter");
  const advancedValue = model.stages.find((item) => item.key === "advanced_value_factors");
  const quality = model.stages.find((item) => item.key === "quality_factors");
  const signalDecider = model.stages.find((item) => item.key === "signal_decider");

  assert.equal(piotroski?.status, "blocked");
  assert.deepEqual(piotroski?.blockingDependencies.map((dependency) => dependency.key), [
    "fundamentals_daily_refresh",
  ]);
  assert.equal(advancedValue?.status, "blocked");
  assert.equal(quality?.status, "blocked");
  assert.equal(signalDecider?.status, "blocked");
});

test("uses completed stored-row evidence without requiring live progress counters", () => {
  const model = buildDailyPipelineTimelineModel(
    buildPipelineStatus({
      status: "completed",
      stages: {
        piotroski_filter: buildStage(null, {
          details: {
            rows_persisted: 143,
            expected_rows: 2809,
            progress_source: "stored_rows",
          },
        }),
      },
    }),
    "en-US",
  );
  const stage = model.stages.find((item) => item.key === "piotroski_filter");

  assert.equal(stage?.status, "completed");
  assert.equal(stage?.progressLabel, "143 / 2,809");
  assert.equal(stage?.progressSource, "stored_rows");
  assert.match(stage?.reason ?? "", /stored row evidence/);
});

test("formats completed stored-row evidence as a row count when expected rows are a different unit", () => {
  const model = buildDailyPipelineTimelineModel(
    buildPipelineStatus({
      status: "completed",
      stages: {
        trending_ranks: buildStage("completed", {
          label: "stored trending rank rebuild",
          processed: null,
          total: null,
          eod_run_id: 299,
          details: {
            rows_persisted: 8412,
            expected_rows: 3,
            progress_source: "stored_rows",
          },
        }),
      },
    }),
    "en-US",
  );
  const stage = model.stages.find((item) => item.key === "trending_ranks");

  assert.equal(stage?.status, "completed");
  assert.equal(stage?.progressLabel, "8,412 stored rows");
  assert.equal(stage?.progressPercent, 100);
  assert.equal(stage?.progressSource, "stored_rows");
  assert.deepEqual(stage?.sourceRunIds, [{ key: "eod_run_id", value: "299" }]);
  assert.match(stage?.reason ?? "", /stored row evidence/);
  assert.doesNotMatch(stage?.progressLabel ?? "", /8,412\s*\/\s*3/);
});

test("maps interrupted run metadata to failed status and preserves the reason", () => {
  const model = buildDailyPipelineTimelineModel(
    buildPipelineStatus({
      status: "interrupted",
      stages: {
        signal_decider: buildStage("interrupted", {
          processed: 91,
          total: 120,
          failed: 1,
          updated_at: "2026-05-15T18:10:00+09:00",
          details: {
            error_message: "Operator interrupted the decider run.",
          },
          source_run_ids: {
            feedback_run_id: "feedback-42",
          },
        }),
      },
    }),
    "en-US",
  );
  const stage = model.stages.find((item) => item.key === "signal_decider");

  assert.equal(model.status, "failed");
  assert.equal(model.currentStage?.key, "signal_decider");
  assert.equal(stage?.status, "failed");
  assert.equal(stage?.reason, "Operator interrupted the decider run.");
  assert.deepEqual(stage?.sourceRunIds, [{ key: "feedback_run_id", value: "feedback-42" }]);
});

test("does not treat synthesized pending fallback stages as current when the pipeline is idle", () => {
  const model = buildDailyPipelineTimelineModel(
    buildPipelineStatus({
      status: "completed",
      stages: {
        price_collection: buildStage("completed", {
          processed: 2809,
          total: 2809,
          failed: 0,
        }),
      },
    }),
    "en-US",
  );

  assert.equal(model.status, "completed");
  assert.equal(model.currentStage, null);
  assert.equal(model.stages.find((stage) => stage.key === "master_refresh")?.status, "pending");
});

test("always returns the full canonical pipeline stage order", () => {
  const model = buildDailyPipelineTimelineModel(
    buildPipelineStatus({
      stage_order: ["signal_decider", "price_collection"],
      stages: {
        signal_decider: buildStage("pending"),
        price_collection: buildStage("completed", {
          processed: 2809,
          total: 2809,
          failed: 0,
        }),
      },
    }),
    "en-US",
  );

  assert.deepEqual(
    model.stages.map((stage) => stage.key),
    [...CANONICAL_EOD_PIPELINE_STAGE_ORDER],
  );
});
