export type SymbolMetaSeed = {
  symbol: string;
  standard_code: string;
  name_ko: string;
  market: string;
};

type SymbolMetaParams = {
  name: string | null;
  market: string | null;
  standardCode: string | null;
};

export function buildInitialSymbolMeta(symbol: string, params: SymbolMetaParams): SymbolMetaSeed | null {
  if (!params.name && !params.market && !params.standardCode) {
    return null;
  }

  return {
    symbol,
    name_ko: params.name ?? symbol,
    market: params.market ?? "-",
    standard_code: params.standardCode ?? "-",
  };
}

export function createSymbolMetaResetToken(symbol: string, initialMeta: SymbolMetaSeed | null): string {
  return [symbol, initialMeta?.name_ko ?? "", initialMeta?.market ?? "", initialMeta?.standard_code ?? ""].join("|");
}

export function shouldFetchSymbolMeta(initialMeta: SymbolMetaSeed | null): boolean {
  return initialMeta === null;
}
