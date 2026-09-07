import {
  SYMBOL_DETAIL_NAV_CONTEXT_PARAM,
  SYMBOL_DETAIL_PIOTROSKI_NAV_CONTEXT,
} from "@/app/dashboard/symbol/[symbol]/symbol-detail-state";
import { selectExactSymbolQuote } from "@/lib/exact-symbol-quote";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import type {
  EodFreshnessResponseDto,
  EodPiotroskiFilterResultItemDto,
  EodPiotroskiFilterResultsResponseDto,
} from "@/types/trading-api";

export type PiotroskiQuoteResponse = {
  symbol: string;
  company_name?: string | null;
  price: number | null;
  change: number | null;
  change_pct: number | null;
  volume: number | null;
  turnover: number | null;
  market_state: string;
  source: string;
  fallback: boolean;
  is_live: boolean;
  available: boolean;
  cached_at?: string | null;
  trade_date?: string | null;
  fallback_reason?: string | null;
  unavailable_reason?: string | null;
};

export type PiotroskiSymbolMetadataItem = {
  symbol: string;
  company_name?: string | null;
  name?: string | null;
  name_ko?: string | null;
  market?: string | null;
  standard_code?: string | null;
};

type PiotroskiSymbolSearchResponse = {
  items: PiotroskiSymbolMetadataItem[];
};

export type PiotroskiPassListItem = {
  symbol: string;
  marketDate: string;
  piotroskiScore: number | null;
  companyName: string | null;
  metadata: PiotroskiSymbolMetadataItem | null;
  quote: PiotroskiQuoteResponse | null;
};

export type PiotroskiMarketDateResolution = {
  requestedMarketDate: string | null;
  resolvedMarketDate: string | null;
  effectiveMarketDate: string | null;
  isLatestFallback: boolean;
};

export type PiotroskiPassListResult = {
  marketDate: string;
  requestedMarketDate: string | null;
  resolvedMarketDate: string | null;
  isLatestFallback: boolean;
  totalPassedCount: number;
  summary: EodPiotroskiFilterResultsResponseDto["summary"];
  items: PiotroskiPassListItem[];
};

export const PIOTROSKI_UNAVAILABLE_CHANGE_LABEL = "변동 미제공";
export const PIOTROSKI_UNAVAILABLE_CHANGE_FALLBACK_LABEL = "[확인 필요]";

const PIOTROSKI_UNAVAILABLE_CHANGE_REASON_LABELS: Record<string, string> = {
  no_live_quote_or_fresh_fallback: PIOTROSKI_UNAVAILABLE_CHANGE_LABEL,
};

export function getPiotroskiUnavailableChangeLabel(
  unavailableReason: string | null | undefined,
  fallbackLabel: string = PIOTROSKI_UNAVAILABLE_CHANGE_LABEL,
) {
  if (!hasTextValue(unavailableReason)) return fallbackLabel;

  const normalizedReason = unavailableReason.trim();
  if (!normalizedReason) return fallbackLabel;

  return PIOTROSKI_UNAVAILABLE_CHANGE_REASON_LABELS[normalizedReason] ?? PIOTROSKI_UNAVAILABLE_CHANGE_FALLBACK_LABEL;
}

const PIOTROSKI_ITEM_ENRICHMENT_TIMEOUT_MS = 4_000;

function getJsonErrorMessage(parsedBody: unknown) {
  if (!parsedBody || typeof parsedBody !== "object") return null;

  const body = parsedBody as Record<string, unknown>;
  for (const key of ["detail", "message", "error"]) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

async function getJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  const response = await fetch(resolveTradingApiClientPath(path), {
    ...init,
    cache: "no-store",
    headers,
  });
  const responseText = await response.text();
  let parsedBody: unknown = null;

  if (responseText) {
    try {
      parsedBody = JSON.parse(responseText);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : `Failed to parse JSON for ${path}`);
    }
  }

  if (!response.ok) {
    throw new Error(getJsonErrorMessage(parsedBody) ?? `HTTP ${response.status}`);
  }

  return parsedBody as T;
}

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeMarketDate(value: string | null | undefined) {
  if (!hasTextValue(value)) return null;

  const trimmed = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);

  return match?.[1] ?? trimmed;
}

