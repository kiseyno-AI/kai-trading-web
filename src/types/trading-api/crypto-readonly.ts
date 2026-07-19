import type { AssetClassDto, ProviderDto, QuoteCurrencyDto, VenueDto } from "./common";
import type { PortfolioMoneyAmountDto } from "./portfolio-account";
import type {
  ExecutionRuntimeIssueDto,
  ExecutionRuntimeMode,
  ExecutionRuntimeQuantity,
  ExecutionRuntimeStatusResponseDto,
} from "./execution-runtime";

export type CryptoMarketDataStatus =
  | "available"
  | "pending"
  | "unavailable"
  | "stale"
  | "degraded"
  | string;

export type CryptoReadinessStatus =
  | "ready"
  | "paper_ready"
  | "pending"
  | "unavailable"
  | "degraded"
  | "blocked"
  | string;

export type CryptoMarketRequestDto = {
  assetClass?: AssetClassDto | null;
  venue?: VenueDto | null;
  provider?: ProviderDto | null;
  quoteCurrency?: QuoteCurrencyDto | null;
  refresh?: boolean | null;
};

export type CryptoMarketSummaryDto = Record<string, unknown> & {
  itemsTotal?: number | null;
  available?: number | null;
  pending?: number | null;
  unavailable?: number | null;
  stale?: number | null;
  items_total?: number | null;
};

export type CryptoMarketRowDto = Record<string, unknown> & {
  id?: string | null;
  symbol?: string | null;
  ticker?: string | null;
  name?: string | null;
  displayName?: string | null;
  display_name?: string | null;
  assetClass?: AssetClassDto | null;
  asset_class?: AssetClassDto | null;
  venue?: VenueDto | null;
  exchange?: VenueDto | null;
  provider?: ProviderDto | null;
  baseCurrency?: string | null;
  base_currency?: string | null;
  quoteCurrency?: QuoteCurrencyDto | null;
  quote_currency?: QuoteCurrencyDto | null;
  lastPrice?: ExecutionRuntimeQuantity | PortfolioMoneyAmountDto | null;
  last_price?: ExecutionRuntimeQuantity | PortfolioMoneyAmountDto | null;
  changePercent24h?: number | null;
  change_percent_24h?: number | null;
  volume24h?: ExecutionRuntimeQuantity | PortfolioMoneyAmountDto | null;
  volume_24h?: ExecutionRuntimeQuantity | PortfolioMoneyAmountDto | null;
  marketStatus?: CryptoMarketDataStatus | null;
  market_status?: CryptoMarketDataStatus | null;
  dataStatus?: CryptoMarketDataStatus | null;
  data_status?: CryptoMarketDataStatus | null;
  source?: string | null;
  asOf?: string | null;
  as_of?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
};

export type CryptoMarketOverviewResponseDto = {
  request?: CryptoMarketRequestDto | null;
  summary?: CryptoMarketSummaryDto | null;
  asOf?: string | null;
  as_of?: string | null;
  items?: CryptoMarketRowDto[] | null;
  notices?: string[] | null;
};

export type CryptoRuntimeReadinessSummaryDto = Record<string, unknown> & {
  itemsTotal?: number | null;
  ready?: number | null;
  paperReady?: number | null;
  pending?: number | null;
  unavailable?: number | null;
  blocked?: number | null;
  items_total?: number | null;
  paper_ready?: number | null;
};

export type CryptoRuntimeReadinessRowDto = Record<string, unknown> & {
  id?: string | null;
  symbol?: string | null;
  ticker?: string | null;
  name?: string | null;
  displayName?: string | null;
  display_name?: string | null;
  assetClass?: AssetClassDto | null;
  asset_class?: AssetClassDto | null;
  venue?: VenueDto | null;
  exchange?: VenueDto | null;
  provider?: ProviderDto | null;
  baseCurrency?: string | null;
  base_currency?: string | null;
  quoteCurrency?: QuoteCurrencyDto | null;
  quote_currency?: QuoteCurrencyDto | null;
  mode?: ExecutionRuntimeMode | null;
  readiness?: CryptoReadinessStatus | null;
  status?: CryptoReadinessStatus | null;
  marketDataConnected?: boolean | null;
  market_data_connected?: boolean | null;
  websocketConnected?: boolean | null;
  websocket_connected?: boolean | null;
  paperTradingEnabled?: boolean | null;
  paper_trading_enabled?: boolean | null;
  liveTradingEnabled?: boolean | null;
  live_trading_enabled?: boolean | null;
  lastHeartbeatAt?: string | null;
  last_heartbeat_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
  issues?: ExecutionRuntimeIssueDto[] | string[] | null;
};

export type CryptoRuntimeReadinessResponseDto = {
  request?: CryptoMarketRequestDto | null;
  runtime?: ExecutionRuntimeStatusResponseDto | null;
  summary?: CryptoRuntimeReadinessSummaryDto | null;
  asOf?: string | null;
  as_of?: string | null;
  items?: CryptoRuntimeReadinessRowDto[] | null;
  notices?: string[] | null;
};

