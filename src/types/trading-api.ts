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

export type PortfolioMoneyAmountDto = {
  amount: number | null;
  currency?: string | null;
  display?: string | null;
};

export type PortfolioPnlDto = {
  day?: PortfolioMoneyAmountDto | null;
  realized?: PortfolioMoneyAmountDto | null;
  unrealized?: PortfolioMoneyAmountDto | null;
  total?: PortfolioMoneyAmountDto | null;
  dayPercent?: number | null;
  totalPercent?: number | null;
};

export type PortfolioAccountSummaryDto = {
  totalAssets?: PortfolioMoneyAmountDto | null;
  totalEquity?: PortfolioMoneyAmountDto | null;
  cash?: PortfolioMoneyAmountDto | null;
  buyingPower?: PortfolioMoneyAmountDto | null;
  investedValue?: PortfolioMoneyAmountDto | null;
  pnl?: PortfolioPnlDto | null;
};

export type PortfolioHoldingDto = {
  id?: string | null;
  symbol: string;
  name?: string | null;
  market?: string | null;
  quantity?: number | null;
  averagePrice?: PortfolioMoneyAmountDto | null;
  lastPrice?: PortfolioMoneyAmountDto | null;
  marketValue?: PortfolioMoneyAmountDto | null;
  dayPnl?: PortfolioMoneyAmountDto | null;
  unrealizedPnl?: PortfolioMoneyAmountDto | null;
  unrealizedPnlPercent?: number | null;
  allocationPercent?: number | null;
  currency?: string | null;
  updatedAt?: string | null;
};

export type PortfolioAllocationDto = {
  id: string;
  label: string;
  value?: PortfolioMoneyAmountDto | null;
  percent?: number | null;
};

export type PortfolioOrderActivityDto = {
  id: string;
  symbol?: string | null;
  side?: "buy" | "sell" | "unknown" | string | null;
  status?: string | null;
  quantity?: number | null;
  filledQuantity?: number | null;
  averageFillPrice?: PortfolioMoneyAmountDto | null;
  submittedAt?: string | null;
  updatedAt?: string | null;
};

export type PortfolioAccountDto = {
  id: string;
  label: string;
  broker?: string | null;
  accountType?: string | null;
  status?: string | null;
  baseCurrency?: string | null;
  lastSyncedAt?: string | null;
  summary?: PortfolioAccountSummaryDto | null;
  holdings?: PortfolioHoldingDto[];
  allocation?: PortfolioAllocationDto[];
  recentActivity?: PortfolioOrderActivityDto[];
};

export type PortfolioSyncDto = {
  status?: "synced" | "syncing" | "stale" | "unavailable" | string | null;
  lastSyncedAt?: string | null;
  source?: string | null;
  message?: string | null;
};

