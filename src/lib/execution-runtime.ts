export const EXECUTION_RUNTIME_STATUS_UPSTREAM_PATH = "/execution/runtime/status";
export const EXECUTION_RUNTIME_MONITORED_SYMBOLS_UPSTREAM_PATH = "/execution/runtime/monitored-symbols";
export const EXECUTION_RUNTIME_DAILY_BOARD_UPSTREAM_PATH = "/execution/runtime/daily-board";
export const EXECUTION_RUNTIME_SYMBOL_UPSTREAM_BASE_PATH = "/execution/runtime/symbols";

export const EXECUTION_RUNTIME_STATUS_CLIENT_PATH = "/api/trading/execution/runtime/status";
export const EXECUTION_RUNTIME_MONITORED_SYMBOLS_CLIENT_PATH = "/api/trading/execution/runtime/monitored-symbols";
export const EXECUTION_RUNTIME_DAILY_BOARD_CLIENT_PATH = "/api/trading/execution/runtime/daily-board";
export const EXECUTION_RUNTIME_SYMBOL_CLIENT_BASE_PATH = "/api/trading/execution/runtime/symbols";

function normalizeMarketDate(value: string | null | undefined) {
  return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

export function buildExecutionRuntimeMarketDatePath(basePath: string, marketDate: string | null | undefined) {
  const params = new URLSearchParams();
  const normalizedMarketDate = normalizeMarketDate(marketDate);

  if (normalizedMarketDate) {
    params.set("market_date", normalizedMarketDate);
  }

  return params.size > 0 ? `${basePath}?${params.toString()}` : basePath;
}

export function buildExecutionRuntimeSymbolPath(
  basePath: string,
  symbol: string,
  marketDate: string | null | undefined,
) {
  const encodedSymbol = encodeURIComponent(symbol.trim().toUpperCase());
  return buildExecutionRuntimeMarketDatePath(`${basePath}/${encodedSymbol}`, marketDate);
}
