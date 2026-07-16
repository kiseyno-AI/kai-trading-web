import {
  SYMBOL_DETAIL_NAV_CONTEXT_PARAM,
  SYMBOL_DETAIL_SEARCH_NAV_CONTEXT,
} from "@/app/dashboard/symbol/[symbol]/symbol-detail-state";
import { getKnownSymbolSearchFallbacks } from "@/lib/search-known-symbol-fallbacks";
import {
  UNKNOWN_SYMBOL_META,
  getForwardableSymbolMetaSeedValue,
  normalizeSymbolMetaSeedValue,
} from "@/lib/symbol-meta";
import { hasDegradedDirectOpenSymbolDetailCoverage } from "@/lib/symbol-detail-coverage";
import { normalizeTrackedSymbolCode } from "@/lib/tracked-symbols-client";

export type SymbolSearchItem = {
  symbol: string;
  standard_code: string;
  name_ko: string;
  market: string;
  instrument_type: string | null;
  source?: "degraded-direct-open" | "degraded-known-symbol";
};

export const DEGRADED_DIRECT_OPEN_SOURCE = "degraded-direct-open";
export const DEGRADED_KNOWN_SYMBOL_SOURCE = "degraded-known-symbol";

const DIRECT_OPEN_SYMBOL_CODE = /^\d{6}$/;

export function normalizeSymbolCode(value: string) {
  return normalizeTrackedSymbolCode(value);
}

export function normalizeSearchItem(item: {
  symbol: string;
  standard_code?: string | null;
  name_ko?: string | null;
  market?: string | null;
  instrument_type?: string | null;
}): SymbolSearchItem {
  return {
    symbol: normalizeSymbolCode(item.symbol),
    standard_code: normalizeSymbolMetaSeedValue(item.standard_code ?? ""),
    name_ko: normalizeSymbolMetaSeedValue(item.name_ko ?? item.symbol),
    market: normalizeSymbolMetaSeedValue(item.market ?? ""),
    instrument_type: getForwardableSymbolMetaSeedValue(item.instrument_type ?? ""),
  };
}

export function buildSearchSymbolHref(item: SymbolSearchItem, query: string) {
  const params = new URLSearchParams();
  const name = getForwardableSymbolMetaSeedValue(item.name_ko);
  const market = getForwardableSymbolMetaSeedValue(item.market);
  const standardCode = getForwardableSymbolMetaSeedValue(item.standard_code);
  const normalizedQuery = query.trim();

  if (name) params.set("name", name);
  if (market) params.set("market", market);
  if (standardCode) params.set("standardCode", standardCode);
  params.set(SYMBOL_DETAIL_NAV_CONTEXT_PARAM, SYMBOL_DETAIL_SEARCH_NAV_CONTEXT);
  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }
  const queryString = params.toString();
  return `/dashboard/symbol/${encodeURIComponent(item.symbol)}${queryString ? `?${queryString}` : ""}`;
}

export function buildDegradedDirectOpenItem(query: string): SymbolSearchItem | null {
  const trimmedQuery = query.trim();
  const symbol = normalizeSymbolCode(trimmedQuery);

  if (symbol !== trimmedQuery || !DIRECT_OPEN_SYMBOL_CODE.test(symbol)) return null;

  const item: SymbolSearchItem = {
    symbol,
    standard_code: UNKNOWN_SYMBOL_META,
    name_ko: UNKNOWN_SYMBOL_META,
    market: UNKNOWN_SYMBOL_META,
    instrument_type: null,
    source: DEGRADED_DIRECT_OPEN_SOURCE,
  };

  return hasDegradedDirectOpenSymbolDetailCoverage(item) ? item : null;
}

export function buildDegradedKnownSymbolItems(query: string): SymbolSearchItem[] {
  return getKnownSymbolSearchFallbacks(query).map((item) => ({
    ...normalizeSearchItem(item),
    source: DEGRADED_KNOWN_SYMBOL_SOURCE,
  }));
}

export function buildDegradedSearchItems(query: string): SymbolSearchItem[] {
  const knownSymbolItems = buildDegradedKnownSymbolItems(query).filter(hasDegradedDirectOpenSymbolDetailCoverage);
  if (knownSymbolItems.length > 0) return knownSymbolItems;

  const directOpenItem = buildDegradedDirectOpenItem(query);
  return directOpenItem ? [directOpenItem] : [];
}

export function isDegradedDirectOpenSearchItem(item: SymbolSearchItem | null) {
  return item?.source === DEGRADED_DIRECT_OPEN_SOURCE;
}

export function isDegradedKnownSymbolSearchItem(item: SymbolSearchItem | null) {
  return item?.source === DEGRADED_KNOWN_SYMBOL_SOURCE;
}

export function isDegradedSearchItem(item: SymbolSearchItem | null) {
  return isDegradedDirectOpenSearchItem(item) || isDegradedKnownSymbolSearchItem(item);
}

export function getValidatedSymbolMasterItem(item: SymbolSearchItem | null) {
  return isDegradedSearchItem(item) ? null : item;
}
