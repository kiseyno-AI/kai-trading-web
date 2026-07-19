import type { TradingApiJsonResult } from "@/lib/trading-api-cache";
import type {
  CryptoMarketOverviewResponseDto,
  CryptoMarketRowDto,
  CryptoPaperRuntimeResponseDto,
  CryptoPaperRuntimeRowDto,
  CryptoRuntimeReadinessResponseDto,
  CryptoRuntimeReadinessRowDto,
  CryptoStrategyOverviewResponseDto,
  CryptoStrategyRowDto,
} from "@/types/trading-api/crypto-readonly";
import type { ExecutionRuntimeQuantity } from "@/types/trading-api/execution-runtime";
import type { PortfolioMoneyAmountDto } from "@/types/trading-api/portfolio-account";

export const CRYPTO_MARKET_OVERVIEW_UPSTREAM_PATH = "/crypto/markets/overview";
export const CRYPTO_STRATEGY_OVERVIEW_UPSTREAM_PATH = "/crypto/strategies/overview";
export const CRYPTO_RUNTIME_READINESS_UPSTREAM_PATH = "/execution/runtime/crypto/readiness";
export const CRYPTO_PAPER_RUNTIME_UPSTREAM_PATH = "/execution/runtime/crypto/paper";

export const CRYPTO_MARKET_OVERVIEW_CLIENT_PATH = "/api/trading/crypto/markets/overview";
export const CRYPTO_STRATEGY_OVERVIEW_CLIENT_PATH = "/api/trading/crypto/strategies/overview";
export const CRYPTO_RUNTIME_READINESS_CLIENT_PATH = "/api/trading/execution/runtime/crypto/readiness";
export const CRYPTO_PAPER_RUNTIME_CLIENT_PATH = "/api/trading/execution/runtime/crypto/paper";

export type CryptoReadOnlySourceState = "pending" | "ready" | "unavailable";

export type CryptoReadOnlySnapshot = {
  marketOverview: TradingApiJsonResult<CryptoMarketOverviewResponseDto>;
  strategyOverview: TradingApiJsonResult<CryptoStrategyOverviewResponseDto>;
  runtimeReadiness: TradingApiJsonResult<CryptoRuntimeReadinessResponseDto>;
  paperRuntime: TradingApiJsonResult<CryptoPaperRuntimeResponseDto>;
};

export type CryptoReadOnlySourceModel = {
  detail: string | null;
  itemCount: number;
  label: string;
  state: CryptoReadOnlySourceState;
};

export type CryptoReadOnlyRowModel = {
  assetClass: string;
  hasStrategyPaperContext: boolean;
  invalidationLevelLabel: string;
  key: string;
  lastPriceLabel: string;
  liveControlsLabel: string;
  marketStatusLabel: string;
  modeLabel: string;
  momentumScoreLabel: string;
  name: string | null;
  paperActiveJobsLabel: string;
  paperHeartbeatLabel: string;
  paperIssuesLabel: string;
  paperModeLabel: string;
  paperOpenOrdersLabel: string;
  paperProviderLabel: string;
  paperRuntimeLabel: string;
  pairLabel: string;
  paperStatusLabel: string;
  provider: string;
  quoteCurrency: string;
  readinessLabel: string;
  riskTierLabel: string;
  strategyNameLabel: string;
  strategyReadinessLabel: string;
  strategyReasonLabel: string;
  targetLevelLabel: string;
  trendStateLabel: string;
  updatedAtLabel: string;
  venue: string;
  volatilityTierLabel: string;
};

export type CryptoReadOnlySurfaceModel = {
  marketSource: CryptoReadOnlySourceModel;
  paperSource: CryptoReadOnlySourceModel;
  readinessSource: CryptoReadOnlySourceModel;
  strategyPaperRows: CryptoReadOnlyRowModel[];
  strategySource: CryptoReadOnlySourceModel;
  rows: CryptoReadOnlyRowModel[];
};

type CryptoModelInput = {
  marketOverview: TradingApiJsonResult<CryptoMarketOverviewResponseDto> | null | undefined;
  strategyOverview: TradingApiJsonResult<CryptoStrategyOverviewResponseDto> | null | undefined;
  runtimeReadiness: TradingApiJsonResult<CryptoRuntimeReadinessResponseDto> | null | undefined;
  paperRuntime: TradingApiJsonResult<CryptoPaperRuntimeResponseDto> | null | undefined;
};