function getUsableCompanyName(symbol: string, ...values: Array<string | null | undefined>): string | null {
  const normalizedSymbol = symbol.trim().toUpperCase();

  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed && trimmed.toUpperCase() !== normalizedSymbol) {
      return trimmed;
    }
  }

  return null;
}

function pickSymbolMetadata(
  symbol: string,
  response: PiotroskiSymbolSearchResponse,
): PiotroskiSymbolMetadataItem | null {
  const normalizedSymbol = symbol.trim().toUpperCase();
  return response.items.find((item) => item.symbol.trim().toUpperCase() === normalizedSymbol) ?? null;
}

function comparePiotroskiRows(
  left: EodPiotroskiFilterResultItemDto,
  right: EodPiotroskiFilterResultItemDto,
) {
  const leftScore = left.piotroski_score ?? Number.NEGATIVE_INFINITY;
  const rightScore = right.piotroski_score ?? Number.NEGATIVE_INFINITY;

  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  return left.symbol.localeCompare(right.symbol, "en");
}

async function loadPiotroskiItemMetadata(
  symbol: string,
  signal?: AbortSignal,
): Promise<PiotroskiSymbolMetadataItem | null> {
  try {
    const data = await getJson<PiotroskiSymbolSearchResponse>(
      `/api/trading/symbols/search?q=${encodeURIComponent(symbol)}&limit=8`,
      { signal },
    );
    return pickSymbolMetadata(symbol, data);
  } catch (error) {
    console.error("Piotroski symbol metadata load failed", error);
    return null;
  }
}

async function loadPiotroskiItemQuote(symbol: string, signal?: AbortSignal): Promise<PiotroskiQuoteResponse | null> {
  try {
    const quote = await getJson<PiotroskiQuoteResponse>(`/api/trading/quotes/${encodeURIComponent(symbol)}`, { signal });
    return selectExactSymbolQuote(quote, symbol);
  } catch (error) {
    console.error("Piotroski quote load failed", error);
    return null;
  }
}

