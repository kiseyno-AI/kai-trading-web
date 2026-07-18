import type { DashboardLiveCopy } from "@/i18n/dashboard-live-copy";
import type {
  ExecutionRuntimeBoardItemDto,
  ExecutionRuntimeDailyBoardResponseDto,
  ExecutionRuntimeMonitoredSymbolDto,
  ExecutionRuntimeMonitoredSymbolsResponseDto,
  ExecutionRuntimeQuantity,
  ExecutionRuntimeStatusResponseDto,
  PortfolioHoldingDto,
  PortfolioMoneyAmountDto,
  PortfolioSummaryDto,
} from "@/types/trading-api";
import {
  buildPortfolioMetricModels,
  formatPortfolioMoney,
  getPortfolioAccounts,
  getPortfolioHoldings,
  type PortfolioSummaryState,
} from "@/features/portfolio/portfolio-display";
import { buildSignalDeciderFeedbackHref } from "@/lib/signal-decider-feedback";
import type {
  CoreMarketStatus,
  CoreTrackedQuote,
  CoreTrackedQuotesResponse,
  ProcessMonitorStatus,
} from "./live-dashboard-types";

type DashboardOverviewCopy = DashboardLiveCopy["dashboardOverview"];

export type OverviewTone = "positive" | "neutral" | "warning";

export type DashboardOverviewMetric = {
  key: string;
  label: string;
  tone: OverviewTone | "negative";
  value: string;
};

export type DashboardOverviewPriceItem = {
  key: string;
  label: string;
  value: string;
};

export type DashboardDeciderRow = {
  compactPriceLine?: string;
  detailHref: string;
  intentLabel?: string | null;
  key: string;
  marketDate: string | null;
  marketLabel: string | null;
  nameLabel: string;
  prices: DashboardOverviewPriceItem[];
  symbol: string;
};

export type DashboardDeciderOverviewModel = {
  contextLabel: string | null;
  detailMarketDate: string | null;
  diagnostics: string[];
  emptyLabel: string | null;
  mode: "market-open" | "closed-completed" | "closed-in-progress" | "closed-planned";
  rows: DashboardDeciderRow[];
  statusLabel: string;
  statusTone: OverviewTone;
};

export type DashboardPortfolioTradeRow = {
  badges?: string[];
  key: string;
  marketLabel: string | null;
  nameLabel: string;
  symbol: string;
  values: DashboardOverviewPriceItem[];
};

export type DashboardPortfolioOverviewModel = {
  accountHoldingRows: DashboardPortfolioTradeRow[];
  accountHoldingStateLabel: string | null;
  contextLabel: string | null;
  diagnostics: string[];
  execConnectionLabel: string;
  execConnectionTone: OverviewTone;
  metrics: DashboardOverviewMetric[];
  monitoringRows: DashboardPortfolioTradeRow[];
  monitoringStateLabel: string | null;
  runtimeHoldingRows: DashboardPortfolioTradeRow[];
  runtimeHoldingStateLabel: string | null;
  statusLabel: string;
  statusTone: OverviewTone;
};

const OPEN_BUY_INTENTS = ["buy", "buy_to_open", "next_open_buy", "next-day buy", "next day buy"];
const SELL_INTENTS = ["sell", "sell_to_close", "target_sell", "stop_sell"];
const PLANNED_BUY_INTENTS = [...OPEN_BUY_INTENTS, "planned_buy", "today_buy"] as const;
const PLANNED_SELL_INTENTS = [
  ...SELL_INTENTS,
  "next_open_sell",
  "next-day sell",
  "next day sell",
  "planned_sell",
  "today_sell",
] as const;
const FILLED_STATUSES = new Set(["filled", "partial"]);
const NEXT_DAY_STATUSES = new Set(["planned", "accepted", "scheduled", "submitted"]);
const REJECTED_OR_EXPIRED_RUNTIME_STATUSES = new Set(["expired", "rejected"]);

function normalizeToken(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
}

function humanizeToken(value: string | null | undefined, fallback: string) {
  const token = value?.trim();
  if (!token) return fallback;

  return token
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function compactDiagnostics(...messages: Array<string | null | undefined>) {
  return messages.map((message) => textOrNull(message)).filter((message): message is string => Boolean(message));
}

function quantityOrUndefined(value: unknown): ExecutionRuntimeQuantity | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) return value;
  return undefined;
}

function quantityToNumber(value: ExecutionRuntimeQuantity | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[,\s₩$]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function getQuantity(record: Record<string, unknown> | null | undefined, keys: readonly string[]) {
  if (!record) return undefined;

  for (const key of keys) {
    const value = quantityOrUndefined(record[key]);
    if (value !== undefined) return value;
  }

  return undefined;
}

function getMoneyAmount(record: Record<string, unknown> | null | undefined, keys: readonly string[]) {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (!value) continue;
    if (typeof value === "string" && value.trim()) {
      return { amount: null, currency: null, display: value.trim() } satisfies PortfolioMoneyAmountDto;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return { amount: value, currency: "KRW" } satisfies PortfolioMoneyAmountDto;
    }
    if (typeof value === "object") {
      const money = value as Partial<PortfolioMoneyAmountDto>;
      if (
        "amount" in money ||
        "currency" in money ||
        "display" in money
      ) {
        return {
          amount: typeof money.amount === "number" && Number.isFinite(money.amount) ? money.amount : null,
          currency: typeof money.currency === "string" ? money.currency : null,
          display: typeof money.display === "string" ? money.display : null,
        } satisfies PortfolioMoneyAmountDto;
      }
    }
  }

  return null;
}

