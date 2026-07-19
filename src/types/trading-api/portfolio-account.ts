import type { AssetClassDto, QuoteCurrencyDto, VenueDto } from "./common";

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
  week?: PortfolioMoneyAmountDto | null;
  dayPercent?: number | null;
  totalPercent?: number | null;
  weekPercent?: number | null;
  weekWindow?: {
    lookbackDays?: number | null;
    baselineCapturedAt?: string | null;
    currentCapturedAt?: string | null;
  } | null;
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
  assetClass?: AssetClassDto | null;
  venue?: VenueDto | null;
  quoteCurrency?: QuoteCurrencyDto | null;
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
  targetPrice?: PortfolioMoneyAmountDto | null;
  stopLossPrice?: PortfolioMoneyAmountDto | null;
  tradePrice?: PortfolioMoneyAmountDto | null;
  realizedPnl?: PortfolioMoneyAmountDto | null;
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

export type PortfolioRiskSourceStatus =
  | "ready"
  | "synced"
  | "partial"
  | "degraded"
  | "stale"
  | "unavailable"
  | string;

export type PortfolioRiskMoneyInputDto = PortfolioMoneyAmountDto | number | string | null;
export type PortfolioRuntimeModeDto = "live" | "paper" | "mock" | string;

export type PortfolioRiskExposureDto = Record<string, unknown> & {
  symbol: string;
  name?: string | null;
  market?: string | null;
  assetClass?: AssetClassDto | null;
  asset_class?: AssetClassDto | null;
  venue?: VenueDto | null;
  quoteCurrency?: QuoteCurrencyDto | null;
  quote_currency?: QuoteCurrencyDto | null;
  quantity?: number | string | null;
  baseQuantity?: number | string | null;
  base_quantity?: number | string | null;
  effectiveQuantity?: number | string | null;
  effective_quantity?: number | string | null;
  allocationPercent?: number | string | null;
  allocation_percent?: number | string | null;
  portfolioWeightPct?: number | string | null;
  portfolio_weight_pct?: number | string | null;
  marketValue?: PortfolioRiskMoneyInputDto;
  market_value?: PortfolioRiskMoneyInputDto;
  market_value_krw?: number | string | null;
  notional?: PortfolioRiskMoneyInputDto;
  notional_krw?: number | string | null;
  totalExposure?: PortfolioRiskMoneyInputDto;
  total_exposure?: PortfolioRiskMoneyInputDto;
  total_exposure_krw?: number | string | null;
  holdingNotional?: PortfolioRiskMoneyInputDto;
  holding_notional?: PortfolioRiskMoneyInputDto;
  openOrderNotional?: PortfolioRiskMoneyInputDto;
  open_order_notional?: PortfolioRiskMoneyInputDto;
};

export type PortfolioRiskOpenOrderDto = Record<string, unknown> & {
  id?: string | number | null;
  brokerOrderId?: string | null;
  broker_order_id?: string | null;
  symbol?: string | null;
  side?: string | null;
  intent?: string | null;
  status?: string | null;
  quantity?: number | string | null;
  remainingQuantity?: number | string | null;
  remaining_quantity?: number | string | null;
  limitPrice?: PortfolioRiskMoneyInputDto;
  limit_price?: PortfolioRiskMoneyInputDto;
  notional?: PortfolioRiskMoneyInputDto;
  notional_krw?: number | string | null;
  submittedAt?: string | null;
  submitted_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
  lastBrokerSyncAt?: string | null;
  last_broker_sync_at?: string | null;
  stale?: boolean | null;
  staleReason?: string | null;
  stale_reason?: string | null;
};

export type PortfolioRiskWarningDto = Record<string, unknown> & {
  type?: string | null;
  code?: string | null;
  severity?: string | null;
  symbol?: string | null;
  message?: string | null;
  reason?: string | null;
  count?: number | null;
};

