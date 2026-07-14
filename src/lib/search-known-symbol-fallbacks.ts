export type KnownSymbolSearchFallbackItem = {
  symbol: string;
  standard_code: string;
  name_ko: string;
  market: string;
  instrument_type: string;
};

type KnownSymbolSearchFallbackEntry = KnownSymbolSearchFallbackItem & {
  aliases: string[];
};

const DEFAULT_FALLBACK_LIMIT = 6;

const KNOWN_SYMBOL_SEARCH_FALLBACKS: KnownSymbolSearchFallbackEntry[] = [
  {
    symbol: "005930",
    standard_code: "KR7005930003",
    name_ko: "삼성전자",
    market: "KOSPI",
    instrument_type: "stock",
    aliases: ["삼성", "삼성전자", "samsung", "samsung electronics"],
  },
  {
    symbol: "207940",
    standard_code: "KR7207940008",
    name_ko: "삼성바이오로직스",
    market: "KOSPI",
    instrument_type: "stock",
    aliases: ["삼성", "삼성바이오", "삼성바이오로직스", "samsung biologics"],
  },
  {
    symbol: "006400",
    standard_code: "KR7006400006",
    name_ko: "삼성SDI",
    market: "KOSPI",
    instrument_type: "stock",
    aliases: ["삼성", "삼성sdi", "samsung sdi"],
  },
];

function normalizeKnownSymbolSearchToken(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, "");
}

function toKnownSymbolSearchFallbackItem(
  entry: KnownSymbolSearchFallbackEntry,
): KnownSymbolSearchFallbackItem {
  return {
    symbol: entry.symbol,
    standard_code: entry.standard_code,
    name_ko: entry.name_ko,
    market: entry.market,
    instrument_type: entry.instrument_type,
  };
}

export function getKnownSymbolSearchFallbacks(
  query: string,
  limit = DEFAULT_FALLBACK_LIMIT,
): KnownSymbolSearchFallbackItem[] {
  const normalizedQuery = normalizeKnownSymbolSearchToken(query);
  if (normalizedQuery.length < 2) return [];

  return KNOWN_SYMBOL_SEARCH_FALLBACKS.filter((entry) => {
    const searchableTokens = [entry.symbol, entry.standard_code, entry.name_ko, ...entry.aliases];
    return searchableTokens.some((token) => normalizeKnownSymbolSearchToken(token).includes(normalizedQuery));
  })
    .slice(0, limit)
    .map(toKnownSymbolSearchFallbackItem);
}
