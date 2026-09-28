import type {
  PortfolioAccountDto,
  PortfolioAllocationDto,
  PortfolioHoldingDto,
  PortfolioMoneyAmountDto,
  PortfolioOrderActivityDto,
  PortfolioRiskExposureDto,
  PortfolioRiskOpenOrderDto,
  PortfolioRiskSnapshotDto,
  PortfolioRiskWarningDto,
  PortfolioSummaryDto,
} from "@/types/trading-api/portfolio-account";
import { classifyTradingApiFailure } from "@/lib/trading-api-result";
import { getUserFacingErrorMessage } from "@/lib/user-facing-errors";

export type PortfolioMetricId = "total-assets" | "week-pnl" | "unrealized-pnl" | "cash-buying-power";

export type PortfolioMetricModel = {
  id: PortfolioMetricId;
  value: string;
  tone: "positive" | "negative" | "neutral";
  available: boolean;
};

export type PortfolioSummaryFailureKind =
  | "endpoint-pending"
  | "invalid-response"
  | "not-configured"
  | "upstream-unavailable";

export type PortfolioSummaryState =
  | "loading"
  | PortfolioSummaryFailureKind
  | "connected-empty"
  | "stale-sync"
  | "partial-data"
  | "fully-synced";

export type PortfolioSectionId = "hero-metrics" | "accounts" | "holdings" | "allocation" | "activity";

export type PortfolioSectionState = Exclude<PortfolioSummaryState, "connected-empty"> | "empty";

export type PortfolioSectionStates = Record<PortfolioSectionId, PortfolioSectionState>;

export type PortfolioCollectionCounts = {
  accountCount: number | null;
  holdingCount: number | null;
};

export type PortfolioRiskSnapshotState =
  | "loading"
  | PortfolioSummaryFailureKind
  | "unavailable"
  | "stale-sync"
  | "partial-data"
  | "ready";

export type PortfolioRiskExposureModel = {
  allocationLabel: string;
  key: string;
  marketLabel: string | null;
  nameLabel: string;
  notionalLabel: string;
  quantityLabel: string;
  symbol: string;
};

export type PortfolioRiskOpenOrderModel = {
  key: string;
  notionalLabel: string;
  quantityLabel: string;
  sideLabel: string;
  statusLabel: string;
  symbol: string;
};

export type PortfolioRiskWarningModel = {
  detail: string | null;
  key: string;
  label: string;
  symbol: string | null;
};

export type PortfolioRiskSnapshotModel = {
  concentrationWarnings: PortfolioRiskWarningModel[];
  generatedAt: string | null;
  modeLabel: string;
  missingMetadataCountLabel: string;
  notices: string[];
  openHoldingCountLabel: string;
  openOrderCountLabel: string;
  openOrderNotionalLabel: string;
  sourceLabel: string;
  sourceMessage: string | null;
  sourceStatusKey: string | null;
  staleWarningCountLabel: string;
  staleWarnings: PortfolioRiskWarningModel[];
  topExposures: PortfolioRiskExposureModel[];
  topOpenOrders: PortfolioRiskOpenOrderModel[];
  totalMarketValueLabel: string;
};

type PortfolioSummaryStateInput = {
  error?: string | null;
  failureKind?: PortfolioSummaryFailureKind | null;
  loading?: boolean;
  summary: PortfolioSummaryDto | null | undefined;
};

type PortfolioRiskSnapshotStateInput = {
  error?: string | null;
  failureKind?: PortfolioSummaryFailureKind | null;
  loading?: boolean;
  snapshot: PortfolioRiskSnapshotDto | null | undefined;
};

type PortfolioFailureInput = {
  message?: string | null;
  status?: number | null;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  KRW: "₩",
  USD: "$",
};

const NOT_CONFIGURED_STATUS_TOKENS = new Set([
  "account_not_configured",
  "broker_not_configured",
  "config_missing",
  "configuration_missing",
  "credentials_missing",
  "missing_configuration",
  "no_accounts_configured",
  "not_configured",
]);

const STALE_SYNC_STATUS_TOKENS = new Set(["expired", "outdated", "stale", "stale_sync"]);

const PARTIAL_SYNC_STATUS_TOKENS = new Set([
  "completed_with_errors",
  "degraded",
  "error",
  "failed",
  "failure",
  "partial",
  "partial_data",
  "unavailable",
  "warning",
]);

const READY_RISK_STATUS_TOKENS = new Set(["available", "ok", "ready", "synced"]);
const STALE_RISK_STATUS_TOKENS = new Set(["expired", "outdated", "stale", "stale_sync"]);
const PARTIAL_RISK_STATUS_TOKENS = new Set([
  "completed_with_errors",
  "degraded",
  "partial",
  "partial_data",
  "warning",
]);
const UNAVAILABLE_RISK_STATUS_TOKENS = new Set([
  "endpoint_pending",
  "missing",
  "no_data",
  "not_available",
  "not_configured",
  "source_failed",
  "source_unavailable",
  "unavailable",
]);

