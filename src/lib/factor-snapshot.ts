import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import { getTradingApiJsonResult, type TradingApiJsonResult } from "@/lib/trading-api-cache";
import type {
  EodAdvancedValueFactorItemDto,
  EodAdvancedValueFactorSummaryDto,
  EodAdvancedValueFactorsResponseDto,
  EodBetaFactorItemDto,
  EodBetaFactorSummaryDto,
  EodBetaFactorsResponseDto,
  EodLowRiskFactorItemDto,
  EodLowRiskFactorSummaryDto,
  EodLowRiskFactorsResponseDto,
  EodMomentumFactorItemDto,
  EodMomentumFactorSummaryDto,
  EodMomentumFactorsResponseDto,
  EodValueFactorItemDto,
  EodValueFactorSummaryDto,
  EodValueFactorsResponseDto,
} from "@/types/trading-api";

export const FACTOR_FAMILY_ORDER = [
  "momentum",
  "lowRisk",
  "beta",
  "value",
  "advancedValue",
] as const;

export type FactorFamilyId = (typeof FACTOR_FAMILY_ORDER)[number];
export type FactorStatusTone = "positive" | "info" | "warning" | "negative" | "neutral";

export type FactorStatusDescriptor = {
  code: string;
  tone: FactorStatusTone;
};

export const FACTOR_STATUS_LABELS: Record<string, string> = {
  eligible: "Eligible",
  watchlist: "Watchlist",
  unavailable: "Unavailable",
  missing_row: "No row",
  insufficient_history: "Insufficient history",
  insufficient_components: "Insufficient components",
  insufficient_fundamentals: "Insufficient fundamentals",
  missing_market_date_bar: "Missing market-date bar",
  missing_metric: "Missing metric",
  invalid_per: "PER excluded",
  liquidity_excluded: "Liquidity excluded",
  ineligible: "Ineligible",
  overheated: "Overheated",
  trend_filtered: "Trend filtered",
  scored: "Scored",
};

export const FACTOR_FAMILY_META: Record<
  FactorFamilyId,
  {
    api: string;
    subtitle: string;
    title: string;
  }
> = {
  momentum: {
    api: "/api/trading/eod/momentum-factors",
    subtitle: "12-1 trend, moving-average confirmation, and overheat guard",
    title: "Momentum",
  },
  lowRisk: {
    api: "/api/trading/eod/low-risk-factors",
    subtitle: "Realized volatility, drawdown, and liquidity floor",
    title: "Low risk",
  },
  beta: {
    api: "/api/trading/eod/beta-factors",
    subtitle: "Benchmark-relative beta and low-beta classification",
    title: "Beta",
  },
  value: {
    api: "/api/trading/eod/value-factors",
    subtitle: "Unified valuation score with PER, PBR, dividend yield, FCF yield, and EV / EBITDA context",
    title: "Unified value",
  },
  advancedValue: {
    api: "/api/trading/eod/advanced-value-factors",
    subtitle: "FCF yield plus EV / EBITDA component view from stored DART fundamentals",
    title: "Advanced value components",
  },
};

type FactorResponseByFamily = {
  momentum: EodMomentumFactorsResponseDto;
  lowRisk: EodLowRiskFactorsResponseDto;
  beta: EodBetaFactorsResponseDto;
  value: EodValueFactorsResponseDto;
  advancedValue: EodAdvancedValueFactorsResponseDto;
};

type FactorItemByFamily = {
  momentum: EodMomentumFactorItemDto;
  lowRisk: EodLowRiskFactorItemDto;
  beta: EodBetaFactorItemDto;
  value: EodValueFactorItemDto;
  advancedValue: EodAdvancedValueFactorItemDto;
};

type FactorSummaryByFamily = {
  momentum: EodMomentumFactorSummaryDto;
  lowRisk: EodLowRiskFactorSummaryDto;
  beta: EodBetaFactorSummaryDto;
  value: EodValueFactorSummaryDto;
  advancedValue: EodAdvancedValueFactorSummaryDto;
};

export type FactorFamilySnapshotResult<FamilyId extends FactorFamilyId> = {
  family: FamilyId;
  path: string;
  ok: boolean;
  status: number | null;
  requestedMarketDate: string;
  marketDate: string | null;
  featureVersion: string | null;
  summary: FactorSummaryByFamily[FamilyId] | null;
  item: FactorItemByFamily[FamilyId] | null;
  items: FactorItemByFamily[FamilyId][];
  error: string | null;
};

export type SymbolFactorSnapshotDto = {
  symbol: string;
  requestedMarketDate: string;
  composite: {
    code: "pending_endpoint";
    status: "future";
  };
  families: {
    [Key in FactorFamilyId]: FactorFamilySnapshotResult<Key>;
  };
};

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase();
}

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

type UnifiedValueFieldSource = {
  unified_value_score?: number | null;
  unified_value_rank?: number | null;
  unified_value_percentile?: number | null;
  unified_value_status?: string | null;
};

