export type Locale = "en" | "ko";

export type AssetClassDto = "equity" | "crypto" | "cash" | "fx" | "unknown" | (string & {});
export type VenueDto = "KRX" | "KIS" | "UPBIT" | (string & {});
export type QuoteCurrencyDto = "KRW" | "USD" | "USDT" | (string & {});
export type ProviderDto = "KIS" | "UPBIT" | "core" | "exec" | (string & {});

export type ApiEnvelope<T> = {
  data: T;
  meta: {
    generatedAt: string;
    source: "mock" | "api";
    requestId?: string;
  };
};
