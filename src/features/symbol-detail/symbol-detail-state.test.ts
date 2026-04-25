import assert from "node:assert/strict";
import test from "node:test";

import {
  getSymbolDetailSectionVisibility,
  resolveSymbolDetailMode,
  resolveSymbolDetailModeFromPathname,
  type SymbolDetailMode,
} from "@/app/dashboard/symbol/[symbol]/symbol-detail-state";

test("resolves detail mode from a deep disclosure route without changing the parent section mode", () => {
  assert.equal(
    resolveSymbolDetailModeFromPathname(
      "/dashboard/symbol/005930/disclosure-coverage/202604100001",
      "005930",
    ),
    "disclosure-coverage",
  );
});

test("resolves query-string detail modes and rejects unknown ones", () => {
  assert.equal(resolveSymbolDetailMode("technical-analysis"), "technical-analysis");
  assert.equal(resolveSymbolDetailMode("not-a-real-mode"), null);
});

test("keeps section visibility stable for overview and each detail mode", () => {
  const expectedByMode: Record<SymbolDetailMode, ReturnType<typeof getSymbolDetailSectionVisibility>> = {
    overview: {
      showOverview: true,
      showChartSection: true,
      showFactorSnapshotSection: true,
      showActionSection: false,
      showTechnicalSection: false,
      showFundamentalsSection: false,
      showDisclosureSection: false,
      showFreshnessSection: true,
    },
    "action-summary": {
      showOverview: false,
      showChartSection: false,
      showFactorSnapshotSection: false,
      showActionSection: true,
      showTechnicalSection: false,
      showFundamentalsSection: false,
      showDisclosureSection: false,
      showFreshnessSection: false,
    },
    "technical-analysis": {
      showOverview: false,
      showChartSection: true,
      showFactorSnapshotSection: false,
      showActionSection: false,
      showTechnicalSection: true,
      showFundamentalsSection: false,
      showDisclosureSection: false,
      showFreshnessSection: false,
    },
    "fundamentals-history": {
      showOverview: false,
      showChartSection: false,
      showFactorSnapshotSection: false,
      showActionSection: false,
      showTechnicalSection: false,
      showFundamentalsSection: true,
      showDisclosureSection: false,
      showFreshnessSection: false,
    },
    "disclosure-coverage": {
      showOverview: false,
      showChartSection: false,
      showFactorSnapshotSection: false,
      showActionSection: false,
      showTechnicalSection: false,
      showFundamentalsSection: false,
      showDisclosureSection: true,
      showFreshnessSection: false,
    },
    "system-freshness": {
      showOverview: false,
      showChartSection: false,
      showFactorSnapshotSection: false,
      showActionSection: false,
      showTechnicalSection: false,
      showFundamentalsSection: false,
      showDisclosureSection: false,
      showFreshnessSection: true,
    },
  };

  for (const [mode, expected] of Object.entries(expectedByMode) as Array<
    [SymbolDetailMode, ReturnType<typeof getSymbolDetailSectionVisibility>]
  >) {
    assert.deepEqual(getSymbolDetailSectionVisibility(mode), expected);
  }
});