function formatPrice(
  value: ExecutionRuntimeQuantity | undefined,
  numberLocale: string,
  unavailableLabel: string,
) {
  const numericValue = quantityToNumber(value);
  if (numericValue === null) return unavailableLabel;

  return numericValue.toLocaleString(numberLocale, {
    maximumFractionDigits: 4,
  });
}

function formatCompactPriceLine(prices: DashboardOverviewPriceItem[]) {
  return prices.map((price) => `${price.label} ${price.value}`).join(" · ");
}

function buildRecommendationDetailHref({
  marketDate,
  marketLabel,
  nameLabel,
  symbol,
}: {
  marketDate: string | null;
  marketLabel: string | null;
  nameLabel: string;
  symbol: string;
}) {
  const params = new URLSearchParams();
  const forwardableName = textOrNull(nameLabel);
  const forwardableMarket = textOrNull(marketLabel);

  if (forwardableName && forwardableName !== symbol) {
    params.set("name", forwardableName);
  }

  if (forwardableMarket) {
    params.set("market", forwardableMarket);
  }

  if (marketDate) {
    params.set("marketDate", marketDate);
  }

  const query = params.toString();
  return `/dashboard/symbol/${encodeURIComponent(symbol)}/action-summary${query ? `?${query}` : ""}`;
}

function getRowsDetailMarketDate(rows: readonly DashboardDeciderRow[]) {
  return rows.find((row) => textOrNull(row.marketDate))?.marketDate ?? null;
}

export function buildDashboardDeciderMoreHref({
  fallbackHref,
  model,
}: {
  fallbackHref: string;
  model: Pick<DashboardDeciderOverviewModel, "detailMarketDate" | "rows">;
}) {
  if (model.rows.length > 0 && model.detailMarketDate) {
    return buildSignalDeciderFeedbackHref(model.detailMarketDate);
  }

  return fallbackHref;
}

function getTrackedQuoteBySymbol(tracked: CoreTrackedQuotesResponse | null | undefined) {
  return new Map((tracked?.items ?? []).map((item) => [item.symbol, item]));
}

function getBoardItems(board: ExecutionRuntimeDailyBoardResponseDto | null | undefined) {
  return board?.items ?? [];
}

function getBoardItemsBySymbol(board: ExecutionRuntimeDailyBoardResponseDto | null | undefined) {
  const bySymbol = new Map<string, ExecutionRuntimeBoardItemDto[]>();

  for (const item of getBoardItems(board)) {
    const currentItems = bySymbol.get(item.symbol) ?? [];
    currentItems.push(item);
    bySymbol.set(item.symbol, currentItems);
  }

  return bySymbol;
}

function findSupportingBoardItem(
  symbol: string,
  bySymbol: Map<string, ExecutionRuntimeBoardItemDto[]>,
) {
  const items = bySymbol.get(symbol) ?? [];
  return (
    items.find((item) => getQuantity(item, ["target_price", "stop_loss_price"]) !== undefined) ??
    items[0] ??
    null
  );
}

function getItemName(
  item: ExecutionRuntimeMonitoredSymbolDto | ExecutionRuntimeBoardItemDto,
  quote: CoreTrackedQuote | null | undefined,
) {
  return (
    textOrNull(item.name) ??
    textOrNull(quote?.company_name) ??
    textOrNull(quote?.name) ??
    textOrNull(quote?.name_ko) ??
    item.symbol
  );
}

function getCurrentPrice(
  item: ExecutionRuntimeMonitoredSymbolDto,
  quote: CoreTrackedQuote | null | undefined,
) {
  const itemPrice = getQuantity(item, ["current_price", "last_price", "price"]);
  if (itemPrice !== undefined) return itemPrice;
  if (quote?.available === true && quote.price !== null) return quote.price;
  return undefined;
}

function getClosedPrice(item: ExecutionRuntimeBoardItemDto) {
  return getQuantity(item, ["market_close_price", "close_price", "eod_close_price", "last_close_price"]);
}

function getTargetPrice(
  primary: Record<string, unknown>,
  fallback: Record<string, unknown> | null | undefined,
) {
  return getQuantity(primary, ["target_price"]) ?? getQuantity(fallback, ["target_price"]);
}

function getStopLossPrice(primary: Record<string, unknown> | null | undefined) {
  return getQuantity(primary, ["stop_loss_price", "stop_price"]);
}

function getStopLossPriceWithFallback(
  primary: Record<string, unknown>,
  fallback: Record<string, unknown> | null | undefined,
) {
  return getStopLossPrice(primary) ?? getStopLossPrice(fallback);
}

function hasAnyIntent(item: Record<string, unknown>, intentTokens: readonly string[]) {
  const plannedIntents = Array.isArray(item.planned_intents)
    ? item.planned_intents.map((value) => normalizeToken(textOrNull(value))).filter(Boolean)
    : [];

  return [...getDirectIntentTokens(item), ...plannedIntents].some((value) =>
    intentTokens.some((token) => {
      const normalizedToken = normalizeToken(token);
      return value === normalizedToken || value.includes(normalizedToken);
    }),
  );
}

function getDirectIntentTokens(item: Record<string, unknown>) {
  const directIntentKeys = ["intent", "side", "order_side", "position_side", "action"];
  return directIntentKeys.map((key) => normalizeToken(textOrNull(item[key]))).filter(Boolean);
}

function isFilledExecutionItem(item: ExecutionRuntimeBoardItemDto) {
  return FILLED_STATUSES.has(normalizeToken(item.status));
}

function isNextDayExecutionCandidate(item: ExecutionRuntimeBoardItemDto, boardMarketDate: string | null) {
  const targetTradeDate = textOrNull(item.target_trade_date);
  if (targetTradeDate && (!boardMarketDate || targetTradeDate !== boardMarketDate)) return true;
  if (hasAnyIntent(item, ["next_open_buy", "next_open_sell", "next_day_exec", "next"])) return true;
  return NEXT_DAY_STATUSES.has(normalizeToken(item.status));
}

