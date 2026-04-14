export type Locale = "en" | "ko";

export type ApiEnvelope<T> = {
  data: T;
  meta: {
    generatedAt: string;
    source: "mock" | "api";
    requestId?: string;
  };
};

export type NavItemDto = {
  id: string;
  label: string;
  icon: string;
  href: string;
  description: string;
};

export type SearchSuggestionDto = {
  id: string;
  label: string;
  type: "market" | "bot" | "signal" | "route";
  route: string;
};

export type MetricDto = {
  id: "total_balance" | "live_pnl" | "win_rate";
  title: string;
  value: string;
  delta: string;
  tone?: "positive" | "neutral" | "negative";
  subtitle?: string;
  sparkline?: number[];
  donut?: { value: number; summary: string };
};

export type OrderBookLevelDto = {
  price: string;
  size: string;
};

export type TradeMarkerDto = {
  side: "buy" | "sell";
  label: string;
  value: string;
  left: string;
  top: string;
};

export type ChartSnapshotDto = {
  symbol: string;
  title: string;
  tabs: string[];
  activeTab: string;
  overlays: { top: string; mid: string; low: string };
  tradeMarkers: TradeMarkerDto[];
  orderBook: {
    depth: number;
    sell: OrderBookLevelDto[];
    midPrice: string;
    midChange: string;
    buy: OrderBookLevelDto[];
  };
};

export type WatchItemDto = {
  symbol: string;
  context: string;
  price: number | null;
  change: number | null;
  available?: boolean;
};

export type InsightRowDto = {
  label: string;
  value: string;
};

export type InsightDto = {
  score: string;
  label: string;
  title: string;
  description: string;
  rows: InsightRowDto[];
};

export type DashboardSnapshotDto = {
  nav: NavItemDto[];
  searchSuggestions: SearchSuggestionDto[];
  metrics: MetricDto[];
  chart: ChartSnapshotDto;
  watchlist: WatchItemDto[];
  insight: InsightDto;
  botControls: {
    title: string;
    idleLabel: string;
    actions: Array<{ id: BotCommand; label: string }>;
  };
};

export type MarketSpotlightDto = {
  symbol: string;
  trend: string;
  volume: string;
  change: string;
};

export type MarketsOverviewDto = {
  spotlight: MarketSpotlightDto[];
};

export type BotStatus = "idle" | "running" | "paused" | "hedged" | "stopped";
export type BotCommand = "start" | "pause" | "hedge" | "stop";

export type BotSummaryDto = {
  id: string;
  name: string;
  mode: string;
  risk: string;
  allocation: string;
  status: BotStatus;
};

export type BotsOverviewDto = {
  bots: BotSummaryDto[];
};

export type BotCommandRequestDto = {
  command: BotCommand;
  note?: string;
};

export type BotCommandResponseDto = {
  botId: string;
  command: BotCommand;
  status: BotStatus;
  statusLabel: string;
  acceptedAt: string;
};

export type AgentContextCompanyDto = {
  symbol: string;
  name_ko: string | null;
  market: string | null;
  instrument_type: string | null;
  standard_code: string | null;
  source: string | null;
  is_active: boolean | null;
  last_refreshed_at: string | null;
  dart: {
    corp_code: string | null;
    corp_name: string | null;
  };
};

export type AgentContextTechnicalSnapshotDto = {
  symbol: string;
  market_date: string;
  source: string;
  close_price: number;
  volume: number;
  trend_state: string;
  ma_alignment: string;
  breakout_20d: boolean;
  breakdown_20d: boolean;
  return_5d: number | null;
  return_20d: number | null;
  volume_ratio_20d: number | null;
  atr_14: number | null;
  atr_pct_14: number | null;
  signal_payload: Record<string, unknown>;
  captured_at: string | null;
};

export type AgentContextActionSummaryDto = {
  symbol: string;
  market_date: string;
  source: string;
  action_label: string;
  bias_direction: string;
  signal_score: number;
  confidence_tier: string;
  risk_tier: string;
  trigger_price: number | null;
  invalidation_price: number | null;
  support_price: number | null;
  resistance_price: number | null;
  reasons: string[];
  summary_payload: Record<string, unknown>;
  captured_at: string | null;
};

export type AgentContextFundamentalsSnapshotDto = {
  filing: {
    rcept_no: string;
    report_name: string | null;
    filing_category: string | null;
    receipt_date: string | null;
    captured_at: string | null;
  };
  period: {
    business_year: number;
    report_code: string;
    report_label: string | null;
    period_type: string;
    period_scope: string | null;
    quarter: string | null;
    period_end_month: number | null;
    period_end_date: string | null;
  };
  statement: {
    fs_div: string;
    fs_label: string | null;
    statement_type: string;
    currency: string | null;
    source_status: string | null;
    source_message: string | null;
    row_count: number;
  };
  highlights: Record<string, unknown>;
};