type CryptoReadOnlyResponseDto =
  | CryptoMarketOverviewResponseDto
  | CryptoRuntimeReadinessResponseDto
  | CryptoStrategyOverviewResponseDto
  | CryptoPaperRuntimeResponseDto;

type CryptoReadOnlyResponseResult = TradingApiJsonResult<CryptoReadOnlyResponseDto> | null | undefined;

type CryptoReadOnlyRowDto =
  | CryptoMarketRowDto
  | CryptoRuntimeReadinessRowDto
  | CryptoStrategyRowDto
  | CryptoPaperRuntimeRowDto;

type CryptoReadOnlyRowPair = {
  market: CryptoMarketRowDto | null;
  paper: CryptoPaperRuntimeRowDto | null;
  readiness: CryptoRuntimeReadinessRowDto | null;
  strategy: CryptoStrategyRowDto | null;
};

const KNOWN_QUOTE_CURRENCIES = new Set(["KRW", "USD", "USDT", "USDC"]);

function getRecordStringValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

function getRecordBooleanValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }

  return null;
}

function getRecordNumberLikeValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

function isPortfolioMoneyAmount(value: unknown): value is PortfolioMoneyAmountDto {
  return typeof value === "object" && value !== null && ("amount" in value || "display" in value);
}

function formatQuantityValue(value: ExecutionRuntimeQuantity | PortfolioMoneyAmountDto | undefined) {
  if (value === null || value === undefined || value === "") return "Unavailable";
  if (isPortfolioMoneyAmount(value)) {
    return value.display || (typeof value.amount === "number" ? value.amount.toLocaleString() : "Unavailable");
  }
  if (typeof value === "number") return value.toLocaleString();
  return value;
}

function getMarketRows(result: TradingApiJsonResult<CryptoMarketOverviewResponseDto> | null | undefined) {
  if (!result?.ok) return [];
  return Array.isArray(result.data.items) ? result.data.items : [];
}

function getReadinessRows(result: TradingApiJsonResult<CryptoRuntimeReadinessResponseDto> | null | undefined) {
  if (!result?.ok) return [];
  return Array.isArray(result.data.items) ? result.data.items : [];
}

function getStrategyRows(result: TradingApiJsonResult<CryptoStrategyOverviewResponseDto> | null | undefined) {
  if (!result?.ok) return [];
  return Array.isArray(result.data.items) ? result.data.items : [];
}

function getPaperRows(result: TradingApiJsonResult<CryptoPaperRuntimeResponseDto> | null | undefined) {
  if (!result?.ok) return [];
  return Array.isArray(result.data.items) ? result.data.items : [];
}

function getSourceState(result: CryptoReadOnlyResponseResult, itemCount: number): CryptoReadOnlySourceState {
  if (!result) return "pending";
  if (result.ok) return itemCount > 0 ? "ready" : "pending";
  return result.status === 404 ? "pending" : "unavailable";
}

function buildSourceModel(result: CryptoReadOnlyResponseResult, itemCount: number): CryptoReadOnlySourceModel {
  const state = getSourceState(result, itemCount);
  const detail = result && !result.ok ? result.message : null;

  return {
    detail,
    itemCount,
    label: state === "ready" ? "Ready" : state === "pending" ? "Pending" : "Unavailable",
    state,
  };
}

function normalizeToken(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? null;
}

function getNormalizedPair(row: CryptoReadOnlyRowDto | null) {
  if (!row) return null;
  const record = row as Record<string, unknown>;
  const baseCurrency = normalizeToken(getRecordStringValue(record, ["baseCurrency", "base_currency"]));
  const quoteCurrency = normalizeToken(getRecordStringValue(record, ["quoteCurrency", "quote_currency"]));
  if (baseCurrency && quoteCurrency) return `${baseCurrency}/${quoteCurrency}`;

  const symbol = normalizeToken(getRecordStringValue(record, ["symbol", "ticker", "instrument"]));
  if (!symbol) return null;
  if (symbol.includes("/")) return symbol;

  if (symbol.includes("-")) {
    const [left, right] = symbol.split("-", 2).map((part) => part.trim().toUpperCase());
    if (left && right) {
      if (KNOWN_QUOTE_CURRENCIES.has(left)) return `${right}/${left}`;
      if (KNOWN_QUOTE_CURRENCIES.has(right)) return `${left}/${right}`;
      return `${left}/${right}`;
    }
  }

  return symbol;
}

