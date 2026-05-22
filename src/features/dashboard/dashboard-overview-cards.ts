import type { DashboardLiveCopy } from "@/i18n/dashboard-live-copy";
import type {
  ExecutionRuntimeBoardItemDto,
  ExecutionRuntimeDailyBoardResponseDto,
  ExecutionRuntimeMonitoredSymbolDto,
  ExecutionRuntimeMonitoredSymbolsResponseDto,
  ExecutionRuntimeQuantity,
  ExecutionRuntimeStatusResponseDto,
  PortfolioMoneyAmountDto,
  PortfolioOrderActivityDto,
  PortfolioSummaryDto,
} from "@/types/trading-api";
import {
  buildPortfolioMetricModels,
  formatPortfolioMoney,
  getPortfolioAccounts,
  getPortfolioActivity,
  getPortfolioHoldings,
  type PortfolioSummaryState,
} from "@/features/portfolio/portfolio-display";
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
  key: string;
  marketLabel: string | null;
  nameLabel: string;
  prices: DashboardOverviewPriceItem[];
  symbol: string;
};

export type DashboardDeciderOverviewModel = {
  contextLabel: string | null;
  diagnostics: string[];
  emptyLabel: string | null;
  mode: "market-open" | "closed-completed" | "closed-in-progress";
  rows: DashboardDeciderRow[];
  statusLabel: string;
  statusTone: OverviewTone;
};

export type DashboardPortfolioTradeRow = {
  key: string;
  marketLabel: string | null;
  nameLabel: string;
  symbol: string;
  values: DashboardOverviewPriceItem[];
};

export type DashboardPortfolioOverviewModel = {
  buyRows: DashboardPortfolioTradeRow[];
  buyStateLabel: string | null;
  contextLabel: string | null;
  diagnostics: string[];
  execConnectionLabel: string;
  execConnectionTone: OverviewTone;
  executionBoardStateLabel: string | null;
  metrics: DashboardOverviewMetric[];
  sellRows: DashboardPortfolioTradeRow[];
  sellStateLabel: string | null;
  statusLabel: string;
  statusTone: OverviewTone;
};

const OPEN_BUY_INTENTS = ["buy", "buy_to_open", "next_open_buy", "next-day buy", "next day buy"];
const SELL_INTENTS = ["sell", "sell_to_close", "target_sell", "stop_sell"];
const FILLED_STATUSES = new Set(["filled", "partial"]);
const NEXT_DAY_STATUSES = new Set(["planned", "accepted", "scheduled", "submitted"]);

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
  const directIntentKeys = ["intent", "side", "order_side", "position_side", "action"];
  const directIntents = directIntentKeys.map((key) => normalizeToken(textOrNull(item[key]))).filter(Boolean);
  const plannedIntents = Array.isArray(item.planned_intents)
    ? item.planned_intents.map((value) => normalizeToken(textOrNull(value))).filter(Boolean)
    : [];
  const allIntents = [...directIntents, ...plannedIntents].filter(Boolean);

  return allIntents.some((value) =>
    intentTokens.some((token) => {
      const normalizedToken = normalizeToken(token);
      return value === normalizedToken || value.includes(normalizedToken);
    }),
  );
}

function isFilledExecutionItem(item: ExecutionRuntimeBoardItemDto) {
  return FILLED_STATUSES.has(normalizeToken(item.status));
}

function isBuyExecutionItem(item: ExecutionRuntimeBoardItemDto) {
  return isFilledExecutionItem(item) && hasAnyIntent(item, OPEN_BUY_INTENTS);
}

function isSellExecutionItem(item: ExecutionRuntimeBoardItemDto) {
  return isFilledExecutionItem(item) && hasAnyIntent(item, SELL_INTENTS);
}