export function hasUnifiedValueFields(item: UnifiedValueFieldSource | null | undefined) {
  if (!item) return false;

  return (
    hasNumber(item.unified_value_score) ||
    hasNumber(item.unified_value_rank) ||
    hasNumber(item.unified_value_percentile) ||
    Boolean(item.unified_value_status?.trim())
  );
}

export function resolveUnifiedValueStatusCode(item: UnifiedValueFieldSource | null | undefined) {
  const explicitStatus = item?.unified_value_status?.trim();
  if (explicitStatus) return explicitStatus;
  return hasUnifiedValueFields(item) ? "scored" : null;
}

function buildSymbolFactorPath(pathname: string, marketDate: string, symbol: string, symbolParamName: string) {
  const params = new URLSearchParams();
  params.set("market_date", marketDate);
  params.set(symbolParamName, symbol);
  return `${pathname}?${params.toString()}`;
}

export function buildFactorInspectPath(family: FactorFamilyId, options: { marketDate: string; symbol: string }) {
  const normalizedSymbol = normalizeSymbol(options.symbol);

  switch (family) {
    case "momentum": {
      const params = new URLSearchParams();
      params.set("market_date", options.marketDate);
      params.set("symbols", normalizedSymbol);
      params.set("limit", "1");
      return `/api/trading/eod/momentum-factors?${params.toString()}`;
    }
    case "lowRisk":
      return buildSymbolFactorPath("/api/trading/eod/low-risk-factors", options.marketDate, normalizedSymbol, "symbol");
    case "beta":
      return buildSymbolFactorPath("/api/trading/eod/beta-factors", options.marketDate, normalizedSymbol, "symbol");
    case "value":
      return buildSymbolFactorPath("/api/trading/eod/value-factors", options.marketDate, normalizedSymbol, "symbol");
    case "advancedValue":
      return buildSymbolFactorPath(
        "/api/trading/eod/advanced-value-factors",
        options.marketDate,
        normalizedSymbol,
        "symbol",
      );
  }
}

export function getFactorStatusLabel(code: string) {
  return FACTOR_STATUS_LABELS[code] ?? code;
}

export function getUnifiedValueStatusDescriptor(
  statusCode: string | null | undefined,
): FactorStatusDescriptor {
  switch (statusCode) {
    case "scored":
      return { code: "scored", tone: "positive" };
    case "watchlist":
      return { code: "watchlist", tone: "info" };
    case "ineligible":
      return { code: "ineligible", tone: "negative" };
    case "invalid_per":
    case "missing_metric":
    case "insufficient_components":
    case "insufficient_fundamentals":
    case "missing_market_date_bar":
      return { code: statusCode, tone: "warning" };
    default:
      return { code: statusCode?.trim() || "unavailable", tone: "warning" };
  }
}

export function extractFactorInspectItems<T extends { symbol: string }>(
  response: {
    item?: T | null;
    items?: T[] | null;
  },
) {
  const itemsBySymbol = new Map<string, T>();

  if (response.item) {
    itemsBySymbol.set(normalizeSymbol(response.item.symbol), response.item);
  }

  for (const item of response.items ?? []) {
    itemsBySymbol.set(normalizeSymbol(item.symbol), item);
  }

  return Array.from(itemsBySymbol.values());
}

export function pickFactorInspectItem<T extends { symbol: string }>(
  response: {
    item?: T | null;
    items?: T[] | null;
  },
  symbol: string,
) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const matchedItem = extractFactorInspectItems(response).find(
    (item) => normalizeSymbol(item.symbol) === normalizedSymbol,
  );

  if (matchedItem) {
    return matchedItem;
  }

  if (response.item) {
    return response.item;
  }

  return response.items?.[0] ?? null;
}

export function buildFactorFamilySnapshotResult<FamilyId extends FactorFamilyId>(
  family: FamilyId,
  requestedMarketDate: string,
  symbol: string,
  path: string,
  result: TradingApiJsonResult<FactorResponseByFamily[FamilyId]>,
): FactorFamilySnapshotResult<FamilyId> {
  if (!result.ok) {
    return {
      family,
      path,
      ok: false,
      status: result.status,
      requestedMarketDate,
      marketDate: null,
      featureVersion: null,
      summary: null,
      item: null,
      items: [],
      error: `HTTP ${result.status}`,
    };
  }

  const response = result.data as {
    market_date?: string | null;
    feature_version?: string | null;
    summary?: FactorSummaryByFamily[FamilyId] | null;
    item?: FactorItemByFamily[FamilyId] | null;
    items?: FactorItemByFamily[FamilyId][] | null;
  };
  const items = extractFactorInspectItems<FactorItemByFamily[FamilyId]>(response);

  return {
    family,
    path,
    ok: true,
    status: 200,
    requestedMarketDate,
    marketDate: response.market_date ?? null,
    featureVersion: response.feature_version ?? null,
    summary: response.summary ?? null,
    item: pickFactorInspectItem<FactorItemByFamily[FamilyId]>(response, symbol),
    items,
    error: null,
  };
}

