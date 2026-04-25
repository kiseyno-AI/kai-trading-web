import assert from "node:assert/strict";
import test from "node:test";

import type { EodFreshnessStageDto } from "@/types/trading-api";

import { getFundamentalsStageStatusLabel } from "./live-dashboard-derived-state";

function buildStage(status: string): EodFreshnessStageDto {
  return {
    status,
    symbols_total: 3583,
    symbols_succeeded: 1,
    symbols_failed: 0,
  };
}

test("marks stale latest fundamentals coverage as not synced on an active trading day", () => {
  assert.equal(
    getFundamentalsStageStatusLabel(buildStage("ready"), "2026-04-21", "2026-04-18", false),
    "not synced",
  );
});

test("keeps stale fundamentals coverage in break-day state when the market is closed", () => {
  assert.equal(
    getFundamentalsStageStatusLabel(buildStage("ready"), "2026-04-21", "2026-04-18", true),
    "break day",
  );
});

test("keeps same-day fundamentals coverage synced", () => {
  assert.equal(
    getFundamentalsStageStatusLabel(buildStage("ready"), "2026-04-21", "2026-04-21", false),
    "synced",
  );
});
