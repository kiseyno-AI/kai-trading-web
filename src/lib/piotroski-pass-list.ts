import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import { getCachedTradingApiJson } from "@/lib/trading-api-cache";
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

export type PiotroskiPassListResult = {
  marketDate: string;
  totalPassedCount: number;
  summary: EodPiotroskiFilterResultsResponseDto["summary"];
  items: PiotroskiPassListItem[];
};

function getJson<T>(path: string): Promise<T> {
  return getCachedTradingApiJson<T>(resolveTradingApiClientPath(path));
}

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
): Promise<PiotroskiSymbolMetadataItem | null> {
  try {
    const data = await getJson<PiotroskiSymbolSearchResponse>(
      `/api/trading/symbols/search?q=${encodeURIComponent(symbol)}&limit=8`,
    );
    return pickSymbolMetadata(symbol, data);
  } catch (error) {
    console.error("Piotroski symbol metadata load failed", error);
    return null;
  }
}

async function loadPiotroskiItemQuote(symbol: string): Promise<PiotroskiQuoteResponse | null> {
  try {
    return await getJson<PiotroskiQuoteResponse>(`/api/trading/quotes/${encodeURIComponent(symbol)}`);
  } catch (error) {
    console.error("Piotroski quote load failed", error);
    return null;
  }
}

async function enrichPiotroskiItem(
  item: EodPiotroskiFilterResultItemDto,
): Promise<PiotroskiPassListItem> {
  const quote = await loadPiotroskiItemQuote(item.symbol);
  const companyNameFromQuote = getUsableCompanyName(item.symbol, quote?.company_name);
  const metadata = companyNameFromQuote ? null : await loadPiotroskiItemMetadata(item.symbol);

  return {
    symbol: item.symbol,
    marketDate: item.market_date,
    piotroskiScore: item.piotroski_score,
    companyName:
      companyNameFromQuote ??
      getUsableCompanyName(item.symbol, metadata?.name_ko, metadata?.name, metadata?.company_name),
    metadata,
    quote,
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

  const passedItems = [...(data.items ?? [])]
    .filter((item) => item.passed_filter)
    .sort(comparePiotroskiRows);
  const selectedItems =
    typeof limit === "number" && Number.isFinite(limit) ? passedItems.slice(0, Math.max(limit, 0)) : passedItems;

  return {
    marketDate: data.market_date,
    totalPassedCount: passedItems.length,
    summary: data.summary,
    items: await Promise.all(selectedItems.map((item) => enrichPiotroskiItem(item))),
  };
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

  const query = params.toString();
  return `/dashboard/symbol/${encodeURIComponent(symbol)}${query ? `?${query}` : ""}`;
}