export type PortfolioRiskOpenOrderSummaryDto = Record<string, unknown> & {
  openOrderCount?: number | null;
  open_order_count?: number | null;
  openOrderSymbolCount?: number | null;
  open_order_symbol_count?: number | null;
  totalOpenOrderNotional?: PortfolioRiskMoneyInputDto;
  total_open_order_notional?: PortfolioRiskMoneyInputDto;
  total_open_order_notional_krw?: number | string | null;
  topOpenOrders?: PortfolioRiskOpenOrderDto[] | null;
  top_open_orders?: PortfolioRiskOpenOrderDto[] | null;
};

export type PortfolioRiskSnapshotDto = Record<string, unknown> & {
  generatedAt?: string | null;
  generated_at?: string | null;
  asOf?: string | null;
  as_of?: string | null;
  mode?: PortfolioRuntimeModeDto | null;
  source?: string | null;
  sourceStatus?: PortfolioRiskSourceStatus | null;
  source_status?: PortfolioRiskSourceStatus | null;
  sourceMessage?: string | null;
  source_message?: string | null;
  sourceFailed?: string | null;
  source_failed?: string | null;
  available?: boolean | null;
  accountCash?: PortfolioRiskMoneyInputDto;
  account_cash?: PortfolioRiskMoneyInputDto;
  buyingPower?: PortfolioRiskMoneyInputDto;
  buying_power?: PortfolioRiskMoneyInputDto;
  totalMarketValue?: PortfolioRiskMoneyInputDto;
  total_market_value?: PortfolioRiskMoneyInputDto;
  total_market_value_krw?: number | string | null;
  totalSecuritiesValue?: PortfolioRiskMoneyInputDto;
  total_securities_value?: PortfolioRiskMoneyInputDto;
  openHoldingCount?: number | null;
  open_holding_count?: number | null;
  topHoldings?: PortfolioRiskExposureDto[] | null;
  top_holdings?: PortfolioRiskExposureDto[] | null;
  topExposures?: PortfolioRiskExposureDto[] | null;
  top_exposures?: PortfolioRiskExposureDto[] | null;
  exposures?: PortfolioRiskExposureDto[] | null;
  topPositionConcentration?: PortfolioRiskExposureDto[] | null;
  top_position_concentration?: PortfolioRiskExposureDto[] | null;
  openOrderSummary?: PortfolioRiskOpenOrderSummaryDto | null;
  open_order_summary?: PortfolioRiskOpenOrderSummaryDto | null;
  topOpenOrders?: PortfolioRiskOpenOrderDto[] | null;
  top_open_orders?: PortfolioRiskOpenOrderDto[] | null;
  openOrders?: PortfolioRiskOpenOrderDto[] | null;
  open_orders?: PortfolioRiskOpenOrderDto[] | null;
  stalePositionWarnings?: PortfolioRiskWarningDto[] | null;
  stale_position_warnings?: PortfolioRiskWarningDto[] | null;
  staleLocalPositionWarnings?: PortfolioRiskWarningDto[] | null;
  stale_local_position_warnings?: PortfolioRiskWarningDto[] | null;
  staleOrderWarnings?: PortfolioRiskWarningDto[] | null;
  stale_order_warnings?: PortfolioRiskWarningDto[] | null;
  staleOpenOrderWarnings?: PortfolioRiskWarningDto[] | null;
  stale_open_order_warnings?: PortfolioRiskWarningDto[] | null;
  concentrationWarnings?: PortfolioRiskWarningDto[] | null;
  concentration_warnings?: PortfolioRiskWarningDto[] | null;
  warnings?: PortfolioRiskWarningDto[] | null;
  missingStopMetadataCount?: number | null;
  missing_stop_metadata_count?: number | null;
  missingMetadataWarningCount?: number | null;
  missing_metadata_warning_count?: number | null;
  missingStopMetadataWarnings?: PortfolioRiskWarningDto[] | null;
  missing_stop_metadata_warnings?: PortfolioRiskWarningDto[] | null;
  notices?: string[] | null;
};
