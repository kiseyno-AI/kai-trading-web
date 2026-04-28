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

export type PortfolioSummaryState = "loading" | "unavailable" | "empty" | "degraded" | "ready";

type PortfolioSummaryStateInput = {
  error?: string | null;
  loading?: boolean;
  summary: PortfolioSummaryDto | null | undefined;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  KRW: "₩",
  USD: "$",
};

const DEGRADED_SYNC_STATUSES = new Set([
  "degraded",
  "error",
  "failed",
  "failure",
  "partial",
  "stale",
  "unavailable",
  "warning",
]);

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
  return value?.trim().toLowerCase() ?? "";
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
  const renderedSyncMessage = state === "degraded" ? getPortfolioSyncMessage(summary) : null;
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
  const topLevelStatus = getPortfolioSyncStatus(summary);
  if (topLevelStatus && DEGRADED_SYNC_STATUSES.has(topLevelStatus)) return true;

  return getPortfolioAccounts(summary).some((account) => DEGRADED_SYNC_STATUSES.has(normalizeStatusToken(account.status)));
}

export function resolvePortfolioSummaryState({
  error = null,
  loading = false,
  summary,
}: PortfolioSummaryStateInput): PortfolioSummaryState {
  if (loading && !summary && !error) return "loading";
  if (error || !summary) return "unavailable";
  if (isPortfolioSummaryDegraded(summary)) return "degraded";
  if (getPortfolioHoldings(summary).length === 0) return "empty";

  return "ready";
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
