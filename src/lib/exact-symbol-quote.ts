type SymbolQuote = {
  symbol?: string | null;
};

function normalizeQuoteSymbol(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? "";
}

export function selectExactSymbolQuote<T extends SymbolQuote>(
  quote: T | null | undefined,
  requestedSymbol: string | null | undefined,
): T | null {
  const normalizedRequestedSymbol = normalizeQuoteSymbol(requestedSymbol);
  if (!quote || !normalizedRequestedSymbol) return null;

  return normalizeQuoteSymbol(quote.symbol) === normalizedRequestedSymbol ? quote : null;
}
