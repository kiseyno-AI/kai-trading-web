export type SymbolDetailCoverageInput = {
  symbol: string | null | undefined;
  market?: string | null;
  instrument_type?: string | null;
};

const KRX_SYMBOL_DETAIL_SYMBOL = /^\d{6}$/;
const SYMBOL_DETAIL_MARKET_HINTS = ["KRX", "KOSPI", "KOSDAQ", "KONEX"];
const SUPPORTED_SYMBOL_DETAIL_INSTRUMENT_TYPES = new Set([
  "COMMONSTOCK",
  "COMMON_STOCK",
  "EQUITY",
  "PREFERREDSTOCK",
  "PREFERRED_STOCK",
  "STOCK",
]);

function normalizeCoverageToken(value: string | null | undefined) {
  const trimmed = value?.trim().toUpperCase();
  if (!trimmed || trimmed === "-" || trimmed === "[확인 필요]") return null;
  return trimmed;
}

function normalizeInstrumentType(value: string | null | undefined) {
  return normalizeCoverageToken(value)?.replace(/[\s-]+/g, "_") ?? null;
}

function hasSupportedMarketHint(value: string | null | undefined) {
  const market = normalizeCoverageToken(value);
  if (!market) return true;
  return SYMBOL_DETAIL_MARKET_HINTS.some((hint) => market === hint || market.includes(hint));
}

export function hasSymbolDetailCoverage(item: SymbolDetailCoverageInput) {
  const symbol = normalizeCoverageToken(item.symbol)?.replace(/[^A-Z0-9]/g, "") ?? "";
  if (!KRX_SYMBOL_DETAIL_SYMBOL.test(symbol)) return false;

  const instrumentType = normalizeInstrumentType(item.instrument_type);
  if (instrumentType && !SUPPORTED_SYMBOL_DETAIL_INSTRUMENT_TYPES.has(instrumentType)) {
    return false;
  }

  return hasSupportedMarketHint(item.market);
}
