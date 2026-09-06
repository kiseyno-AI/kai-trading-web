import {
  SYMBOL_DETAIL_FEEDBACK_ACTION_PARAM,
  SYMBOL_DETAIL_FEEDBACK_RETURN_NAV_CONTEXT_PARAM,
  SYMBOL_DETAIL_FEEDBACK_RETURN_ORIGIN_DATE_PARAM,
  SYMBOL_DETAIL_FEEDBACK_RETURN_ROUTE_PARAM,
  SYMBOL_DETAIL_FEEDBACK_SORT_PARAM,
  SYMBOL_DETAIL_NAV_CONTEXT_PARAM,
  SYMBOL_DETAIL_SEARCH_QUERY_PARAM,
  type AggregateContextLoadState,
  type DisclosureSectionState,
  type SymbolDetailFeedbackReturnRoute,
  type SymbolDetailMode,
  type SymbolDetailNavContext,
} from "@/app/dashboard/symbol/[symbol]/symbol-detail-state";
import type { SymbolDetailCopy } from "@/i18n/symbol-detail-copy";
import {
  getLatestActionMarketDate,
  getLatestPriceTradeDate,
  getLatestTechnicalMarketDate,
} from "@/lib/eod-freshness-latest";
import { formatDisplayTimestamp, formatPrice, formatTurnover } from "@/lib/format";
import { DECIDER_FEEDBACK_FOCUS_PARAM, DECIDER_FEEDBACK_PAGE_PARAM } from "@/lib/signal-decider-feedback";
import {
  clampMarketDateToProductDate,
  getCurrentProductMarketDate,
  isWeekendProductMarketDate,
  normalizeProductMarketDate,
} from "@/lib/product-market-date";
import {
  getPresenterAvailabilityTone,
  getPresenterFreshnessTone,
  resolvePresenterDate,
} from "@/lib/stage-date-status-presenter";
import { getForwardableSymbolMetaSeedValue } from "@/lib/symbol-meta";
import type {
  AgentContextActionSummaryDto,
  AgentContextDisclosureDto,
  AgentContextFundamentalsSummaryDto,
  AgentContextItemDto,
  AgentContextTechnicalSnapshotDto,
  DartFundamentalsHistoryCompanyDto,
  DartFundamentalsHistoryEntryDto,
  DartFundamentalsHistoryMetricDto,
  EodFreshnessResponseDto,
  EodPiotroskiFilterResultItemDto,
  Locale,
  SymbolPriceBarDto,
  SymbolPriceBarsResponseDto,
} from "@/types/trading-api";

import type {
  MarketStatusItem,
  MarketStatusResponse,
  PriceHistoryRange,
  QuoteResponse,
  SymbolSearchItem,
} from "./symbol-detail-types";

export type LocalizedSymbolDetailMode = {
  label: string;
  eyebrow: string;
  title: string;
};

export type MarketStateRow = {
  market: string;
  state: string;
  stateCode: string | null;
  isReady: boolean;
};

export type FocusCandleRow = {
  label: string;
  value: string;
  valueClassName?: string;
};

export type SymbolPriceBarRangeMetric = {
  end: number;
  high: number;
  low: number;
  points: number;
  returnPercent: number;
  start: number;
  endDate: string;
  startDate: string;
};

export type PricePercentChangeResult = number | null;

export type HeroFundamentalLatestMetricModel = {
  value: string;
  detailDateLabel: string | null;
  errorLabel: string | null;
};

export type HeroPiotroskiMetricModel = {
  label: string;
  tone: "positive" | "negative" | null;
};

export type SectionMetricModel = {
  key: string;
  label: string;
  value: string;
};

export type ActionSummarySignalMeterModel = {
  ariaLabel: string;
  currentLabel: string;
  label: string;
  state: "resolved" | "unavailable";
  valueLabel: string;
};

export type ActionSummarySectionModel = {
  badgeLabel: string;
  body: string;
  headline: string;
  metaCaption: string;
  meter: ActionSummarySignalMeterModel;
  metrics: SectionMetricModel[];
  reasonTags: string[];
  score: number;
  tone: "positive" | "negative" | "info" | "neutral";
};

export type NormalizedActionSummaryState = {
  kind: "pending" | "unavailable" | "insufficient-history" | "resolved";
  sectionModel: ActionSummarySectionModel;
};

export type TechnicalAnalysisSectionModel = {
  badgeLabel: string;
  body: string;
  headline: string;
  metaCaption: string;
  metrics: SectionMetricModel[];
  tone: "positive" | "negative" | "info" | "warning";
  payloadTags: string[];
};

export type FundamentalsHistoryEntryModel = {
  badgeLabel: string;
  key: string;
  metrics: SectionMetricModel[];
  subtitle: string;
  title: string;
};

export type FundamentalsHistorySectionModel = {
  emptyBody: string | null;
  emptyTitle: string | null;
  entries: FundamentalsHistoryEntryModel[];
  fsTone: "positive" | "negative" | "info" | "warning";
  fsValue: string;
  highlights: SectionMetricModel[];
  introBody: string;
  introInitial: string;
  introTitle: string;
  state: "empty" | "list" | "loading";
};

export type DisclosureCoverageCardModel = {
  actionLabel: string;
  ariaLabel: string;
  body: string;
  dateLabel: string;
  href: string;
  key: string;
  receiptLabel: string;
  receiptNoLabel: string;
  title: string;
};

export type DisclosureCoverageSectionModel = {
  badgeTone: "info" | "neutral" | "warning";
  badgeValue: string;
  cards: DisclosureCoverageCardModel[];
  coverageBody: string;
  coverageTitle: string;
  emptyBody: string | null;
  emptyTitle: string | null;
  state: DisclosureSectionState;
};

export type FreshnessModuleRowModel = {
  api: string;
  date: string;
  detail: string;
  id: string;
  label: string;
  status: string;
  tone: "info" | "negative" | "neutral" | "positive" | "warning";
};

export type SystemFreshnessSectionModel = {
  metrics: SectionMetricModel[];
  moduleRows: FreshnessModuleRowModel[];
  statusLabel: string;
  tone: "positive" | "warning" | "info" | "neutral";
};

type SymbolDetailMarketDateBasisOptions = {
  copy: SymbolDetailCopy;
  currentMarketDate: string | null;
  effectiveMarketDate: string | null;
  hasExplicitMarketDate: boolean;
  marketState: string | null | undefined;
};

export function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number";
}

export function normalizeSymbolCode(value: string) {
  return value.trim().toUpperCase();
}

export function normalizeTrackedSymbols(symbols: string[]) {
  return Array.from(new Set(symbols.map(normalizeSymbolCode).filter(Boolean)));
}

export function readRouteParam(value: string | string[] | undefined) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return "";
}

