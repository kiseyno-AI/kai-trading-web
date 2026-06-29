export type SymbolDetailCoverageInput = {
  symbol: string | null | undefined;
  market?: string | null;
  instrument_type?: string | null;
  name?: string | null;
  name_ko?: string | null;
  company_name?: string | null;
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
const UNSUPPORTED_PRODUCT_NAME_PREFIXES = ["KODEX", "TIGER", "KBSTAR", "KOSEF", "HANARO", "ARIRANG", "TIMEFOLIO"];
const UNSUPPORTED_PRODUCT_NAME_WEAK_PREFIXES = ["ACE", "RISE", "SOL", "FOCUS", "1Q"];
const UNSUPPORTED_PRODUCT_NAME_HINTS = ["ETF", "ETN", "INVERSE", "LEVERAGE", "FUTURES", "2X"];

function normalizeCoverageToken(value: string | null | undefined) {
  const trimmed = value?.trim().toUpperCase();
  if (!trimmed || trimmed === "-" || trimmed === "[확인 필요]") return null;
  return trimmed;
}

function normalizeInstrumentType(value: string | null | undefined) {
  return normalizeCoverageToken(value)?.replace(/[\s-]+/g, "_") ?? null;
}

function normalizeNameHint(value: string | null | undefined) {
  return normalizeCoverageToken(value)?.replace(/\s+/g, " ") ?? null;
}

function startsWithProductPrefix(value: string, prefixes: string[]) {
  return prefixes.some((prefix) => value === prefix || value.startsWith(prefix));
}

function hasUnsupportedProductNameHint(value: string | null | undefined) {
  const name = normalizeNameHint(value);
  if (!name) return false;

  if (startsWithProductPrefix(name, UNSUPPORTED_PRODUCT_NAME_PREFIXES)) {
    return true;
  }

  return (
    startsWithProductPrefix(name, UNSUPPORTED_PRODUCT_NAME_WEAK_PREFIXES) &&
    UNSUPPORTED_PRODUCT_NAME_HINTS.some((hint) => name.includes(hint))
  );
}

function hasSupportedMarketHint(value: string | null | undefined) {
  const market = normalizeCoverageToken(value);
  if (!market) return true;
  return SYMBOL_DETAIL_MARKET_HINTS.some((hint) => market === hint || market.includes(hint));
}

function hasUnsupportedProductName(item: SymbolDetailCoverageInput) {
  return [item.name_ko, item.name, item.company_name].some(hasUnsupportedProductNameHint);
}

export function hasSymbolDetailCoverage(item: SymbolDetailCoverageInput) {
  const symbol = normalizeCoverageToken(item.symbol)?.replace(/[^A-Z0-9]/g, "") ?? "";
  if (!KRX_SYMBOL_DETAIL_SYMBOL.test(symbol)) return false;

  if (hasUnsupportedProductName(item)) {
    return false;
  }

  const instrumentType = normalizeInstrumentType(item.instrument_type);
  if (instrumentType && !SUPPORTED_SYMBOL_DETAIL_INSTRUMENT_TYPES.has(instrumentType)) {
    return false;
  }

  return hasSupportedMarketHint(item.market);
}