function getRowKey(row: CryptoReadOnlyRowDto) {
  const record = row as Record<string, unknown>;
  const venue = getRecordStringValue(record, ["venue", "exchange", "provider"]);
  const pair = getNormalizedPair(row);
  return `${venue ?? "crypto"}:${pair ?? getRecordStringValue(record, ["id"]) ?? "readiness"}`.toUpperCase();
}

function getAssetClass(row: CryptoReadOnlyRowDto | null) {
  if (!row) return "crypto";
  const value = getRecordStringValue(row as Record<string, unknown>, ["assetClass", "asset_class"]);
  return value ?? "crypto";
}

function getVenue(row: CryptoReadOnlyRowDto | null) {
  if (!row) return "Pending";
  return getRecordStringValue(row as Record<string, unknown>, ["venue", "exchange", "provider"]) ?? "Pending";
}

function getProvider(row: CryptoReadOnlyRowDto | null) {
  if (!row) return "Pending";
  return getRecordStringValue(row as Record<string, unknown>, ["provider", "venue", "exchange"]) ?? "Pending";
}

function getQuoteCurrency(row: CryptoReadOnlyRowDto | null) {
  if (!row) return "Pending";
  const pair = getNormalizedPair(row);
  if (pair?.includes("/")) return pair.split("/")[1] ?? "Pending";
  return getRecordStringValue(row as Record<string, unknown>, ["quoteCurrency", "quote_currency"]) ?? "Pending";
}

function getPairLabel(row: CryptoReadOnlyRowDto | null) {
  if (!row) return "Pending";
  const pair = getNormalizedPair(row);
  if (pair) return pair;

  const record = row as Record<string, unknown>;
  const symbol = getRecordStringValue(record, ["symbol", "ticker", "instrument"]);
  if (symbol) return symbol;

  const baseCurrency = getRecordStringValue(record, ["baseCurrency", "base_currency"]);
  const quoteCurrency = getQuoteCurrency(row);
  return baseCurrency ? `${baseCurrency}/${quoteCurrency}` : "Pending";
}

function getName(row: CryptoReadOnlyRowDto | null) {
  if (!row) return null;
  return getRecordStringValue(row as Record<string, unknown>, ["name", "displayName", "display_name"]);
}

function getMarketStatusLabel(row: CryptoMarketRowDto | null) {
  if (!row) return "Pending";
  const value = getRecordStringValue(row as Record<string, unknown>, ["marketStatus", "market_status", "dataStatus", "data_status"]);
  return value ?? "Pending";
}

function getReadinessLabel(row: CryptoRuntimeReadinessRowDto | null) {
  if (!row) return "Pending";
  const value = getRecordStringValue(row as Record<string, unknown>, ["readiness", "status"]);
  return value ?? "Pending";
}

function getPaperStatusLabel(row: CryptoRuntimeReadinessRowDto | CryptoPaperRuntimeRowDto | null) {
  if (!row) return "Pending";
  const value = getRecordBooleanValue(row as Record<string, unknown>, ["paperTradingEnabled", "paper_trading_enabled"]);
  if (value === null) return "Pending";
  return value ? "Paper enabled" : "Paper disabled";
}

function getModeLabel(row: CryptoRuntimeReadinessRowDto | CryptoStrategyRowDto | CryptoPaperRuntimeRowDto | null) {
  if (!row) return "Pending";
  return getRecordStringValue(row as Record<string, unknown>, ["mode"]) ?? "Pending";
}

function getStrategyLabel(row: CryptoStrategyRowDto | null, keys: string[], fallback = "Pending") {
  if (!row) return fallback;
  return getRecordStringValue(row as Record<string, unknown>, keys) ?? fallback;
}

function getStrategyNumberLabel(row: CryptoStrategyRowDto | null, keys: string[]) {
  if (!row) return "Pending";
  const value = getRecordNumberLikeValue(row as Record<string, unknown>, keys);
  if (value === null) return "Pending";
  return typeof value === "number" ? value.toLocaleString() : value;
}

