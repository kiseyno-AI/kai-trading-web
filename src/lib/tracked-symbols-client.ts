import { MOBILE_TOOLBAR_TRACKED_SYMBOLS_PATH } from "@/lib/mobile-toolbar-data";
import { getTradingApiJsonResult } from "@/lib/trading-api-cache";
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
