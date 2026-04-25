import type { SymbolDetailCopy } from "@/i18n/symbol-detail-copy";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import { getTradingApiJsonResult } from "@/lib/trading-api-cache";

import { normalizeTrackedSymbols } from "./symbol-detail-derived-state";
import type { TrackedSymbolsResponse } from "./symbol-detail-types";

export async function fetchUnitJson<T>(path: string): Promise<T> {
  const response = await fetch(resolveTradingApiClientPath(path), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getSymbolDetailJsonResult<T>(path: string, init?: RequestInit) {
  return getTradingApiJsonResult<T>(resolveTradingApiClientPath(path), init);
}

export async function loadTrackedSymbolsSnapshot(copy: SymbolDetailCopy) {
  const result = await getSymbolDetailJsonResult<TrackedSymbolsResponse>("/api/trading/scanner/tracked-symbols");
  if (!result.ok) {
    return {
      ok: false as const,
      message: `${copy.errors.trackingStatusUnavailable} HTTP ${result.status}`,
    };
  }

  return {
    ok: true as const,
    symbols: normalizeTrackedSymbols(result.data.tracked_symbols),
  };
}