export type PortfolioSummaryDto = {
  asOf?: string | null;
  source?: string | null;
  sync?: PortfolioSyncDto | null;
  accounts?: PortfolioAccountDto[];
  notices?: string[];
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

export type AgentFeedbackRunStatus = "pending" | "running" | "stalled" | "completed";

export type AgentFeedbackRoleResultDto = {
  role?: string;
  requested_count?: number | null;
  completed_count?: number | null;
  error_count?: number | null;
};

export type AgentFeedbackProgressResponseDto = {
  request: {
    market_date: string;
    symbols: string[] | null;
    expected_agents: string[];
  };
  summary: {
    run_id: string | null;
    run_status: AgentFeedbackRunStatus | string;
    run_table_status: string | null;
    cycle_status?: string | null;
    is_live: boolean;
    run_started_at: string | null;
    run_completed_at: string | null;
    current_role?: string | null;
    completed_roles?: string[] | null;
    remaining_roles?: string[] | null;
    role_progress?: Record<string, unknown> | Array<Record<string, unknown>> | null;
    parallel_per_role?: number | null;
    latest_feedback_at: string | null;
    seconds_since_last_feedback: number | null;
    stalled_threshold_seconds: number | null;
    total_symbols: number;
    processed_symbols: number;
    completed_symbols: number;
    in_progress_symbols: number;
    pending_symbols: number;
    progress_ratio: number;
    progress_percent: number;
    failed_items: number;
    completed_feedback_count: number;
    expected_feedback_count: number;
    completed_feedback_per_minute?: number | null;
    completed_symbols_per_minute?: number | null;
    estimated_remaining_seconds?: number | null;
    estimated_completion_at?: string | null;
    eta_confidence?: string | null;
  };
  result?: {
    market_date?: string | null;
    roles?: Record<string, AgentFeedbackRoleResultDto> | AgentFeedbackRoleResultDto[] | null;
  } | null;
};

export type AgentFeedbackStoredPayloadDto = Record<string, unknown> & {
  role?: string | null;
  agent_name?: string | null;
  symbol?: string | null;
  market_date?: string | null;
  preferred_action?: string | null;
  next_day_open_action?: string | null;
  entry_price_basis?: string | null;
  target_price?: number | string | null;
  expected_return_pct?: number | string | null;
  stop_loss_price?: number | string | null;
  suggested_holding_period?: string | null;
  confidence_score_10?: number | string | null;
  conviction_score_10?: number | string | null;
  thesis_summary?: string | null;
  supporting_evidence?: unknown;
  decision_risks?: unknown;
  risk_flags?: unknown;
  specialist_disagreement?: unknown;
  traceability?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
  summary?: string | null;
};

export type AgentFeedbackStoredItemDto = {
  id: number | string;
  market_date: string;
  symbol: string;
  agent: {
    name: string;
    version?: string | null;
    run_id?: string | null;
  };
  summary: Record<string, unknown> | string | null;
  feedback: AgentFeedbackStoredPayloadDto | null;
  normalized_feedback?: AgentFeedbackStoredPayloadDto | null;
  details?: Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
  received_at: string | null;
};

export type AgentFeedbackListResponseDto = {
  request: {
    market_date: string;
    symbols: string[];
    agent_name: string | null;
    limit: number;
  };
  summary: {
    count: number;
  };
  items: AgentFeedbackStoredItemDto[];
};

export type AgentContextCoreControlAction = "kill" | "restart";
export type AgentContextCoreControlSignal = "SIGTERM" | "SIGKILL";

export type AgentContextCoreControlRequestDto = {
  action: AgentContextCoreControlAction;
  signal_name: AgentContextCoreControlSignal;
  port: number;
};

export type AgentContextCoreControlResponseDto = {
  status: "killed" | "no_process" | "restarted" | string;
  port: number;
  signal: AgentContextCoreControlSignal | string;
  pids?: number[];
  killed_pids?: number[];
  self_targeted?: boolean;
  launchctl_stdout?: string;
  launchctl_stderr?: string;
  plist_path?: string;
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

export type EodFreshnessStageDto = {
  status: string | null;
  symbols_total: number | null;
  symbols_succeeded: number | null;
  symbols_failed: number | null;
};

export type EodFreshnessTodayDto = {
  trade_date: string | null;
  price?: EodFreshnessStageDto | null;
  technical_analysis?: EodFreshnessStageDto | null;
  action_summary?: EodFreshnessStageDto | null;
  fundamentals?: EodFreshnessStageDto | null;
  eod_status?: string | null;
  symbols_total?: number | null;
  symbols_succeeded?: number | null;
  symbols_failed?: number | null;
  received?: boolean | null;
};

export type EodFreshnessLayerStatusDto = {
  success: boolean | null;
  latest_date: string | null;
};

export type EodFreshnessLatestStageDetailDto = Record<string, unknown> & {
  trade_date?: string | null;
  market_date?: string | null;
  latest_date?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  last_updated_at?: string | null;
  eod_status?: string | null;
  status?: string | null;
  run_status?: string | null;
  symbols_total?: number | null;
  total?: number | null;
  symbols_succeeded?: number | null;
  symbols_checked?: number | null;
  succeeded?: number | null;
  checked?: number | null;
  completed_count?: number | null;
  processed?: number | null;
  symbols_failed?: number | null;
  failed?: number | null;
  error_count?: number | null;
  summary?: Record<string, unknown> | null;
};

export type EodFreshnessLatestSummaryDto = Record<string, unknown> & {
  trade_date?: string | null;
  market_date?: string | null;
  latest_date?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  last_updated_at?: string | null;
  eod_status?: string | null;
  status?: string | null;
  run_status?: string | null;
  symbols_total?: number | null;
  total?: number | null;
  symbols_succeeded?: number | null;
  symbols_checked?: number | null;
  succeeded?: number | null;
  checked?: number | null;
  completed_count?: number | null;
  processed?: number | null;
  symbols_failed?: number | null;
  failed?: number | null;
  error_count?: number | null;
};

export type EodFreshnessLatestDto = Record<string, unknown> & {
  trade_date?: string | null;
  market_date?: string | null;
  latest_date?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  last_updated_at?: string | null;
  price_trade_date?: string | null;
  eod_status?: string | null;
  status?: string | null;
  run_status?: string | null;
  symbols_total?: number | null;
  total?: number | null;
  symbols_succeeded?: number | null;
  succeeded?: number | null;
  symbols_failed?: number | null;
  failed?: number | null;
  technical_market_date?: string | null;
  action_market_date?: string | null;
  summary?: EodFreshnessLatestSummaryDto | null;
  stages?: Record<string, EodFreshnessLatestStageDetailDto | null> | null;
  stage_details?: Record<string, EodFreshnessLatestStageDetailDto | null> | null;
  stageDetails?: Record<string, EodFreshnessLatestStageDetailDto | null> | null;
  price?: EodFreshnessLatestStageDetailDto | null;
  technical?: EodFreshnessLatestStageDetailDto | null;
  technical_analysis?: EodFreshnessLatestStageDetailDto | null;
  action?: EodFreshnessLatestStageDetailDto | null;
  action_summary?: EodFreshnessLatestStageDetailDto | null;
  fundamentals?: EodFreshnessLatestStageDetailDto | null;
  fundamental?: EodFreshnessLatestStageDetailDto | null;
};

export type EodFreshnessResponseDto = {
  today: EodFreshnessTodayDto | null;
  latest: EodFreshnessLatestDto | null;
  price?: EodFreshnessLayerStatusDto | null;
  technical?: EodFreshnessLayerStatusDto | null;
  action?: EodFreshnessLayerStatusDto | null;
  fundamental?: EodFreshnessLayerStatusDto | null;
  fundamentals?: EodFreshnessLayerStatusDto | null;
};

export type EodPiotroskiFilterResultItemDto = {
  symbol: string;
  market_date: string;
  passed_filter: boolean;
  piotroski_score: number | null;
  passes_piotroski_score: boolean | null;
  captured_at: string | null;
};

export type EodPiotroskiFilterResultsResponseDto = {
  market_date?: string | null;
  requested_market_date?: string | null;
  resolved_market_date?: string | null;
  is_latest_fallback?: boolean | null;
  summary: {
    entries: number;
    requested_symbol: string | null;
    matched_symbols: string[];
    missing_symbols: string[];
    passed_count: number;
    not_passed_count: number;
  };
  item?: EodPiotroskiFilterResultItemDto | null;
  items?: EodPiotroskiFilterResultItemDto[] | null;
};

export type EodMarketRiskFilterPayloadDto = {
  feature_version?: string | null;
  snapshot_source?: string | null;
  snapshot_feature_version?: string | null;
  snapshot_market_date?: string | null;
  snapshot_market_code?: string | null;
  snapshot_source_endpoint?: string | null;
  snapshot_captured_at?: string | null;
  blocking_reasons?: string[] | null;
  watchlist_reasons?: string[] | null;
};

export type EodMarketRiskFilterResultItemDto = {
  symbol: string;
  name_ko?: string | null;
  market?: string | null;
  eod_run_id?: number | null;
  market_date: string;
  source?: string | null;
  feature_version?: string | null;
  risk_state: string;
  passed_filter: boolean;
  watchlist_flagged: boolean;
  filter_payload: EodMarketRiskFilterPayloadDto | null;
  captured_at: string | null;
};

export type EodMarketRiskFiltersResponseDto = {
  market_date?: string | null;
  requested_market_date?: string | null;
  resolved_market_date?: string | null;
  latest_mode?: boolean | null;
  is_latest_fallback?: boolean | null;
  fallback_policy?: string | null;
  feature_version?: string | null;
  summary: {
    entries: number;
    requested_symbol: string | null;
    matched_symbols: string[];
    missing_symbols: string[];
    passed_count: number;
    watchlist_count: number;
    failed_count: number;
  };
  item?: EodMarketRiskFilterResultItemDto | null;
  items?: EodMarketRiskFilterResultItemDto[] | null;
};

export type MarketSnapshotNumericValue = number | string | null;

export type MarketSnapshotStatusDto = "ready" | "partial" | "unavailable" | "stale" | string;

export type MarketSnapshotIndexDto = {
  id?: string | null;
  label?: string | null;
  symbol?: string | null;
  code?: string | null;
  market?: string | null;
  name?: string | null;
  level?: MarketSnapshotNumericValue;
  value?: MarketSnapshotNumericValue;
  close?: MarketSnapshotNumericValue;
  current?: MarketSnapshotNumericValue;
  price?: MarketSnapshotNumericValue;
  last?: MarketSnapshotNumericValue;
  last_price?: MarketSnapshotNumericValue;
  change?: MarketSnapshotNumericValue;
  net_change?: MarketSnapshotNumericValue;
  point_change?: MarketSnapshotNumericValue;
  change_rate?: MarketSnapshotNumericValue;
  change_pct?: MarketSnapshotNumericValue;
  change_percent?: MarketSnapshotNumericValue;
  pct_change?: MarketSnapshotNumericValue;
  percent_change?: MarketSnapshotNumericValue;
  rate_change?: MarketSnapshotNumericValue;
  market_date?: string | null;
  as_of?: string | null;
  source?: string | null;
};

export type MarketSnapshotFxRateDto = {
  id?: string | null;
  label?: string | null;
  code?: string | null;
  name?: string | null;
  pair?: string | null;
  base?: string | null;
  quote?: string | null;
  rate?: MarketSnapshotNumericValue;
  value?: MarketSnapshotNumericValue;
  close?: MarketSnapshotNumericValue;
  current?: MarketSnapshotNumericValue;
  price?: MarketSnapshotNumericValue;
  last?: MarketSnapshotNumericValue;
  last_price?: MarketSnapshotNumericValue;
  change?: MarketSnapshotNumericValue;
  net_change?: MarketSnapshotNumericValue;
  change_rate?: MarketSnapshotNumericValue;
  change_pct?: MarketSnapshotNumericValue;
  change_percent?: MarketSnapshotNumericValue;
  pct_change?: MarketSnapshotNumericValue;
  percent_change?: MarketSnapshotNumericValue;
  rate_change?: MarketSnapshotNumericValue;
  as_of?: string | null;
  source?: string | null;
};

export type MarketSnapshotFlowDto = {
  id?: string | null;
  name?: string | null;
  label?: string | null;
  market?: string | null;
  investor_type?: string | null;
  type?: string | null;
  direction?: string | null;
  summary?: string | null;
  net_amount?: MarketSnapshotNumericValue;
  net_buy_amount?: MarketSnapshotNumericValue;
  net?: MarketSnapshotNumericValue;
  net_buy?: MarketSnapshotNumericValue;
  net_flow?: MarketSnapshotNumericValue;
  net_purchase?: MarketSnapshotNumericValue;
  amount?: MarketSnapshotNumericValue;
  value?: MarketSnapshotNumericValue;
  currency?: string | null;
  unit?: string | null;
  as_of?: string | null;
  source?: string | null;
};

export type MarketSnapshotSummaryDto = {
  market_bias?: string | null;
  breadth?: string | null;
  breadth_summary?: string | null;
  market_breadth?: string | null;
  line?: string | null;
};

export type MarketSnapshotResponseDto = {
  market_date?: string | null;
  as_of?: string | null;
  source?: string | null;
  status?: MarketSnapshotStatusDto | null;
  indices?: {
    kospi?: MarketSnapshotIndexDto | null;
    kosdaq?: MarketSnapshotIndexDto | null;
  } | MarketSnapshotIndexDto[] | null;
  fx?: {
    usdkrw?: MarketSnapshotFxRateDto | null;
    usd_krw?: MarketSnapshotFxRateDto | null;
  } | MarketSnapshotFxRateDto[] | null;
  flows?: {
    foreign?: MarketSnapshotFlowDto | null;
    institutional?: MarketSnapshotFlowDto | null;
  } | MarketSnapshotFlowDto[] | null;
  summary?: MarketSnapshotSummaryDto | string | null;
  missing_fields?: string[] | null;
  stale_reason?: string | null;
  data?: MarketSnapshotResponseDto | null;
};

export type EodPipelineStageKey =
  | "price_collection"
  | "technical_snapshots"
  | "action_summaries"
  | "trending_ranks"
  | "signal_features"
  | "fundamentals_daily_refresh"
  | "unified_value_scoring"
  | "quality_scoring"
  | "momentum_scoring";

export type EodPipelineStageDto = {
  status: string | null;
  processed: number | null;
  total: number | null;
  failed: number | null;
  current_step?: string | null;
  current_activity?: string | null;
  current_symbol?: string | null;
  source_run_ids?: Record<string, unknown> | null;
};

export type EodPipelineStatusResponseDto = {
  market_date: string | null;
  fs_div?: string | null;
  status: string | null;
  stage_order: EodPipelineStageKey[];
  stages: Partial<Record<EodPipelineStageKey, EodPipelineStageDto>>;
};

export type DartFundamentalsSymbolSampleItemDto =
  | string
  | {
      symbol?: string | null;
      stock_code?: string | null;
      stockCode?: string | null;
      [key: string]: unknown;
    };

export type DartFundamentalsDailyUpdatedEntryDto = {
  symbol?: string | null;
  stock_code?: string | null;
  stockCode?: string | null;
  company_name?: string | null;
  companyName?: string | null;
  update_category?: string | null;
  updateCategory?: string | null;
  category_label?: string | null;
  categoryLabel?: string | null;
};

export type DartFundamentalsDailyUpdatedEntriesSummaryDto = {
  updated_count?: number | null;
  visible_preview_limit?: number | null;
  visible_preview_count?: number | null;
  has_more?: boolean | null;
  remaining_count?: number | null;
  full_list_available?: boolean | null;
};

export type DartFundamentalsDailyRunMetadataDto = Record<string, unknown> & {
  refreshed_symbols_sample?: DartFundamentalsSymbolSampleItemDto[] | null;
  samples?: {
    refreshed_symbols?: DartFundamentalsSymbolSampleItemDto[] | null;
  } | null;
};

export type DartFundamentalsDailyRunDto = {
  id: number;
  market_date: string;
  trigger: string | null;
  status: string | null;
  fs_div: string | null;
  force: boolean | null;
  symbol_limit: number | null;
  symbol_offset: number | null;
  symbols_total: number | null;
  symbols_checked: number | null;
  symbols_missing: number | null;
  symbols_stale: number | null;
  symbols_fresh: number | null;
  symbols_refreshed: number | null;
  symbols_failed: number | null;
  events_detected: number | null;
  events_captured: number | null;
  events_failed: number | null;
  updated_entries_summary?: DartFundamentalsDailyUpdatedEntriesSummaryDto | null;
  updated_entries_preview?: DartFundamentalsDailyUpdatedEntryDto[] | null;
  updated_entries?: DartFundamentalsDailyUpdatedEntryDto[] | null;
  error_message: string | null;
  run_metadata: DartFundamentalsDailyRunMetadataDto | null;
  started_at: string | null;
  completed_at: string | null;
};

export type DartFundamentalsDailyInspectResponseDto = {
  latest_run: DartFundamentalsDailyRunDto | null;
  runs: DartFundamentalsDailyRunDto[];
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

export type EodFactorInspectResponseDto<TItem, TSummary> = {
  market_date?: string | null;
  requested_market_date?: string | null;
  resolved_market_date?: string | null;
  latest_mode?: boolean | null;
  is_latest_fallback?: boolean | null;
  fallback_policy?: string | null;
  feature_version?: string | null;
  summary: TSummary;
  item?: TItem | null;
  items?: TItem[] | null;
};

export type EodMomentumFactorItemDto = {
  symbol: string;
  name_ko?: string | null;
  market?: string | null;
  market_date: string;
  source?: string | null;
  close_price: number | null;
  ma_60: number | null;
  ma_120: number | null;
  momentum_12_1: number | null;
  return_5d: number | null;
  return_5d_rank?: number | null;
  return_5d_percentile?: number | null;
  return_5d_ranked_universe_size?: number | null;
  return_5d_realized_volatility_20d?: number | null;
  return_5d_vol_adjusted?: number | null;
  has_sufficient_history: boolean;
  is_price_above_ma120: boolean;
  is_ma60_above_ma120: boolean;
  has_sufficient_cross_sectional_context?: boolean | null;
  is_return_5d_extreme?: boolean | null;
  is_volatility_adjusted_overheated?: boolean | null;
  passes_minimum_absolute_return?: boolean | null;
  overheat_rule_version?: string | null;
  is_recent_overheated: boolean;
  momentum_rank: number | null;
  momentum_percentile: number | null;
  is_momentum_eligible: boolean;
  factor_payload: Record<string, unknown> | null;
  captured_at: string | null;
};

export type EodMomentumFactorSummaryDto = {
  entries: number;
  requested_symbols: string[];
  matched_symbols: string[];
  missing_symbols: string[];
  ranked_symbols: number;
  eligible_symbols: number;
};

export type EodMomentumFactorsResponseDto = EodFactorInspectResponseDto<
  EodMomentumFactorItemDto,
  EodMomentumFactorSummaryDto
>;

export type EodLowRiskFactorItemDto = {
  symbol: string;
  name_ko?: string | null;
  market?: string | null;
  market_date: string;
  source?: string | null;
  feature_version?: string | null;
  volatility_60d: number | null;
  volatility_120d: number | null;
  max_drawdown_120d: number | null;
  avg_trading_value_20d: number | null;
  volatility_60d_rank: number | null;
  volatility_120d_rank: number | null;
  max_drawdown_120d_rank: number | null;
  liquidity_rank: number | null;
  volatility_60d_percentile: number | null;
  volatility_120d_percentile: number | null;
  max_drawdown_120d_percentile: number | null;
  liquidity_percentile: number | null;
  passes_liquidity_floor: boolean | null;
  low_risk_score: number | null;
  low_risk_classification: string | null;
  is_low_risk_eligible: boolean;
  history_days_available: number;
  factor_payload: Record<string, unknown> | null;
  captured_at: string | null;
};

export type EodLowRiskFactorSummaryDto = {
  entries: number;
  requested_symbol: string | null;
  matched_symbols: string[];
  missing_symbols: string[];
  eligible_count: number;
  liquidity_floor_pass_count: number;
  insufficient_history_count: number;
};

export type EodLowRiskFactorsResponseDto = EodFactorInspectResponseDto<
  EodLowRiskFactorItemDto,
  EodLowRiskFactorSummaryDto
>;

export type EodBetaFactorItemDto = {
  symbol: string;
  name_ko?: string | null;
  market?: string | null;
  market_date: string;
  source?: string | null;
  feature_version?: string | null;
  benchmark_id: string | null;
  benchmark_market: string | null;
  beta_60d: number | null;
  beta_120d: number | null;
  beta_60d_rank: number | null;
  beta_120d_rank: number | null;
  beta_60d_percentile: number | null;
  beta_120d_percentile: number | null;
  low_beta_score: number | null;
  low_beta_classification: string | null;
  is_low_beta_eligible: boolean;
  history_days_available: number;
  factor_payload: Record<string, unknown> | null;
  captured_at: string | null;
};

export type EodBetaFactorSummaryDto = {
  entries: number;
  requested_symbol: string | null;
  matched_symbols: string[];
  missing_symbols: string[];
  eligible_count: number;
  watchlist_count: number;
  insufficient_history_count: number;
};

export type EodBetaFactorsResponseDto = EodFactorInspectResponseDto<
  EodBetaFactorItemDto,
  EodBetaFactorSummaryDto
>;

export type EodValueFactorItemDto = {
  symbol: string;
  name_ko?: string | null;
  market?: string | null;
  market_date: string;
  source?: string | null;
  feature_version?: string | null;
  per: number | null;
  pbr: number | null;
  dividend_yield: number | null;
  per_status: string | null;
  pbr_status?: string | null;
  dividend_yield_status?: string | null;
  fcf_yield?: number | null;
  ev_to_ebitda?: number | null;
  fcf_yield_status?: string | null;
  ev_to_ebitda_status?: string | null;
  per_rank: number | null;
  pbr_rank: number | null;
  dividend_yield_rank: number | null;
  per_percentile: number | null;
  pbr_percentile: number | null;
  dividend_yield_percentile: number | null;
  value_score: number | null;
  value_rank: number | null;
  value_percentile: number | null;
  value_status: string | null;
  unified_value_score?: number | null;
  unified_value_rank?: number | null;
  unified_value_percentile?: number | null;
  unified_value_status?: string | null;
  unified_value_components_used?: number | null;
  quality_score?: number | null;
  quality_rank?: number | null;
  quality_percentile?: number | null;
  quality_status?: string | null;
  components_possible?: number | null;
  components_used?: number | null;
  quality_components_possible?: number | null;
  quality_components_used?: number | null;
  is_quality_score_complete?: boolean | null;
  quality_component_statuses?: Record<string, unknown> | null;
  roe_status?: string | null;
  roa_status?: string | null;
  gross_profit_to_assets_status?: string | null;
  operating_cash_flow_to_net_income_status?: string | null;
  debt_ratio_status?: string | null;
  accruals_ratio_status?: string | null;
  factor_payload: Record<string, unknown> | null;
  captured_at: string | null;
};

export type EodValueFactorSummaryDto = {
  entries: number;
  requested_symbol: string | null;
  matched_symbols: string[];
  missing_symbols: string[];
  scored_count: number;
  invalid_per_count: number;
  missing_metric_count: number;
};

export type EodValueFactorsResponseDto = EodFactorInspectResponseDto<
  EodValueFactorItemDto,
  EodValueFactorSummaryDto
>;

export type EodAdvancedValueFactorItemDto = {
  symbol: string;
  name_ko?: string | null;
  market?: string | null;
  market_date: string;
  source?: string | null;
  feature_version?: string | null;
  per_status?: string | null;
  pbr_status?: string | null;
  dividend_yield_status?: string | null;
  market_cap_proxy: number | null;
  enterprise_value: number | null;
  ebitda: number | null;
  free_cash_flow: number | null;
  fcf_yield: number | null;
  ev_to_ebitda: number | null;
  fcf_yield_status: string | null;
  ev_to_ebitda_status: string | null;
  fcf_yield_valid_for_scoring: boolean;
  ev_to_ebitda_valid_for_scoring: boolean;
  fcf_yield_rank: number | null;
  ev_to_ebitda_rank: number | null;
  fcf_yield_percentile: number | null;
  ev_to_ebitda_percentile: number | null;
  advanced_value_score: number | null;
  advanced_value_rank: number | null;
  advanced_value_percentile: number | null;
  advanced_value_components_used: number;
  advanced_value_classification: string | null;
  is_advanced_value_eligible: boolean;
  unified_value_score?: number | null;
  unified_value_rank?: number | null;
  unified_value_percentile?: number | null;
  unified_value_status?: string | null;
  unified_value_components_used?: number | null;
  quality_score?: number | null;
  quality_rank?: number | null;
  quality_percentile?: number | null;
  quality_status?: string | null;
  components_possible?: number | null;
  components_used?: number | null;
  quality_components_possible?: number | null;
  quality_components_used?: number | null;
  is_quality_score_complete?: boolean | null;
  quality_component_statuses?: Record<string, unknown> | null;
  roe_status?: string | null;
  roa_status?: string | null;
  gross_profit_to_assets_status?: string | null;
  operating_cash_flow_to_net_income_status?: string | null;
  debt_ratio_status?: string | null;
  accruals_ratio_status?: string | null;
  factor_payload: Record<string, unknown> | null;
  captured_at: string | null;
};

export type EodAdvancedValueFactorSummaryDto = {
  entries: number;
  requested_symbol: string | null;
  matched_symbols: string[];
  missing_symbols: string[];
  eligible_count: number;
  watchlist_count: number;
  ineligible_count: number;
  insufficient_components_count: number;
};

export type EodAdvancedValueFactorsResponseDto = EodFactorInspectResponseDto<
  EodAdvancedValueFactorItemDto,
  EodAdvancedValueFactorSummaryDto
>;

export type TradingApiAdapter = {
  getDashboardSnapshot: () => Promise<ApiEnvelope<DashboardSnapshotDto>>;
  getMarketsOverview: () => Promise<ApiEnvelope<MarketsOverviewDto>>;
  getBotsOverview: () => Promise<ApiEnvelope<BotsOverviewDto>>;
  sendBotCommand: (botId: string, request: BotCommandRequestDto) => Promise<ApiEnvelope<BotCommandResponseDto>>;
};