async function loadFactorFamilySnapshotResult<FamilyId extends FactorFamilyId>(
  family: FamilyId,
  options: {
    marketDate: string;
    symbol: string;
  },
): Promise<FactorFamilySnapshotResult<FamilyId>> {
  const path = buildFactorInspectPath(family, options);

  try {
    const result = await getTradingApiJsonResult<FactorResponseByFamily[FamilyId]>(
      resolveTradingApiClientPath(path),
    );

    return buildFactorFamilySnapshotResult(
      family,
      options.marketDate,
      options.symbol,
      path,
      result,
    );
  } catch (error) {
    return {
      family,
      path,
      ok: false,
      status: null,
      requestedMarketDate: options.marketDate,
      marketDate: null,
      featureVersion: null,
      summary: null,
      item: null,
      items: [],
      error: error instanceof Error ? error.message : "Unknown factor snapshot error",
    };
  }
}

export async function loadSymbolFactorSnapshot(options: {
  marketDate: string;
  symbol: string;
}): Promise<SymbolFactorSnapshotDto> {
  const entries = await Promise.all(
    FACTOR_FAMILY_ORDER.map(async (family) => {
      const snapshot = await loadFactorFamilySnapshotResult(family, options);
      return [family, snapshot] as const;
    }),
  );

  return {
    symbol: normalizeSymbol(options.symbol),
    requestedMarketDate: options.marketDate,
    composite: {
      code: "pending_endpoint",
      status: "future",
    },
    families: Object.fromEntries(entries) as SymbolFactorSnapshotDto["families"],
  };
}

export function getMomentumFactorStatusDescriptor(
  item: EodMomentumFactorItemDto | null,
): FactorStatusDescriptor {
  if (!item) return { code: "unavailable", tone: "warning" };
  if (!item.has_sufficient_history) return { code: "insufficient_history", tone: "warning" };
  if (item.is_momentum_eligible) return { code: "eligible", tone: "positive" };
  if (item.is_recent_overheated) return { code: "overheated", tone: "warning" };
  return { code: "trend_filtered", tone: "neutral" };
}

export function getLowRiskFactorStatusDescriptor(
  item: EodLowRiskFactorItemDto | null,
): FactorStatusDescriptor {
  if (!item) return { code: "unavailable", tone: "warning" };

  switch (item.low_risk_classification) {
    case "eligible":
      return { code: "eligible", tone: "positive" };
    case "watchlist":
      return { code: "watchlist", tone: "info" };
    case "liquidity_excluded":
      return { code: "liquidity_excluded", tone: "warning" };
    case "ineligible":
      return { code: "ineligible", tone: "negative" };
    case "missing_market_date_bar":
      return { code: "missing_market_date_bar", tone: "warning" };
    case "insufficient_history":
    default:
      return { code: "insufficient_history", tone: "warning" };
  }
}

export function getBetaFactorStatusDescriptor(
  item: EodBetaFactorItemDto | null,
): FactorStatusDescriptor {
  if (!item) return { code: "unavailable", tone: "warning" };

  switch (item.low_beta_classification) {
    case "eligible":
      return { code: "eligible", tone: "positive" };
    case "watchlist":
      return { code: "watchlist", tone: "info" };
    case "ineligible":
      return { code: "ineligible", tone: "negative" };
    case "missing_market_date_bar":
      return { code: "missing_market_date_bar", tone: "warning" };
    case "insufficient_history":
    default:
      return { code: "insufficient_history", tone: "warning" };
  }
}

export function getValueFactorStatusDescriptor(
  item: EodValueFactorItemDto | null,
): FactorStatusDescriptor {
  if (!item) return { code: "unavailable", tone: "warning" };

  if (hasUnifiedValueFields(item)) {
    return getUnifiedValueStatusDescriptor(resolveUnifiedValueStatusCode(item));
  }

  switch (item.value_status) {
    case "scored":
      return { code: "scored", tone: "positive" };
    case "invalid_per":
      return { code: "invalid_per", tone: "warning" };
    case "missing_market_date_bar":
      return { code: "missing_market_date_bar", tone: "warning" };
    case "missing_metric":
    default:
      return { code: "missing_metric", tone: "warning" };
  }
}

export function getAdvancedValueFactorStatusDescriptor(
  item: EodAdvancedValueFactorItemDto | null,
): FactorStatusDescriptor {
  if (!item) return { code: "unavailable", tone: "warning" };

  switch (item.advanced_value_classification) {
    case "eligible":
      return { code: "eligible", tone: "positive" };
    case "watchlist":
      return { code: "watchlist", tone: "info" };
    case "ineligible":
      return { code: "ineligible", tone: "negative" };
    case "insufficient_fundamentals":
      return { code: "insufficient_fundamentals", tone: "warning" };
    case "missing_market_date_bar":
      return { code: "missing_market_date_bar", tone: "warning" };
    case "insufficient_components":
    default:
      return { code: "insufficient_components", tone: "warning" };
  }
}