export type AgentContextFundamentalsSummaryDto = {
  latest_snapshot: AgentContextFundamentalsSnapshotDto | null;
  history_summary: {
    entries: number;
    latest_receipt_date: string | null;
    latest_period_end_date: string | null;
    available_business_years: number[];
    recent_periods: Array<{
      business_year: number;
      report_code: string;
      report_label: string | null;
      period_type: string;
      period_end_date: string | null;
      receipt_date: string | null;
      rcept_no: string;
    }>;
  };
};

export type AgentContextDisclosureDto = {
  rcept_no: string;
  corp_code: string;
  corp_name: string;
  report_nm: string;
  filing_category: string | null;
  is_financial_report: boolean;
  receipt_date: string | null;
  remark: string | null;
  fundamentals_capture_status: string | null;
};

export type AgentContextItemDto = {
  symbol: string;
  market_date: string;
  company: AgentContextCompanyDto;
  technical_snapshot: AgentContextTechnicalSnapshotDto | null;
  action_summary: AgentContextActionSummaryDto | null;
  fundamentals: AgentContextFundamentalsSummaryDto;
  recent_disclosures: {
    count: number;
    items: AgentContextDisclosureDto[];
  };
  availability: {
    company: boolean;
    technical_snapshot: boolean;
    action_summary: boolean;
    fundamentals: boolean;
    recent_disclosures: boolean;
  };
};

export type AgentContextResponseDto = {
  request: {
    market_date: string;
    symbols: string[];
    fs_div: string | null;
    fs_label: string | null;
    disclosures_limit: number;
  };
  summary: {
    requested_symbol_count: number;
    matched_symbol_count: number;
    technical_snapshot_count: number;
    action_summary_count: number;
    fundamentals_count: number;
    recent_disclosure_symbol_count: number;
    missing_symbols: string[];
  };
  items: AgentContextItemDto[];
};

export type SymbolPriceBarDto = {
  trade_date: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
  turnover: number;
  source: string;
  captured_at: string | null;
};

export type SymbolPriceBarsResponseDto = {
  symbol: string;
  count: number;
  start_date: string | null;
  end_date: string | null;
  requested_start_date: string | null;
  requested_end_date: string | null;
  items: SymbolPriceBarDto[];
};

export type EodFreshnessTodayDto = {
  trade_date: string | null;
  eod_status: string | null;
  symbols_total: number | null;
  symbols_succeeded: number | null;
  symbols_failed: number | null;
  received: boolean | null;
};

export type EodFreshnessLayerStatusDto = {
  success: boolean | null;
  latest_date: string | null;
};

export type EodFreshnessLatestDto = {
  price_trade_date: string | null;
  symbols_total: number | null;
  symbols_succeeded: number | null;
  technical_market_date: string | null;
  action_market_date: string | null;
};

export type EodFreshnessResponseDto = {
  today: EodFreshnessTodayDto | null;
  latest: EodFreshnessLatestDto | null;
  price?: EodFreshnessLayerStatusDto | null;
  technical?: EodFreshnessLayerStatusDto | null;
  action?: EodFreshnessLayerStatusDto | null;
};

export type DartFundamentalsHistoryMetricDto = {
  metric_key: string | null;
  label: string | null;
  value: number | string | null;
};

export type DartFundamentalsHistoryEntryDto = {
  filing: {
    rcept_no: string;
    report_nm: string | null;
    receipt_date: string | null;
  };
  period: {
    business_year: number | null;
    report_code: string | null;
    report_label: string | null;
    period_end_date: string | null;
  };
  statement: {
    fs_div: string | null;
  };
  highlights: DartFundamentalsHistoryMetricDto[];
  statements?: Array<{
    account_name: string | null;
    current_amount: number | string | null;
  }>;
};

export type DartFundamentalsHistoryCompanyDto = {
  symbol: string;
  name: string | null;
  entries: DartFundamentalsHistoryEntryDto[];
};

export type DartFundamentalsHistoryResponseDto = {
  request: {
    symbols: string[];
    start_date: string | null;
    end_date: string | null;
    fs_div: string | null;
  };
  companies: DartFundamentalsHistoryCompanyDto[];
};

export type EodTechnicalSnapshotsResponseDto = {
  market_date: string | null;
  items: AgentContextTechnicalSnapshotDto[];
};

export type EodActionSummariesResponseDto = {
  market_date: string | null;
  items: AgentContextActionSummaryDto[];
};

export type TradingApiAdapter = {
  getDashboardSnapshot: () => Promise<ApiEnvelope<DashboardSnapshotDto>>;
  getMarketsOverview: () => Promise<ApiEnvelope<MarketsOverviewDto>>;
  getBotsOverview: () => Promise<ApiEnvelope<BotsOverviewDto>>;
  sendBotCommand: (botId: string, request: BotCommandRequestDto) => Promise<ApiEnvelope<BotCommandResponseDto>>;
};
