import assert from "node:assert/strict";
import test from "node:test";

import { getSymbolDetailCopy } from "@/i18n/symbol-detail-copy";
import type {
  AgentContextActionSummaryDto,
  EodPiotroskiFilterResultsResponseDto,
  SymbolPriceBarDto,
} from "@/types/trading-api";
import type { QuoteResponse } from "./symbol-detail-types";

import {
  buildActionSummarySectionModel,
  buildActionFreshnessDate,
  buildDisclosureCoverageSectionModel,
  buildFocusTurnoverValue,
  buildPercentChange,
  buildFreshnessTone,
  buildFundamentalsHistorySectionModel,
  buildHeroFundamentalLatestMetricModel,
  buildHeroPiotroskiMetricModel,
  buildLatestPriceLabel,
  buildModuleStatusTone,
  buildPriceHistoryRangeMetrics,
  buildQuoteSourceLabel,
  buildSymbolDetailMarketDateBasisCopy,
  buildSymbolRouteQuery,
  buildSystemFreshnessSectionModel,
  buildTechnicalAnalysisSectionModel,
  buildTechnicalFreshnessDate,
  formatQuoteUnavailableReasonLabel,
  getCurrentSeoulMarketDate,
  getMarketOpenState,
  isClosedSessionMarketState,
  pickFundamentalsCompany,
  pickSelectedBarTradeDate,
  resolveSymbolDetailCurrentMarketDate,
  resolveSymbolDetailEffectiveMarketDate,
  resolveSymbolDetailLatestStoredMarketDate,
  resolveQuotePollingDisplayState,
  shouldStopQuotePollingForClosedSession,
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

function makeQuote(overrides: Partial<QuoteResponse> = {}): QuoteResponse {
  return {
    symbol: "005930",
    company_name: "Samsung Electronics",
    price: 70000,
    change: 500,
    change_pct: 0.72,
    volume: 1250000,
    turnover: 87500000000,
    market_state: "OPEN",
    source: "kis_live",
    fallback: false,
    is_live: true,
    available: true,
    trade_date: "2026-04-10",
    ...overrides,
  };
}

function makePriceBar(overrides: Partial<SymbolPriceBarDto> = {}): SymbolPriceBarDto {
  return {
    trade_date: "2026-04-10",
    open_price: 268000,
    high_price: 269000,
    low_price: 267000,
    close_price: 268500,
    volume: 25697000,
    turnover: 6897645000000,
    source: "test",
    captured_at: "2026-04-10T16:00:00+09:00",
    ...overrides,
  };
}

function makePiotroskiResponse(
  overrides: Partial<EodPiotroskiFilterResultsResponseDto> = {},
): EodPiotroskiFilterResultsResponseDto {
  return {
    market_date: "2026-04-10",
    requested_market_date: "2026-04-10",
    resolved_market_date: "2026-04-10",
    is_latest_fallback: false,
    summary: {
      entries: 1,
      requested_symbol: "005930",
      matched_symbols: ["005930"],
      missing_symbols: [],
      passed_count: 1,
      not_passed_count: 0,
    },
    item: {
      symbol: "005930",
      market_date: "2026-04-10",
      passed_filter: true,
      piotroski_score: 8,
      passes_piotroski_score: true,
      captured_at: "2026-04-10T16:00:00+09:00",
    },
    ...overrides,
  };
}

test("stops quote polling for closed/pre-open market state so polling-active copy is not shown", () => {
  assert.equal(isClosedSessionMarketState("closed"), true);
  assert.equal(isClosedSessionMarketState("WEEKEND"), true);
  assert.equal(isClosedSessionMarketState("PREOPEN"), true);
  assert.equal(getMarketOpenState({ state: "WEEKEND" }), false);
  assert.equal(getMarketOpenState({ state: "PREOPEN", is_open: true }), true);
  assert.equal(getMarketOpenState({ state: "PREOPEN", is_open: false }), false);
  assert.equal(
    shouldStopQuotePollingForClosedSession(
      { state: "PREOPEN", is_open: false },
      makeQuote({ market_state: "OPEN", is_live: false }),
    ),
    true,
  );
  assert.equal(
    shouldStopQuotePollingForClosedSession(
      { state: "CLOSED", is_open: false },
      makeQuote({ market_state: "OPEN" }),
    ),
    true,
  );
  assert.equal(
    shouldStopQuotePollingForClosedSession(
      { state: "WEEKEND", is_open: false },
      makeQuote({ market_state: "OPEN" }),
    ),
    true,
  );
  assert.equal(
    shouldStopQuotePollingForClosedSession(
      { state: "OPEN", is_open: true },
      makeQuote({ market_state: "CLOSED", is_live: false }),
    ),
    false,
  );

  const enCopy = getSymbolDetailCopy("en");
  const koCopy = getSymbolDetailCopy("ko");
  const quotePollingStopped = shouldStopQuotePollingForClosedSession(
    { state: "PREOPEN", is_open: false },
    makeQuote({ market_state: "OPEN", is_live: false }),
  );
  assert.equal(quotePollingStopped ? enCopy.hero.closedSession : enCopy.hero.pollingActive, enCopy.hero.closedSession);
  assert.equal(quotePollingStopped ? koCopy.hero.closedSession : koCopy.hero.pollingActive, koCopy.hero.closedSession);
});

test("uses polling-active copy during live sessions even when quote indicates CLOSED", () => {
  assert.equal(
    shouldStopQuotePollingForClosedSession(
      { state: "OPEN", is_open: true },
      makeQuote({ market_state: "CLOSED" }),
    ),
    false,
  );
  assert.equal(
    getMarketOpenState({ state: "OPEN", is_open: true }),
    true,
  );
});

test("only reports active quote polling when live refresh is applicable", () => {
  assert.equal(resolveQuotePollingDisplayState(null, null), "stopped");
  assert.equal(
    resolveQuotePollingDisplayState(
      null,
      makeQuote({ available: false, is_live: false, market_state: "OPEN" }),
    ),
    "stopped",
  );
  assert.equal(
    resolveQuotePollingDisplayState(
      { state: "CLOSED", is_open: false },
      makeQuote({ available: true, is_live: true, market_state: "OPEN" }),
    ),
    "closed",
  );
  assert.equal(resolveQuotePollingDisplayState({ state: "OPEN", is_open: true }, null), "active");
  assert.equal(resolveQuotePollingDisplayState(null, makeQuote()), "active");
});

test("resolves implicit symbol-detail market date from latest stored freshness while preserving explicit dates", () => {
  const freshness = {
    today: {
      trade_date: "2026-05-23",
      eod_status: "pending",
    },
    latest: {
      price_trade_date: "2026-05-22",
      technical_market_date: "2026-05-22",
      action_market_date: "2026-05-22",
    },
  };

  assert.equal(resolveSymbolDetailLatestStoredMarketDate(freshness), "2026-05-22");
  assert.equal(
    resolveSymbolDetailEffectiveMarketDate({
      defaultMarketDate: "2026-05-23",
      freshness,
      quoteTradeDate: null,
      requestedMarketDate: null,
      waitForFreshness: false,
    }),
    "2026-05-22",
  );
  assert.equal(
    resolveSymbolDetailEffectiveMarketDate({
      defaultMarketDate: "2026-05-23",
      freshness,
      quoteTradeDate: null,
      requestedMarketDate: "2026-05-23",
      waitForFreshness: false,
    }),
    "2026-05-23",
  );
});

test("uses the KST product date across the symbol-detail midnight boundary", () => {
  assert.equal(getCurrentSeoulMarketDate(new Date("2026-07-13T23:59:59+09:00")), "2026-07-13");
  assert.equal(getCurrentSeoulMarketDate(new Date("2026-07-14T00:00:00+09:00")), "2026-07-14");
});

test("bounds implicit symbol-detail dates to the KST product date before midnight", () => {
  const freshness = {
    today: {
      trade_date: "2026-07-14",
      eod_status: "pending",
    },
    latest: {
      price_trade_date: "2026-07-14",
      technical_market_date: "2026-07-14",
      action_market_date: "2026-07-14",
    },
  };

  assert.equal(
    resolveSymbolDetailCurrentMarketDate(freshness, { state: "CLOSED", is_open: false }, "2026-07-13"),
    "2026-07-13",
  );
  assert.equal(
    resolveSymbolDetailEffectiveMarketDate({
      defaultMarketDate: "2026-07-13",
      freshness,
      marketState: "CLOSED",
      quoteTradeDate: "2026-07-14",
      requestedMarketDate: null,
      waitForFreshness: false,
    }),
    "2026-07-13",
  );
});

test("falls back to the quote trade date when freshness has no latest stored date on non-trading product dates", () => {
  assert.equal(
    resolveSymbolDetailEffectiveMarketDate({
      defaultMarketDate: "2026-05-24",
      freshness: null,
      marketState: "WEEKEND",
      quoteTradeDate: "2026-05-22",
      requestedMarketDate: null,
      waitForFreshness: false,
    }),
    "2026-05-22",
  );
  assert.equal(
    resolveSymbolDetailEffectiveMarketDate({
      defaultMarketDate: "2026-05-24",
      freshness: {
        today: {
          trade_date: "2026-05-24",
          eod_status: "pending",
        },
        latest: {},
      },
      marketState: "WEEKEND",
      quoteTradeDate: "2026-05-22",
      requestedMarketDate: null,
      waitForFreshness: false,
    }),
    "2026-05-22",
  );
});

test("keeps an implicit non-trading basis pending after freshness fails until quote fallback recovers", () => {
  assert.equal(
    resolveSymbolDetailEffectiveMarketDate({
      defaultMarketDate: "2026-05-24",
      freshness: null,
      freshnessRequestFailed: true,
      marketState: null,
      quoteTradeDate: null,
      requestedMarketDate: null,
      waitForFreshness: false,
    }),
    null,
  );
  assert.equal(
    resolveSymbolDetailEffectiveMarketDate({
      defaultMarketDate: "2026-05-24",
      freshness: null,
      freshnessRequestFailed: true,
      marketState: "WEEKEND",
      quoteTradeDate: "2026-05-22",
      requestedMarketDate: null,
      waitForFreshness: false,
    }),
    "2026-05-22",
  );
  assert.equal(
    resolveSymbolDetailEffectiveMarketDate({
      defaultMarketDate: "2026-05-24",
      freshness: null,
      freshnessRequestFailed: true,
      marketState: "WEEKEND",
      quoteTradeDate: null,
      requestedMarketDate: "2026-05-24",
      waitForFreshness: false,
    }),
    "2026-05-24",
  );
});

test("keeps the latest stored basis after KST midnight on trading weekdays", () => {
  const freshness = {
    today: {
      trade_date: "2026-07-13",
      eod_status: "completed",
    },
    latest: {
      price_trade_date: "2026-07-13",
      technical_market_date: "2026-07-13",
      action_market_date: "2026-07-13",
    },
  };

  assert.equal(
    resolveSymbolDetailCurrentMarketDate(freshness, { state: "PREOPEN", is_open: false }, "2026-07-14"),
    "2026-07-14",
  );
  assert.equal(
    resolveSymbolDetailEffectiveMarketDate({
      defaultMarketDate: "2026-07-14",
      freshness,
      marketState: "PREOPEN",
      quoteTradeDate: "2026-07-13",
      requestedMarketDate: null,
      waitForFreshness: false,
    }),
    "2026-07-13",
  );
});

test("uses Friday's latest stored basis for an implicit Monday pre-open search route", () => {
  const freshness = {
    today: {
      trade_date: "2026-07-27",
      eod_status: "pending",
    },
    latest: {
      price_trade_date: "2026-07-24",
      technical_market_date: "2026-07-24",
      action_market_date: "2026-07-24",
    },
  };

  assert.equal(
    resolveSymbolDetailEffectiveMarketDate({
      defaultMarketDate: "2026-07-27",
      freshness,
      marketState: "PREOPEN",
      quoteTradeDate: "2026-07-24",
      requestedMarketDate: null,
      waitForFreshness: false,
    }),
    "2026-07-24",
  );
  assert.equal(
    resolveSymbolDetailEffectiveMarketDate({
      defaultMarketDate: "2026-07-27",
      freshness,
      marketState: "PREOPEN",
      quoteTradeDate: "2026-07-24",
      requestedMarketDate: "2026-07-27",
      waitForFreshness: false,
    }),
    "2026-07-27",
  );
});

test("falls back to layer-specific latest dates and labels non-trading latest-stored basis", () => {
  const koCopy = getSymbolDetailCopy("ko");
  const freshness = {
    today: {
      trade_date: "2026-05-23",
      eod_status: "pending",
    },
    latest: {
      technical_market_date: "2026-05-22",
      action_market_date: "2026-05-22",
    },
    price: {
      success: true,
      latest_date: "2026-05-22",
    },
  };

  assert.equal(resolveSymbolDetailLatestStoredMarketDate(freshness), "2026-05-22");
  assert.equal(
    resolveSymbolDetailCurrentMarketDate(freshness, { state: "WEEKEND", is_open: false }, "2026-05-23"),
    "2026-05-23",
  );
  assert.equal(
    buildSymbolDetailMarketDateBasisCopy({
      copy: koCopy,
      currentMarketDate: "2026-05-23",
      effectiveMarketDate: "2026-05-22",
      hasExplicitMarketDate: false,
      marketState: "WEEKEND",
    }),
    "최신 저장 기준일 2026-05-22 · 현재 2026-05-23 휴장",
  );
  assert.equal(
    buildSymbolDetailMarketDateBasisCopy({
      copy: koCopy,
      currentMarketDate: "2026-05-23",
      effectiveMarketDate: "2026-05-22",
      hasExplicitMarketDate: true,
      marketState: "WEEKEND",
    }),
    null,
  );
});

test("resolves implicit symbol-detail basis from nested latest freshness stage summaries", () => {
  const koCopy = getSymbolDetailCopy("ko");
  const freshness = {
    today: {
      trade_date: "2026-05-24",
      eod_status: "pending",
    },
    latest: {
      stages: {
        price: {
          summary: {
            price_trade_date: "2026-05-22",
          },
        },
        technical_snapshots: {
          summary: {
            market_date: "2026-05-22",
          },
        },
        action_summaries: {
          summary: {
            market_date: "2026-05-22",
          },
        },
      },
    },
  };

  assert.equal(resolveSymbolDetailLatestStoredMarketDate(freshness), "2026-05-22");
  assert.equal(
    resolveSymbolDetailEffectiveMarketDate({
      defaultMarketDate: "2026-05-24",
      freshness,
      quoteTradeDate: null,
      requestedMarketDate: null,
      waitForFreshness: false,
    }),
    "2026-05-22",
  );
  assert.equal(
    resolveSymbolDetailEffectiveMarketDate({
      defaultMarketDate: "2026-05-24",
      freshness,
      quoteTradeDate: null,
      requestedMarketDate: "2026-05-24",
      waitForFreshness: false,
    }),
    "2026-05-24",
  );
  assert.equal(buildLatestPriceLabel(freshness, null, koCopy), "2026-05-22");
  assert.equal(buildTechnicalFreshnessDate(null, freshness), "2026-05-22");
  assert.equal(buildActionFreshnessDate(null, freshness), "2026-05-22");
});

test("formats focus candle turnover only when the selected bar has confirmed turnover semantics", () => {
  const enCopy = getSymbolDetailCopy("en");
  const koCopy = getSymbolDetailCopy("ko");
  const missingTurnoverBar = {
    ...makePriceBar(),
    turnover: undefined,
  } as unknown as SymbolPriceBarDto;

  assert.equal(buildFocusTurnoverValue(makePriceBar({ turnover: 89375000000 }), enCopy), "₩893.8억");
  assert.equal(buildFocusTurnoverValue(makePriceBar({ turnover: 0 }), enCopy), enCopy.chart.turnoverCheckNeeded);
  assert.equal(buildFocusTurnoverValue(missingTurnoverBar, koCopy), "확인 필요");
  assert.equal(buildFocusTurnoverValue(makePriceBar({ turnover: null }), koCopy), "확인 필요");
  assert.equal(buildFocusTurnoverValue(makePriceBar({ volume: 0, turnover: 0 }), enCopy), "₩0");
});

test("keeps action-summary fallback labels stable when no summary is available", () => {
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

test("shows action summary payload keys only when includePayloadMeta is enabled", () => {
  const copy = getSymbolDetailCopy("en");
  const model = buildActionSummarySectionModel(
    makeActionSummary({
      summary_payload: {
        summary_version: "2",
        symbol: "005930",
        market_date: "2026-04-10",
      },
    }),
    copy,
    { includePayloadMeta: true },
  );

  assert.equal(model.metaCaption, `${copy.action.payloadKeys}: Summary Version · Symbol · Market Date`);
});

test("localizes insufficient-history action summaries in Korean and explains the missing data", () => {
  const copy = getSymbolDetailCopy("ko");
  const model = buildActionSummarySectionModel(
    makeActionSummary({
      action_label: "insufficient_data",
      confidence_tier: "low",
      risk_tier: "unknown",
      reasons: ["insufficient_history"],
      summary_payload: {
        summary_version: "2",
        symbol: "005930",
        market_date: "2026-04-10",
      },
    }),
    copy,
  );

  const rendered = [
    model.badgeLabel,
    model.headline,
    model.body,
    ...model.reasonTags,
    ...model.metrics.map((metric) => metric.value),
  ].join(" ");

  assert.equal(model.badgeLabel, copy.action.actionLabels.insufficientData);
  assert.equal(model.tone, "info");
  assert.equal(model.headline, `${copy.action.actionLabels.insufficientData} · ${copy.action.confidence} ${copy.action.confidenceLevels.low}`);
  assert.equal(model.body, `${copy.action.reasonLabels.insufficientHistory} · ${copy.action.insufficientHistoryExplanation}`);
  assert.equal(model.reasonTags[0], copy.action.reasonLabels.insufficientHistory);
  assert.equal(model.metrics[0]?.value, copy.action.confidenceLevels.low);
  assert.equal(model.metrics[1]?.value, copy.action.riskLevels.unknown);
  assert.match(model.meter.currentLabel, /데이터 부족/);
  assert.equal(model.meter.valueLabel, copy.action.scoreUnavailable);
  assert.equal(model.meter.state, "unavailable");
  assert.equal(model.metaCaption, "");
  assert.doesNotMatch(rendered, /\binsufficient_history\b|Summary Version|Symbol|Market Date|Bias Direction|Low|Unknown\b/);
  assert.doesNotMatch(model.meter.valueLabel, /\b\d+\s*\/\s*100\b/);
});

test("deduplicates Korean action reason labels after mapping backend fallbacks", () => {
  const copy = getSymbolDetailCopy("ko");
  const model = buildActionSummarySectionModel(
    makeActionSummary({
      action_label: "insufficient_data",
      confidence_tier: "low",
      reasons: [
        "insufficient_history",
        "missing_price_history",
        "missing_technical_history",
        "missing_factor_history",
      ],
    }),
    copy,
  );

  assert.deepEqual(model.reasonTags, [
    copy.action.reasonLabels.insufficientHistory,
    copy.action.reasonLabels.unmapped,
  ]);
  assert.equal(
    model.body,
    `${copy.action.reasonLabels.insufficientHistory} · ${copy.action.reasonLabels.unmapped} · ${copy.action.insufficientHistoryExplanation}`,
  );
});

test("localizes watch-long action and decision reason tokens in Korean", () => {
  const copy = getSymbolDetailCopy("ko");
  const model = buildActionSummarySectionModel(
    makeActionSummary({
      action_label: "watch_long",
      reasons: [
        "Mixed Ma Alignment",
        "Range Bound State",
        "Fresh 20d Breakout",
        "High Atr Risk",
      ],
    }),
    copy,
  );

  const rendered = [
    model.badgeLabel,
    model.headline,
    model.body,
    model.meter.currentLabel,
    ...model.reasonTags,
  ].join(" ");

  assert.equal(model.badgeLabel, "롱 관찰");
  assert.equal(model.headline, "롱 관찰 · 신뢰도 높음");
  assert.equal(model.meter.currentLabel, "현재 액션: 롱 관찰 · 편향 롱");
  assert.deepEqual(model.reasonTags, [
    "이동평균선 배열 혼조",
    "박스권 상태",
    "신규 20일 돌파",
    "높은 ATR 리스크",
  ]);
  assert.doesNotMatch(
    rendered,
    /Watch Long|Mixed Ma Alignment|Range Bound State|Fresh 20d Breakout|High Atr Risk|watch_long/i,
  );
});

test("keeps unknown Korean action and bias tokens behind operator-safe fallback copy", () => {
  const copy = getSymbolDetailCopy("ko");
  const model = buildActionSummarySectionModel(
    makeActionSummary({
      action_label: "new_backend_action",
      bias_direction: "future_bias_direction",
      confidence_tier: "new_confidence_tier",
      reasons: ["new_backend_reason"],
      risk_tier: "new_risk_tier",
    }),
    copy,
  );

  const rendered = [
    model.badgeLabel,
    model.headline,
    model.body,
    model.meter.currentLabel,
    ...model.metrics.map((metric) => metric.value),
    ...model.reasonTags,
  ].join(" ");

  assert.equal(model.badgeLabel, copy.action.actionLabels.unknown);
  assert.equal(model.meter.currentLabel, `현재 액션: ${copy.action.actionLabels.unknown} · 편향 ${copy.action.biasDirections.unknown}`);
  assert.equal(model.reasonTags[0], copy.action.reasonLabels.unmapped);
  assert.doesNotMatch(rendered, /new_backend|new confidence|new risk|future bias|편향 중립/i);
});

test("presents resolved strong-buy long-bias action summaries as the current meter state", () => {
  const copy = getSymbolDetailCopy("en");
  const model = buildActionSummarySectionModel(makeActionSummary(), copy);

  assert.equal(model.badgeLabel, "Strong Buy");
  assert.equal(model.headline, "Strong Buy · Confidence High");
  assert.equal(model.score, 94);
  assert.equal(model.meter.state, "resolved");
  assert.equal(model.meter.valueLabel, "94 / 100");
  assert.equal(model.meter.currentLabel, "Current action: Strong Buy · Bias Long");
  assert.match(model.meter.ariaLabel, /Signal score: 94 \/ 100/);
});

test("preserves a confirmed zero score as a resolved numeric score", () => {
  const copy = getSymbolDetailCopy("ko");
  const model = buildActionSummarySectionModel(
    makeActionSummary({
      action_label: "strong_buy",
      signal_score: 0,
      reasons: ["Trend support confirmed", "Volume expansion detected"],
    }),
    copy,
  );

  assert.equal(model.meter.state, "resolved");
  assert.equal(model.score, 0);
  assert.equal(model.meter.valueLabel, "0 / 100");
  assert.equal(model.meter.currentLabel, `현재 액션: 강한 매수 · 편향 롱`);
  assert.match(model.meter.ariaLabel, /시그널 점수: 0 \/ 100/);
});

test("keeps fundamentals-history empty-state outputs stable when no history is available", () => {
  const copy = getSymbolDetailCopy("en");
  const model = buildFundamentalsHistorySectionModel({
    companyHistory: null,
    copy,
    fundamentalsEntryLimit: 4,
    fundamentalsLoading: false,
    fsDiv: null,
    introTitle: "Samsung Electronics",
    latestFundamentals: null,
    latestHistoryEntry: null,
    symbol: "005930",
  });

  assert.equal(model.state, "empty");
  assert.equal(model.fsValue, copy.fundamentals.defaultFs);
  assert.equal(model.introInitial, "0");
  assert.equal(model.introTitle, "Samsung Electronics");
  assert.equal(
    model.introBody,
    `${copy.fundamentals.latestFilingPrefix} ${copy.fundamentals.noFilingLoaded}.`,
  );
  assert.equal(model.emptyTitle, copy.fundamentals.emptyTitle);
  assert.equal(model.emptyBody, copy.fundamentals.coverageMissing);
  assert.equal(model.highlights[0]?.label, copy.fundamentals.latestFiling);
  assert.equal(model.highlights[0]?.value, copy.fundamentals.noFilingLoaded);
});

test("fundamentals history never falls back to another company's first row", () => {
  const wrongCompany = { symbol: "000660", name: "SK hynix", entries: [] };
  const requestedCompany = { symbol: "005930", name: "Samsung Electronics", entries: [] };

  assert.equal(pickFundamentalsCompany({ companies: [wrongCompany] }, "005930"), null);
  assert.equal(
    pickFundamentalsCompany({ companies: [wrongCompany, requestedCompany] }, " 005930 "),
    requestedCompany,
  );
});

test("builds disclosure-coverage cards from a stable display model", () => {
  const copy = getSymbolDetailCopy("en");
  const latestDisclosure = {
    rcept_no: "202604100001",
    receipt_date: "2026-04-10",
    report_nm: "Annual report",
    corp_name: "Samsung Electronics",
    filing_category: "annual_report",
    fundamentals_capture_status: "captured",
  };
  const model = buildDisclosureCoverageSectionModel({
    copy,
    disclosureCount: 2,
    disclosureItemLimit: 4,
    latestDisclosure,
    recentDisclosures: [latestDisclosure],
    routeQueryString: "marketDate=2026-04-10",
    sectionState: "list",
    symbol: "005930",
  });

  assert.equal(model.state, "list");
  assert.equal(model.badgeTone, "info");
  assert.equal(model.badgeValue, `2 ${copy.disclosures.items}`);
  assert.equal(model.coverageTitle, copy.disclosures.latestDisclosureAvailable);
  assert.match(
    model.cards[0]?.href ?? "",
    /^\/dashboard\/symbol\/005930\/disclosure-coverage\/202604100001\?/,
  );
  assert.equal(model.cards[0]?.title, "Annual report");
  assert.equal(model.cards[0]?.dateLabel, "2026-04-10");
  assert.equal(
    model.cards[0]?.body,
    `Annual Report · ${copy.disclosures.capture} Captured`,
  );
  assert.equal(
    model.coverageBody,
    `2 ${copy.disclosures.loadedSuffix} ${copy.disclosures.latestFilingLandedOn} 2026-04-10.`,
  );
});

test("preserves My Symbols navigation context in symbol detail subroutes only when supplied", () => {
  const meta = {
    symbol: "005930",
    name_ko: "Samsung Electronics",
    market: "KOSPI",
    standard_code: "KR7005930003",
  };
  const searchQuery = new URLSearchParams(buildSymbolRouteQuery(meta, "2026-04-10", null, "search", "삼성"));
  const feedbackQuery = new URLSearchParams(
    buildSymbolRouteQuery(
      meta,
      "2026-05-06",
      null,
      "signal-decider-feedback",
      "한진",
      "wait",
      "captured",
      "signal-decider",
      "with-risk",
      "calendar",
      "signal-decider-feedback",
      "2026-08-03",
      "2",
      "feedback-row-12",
    ),
  );
  const mySymbolsQuery = new URLSearchParams(buildSymbolRouteQuery(meta, "2026-04-10", null, "my-symbols"));
  const piotroskiQuery = new URLSearchParams(buildSymbolRouteQuery(meta, "2026-05-08", null, "piotroski"));

  assert.equal(
    mySymbolsQuery.toString(),
    "name=Samsung+Electronics&market=KOSPI&standardCode=KR7005930003&marketDate=2026-04-10&navContext=my-symbols",
  );
  assert.equal(
    searchQuery.get("name"),
    "Samsung Electronics",
  );
  assert.equal(searchQuery.get("market"), "KOSPI");
  assert.equal(searchQuery.get("standardCode"), "KR7005930003");
  assert.equal(searchQuery.get("marketDate"), "2026-04-10");
  assert.equal(searchQuery.get("q"), "삼성");
  assert.equal(searchQuery.get("navContext"), "search");
  assert.equal(feedbackQuery.get("marketDate"), "2026-05-06");
  assert.equal(feedbackQuery.get("navContext"), "signal-decider-feedback");
  assert.equal(feedbackQuery.get("q"), "한진");
  assert.equal(feedbackQuery.get("feedbackAction"), "wait");
  assert.equal(feedbackQuery.get("agent"), "signal-decider");
  assert.equal(feedbackQuery.get("feedbackStatus"), "with-risk");
  assert.equal(feedbackQuery.get("feedbackSort"), "captured");
  assert.equal(feedbackQuery.get("feedbackNavContext"), "calendar");
  assert.equal(feedbackQuery.get("feedbackOriginDate"), "2026-08-03");
  assert.equal(feedbackQuery.get("feedbackRoute"), "signal-decider-feedback");
  assert.equal(feedbackQuery.get("feedbackPage"), "2");
  assert.equal(feedbackQuery.get("feedbackFocus"), "feedback-row-12");
  assert.equal(piotroskiQuery.get("marketDate"), "2026-05-08");
  assert.equal(piotroskiQuery.get("navContext"), "piotroski");
  assert.equal(
    buildSymbolRouteQuery(meta, "2026-04-10", null),
    "name=Samsung+Electronics&market=KOSPI&standardCode=KR7005930003&marketDate=2026-04-10",
  );
});

test("keeps the hero fundamentals metric in a loading state until aggregate context resolves", () => {
  const copy = getSymbolDetailCopy("en");
  const model = buildHeroFundamentalLatestMetricModel({
    aggregateContext: null,
    aggregateContextError: null,
    aggregateContextLoadState: "loading",
    copy,
    latestDisclosure: null,
    latestFundamentals: null,
  });

  assert.equal(model.value, copy.hero.priceLoading);
  assert.equal(model.detailDateLabel, null);
  assert.equal(model.errorLabel, null);
});

test("surfaces aggregate errors in the hero fundamentals metric after loading finishes without content", () => {
  const copy = getSymbolDetailCopy("en");
  const model = buildHeroFundamentalLatestMetricModel({
    aggregateContext: null,
    aggregateContextError: copy.errors.aggregateUnavailable,
    aggregateContextLoadState: "error",
    copy,
    latestDisclosure: null,
    latestFundamentals: null,
  });

  assert.equal(model.value, copy.disclosures.emptyTitle);
  assert.equal(model.detailDateLabel, null);
  assert.equal(model.errorLabel, copy.errors.aggregateUnavailable);
});

test("shows the Piotroski hero result only for the exact normalized symbol and requested market date", () => {
  const copy = getSymbolDetailCopy("en");
  const matchingResponse = makePiotroskiResponse({
    item: {
      ...makePiotroskiResponse().item!,
      symbol: " 005930 ",
      market_date: "2026-04-10T16:00:00+09:00",
    },
  });

  assert.deepEqual(
    buildHeroPiotroskiMetricModel({
      copy,
      piotroskiLoadState: "success",
      piotroskiResponse: matchingResponse,
      requestedMarketDate: "2026-04-10",
      requestedSymbol: "005930",
    }),
    { label: copy.common.pass, tone: "positive" },
  );

  const wrongSymbolResponse = makePiotroskiResponse({
    item: {
      ...makePiotroskiResponse().item!,
      symbol: "000660",
    },
  });
  assert.deepEqual(
    buildHeroPiotroskiMetricModel({
      copy,
      piotroskiLoadState: "success",
      piotroskiResponse: wrongSymbolResponse,
      requestedMarketDate: "2026-04-10",
      requestedSymbol: "005930",
    }),
    { label: copy.common.unavailable, tone: null },
  );

  const staleItemBehindCurrentRequestEcho = makePiotroskiResponse({
    item: {
      ...makePiotroskiResponse().item!,
      market_date: "2026-04-09",
    },
  });
  assert.deepEqual(
    buildHeroPiotroskiMetricModel({
      copy,
      piotroskiLoadState: "success",
      piotroskiResponse: staleItemBehindCurrentRequestEcho,
      requestedMarketDate: "2026-04-10",
      requestedSymbol: "005930",
    }),
    { label: copy.common.unavailable, tone: null },
  );
});

test("accepts a Piotroski hero latest fallback only when requested, resolved, and item dates prove it", () => {
  const copy = getSymbolDetailCopy("en");
  const provenFallback = makePiotroskiResponse({
    market_date: "2026-04-09",
    requested_market_date: "2026-04-10",
    resolved_market_date: "2026-04-09",
    is_latest_fallback: true,
    item: {
      ...makePiotroskiResponse().item!,
      market_date: "2026-04-09",
    },
  });

  assert.deepEqual(
    buildHeroPiotroskiMetricModel({
      copy,
      piotroskiLoadState: "success",
      piotroskiResponse: provenFallback,
      requestedMarketDate: "2026-04-10",
      requestedSymbol: "005930",
    }),
    { label: copy.common.pass, tone: "positive" },
  );

  assert.deepEqual(
    buildHeroPiotroskiMetricModel({
      copy,
      piotroskiLoadState: "success",
      piotroskiResponse: {
        ...provenFallback,
        resolved_market_date: "2026-04-10",
      },
      requestedMarketDate: "2026-04-10",
      requestedSymbol: "005930",
    }),
    { label: copy.common.unavailable, tone: null },
  );
});

test("keeps the selected price-bar trade date stable across refreshed history arrays", () => {
  assert.equal(
    pickSelectedBarTradeDate(
      [
        {
          trade_date: "2026-04-17",
          open_price: 100,
          high_price: 105,
          low_price: 99,
          close_price: 102,
          volume: 1,
          turnover: 10,
          source: "stored",
          captured_at: null,
        },
        {
          trade_date: "2026-04-18",
          open_price: 102,
          high_price: 108,
          low_price: 101,
          close_price: 107,
          volume: 2,
          turnover: 20,
          source: "stored",
          captured_at: null,
        },
      ],
      null,
    ),
    "2026-04-18",
  );
  assert.equal(
    pickSelectedBarTradeDate(
      [
        {
          trade_date: "2026-04-17",
          open_price: 101,
          high_price: 106,
          low_price: 100,
          close_price: 103,
          volume: 3,
          turnover: 30,
          source: "stored",
          captured_at: null,
        },
        {
          trade_date: "2026-04-18",
          open_price: 103,
          high_price: 109,
          low_price: 102,
          close_price: 108,
          volume: 4,
          turnover: 40,
          source: "stored",
          captured_at: null,
        },
      ],
      "2026-04-17",
    ),
    "2026-04-17",
  );
  assert.equal(
    pickSelectedBarTradeDate(
      [
        {
          trade_date: "2026-04-17",
          open_price: 101,
          high_price: 106,
          low_price: 100,
          close_price: 103,
          volume: 3,
          turnover: 30,
          source: "stored",
          captured_at: null,
        },
        {
          trade_date: "2026-04-18",
          open_price: 103,
          high_price: 109,
          low_price: 102,
          close_price: 108,
          volume: 4,
          turnover: 40,
          source: "stored",
          captured_at: null,
        },
      ],
      "2026-04-01",
    ),
    "2026-04-18",
  );
});

test("guards denominator-based percent change calculations against impossible price inputs", () => {
  assert.equal(buildPercentChange(110, 100), 10);
  assert.equal(buildPercentChange(110, 0), null);
  assert.equal(buildPercentChange(110, -100), null);
  assert.equal(buildPercentChange(110, Number.NaN), null);
  assert.equal(buildPercentChange(Number.POSITIVE_INFINITY, 100), null);
});

test("builds price-history return metrics only when denominator and history inputs are valid", () => {
  assert.equal(
    buildPriceHistoryRangeMetrics({
      symbol: "005930",
      count: 1,
      end_date: "2026-04-30",
      items: [
        {
          trade_date: "2026-04-30",
          open_price: 0,
          high_price: 220500,
          low_price: 220500,
          close_price: 220500,
          volume: 100,
          turnover: 1000000,
          source: "stored",
          captured_at: "2026-04-30T00:00:00+09:00",
        },
      ],
      requested_start_date: null,
      requested_end_date: null,
      start_date: "2026-04-30",
    }),
    null,
  );

  assert.equal(
    buildPriceHistoryRangeMetrics({
      symbol: "005930",
      count: 2,
      end_date: "2026-04-30",
      items: [
        {
          trade_date: "2026-04-29",
          open_price: 100,
          high_price: 110,
          low_price: 95,
          close_price: 105,
          volume: 10,
          turnover: 1000,
          source: "stored",
          captured_at: "2026-04-29T00:00:00+09:00",
        },
        {
          trade_date: "2026-04-30",
          open_price: 102,
          high_price: 112,
          low_price: 99,
          close_price: 110,
          volume: 20,
          turnover: 2000,
          source: "stored",
          captured_at: "2026-04-30T00:00:00+09:00",
        },
      ],
      requested_start_date: "2026-04-29",
      requested_end_date: "2026-04-30",
      start_date: "2026-04-29",
    })?.returnPercent,
    10,
  );
});

test("marks partial chart basis in quote-source labels for daily price-bar fallback history anomalies", () => {
  const copy = getSymbolDetailCopy("en");
  const quote: QuoteResponse = {
    symbol: "005930",
    price: 220500,
    change: null,
    change_pct: null,
    volume: null,
    turnover: null,
    market_state: "CLOSED",
    source: "daily_price_bar",
    fallback: true,
    is_live: false,
    available: true,
    trade_date: "2026-04-30",
  };

  assert.equal(
    buildQuoteSourceLabel(quote, copy, { isPriceHistoryBasisInvalid: true }),
    `${copy.chart.latestPriceUpdate} : 2026-04-30 · ${copy.chart.returnUnavailable}`,
  );
});

test("localizes quote unavailable reasons before rendering symbol-detail copy", () => {
  const enCopy = getSymbolDetailCopy("en");
  const koCopy = getSymbolDetailCopy("ko");
  const quote = makeQuote({
    price: null,
    change: null,
    change_pct: null,
    volume: null,
    turnover: null,
    available: false,
    is_live: false,
    fallback: true,
    source: "daily_price_bar",
    unavailable_reason: "no_live_quote_or_fresh_fallback",
  });

  assert.equal(formatQuoteUnavailableReasonLabel(quote.unavailable_reason, enCopy), enCopy.hero.awaitingQuoteSource);
  assert.equal(formatQuoteUnavailableReasonLabel(quote.unavailable_reason, koCopy), koCopy.hero.awaitingQuoteSource);
  assert.equal(
    buildQuoteSourceLabel(quote, enCopy),
    `${enCopy.freshness.quoteCoverageUnavailable} ${enCopy.hero.awaitingQuoteSource}.`,
  );
  assert.equal(
    buildQuoteSourceLabel(quote, koCopy),
    `${koCopy.freshness.quoteCoverageUnavailable} ${koCopy.hero.awaitingQuoteSource}.`,
  );
  assert.doesNotMatch(buildQuoteSourceLabel(quote, koCopy), /no_live_quote_or_fresh_fallback/);

  assert.equal(
    formatQuoteUnavailableReasonLabel("Quote cache waiting for confirmation", enCopy),
    "Quote cache waiting for confirmation",
  );
  assert.equal(
    formatQuoteUnavailableReasonLabel("Quote cache waiting for confirmation", koCopy),
    koCopy.hero.awaitingQuoteSource,
  );
});

test("localizes empty technical unavailable state in Korean without backend debug tokens", () => {
  const copy = getSymbolDetailCopy("ko");
  const model = buildTechnicalAnalysisSectionModel(null, null, copy);
  const rendered = [
    model.badgeLabel,
    model.headline,
    model.body,
    model.metaCaption,
    ...model.metrics.map((metric) => metric.value),
    ...model.payloadTags,
  ].join(" ");

  assert.equal(model.badgeLabel, copy.technical.unavailable);
  assert.equal(model.metrics.find((metric) => metric.key === "volume-ratio-20d")?.value, copy.technical.unavailable);
  assert.equal(model.metrics.find((metric) => metric.key === "atr-14")?.value, copy.technical.unavailable);
  assert.deepEqual(model.payloadTags, [copy.technical.noPayloadKeys]);
  assert.equal(model.metaCaption, `${copy.technical.noSourceDate} · ${copy.technical.freshnessNote}`);
  assert.doesNotMatch(rendered, /Unavailable|No payload keys|소스 날짜 소스 날짜 없음|no_live_quote_or_fresh_fallback/);
});

test("keeps symbol-detail freshness date fallback precedence stable", () => {
  const copy = getSymbolDetailCopy("en");

  assert.equal(
    buildLatestPriceLabel(
      {
        latest: {
          price_trade_date: "2026-04-18",
        },
      },
      {
        symbol: "005930",
        company_name: "Samsung Electronics",
        price: 100,
        change: 1,
        change_pct: 1,
        volume: 1,
        turnover: 1,
        market_state: "CLOSED",
        source: "db_cache",
        fallback: true,
        is_live: false,
        available: true,
        trade_date: "2026-04-17",
        cached_at: "2026-04-18T12:00:00+09:00",
      },
      copy,
    ),
    "2026-04-18",
  );
  assert.equal(
    buildLatestPriceLabel(
      null,
      {
        symbol: "005930",
        company_name: "Samsung Electronics",
        price: 100,
        change: 1,
        change_pct: 1,
        volume: 1,
        turnover: 1,
        market_state: "CLOSED",
        source: "db_cache",
        fallback: true,
        is_live: false,
        available: true,
        trade_date: null,
        cached_at: null,
      },
      copy,
    ),
    copy.hero.quotePending,
  );
  assert.equal(
    buildTechnicalFreshnessDate(
      {
        symbol: "005930",
        market_date: "2026-04-21",
        close_price: 70000,
        volume: 100,
        trend_state: "uptrend",
        ma_alignment: "bullish_stack",
        breakout_20d: false,
        breakdown_20d: false,
        source: "stored",
        return_5d: null,
        return_20d: null,
        volume_ratio_20d: null,
        atr_14: null,
        atr_pct_14: null,
        signal_payload: {},
        captured_at: null,
      },
      {
        technical: {
          latest_date: "2026-04-18",
          success: true,
        },
        latest: {
          technical_market_date: "2026-04-17",
        },
      },
    ),
    "2026-04-21",
  );
  assert.equal(
    buildActionFreshnessDate(
      null,
      {
        latest: {
          action_market_date: "2026-04-18",
        },
      },
    ),
    "2026-04-18",
  );
});

test("keeps symbol-detail freshness tone and module-tone mapping stable", () => {
  assert.equal(buildFreshnessTone("completed"), "positive");
  assert.equal(buildFreshnessTone("completed_with_errors"), "warning");
  assert.equal(buildFreshnessTone("running"), "info");
  assert.equal(buildFreshnessTone("pending"), "neutral");
  assert.equal(buildFreshnessTone(null), "warning");
  assert.equal(buildModuleStatusTone(true), "positive");
  assert.equal(buildModuleStatusTone(false, "info"), "info");
});

test("keeps system-freshness fallback rows stable when quote and disclosure coverage are unavailable", () => {
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
  const disclosureRow = model.moduleRows.find((row) => row.id === "disclosures");

  assert.equal(model.statusLabel, "Running");
  assert.equal(model.tone, "info");
  assert.equal(priceRow?.date, "2026-04-18");
  assert.equal(priceRow?.detail, "Quote cache waiting for confirmation");
  assert.equal(priceRow?.status, copy.freshness.unavailable);
  assert.equal(disclosureRow?.date, copy.freshness.unavailable);
  assert.equal(disclosureRow?.status, copy.freshness.unavailable);
  assert.equal(disclosureRow?.detail, copy.disclosures.emptyTitle);
});