export async function loadPiotroskiPassListItemEnrichment(
  item: PiotroskiPassListItem,
  {
    timeoutMs = PIOTROSKI_ITEM_ENRICHMENT_TIMEOUT_MS,
  }: {
    timeoutMs?: number;
  } = {},
): Promise<PiotroskiPassListItem> {
  const abortController = new AbortController();
  const timeout = globalThis.setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  try {
    const quote = await loadPiotroskiItemQuote(item.symbol, abortController.signal);
    const companyNameFromQuote = getUsableCompanyName(item.symbol, quote?.company_name);
    const metadata = companyNameFromQuote ? null : await loadPiotroskiItemMetadata(item.symbol, abortController.signal);

    return {
      ...item,
      symbol: item.symbol,
      companyName:
        companyNameFromQuote ??
        getUsableCompanyName(item.symbol, metadata?.name_ko, metadata?.name, metadata?.company_name),
      metadata,
      quote,
    };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function buildPiotroskiPassListItem(item: EodPiotroskiFilterResultItemDto): PiotroskiPassListItem {
  return {
    symbol: item.symbol,
    marketDate: item.market_date,
    piotroskiScore: item.piotroski_score,
    companyName: null,
    metadata: null,
    quote: null,
  };
}

export function resolvePiotroskiMarketDateResolution(
  response: Pick<
    EodPiotroskiFilterResultsResponseDto,
    "market_date" | "requested_market_date" | "resolved_market_date" | "is_latest_fallback"
  > | null | undefined,
  requestedMarketDate: string | null | undefined,
): PiotroskiMarketDateResolution {
  const normalizedRequestedMarketDate = normalizeMarketDate(requestedMarketDate);
  const responseRequestedMarketDate = normalizeMarketDate(response?.requested_market_date);
  const responseResolvedMarketDate = normalizeMarketDate(response?.resolved_market_date);
  const responseEffectiveMarketDate = normalizeMarketDate(response?.market_date);
  const effectiveMarketDate =
    responseEffectiveMarketDate ?? responseResolvedMarketDate ?? responseRequestedMarketDate ?? normalizedRequestedMarketDate;
  const resolvedMarketDate =
    responseResolvedMarketDate ?? responseEffectiveMarketDate ?? responseRequestedMarketDate ?? normalizedRequestedMarketDate;

  return {
    requestedMarketDate: responseRequestedMarketDate ?? normalizedRequestedMarketDate,
    resolvedMarketDate,
    effectiveMarketDate,
    isLatestFallback: response?.is_latest_fallback === true,
  };
}

export function buildPiotroskiPassListResult(
  data: EodPiotroskiFilterResultsResponseDto,
  marketDate: string,
  limit?: number | null,
): PiotroskiPassListResult {
  const marketDateResolution = resolvePiotroskiMarketDateResolution(data, marketDate);
  const passedItems = [...(data.items ?? [])]
    .filter((item) => item.passed_filter)
    .sort(comparePiotroskiRows);
  const selectedItems =
    typeof limit === "number" && Number.isFinite(limit) ? passedItems.slice(0, Math.max(limit, 0)) : passedItems;

  return {
    marketDate: marketDateResolution.effectiveMarketDate ?? marketDate,
    requestedMarketDate: marketDateResolution.requestedMarketDate,
    resolvedMarketDate: marketDateResolution.resolvedMarketDate,
    isLatestFallback: marketDateResolution.isLatestFallback,
    totalPassedCount: data.summary.passed_count,
    summary: data.summary,
    items: selectedItems.map(buildPiotroskiPassListItem),
  };
}

export async function loadPiotroskiPassList({
  marketDate,
  limit,
}: {
  marketDate: string;
  limit?: number | null;
}): Promise<PiotroskiPassListResult> {
  const params = new URLSearchParams({ market_date: marketDate });
  const data = await getJson<EodPiotroskiFilterResultsResponseDto>(
    `/api/trading/eod/piotroski-filter-results?${params.toString()}`,
  );
  return buildPiotroskiPassListResult(data, marketDate, limit);
}

export function getPiotroskiMarketDate(
  freshness: EodFreshnessResponseDto | null,
  fallbackValue?: string | null,
) {
  const tradeDate = freshness?.today?.trade_date;
  if (hasTextValue(tradeDate)) return tradeDate;
  if (!hasTextValue(fallbackValue)) return null;
  return fallbackValue.slice(0, 10);
}

export function buildPiotroskiListHref(marketDate: string | null | undefined) {
  const params = new URLSearchParams();
  if (hasTextValue(marketDate)) {
    params.set("marketDate", marketDate);
  }

  const query = params.toString();
  return `/dashboard/piotroski-filter${query ? `?${query}` : ""}`;
}

export function buildPiotroskiSymbolHref({
  symbol,
  companyName,
  marketDate,
}: {
  symbol: string;
  companyName?: string | null;
  marketDate?: string | null;
}) {
  const params = new URLSearchParams();

  if (hasTextValue(companyName)) {
    params.set("name", companyName);
  }

  if (hasTextValue(marketDate)) {
    params.set("marketDate", marketDate);
  }

  params.set(SYMBOL_DETAIL_NAV_CONTEXT_PARAM, SYMBOL_DETAIL_PIOTROSKI_NAV_CONTEXT);

  const query = params.toString();
  return `/dashboard/symbol/${encodeURIComponent(symbol)}${query ? `?${query}` : ""}`;
}