function getPlannedTradeSide(item: ExecutionRuntimeBoardItemDto) {
  if (hasAnyIntent(item, PLANNED_BUY_INTENTS)) return "buy";
  if (hasAnyIntent(item, PLANNED_SELL_INTENTS)) return "sell";
  return null;
}

function getDatePart(value: string | null | undefined) {
  const datePart = value?.trim().slice(0, 10) ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
}

function isTodayPlannedTrade(
  item: ExecutionRuntimeBoardItemDto,
  boardMarketDate: string | null,
  currentMarketDate: string | null,
) {
  const targetTradeDate = textOrNull(item.target_trade_date);
  if (targetTradeDate) return targetTradeDate === currentMarketDate;
  if (!currentMarketDate) return !boardMarketDate;
  return !boardMarketDate || boardMarketDate === currentMarketDate;
}

function getPlannedTradeIntentLabel(
  item: ExecutionRuntimeBoardItemDto,
  boardMarketDate: string | null,
  currentMarketDate: string | null,
  copy: DashboardOverviewCopy,
) {
  const side = getPlannedTradeSide(item);
  const todayPlan = isTodayPlannedTrade(item, boardMarketDate, currentMarketDate);
  if (side === "buy") return todayPlan ? copy.plannedBuyToday : copy.plannedBuyNext;
  if (side === "sell") return todayPlan ? copy.plannedSellToday : copy.plannedSellNext;

  const rawIntent = textOrNull(item.intent) ?? textOrNull(item.side) ?? textOrNull(item.action);
  return rawIntent ? humanizeToken(rawIntent, copy.plannedTrade) : null;
}

function isPlannedTradeCandidate(item: ExecutionRuntimeBoardItemDto, boardMarketDate: string | null) {
  if (!getPlannedTradeSide(item)) return false;
  if (isFilledExecutionItem(item)) return false;
  return isNextDayExecutionCandidate(item, boardMarketDate);
}

function buildClosedMarketDeciderRow({
  boardMarketDate,
  copy,
  currentMarketDate,
  index,
  item,
  numberLocale,
}: {
  boardMarketDate: string | null;
  copy: DashboardOverviewCopy;
  currentMarketDate: string | null;
  index: number;
  item: ExecutionRuntimeBoardItemDto;
  numberLocale: string;
}): DashboardDeciderRow {
  const marketLabel = textOrNull(item.market);
  const nameLabel = textOrNull(item.name) ?? item.symbol;
  const sourceMarketDate = textOrNull(item.source_market_date) ?? boardMarketDate ?? currentMarketDate;

  return {
    detailHref: buildRecommendationDetailHref({
      marketDate: sourceMarketDate,
      marketLabel,
      nameLabel,
      symbol: item.symbol,
    }),
    intentLabel: getPlannedTradeIntentLabel(item, boardMarketDate, currentMarketDate, copy),
    key: `${item.symbol}-${item.execution_plan_id ?? item.plan_item_id ?? index}`,
    marketDate: sourceMarketDate,
    marketLabel,
    nameLabel,
    prices: [
      {
        key: "stop-loss",
        label: copy.stopLossPrice,
        value: formatPrice(getStopLossPriceWithFallback(item, null), numberLocale, copy.unavailable),
      },
      {
        key: "target",
        label: copy.targetPrice,
        value: formatPrice(getTargetPrice(item, null), numberLocale, copy.unavailable),
      },
      {
        key: "close",
        label: copy.closePrice,
        value: formatPrice(getClosedPrice(item), numberLocale, copy.unavailable),
      },
    ],
    symbol: item.symbol,
  };
}

function formatCount(
  count: number | null,
  singular: string,
  plural: string,
  numberLocale: string,
  unavailableLabel: string,
) {
  if (count === null) return unavailableLabel;
  return `${count.toLocaleString(numberLocale)} ${count === 1 ? singular : plural}`;
}

function getPortfolioMetricFallback(state: PortfolioSummaryState, copy: DashboardLiveCopy) {
  if (state === "loading") return copy.portfolioState.loading;
  if (
    state === "endpoint-pending" ||
    state === "invalid-response" ||
    state === "not-configured" ||
    state === "upstream-unavailable"
  ) {
    return copy.portfolioState.unavailableMetric;
  }
  if (state === "partial-data" || state === "stale-sync") return copy.portfolioState.degradedMetric;
  if (state === "connected-empty") return copy.portfolioState.emptyMetric;

  return copy.portfolioState.waiting;
}

function getPortfolioStatusLabel(state: PortfolioSummaryState, copy: DashboardLiveCopy) {
  if (state === "loading") return copy.portfolioState.statusLoading;
  if (state === "connected-empty") return copy.portfolioState.statusEmpty;
  if (
    state === "endpoint-pending" ||
    state === "invalid-response" ||
    state === "not-configured" ||
    state === "upstream-unavailable"
  ) {
    return copy.portfolioState.statusUnavailable;
  }
  if (state === "partial-data" || state === "stale-sync") return copy.portfolioState.statusDegraded;
  return copy.portfolioState.statusReady;
}

function getPortfolioStatusTone(state: PortfolioSummaryState): OverviewTone {
  if (state === "fully-synced") return "positive";
  if (
    state === "endpoint-pending" ||
    state === "invalid-response" ||
    state === "not-configured" ||
    state === "partial-data" ||
    state === "stale-sync" ||
    state === "upstream-unavailable"
  ) {
    return "warning";
  }
  return "neutral";
}

