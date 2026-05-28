import assert from "node:assert/strict";
import test from "node:test";

import {
  getSymbolDetailSectionVisibility,
  resolveSymbolDetailMode,
  resolveSymbolDetailModeFromPathname,
  type SymbolDetailMode,
} from "@/app/dashboard/symbol/[symbol]/symbol-detail-state";
import { getSymbolDetailCopy } from "@/i18n/symbol-detail-copy";
import type { AgentContextActionSummaryDto } from "@/types/trading-api";

import {
  buildActionSummarySectionModel,
  buildDisclosureCoverageSectionModel,
  buildFundamentalsHistorySectionModel,
  buildSystemFreshnessSectionModel,
  buildTechnicalAnalysisSectionModel,
  formatQuoteUnavailableReasonLabel,
} from "./symbol-detail-derived-state";

function makeActionSummary(overrides: Partial<AgentContextActionSummaryDto> = {}): AgentContextActionSummaryDto {
  return {
    symbol: "005930",
    market_date: "2026-04-10",
    source: "test",
    action_label: "strong_buy",
    bias_direction: "long",
    signal_score: 94,
    confidence_tier: "high",
    risk_tier: "medium",
    trigger_price: 70100,
    invalidation_price: 68000,
    support_price: 69000,
    resistance_price: 72000,
    reasons: ["Trend support confirmed", "Volume expansion detected"],
    summary_payload: {
      trigger: "breakout",
    },
    captured_at: "2026-04-10T16:00:00+09:00",
    ...overrides,
  };
}

test("TC-SYMBOL-001 route and mode resolution preserve every symbol-detail path, including deep disclosure routes", () => {
  const expectedByPath: Record<string, SymbolDetailMode> = {
    "/dashboard/symbol/005930": "overview",
    "/dashboard/symbol/005930/action-summary": "action-summary",
    "/dashboard/symbol/005930/technical-analysis": "technical-analysis",
    "/dashboard/symbol/005930/fundamentals-history": "fundamentals-history",
    "/dashboard/symbol/005930/disclosure-coverage": "disclosure-coverage",
    "/dashboard/symbol/005930/disclosure-coverage/202604100001": "disclosure-coverage",
    "/dashboard/symbol/005930/system-freshness": "system-freshness",
  };

  for (const [pathname, expectedMode] of Object.entries(expectedByPath)) {
    assert.equal(resolveSymbolDetailModeFromPathname(pathname, "005930"), expectedMode);
  }

  assert.equal(resolveSymbolDetailMode("system-freshness"), "system-freshness");
  assert.equal(resolveSymbolDetailMode("not-a-real-mode"), null);
  assert.equal(resolveSymbolDetailModeFromPathname("/dashboard/symbol/000660/action-summary", "005930"), null);
});

