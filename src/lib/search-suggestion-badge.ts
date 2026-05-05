export type SearchSuggestionBadgeInput = {
  symbol: string;
  market: string;
};

const KRX_NUMERIC_SYMBOL = /^\d{6}$/;
const UNKNOWN_SYMBOL_META = "[확인 필요]";

function normalizeSymbol(value: string) {
  return value.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function normalizeMarket(value: string | null | undefined) {
  const trimmed = value?.trim().toUpperCase();
  if (!trimmed || trimmed === "-" || trimmed === UNKNOWN_SYMBOL_META) return null;
  return trimmed;
}

function resolveMarketBadge(market: string | null | undefined): string | null {
  const normalizedMarket = normalizeMarket(market);
  if (!normalizedMarket) return null;

  if (normalizedMarket.includes("KOSPI")) return "KOSPI";
  if (normalizedMarket.includes("KOSDAQ")) return "KOSDAQ";
  if (normalizedMarket.includes("KONEX")) return "KONEX";
  if (normalizedMarket === "KRX") return null;
  return normalizedMarket.slice(0, 4);
}

function isLikelyKrxNumericSymbol(symbol: string) {
  return KRX_NUMERIC_SYMBOL.test(symbol) && symbol.startsWith("0");
}

export function getSearchSuggestionBadge(item: SearchSuggestionBadgeInput): string | null {
  const symbol = normalizeSymbol(item.symbol);
  const marketBadge = resolveMarketBadge(item.market);
  const letters = symbol.slice(0, 2);
  const shouldHideForNumericCode = isLikelyKrxNumericSymbol(symbol) && letters.startsWith("0");

  if (!symbol) return "SR";
  if (shouldHideForNumericCode) {
    return marketBadge;
  }

  if (letters.startsWith("0")) return marketBadge ?? letters;

  return letters || marketBadge || "SR";
}