function isPortfolioSummaryBlockingState(state: PortfolioSummaryState) {
  return (
    state === "loading" ||
    state === "endpoint-pending" ||
    state === "invalid-response" ||
    state === "not-configured" ||
    state === "upstream-unavailable"
  );
}

function getPortfolioAvailabilityContext(state: PortfolioSummaryState, copy: DashboardLiveCopy) {
  if (state === "loading") return copy.portfolioState.loadingSummary;
  if (isPortfolioSummaryBlockingState(state)) return copy.portfolioState.unavailable;
  if (state === "partial-data" || state === "stale-sync") return copy.portfolioState.degradedSummary;
  if (state === "connected-empty") return copy.portfolioState.emptySummary;
  return null;
}

function getHeldPositionCount(summary: PortfolioSummaryDto | null | undefined) {
  if (!summary) return null;
  const accounts = getPortfolioAccounts(summary);
  if (accounts.length > 0 && accounts.every((account) => !Array.isArray(account.holdings))) return null;
  return getPortfolioHoldings(summary).length;
}

function formatQuantity(value: ExecutionRuntimeQuantity | undefined, numberLocale: string, unavailableLabel: string) {
  const numericValue = quantityToNumber(value);
  if (numericValue === null) return unavailableLabel;

  return numericValue.toLocaleString(numberLocale, {
    maximumFractionDigits: 4,
  });
}

function getMonitoringStateLabel(
  state: ExecutionRuntimeMonitoredSymbolDto["monitoring_state"] | null | undefined,
  copy: DashboardLiveCopy,
) {
  const normalizedState = normalizeToken(state);
  if (normalizedState === "watching_target_stop") return copy.executionRuntime.monitoringStates.watchingTargetStop;
  if (normalizedState === "watching_fill") return copy.executionRuntime.monitoringStates.watchingFill;
  if (normalizedState === "reconciling") return copy.executionRuntime.monitoringStates.reconciling;
  if (normalizedState === "idle") return copy.executionRuntime.monitoringStates.idle;
  return humanizeToken(state, copy.executionRuntime.monitoringStates.unknown);
}

function getTargetProfileLabel(item: Record<string, unknown>) {
  const profile =
    textOrNull(item.exec_agent_target_profile) ??
    textOrNull(item.target_profile) ??
    textOrNull(item.targetProfile) ??
    textOrNull(item.profile);
  const tag =
    textOrNull(item.exec_agent_target_tag) ??
    textOrNull(item.target_tag) ??
    textOrNull(item.targetTag) ??
    textOrNull(item.tag);

  if (profile && tag && normalizeToken(profile) !== normalizeToken(tag)) return `${profile} / ${tag}`;
  return profile ?? tag;
}

function getRuntimeStatusTokens(item: Record<string, unknown>) {
  const directStatusKeys = [
    "status",
    "approval_status",
    "exec_agent_status",
    "exec_status",
    "execution_status",
    "monitoring_status",
  ];
  const directStatuses = directStatusKeys.map((key) => normalizeToken(textOrNull(item[key]))).filter(Boolean);
  const monitoringStatuses = Array.isArray(item.monitoring_statuses)
    ? item.monitoring_statuses.map((value) => normalizeToken(textOrNull(value))).filter(Boolean)
    : [];
  const monitoringStatusCounts =
    item.monitoring_statuses && typeof item.monitoring_statuses === "object" && !Array.isArray(item.monitoring_statuses)
      ? Object.entries(item.monitoring_statuses)
          .filter(([, count]) => typeof count === "number" && count > 0)
          .map(([status]) => normalizeToken(status))
      : [];

  return [...directStatuses, ...monitoringStatuses, ...monitoringStatusCounts];
}

function isRejectedOrExpiredRuntimeRow(item: Record<string, unknown>) {
  return getRuntimeStatusTokens(item).some((status) => REJECTED_OR_EXPIRED_RUNTIME_STATUSES.has(status));
}

function isExplicitlyUnapprovedRuntimeRow(item: Record<string, unknown>) {
  return item.exec_agent_approved === false || item.exec_monitoring_active === false;
}

function isExecApprovedMonitoringRow(item: ExecutionRuntimeMonitoredSymbolDto) {
  return !isExplicitlyUnapprovedRuntimeRow(item) && !isRejectedOrExpiredRuntimeRow(item);
}

function getRuntimeHeldQuantity(item: Record<string, unknown>) {
  return getQuantity(item, ["position_quantity", "held_quantity", "quantity"]);
}

function hasRuntimeHeldPosition(item: Record<string, unknown>) {
  if (item.held_position === true) return true;
  const quantity = quantityToNumber(getRuntimeHeldQuantity(item));
  return quantity !== null && quantity > 0;
}

function isActivePortfolioHolding(holding: PortfolioHoldingDto) {
  return holding.quantity !== 0;
}

function getHoldingQuantity(holding: PortfolioHoldingDto) {
  return typeof holding.quantity === "number" && Number.isFinite(holding.quantity) ? holding.quantity : undefined;
}

function mergeMoneyAmount(
  current: PortfolioMoneyAmountDto | null,
  next: PortfolioMoneyAmountDto | null | undefined,
) {
  if (!next) return current;
  if (!current) return next;
  if (typeof current.amount !== "number" || !Number.isFinite(current.amount)) return current;
  if (typeof next.amount !== "number" || !Number.isFinite(next.amount)) return current;
  const currentCurrency = current.currency ?? "KRW";
  const nextCurrency = next.currency ?? "KRW";
  if (currentCurrency !== nextCurrency) return current;
  return {
    amount: current.amount + next.amount,
    currency: currentCurrency,
  } satisfies PortfolioMoneyAmountDto;
}