function isNextDayExecutionCandidate(item: ExecutionRuntimeBoardItemDto, boardMarketDate: string | null) {
  const targetTradeDate = textOrNull(item.target_trade_date);
  if (targetTradeDate && (!boardMarketDate || targetTradeDate !== boardMarketDate)) return true;
  if (hasAnyIntent(item, ["next_open_buy", "next_open_sell", "next_day_exec", "next"])) return true;
  return NEXT_DAY_STATUSES.has(normalizeToken(item.status));
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

function getHeldPositionCount(summary: PortfolioSummaryDto | null | undefined) {
  if (!summary) return null;
  const accounts = getPortfolioAccounts(summary);
  if (accounts.length > 0 && accounts.every((account) => !Array.isArray(account.holdings))) return null;
  return getPortfolioHoldings(summary).length;
}

function findActivityForSymbol(
  activity: PortfolioOrderActivityDto[],
  symbol: string,
  side: "buy" | "sell",
  marketDate: string | null,
) {
  return activity.find((item) => {
    if (item.symbol !== symbol) return false;
    if (normalizeToken(item.side) !== side) return false;
    if (!marketDate) return true;
    const activityDate = item.updatedAt ?? item.submittedAt ?? null;
    return activityDate?.startsWith(marketDate) === true;
  });
}

function formatTradeMoney(
  value: PortfolioMoneyAmountDto | null,
  fallback: string,
) {
  return formatPortfolioMoney(value, fallback);
}

function buildBuyRow({
  copy,
  item,
  numberLocale,
}: {
  copy: DashboardOverviewCopy;
  item: ExecutionRuntimeBoardItemDto;
  numberLocale: string;
}): DashboardPortfolioTradeRow {
  return {
    key: `${item.symbol}-${item.execution_plan_id ?? item.plan_item_id ?? item.last_updated_at ?? "buy"}`,
    marketLabel: textOrNull(item.market),
    nameLabel: textOrNull(item.name) ?? item.symbol,
    symbol: item.symbol,
    values: [
      {
        key: "target",
        label: copy.targetPrice,
        value: formatPrice(getTargetPrice(item, null), numberLocale, copy.unavailable),
      },
      {
        key: "stop",
        label: copy.stopLossPrice,
        value: formatPrice(getStopLossPriceWithFallback(item, null), numberLocale, copy.unavailable),
      },
      {
        key: "trade",
        label: copy.tradePrice,
        value: formatPrice(
          getQuantity(item, ["trade_price", "avg_fill_price", "fill_price"]),
          numberLocale,
          copy.unavailable,
        ),
      },
    ],
  };
}

function buildSellRow({
  activity,
  copy,
  item,
}: {
  activity: PortfolioOrderActivityDto | null | undefined;
  copy: DashboardOverviewCopy;
  item: ExecutionRuntimeBoardItemDto;
}): DashboardPortfolioTradeRow {
  const itemMoney = getMoneyAmount(item, ["realized_pnl", "realizedPnl", "realized_profit_loss", "realizedProfitLoss"]);
  const activityMoney = getMoneyAmount(activity ?? null, ["realizedPnl", "realized_pnl", "realizedProfitLoss"]);
  return {
    key: `${item.symbol}-${item.execution_plan_id ?? item.plan_item_id ?? item.last_updated_at ?? "sell"}`,
    marketLabel: textOrNull(item.market),
    nameLabel: textOrNull(item.name) ?? activity?.symbol ?? item.symbol,
    symbol: item.symbol,
    values: [
      {
        key: "realized-pnl",
        label: copy.realizedPnl,
        value: formatTradeMoney(itemMoney ?? activityMoney, copy.unavailable),
      },
    ],
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
    const rows = (monitoredSymbols?.items ?? []).map((item) => {
      const supportingBoardItem = findSupportingBoardItem(item.symbol, boardBySymbol);
      const quote = quoteBySymbol.get(item.symbol);

      return {
        key: item.symbol,
        marketLabel: textOrNull(item.market) ?? textOrNull(quote?.market_state),
        nameLabel: getItemName(item, quote),
        prices: [
          {
            key: "stop-loss",
            label: overviewCopy.stopLossPrice,
            value: formatPrice(
              getStopLossPriceWithFallback(item, supportingBoardItem),
              numberLocale,
              overviewCopy.unavailable,
            ),
          },
          {
            key: "target",
            label: overviewCopy.targetPrice,
            value: formatPrice(getTargetPrice(item, supportingBoardItem), numberLocale, overviewCopy.unavailable),
          },
          {
            key: "current",
            label: overviewCopy.currentPrice,
            value: formatPrice(getCurrentPrice(item, quote), numberLocale, overviewCopy.unavailable),
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

  if (processStatus !== "completed") {
    return {
      contextLabel: null,
      diagnostics,
      emptyLabel: overviewCopy.processInProgress,
      mode: "closed-in-progress",
      rows: [],
      statusLabel: overviewCopy.processRunning,
      statusTone: "neutral",
    };
  }

  const boardMarketDate = board?.market_date ?? board?.request?.market_date ?? null;
  const rows = getBoardItems(board)
    .filter((item) => isNextDayExecutionCandidate(item, boardMarketDate))
    .map((item, index) => ({
      key: `${item.symbol}-${item.execution_plan_id ?? item.plan_item_id ?? index}`,
      marketLabel: textOrNull(item.market),
      nameLabel: textOrNull(item.name) ?? item.symbol,
      prices: [
        {
          key: "stop-loss",
          label: overviewCopy.stopLossPrice,
          value: formatPrice(getStopLossPriceWithFallback(item, null), numberLocale, overviewCopy.unavailable),
        },
        {
          key: "target",
          label: overviewCopy.targetPrice,
          value: formatPrice(getTargetPrice(item, null), numberLocale, overviewCopy.unavailable),
        },
        {
          key: "close",
          label: overviewCopy.closePrice,
          value: formatPrice(getClosedPrice(item), numberLocale, overviewCopy.unavailable),
        },
      ],
      symbol: item.symbol,
    }));
  const hasBoardRuntimeDelay = Boolean(boardError);

  return {
    contextLabel: hasBoardRuntimeDelay
      ? `${overviewCopy.marketClosedCompletedContext} ${overviewCopy.executionBoardUpdating}`
      : overviewCopy.marketClosedCompletedContext,
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
  board,
  boardError,
  copy,
  executionStatus,
  executionStatusError,
  marketDate,
  numberLocale,
  portfolioState,
  summary,
}: {
  board: ExecutionRuntimeDailyBoardResponseDto | null;
  boardError: string | null;
  copy: DashboardLiveCopy;
  executionStatus: ExecutionRuntimeStatusResponseDto | null;
  executionStatusError: string | null;
  marketDate: string | null;
  numberLocale: string;
  portfolioState: PortfolioSummaryState;
  summary: PortfolioSummaryDto | null;
}): DashboardPortfolioOverviewModel {
  const overviewCopy = copy.dashboardOverview;
  const metricFallback = getPortfolioMetricFallback(portfolioState, copy);
  const portfolioMetrics = buildPortfolioMetricModels(summary, metricFallback);
  const totalAssets = portfolioMetrics.find((metric) => metric.id === "total-assets");
  const dayPnl = portfolioMetrics.find((metric) => metric.id === "day-pnl");
  const hasPortfolioAccounts = getPortfolioAccounts(summary).length > 0;
  const dayPnlPending = hasPortfolioAccounts && dayPnl?.available !== true;
  const heldPositionCount = getHeldPositionCount(summary);
  const execConnected = executionStatus?.exec_connected === true;
  const activity = getPortfolioActivity(summary);
  const boardItems = getBoardItems(board);
  const buyRows = boardItems
    .filter(isBuyExecutionItem)
    .map((item) => buildBuyRow({ copy: overviewCopy, item, numberLocale }));
  const sellRows = boardItems
    .filter(isSellExecutionItem)
    .map((item) =>
      buildSellRow({
        activity: findActivityForSymbol(activity, item.symbol, "sell", marketDate),
        copy: overviewCopy,
        item,
      }),
    );
  const hasBoardRuntimeDelay = Boolean(boardError);
  const executionBoardStateLabel = hasBoardRuntimeDelay
    ? overviewCopy.executionBoardUpdating
    : board
      ? null
      : overviewCopy.executionBoardUnavailable;
  const contextLabel = executionStatusError ? overviewCopy.runtimeDataDelayed : null;
  const diagnostics = compactDiagnostics(executionStatusError, boardError);

  return {
    buyRows,
    buyStateLabel:
      buyRows.length > 0
        ? null
        : executionBoardStateLabel
          ? null
          : board
            ? overviewCopy.noBoughtStocks
            : null,
    contextLabel,
    diagnostics,
    execConnectionLabel: execConnected
      ? overviewCopy.execConnected
      : executionStatus
        ? overviewCopy.execDisconnected
        : overviewCopy.unavailable,
    execConnectionTone: execConnected ? "positive" : "warning",
    executionBoardStateLabel,
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
        tone: totalAssets?.tone ?? "neutral",
        value: totalAssets?.value ?? metricFallback,
      },
      {
        key: "day-pnl",
        label: copy.portfolioState.metrics.dayPnl,
        tone: dayPnlPending ? "neutral" : dayPnl?.tone ?? "neutral",
        value:
          dayPnl?.available === true
            ? dayPnl.value
            : dayPnlPending
              ? copy.portfolioState.dayPnlPending
              : metricFallback,
      },
      {
        key: "held-positions",
        label: overviewCopy.heldPositions,
        tone: "neutral",
        value: formatCount(
          heldPositionCount,
          copy.portfolioState.holding,
          copy.portfolioState.holdingsPlural,
          numberLocale,
          overviewCopy.unavailable,
        ),
      },
    ],
    sellRows,
    sellStateLabel:
      sellRows.length > 0
        ? null
        : executionBoardStateLabel
          ? null
          : board
            ? overviewCopy.noSoldStocks
            : null,
    statusLabel: getPortfolioStatusLabel(portfolioState, copy),
    statusTone: getPortfolioStatusTone(portfolioState),
  };
}

export const dashboardOverviewCardInternals = {
  humanizeToken,
  normalizeToken,
};
