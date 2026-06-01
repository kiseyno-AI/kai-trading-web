import { MOBILE_TOOLBAR_TRACKED_SYMBOLS_PATH } from "@/lib/mobile-toolbar-data";
import { getTradingApiJsonResult, invalidateTradingApiCacheByPathPrefix } from "@/lib/trading-api-cache";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";

export type TrackedSymbolsResponse = {
  tracked_symbols: string[];
  count: number;
  last_updated_at: string | null;
};

export function normalizeTrackedSymbolCode(value: string) {
  return value.trim().toUpperCase();
}

export function normalizeTrackedSymbolList(symbols: string[]) {
  return symbols.map(normalizeTrackedSymbolCode).filter(Boolean);
}

export function getTrackedSymbols() {
  return getTradingApiJsonResult<TrackedSymbolsResponse>(
    resolveTradingApiClientPath(MOBILE_TOOLBAR_TRACKED_SYMBOLS_PATH),
  );
}

export function invalidateTrackedSymbolsCache() {
  invalidateTradingApiCacheByPathPrefix([MOBILE_TOOLBAR_TRACKED_SYMBOLS_PATH]);
}

export function getFreshTrackedSymbols() {
  invalidateTrackedSymbolsCache();
  return getTrackedSymbols();
}

export function replaceTrackedSymbols(symbols: string[]) {
  return getTradingApiJsonResult<TrackedSymbolsResponse>(
    resolveTradingApiClientPath(MOBILE_TOOLBAR_TRACKED_SYMBOLS_PATH),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ symbols: normalizeTrackedSymbolList(symbols) }),
    },
  );
}

export type RemoveTrackedSymbolResult =
  | { ok: true; data: TrackedSymbolsResponse; nextSymbols: string[] }
  | { ok: false; phase: "refresh" | "replace"; message: string | null; status: number };

export async function removeTrackedSymbol(symbolInput: string): Promise<RemoveTrackedSymbolResult> {
  const symbol = normalizeTrackedSymbolCode(symbolInput);
  const currentResult = await getFreshTrackedSymbols();
  if (!currentResult.ok) {
    return { ...currentResult, phase: "refresh" };
  }

  const currentTrackedSymbols = normalizeTrackedSymbolList(currentResult.data.tracked_symbols);
  const nextSymbols = currentTrackedSymbols.filter((currentSymbol) => currentSymbol !== symbol);
  const result = await replaceTrackedSymbols(nextSymbols);
  if (!result.ok) {
    return { ...result, phase: "replace" };
  }

  return { ok: true, data: result.data, nextSymbols };
}