type HoldingSnapshot = {
  averagePrice: PortfolioMoneyAmountDto | null;
  lastPrice: PortfolioMoneyAmountDto | null;
  marketLabel: string | null;
  marketValue: PortfolioMoneyAmountDto | null;
  nameLabel: string;
  quantity: ExecutionRuntimeQuantity | undefined;
  runtimeItem: ExecutionRuntimeMonitoredSymbolDto | null;
  symbol: string;
  unrealizedPnl: PortfolioMoneyAmountDto | null;
};

function upsertHoldingSnapshot(
  bySymbol: Map<string, HoldingSnapshot>,
  snapshot: HoldingSnapshot,
  { sumQuantity = true }: { sumQuantity?: boolean } = {},
) {
  const current = bySymbol.get(snapshot.symbol);
  if (!current) {
    bySymbol.set(snapshot.symbol, snapshot);
    return;
  }

  const currentQuantity = quantityToNumber(current.quantity);
  const nextQuantity = quantityToNumber(snapshot.quantity);
  current.quantity =
    sumQuantity && currentQuantity !== null && nextQuantity !== null
      ? currentQuantity + nextQuantity
      : current.quantity ?? snapshot.quantity;
  current.averagePrice ??= snapshot.averagePrice;
  current.lastPrice ??= snapshot.lastPrice;
  current.marketLabel ??= snapshot.marketLabel;
  current.marketValue = mergeMoneyAmount(current.marketValue, snapshot.marketValue);
  current.nameLabel = current.nameLabel || snapshot.nameLabel;
  current.runtimeItem ??= snapshot.runtimeItem;
  current.unrealizedPnl = mergeMoneyAmount(current.unrealizedPnl, snapshot.unrealizedPnl);
}

function buildPortfolioHoldingSnapshots(summary: PortfolioSummaryDto | null | undefined) {
  const bySymbol = new Map<string, HoldingSnapshot>();

  for (const holding of getPortfolioHoldings(summary)) {
    const symbol = textOrNull(holding.symbol);
    if (!symbol || !isActivePortfolioHolding(holding)) continue;

    upsertHoldingSnapshot(bySymbol, {
      averagePrice: holding.averagePrice ?? null,
      lastPrice: holding.lastPrice ?? null,
      marketLabel: textOrNull(holding.market),
      marketValue: holding.marketValue ?? null,
      nameLabel: textOrNull(holding.name) ?? symbol,
      quantity: getHoldingQuantity(holding),
      runtimeItem: null,
      symbol,
      unrealizedPnl: holding.unrealizedPnl ?? null,
    });
  }

  return bySymbol;
}

function buildRuntimeHoldingSnapshot(item: ExecutionRuntimeMonitoredSymbolDto): HoldingSnapshot {
  const symbol = item.symbol;
  return {
    averagePrice: getMoneyAmount(item, ["position_average_price", "average_price", "avg_price"]),
    lastPrice: getMoneyAmount(item, ["current_price", "last_price", "price"]),
    marketLabel: textOrNull(item.market),
    marketValue: getMoneyAmount(item, ["position_market_value", "market_value"]),
    nameLabel: textOrNull(item.name) ?? symbol,
    quantity: getRuntimeHeldQuantity(item),
    runtimeItem: item,
    symbol,
    unrealizedPnl: getMoneyAmount(item, ["position_unrealized_pnl", "unrealized_pnl", "unrealizedPnl"]),
  };
}

function buildRuntimeHoldingSnapshots(monitoredItems: ExecutionRuntimeMonitoredSymbolDto[]) {
  const bySymbol = new Map<string, HoldingSnapshot>();
  for (const item of monitoredItems) {
    if (!hasRuntimeHeldPosition(item)) continue;
    upsertHoldingSnapshot(bySymbol, buildRuntimeHoldingSnapshot(item));
  }

  return bySymbol;
}

function buildMonitoringRow({
  copy,
  holding,
  holdingBadgeLabel,
  item,
  numberLocale,
}: {
  copy: DashboardLiveCopy;
  holding: HoldingSnapshot | null;
  holdingBadgeLabel?: string | null;
  item: ExecutionRuntimeMonitoredSymbolDto;
  numberLocale: string;
}): DashboardPortfolioTradeRow {
  const overviewCopy = copy.dashboardOverview;
  const approvedQuantity = getQuantity(item, ["approved_quantity", "planned_quantity"]);
  const approvedNotional = getMoneyAmount(item, ["approved_notional"]);
  const targetProfile = getTargetProfileLabel(item);
  const stateLabel = getMonitoringStateLabel(item.monitoring_state, copy);
  const quantity = approvedQuantity ?? holding?.quantity;
  const quantityLabel = approvedQuantity !== undefined ? overviewCopy.approvedQuantity : overviewCopy.quantity;
  const values: DashboardOverviewPriceItem[] = [
    {
      key: "state",
      label: overviewCopy.monitoringState,
      value: stateLabel,
    },
    ...(targetProfile
      ? [
          {
            key: "target-profile",
            label: overviewCopy.targetProfile,
            value: targetProfile,
          },
        ]
      : []),
    {
      key: "current",
      label: overviewCopy.currentPrice,
      value: formatPrice(getCurrentPrice(item, null), numberLocale, overviewCopy.unavailable),
    },
    {
      key: "target",
      label: overviewCopy.targetPrice,
      value: formatPrice(getTargetPrice(item, null), numberLocale, overviewCopy.unavailable),
    },
    {
      key: "stop",
      label: overviewCopy.stopLossPrice,
      value: formatPrice(getStopLossPriceWithFallback(item, null), numberLocale, overviewCopy.unavailable),
    },
    {
      key: "quantity",
      label: quantityLabel,
      value: formatQuantity(quantity, numberLocale, overviewCopy.unavailable),
    },
    ...(approvedNotional
      ? [
          {
            key: "approved-notional",
            label: overviewCopy.approvedNotional,
            value: formatPortfolioMoney(approvedNotional, overviewCopy.unavailable),
          },
        ]
      : []),
  ];

  if (holding?.averagePrice) {
    values.push({
      key: "average-price",
      label: overviewCopy.averagePrice,
      value: formatPortfolioMoney(holding.averagePrice, overviewCopy.unavailable),
    });
  }

  return {
    badges: [overviewCopy.execApproved, stateLabel, ...(holding && holdingBadgeLabel ? [holdingBadgeLabel] : [])],
    key: `${item.symbol}-monitoring`,
    marketLabel: textOrNull(item.market) ?? holding?.marketLabel ?? null,
    nameLabel: textOrNull(item.name) ?? holding?.nameLabel ?? item.symbol,
    symbol: item.symbol,
    values,
  };
}

