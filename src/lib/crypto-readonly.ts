import type { TradingApiJsonResult } from "@/lib/trading-api-cache";
import type {
  CryptoMarketOverviewResponseDto,
  CryptoMarketRowDto,
  CryptoRuntimeReadinessResponseDto,
  CryptoRuntimeReadinessRowDto,
  ExecutionRuntimeQuantity,
  PortfolioMoneyAmountDto,
} from "@/types/trading-api";

export const CRYPTO_MARKET_OVERVIEW_UPSTREAM_PATH = "/crypto/markets/overview";
export const CRYPTO_RUNTIME_READINESS_UPSTREAM_PATH = "/execution/runtime/crypto/readiness";

export const CRYPTO_MARKET_OVERVIEW_CLIENT_PATH = "/api/trading/crypto/markets/overview";
export const CRYPTO_RUNTIME_READINESS_CLIENT_PATH = "/api/trading/execution/runtime/crypto/readiness";

export type CryptoReadOnlySourceState = "pending" | "ready" | "unavailable";

export type CryptoReadOnlySnapshot = {
  marketOverview: TradingApiJsonResult<CryptoMarketOverviewResponseDto>;
  runtimeReadiness: TradingApiJsonResult<CryptoRuntimeReadinessResponseDto>;
};

export type CryptoReadOnlySourceModel = {
  detail: string | null;
  itemCount: number;
  label: string;
  state: CryptoReadOnlySourceState;
};

export type CryptoReadOnlyRowModel = {
  assetClass: string;
  key: string;
  lastPriceLabel: string;
  liveControlsLabel: string;
  marketStatusLabel: string;
  name: string | null;
  pairLabel: string;
  paperStatusLabel: string;
  quoteCurrency: string;
  readinessLabel: string;
  updatedAtLabel: string;
  venue: string;
};

export type CryptoReadOnlySurfaceModel = {
  marketSource: CryptoReadOnlySourceModel;
  readinessSource: CryptoReadOnlySourceModel;
  rows: CryptoReadOnlyRowModel[];
};

type CryptoModelInput = {
  marketOverview: TradingApiJsonResult<CryptoMarketOverviewResponseDto> | null | undefined;
  runtimeReadiness: TradingApiJsonResult<CryptoRuntimeReadinessResponseDto> | null | undefined;
};

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

function getSourceState(
  result: TradingApiJsonResult<CryptoMarketOverviewResponseDto | CryptoRuntimeReadinessResponseDto> | null | undefined,
  itemCount: number,
): CryptoReadOnlySourceState {
  if (!result) return "pending";
  if (result.ok) return itemCount > 0 ? "ready" : "pending";
  return result.status === 404 ? "pending" : "unavailable";
}

function buildSourceModel(
  result: TradingApiJsonResult<CryptoMarketOverviewResponseDto | CryptoRuntimeReadinessResponseDto> | null | undefined,
  itemCount: number,
): CryptoReadOnlySourceModel {
  const state = getSourceState(result, itemCount);
  const detail = result && !result.ok ? result.message : null;

  return {
    detail,
    itemCount,
    label: state === "ready" ? "Ready" : state === "pending" ? "Pending" : "Unavailable",
    state,
  };
}

function getRowKey(row: CryptoMarketRowDto | CryptoRuntimeReadinessRowDto) {
  const record = row as Record<string, unknown>;
  const symbol = getRecordStringValue(record, ["symbol", "ticker", "instrument"]);
  const venue = getRecordStringValue(record, ["venue", "exchange"]);
  return `${venue ?? "crypto"}:${symbol ?? getRecordStringValue(record, ["id"]) ?? "readiness"}`.toUpperCase();
}

function getAssetClass(row: CryptoMarketRowDto | CryptoRuntimeReadinessRowDto | null) {
  if (!row) return "crypto";
  const value = getRecordStringValue(row as Record<string, unknown>, ["assetClass", "asset_class"]);
  return value ?? "crypto";
}

function getVenue(row: CryptoMarketRowDto | CryptoRuntimeReadinessRowDto | null) {
  if (!row) return "Pending";
  return getRecordStringValue(row as Record<string, unknown>, ["venue", "exchange"]) ?? "Pending";
}

function getQuoteCurrency(row: CryptoMarketRowDto | CryptoRuntimeReadinessRowDto | null) {
  if (!row) return "Pending";
  return getRecordStringValue(row as Record<string, unknown>, ["quoteCurrency", "quote_currency"]) ?? "Pending";
}

function getPairLabel(row: CryptoMarketRowDto | CryptoRuntimeReadinessRowDto | null) {
  if (!row) return "Pending";
  const record = row as Record<string, unknown>;
  const symbol = getRecordStringValue(record, ["symbol", "ticker", "instrument"]);
  if (symbol) return symbol;

  const baseCurrency = getRecordStringValue(record, ["baseCurrency", "base_currency"]);
  const quoteCurrency = getQuoteCurrency(row);
  return baseCurrency ? `${baseCurrency}/${quoteCurrency}` : "Pending";
}

function getName(row: CryptoMarketRowDto | CryptoRuntimeReadinessRowDto | null) {
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

function getPaperStatusLabel(row: CryptoRuntimeReadinessRowDto | null) {
  if (!row) return "Pending";
  const value = getRecordBooleanValue(row as Record<string, unknown>, ["paperTradingEnabled", "paper_trading_enabled"]);
  if (value === null) return "Pending";
  return value ? "Paper enabled" : "Paper disabled";
}

function getUpdatedAtLabel(marketRow: CryptoMarketRowDto | null, readinessRow: CryptoRuntimeReadinessRowDto | null) {
  const marketRecord = marketRow as Record<string, unknown> | null;
  const readinessRecord = readinessRow as Record<string, unknown> | null;
  return (
    (marketRecord && getRecordStringValue(marketRecord, ["asOf", "as_of", "updatedAt", "updated_at"])) ||
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
  runtimeReadiness,
}: CryptoModelInput): CryptoReadOnlySurfaceModel {
  const marketRows = getMarketRows(marketOverview);
  const readinessRows = getReadinessRows(runtimeReadiness);
  const rowPairs = new Map<string, { market: CryptoMarketRowDto | null; readiness: CryptoRuntimeReadinessRowDto | null }>();

  for (const market of marketRows) {
    rowPairs.set(getRowKey(market), { market, readiness: null });
  }

  for (const readiness of readinessRows) {
    const key = getRowKey(readiness);
    const current = rowPairs.get(key);
    rowPairs.set(key, {
      market: current?.market ?? null,
      readiness,
    });
  }

  return {
    marketSource: buildSourceModel(marketOverview, marketRows.length),
    readinessSource: buildSourceModel(runtimeReadiness, readinessRows.length),
    rows: Array.from(rowPairs.entries()).map(([key, pair]) => {
      const primaryRow = pair.market ?? pair.readiness;
      return {
        assetClass: getAssetClass(primaryRow),
        key,
        lastPriceLabel: getLastPriceLabel(pair.market),
        liveControlsLabel: "No web controls",
        marketStatusLabel: getMarketStatusLabel(pair.market),
        name: getName(primaryRow),
        pairLabel: getPairLabel(primaryRow),
        paperStatusLabel: getPaperStatusLabel(pair.readiness),
        quoteCurrency: getQuoteCurrency(primaryRow),
        readinessLabel: getReadinessLabel(pair.readiness),
        updatedAtLabel: getUpdatedAtLabel(pair.market, pair.readiness),
        venue: getVenue(primaryRow),
      };
    }),
  };
}
