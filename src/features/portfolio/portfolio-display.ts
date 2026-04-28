import type {
  PortfolioAccountDto,
  PortfolioAllocationDto,
  PortfolioHoldingDto,
  PortfolioMoneyAmountDto,
  PortfolioOrderActivityDto,
  PortfolioSummaryDto,
} from "@/types/trading-api";

export type PortfolioMetricId = "total-assets" | "day-pnl" | "unrealized-pnl" | "cash-buying-power";

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

type PortfolioSummaryStateInput = {
  error?: string | null;
  failureKind?: PortfolioSummaryFailureKind | null;
  loading?: boolean;
  summary: PortfolioSummaryDto | null | undefined;
};

type PortfolioFailureInput = {
  message?: string | null;
  status: number;
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

const NOT_CONFIGURED_MESSAGE_PATTERN =
  /(TRADING_API_UPSTREAM|not configured|config(?:uration)? (?:is )?missing|missing config|missing credentials|no brokerage account|no accounts configured|account.*not configured)/i;

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
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

function getDayPnl(account: PortfolioAccountDto) {
  return account.summary?.pnl?.day ?? null;
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
  if (status === 404) return "endpoint-pending";
  if (status === 401 || status === 403) return "not-configured";
  if (hasMessageSignal(message, NOT_CONFIGURED_MESSAGE_PATTERN)) return "not-configured";
  if (status >= 500 || status === 0) return "upstream-unavailable";

  return "upstream-unavailable";
}

export function resolvePortfolioSummaryState({
  error = null,
  failureKind = null,
  loading = false,
  summary,
}: PortfolioSummaryStateInput): PortfolioSummaryState {
  if (loading && !summary && !error) return "loading";
  if (!summary) return failureKind ?? "upstream-unavailable";
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
  const dayPnl = mergeMoneyAmounts(accounts.map(getDayPnl));
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
      id: "day-pnl",
      value: formatPortfolioMoney(dayPnl, fallback),
      tone: getMoneyTone(dayPnl),
      available: dayPnl !== null,
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
