import type { SymbolMetaSeed } from "@/app/dashboard/symbol/[symbol]/symbol-detail-state";

export type SymbolSearchItem = SymbolMetaSeed;

export type SymbolSearchResponse = {
  query: string;
  count: number;
  items: SymbolSearchItem[];
};

export type QuoteResponse = {
  symbol: string;
  company_name?: string;
  price: number | null;
  change: number | null;
  change_pct: number | null;
  volume: number | null;
  turnover: number | null;
  market_state: string;
  source: string;
  fallback: boolean;
  is_live: boolean;
  available: boolean;
  cached_at?: string | null;
  trade_date?: string | null;
  fallback_reason?: string | null;
  unavailable_reason?: string | null;
};

export type MarketStatusItem = {
  market?: string | null;
  state?: string | null;
  is_open?: boolean | null;
  available?: boolean | null;
  ready?: boolean | null;
  label?: string | null;
};

export type MarketStatusResponse = {
  state?: string;
  is_open?: boolean;
  server_time?: string;
  markets?: MarketStatusItem[];
};

export type TrackedSymbolsResponse = {
  tracked_symbols: string[];
  count: number;
  last_updated_at: string | null;
};

export type PriceHistoryRange = "3M" | "1Y" | "5Y" | "MAX";

export const PRICE_HISTORY_RANGES: PriceHistoryRange[] = ["3M", "1Y", "5Y", "MAX"];