export type CryptoStrategySummaryDto = Record<string, unknown> & {
  itemsTotal?: number | null;
  ready?: number | null;
  pending?: number | null;
  unavailable?: number | null;
  partial?: number | null;
  blocked?: number | null;
  items_total?: number | null;
};

export type CryptoStrategyRowDto = Record<string, unknown> & {
  id?: string | null;
  symbol?: string | null;
  ticker?: string | null;
  name?: string | null;
  displayName?: string | null;
  display_name?: string | null;
  assetClass?: AssetClassDto | null;
  asset_class?: AssetClassDto | null;
  venue?: VenueDto | null;
  exchange?: VenueDto | null;
  provider?: ProviderDto | null;
  baseCurrency?: string | null;
  base_currency?: string | null;
  quoteCurrency?: QuoteCurrencyDto | null;
  quote_currency?: QuoteCurrencyDto | null;
  mode?: ExecutionRuntimeMode | null;
  readiness?: CryptoReadinessStatus | null;
  status?: CryptoReadinessStatus | null;
  strategyName?: string | null;
  strategy_name?: string | null;
  trendState?: string | null;
  trend_state?: string | null;
  momentumScore?: number | string | null;
  momentum_score?: number | string | null;
  volatilityTier?: string | null;
  volatility_tier?: string | null;
  liquidityTier?: string | null;
  liquidity_tier?: string | null;
  riskTier?: string | null;
  risk_tier?: string | null;
  weekendSession?: boolean | null;
  weekend_session?: boolean | null;
  targetLevel?: ExecutionRuntimeQuantity | PortfolioMoneyAmountDto | null;
  target_level?: ExecutionRuntimeQuantity | PortfolioMoneyAmountDto | null;
  invalidationLevel?: ExecutionRuntimeQuantity | PortfolioMoneyAmountDto | null;
  invalidation_level?: ExecutionRuntimeQuantity | PortfolioMoneyAmountDto | null;
  reasons?: string[] | null;
  observedWindow?: string | null;
  observed_window?: string | null;
  source?: string | null;
  asOf?: string | null;
  as_of?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
};

export type CryptoStrategyOverviewResponseDto = {
  request?: CryptoMarketRequestDto | null;
  summary?: CryptoStrategySummaryDto | null;
  asOf?: string | null;
  as_of?: string | null;
  items?: CryptoStrategyRowDto[] | null;
  notices?: string[] | null;
};

export type CryptoPaperRuntimeSummaryDto = Record<string, unknown> & {
  itemsTotal?: number | null;
  ready?: number | null;
  paperReady?: number | null;
  pending?: number | null;
  unavailable?: number | null;
  blocked?: number | null;
  openPaperOrderCount?: number | null;
  activePaperJobCount?: number | null;
  items_total?: number | null;
  paper_ready?: number | null;
  open_paper_order_count?: number | null;
  active_paper_job_count?: number | null;
};

export type CryptoPaperRuntimeRowDto = Record<string, unknown> & {
  id?: string | null;
  symbol?: string | null;
  ticker?: string | null;
  name?: string | null;
  displayName?: string | null;
  display_name?: string | null;
  assetClass?: AssetClassDto | null;
  asset_class?: AssetClassDto | null;
  venue?: VenueDto | null;
  exchange?: VenueDto | null;
  provider?: ProviderDto | null;
  baseCurrency?: string | null;
  base_currency?: string | null;
  quoteCurrency?: QuoteCurrencyDto | null;
  quote_currency?: QuoteCurrencyDto | null;
  mode?: ExecutionRuntimeMode | null;
  readiness?: CryptoReadinessStatus | null;
  status?: CryptoReadinessStatus | null;
  paperRuntimeState?: string | null;
  paper_runtime_state?: string | null;
  marketDataConnected?: boolean | null;
  market_data_connected?: boolean | null;
  websocketConnected?: boolean | null;
  websocket_connected?: boolean | null;
  paperTradingEnabled?: boolean | null;
  paper_trading_enabled?: boolean | null;
  liveTradingEnabled?: boolean | null;
  live_trading_enabled?: boolean | null;
  killSwitchEnabled?: boolean | null;
  kill_switch_enabled?: boolean | null;
  paused?: boolean | null;
  openPaperOrderCount?: number | null;
  open_paper_order_count?: number | null;
  activePaperJobCount?: number | null;
  active_paper_job_count?: number | null;
  lastHeartbeatAt?: string | null;
  last_heartbeat_at?: string | null;
  lastSimulatedFillAt?: string | null;
  last_simulated_fill_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
  issues?: ExecutionRuntimeIssueDto[] | string[] | null;
};

export type CryptoPaperRuntimeResponseDto = {
  request?: CryptoMarketRequestDto | null;
  runtime?: ExecutionRuntimeStatusResponseDto | null;
  summary?: CryptoPaperRuntimeSummaryDto | null;
  asOf?: string | null;
  as_of?: string | null;
  items?: CryptoPaperRuntimeRowDto[] | null;
  notices?: string[] | null;
};