test("TC-SYMBOL-002 section visibility stays stable for overview and every deep detail mode", () => {
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

test("TC-SYMBOL-003 action-summary fallback labels stay stable when no summary is available", () => {
  const copy = getSymbolDetailCopy("en");
  const model = buildActionSummarySectionModel(null, copy);

  assert.equal(model.badgeLabel, copy.action.unavailable);
  assert.equal(model.headline, copy.action.emptyHeadline);
  assert.equal(model.body, copy.action.emptyBody);
  assert.equal(model.metaCaption, "");
  assert.deepEqual(model.reasonTags, [copy.action.noRationaleRows]);
  assert.equal(model.metrics[0]?.value, "Unavailable");
  assert.equal(model.metrics[1]?.value, "Unavailable");
  assert.equal(model.metrics[2]?.value, copy.action.noTriggerPrice);
  assert.equal(model.score, 0);
  assert.equal(model.tone, "neutral");
  assert.equal(model.meter.state, "unavailable");
  assert.equal(model.meter.label, copy.action.signalScore);
  assert.equal(model.meter.valueLabel, copy.action.unavailable);
  assert.equal(model.meter.currentLabel, copy.action.signalUnavailable);
  assert.match(model.meter.ariaLabel, /No current action resolved/);
  assert.doesNotMatch(
    [
      model.badgeLabel,
      model.headline,
      model.body,
      model.metaCaption,
      model.meter.ariaLabel,
      model.meter.currentLabel,
      model.meter.valueLabel,
      ...model.metrics.map((metric) => metric.value),
      ...model.reasonTags,
    ].join(" "),
    /\b(?:Sell|Strong Buy)\b/,
  );
});

test("TC-SYMBOL-008 action-summary insufficient-history state localizes KO copy and hides raw tokens", () => {
  const copy = getSymbolDetailCopy("ko");
  const model = buildActionSummarySectionModel(
    makeActionSummary({
      action_label: "insufficient_data",
      confidence_tier: "low",
      risk_tier: "unknown",
      reasons: ["insufficient_history"],
    }),
    copy,
  );
  const rendered = `${model.badgeLabel} ${model.headline} ${model.body} ${model.reasonTags.join(" ")}`;

  assert.equal(model.badgeLabel, copy.action.actionLabels.insufficientData);
  assert.equal(model.body, `${copy.action.reasonLabels.insufficientHistory} · ${copy.action.insufficientHistoryExplanation}`);
  assert.equal(model.reasonTags[0], copy.action.reasonLabels.insufficientHistory);
  assert.equal(model.metrics[0]?.value, copy.action.confidenceLevels.low);
  assert.equal(model.metrics[1]?.value, copy.action.riskLevels.unknown);
  assert.equal(model.tone, "info");
  assert.equal(model.meter.state, "unavailable");
  assert.equal(model.meter.currentLabel, `현재 액션: ${copy.action.reasonLabels.insufficientHistory}`);
  assert.equal(model.meter.valueLabel, copy.action.scoreUnavailable);
  assert.doesNotMatch(model.meter.ariaLabel, /\b\d+\s*\/\s*100\b/);
  assert.doesNotMatch(rendered, /\binsufficient_history\b|Summary Version|Symbol|Market Date|Bias Direction|Insufficient Data\b/);
});

test("TC-SYMBOL-009 technical unavailable state localizes KO copy and hides backend tokens", () => {
  const copy = getSymbolDetailCopy("ko");
  const model = buildTechnicalAnalysisSectionModel(null, null, copy);
  const quoteReason = formatQuoteUnavailableReasonLabel("no_live_quote_or_fresh_fallback", copy);
  const rendered = [
    quoteReason,
    model.badgeLabel,
    model.headline,
    model.body,
    model.metaCaption,
    ...model.metrics.map((metric) => metric.value),
    ...model.payloadTags,
  ].join(" ");

  assert.equal(quoteReason, copy.hero.awaitingQuoteSource);
  assert.equal(model.badgeLabel, copy.technical.unavailable);
  assert.equal(model.payloadTags[0], copy.technical.noPayloadKeys);
  assert.equal(model.metaCaption, `${copy.technical.noSourceDate} · ${copy.technical.freshnessNote}`);
  assert.doesNotMatch(rendered, /no_live_quote_or_fresh_fallback|Unavailable|No payload keys|소스 날짜 소스 날짜 없음/);
});

test("TC-SYMBOL-004 action-summary resolved meter presents the current strong-buy long bias", () => {
  const copy = getSymbolDetailCopy("en");
  const model = buildActionSummarySectionModel(makeActionSummary(), copy);

  assert.equal(model.badgeLabel, "Strong Buy");
  assert.equal(model.headline, "Strong Buy · Confidence High");
  assert.equal(model.score, 94);
  assert.equal(model.tone, "positive");
  assert.equal(model.meter.state, "resolved");
  assert.equal(model.meter.label, copy.action.signalScore);
  assert.equal(model.meter.valueLabel, "94 / 100");
  assert.equal(model.meter.currentLabel, "Current action: Strong Buy · Bias Long");
  assert.match(model.meter.ariaLabel, /Signal score: 94 \/ 100/);
  assert.match(model.meter.ariaLabel, /Current action: Strong Buy · Bias Long/);
});

test("TC-SYMBOL-005 fundamentals-history empty state surfaces aggregate-only latest coverage when stored history is missing", () => {
  const copy = getSymbolDetailCopy("en");
  const model = buildFundamentalsHistorySectionModel({
    companyHistory: null,
    copy,
    fundamentalsEntryLimit: 4,
    fundamentalsLoading: false,
    fsDiv: null,
    introTitle: "Samsung Electronics",
    latestFundamentals: {
      filing: {
        report_name: "Annual report",
        receipt_date: "2026-03-31",
      },
      period: {
        report_label: "FY 2025",
        period_end_date: "2025-12-31",
        business_year: 2025,
      },
      statement: {
        row_count: 42,
      },
      highlights: null,
    },
    latestHistoryEntry: null,
    symbol: "005930",
  });

  assert.equal(model.state, "empty");
  assert.equal(model.fsValue, copy.fundamentals.defaultFs);
  assert.equal(model.introInitial, "0");
  assert.equal(model.introTitle, "Samsung Electronics");
  assert.equal(model.introBody, `${copy.fundamentals.latestFilingPrefix} Annual report.`);
  assert.equal(
    model.emptyBody,
    `${copy.fundamentals.aggregateContextHas} Annual report ${copy.fundamentals.from} 2026-03-31.`,
  );
  assert.equal(model.highlights[0]?.label, copy.fundamentals.latestFiling);
  assert.equal(model.highlights[0]?.value, "Annual report");
  assert.equal(model.highlights[1]?.label, copy.fundamentals.period);
  assert.equal(model.highlights[1]?.value, "FY 2025");
  assert.equal(model.highlights[2]?.label, copy.fundamentals.statementRows);
  assert.equal(model.highlights[2]?.value, "42");
});

test("TC-SYMBOL-006 disclosure-coverage unavailable state keeps fallback labels without phantom report cards", () => {
  const copy = getSymbolDetailCopy("en");
  const model = buildDisclosureCoverageSectionModel({
    copy,
    disclosureCount: 0,
    disclosureItemLimit: 4,
    latestDisclosure: null,
    recentDisclosures: [],
    routeQueryString: "marketDate=2026-04-10",
    sectionState: "unavailable",
    symbol: "005930",
  });

  assert.equal(model.state, "unavailable");
  assert.equal(model.badgeTone, "warning");
  assert.equal(model.badgeValue, `0 ${copy.disclosures.items}`);
  assert.equal(model.coverageTitle, copy.disclosures.partialAnalystCoverage);
  assert.equal(model.coverageBody, copy.disclosures.emptyTitle);
  assert.equal(model.emptyTitle, copy.disclosures.unavailableTitle);
  assert.equal(model.emptyBody, copy.disclosures.unavailableBody);
  assert.deepEqual(model.cards, []);
});

test("TC-SYMBOL-007 system-freshness fallback rows keep stable labels for unavailable quote, fundamentals, and disclosure coverage", () => {
  const copy = getSymbolDetailCopy("en");
  const model = buildSystemFreshnessSectionModel({
    actionSummary: null,
    aggregateContext: null,
    copy,
    disclosureSectionState: "unavailable",
    freshness: {
      today: {
        trade_date: "2026-04-18",
        eod_status: "running",
      },
      latest: {},
    },
    hasFundamentalsHistory: false,
    latestDisclosure: null,
    latestFundamentals: null,
    marketDate: "2026-04-18",
    quote: {
      symbol: "005930",
      company_name: "Samsung Electronics",
      price: null,
      change: null,
      change_pct: null,
      volume: null,
      turnover: null,
      market_state: "CLOSED",
      source: "daily_price_bar",
      fallback: true,
      is_live: false,
      available: false,
      trade_date: "2026-04-18",
      unavailable_reason: "Quote cache waiting for confirmation",
    },
    technicalSnapshot: null,
  });

  const priceRow = model.moduleRows.find((row) => row.id === "price");
  const fundamentalsRow = model.moduleRows.find((row) => row.id === "fundamentals");
  const disclosureRow = model.moduleRows.find((row) => row.id === "disclosures");

  assert.equal(model.statusLabel, "Running");
  assert.equal(model.tone, "info");
  assert.equal(priceRow?.date, "2026-04-18");
  assert.equal(priceRow?.detail, "Quote cache waiting for confirmation");
  assert.equal(priceRow?.status, copy.freshness.unavailable);
  assert.equal(fundamentalsRow?.date, copy.fundamentals.noReceiptDate);
  assert.equal(fundamentalsRow?.status, copy.freshness.noHistory);
  assert.equal(disclosureRow?.date, copy.freshness.unavailable);
  assert.equal(disclosureRow?.status, copy.freshness.unavailable);
  assert.equal(disclosureRow?.detail, copy.disclosures.emptyTitle);
});

test("TC-SYMBOL-008 factor snapshot copy for KO mode removes English card and metric labels from local UI copy map", () => {
  const enCopy = getSymbolDetailCopy("en");
  const koCopy = getSymbolDetailCopy("ko");

  assert.equal(koCopy.factors.momentumFamilyTitle, "모멘텀");
  assert.equal(koCopy.factors.lowRiskFamilyTitle, "저변동");
  assert.equal(koCopy.factors.betaFamilyTitle, "베타");
  assert.equal(koCopy.factors.valueFamilyTitleUnified, "통합 밸류");
  assert.equal(koCopy.factors.advancedValueFamilyTitle, "고급 밸류 컴포넌트");
  assert.equal(koCopy.factors.metricMomentum12, "12일 모멘텀");
  assert.equal(koCopy.factors.metricTradingValue20d, "20일 거래대금");
  assert.equal(koCopy.factors.tradingValueUnavailable, "확인 필요");
  assert.equal(koCopy.factors.metricStatusLabels.needs_confirmation, "확인 필요");
  assert.equal(koCopy.factors.factorStatusLabels.eligible, "적합");
  assert.notEqual(koCopy.factors.title, enCopy.factors.title);
});
