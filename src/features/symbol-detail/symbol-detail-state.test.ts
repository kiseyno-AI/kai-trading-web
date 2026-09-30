import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInitialSymbolMeta,
  getSymbolDetailSectionVisibility,
  resolveSymbolDetailActiveNav,
  resolveSymbolDetailCalendarReviewDate,
  resolveSymbolDetailMode,
  resolveSymbolDetailModeFromPathname,
  resolveSymbolDetailNavContext,
  SYMBOL_DETAIL_CALENDAR_NAV_CONTEXT,
  SYMBOL_DETAIL_PIOTROSKI_NAV_CONTEXT,
  SYMBOL_DETAIL_SEARCH_NAV_CONTEXT,
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

test("resolves symbol detail navigation context without defaulting to My Symbols", () => {
  assert.equal(resolveSymbolDetailNavContext("my-symbols"), "my-symbols");
  assert.equal(resolveSymbolDetailActiveNav(resolveSymbolDetailNavContext("my-symbols")), "symbols");
  assert.equal(resolveSymbolDetailNavContext(SYMBOL_DETAIL_SEARCH_NAV_CONTEXT), SYMBOL_DETAIL_SEARCH_NAV_CONTEXT);
  assert.equal(resolveSymbolDetailActiveNav(resolveSymbolDetailNavContext(SYMBOL_DETAIL_SEARCH_NAV_CONTEXT)), null);
  assert.equal(
    resolveSymbolDetailNavContext(SYMBOL_DETAIL_PIOTROSKI_NAV_CONTEXT),
    SYMBOL_DETAIL_PIOTROSKI_NAV_CONTEXT,
  );
  assert.equal(resolveSymbolDetailActiveNav(resolveSymbolDetailNavContext(SYMBOL_DETAIL_PIOTROSKI_NAV_CONTEXT)), "dashboard");
  assert.equal(resolveSymbolDetailNavContext("markets"), null);
  assert.equal(resolveSymbolDetailNavContext(null), null);
  assert.equal(resolveSymbolDetailActiveNav(null), null);
});

test("exposes a review date only for calendar-sourced symbol detail", () => {
  assert.equal(
    resolveSymbolDetailCalendarReviewDate(SYMBOL_DETAIL_CALENDAR_NAV_CONTEXT, "2026-09-23"),
    "2026-09-23",
  );
  assert.equal(resolveSymbolDetailCalendarReviewDate(SYMBOL_DETAIL_SEARCH_NAV_CONTEXT, "2026-09-23"), null);
  assert.equal(resolveSymbolDetailCalendarReviewDate(SYMBOL_DETAIL_CALENDAR_NAV_CONTEXT, "  "), null);
  assert.equal(resolveSymbolDetailCalendarReviewDate(SYMBOL_DETAIL_CALENDAR_NAV_CONTEXT, null), null);
});

test("does not seed unverified symbol metadata when direct-open URLs only preserve search context", () => {
  assert.equal(
    buildInitialSymbolMeta("123456", {
      name: null,
      market: null,
      standardCode: null,
    }),
    null,
  );

  assert.deepEqual(
    buildInitialSymbolMeta("005930", {
      name: "삼성전자",
      market: "KOSPI",
      standardCode: "KR7005930003",
    }),
    {
      symbol: "005930",
      name_ko: "삼성전자",
      market: "KOSPI",
      standard_code: "KR7005930003",
    },
  );
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
