import assert from "node:assert/strict";
import test from "node:test";

import {
  getPresenterAvailabilityTone,
  getPresenterFreshnessTone,
  getPresenterStageDisplayLabel,
  getPresenterStageTone,
  resolveNormalizedPresenterDate,
  resolvePresenterDate,
  resolvePresenterStageStatus,
  shouldPreferTodayPresenterStageData,
} from "./stage-date-status-presenter";

test("prefers latest-stage data over today when dates diverge and no running override exists", () => {
  assert.equal(shouldPreferTodayPresenterStageData("2026-04-21", "2026-04-18"), false);
});

test("keeps today-stage data when the pipeline is running even if the latest date is stale", () => {
  assert.equal(shouldPreferTodayPresenterStageData("2026-04-21", "2026-04-18", true), true);
});

test("labels stale ready stages as break day only when the market is closed", () => {
  assert.equal(
    resolvePresenterStageStatus({
      stageStatus: "ready",
      todayTradeDate: "2026-04-21",
      latestDate: "2026-04-18",
      canShowBreakDay: true,
    }),
    "break day",
  );
  assert.equal(
    resolvePresenterStageStatus({
      stageStatus: "ready",
      todayTradeDate: "2026-04-21",
      latestDate: "2026-04-18",
      canShowBreakDay: false,
      staleReadyLabel: "not synced",
    }),
    "not synced",
  );
});

test("keeps running and synced stage labels stable", () => {
  assert.equal(
    resolvePresenterStageStatus({
      stageStatus: "running",
      todayTradeDate: "2026-04-21",
      latestDate: "2026-04-18",
      canShowBreakDay: false,
    }),
    "running",
  );
  assert.equal(
    resolvePresenterStageStatus({
      stageStatus: "ready",
      todayTradeDate: "2026-04-21",
      latestDate: "2026-04-21",
      canShowBreakDay: false,
    }),
    "synced",
  );
});

test("keeps fallback date selection order stable for raw and normalized presenter dates", () => {
  assert.equal(resolvePresenterDate(null, " 2026-04-18 ", "2026-04-17"), " 2026-04-18 ");
  assert.equal(resolveNormalizedPresenterDate(null, " 2026-04-18 ", "2026-04-17"), "2026-04-18");
});

test("keeps stage badge labels and tones stable", () => {
  assert.equal(
    getPresenterStageDisplayLabel("break day", {
      synced: "Synced",
      running: "Running",
      breakDay: "Break Day",
      notSynced: "Not Synced",
    }),
    "Break Day",
  );
  assert.equal(getPresenterStageTone("synced"), "positive");
  assert.equal(getPresenterStageTone("running"), "info");
  assert.equal(getPresenterStageTone("break day"), "neutral");
  assert.equal(getPresenterStageTone("not synced"), "warning");
});

test("keeps freshness and availability tone mapping stable", () => {
  assert.equal(getPresenterFreshnessTone("completed"), "positive");
  assert.equal(getPresenterFreshnessTone("completed_with_errors"), "warning");
  assert.equal(getPresenterFreshnessTone("running"), "info");
  assert.equal(getPresenterFreshnessTone("pending"), "neutral");
  assert.equal(getPresenterFreshnessTone(null), "warning");
  assert.equal(getPresenterAvailabilityTone(true, "warning"), "positive");
  assert.equal(getPresenterAvailabilityTone(false, "info"), "info");
});