const NOT_CONFIGURED_MESSAGE_PATTERN =
  /(TRADING_API_UPSTREAM|not configured|config(?:uration)? (?:is )?missing|missing config|missing credentials|no brokerage account|no accounts configured|account.*not configured)/i;

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRecordValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) return record[key];
  }

  return undefined;
}

function getTextValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getTextField(record: Record<string, unknown>, keys: string[]) {
  return getTextValue(getRecordValue(record, keys));
}

function getBooleanField(record: Record<string, unknown>, keys: string[]) {
  const value = getRecordValue(record, keys);
  return typeof value === "boolean" ? value : null;
}

function parseNumberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const normalized = value.replace(/[%,$₩]/g, "").replace(/,/g, "").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getNumberField(record: Record<string, unknown>, keys: string[]) {
  return parseNumberValue(getRecordValue(record, keys));
}

function normalizeCurrency(value: string | null | undefined, fallback = "KRW") {
  const normalized = value?.trim().toUpperCase();
  return normalized || fallback;
}

function getCurrencySymbol(currency: string) {
  return CURRENCY_SYMBOLS[currency] ?? `${currency} `;
}

function getNumberLocale(currency: string) {
  return currency === "KRW" ? "ko-KR" : "en-US";
}

export function formatPortfolioMoney(
  value: PortfolioMoneyAmountDto | null | undefined,
  fallback = "Unavailable",
): string {
  if (!value) return fallback;
  const display = value.display?.trim();
  if (display) return display;
  if (!hasNumber(value.amount)) return fallback;

  const currency = normalizeCurrency(value.currency);
  const fractionDigits = currency === "KRW" ? 0 : 2;

  const sign = value.amount < 0 ? "-" : "";
  return `${sign}${getCurrencySymbol(currency)}${Math.abs(value.amount).toLocaleString(getNumberLocale(currency), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

export function formatPortfolioPercent(value: number | null | undefined, fallback = "Unavailable") {
  if (!hasNumber(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function getPortfolioAllocationBarWidth(value: number | null | undefined) {
  if (!hasNumber(value)) return null;
  return Math.max(0, Math.min(100, value));
}

function formatPortfolioRiskPercent(value: number | null | undefined, fallback = "Unavailable") {
  if (!hasNumber(value)) return fallback;
  return `${value.toFixed(2)}%`;
}

function formatPortfolioRiskCount(value: number | null | undefined, fallback = "Unavailable") {
  return hasNumber(value) ? value.toLocaleString("en-US") : fallback;
}

function humanizePortfolioRiskToken(value: string | null | undefined, fallback = "Unavailable") {
  const token = value?.trim();
  if (!token) return fallback;

  return token
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function getRecordArray<T extends Record<string, unknown>>(record: Record<string, unknown>, keys: string[]) {
  const value = getRecordValue(record, keys);
  return Array.isArray(value) ? value.filter((item): item is T => isRecord(item)) : [];
}

function getStringArray(record: Record<string, unknown>, keys: string[]) {
  const value = getRecordValue(record, keys);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function coercePortfolioRiskMoney(
  value: unknown,
  fallbackCurrency: string | null | undefined = "KRW",
): PortfolioMoneyAmountDto | null {
  const currency = normalizeCurrency(fallbackCurrency);
  if (isRecord(value)) {
    const display = getTextField(value, ["display"]);
    const amount = getNumberField(value, ["amount", "value"]);
    const valueCurrency = normalizeCurrency(getTextField(value, ["currency", "quoteCurrency", "quote_currency"]), currency);
    if (display || amount !== null) return { amount, currency: valueCurrency, display };
    return null;
  }

  const amount = parseNumberValue(value);
  if (amount !== null) return { amount, currency };

  const display = getTextValue(value);
  return display ? { amount: null, currency, display } : null;
}

function getRiskMoneyFieldCurrency(key: string, fallbackCurrency: string) {
  return key.endsWith("_krw") ? "KRW" : fallbackCurrency;
}

function getRiskMoneyField(record: Record<string, unknown>, keys: string[], fallbackCurrency = "KRW") {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    return coercePortfolioRiskMoney(record[key], getRiskMoneyFieldCurrency(key, fallbackCurrency));
  }

  return null;
}

function getRiskRowCurrency(row: Record<string, unknown>) {
  return normalizeCurrency(getTextField(row, ["currency", "quoteCurrency", "quote_currency"]), "KRW");
}

function getRiskExposureRows(snapshot: PortfolioRiskSnapshotDto | null | undefined): PortfolioRiskExposureDto[] {
  if (!isRecord(snapshot)) return [];

  return [
    ...getRecordArray<PortfolioRiskExposureDto>(snapshot, ["topHoldings", "top_holdings"]),
    ...getRecordArray<PortfolioRiskExposureDto>(snapshot, ["topExposures", "top_exposures"]),
    ...getRecordArray<PortfolioRiskExposureDto>(snapshot, ["exposures"]),
    ...getRecordArray<PortfolioRiskExposureDto>(snapshot, ["topPositionConcentration", "top_position_concentration"]),
  ];
}

function getRiskOpenOrderSummary(snapshot: PortfolioRiskSnapshotDto | null | undefined) {
  if (!isRecord(snapshot)) return null;
  const value = getRecordValue(snapshot, ["openOrderSummary", "open_order_summary"]);
  return isRecord(value) ? value : null;
}

function getRiskOpenOrderRows(snapshot: PortfolioRiskSnapshotDto | null | undefined): PortfolioRiskOpenOrderDto[] {
  if (!isRecord(snapshot)) return [];
  const summary = getRiskOpenOrderSummary(snapshot);

  return [
    ...(summary ? getRecordArray<PortfolioRiskOpenOrderDto>(summary, ["topOpenOrders", "top_open_orders"]) : []),
    ...getRecordArray<PortfolioRiskOpenOrderDto>(snapshot, ["topOpenOrders", "top_open_orders"]),
    ...getRecordArray<PortfolioRiskOpenOrderDto>(snapshot, ["openOrders", "open_orders"]),
  ];
}

function getRiskWarningRows(snapshot: PortfolioRiskSnapshotDto | null | undefined, keys: string[]): PortfolioRiskWarningDto[] {
  return isRecord(snapshot) ? getRecordArray<PortfolioRiskWarningDto>(snapshot, keys) : [];
}

function getGenericRiskWarnings(snapshot: PortfolioRiskSnapshotDto | null | undefined) {
  return getRiskWarningRows(snapshot, ["warnings"]);
}

function getWarningIdentityText(warning: PortfolioRiskWarningDto) {
  return [
    getTextField(warning, ["type"]),
    getTextField(warning, ["code"]),
    getTextField(warning, ["reason"]),
    getTextField(warning, ["message"]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getFilteredGenericWarnings(snapshot: PortfolioRiskSnapshotDto | null | undefined, pattern: RegExp) {
  return getGenericRiskWarnings(snapshot).filter((warning) => pattern.test(getWarningIdentityText(warning)));
}

function getRiskConcentrationWarnings(snapshot: PortfolioRiskSnapshotDto | null | undefined) {
  return [
    ...getRiskWarningRows(snapshot, ["concentrationWarnings", "concentration_warnings"]),
    ...getFilteredGenericWarnings(snapshot, /concentration|allocation|duplicate_open_order/),
  ];
}

function getRiskStalePositionWarnings(snapshot: PortfolioRiskSnapshotDto | null | undefined) {
  return [
    ...getRiskWarningRows(snapshot, ["stalePositionWarnings", "stale_position_warnings", "staleLocalPositionWarnings", "stale_local_position_warnings"]),
    ...getFilteredGenericWarnings(snapshot, /stale.*position|position.*stale/),
  ];
}

function getRiskStaleOrderWarnings(snapshot: PortfolioRiskSnapshotDto | null | undefined) {
  return [
    ...getRiskWarningRows(snapshot, ["staleOrderWarnings", "stale_order_warnings", "staleOpenOrderWarnings", "stale_open_order_warnings"]),
    ...getFilteredGenericWarnings(snapshot, /stale.*order|order.*stale/),
  ];
}

function getRiskMissingMetadataWarnings(snapshot: PortfolioRiskSnapshotDto | null | undefined) {
  return [
    ...getRiskWarningRows(snapshot, ["missingStopMetadataWarnings", "missing_stop_metadata_warnings"]),
    ...getFilteredGenericWarnings(snapshot, /missing.*(stop|metadata)|(stop|metadata).*missing/),
  ];
}

function getRiskAllocationPercent(row: Record<string, unknown>) {
  return getNumberField(row, [
    "allocationPercent",
    "allocation_percent",
    "portfolioWeightPct",
    "portfolio_weight_pct",
    "weightPercent",
    "weight_percent",
    "percent",
  ]);
}

function getRiskExposureMoney(row: Record<string, unknown>) {
  const currency = getRiskRowCurrency(row);
  return getRiskMoneyField(
    row,
    [
      "totalExposure",
      "total_exposure",
      "total_exposure_krw",
      "notional",
      "notional_krw",
      "marketValue",
      "market_value",
      "market_value_krw",
      "holdingNotional",
      "holding_notional",
    ],
    currency,
  );
}

function getRiskOrderMoney(row: Record<string, unknown>) {
  const currency = getRiskRowCurrency(row);
  const explicit = getRiskMoneyField(row, ["notional", "notional_krw", "openOrderNotional", "open_order_notional"], currency);
  if (explicit) return explicit;

  const limitPrice = getRiskMoneyField(row, ["limitPrice", "limit_price"], currency);
  const quantity = getNumberField(row, ["remainingQuantity", "remaining_quantity", "quantity"]);
  if (hasNumber(limitPrice?.amount) && hasNumber(quantity)) {
    return {
      amount: limitPrice.amount * quantity,
      currency: limitPrice.currency,
    };
  }

  return null;
}

function getRiskQuantityLabel(row: Record<string, unknown>, fallback: string) {
  const value = getNumberField(row, ["effectiveQuantity", "effective_quantity", "baseQuantity", "base_quantity", "quantity"]);
  return hasNumber(value) ? value.toLocaleString("en-US", { maximumFractionDigits: 8 }) : fallback;
}

function getExposureSortValue(row: PortfolioRiskExposureDto) {
  return getRiskAllocationPercent(row) ?? getRiskExposureMoney(row)?.amount ?? 0;
}

function dedupeRiskRows<T extends Record<string, unknown>>(rows: T[], getKey: (row: T, index: number) => string) {
  const seen = new Set<string>();
  return rows.filter((row, index) => {
    const key = getKey(row, index);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildPortfolioRiskExposureModels(
  snapshot: PortfolioRiskSnapshotDto | null | undefined,
  fallback: string,
): PortfolioRiskExposureModel[] {
  const rows = dedupeRiskRows(getRiskExposureRows(snapshot), (row, index) => `${row.symbol}-${row.id ?? index}`);

  return [...rows]
    .sort((a, b) => getExposureSortValue(b) - getExposureSortValue(a))
    .slice(0, 5)
    .map((row, index) => {
      const symbol = getTextField(row, ["symbol"]) ?? fallback;
      const name = getTextField(row, ["name", "companyName", "company_name"]);
      const market = getTextField(row, ["market", "venue"]);

      return {
        allocationLabel: formatPortfolioRiskPercent(getRiskAllocationPercent(row), fallback),
        key: `${symbol}-${index}`,
        marketLabel: market,
        nameLabel: name ?? symbol,
        notionalLabel: formatPortfolioMoney(getRiskExposureMoney(row), fallback),
        quantityLabel: getRiskQuantityLabel(row, fallback),
        symbol,
      };
    });
}

function buildPortfolioRiskOpenOrderModels(
  snapshot: PortfolioRiskSnapshotDto | null | undefined,
  fallback: string,
): PortfolioRiskOpenOrderModel[] {
  const rows = dedupeRiskRows(getRiskOpenOrderRows(snapshot), (row, index) => {
    const explicitId = getTextField(row, ["id", "brokerOrderId", "broker_order_id"]);
    return explicitId ?? `${getTextField(row, ["symbol"]) ?? "unknown"}-${index}`;
  });

  return [...rows]
    .sort((a, b) => (getRiskOrderMoney(b)?.amount ?? 0) - (getRiskOrderMoney(a)?.amount ?? 0))
    .slice(0, 5)
    .map((row, index) => {
      const symbol = getTextField(row, ["symbol"]) ?? fallback;

      return {
        key: `${symbol}-${getTextField(row, ["id", "brokerOrderId", "broker_order_id"]) ?? index}`,
        notionalLabel: formatPortfolioMoney(getRiskOrderMoney(row), fallback),
        quantityLabel: getRiskQuantityLabel(row, fallback),
        sideLabel: humanizePortfolioRiskToken(getTextField(row, ["side", "intent"]), fallback),
        statusLabel: humanizePortfolioRiskToken(getTextField(row, ["status"]), fallback),
        symbol,
      };
    });
}

function buildPortfolioRiskWarningModels(rows: PortfolioRiskWarningDto[], fallback: string): PortfolioRiskWarningModel[] {
  return rows.slice(0, 5).map((warning, index) => {
    const symbol = getTextField(warning, ["symbol"]);
    const message = getTextField(warning, ["message"]);
    const reason = getTextField(warning, ["reason"]);
    const token = getTextField(warning, ["code", "type", "severity"]);
    const label = message ?? humanizePortfolioRiskToken(token ?? reason, fallback);

    return {
      detail: message && reason ? reason : null,
      key: `${symbol ?? token ?? reason ?? "warning"}-${index}`,
      label,
      symbol,
    };
  });
}

function getRiskOpenHoldingCount(snapshot: PortfolioRiskSnapshotDto | null | undefined) {
  if (!isRecord(snapshot)) return null;
  const explicitCount = getNumberField(snapshot, ["openHoldingCount", "open_holding_count"]);
  if (explicitCount !== null) return explicitCount;

  const exposureCount = getRiskExposureRows(snapshot).length;
  return exposureCount > 0 ? exposureCount : null;
}

function getRiskTotalMarketValue(snapshot: PortfolioRiskSnapshotDto | null | undefined) {
  if (!isRecord(snapshot)) return null;
  return getRiskMoneyField(
    snapshot,
    ["totalMarketValue", "total_market_value", "total_market_value_krw", "totalSecuritiesValue", "total_securities_value"],
    "KRW",
  );
}

function getRiskOpenOrderCount(snapshot: PortfolioRiskSnapshotDto | null | undefined) {
  if (!isRecord(snapshot)) return null;
  const summary = getRiskOpenOrderSummary(snapshot);
  return (
    (summary ? getNumberField(summary, ["openOrderCount", "open_order_count"]) : null) ??
    getNumberField(snapshot, ["openOrderCount", "open_order_count"]) ??
    (getRiskOpenOrderRows(snapshot).length || null)
  );
}

function getRiskOpenOrderNotional(snapshot: PortfolioRiskSnapshotDto | null | undefined) {
  if (!isRecord(snapshot)) return null;
  const summary = getRiskOpenOrderSummary(snapshot);
  const explicit =
    (summary
      ? getRiskMoneyField(
          summary,
          ["totalOpenOrderNotional", "total_open_order_notional", "total_open_order_notional_krw"],
          "KRW",
        )
      : null) ??
    getRiskMoneyField(
      snapshot,
      ["totalOpenOrderNotional", "total_open_order_notional", "total_open_order_notional_krw"],
      "KRW",
    );
  if (explicit) return explicit;

  const orderAmounts = getRiskOpenOrderRows(snapshot)
    .map(getRiskOrderMoney)
    .filter((value): value is PortfolioMoneyAmountDto => value !== null && hasNumber(value.amount));
  if (orderAmounts.length === 0) return null;

  return mergeMoneyAmounts(orderAmounts);
}

function getRiskMissingMetadataCount(snapshot: PortfolioRiskSnapshotDto | null | undefined) {
  if (!isRecord(snapshot)) return null;
  return (
    getNumberField(snapshot, ["missingStopMetadataCount", "missing_stop_metadata_count", "missingMetadataWarningCount", "missing_metadata_warning_count"]) ??
    (getRiskMissingMetadataWarnings(snapshot).length || null)
  );
}

function getPortfolioRiskSourceStatusKey(snapshot: PortfolioRiskSnapshotDto | null | undefined) {
  if (!isRecord(snapshot)) return null;
  const explicit = normalizeStatusToken(getTextField(snapshot, ["sourceStatus", "source_status", "status"]));
  if (explicit) return explicit;
  const available = getBooleanField(snapshot, ["available"]);
  if (available === false) return "unavailable";
  if (available === true) return "ready";
  return null;
}

function getPortfolioRiskSourceMessage(snapshot: PortfolioRiskSnapshotDto | null | undefined) {
  if (!isRecord(snapshot)) return null;
  const sourceMessage = getTextField(snapshot, ["sourceMessage", "source_message", "sourceFailed", "source_failed", "message", "detail"]);
  return sourceMessage ? getUserFacingErrorMessage(sourceMessage, "") || null : null;
}

function hasPortfolioRiskData(snapshot: PortfolioRiskSnapshotDto | null | undefined) {
  return (
    getRiskExposureRows(snapshot).length > 0 ||
    getRiskOpenOrderRows(snapshot).length > 0 ||
    getRiskOpenHoldingCount(snapshot) !== null ||
    getRiskOpenOrderCount(snapshot) !== null ||
    getRiskTotalMarketValue(snapshot) !== null ||
    getRiskConcentrationWarnings(snapshot).length > 0 ||
    getRiskStalePositionWarnings(snapshot).length > 0 ||
    getRiskStaleOrderWarnings(snapshot).length > 0 ||
    getRiskMissingMetadataWarnings(snapshot).length > 0
  );
}

function mergeMoneyAmounts(values: Array<PortfolioMoneyAmountDto | null | undefined>): PortfolioMoneyAmountDto | null {
  const amounts = values.filter((value): value is PortfolioMoneyAmountDto => Boolean(value) && hasNumber(value?.amount));
  if (amounts.length === 0) return null;

  const currencies = new Set(amounts.map((value) => normalizeCurrency(value.currency)));
  if (currencies.size !== 1) {
    return {
      amount: null,
      currency: null,
      display: `${currencies.size} currencies`,
    };
  }

  const currency = [...currencies][0] ?? "KRW";
  return {
    amount: amounts.reduce((sum, value) => sum + (value.amount ?? 0), 0),
    currency,
  };
}

function getTotalAssets(account: PortfolioAccountDto) {
  return account.summary?.totalAssets ?? account.summary?.totalEquity ?? null;
}

function getWeekPnl(account: PortfolioAccountDto) {
  return account.summary?.pnl?.week ?? null;
}

function getUnrealizedPnl(account: PortfolioAccountDto) {
  return account.summary?.pnl?.unrealized ?? account.summary?.pnl?.total ?? null;
}

function getBuyingPower(account: PortfolioAccountDto) {
  return account.summary?.buyingPower ?? account.summary?.cash ?? null;
}

function getMoneyTone(value: PortfolioMoneyAmountDto | null): PortfolioMetricModel["tone"] {
  if (!hasNumber(value?.amount) || value.amount === 0) return "neutral";
  return value.amount > 0 ? "positive" : "negative";
}

function normalizeStatusToken(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
}

function statusMatches(value: string | null | undefined, tokens: Set<string>) {
  const normalized = normalizeStatusToken(value);
  return normalized ? tokens.has(normalized) : false;
}

function hasMessageSignal(value: string | null | undefined, pattern: RegExp) {
  return pattern.test(value ?? "");
}

function getPortfolioStatusValues(summary: PortfolioSummaryDto | null | undefined) {
  return [summary?.sync?.status, ...getPortfolioAccounts(summary).map((account) => account.status)];
}

function getPortfolioDiagnosticMessages(summary: PortfolioSummaryDto | null | undefined) {
  return [summary?.sync?.message, ...(summary?.notices ?? [])].filter((value): value is string => Boolean(value));
}

function hasNotConfiguredSignal(summary: PortfolioSummaryDto | null | undefined) {
  return (
    getPortfolioStatusValues(summary).some((status) => statusMatches(status, NOT_CONFIGURED_STATUS_TOKENS)) ||
    getPortfolioDiagnosticMessages(summary).some((message) => hasMessageSignal(message, NOT_CONFIGURED_MESSAGE_PATTERN))
  );
}

function hasStaleSyncSignal(summary: PortfolioSummaryDto | null | undefined) {
  return getPortfolioStatusValues(summary).some((status) => statusMatches(status, STALE_SYNC_STATUS_TOKENS));
}

function hasPartialDataSignal(summary: PortfolioSummaryDto | null | undefined) {
  return getPortfolioStatusValues(summary).some((status) => statusMatches(status, PARTIAL_SYNC_STATUS_TOKENS));
}

function hasOwnArray<T extends object>(value: T, key: keyof T) {
  return Array.isArray(value[key]);
}

function hasAllocationRows(summary: PortfolioSummaryDto | null | undefined) {
  return getPortfolioAllocations(summary).length > 0 || getPortfolioHoldings(summary).some((holding) => hasNumber(holding.allocationPercent));
}

function hasMissingHoldingsPayload(summary: PortfolioSummaryDto | null | undefined) {
  return getPortfolioAccounts(summary).some((account) => !hasOwnArray(account, "holdings"));
}

function hasPartialAccountSummary(account: PortfolioAccountDto) {
  return !account.summary || (!getTotalAssets(account) && !getBuyingPower(account));
}

function getLoadedSectionState({
  hasData,
  hasPartialGap = false,
  summaryState,
}: {
  hasData: boolean;
  hasPartialGap?: boolean;
  summaryState: PortfolioSummaryState;
}): PortfolioSectionState {
  if (summaryState === "stale-sync" && hasData) return "stale-sync";
  if (summaryState === "partial-data") return "partial-data";
  if (!hasData) return hasPartialGap ? "partial-data" : "empty";
  if (hasPartialGap) return "partial-data";

  return "fully-synced";
}

export function getPortfolioAccounts(summary: PortfolioSummaryDto | null | undefined) {
  return Array.isArray(summary?.accounts) ? summary.accounts : [];
}

export function getPortfolioHoldings(summary: PortfolioSummaryDto | null | undefined): PortfolioHoldingDto[] {
  return getPortfolioAccounts(summary).flatMap((account) => account.holdings ?? []);
}

function resolvePortfolioCollectionCount(
  count: number,
  hasValidatedCollection: boolean,
  state: PortfolioSummaryState,
) {
  if (!hasValidatedCollection) return null;
  if (
    state === "loading" ||
    state === "endpoint-pending" ||
    state === "invalid-response" ||
    state === "not-configured" ||
    state === "upstream-unavailable"
  ) {
    return null;
  }
  if (count === 0 && state !== "connected-empty" && state !== "fully-synced") return null;

  return count;
}

export function getPortfolioCollectionCounts(
  summary: PortfolioSummaryDto | null | undefined,
  state: PortfolioSummaryState,
): PortfolioCollectionCounts {
  const hasAccountCollection = Array.isArray(summary?.accounts);
  const accounts = getPortfolioAccounts(summary);
  const hasHoldingCollections = hasAccountCollection && accounts.every((account) => Array.isArray(account.holdings));

  return {
    accountCount: resolvePortfolioCollectionCount(accounts.length, hasAccountCollection, state),
    holdingCount: resolvePortfolioCollectionCount(getPortfolioHoldings(summary).length, hasHoldingCollections, state),
  };
}

export function getPortfolioAllocations(summary: PortfolioSummaryDto | null | undefined): PortfolioAllocationDto[] {
  const accounts = getPortfolioAccounts(summary);
  return accounts.flatMap((account) => account.allocation ?? []);
}

export function getPortfolioActivity(summary: PortfolioSummaryDto | null | undefined): PortfolioOrderActivityDto[] {
  return getPortfolioAccounts(summary).flatMap((account) => account.recentActivity ?? []);
}

export function getPortfolioLastSyncedAt(summary: PortfolioSummaryDto | null | undefined) {
  const latestAccountSyncTime =
    getPortfolioAccounts(summary)
      .map((account) => account.lastSyncedAt)
      .filter((value): value is string => Boolean(value))
      .reduce<{ value: string; timestamp: number } | null>((latest, value) => {
        const timestamp = Date.parse(value);
        if (!Number.isFinite(timestamp)) return latest;
        if (!latest || timestamp > latest.timestamp) return { value, timestamp };
        return latest;
      }, null)?.value ?? null;

  return summary?.sync?.lastSyncedAt ?? summary?.asOf ?? latestAccountSyncTime;
}

export function getPortfolioSyncStatus(summary: PortfolioSummaryDto | null | undefined) {
  return normalizeStatusToken(summary?.sync?.status) || null;
}

export function getPortfolioSyncMessage(summary: PortfolioSummaryDto | null | undefined) {
  const message = summary?.sync?.message?.trim();
  if (message) return message;

  return summary?.notices?.find((notice) => notice.trim().length > 0)?.trim() ?? null;
}

export function getPortfolioNoticeMessages(
  summary: PortfolioSummaryDto | null | undefined,
  state: PortfolioSummaryState,
) {
  const notices = summary?.notices ?? [];
  const renderedSyncMessage = state === "partial-data" || state === "stale-sync" ? getPortfolioSyncMessage(summary) : null;
  if (!renderedSyncMessage) return notices;

  let suppressedRenderedNotice = false;
  const normalizedRenderedSyncMessage = renderedSyncMessage.trim();

  return notices.filter((notice) => {
    if (suppressedRenderedNotice || notice.trim() !== normalizedRenderedSyncMessage) return true;

    suppressedRenderedNotice = true;
    return false;
  });
}

export function isPortfolioSummaryDegraded(summary: PortfolioSummaryDto | null | undefined) {
  return isPortfolioSummaryStale(summary) || isPortfolioSummaryPartial(summary);
}

export function isPortfolioSummaryStale(summary: PortfolioSummaryDto | null | undefined) {
  return hasStaleSyncSignal(summary);
}

export function isPortfolioSummaryPartial(summary: PortfolioSummaryDto | null | undefined) {
  return hasPartialDataSignal(summary);
}

export function classifyPortfolioSummaryFailure({ message = null, status }: PortfolioFailureInput): PortfolioSummaryFailureKind {
  const failureKind = classifyTradingApiFailure({ message, status });
  if (failureKind === "endpoint-pending") return "endpoint-pending";
  if (failureKind === "not-configured") return "not-configured";

  return "upstream-unavailable";
}

export function resolvePortfolioRiskSnapshotState({
  error = null,
  failureKind = null,
  loading = false,
  snapshot,
}: PortfolioRiskSnapshotStateInput): PortfolioRiskSnapshotState {
  if (loading && !snapshot && !error) return "loading";
  if (failureKind) return failureKind;
  if (error) return "upstream-unavailable";
  if (!snapshot) return "upstream-unavailable";

  const sourceStatusKey = getPortfolioRiskSourceStatusKey(snapshot);
  if (sourceStatusKey && statusMatches(sourceStatusKey, UNAVAILABLE_RISK_STATUS_TOKENS)) return "unavailable";
  if (getBooleanField(snapshot, ["available"]) === false) return "unavailable";
  if (isRecord(snapshot) && getTextField(snapshot, ["sourceFailed", "source_failed"])) {
    return hasPortfolioRiskData(snapshot) ? "partial-data" : "unavailable";
  }
  if (sourceStatusKey && statusMatches(sourceStatusKey, STALE_RISK_STATUS_TOKENS)) return "stale-sync";
  if (sourceStatusKey && statusMatches(sourceStatusKey, PARTIAL_RISK_STATUS_TOKENS)) return "partial-data";
  if (!hasPortfolioRiskData(snapshot)) return "partial-data";
  if (sourceStatusKey && statusMatches(sourceStatusKey, READY_RISK_STATUS_TOKENS)) return "ready";

  return "ready";
}

export function buildPortfolioRiskSnapshotModel(
  snapshot: PortfolioRiskSnapshotDto | null | undefined,
  fallback = "Unavailable",
): PortfolioRiskSnapshotModel {
  const record = isRecord(snapshot) ? snapshot : null;
  const stalePositionWarnings = getRiskStalePositionWarnings(snapshot);
  const staleOrderWarnings = getRiskStaleOrderWarnings(snapshot);
  const staleWarningCount = stalePositionWarnings.length + staleOrderWarnings.length;
  const sourceStatusKey = getPortfolioRiskSourceStatusKey(snapshot);
  const source = record ? getTextField(record, ["source"]) : null;
  const sourceStatusFallback = sourceStatusKey ? humanizePortfolioRiskToken(sourceStatusKey, fallback) : fallback;

  return {
    concentrationWarnings: buildPortfolioRiskWarningModels(getRiskConcentrationWarnings(snapshot), fallback),
    generatedAt: record ? getTextField(record, ["generatedAt", "generated_at", "asOf", "as_of"]) : null,
    modeLabel: record ? humanizePortfolioRiskToken(getTextField(record, ["mode"]), fallback) : fallback,
    missingMetadataCountLabel: formatPortfolioRiskCount(getRiskMissingMetadataCount(snapshot), fallback),
    notices: record ? getStringArray(record, ["notices"]) : [],
    openHoldingCountLabel: formatPortfolioRiskCount(getRiskOpenHoldingCount(snapshot), fallback),
    openOrderCountLabel: formatPortfolioRiskCount(getRiskOpenOrderCount(snapshot), fallback),
    openOrderNotionalLabel: formatPortfolioMoney(getRiskOpenOrderNotional(snapshot), fallback),
    sourceLabel: source ?? sourceStatusFallback,
    sourceMessage: getPortfolioRiskSourceMessage(snapshot),
    sourceStatusKey,
    staleWarningCountLabel: formatPortfolioRiskCount(staleWarningCount, fallback),
    staleWarnings: buildPortfolioRiskWarningModels([...stalePositionWarnings, ...staleOrderWarnings], fallback),
    topExposures: buildPortfolioRiskExposureModels(snapshot, fallback),
    topOpenOrders: buildPortfolioRiskOpenOrderModels(snapshot, fallback),
    totalMarketValueLabel: formatPortfolioMoney(getRiskTotalMarketValue(snapshot), fallback),
  };
}

export function resolvePortfolioSummaryState({
  error = null,
  failureKind = null,
  loading = false,
  summary,
}: PortfolioSummaryStateInput): PortfolioSummaryState {
  if (loading && !summary && !error) return "loading";
  if (failureKind) return failureKind;
  if (error) return "upstream-unavailable";
  if (!summary) return "upstream-unavailable";
  if (hasNotConfiguredSignal(summary)) return "not-configured";
  if (isPortfolioSummaryStale(summary)) return "stale-sync";
  if (isPortfolioSummaryPartial(summary)) return "partial-data";
  if (getPortfolioHoldings(summary).length === 0) return "connected-empty";

  return "fully-synced";
}

export function resolvePortfolioSectionState(
  section: PortfolioSectionId,
  summaryState: PortfolioSummaryState,
  summary: PortfolioSummaryDto | null | undefined,
): PortfolioSectionState {
  if (
    summaryState === "loading" ||
    summaryState === "endpoint-pending" ||
    summaryState === "invalid-response" ||
    summaryState === "not-configured" ||
    summaryState === "upstream-unavailable"
  ) {
    return summaryState;
  }

  if (section === "hero-metrics") {
    const metrics = buildPortfolioMetricModels(summary);
    return getLoadedSectionState({
      hasData: metrics.some((metric) => metric.available),
      hasPartialGap: metrics.some((metric) => !metric.available),
      summaryState,
    });
  }

  if (section === "accounts") {
    const accounts = getPortfolioAccounts(summary);
    return getLoadedSectionState({
      hasData: accounts.length > 0,
      hasPartialGap: accounts.some(hasPartialAccountSummary),
      summaryState,
    });
  }

  if (section === "holdings") {
    return getLoadedSectionState({
      hasData: getPortfolioHoldings(summary).length > 0,
      hasPartialGap: hasMissingHoldingsPayload(summary),
      summaryState,
    });
  }

  if (section === "allocation") {
    return getLoadedSectionState({
      hasData: hasAllocationRows(summary),
      summaryState,
    });
  }

  return getLoadedSectionState({
    hasData: getPortfolioActivity(summary).length > 0,
    summaryState,
  });
}

export function buildPortfolioSectionStates(
  summary: PortfolioSummaryDto | null | undefined,
  summaryState: PortfolioSummaryState,
): PortfolioSectionStates {
  return {
    "hero-metrics": resolvePortfolioSectionState("hero-metrics", summaryState, summary),
    accounts: resolvePortfolioSectionState("accounts", summaryState, summary),
    holdings: resolvePortfolioSectionState("holdings", summaryState, summary),
    allocation: resolvePortfolioSectionState("allocation", summaryState, summary),
    activity: resolvePortfolioSectionState("activity", summaryState, summary),
  };
}

export function buildPortfolioMetricModels(
  summary: PortfolioSummaryDto | null | undefined,
  fallback = "Unavailable",
): PortfolioMetricModel[] {
  const accounts = getPortfolioAccounts(summary);
  const totalAssets = mergeMoneyAmounts(accounts.map(getTotalAssets));
  const weekPnl = mergeMoneyAmounts(accounts.map(getWeekPnl));
  const unrealizedPnl = mergeMoneyAmounts(accounts.map(getUnrealizedPnl));
  const buyingPower = mergeMoneyAmounts(accounts.map(getBuyingPower));

  return [
    {
      id: "total-assets",
      value: formatPortfolioMoney(totalAssets, fallback),
      tone: "neutral",
      available: totalAssets !== null,
    },
    {
      id: "week-pnl",
      value: formatPortfolioMoney(weekPnl, fallback),
      tone: getMoneyTone(weekPnl),
      available: weekPnl !== null,
    },
    {
      id: "unrealized-pnl",
      value: formatPortfolioMoney(unrealizedPnl, fallback),
      tone: getMoneyTone(unrealizedPnl),
      available: unrealizedPnl !== null,
    },
    {
      id: "cash-buying-power",
      value: formatPortfolioMoney(buyingPower, fallback),
      tone: "neutral",
      available: buyingPower !== null,
    },
  ];
}