export function formatSignedPercent(value: number | null | undefined, fallback = "Unavailable") {
  if (!hasNumber(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function buildPercentChange(nextValue: number, previousValue: number): PricePercentChangeResult {
  if (!Number.isFinite(nextValue) || !Number.isFinite(previousValue) || previousValue <= 0) {
    return null;
  }

  return ((nextValue - previousValue) / previousValue) * 100;
}

function isValidBarPrice(value: number): value is number {
  return Number.isFinite(value);
}

export function buildPriceHistoryRangeMetrics(
  priceHistory: SymbolPriceBarsResponseDto | null,
): SymbolPriceBarRangeMetric | null {
  if (!priceHistory || priceHistory.items.length < 2) {
    return null;
  }

  const first = priceHistory.items[0];
  const last = priceHistory.items[priceHistory.items.length - 1];
  const returnPercent = buildPercentChange(last.close_price, first.open_price);

  if (returnPercent === null || !isValidBarPrice(last.close_price) || !isValidBarPrice(first.open_price)) {
    return null;
  }

  let low = first.low_price;
  let high = first.high_price;

  for (const bar of priceHistory.items) {
    if (!isValidBarPrice(bar.low_price) || !isValidBarPrice(bar.high_price)) {
      return null;
    }
    if (bar.low_price < low) low = bar.low_price;
    if (bar.high_price > high) high = bar.high_price;
  }

  return {
    end: last.close_price,
    high,
    low,
    points: priceHistory.items.length,
    returnPercent,
    start: first.open_price,
    endDate: last.trade_date,
    startDate: first.trade_date,
  };
}

export function formatSignedNumber(
  value: number | null | undefined,
  fallback = "Unavailable",
  numberLocale = "en-US",
) {
  if (!hasNumber(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toLocaleString(numberLocale)}`;
}

export function formatCompactNumber(
  value: number | string | null | undefined,
  fallback = "Unavailable",
  numberLocale = "en-US",
) {
  if (typeof value === "number") {
    return new Intl.NumberFormat(numberLocale, {
      notation: "compact",
      compactDisplay: "short",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  return fallback;
}

export function formatQuantity(value: number | null | undefined, fallback = "Unavailable", numberLocale = "en-US") {
  return hasNumber(value) ? value.toLocaleString(numberLocale) : fallback;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function buildFocusTurnoverValue(
  focusBar:
    | (Pick<SymbolPriceBarDto, "turnover"> & {
        volume?: number | null;
      })
    | null,
  copy: SymbolDetailCopy,
) {
  if (!focusBar) return copy.common.unavailable;
  const { turnover, volume } = focusBar;
  if (!isFiniteNumber(turnover) || turnover < 0) return copy.chart.turnoverCheckNeeded;
  if (turnover > 0) return formatTurnover(turnover, "₩", copy.common.unavailable);
  return volume === 0 ? formatTurnover(0, "₩", copy.common.unavailable) : copy.chart.turnoverCheckNeeded;
}

export function formatNumberOrDash(value: number | null | undefined, fallback = "Unavailable") {
  return hasNumber(value) ? value.toFixed(2) : fallback;
}

export function humanizeToken(value: string | null | undefined, fallback = "Unavailable") {
  if (!value) return fallback;
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const MACHINE_UNAVAILABLE_REASON_PATTERN = /^[a-z0-9]+(?:[_-][a-z0-9]+)+$/i;
const QUOTE_UNAVAILABLE_REASON_LABELS: Record<string, (copy: SymbolDetailCopy) => string> = {
  no_live_quote_or_fresh_fallback: (copy) => copy.hero.awaitingQuoteSource,
};

function withTerminalPeriod(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return /[.!?。]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function shouldExposeBackendUnavailableReason(value: string, copy: SymbolDetailCopy) {
  if (MACHINE_UNAVAILABLE_REASON_PATTERN.test(value)) return false;

  return copy.common.unavailable === "Unavailable";
}

export function formatQuoteUnavailableReasonLabel(
  unavailableReason: string | null | undefined,
  copy: SymbolDetailCopy,
  fallback = copy.hero.awaitingQuoteSource,
) {
  const normalizedReason = unavailableReason?.trim();
  if (!normalizedReason) return fallback;

  const mappedReason = QUOTE_UNAVAILABLE_REASON_LABELS[normalizedReason.toLowerCase()];
  if (mappedReason) return mappedReason(copy);

  return shouldExposeBackendUnavailableReason(normalizedReason, copy) ? normalizedReason : fallback;
}

function isDisplayableHighlightValue(value: unknown): value is DartFundamentalsHistoryMetricDto["value"] {
  return typeof value === "number" || typeof value === "string" || value === null;
}

function normalizeHighlightMetric(
  value: unknown,
  fallbackKey: string | null,
  index: number,
): DartFundamentalsHistoryMetricDto | null {
  if (typeof value === "number" || typeof value === "string" || value === null) {
    return {
      metric_key: fallbackKey,
      label: fallbackKey ? humanizeToken(fallbackKey, `Metric ${index + 1}`) : null,
      value,
    };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const metric = value as Record<string, unknown>;
  const metricKey = typeof metric.metric_key === "string" ? metric.metric_key : fallbackKey;
  const label =
    typeof metric.label === "string"
      ? metric.label
      : metricKey
        ? humanizeToken(metricKey, `Metric ${index + 1}`)
        : null;

  return {
    metric_key: metricKey,
    label,
    value: isDisplayableHighlightValue(metric.value) ? metric.value : null,
  };
}

export function normalizeHighlightMetrics(highlights: unknown) {
  if (Array.isArray(highlights)) {
    return highlights
      .map((metric, index) => normalizeHighlightMetric(metric, null, index))
      .filter((metric): metric is DartFundamentalsHistoryMetricDto => metric !== null);
  }

  if (!highlights || typeof highlights !== "object") {
    return [];
  }

  const highlightRecord = highlights as Record<string, unknown>;
  if ("value" in highlightRecord || "label" in highlightRecord || "metric_key" in highlightRecord) {
    const metric = normalizeHighlightMetric(highlightRecord, null, 0);
    return metric ? [metric] : [];
  }

  return Object.entries(highlightRecord)
    .map(([key, value], index) => normalizeHighlightMetric(value, key, index))
    .filter((metric): metric is DartFundamentalsHistoryMetricDto => metric !== null);
}

export function getCurrentSeoulMarketDate(now = new Date()) {
  return getCurrentProductMarketDate(now);
}

function normalizeIsoDate(value: unknown) {
  const normalized = normalizeProductMarketDate(value);
  if (typeof value !== "string" || !normalized) return null;
  return value.trim() === normalized ? normalized : null;
}

function readIsoDatePrefix(value: unknown) {
  if (typeof value !== "string") return null;
  return normalizeIsoDate(value.slice(0, 10));
}

function readFreshnessRecordDate(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  return (
    normalizeIsoDate(record.trade_date) ??
    normalizeIsoDate(record.market_date) ??
    normalizeIsoDate(record.latest_date) ??
    readIsoDatePrefix(record.completed_at) ??
    readIsoDatePrefix(record.updated_at) ??
    readIsoDatePrefix(record.last_updated_at)
  );
}

function pickFirstIsoDate(values: unknown[]) {
  for (const value of values) {
    const normalized = normalizeIsoDate(value);
    if (normalized) return normalized;
  }

  return null;
}

export function resolveSymbolDetailLatestStoredMarketDate(freshness: EodFreshnessResponseDto | null) {
  const latest = freshness?.latest;
  const latestStages = latest?.stage_details ?? latest?.stageDetails ?? latest?.stages ?? null;

  const priceBasis = pickFirstIsoDate([
    getLatestPriceTradeDate(freshness),
    freshness?.price?.latest_date,
    latest?.price_trade_date,
    readFreshnessRecordDate(latest?.price),
    readFreshnessRecordDate(latestStages?.price),
    readFreshnessRecordDate(latestStages?.price_collection),
  ]);

  if (priceBasis) {
    return priceBasis;
  }

  return pickFirstIsoDate([
    getLatestTechnicalMarketDate(freshness),
    freshness?.technical?.latest_date,
    latest?.technical_market_date,
    readFreshnessRecordDate(latest?.technical),
    readFreshnessRecordDate(latest?.technical_analysis),
    readFreshnessRecordDate(latestStages?.technical),
    readFreshnessRecordDate(latestStages?.technical_analysis),
    readFreshnessRecordDate(latestStages?.technical_snapshots),
    getLatestActionMarketDate(freshness),
    freshness?.action?.latest_date,
    latest?.action_market_date,
    readFreshnessRecordDate(latest?.action),
    readFreshnessRecordDate(latest?.action_summary),
    readFreshnessRecordDate(latestStages?.action),
    readFreshnessRecordDate(latestStages?.action_summary),
    readFreshnessRecordDate(latestStages?.action_summaries),
    latest?.trade_date,
    latest?.market_date,
    latest?.latest_date,
  ]);
}

export function resolveSymbolDetailCurrentMarketDate(
  freshness: EodFreshnessResponseDto | null,
  marketStatus: MarketStatusResponse | null,
  defaultMarketDate: string,
) {
  return (
    normalizeIsoDate(defaultMarketDate) ??
    normalizeIsoDate(freshness?.today?.trade_date) ??
    readIsoDatePrefix(marketStatus?.server_time) ??
    defaultMarketDate
  );
}

function isNonTradingStoredDateFallbackState(value: string | null | undefined) {
  const state = normalizeMarketCode(value);
  return state === "WEEKEND" || state === "HOLIDAY" || state === "MARKET_HOLIDAY";
}

function shouldUseLatestStoredMarketDate({
  latestStoredMarketDate,
  productMarketDate,
}: {
  latestStoredMarketDate: string;
  productMarketDate: string;
}) {
  return latestStoredMarketDate <= productMarketDate;
}

export function resolveSymbolDetailEffectiveMarketDate({
  defaultMarketDate,
  freshness,
  freshnessRequestFailed = false,
  marketState,
  quoteTradeDate,
  requestedMarketDate,
  waitForFreshness,
}: {
  defaultMarketDate: string;
  freshness: EodFreshnessResponseDto | null;
  freshnessRequestFailed?: boolean;
  marketState?: string | null;
  quoteTradeDate: string | null | undefined;
  requestedMarketDate: string | null;
  waitForFreshness: boolean;
}) {
  const explicitMarketDate = normalizeIsoDate(requestedMarketDate);
  if (explicitMarketDate) return explicitMarketDate;
  if (requestedMarketDate) return requestedMarketDate;

  const productIsoDate = normalizeIsoDate(defaultMarketDate);
  const productMarketDate = normalizeProductMarketDate(defaultMarketDate) ?? defaultMarketDate;
  const latestStoredMarketDate = resolveSymbolDetailLatestStoredMarketDate(freshness);
  if (
    latestStoredMarketDate &&
    shouldUseLatestStoredMarketDate({
      latestStoredMarketDate,
      productMarketDate,
    })
  ) {
    return latestStoredMarketDate;
  }
  if (waitForFreshness) return null;

  if (latestStoredMarketDate) {
    const boundedLatestStoredMarketDate = clampMarketDateToProductDate(latestStoredMarketDate, productMarketDate);
    if (boundedLatestStoredMarketDate === productMarketDate && latestStoredMarketDate > productMarketDate) {
      return boundedLatestStoredMarketDate;
    }

    return productIsoDate ?? defaultMarketDate;
  }

  const quoteMarketDate = clampMarketDateToProductDate(quoteTradeDate, productMarketDate);
  if (quoteMarketDate) return quoteMarketDate;

  if (
    freshnessRequestFailed &&
    (isWeekendProductMarketDate(productMarketDate) || isNonTradingStoredDateFallbackState(marketState))
  ) {
    return null;
  }

  return productIsoDate ?? defaultMarketDate;
}

export function buildSymbolDetailMarketDateBasisCopy({
  copy,
  currentMarketDate,
  effectiveMarketDate,
  hasExplicitMarketDate,
  marketState,
}: SymbolDetailMarketDateBasisOptions) {
  if (hasExplicitMarketDate || !currentMarketDate || !effectiveMarketDate || currentMarketDate === effectiveMarketDate) {
    return null;
  }

  const closedSuffix = isClosedSessionMarketState(marketState) ? ` ${copy.common.closedMarketSession}` : "";
  return `${copy.common.latestStoredBasis} ${effectiveMarketDate} · ${copy.common.currentMarketDate} ${currentMarketDate}${closedSuffix}`;
}

export function formatIsoDateLabel(value: string | null | undefined, fallback = "Date pending") {
  if (!value) return fallback;
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${year}.${month}.${day}`;
}

export function buildQuoteSourceLabel(
  quote: QuoteResponse | null,
  copy: SymbolDetailCopy,
  options?: { isPriceHistoryBasisInvalid?: boolean },
) {
  if (!quote) return copy.hero.quotePending;
  if (!quote.available) {
    const reasonLabel = formatQuoteUnavailableReasonLabel(quote.unavailable_reason, copy, "");
    if (!reasonLabel) return copy.freshness.quoteCoverageUnavailable;

    return `${withTerminalPeriod(copy.freshness.quoteCoverageUnavailable)} ${withTerminalPeriod(reasonLabel)}`;
  }
  if (quote.is_live) return copy.freshness.live;
  if (quote.source === "daily_price_bar") {
    if (options?.isPriceHistoryBasisInvalid) {
      const fallbackBasisLabel = copy.chart.returnUnavailable;
      return quote.trade_date
        ? `${copy.chart.latestPriceUpdate} : ${quote.trade_date} · ${fallbackBasisLabel}`
        : fallbackBasisLabel;
    }

    return quote.trade_date
      ? `최신 업데이트 : ${quote.trade_date}`
      : copy.freshness.dailyPriceBarFallbackPath;
  }
  if (quote.fallback) return `${quote.source} ${copy.freshness.fallbackPathSuffix}`;
  return `${quote.source} ${copy.freshness.quoteSourceSuffix}`;
}

function shiftIsoDate(isoDate: string, { months = 0, years = 0 }: { months?: number; years?: number }) {
  const parts = isoDate.split("-").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return isoDate;
  }

  const [year, month, day] = parts;
  const totalMonths = year * 12 + (month - 1) + years * 12 + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonthIndex = totalMonths - targetYear * 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfTargetMonth);

  return new Date(Date.UTC(targetYear, targetMonthIndex, clampedDay)).toISOString().slice(0, 10);
}

export function buildPriceHistoryQuery(range: PriceHistoryRange, marketDate: string) {
  const params = new URLSearchParams();
  params.set("end_date", marketDate);

  if (range === "3M") {
    params.set("start_date", shiftIsoDate(marketDate, { months: -3 }));
  } else if (range === "1Y") {
    params.set("start_date", shiftIsoDate(marketDate, { years: -1 }));
  } else if (range === "5Y") {
    params.set("start_date", shiftIsoDate(marketDate, { years: -5 }));
  } else {
    params.set("limit", "10000");
  }

  return params.toString();
}

export function pickSelectedBarTradeDate(items: SymbolPriceBarDto[], previousSelectedBarTradeDate: string | null) {
  if (items.length === 0) return null;
  if (!previousSelectedBarTradeDate) return items[items.length - 1]?.trade_date ?? null;

  return items.some((item) => item.trade_date === previousSelectedBarTradeDate)
    ? previousSelectedBarTradeDate
    : items[items.length - 1]?.trade_date ?? null;
}

export function findPriceBarByTradeDate(items: SymbolPriceBarDto[], tradeDate: string | null) {
  if (!tradeDate || items.length === 0) return null;
  return items.find((item) => item.trade_date === tradeDate) ?? null;
}

export function buildFundamentalsHistoryQuery(symbol: string, marketDate: string, fsDiv: string | null) {
  const params = new URLSearchParams();
  params.append("symbols", symbol);
  params.set("start_date", shiftIsoDate(marketDate, { years: -5 }));
  params.set("end_date", marketDate);
  if (fsDiv) {
    params.set("fs_div", fsDiv);
  }
  return params.toString();
}

export function buildSymbolRouteQuery(
  meta: SymbolSearchItem | null,
  marketDate: string | null,
  fsDiv: string | null,
  navContext: SymbolDetailNavContext | null = null,
  searchQuery: string | null = null,
  feedbackActionFilter: string | null = null,
  feedbackSortMode: string | null = null,
  feedbackAgent: string | null = null,
  feedbackStatusFilter: string | null = null,
  feedbackNavContext: string | null = null,
  feedbackReturnRoute: SymbolDetailFeedbackReturnRoute | null = null,
  feedbackOriginDate: string | null = null,
  feedbackPage: string | null = null,
  feedbackFocus: string | null = null,
) {
  const params = new URLSearchParams();
  const name = meta?.name_ko;
  const market = meta?.market;
  const standardCode = meta?.standard_code;
  const forwardableName = getForwardableSymbolMetaSeedValue(name);
  const forwardableMarket = getForwardableSymbolMetaSeedValue(market);
  const forwardableStandardCode = getForwardableSymbolMetaSeedValue(standardCode);

  if (forwardableName) {
    params.set("name", forwardableName);
  }

  if (forwardableMarket) {
    params.set("market", forwardableMarket);
  }

  if (forwardableStandardCode) {
    params.set("standardCode", forwardableStandardCode);
  }

  if (marketDate) {
    params.set("marketDate", marketDate);
  }

  if (fsDiv) {
    params.set("fsDiv", fsDiv);
  }

  if (navContext) {
    params.set(SYMBOL_DETAIL_NAV_CONTEXT_PARAM, navContext);
  }

  if (searchQuery) {
    params.set(SYMBOL_DETAIL_SEARCH_QUERY_PARAM, searchQuery);
  }

  if (feedbackActionFilter) {
    params.set(SYMBOL_DETAIL_FEEDBACK_ACTION_PARAM, feedbackActionFilter);
  }

  if (feedbackAgent) {
    params.set("agent", feedbackAgent);
  }

  if (feedbackStatusFilter) {
    params.set("feedbackStatus", feedbackStatusFilter);
  }

  if (feedbackSortMode) {
    params.set(SYMBOL_DETAIL_FEEDBACK_SORT_PARAM, feedbackSortMode);
  }

  if (feedbackNavContext) {
    params.set(SYMBOL_DETAIL_FEEDBACK_RETURN_NAV_CONTEXT_PARAM, feedbackNavContext);
  }

  if (feedbackOriginDate) {
    params.set(SYMBOL_DETAIL_FEEDBACK_RETURN_ORIGIN_DATE_PARAM, feedbackOriginDate);
  }

  if (feedbackReturnRoute) {
    params.set(SYMBOL_DETAIL_FEEDBACK_RETURN_ROUTE_PARAM, feedbackReturnRoute);
  }

  if (feedbackPage) {
    params.set(DECIDER_FEEDBACK_PAGE_PARAM, feedbackPage);
  }

  if (feedbackFocus) {
    params.set(DECIDER_FEEDBACK_FOCUS_PARAM, feedbackFocus);
  }

  return params.toString();
}

export function buildDisclosureReportHref(
  symbol: string,
  disclosure: AgentContextDisclosureDto,
  queryString: string,
) {
  const params = new URLSearchParams(queryString);
  params.set("reportName", disclosure.report_nm);
  params.set("corpName", disclosure.corp_name);

  if (disclosure.receipt_date) {
    params.set("receiptDate", disclosure.receipt_date);
  }

  if (disclosure.filing_category) {
    params.set("filingCategory", humanizeToken(disclosure.filing_category));
  }

  if (disclosure.fundamentals_capture_status) {
    params.set("captureStatus", humanizeToken(disclosure.fundamentals_capture_status));
  }

  const path = `/dashboard/symbol/${encodeURIComponent(symbol)}/disclosure-coverage/${encodeURIComponent(disclosure.rcept_no)}`;
  const nextQueryString = params.toString();
  return nextQueryString ? `${path}?${nextQueryString}` : path;
}

export function buildLatestDisclosure(disclosures: AgentContextDisclosureDto[]) {
  return disclosures[0] ?? null;
}

export function buildHeroFundamentalLatestMetricModel({
  aggregateContext,
  aggregateContextError,
  aggregateContextLoadState,
  copy,
  latestDisclosure,
  latestFundamentals,
}: {
  aggregateContext: AgentContextItemDto | null;
  aggregateContextError: string | null;
  aggregateContextLoadState: AggregateContextLoadState;
  copy: SymbolDetailCopy;
  latestDisclosure: AgentContextDisclosureDto | null;
  latestFundamentals: AgentContextFundamentalsSummaryDto["latest_snapshot"] | null;
}): HeroFundamentalLatestMetricModel {
  const value =
    latestDisclosure?.report_nm ??
    (latestFundamentals
      ? buildFundamentalsLatestLabel(null, latestFundamentals, copy)
      : aggregateContextLoadState === "loading"
        ? copy.hero.priceLoading
        : copy.disclosures.emptyTitle);
  const detailDate = latestDisclosure?.receipt_date ?? buildFundamentalsDate(null, latestFundamentals, aggregateContext);

  return {
    value,
    detailDateLabel: detailDate ? formatIsoDateLabel(detailDate) : null,
    errorLabel: detailDate ? null : aggregateContextError,
  };
}

export function buildHeroPiotroskiMetricModel({
  copy,
  piotroskiLoadState,
  piotroskiResult,
}: {
  copy: SymbolDetailCopy;
  piotroskiLoadState: AggregateContextLoadState;
  piotroskiResult: EodPiotroskiFilterResultItemDto | null;
}): HeroPiotroskiMetricModel {
  return {
    label: getPiotroskiLabel(piotroskiResult, piotroskiLoadState, copy),
    tone: piotroskiResult ? (piotroskiResult.passed_filter ? "positive" : "negative") : null,
  };
}

export function buildActionTone(actionSummary: AgentContextActionSummaryDto | null): ActionSummarySectionModel["tone"] {
  if (!actionSummary) return "neutral";
  if (isInsufficientHistoryActionSummary(actionSummary)) return "info";
  if (actionSummary.bias_direction === "long") return "positive";
  if (actionSummary.bias_direction === "short") return "negative";
  return "info";
}

export function buildTechnicalTone(
  technicalSnapshot: AgentContextTechnicalSnapshotDto | null,
): TechnicalAnalysisSectionModel["tone"] {
  if (!technicalSnapshot) return "warning";
  if (technicalSnapshot.trend_state === "uptrend") return "positive";
  if (technicalSnapshot.trend_state === "downtrend") return "negative";
  return "info";
}

export function buildFreshnessTone(status: string | null | undefined): SystemFreshnessSectionModel["tone"] {
  return getPresenterFreshnessTone(status);
}

export function buildModuleStatusTone(
  available: boolean,
  fallbackTone: FreshnessModuleRowModel["tone"] = "warning",
): FreshnessModuleRowModel["tone"] {
  return getPresenterAvailabilityTone(available, fallbackTone);
}

export function buildConfidenceTone(
  value: string | null | undefined,
): FundamentalsHistorySectionModel["fsTone"] {
  if (!value) return "warning";
  if (value === "high" || value === "premium") return "positive";
  if (value === "low") return "negative";
  return "info";
}

export function buildInsightTags(payload: Record<string, unknown> | null | undefined, emptyLabel = "No payload keys") {
  const keys = payload ? Object.keys(payload) : [];
  if (keys.length === 0) {
    return [emptyLabel];
  }

  return keys.slice(0, 4).map((key) => humanizeToken(key, key));
}

function buildTechnicalSourceDateCaption(
  technicalFreshnessDate: string | null,
  copy: SymbolDetailCopy,
) {
  const sourceDateLabel = technicalFreshnessDate
    ? `${copy.technical.sourceDate} ${technicalFreshnessDate}`
    : copy.technical.noSourceDate;

  return `${sourceDateLabel} · ${copy.technical.freshnessNote}`;
}

export function formatHighlightLabel(metric: DartFundamentalsHistoryMetricDto, index: number) {
  return metric.label ?? metric.metric_key ?? `Metric ${index + 1}`;
}

export function formatHighlightValue(metric: DartFundamentalsHistoryMetricDto, copy: SymbolDetailCopy) {
  return formatCompactNumber(metric.value, copy.fundamentals.notReported);
}

export function pickFundamentalsCompany(
  fundamentalsHistory: { companies: DartFundamentalsHistoryCompanyDto[] } | null,
  symbol: string,
) {
  if (!fundamentalsHistory) return null;
  return fundamentalsHistory.companies.find((company) => company.symbol === symbol) ?? fundamentalsHistory.companies[0] ?? null;
}

export function buildTechnicalFreshnessDate(
  technicalSnapshot: AgentContextTechnicalSnapshotDto | null,
  freshness: EodFreshnessResponseDto | null,
) {
  return resolvePresenterDate(
    technicalSnapshot?.market_date,
    freshness?.technical?.latest_date,
    getLatestTechnicalMarketDate(freshness),
    freshness?.latest?.technical_market_date,
  );
}

export function buildActionFreshnessDate(
  actionSummary: AgentContextActionSummaryDto | null,
  freshness: EodFreshnessResponseDto | null,
) {
  return resolvePresenterDate(
    actionSummary?.market_date,
    freshness?.action?.latest_date,
    getLatestActionMarketDate(freshness),
    freshness?.latest?.action_market_date,
  );
}

function clampSignalScore(score: number | null | undefined) {
  return Number.isFinite(score) ? Math.max(0, Math.min(score ?? 0, 100)) : 0;
}

function formatSignalScore(score: number) {
  const roundedScore = Math.round(score * 10) / 10;
  return Number.isInteger(roundedScore) ? String(roundedScore) : roundedScore.toFixed(1);
}

function normalizeActionToken(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase() : null;
}

function shouldExposeBackendActionTokenFallback(copy: SymbolDetailCopy) {
  return copy.common.unavailable === "Unavailable";
}

function resolveActionCopyToken<T extends Record<string, string>>(
  value: string | null | undefined,
  labels: T,
  fallback: string,
  unknownFallback?: string,
) {
  const normalized = normalizeActionToken(value);
  if (!normalized) return fallback;

  const directMatch = labels[normalized as keyof T];
  if (directMatch) return directMatch;

  const camelCased = normalized
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
  const camelMatch = labels[camelCased as keyof T];
  if (camelMatch) return camelMatch;

  return unknownFallback ?? humanizeToken(normalized);
}

function resolveActionSummaryActionLabel(value: string | null | undefined, copy: SymbolDetailCopy) {
  return resolveActionCopyToken(
    value,
    copy.action.actionLabels,
    copy.action.actionLabels.noAction,
    shouldExposeBackendActionTokenFallback(copy) ? undefined : copy.action.actionLabels.unknown,
  );
}

function resolveActionConfidenceLabel(value: string | null | undefined, copy: SymbolDetailCopy) {
  const normalized = normalizeActionToken(value);
  if (!normalized) return copy.action.confidenceLevels.unavailable;
  return copy.action.confidenceLevels[normalized as keyof typeof copy.action.confidenceLevels] ??
    (shouldExposeBackendActionTokenFallback(copy)
      ? humanizeToken(normalized)
      : copy.action.confidenceLevels.unknown);
}

function resolveActionRiskLabel(value: string | null | undefined, copy: SymbolDetailCopy) {
  const normalized = normalizeActionToken(value);
  if (!normalized) return copy.action.riskLevels.unavailable;
  return copy.action.riskLevels[normalized as keyof typeof copy.action.riskLevels] ??
    (shouldExposeBackendActionTokenFallback(copy) ? humanizeToken(normalized) : copy.action.riskLevels.unknown);
}

function resolveActionBiasLabel(value: string | null | undefined, copy: SymbolDetailCopy) {
  const normalized = normalizeActionToken(value);
  if (!normalized) return copy.action.biasDirections.neutral;
  return copy.action.biasDirections[normalized as keyof typeof copy.action.biasDirections] ??
    (shouldExposeBackendActionTokenFallback(copy) ? humanizeToken(normalized) : copy.action.biasDirections.unknown);
}

function resolveActionReasonLabel(value: string | null | undefined, copy: SymbolDetailCopy) {
  const normalized = normalizeActionToken(value);
  if (!normalized) return null;
  return resolveActionCopyToken(
    normalized,
    copy.action.reasonLabels,
    copy.action.reasonLabels.unmapped,
    shouldExposeBackendActionTokenFallback(copy) ? undefined : copy.action.reasonLabels.unmapped,
  );
}

function isInsufficientHistoryActionSummary(actionSummary: AgentContextActionSummaryDto | null) {
  if (!actionSummary) return false;
  const actionLabel = normalizeActionToken(actionSummary.action_label);
  const hasInsufficientHistoryReason = actionSummary.reasons.some((reason) => normalizeActionToken(reason) === "insufficient_history");
  return actionLabel === "insufficient_data" || hasInsufficientHistoryReason;
}

function buildActionReasonTags(actionSummary: AgentContextActionSummaryDto | null, copy: SymbolDetailCopy) {
  const reasonLabels =
    actionSummary?.reasons
      .map((reason) => resolveActionReasonLabel(reason, copy))
      .filter((reason): reason is string => Boolean(reason)) ?? [];
  return Array.from(new Set(reasonLabels)).slice(0, 4);
}

function buildActionSummarySignalMeterModel(
  actionSummary: AgentContextActionSummaryDto | null,
  score: number,
  copy: SymbolDetailCopy,
): ActionSummarySignalMeterModel {
  if (!actionSummary) {
    return {
      ariaLabel: `${copy.action.signalScore}: ${copy.action.signalUnavailable}`,
      currentLabel: copy.action.signalUnavailable,
      label: copy.action.signalScore,
      state: "unavailable",
      valueLabel: copy.action.unavailable,
    };
  }

  if (isInsufficientHistoryActionSummary(actionSummary)) {
    return {
      ariaLabel: `${copy.action.signalScore}: ${copy.action.scoreUnavailable}. ${copy.action.currentAction}: ${copy.action.reasonLabels.insufficientHistory}`,
      currentLabel: `${copy.action.currentAction}: ${copy.action.reasonLabels.insufficientHistory}`,
      label: copy.action.signalScore,
      state: "unavailable",
      valueLabel: copy.action.scoreUnavailable,
    };
  }

  const actionLabel = resolveActionSummaryActionLabel(actionSummary?.action_label, copy);
  const biasLabel = resolveActionBiasLabel(actionSummary?.bias_direction, copy);
  const currentLabel = `${copy.action.currentAction}: ${actionLabel} · ${copy.action.bias} ${biasLabel}`;
  const valueLabel = `${formatSignalScore(score)} / 100`;

  return {
    ariaLabel: `${copy.action.signalScore}: ${valueLabel}. ${currentLabel}`,
    currentLabel,
    label: copy.action.signalScore,
    state: "resolved",
    valueLabel,
  };
}

export function buildActionSummarySectionModel(
  actionSummary: AgentContextActionSummaryDto | null,
  copy: SymbolDetailCopy,
  options?: { includePayloadMeta?: boolean },
): ActionSummarySectionModel {
  const reasonTags = buildActionReasonTags(actionSummary, copy);
  const payloadTags = buildInsightTags(actionSummary?.summary_payload, copy.action.noPayloadKeys);
  const score = clampSignalScore(actionSummary?.signal_score);
  const isInsufficientHistory = isInsufficientHistoryActionSummary(actionSummary);
  const baseBody = reasonTags.length > 0 ? reasonTags.join(" · ") : null;
  const body = baseBody
    ? isInsufficientHistory
      ? `${baseBody} · ${copy.action.insufficientHistoryExplanation}`
      : baseBody
    : isInsufficientHistory
      ? copy.action.insufficientHistoryExplanation
      : copy.action.emptyBody;

  return {
    badgeLabel: actionSummary ? resolveActionSummaryActionLabel(actionSummary.action_label, copy) : copy.action.unavailable,
    body,
    headline: buildActionHeadline(actionSummary, copy),
    metaCaption: options?.includePayloadMeta ? `${copy.action.payloadKeys}: ${payloadTags.join(" · ")}` : "",
    meter: buildActionSummarySignalMeterModel(actionSummary, score, copy),
    metrics: [
      {
        key: "confidence",
        label: copy.action.confidence,
        value: resolveActionConfidenceLabel(actionSummary?.confidence_tier, copy),
      },
      {
        key: "risk",
        label: copy.action.risk,
        value: resolveActionRiskLabel(actionSummary?.risk_tier, copy),
      },
      {
        key: "trigger",
        label: copy.action.trigger,
        value: hasNumber(actionSummary?.trigger_price)
          ? `₩${formatPrice(actionSummary.trigger_price)}`
          : copy.action.noTriggerPrice,
      },
    ],
    reasonTags: reasonTags.length > 0 ? reasonTags : [copy.action.noRationaleRows],
    score,
    tone: buildActionTone(actionSummary),
  };
}

export function buildNormalizedActionSummaryState(
  actionSummary: AgentContextActionSummaryDto | null,
  isPending: boolean,
  copy: SymbolDetailCopy,
  options?: { includePayloadMeta?: boolean },
): NormalizedActionSummaryState {
  const sectionModel = buildActionSummarySectionModel(actionSummary, copy, options);
  const kind = actionSummary
    ? sectionModel.meter.state === "unavailable"
      ? "insufficient-history"
      : "resolved"
    : isPending
      ? "pending"
      : "unavailable";

  return { kind, sectionModel };
}

export function buildTechnicalAnalysisSectionModel(
  technicalSnapshot: AgentContextTechnicalSnapshotDto | null,
  technicalFreshnessDate: string | null,
  copy: SymbolDetailCopy,
): TechnicalAnalysisSectionModel {
  return {
    badgeLabel: technicalSnapshot ? humanizeToken(technicalSnapshot.trend_state) : copy.technical.unavailable,
    body: technicalSnapshot
      ? `${copy.technical.breakout20d} ${technicalSnapshot.breakout_20d ? copy.technical.yes : copy.technical.no} · ${copy.technical.breakdown20d} ${technicalSnapshot.breakdown_20d ? copy.technical.yes : copy.technical.no} · ${copy.technical.source} ${technicalSnapshot.source}`
      : copy.technical.emptyBody,
    headline: buildTechnicalHeadline(technicalSnapshot, copy),
    metaCaption: buildTechnicalSourceDateCaption(technicalFreshnessDate, copy),
    metrics: [
      {
        key: "return-5d",
        label: copy.technical.return5d,
        value: formatSignedPercent(technicalSnapshot?.return_5d, copy.technical.noReturn5d),
      },
      {
        key: "return-20d",
        label: copy.technical.return20d,
        value: formatSignedPercent(technicalSnapshot?.return_20d, copy.technical.noReturn20d),
      },
      {
        key: "volume-ratio-20d",
        label: copy.technical.volumeRatio20d,
        value: formatNumberOrDash(technicalSnapshot?.volume_ratio_20d, copy.technical.unavailable),
      },
      {
        key: "atr-14",
        label: copy.technical.atr14,
        value: formatNumberOrDash(technicalSnapshot?.atr_14, copy.technical.unavailable),
      },
    ],
    tone: buildTechnicalTone(technicalSnapshot),
    payloadTags: buildInsightTags(technicalSnapshot?.signal_payload, copy.technical.noPayloadKeys),
  };
}

export function buildFundamentalsDate(
  companyHistory: DartFundamentalsHistoryCompanyDto | null,
  latestFundamentals: AgentContextFundamentalsSummaryDto["latest_snapshot"] | null,
  aggregateContext: AgentContextItemDto | null,
) {
  return (
    companyHistory?.entries[0]?.filing.receipt_date ??
    latestFundamentals?.filing.receipt_date ??
    aggregateContext?.fundamentals.history_summary?.latest_receipt_date ??
    latestFundamentals?.period.period_end_date ??
    aggregateContext?.fundamentals.history_summary?.latest_period_end_date ??
    null
  );
}

export function buildFundamentalsLatestLabel(
  latestHistoryEntry: DartFundamentalsHistoryEntryDto | null,
  latestFundamentals: AgentContextFundamentalsSummaryDto["latest_snapshot"] | null,
  copy: SymbolDetailCopy,
) {
  return (
    latestHistoryEntry?.filing.report_nm ??
    latestFundamentals?.filing.report_name ??
    latestHistoryEntry?.period.report_label ??
    latestFundamentals?.period.report_label ??
    (latestFundamentals?.period.business_year ? `FY ${latestFundamentals.period.business_year}` : null) ??
    copy.fundamentals.noFilingLoaded
  );
}

export function buildFundamentalsMetricFallbacks(
  latestFundamentals: AgentContextFundamentalsSummaryDto["latest_snapshot"] | null,
  latestHistoryEntry: DartFundamentalsHistoryEntryDto | null,
  copy: SymbolDetailCopy,
) {
  const metrics: DartFundamentalsHistoryMetricDto[] = [];
  const filingLabel = buildFundamentalsLatestLabel(latestHistoryEntry, latestFundamentals, copy);
  metrics.push({ metric_key: "latest_filing", label: copy.fundamentals.latestFiling, value: filingLabel });

  const periodLabel =
    latestHistoryEntry?.period.report_label ??
    latestFundamentals?.period.report_label ??
    latestHistoryEntry?.period.period_end_date ??
    latestFundamentals?.period.period_end_date ??
    null;
  if (periodLabel) {
    metrics.push({ metric_key: "period", label: copy.fundamentals.period, value: periodLabel });
  }

  if (hasNumber(latestFundamentals?.statement.row_count)) {
    metrics.push({
      metric_key: "statement_rows",
      label: copy.fundamentals.statementRows,
      value: latestFundamentals.statement.row_count,
    });
  }

  return metrics.slice(0, 3);
}

export function buildHistoryEntryMetrics(entry: DartFundamentalsHistoryEntryDto, copy: SymbolDetailCopy) {
  const highlightMetrics = normalizeHighlightMetrics(entry.highlights);
  if (highlightMetrics.length > 0) {
    return highlightMetrics.slice(0, 2);
  }

  const statementMetrics =
    entry.statements
      ?.filter((statement) => statement.account_name && statement.current_amount !== null)
      .slice(0, 2)
      .map((statement) => ({
        metric_key: statement.account_name,
        label: statement.account_name,
        value: statement.current_amount,
      })) ?? [];

  if (statementMetrics.length > 0) {
    return statementMetrics;
  }

  return [
    {
      metric_key: "period_end",
      label: copy.fundamentals.periodEnd,
      value: entry.period.period_end_date ?? entry.period.report_label ?? copy.fundamentals.noPeriodDate,
    },
    {
      metric_key: "filing_receipt",
      label: copy.fundamentals.receipt,
      value: entry.filing.receipt_date ?? copy.fundamentals.noReceiptDate,
    },
  ];
}

export function buildFundamentalsCoverageNote(
  companyHistory: DartFundamentalsHistoryCompanyDto | null,
  latestFundamentals: AgentContextFundamentalsSummaryDto["latest_snapshot"] | null,
  copy: SymbolDetailCopy,
) {
  if (companyHistory?.entries.length) {
    const count = companyHistory.entries.length.toLocaleString();
    const separator = /^[A-Za-z]/.test(copy.fundamentals.storedPeriodsLoadedSuffix) ? " " : "";
    return `${count}${separator}${copy.fundamentals.storedPeriodsLoadedSuffix}`;
  }

  if (latestFundamentals) {
    return `${copy.fundamentals.aggregateContextHas} ${latestFundamentals.filing.report_name ?? copy.fundamentals.latestFiling} ${copy.fundamentals.from} ${latestFundamentals.filing.receipt_date ?? latestFundamentals.period.period_end_date ?? copy.fundamentals.noPeriodDate}.`;
  }

  return copy.fundamentals.coverageMissing;
}

export function buildFundamentalsHistorySectionModel({
  companyHistory,
  copy,
  fundamentalsEntryLimit,
  fundamentalsLoading,
  fsDiv,
  introTitle,
  latestFundamentals,
  latestHistoryEntry,
  symbol,
}: {
  companyHistory: DartFundamentalsHistoryCompanyDto | null;
  copy: SymbolDetailCopy;
  fundamentalsEntryLimit: number;
  fundamentalsLoading: boolean;
  fsDiv: string | null;
  introTitle: string;
  latestFundamentals: AgentContextFundamentalsSummaryDto["latest_snapshot"] | null;
  latestHistoryEntry: DartFundamentalsHistoryEntryDto | null;
  symbol: string;
}): FundamentalsHistorySectionModel {
  const latestHistoryHighlights = normalizeHighlightMetrics(latestHistoryEntry?.highlights).slice(0, 3);
  const latestAggregateHighlights = normalizeHighlightMetrics(latestFundamentals?.highlights).slice(0, 3);
  const latestHighlights =
    latestHistoryHighlights.length > 0
      ? latestHistoryHighlights
      : latestAggregateHighlights.length > 0
        ? latestAggregateHighlights
        : buildFundamentalsMetricFallbacks(latestFundamentals, latestHistoryEntry, copy);
  const entries =
    companyHistory?.entries.slice(0, fundamentalsEntryLimit).map((entry) => ({
      badgeLabel: entry.statement.fs_div ?? copy.fundamentals.fsPending,
      key: entry.filing.rcept_no,
      metrics: buildHistoryEntryMetrics(entry, copy).map((metric, index) => ({
        key: `${entry.filing.rcept_no}-${metric.metric_key ?? index}`,
        label: formatHighlightLabel(metric, index),
        value: formatHighlightValue(metric, copy),
      })),
      subtitle: `${entry.filing.report_nm ?? copy.fundamentals.unnamedFiling} · ${copy.fundamentals.receipt} ${entry.filing.receipt_date ?? copy.fundamentals.noReceiptDate}`,
      title:
        entry.period.report_label ??
        `${entry.period.business_year ?? copy.fundamentals.unknownYear} ${entry.period.report_code ?? ""}`.trim(),
    })) ?? [];

  if (entries.length > 0) {
    return {
      emptyBody: null,
      emptyTitle: null,
      entries,
      fsTone: buildConfidenceTone(fsDiv),
      fsValue: fsDiv ?? copy.fundamentals.defaultFs,
      highlights: latestHighlights.map((metric, index) => ({
        key: `${metric.metric_key ?? index}`,
        label: formatHighlightLabel(metric, index),
        value: formatHighlightValue(metric, copy),
      })),
      introBody: `${copy.fundamentals.latestFilingPrefix} ${buildFundamentalsLatestLabel(latestHistoryEntry, latestFundamentals, copy)}.`,
      introInitial: symbol.slice(0, 1),
      introTitle,
      state: "list",
    };
  }

  return {
    emptyBody: fundamentalsLoading
      ? copy.fundamentals.loadingBody
      : buildFundamentalsCoverageNote(companyHistory, latestFundamentals, copy),
    emptyTitle: fundamentalsLoading ? copy.fundamentals.loadingTitle : copy.fundamentals.emptyTitle,
    entries: [],
    fsTone: buildConfidenceTone(fsDiv),
    fsValue: fsDiv ?? copy.fundamentals.defaultFs,
    highlights: latestHighlights.map((metric, index) => ({
      key: `${metric.metric_key ?? index}`,
      label: formatHighlightLabel(metric, index),
      value: formatHighlightValue(metric, copy),
    })),
    introBody: `${copy.fundamentals.latestFilingPrefix} ${buildFundamentalsLatestLabel(latestHistoryEntry, latestFundamentals, copy)}.`,
    introInitial: symbol.slice(0, 1),
    introTitle,
    state: fundamentalsLoading ? "loading" : "empty",
  };
}

export function buildFocusCandleRows(
  focusBar: SymbolPriceBarDto | null,
  copy: SymbolDetailCopy,
  numberLocale: string,
): FocusCandleRow[] {
  if (!focusBar) return [];

  return [
    { label: copy.chart.open, value: formatPrice(focusBar.open_price) },
    { label: copy.chart.close, value: formatPrice(focusBar.close_price) },
    { label: copy.chart.volume, value: formatQuantity(focusBar.volume, copy.common.unavailable, numberLocale) },
    { label: copy.chart.highest, value: formatPrice(focusBar.high_price) },
    { label: copy.chart.lowest, value: formatPrice(focusBar.low_price) },
  ];
}

export function buildDisclosureCoverageNote(
  latestDisclosure: AgentContextDisclosureDto | null,
  disclosureCount: number,
  copy: SymbolDetailCopy,
) {
  if (disclosureCount > 0 && latestDisclosure) {
    const count = disclosureCount.toLocaleString();
    const separator = /^[A-Za-z]/.test(copy.disclosures.loadedSuffix) ? " " : "";
    return `${count}${separator}${copy.disclosures.loadedSuffix} ${copy.disclosures.latestFilingLandedOn} ${latestDisclosure.receipt_date ?? copy.disclosures.unavailableReceiptDate}.`;
  }

  return copy.disclosures.emptyTitle;
}

export function buildDisclosureCoverageSectionModel({
  copy,
  disclosureCount,
  disclosureItemLimit,
  latestDisclosure,
  recentDisclosures,
  routeQueryString,
  sectionState,
  symbol,
}: {
  copy: SymbolDetailCopy;
  disclosureCount: number;
  disclosureItemLimit: number;
  latestDisclosure: AgentContextDisclosureDto | null;
  recentDisclosures: AgentContextDisclosureDto[];
  routeQueryString: string;
  sectionState: DisclosureSectionState;
  symbol: string;
}): DisclosureCoverageSectionModel {
  const badgeTone =
    sectionState === "list" ? "info" : sectionState === "empty" ? "neutral" : "warning";
  const cards =
    sectionState === "list"
      ? recentDisclosures.slice(0, disclosureItemLimit).map((item) => ({
          actionLabel: copy.disclosures.viewReportDetail,
          ariaLabel: `${copy.disclosures.openReportPrefix} ${item.report_nm}`,
          body: `${humanizeToken(item.filing_category, copy.disclosures.noCategory)} · ${copy.disclosures.capture} ${humanizeToken(item.fundamentals_capture_status, copy.disclosures.notCaptured)}`,
          dateLabel: item.receipt_date ?? copy.disclosures.noReceiptDate,
          href: buildDisclosureReportHref(symbol, item, routeQueryString),
          key: item.rcept_no,
          receiptLabel: `${copy.disclosures.receipt} ${item.receipt_date ?? copy.disclosures.noReceiptDate}`,
          receiptNoLabel: `${copy.disclosures.receiptNo} ${item.rcept_no}`,
          title: item.report_nm,
        }))
      : [];
  const emptyTitle =
    sectionState === "loading"
      ? copy.disclosures.loadingTitle
      : sectionState === "empty"
        ? copy.disclosures.emptyTitle
        : sectionState === "unavailable"
          ? copy.disclosures.unavailableTitle
          : null;
  const emptyBody =
    sectionState === "loading"
      ? copy.disclosures.loadingBody
      : sectionState === "empty"
        ? copy.disclosures.emptyBody
        : sectionState === "unavailable"
          ? copy.disclosures.unavailableBody
          : null;

  return {
    badgeTone,
    badgeValue: `${disclosureCount} ${copy.disclosures.items}`,
    cards,
    coverageBody: buildDisclosureCoverageNote(latestDisclosure, disclosureCount, copy),
    coverageTitle: latestDisclosure ? copy.disclosures.latestDisclosureAvailable : copy.disclosures.partialAnalystCoverage,
    emptyBody,
    emptyTitle,
    state: sectionState,
  };
}

function normalizeMarketCode(value: string | null | undefined) {
  if (!value) return null;
  return value.trim().toUpperCase();
}

export function isClosedSessionMarketState(value: string | null | undefined) {
  const state = normalizeMarketCode(value);
  return state === "CLOSED" || state === "WEEKEND" || state === "PREOPEN";
}

export function getMarketOpenState(marketStatus: MarketStatusResponse | null) {
  if (!marketStatus) return null;
  if (typeof marketStatus.is_open === "boolean") return marketStatus.is_open;

  const state = normalizeMarketCode(marketStatus.state);
  if (state === "OPEN") return true;
  if (isClosedSessionMarketState(state)) return false;
  return null;
}

export function shouldStopQuotePollingForClosedSession(
  marketStatus: MarketStatusResponse | null,
  quote: QuoteResponse | null,
) {
  const marketOpen = getMarketOpenState(marketStatus);

  if (marketOpen === false) return true;
  if (marketOpen === true) return false;

  return isClosedSessionMarketState(marketStatus?.state) && isClosedSessionMarketState(quote?.market_state);
}

export type QuotePollingDisplayState = "active" | "closed" | "stopped";

export function resolveQuotePollingDisplayState(
  marketStatus: MarketStatusResponse | null,
  quote: QuoteResponse | null,
): QuotePollingDisplayState {
  if (shouldStopQuotePollingForClosedSession(marketStatus, quote)) return "closed";
  if (getMarketOpenState(marketStatus) === true) return "active";

  return quote?.available === true && quote.is_live === true && normalizeMarketCode(quote.market_state) === "OPEN"
    ? "active"
    : "stopped";
}

export function resolveMarketStateValue(value: string | null | undefined, copy: SymbolDetailCopy) {
  const state = normalizeMarketCode(value);
  if (state === "OPEN") return copy.header.marketStates.open;
  if (state === "CLOSED") return copy.header.marketStates.closed;
  if (state === "PREOPEN") return copy.header.marketStates.preopen;
  if (state === "POSTCLOSE") return copy.header.marketStates.postclose;
  return value ?? copy.header.marketStates.notReady;
}

function resolveMarketStateLabel(item: MarketStatusItem, copy: SymbolDetailCopy) {
  if (item.ready === false || item.available === false) return copy.header.marketStates.notReady;
  return resolveMarketStateValue(item.state, copy);
}

function getRelevantMarketStatusCodes(market: string) {
  if (market === "KOSPI") return ["KOSPI", "KRX"];
  if (market === "KONEX") return ["KONEX", "KRX"];
  return [market];
}

export function buildMarketStateRows(
  marketStatus: MarketStatusResponse | null,
  fallbackMarket: string | null | undefined,
  copy: SymbolDetailCopy,
) {
  const normalizedFallback = normalizeMarketCode(fallbackMarket);
  const items = Array.isArray(marketStatus?.markets) ? marketStatus.markets : [];
  const byCode = new Map<string, MarketStatusItem>();

  for (const item of items) {
    const code = normalizeMarketCode(item.market ?? item.label);
    if (!code) continue;
    byCode.set(code, item);
  }

  if (normalizedFallback) {
    const relevantCode = getRelevantMarketStatusCodes(normalizedFallback).find((code) => byCode.has(code));

    if (relevantCode) {
      const item = byCode.get(relevantCode);
      return item
        ? [
            {
              market: relevantCode,
              state: resolveMarketStateLabel(item, copy),
              stateCode: normalizeMarketCode(item.state),
              isReady: item.ready !== false && item.available !== false,
            },
          ]
        : [];
    }

    const fallbackState = resolveMarketStateValue(marketStatus?.state, copy);
    return fallbackState === copy.header.marketStates.notReady
      ? []
      : [
          {
            market: normalizedFallback,
            state: fallbackState,
            stateCode: normalizeMarketCode(marketStatus?.state),
            isReady: true,
          },
        ];
  }

  return items
    .map((item) => {
      const market = normalizeMarketCode(item.market ?? item.label);
      if (!market) return null;
      return {
        market,
        state: resolveMarketStateLabel(item, copy),
        stateCode: normalizeMarketCode(item.state),
        isReady: item.ready !== false && item.available !== false,
      };
    })
    .filter((row): row is MarketStateRow => row !== null);
}

export function getTrackingButtonLabel(
  locale: Locale,
  symbol: string,
  trackedSymbolsLoaded: boolean,
  isTrackedSymbol: boolean,
  trackingSaving: boolean,
) {
  if (trackingSaving) {
    return locale === "ko" ? `${symbol} 추적 종목 상태 업데이트 중` : "Updating tracked-symbol membership";
  }

  if (!trackedSymbolsLoaded) {
    return locale === "ko" ? `${symbol} 추적 종목 상태 확인 중` : `${symbol} tracked-symbol status pending`;
  }

  if (isTrackedSymbol) {
    return locale === "ko" ? `${symbol}를 추적 종목에서 제거` : `Remove ${symbol} from tracked symbols`;
  }

  return locale === "ko" ? `${symbol}를 추적 종목에 추가` : `Add ${symbol} to tracked symbols`;
}

export function getPiotroskiLabel(
  piotroskiResult: EodPiotroskiFilterResultItemDto | null,
  piotroskiLoadState: AggregateContextLoadState,
  copy: SymbolDetailCopy,
) {
  if (piotroskiResult) {
    return piotroskiResult.passed_filter ? copy.common.pass : copy.common.fail;
  }

  if (piotroskiLoadState === "loading") return copy.common.loading;
  if (piotroskiLoadState === "error") return copy.common.unavailable;
  return copy.common.pending;
}

export function buildActionHeadline(actionSummary: AgentContextActionSummaryDto | null, copy: SymbolDetailCopy) {
  if (!actionSummary) return copy.action.emptyHeadline;
  const actionLabel = resolveActionSummaryActionLabel(actionSummary.action_label, copy);
  return `${actionLabel} · ${copy.action.confidence} ${resolveActionConfidenceLabel(actionSummary.confidence_tier, copy)}`;
}

export function buildTechnicalHeadline(
  technicalSnapshot: AgentContextTechnicalSnapshotDto | null,
  copy: SymbolDetailCopy,
) {
  if (!technicalSnapshot) return copy.technical.emptyHeadline;
  return `${copy.technical.maAlignment} ${humanizeToken(technicalSnapshot.ma_alignment)}`;
}

export function getLocalizedSymbolDetailModes(
  copy: SymbolDetailCopy,
): Record<SymbolDetailMode, LocalizedSymbolDetailMode> {
  return {
    overview: {
      label: copy.modes.overview.label,
      eyebrow: copy.modes.overview.eyebrow,
      title: copy.modes.overview.title,
    },
    "action-summary": {
      label: copy.modes.actionSummary.label,
      eyebrow: copy.modes.actionSummary.eyebrow,
      title: copy.modes.actionSummary.title,
    },
    "technical-analysis": {
      label: copy.modes.technicalAnalysis.label,
      eyebrow: copy.modes.technicalAnalysis.eyebrow,
      title: copy.modes.technicalAnalysis.title,
    },
    "fundamentals-history": {
      label: copy.modes.fundamentalsHistory.label,
      eyebrow: copy.modes.fundamentalsHistory.eyebrow,
      title: copy.modes.fundamentalsHistory.title,
    },
    "disclosure-coverage": {
      label: copy.modes.disclosureCoverage.label,
      eyebrow: copy.modes.disclosureCoverage.eyebrow,
      title: copy.modes.disclosureCoverage.title,
    },
    "system-freshness": {
      label: copy.modes.systemFreshness.label,
      eyebrow: copy.modes.systemFreshness.eyebrow,
      title: copy.modes.systemFreshness.title,
    },
  };
}

export function buildLatestPriceLabel(
  freshness: EodFreshnessResponseDto | null,
  quote: QuoteResponse | null,
  copy: SymbolDetailCopy,
) {
  return resolvePresenterDate(getLatestPriceTradeDate(freshness), freshness?.price?.latest_date, quote?.trade_date)
    ?? formatDisplayTimestamp(quote?.cached_at, copy.hero.quotePending);
}

export function buildSystemFreshnessSectionModel({
  actionSummary,
  aggregateContext,
  copy,
  disclosureSectionState,
  freshness,
  hasFundamentalsHistory,
  latestDisclosure,
  latestFundamentals,
  marketDate,
  quote,
  technicalSnapshot,
}: {
  actionSummary: AgentContextActionSummaryDto | null;
  aggregateContext: AgentContextItemDto | null;
  copy: SymbolDetailCopy;
  disclosureSectionState: DisclosureSectionState;
  freshness: EodFreshnessResponseDto | null;
  hasFundamentalsHistory: boolean;
  latestDisclosure: AgentContextDisclosureDto | null;
  latestFundamentals: AgentContextFundamentalsSummaryDto["latest_snapshot"] | null;
  marketDate: string | null;
  quote: QuoteResponse | null;
  technicalSnapshot: AgentContextTechnicalSnapshotDto | null;
}): SystemFreshnessSectionModel {
  const technicalFreshnessDate = buildTechnicalFreshnessDate(technicalSnapshot, freshness);
  const actionFreshnessDate = buildActionFreshnessDate(actionSummary, freshness);
  const fundamentalsDate = buildFundamentalsDate(null, latestFundamentals, aggregateContext);

  return {
    metrics: [
      {
        key: "eod-trade-date",
        label: copy.freshness.eodTradeDate,
        value: freshness?.today?.trade_date ?? marketDate ?? copy.common.datePending,
      },
      {
        key: "price-latest",
        label: copy.freshness.priceLatest,
        value: buildLatestPriceLabel(freshness, quote, copy),
      },
      {
        key: "technical-latest",
        label: copy.freshness.technicalLatest,
        value: technicalFreshnessDate ?? copy.freshness.noTechnicalDate,
      },
      {
        key: "action-latest",
        label: copy.freshness.actionLatest,
        value: actionFreshnessDate ?? copy.freshness.noActionDate,
      },
    ],
    moduleRows: [
      {
        api: "/api/trading/quotes/{symbol}",
        date: buildLatestPriceLabel(freshness, quote, copy),
        detail: quote?.available
          ? buildQuoteSourceLabel(quote, copy)
          : formatQuoteUnavailableReasonLabel(quote?.unavailable_reason, copy, copy.freshness.quoteCoverageUnavailable),
        id: "price",
        label: copy.freshness.priceModule,
        status: quote?.available
          ? quote.is_live
            ? copy.freshness.live
            : copy.freshness.fallback
          : copy.freshness.unavailable,
        tone: buildModuleStatusTone(Boolean(quote?.available)),
      },
      {
        api: "/api/trading/eod/technical-snapshots",
        date: technicalFreshnessDate ?? copy.freshness.noTechnicalDate,
        detail: technicalSnapshot
          ? `${humanizeToken(technicalSnapshot.trend_state)} · ${copy.technical.maAlignment} ${humanizeToken(technicalSnapshot.ma_alignment)}`
          : copy.freshness.technicalUnavailable,
        id: "technical",
        label: copy.freshness.technicalModule,
        status:
          technicalSnapshot || freshness?.technical?.success ? copy.freshness.synced : copy.freshness.pending,
        tone: technicalSnapshot || freshness?.technical?.success ? buildTechnicalTone(technicalSnapshot) : "warning",
      },
      {
        api: "/api/trading/eod/action-summaries",
        date: actionFreshnessDate ?? copy.freshness.noActionDate,
        detail: actionSummary
          ? `${humanizeToken(actionSummary.action_label)} · ${copy.action.risk} ${humanizeToken(actionSummary.risk_tier)}`
          : copy.freshness.actionUnavailable,
        id: "action",
        label: copy.freshness.actionModule,
        status: actionSummary ? copy.freshness.resolved : copy.freshness.pending,
        tone: actionSummary ? buildActionTone(actionSummary) : "warning",
      },
      {
        api: "/api/trading/disclosures/dart/fundamentals/history",
        date: fundamentalsDate ?? copy.fundamentals.noReceiptDate,
        detail: buildFundamentalsCoverageNote(null, latestFundamentals, copy),
        id: "fundamentals",
        label: copy.freshness.fundamentalsModule,
        status: hasFundamentalsHistory
          ? copy.freshness.historyLoaded
          : latestFundamentals
            ? copy.freshness.aggregateOnly
            : copy.freshness.noHistory,
        tone: hasFundamentalsHistory || latestFundamentals ? "info" : "warning",
      },
      {
        api: "/api/trading/agent-context/symbol-day",
        date:
          latestDisclosure?.receipt_date ??
          (disclosureSectionState === "loading"
            ? copy.common.loading
            : disclosureSectionState === "empty"
              ? copy.freshness.noDisclosures
              : copy.freshness.unavailable),
        detail: buildDisclosureCoverageNote(latestDisclosure, aggregateContext?.recent_disclosures.count ?? 0, copy),
        id: "disclosures",
        label: copy.freshness.disclosuresModule,
        status:
          disclosureSectionState === "list"
            ? copy.freshness.coverage
            : disclosureSectionState === "empty"
              ? copy.freshness.empty
              : disclosureSectionState === "loading"
                ? copy.freshness.loading
                : copy.freshness.unavailable,
        tone:
          disclosureSectionState === "list"
            ? "info"
            : disclosureSectionState === "empty"
              ? "neutral"
              : "warning",
      },
    ],
    statusLabel: humanizeToken(freshness?.today?.eod_status, copy.freshness.statusPending),
    tone: buildFreshnessTone(freshness?.today?.eod_status),
  };
}