function buildHoldingRow({
  badgeLabel,
  copy,
  holding,
  numberLocale,
}: {
  badgeLabel: string;
  copy: DashboardLiveCopy;
  holding: HoldingSnapshot;
  numberLocale: string;
}): DashboardPortfolioTradeRow {
  const overviewCopy = copy.dashboardOverview;
  const runtimeItem = holding.runtimeItem;
  const runtimeTargetProfile = runtimeItem ? getTargetProfileLabel(runtimeItem) : null;
  const values: DashboardOverviewPriceItem[] = [
    {
      key: "quantity",
      label: overviewCopy.quantity,
      value: formatQuantity(holding.quantity, numberLocale, overviewCopy.unavailable),
    },
    {
      key: "average-price",
      label: overviewCopy.averagePrice,
      value: formatPortfolioMoney(holding.averagePrice, overviewCopy.unavailable),
    },
    {
      key: "last-price",
      label: overviewCopy.currentPrice,
      value: formatPortfolioMoney(holding.lastPrice, overviewCopy.unavailable),
    },
    ...(runtimeTargetProfile
      ? [
          {
            key: "target-profile",
            label: overviewCopy.targetProfile,
            value: runtimeTargetProfile,
          },
        ]
      : []),
    ...(runtimeItem
      ? [
          {
            key: "target",
            label: overviewCopy.targetPrice,
            value: formatPrice(getTargetPrice(runtimeItem, null), numberLocale, overviewCopy.unavailable),
          },
          {
            key: "stop",
            label: overviewCopy.stopLossPrice,
            value: formatPrice(getStopLossPriceWithFallback(runtimeItem, null), numberLocale, overviewCopy.unavailable),
          },
        ]
      : []),
    {
      key: "market-value",
      label: overviewCopy.marketValue,
      value: formatPortfolioMoney(holding.marketValue, overviewCopy.unavailable),
    },
    {
      key: "unrealized-pnl",
      label: overviewCopy.unrealizedPnl,
      value: formatPortfolioMoney(holding.unrealizedPnl, overviewCopy.unavailable),
    },
  ];

  return {
    badges: [badgeLabel],
    key: `${holding.symbol}-holding`,
    marketLabel: holding.marketLabel,
    nameLabel: holding.nameLabel,
    symbol: holding.symbol,
    values,
  };
}