function getStrategyReadinessLabel(row: CryptoStrategyRowDto | null) {
  return getStrategyLabel(row, ["readiness", "status"]);
}

function getStrategyReasonLabel(row: CryptoStrategyRowDto | null) {
  if (!row) return "Pending";
  const reasons = (row as Record<string, unknown>).reasons;
  if (!Array.isArray(reasons)) return "Pending";
  const labels = reasons.filter((reason): reason is string => typeof reason === "string" && Boolean(reason.trim()));
  return labels.length > 0 ? labels.slice(0, 2).join("; ") : "Pending";
}

function getPaperRuntimeLabel(row: CryptoPaperRuntimeRowDto | null) {
  if (!row) return "Pending";
  const record = row as Record<string, unknown>;
  return getRecordStringValue(record, ["paperRuntimeState", "paper_runtime_state", "readiness", "status"]) ?? "Pending";
}

function getCountLabel(row: CryptoPaperRuntimeRowDto | null, keys: string[]) {
  if (!row) return "Pending";
  const value = getRecordNumberLikeValue(row as Record<string, unknown>, keys);
  if (value === null) return "Pending";
  return typeof value === "number" ? value.toLocaleString() : value;
}

function getPaperIssuesLabel(row: CryptoPaperRuntimeRowDto | null) {
  if (!row) return "Pending";
  const issues = (row as Record<string, unknown>).issues;
  if (!Array.isArray(issues) || issues.length === 0) return "No reported issues";

  const labels = issues
    .map((issue) => {
      if (typeof issue === "string") return issue;
      if (typeof issue === "object" && issue !== null) {
        const record = issue as Record<string, unknown>;
        return getRecordStringValue(record, ["message", "code"]);
      }
      return null;
    })
    .filter((issue): issue is string => Boolean(issue));

  return labels.length > 0 ? labels.slice(0, 2).join("; ") : "No reported issues";
}

function getUpdatedAtLabel(
  marketRow: CryptoMarketRowDto | null,
  readinessRow: CryptoRuntimeReadinessRowDto | null,
  strategyRow: CryptoStrategyRowDto | null,
  paperRow: CryptoPaperRuntimeRowDto | null,
) {
  const marketRecord = marketRow as Record<string, unknown> | null;
  const readinessRecord = readinessRow as Record<string, unknown> | null;
  const strategyRecord = strategyRow as Record<string, unknown> | null;
  const paperRecord = paperRow as Record<string, unknown> | null;
  return (
    (marketRecord && getRecordStringValue(marketRecord, ["asOf", "as_of", "updatedAt", "updated_at"])) ||
    (strategyRecord && getRecordStringValue(strategyRecord, ["asOf", "as_of", "updatedAt", "updated_at"])) ||
    (paperRecord &&
      getRecordStringValue(paperRecord, [
        "lastHeartbeatAt",
        "last_heartbeat_at",
        "updatedAt",
        "updated_at",
        "lastSimulatedFillAt",
        "last_simulated_fill_at",
      ])) ||
    (readinessRecord && getRecordStringValue(readinessRecord, ["lastHeartbeatAt", "last_heartbeat_at", "updatedAt", "updated_at"])) ||
    "Pending"
  );
}

function getLastPriceLabel(row: CryptoMarketRowDto | null) {
  if (!row) return "Unavailable";
  const record = row as Record<string, unknown>;
  return formatQuantityValue((record.lastPrice ?? record.last_price) as ExecutionRuntimeQuantity | PortfolioMoneyAmountDto | undefined);
}

