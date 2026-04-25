import type {
  AggregateContextLoadState,
  SymbolDetailMode,
} from "@/app/dashboard/symbol/[symbol]/symbol-detail-state";
import type { SymbolDetailCopy } from "@/i18n/symbol-detail-copy";
import { formatDisplayTimestamp, formatPrice } from "@/lib/format";
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
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function formatIsoDateLabel(value: string | null | undefined, fallback = "Date pending") {
  if (!value) return fallback;
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${year}.${month}.${day}`;
}

export function buildQuoteSourceLabel(quote: QuoteResponse | null, copy: SymbolDetailCopy) {
  if (!quote) return copy.hero.quotePending;
  if (!quote.available) {
    const unavailableLabel = copy.freshness.quoteCoverageUnavailable.replace(/\.$/, "");
    return quote.unavailable_reason
      ? `${unavailableLabel} ${quote.unavailable_reason}.`
      : copy.freshness.quoteCoverageUnavailable;
  }
  if (quote.is_live) return copy.freshness.live;
  if (quote.source === "daily_price_bar") {
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

export function pickSelectedBar(items: SymbolPriceBarDto[], previousSelectedBar: SymbolPriceBarDto | null) {
  if (items.length === 0) return null;
  if (!previousSelectedBar) return items[items.length - 1] ?? null;
  return items.find((item) => item.trade_date === previousSelectedBar.trade_date) ?? items[items.length - 1] ?? null;
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

export function buildActionTone(actionSummary: AgentContextActionSummaryDto | null) {
  if (!actionSummary) return "neutral";
  if (actionSummary.bias_direction === "long") return "positive";
  if (actionSummary.bias_direction === "short") return "negative";
  return "info";
}

export function buildTechnicalTone(technicalSnapshot: AgentContextTechnicalSnapshotDto | null) {
  if (!technicalSnapshot) return "warning";
  if (technicalSnapshot.trend_state === "uptrend") return "positive";
  if (technicalSnapshot.trend_state === "downtrend") return "negative";
  return "info";
}

export function buildFreshnessTone(status: string | null | undefined) {
  if (!status) return "warning";
  if (status === "completed") return "positive";
  if (status === "completed_with_errors") return "warning";
  if (status === "running") return "info";
  return "neutral";
}

export function buildModuleStatusTone(available: boolean, fallbackTone = "warning") {
  return available ? "positive" : fallbackTone;
}

export function buildConfidenceTone(value: string | null | undefined) {
  if (!value) return "warning";
  if (value === "high" || value === "premium") return "positive";
  if (value === "low") return "negative";
  return "info";
}

export function buildInsightTags(payload: Record<string, unknown> | null | undefined) {
  const keys = payload ? Object.keys(payload) : [];
  if (keys.length === 0) {
    return ["No payload keys"];
  }

  return keys.slice(0, 4).map((key) => humanizeToken(key, key));
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
  return (
    technicalSnapshot?.market_date ??
    freshness?.technical?.latest_date ??
    freshness?.latest?.technical_market_date ??
    null
  );
}

export function buildActionFreshnessDate(
  actionSummary: AgentContextActionSummaryDto | null,
  freshness: EodFreshnessResponseDto | null,
) {
  return actionSummary?.market_date ?? freshness?.latest?.action_market_date ?? null;
}

export function buildFundamentalsDate(
  companyHistory: DartFundamentalsHistoryCompanyDto | null,
  latestFundamentals: AgentContextFundamentalsSummaryDto["latest_snapshot"] | null,
  aggregateContext: AgentContextItemDto | null,
) {
  return (
    companyHistory?.entries[0]?.filing.receipt_date ??
    latestFundamentals?.filing.receipt_date ??
    aggregateContext?.fundamentals.history_summary.latest_receipt_date ??
    latestFundamentals?.period.period_end_date ??
    aggregateContext?.fundamentals.history_summary.latest_period_end_date ??
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

function normalizeMarketCode(value: string | null | undefined) {
  if (!value) return null;
  return value.trim().toUpperCase();
}

export function getMarketOpenState(marketStatus: MarketStatusResponse | null) {
  if (!marketStatus) return null;
  if (typeof marketStatus.is_open === "boolean") return marketStatus.is_open;

  const state = normalizeMarketCode(marketStatus.state);
  if (state === "OPEN") return true;
  if (state === "CLOSED") return false;
  return null;
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
  return `${humanizeToken(actionSummary.action_label)} · ${copy.action.confidence} ${humanizeToken(actionSummary.confidence_tier)}`;
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
  return (
    freshness?.latest?.price_trade_date ??
    quote?.trade_date ??
    formatDisplayTimestamp(quote?.cached_at, copy.hero.quotePending)
  );
}
