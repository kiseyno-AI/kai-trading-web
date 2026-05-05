import assert from "node:assert/strict";
import test from "node:test";

import { getSymbolDetailCopy } from "@/i18n/symbol-detail-copy";
import type { AgentContextActionSummaryDto } from "@/types/trading-api";
import type { QuoteResponse } from "./symbol-detail-types";

import {
  buildActionSummarySectionModel,
  buildActionFreshnessDate,
  buildDisclosureCoverageSectionModel,
  buildPercentChange,
  buildFreshnessTone,
  buildFundamentalsHistorySectionModel,
  buildHeroFundamentalLatestMetricModel,
  buildLatestPriceLabel,
  buildModuleStatusTone,
  buildPriceHistoryRangeMetrics,
  buildQuoteSourceLabel,
  buildSymbolRouteQuery,
  buildSystemFreshnessSectionModel,
  buildTechnicalFreshnessDate,
  pickSelectedBarTradeDate,
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

test("keeps action-summary fallback labels stable when no summary is available", () => {
  const copy = getSymbolDetailCopy("en");
  const model = buildActionSummarySectionModel(null, copy);

  assert.equal(model.badgeLabel, copy.action.unavailable);
  assert.equal(model.headline, copy.action.emptyHeadline);
  assert.equal(model.body, copy.action.emptyBody);
  assert.equal(model.metaCaption, `${copy.action.payloadKeys}: No payload keys`);
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

  assert.equal(
    buildSymbolRouteQuery(meta, "2026-04-10", null, "my-symbols"),
    "name=Samsung+Electronics&market=KOSPI&standardCode=KR7005930003&marketDate=2026-04-10&navContext=my-symbols",
  );
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