export function buildDashboardDeciderOverviewModel({
  board,
  boardError,
  copy,
  market,
  monitoredSymbols,
  monitoredSymbolsError,
  numberLocale,
  processStatus,
  tracked,
  trackedError,
}: {
  board: ExecutionRuntimeDailyBoardResponseDto | null;
  boardError?: string | null;
  copy: DashboardLiveCopy;
  market: CoreMarketStatus;
  monitoredSymbols: ExecutionRuntimeMonitoredSymbolsResponseDto | null;
  monitoredSymbolsError?: string | null;
  numberLocale: string;
  processStatus: ProcessMonitorStatus;
  tracked: CoreTrackedQuotesResponse | null;
  trackedError?: string | null;
}): DashboardDeciderOverviewModel {
  const overviewCopy = copy.dashboardOverview;
  const boardBySymbol = getBoardItemsBySymbol(board);
  const quoteBySymbol = getTrackedQuoteBySymbol(tracked);
  const diagnostics = compactDiagnostics(monitoredSymbolsError, boardError, trackedError);

  if (market.is_open) {
    const sourceMarketDate = monitoredSymbols?.market_date ?? getDatePart(market.server_time);
    const rows = (monitoredSymbols?.items ?? []).map((item) => {
      const supportingBoardItem = findSupportingBoardItem(item.symbol, boardBySymbol);
      const quote = quoteBySymbol.get(item.symbol);
      const marketLabel = textOrNull(item.market) ?? textOrNull(quote?.market_state);
      const nameLabel = getItemName(item, quote);
      const stopLossPrice = getStopLossPriceWithFallback(item, supportingBoardItem);
      const targetPrice = getTargetPrice(item, supportingBoardItem);
      const currentPrice = getCurrentPrice(item, quote);
      const compactPrices = [
        {
          key: "stop-loss",
          label: overviewCopy.stopLossPriceCompact,
          value: formatPrice(stopLossPrice, numberLocale, "—"),
        },
        {
          key: "target",
          label: overviewCopy.targetPriceCompact,
          value: formatPrice(targetPrice, numberLocale, "—"),
        },
        {
          key: "current",
          label: overviewCopy.currentPriceCompact,
          value: formatPrice(currentPrice, numberLocale, "—"),
        },
      ];

      return {
        compactPriceLine: formatCompactPriceLine(compactPrices),
        detailHref: buildRecommendationDetailHref({
          marketDate: sourceMarketDate,
          marketLabel,
          nameLabel,
          symbol: item.symbol,
        }),
        key: item.symbol,
        marketDate: sourceMarketDate,
        marketLabel,
        nameLabel,
        prices: [
          {
            key: "stop-loss",
            label: overviewCopy.stopLossPrice,
            value: formatPrice(stopLossPrice, numberLocale, overviewCopy.unavailable),
          },
          {
            key: "target",
            label: overviewCopy.targetPrice,
            value: formatPrice(targetPrice, numberLocale, overviewCopy.unavailable),
          },
          {
            key: "current",
            label: overviewCopy.currentPrice,
            value: formatPrice(currentPrice, numberLocale, overviewCopy.unavailable),
          },
        ],
        symbol: item.symbol,
      };
    });
    const hasMarketOpenRuntimeDelay = Boolean(monitoredSymbolsError || trackedError);
    const marketOpenContext = [
      overviewCopy.marketOpenContext,
      hasMarketOpenRuntimeDelay ? overviewCopy.runtimeDataDelayed : null,
      trackedError ? overviewCopy.trackedQuotesUnavailable : null,
    ].filter(Boolean).join(" ");

    return {
      contextLabel: marketOpenContext,
      detailMarketDate: getRowsDetailMarketDate(rows),
      diagnostics,
      emptyLabel:
        rows.length > 0
          ? null
          : monitoredSymbolsError
            ? overviewCopy.monitoringListUpdating
            : overviewCopy.noMonitoredStocks,
      mode: "market-open",
      rows,
      statusLabel: hasMarketOpenRuntimeDelay ? overviewCopy.runtimeDelayed : overviewCopy.marketOpen,
      statusTone: hasMarketOpenRuntimeDelay ? "warning" : "positive",
    };
  }

  if (processStatus === "running") {
    return {
      contextLabel: null,
      detailMarketDate: null,
      diagnostics,
      emptyLabel: overviewCopy.processInProgress,
      mode: "closed-in-progress",
      rows: [],
      statusLabel: overviewCopy.processRunning,
      statusTone: "neutral",
    };
  }

  const boardMarketDate = board?.market_date ?? board?.request?.market_date ?? null;
  const currentMarketDate = getDatePart(market.server_time);
  const hasBoardRuntimeDelay = Boolean(boardError);

  if (processStatus !== "completed") {
    const rows = getBoardItems(board)
      .filter((item) => isPlannedTradeCandidate(item, boardMarketDate))
      .map((item, index) =>
        buildClosedMarketDeciderRow({ boardMarketDate, copy: overviewCopy, currentMarketDate, index, item, numberLocale }),
      );
    const isTodayPlan = rows.length > 0 && getBoardItems(board)
      .filter((item) => isPlannedTradeCandidate(item, boardMarketDate))
      .every((item) => isTodayPlannedTrade(item, boardMarketDate, currentMarketDate));

    return {
      contextLabel: rows.length > 0 ? overviewCopy.plannedTradesContext : null,
      detailMarketDate: getRowsDetailMarketDate(rows),
      diagnostics,
      emptyLabel:
        rows.length > 0
          ? null
          : boardError
            ? overviewCopy.executionBoardUpdating
            : board
              ? overviewCopy.noPlannedTrades
              : overviewCopy.executionBoardUnavailable,
      mode: "closed-planned",
      rows,
      statusLabel:
        rows.length > 0
          ? isTodayPlan
            ? overviewCopy.plannedTradesToday
            : overviewCopy.plannedTrades
          : copy.processMonitor.statuses[processStatus],
      statusTone: rows.length > 0 ? "neutral" : processStatus === "pending" ? "neutral" : "warning",
    };
  }

  const rows = getBoardItems(board)
    .filter((item) => isNextDayExecutionCandidate(item, boardMarketDate))
    .map((item, index) =>
      buildClosedMarketDeciderRow({ boardMarketDate, copy: overviewCopy, currentMarketDate, index, item, numberLocale }),
    );

  return {
    contextLabel: hasBoardRuntimeDelay
      ? `${overviewCopy.marketClosedCompletedContext} ${overviewCopy.executionBoardUpdating}`
      : overviewCopy.marketClosedCompletedContext,
    detailMarketDate: getRowsDetailMarketDate(rows),
    diagnostics,
    emptyLabel:
      rows.length > 0
        ? null
        : boardError
          ? overviewCopy.executionBoardUpdating
          : board
            ? overviewCopy.noNextDayExecStocks
            : overviewCopy.executionBoardUnavailable,
    mode: "closed-completed",
    rows,
    statusLabel: overviewCopy.nextDayExec,
    statusTone: hasBoardRuntimeDelay ? "warning" : "neutral",
  };
}

