export type SymbolMetaSeed = {
  symbol: string;
  standard_code: string;
  name_ko: string;
  market: string;
};

export type AggregateContextLoadState = "loading" | "success" | "error";

export type DisclosureSectionState = "loading" | "list" | "empty" | "unavailable";

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

function hasPlaceholderSeed(value: string | null | undefined): boolean {
  return !value || value === "-";
}

export function shouldFetchSymbolMeta(initialMeta: SymbolMetaSeed | null): boolean {
  if (initialMeta === null) {
    return true;
  }

  return hasPlaceholderSeed(initialMeta.market) || hasPlaceholderSeed(initialMeta.standard_code);
}

export function getDisclosureSectionState(
  loadState: AggregateContextLoadState,
  aggregateContextLoaded: boolean,
  disclosureCount: number,
): DisclosureSectionState {
  if (loadState === "loading") {
    return "loading";
  }

  if (loadState === "error" || !aggregateContextLoaded) {
    return "unavailable";
  }

  return disclosureCount > 0 ? "list" : "empty";
}