export function buildCryptoReadOnlySurfaceModel({
  marketOverview,
  strategyOverview,
  runtimeReadiness,
  paperRuntime,
}: CryptoModelInput): CryptoReadOnlySurfaceModel {
  const marketRows = getMarketRows(marketOverview);
  const readinessRows = getReadinessRows(runtimeReadiness);
  const strategyRows = getStrategyRows(strategyOverview);
  const paperRows = getPaperRows(paperRuntime);
  const rowPairs = new Map<string, CryptoReadOnlyRowPair>();

  const getOrCreatePair = (row: CryptoReadOnlyRowDto): CryptoReadOnlyRowPair => {
    const key = getRowKey(row);
    const current = rowPairs.get(key);
    if (current) return current;

    const nextPair = {
      market: null,
      paper: null,
      readiness: null,
      strategy: null,
    };
    rowPairs.set(key, nextPair);
    return nextPair;
  };

  for (const market of marketRows) {
    getOrCreatePair(market).market = market;
  }

  for (const readiness of readinessRows) {
    getOrCreatePair(readiness).readiness = readiness;
  }

  for (const strategy of strategyRows) {
    getOrCreatePair(strategy).strategy = strategy;
  }

  for (const paper of paperRows) {
    getOrCreatePair(paper).paper = paper;
  }

  const rows = Array.from(rowPairs.entries()).map(([key, pair]) => {
    const primaryRow = pair.market ?? pair.strategy ?? pair.paper ?? pair.readiness;
    const paperStateRow = pair.paper ?? pair.readiness;
    const hasStrategyPaperContext = Boolean(pair.strategy || pair.paper);
    return {
      assetClass: getAssetClass(primaryRow),
      hasStrategyPaperContext,
      invalidationLevelLabel: formatQuantityValue(
        (pair.strategy?.invalidationLevel ?? pair.strategy?.invalidation_level) as
          | ExecutionRuntimeQuantity
          | PortfolioMoneyAmountDto
          | undefined,
      ),
      key,
      lastPriceLabel: getLastPriceLabel(pair.market),
      liveControlsLabel: "No web controls",
      marketStatusLabel: getMarketStatusLabel(pair.market),
      modeLabel: getModeLabel(pair.paper ?? pair.readiness ?? pair.strategy),
      momentumScoreLabel: getStrategyNumberLabel(pair.strategy, ["momentumScore", "momentum_score"]),
      name: getName(primaryRow),
      paperActiveJobsLabel: getCountLabel(pair.paper, ["activePaperJobCount", "active_paper_job_count"]),
      paperHeartbeatLabel: pair.paper
        ? getRecordStringValue(pair.paper as Record<string, unknown>, ["lastHeartbeatAt", "last_heartbeat_at", "updatedAt", "updated_at"]) ??
          "Pending"
        : "Pending",
      paperIssuesLabel: getPaperIssuesLabel(pair.paper),
      paperModeLabel: getModeLabel(pair.paper),
      paperOpenOrdersLabel: getCountLabel(pair.paper, ["openPaperOrderCount", "open_paper_order_count"]),
      paperProviderLabel: getProvider(pair.paper),
      paperRuntimeLabel: getPaperRuntimeLabel(pair.paper),
      pairLabel: getPairLabel(primaryRow),
      paperStatusLabel: getPaperStatusLabel(paperStateRow),
      provider: getProvider(pair.strategy ?? primaryRow),
      quoteCurrency: getQuoteCurrency(primaryRow),
      readinessLabel: pair.readiness ? getReadinessLabel(pair.readiness) : getPaperRuntimeLabel(pair.paper),
      riskTierLabel: getStrategyLabel(pair.strategy, ["riskTier", "risk_tier"]),
      strategyNameLabel: getStrategyLabel(pair.strategy, ["strategyName", "strategy_name"], "Strategy pending"),
      strategyReadinessLabel: getStrategyReadinessLabel(pair.strategy),
      strategyReasonLabel: getStrategyReasonLabel(pair.strategy),
      targetLevelLabel: formatQuantityValue(
        (pair.strategy?.targetLevel ?? pair.strategy?.target_level) as ExecutionRuntimeQuantity | PortfolioMoneyAmountDto | undefined,
      ),
      trendStateLabel: getStrategyLabel(pair.strategy, ["trendState", "trend_state"]),
      updatedAtLabel: getUpdatedAtLabel(pair.market, pair.readiness, pair.strategy, pair.paper),
      venue: getVenue(primaryRow),
      volatilityTierLabel: getStrategyLabel(pair.strategy, ["volatilityTier", "volatility_tier"]),
    };
  });

  return {
    marketSource: buildSourceModel(marketOverview, marketRows.length),
    paperSource: buildSourceModel(paperRuntime, paperRows.length),
    readinessSource: buildSourceModel(runtimeReadiness, readinessRows.length),
    rows,
    strategyPaperRows: rows.filter((row) => row.hasStrategyPaperContext),
    strategySource: buildSourceModel(strategyOverview, strategyRows.length),
  };
}