export function buildDashboardPortfolioOverviewModel({
  copy,
  executionStatus,
  executionStatusError,
  monitoredSymbols,
  monitoredSymbolsError,
  numberLocale,
  portfolioSummaryError = null,
  portfolioState,
  summary,
}: {
  copy: DashboardLiveCopy;
  executionStatus: ExecutionRuntimeStatusResponseDto | null;
  executionStatusError: string | null;
  monitoredSymbols: ExecutionRuntimeMonitoredSymbolsResponseDto | null;
  monitoredSymbolsError: string | null;
  numberLocale: string;
  portfolioSummaryError?: string | null;
  portfolioState: PortfolioSummaryState;
  summary: PortfolioSummaryDto | null;
}): DashboardPortfolioOverviewModel {
  const overviewCopy = copy.dashboardOverview;
  const metricFallback = getPortfolioMetricFallback(portfolioState, copy);
  const shouldRenderPortfolioSummaryValues = !isPortfolioSummaryBlockingState(portfolioState);
  const displaySummary = shouldRenderPortfolioSummaryValues ? summary : null;
  const portfolioMetrics = buildPortfolioMetricModels(displaySummary, metricFallback);
  const totalAssets = portfolioMetrics.find((metric) => metric.id === "total-assets");
  const weekPnl = portfolioMetrics.find((metric) => metric.id === "week-pnl");
  const hasPortfolioAccounts = getPortfolioAccounts(displaySummary).length > 0;
  const weekPnlPending = hasPortfolioAccounts && weekPnl?.available !== true;
  const heldPositionCount = shouldRenderPortfolioSummaryValues ? getHeldPositionCount(summary) : null;
  const execConnected = executionStatus?.exec_connected === true;
  const monitoredItems = monitoredSymbols?.items ?? [];
  const accountHoldingBySymbol = shouldRenderPortfolioSummaryValues
    ? buildPortfolioHoldingSnapshots(summary)
    : new Map<string, HoldingSnapshot>();
  const runtimeHoldingBySymbol = buildRuntimeHoldingSnapshots(monitoredItems);
  const monitoringRows = monitoredItems
    .filter((item) => isExecApprovedMonitoringRow(item))
    .map((item) => {
      const accountHolding = accountHoldingBySymbol.get(item.symbol) ?? null;
      const runtimeHolding = runtimeHoldingBySymbol.get(item.symbol) ?? null;
      const holding = accountHolding ?? runtimeHolding;
      const holdingBadgeLabel = accountHolding
        ? overviewCopy.accountHeld
        : runtimeHolding
          ? overviewCopy.runtimeHeld
          : null;

      return buildMonitoringRow({
        copy,
        holding,
        holdingBadgeLabel,
        item,
        numberLocale,
      });
    });
  const monitoringSymbols = new Set(monitoringRows.map((row) => row.symbol));
  const accountHoldingRows = Array.from(accountHoldingBySymbol.values()).map((holding) =>
    buildHoldingRow({ badgeLabel: overviewCopy.accountHeld, copy, holding, numberLocale }),
  );
  const runtimeHoldingRows = Array.from(runtimeHoldingBySymbol.values())
    .filter((holding) => !monitoringSymbols.has(holding.symbol))
    .map((holding) => buildHoldingRow({ badgeLabel: overviewCopy.runtimeHeld, copy, holding, numberLocale }));
  const hasRuntimeDataDelay = Boolean(executionStatusError || monitoredSymbolsError);
  const runtimeRowsUnavailable = hasRuntimeDataDelay || !monitoredSymbols;
  const contextLabel = [
    copy.portfolioState.dashboardContext,
    getPortfolioAvailabilityContext(portfolioState, copy),
    hasRuntimeDataDelay ? overviewCopy.runtimeDataDelayed : null,
  ].filter(Boolean).join(" ");
  const diagnostics = compactDiagnostics(portfolioSummaryError, executionStatusError, monitoredSymbolsError);

  return {
    accountHoldingRows,
    accountHoldingStateLabel:
      accountHoldingRows.length > 0
        ? null
        : displaySummary
          ? overviewCopy.noAccountHoldingRows
          : overviewCopy.accountHoldingsUnavailable,
    contextLabel,
    diagnostics,
    execConnectionLabel: execConnected
      ? overviewCopy.execConnected
      : executionStatus
        ? overviewCopy.execDisconnected
        : overviewCopy.unavailable,
    execConnectionTone: execConnected ? "positive" : "warning",
    metrics: [
      {
        key: "exec-connection",
        label: overviewCopy.execIntegration,
        tone: execConnected ? "positive" : "warning",
        value: execConnected
          ? overviewCopy.execConnected
          : executionStatus
            ? overviewCopy.execDisconnected
            : overviewCopy.unavailable,
      },
      {
        key: "total-assets",
        label: copy.portfolioState.metrics.totalAssets,
        tone: shouldRenderPortfolioSummaryValues ? totalAssets?.tone ?? "neutral" : "warning",
        value: totalAssets?.value ?? metricFallback,
      },
      {
        key: "week-pnl",
        label: copy.portfolioState.metrics.dayPnl,
        tone: shouldRenderPortfolioSummaryValues ? weekPnlPending ? "neutral" : weekPnl?.tone ?? "neutral" : "warning",
        value:
          weekPnl?.available === true
            ? weekPnl.value
            : weekPnlPending
              ? copy.portfolioState.dayPnlPending
              : metricFallback,
      },
      {
        key: "account-holdings",
        label: overviewCopy.accountHoldings,
        tone: shouldRenderPortfolioSummaryValues ? "neutral" : "warning",
        value: formatCount(
          heldPositionCount,
          copy.portfolioState.holding,
          copy.portfolioState.holdingsPlural,
          numberLocale,
          overviewCopy.unavailable,
        ),
      },
    ],
    monitoringRows,
    monitoringStateLabel:
      monitoringRows.length > 0
        ? null
        : runtimeRowsUnavailable
          ? overviewCopy.monitoredSymbolsUnavailable
          : overviewCopy.noExecApprovedMonitoringRows,
    runtimeHoldingRows,
    runtimeHoldingStateLabel:
      runtimeHoldingRows.length > 0
        ? null
        : runtimeRowsUnavailable
          ? overviewCopy.runtimeHeldPositionsUnavailable
          : overviewCopy.noRuntimeHeldPositionRows,
    statusLabel: getPortfolioStatusLabel(portfolioState, copy),
    statusTone: getPortfolioStatusTone(portfolioState),
  };
}

export const dashboardOverviewCardInternals = {
  humanizeToken,
  normalizeToken,
};
