import type { AssetClassDto, QuoteCurrencyDto, VenueDto } from "./common";
import type { PortfolioMoneyAmountDto } from "./portfolio-account";

export type ExecutionRuntimeStatusValue =
  | "ready"
  | "degraded"
  | "offline"
  | "paused"
  | "kill_switched"
  | string;

export type ExecutionRuntimeMode = "live" | "paper" | "mock" | string;

export type ExecutionRuntimeIssueDto = Record<string, unknown> & {
  code?: string | null;
  message?: string | null;
};

export type ExecutionRuntimeWeeklyPnlDto = Record<string, unknown> & {
  week_start?: string | null;
  week_end_exclusive?: string | null;
  weekly_realized_pnl?: string | number | null;
  weekly_buy_notional?: string | number | null;
  weekly_sell_notional?: string | number | null;
  matched_sell_quantity?: number | string | null;
  unmatched_sell_quantity?: number | string | null;
  closed_trade_count?: number | null;
  win_count?: number | null;
  loss_count?: number | null;
  breakeven_count?: number | null;
  pnl_method?: string | null;
};

export type ExecutionRuntimeDailyPnlDto = Record<string, unknown> & {
  date?: string | null;
  daily_realized_pnl?: string | number | null;
  daily_buy_notional?: string | number | null;
  daily_sell_notional?: string | number | null;
  matched_sell_quantity?: number | string | null;
  unmatched_sell_quantity?: number | string | null;
  sold_symbols?: string[] | null;
  sold_symbol_count?: number | null;
  closed_symbols?: string[] | null;
  closed_symbol_count?: number | null;
  unmatched_sell_symbols?: string[] | null;
  unmatched_sell_symbol_count?: number | null;
  pnl_method?: string | null;
};

export type ExecutionRuntimeMonthlyPnlDto = Record<string, unknown> & {
  month?: string | null;
  monthly_realized_pnl?: string | number | null;
  monthly_buy_notional?: string | number | null;
  monthly_sell_notional?: string | number | null;
  matched_sell_quantity?: number | string | null;
  unmatched_sell_quantity?: number | string | null;
  pnl_method?: string | null;
};

export type ExecutionRuntimeSymbolsDto = Record<string, unknown> & {
  filled_today?: string[] | null;
  filled_today_by_side?: {
    buy?: string[] | null;
    sell?: string[] | null;
  } | null;
  filled_today_counts?: Record<string, Record<string, number> | undefined> | null;
};

export type ExecutionRuntimeActionableAlertsDto = Record<string, unknown> & {
  status?: string | null;
  alerts?: Record<string, unknown>[] | null;
};

export type ExecutionRuntimeStatusResponseDto = Record<string, unknown> & {
  status: ExecutionRuntimeStatusValue;
  mode?: ExecutionRuntimeMode | null;
  exec_connected?: boolean | null;
  automation_enabled?: boolean | null;
  paused?: boolean | null;
  kill_switch_enabled?: boolean | null;
  monitoring_alive?: boolean | null;
  last_heartbeat_at?: string | null;
  open_order_count?: number | null;
  active_execution_job_count?: number | null;
  issues?: ExecutionRuntimeIssueDto[] | null;
  core_integration_mode?: string | null;
  delegate_execution?: boolean | null;
  symbols?: ExecutionRuntimeSymbolsDto | null;
  daily_pnl?: ExecutionRuntimeDailyPnlDto | null;
  monthly_pnl?: ExecutionRuntimeMonthlyPnlDto | null;
  actionable_alerts?: ExecutionRuntimeActionableAlertsDto | null;
  weekly_pnl?: ExecutionRuntimeWeeklyPnlDto | null;
};

export type ExecutionRuntimeBoardStatus =
  | "planned"
  | "accepted"
  | "scheduled"
  | "submitted"
  | "partial"
  | "filled"
  | "cancelled"
  | "failed"
  | string;

export type ExecutionRuntimeMonitoringState =
  | "watching_target_stop"
  | "watching_fill"
  | "reconciling"
  | "idle"
  | string;

export type ExecutionRuntimeQuantity = number | string | null;

export type ExecutionRuntimeBoardItemDto = Record<string, unknown> & {
  plan_item_id?: number | string | null;
  account_reference?: string | null;
  account_label?: string | null;
  symbol: string;
  name?: string | null;
  market?: string | null;
  assetClass?: AssetClassDto | null;
  asset_class?: AssetClassDto | null;
  venue?: VenueDto | null;
  quoteCurrency?: QuoteCurrencyDto | null;
  quote_currency?: QuoteCurrencyDto | null;
  intent?: string | null;
  status: ExecutionRuntimeBoardStatus;
  monitoring_state?: ExecutionRuntimeMonitoringState | null;
  position_side?: string | null;
  planned_intents?: string[] | null;
  exec_monitoring_active?: boolean | null;
  exec_agent_approved?: boolean | null;
  exec_agent_action?: string | null;
  exec_agent_reason_code?: string | null;
  exec_agent_target_profile?: string | null;
  exec_agent_target_tag?: string | null;
  held_position?: boolean | null;
  position_quantity?: ExecutionRuntimeQuantity;
  position_average_price?: ExecutionRuntimeQuantity | PortfolioMoneyAmountDto | null;
  approved_quantity?: ExecutionRuntimeQuantity;
  approved_notional?: ExecutionRuntimeQuantity | PortfolioMoneyAmountDto | null;
  monitoring_statuses?: string[] | Record<string, number> | null;
  planned_quantity?: ExecutionRuntimeQuantity;
  filled_quantity?: ExecutionRuntimeQuantity;
  open_quantity?: ExecutionRuntimeQuantity;
  planned_price?: ExecutionRuntimeQuantity;
  avg_fill_price?: ExecutionRuntimeQuantity;
  trade_price?: ExecutionRuntimeQuantity;
  fill_price?: ExecutionRuntimeQuantity;
  current_price?: ExecutionRuntimeQuantity;
  close_price?: ExecutionRuntimeQuantity;
  market_close_price?: ExecutionRuntimeQuantity;
  eod_close_price?: ExecutionRuntimeQuantity;
  realized_pnl?: ExecutionRuntimeQuantity | PortfolioMoneyAmountDto | null;
  decision_source?: string | null;
  decision_snapshot_id?: number | string | null;
  policy_version?: string | null;
  execution_plan_id?: string | null;
  broker_order_id?: string | null;
  last_updated_at?: string | null;
  failure_reason?: string | null;
  target_price?: ExecutionRuntimeQuantity;
  stop_loss_price?: ExecutionRuntimeQuantity;
  target_trade_date?: string | null;
  source_market_date?: string | null;
};

export type ExecutionRuntimeDailyBoardSummaryDto = Record<string, unknown> & {
  items_total?: number | null;
  planned?: number | null;
  accepted?: number | null;
  scheduled?: number | null;
  submitted?: number | null;
  partial?: number | null;
  filled?: number | null;
  cancelled?: number | null;
  failed?: number | null;
};

export type ExecutionRuntimeRequestDto = {
  market_date?: string | null;
  symbol?: string | null;
  refresh?: boolean | null;
};

export type ExecutionRuntimeActivityCoverageDto = Record<string, unknown> & {
  status?: string | null;
  status_reason?: string | null;
  exec_activity_detected?: boolean | null;
  source?: string | null;
};

export type ExecutionRuntimeReadFreshnessDto = Record<string, unknown> & {
  status?: string | null;
  is_stale?: boolean | null;
  is_partial?: boolean | null;
  refreshing?: boolean | null;
};

export type ExecutionRuntimeDailyBoardResponseDto = {
  request?: ExecutionRuntimeRequestDto | null;
  runtime?: ExecutionRuntimeStatusResponseDto | null;
  market_date?: string | null;
  activity_coverage?: ExecutionRuntimeActivityCoverageDto | null;
  freshness?: ExecutionRuntimeReadFreshnessDto | null;
  summary?: ExecutionRuntimeDailyBoardSummaryDto | null;
  items?: ExecutionRuntimeBoardItemDto[] | null;
};

export type ExecutionRuntimeMonitoredSymbolDto = Record<string, unknown> & {
  symbol: string;
  name?: string | null;
  market?: string | null;
  assetClass?: AssetClassDto | null;
  asset_class?: AssetClassDto | null;
  venue?: VenueDto | null;
  quoteCurrency?: QuoteCurrencyDto | null;
  quote_currency?: QuoteCurrencyDto | null;
  monitoring_state: ExecutionRuntimeMonitoringState;
  position_side?: string | null;
  planned_intents?: string[] | null;
  exec_monitoring_active?: boolean | null;
  exec_agent_approved?: boolean | null;
  exec_agent_action?: string | null;
  exec_agent_reason_code?: string | null;
  exec_agent_target_profile?: string | null;
  exec_agent_target_tag?: string | null;
  held_position?: boolean | null;
  position_quantity?: ExecutionRuntimeQuantity;
  position_average_price?: ExecutionRuntimeQuantity | PortfolioMoneyAmountDto | null;
  approved_quantity?: ExecutionRuntimeQuantity;
  approved_notional?: ExecutionRuntimeQuantity | PortfolioMoneyAmountDto | null;
  monitoring_statuses?: string[] | Record<string, number> | null;
  target_price?: ExecutionRuntimeQuantity;
  stop_loss_price?: ExecutionRuntimeQuantity;
  current_price?: ExecutionRuntimeQuantity;
  close_price?: ExecutionRuntimeQuantity;
  last_event_at?: string | null;
  account_references?: string[] | null;
  status_counts?: Record<string, number> | null;
};

export type ExecutionRuntimeMonitoredSummaryDto = Record<string, unknown> & {
  items_total?: number | null;
  watching_target_stop?: number | null;
  watching_fill?: number | null;
  reconciling?: number | null;
  idle?: number | null;
  monitoring_state_counts?: Record<string, number> | null;
};

export type ExecutionRuntimeMonitoredSymbolsResponseDto = {
  request?: ExecutionRuntimeRequestDto | null;
  runtime?: ExecutionRuntimeStatusResponseDto | null;
  market_date?: string | null;
  activity_coverage?: ExecutionRuntimeActivityCoverageDto | null;
  freshness?: ExecutionRuntimeReadFreshnessDto | null;
  summary?: ExecutionRuntimeMonitoredSummaryDto | null;
  items?: ExecutionRuntimeMonitoredSymbolDto[] | null;
};

export type ExecutionRuntimeSymbolDetailSummaryDto = Record<string, unknown> & {
  items_total?: number | null;
  account_count?: number | null;
  status_counts?: Record<string, number> | null;
  planned_quantity_total?: ExecutionRuntimeQuantity;
  filled_quantity_total?: ExecutionRuntimeQuantity;
  open_quantity_total?: ExecutionRuntimeQuantity;
  last_updated_at?: string | null;
};

export type ExecutionRuntimeSymbolDetailResponseDto = {
  request?: ExecutionRuntimeRequestDto | null;
  runtime?: ExecutionRuntimeStatusResponseDto | null;
  market_date?: string | null;
  symbol: string;
  name?: string | null;
  market?: string | null;
  assetClass?: AssetClassDto | null;
  asset_class?: AssetClassDto | null;
  venue?: VenueDto | null;
  quoteCurrency?: QuoteCurrencyDto | null;
  quote_currency?: QuoteCurrencyDto | null;
  planning?: Record<string, unknown> | null;
  monitoring?: {
    state?: ExecutionRuntimeMonitoringState | null;
    position_side?: string | null;
    planned_intents?: string[] | null;
    last_event_at?: string | null;
    runtime_status?: ExecutionRuntimeStatusValue | null;
  } | null;
  summary?: ExecutionRuntimeSymbolDetailSummaryDto | null;
  items?: Array<
    ExecutionRuntimeBoardItemDto & {
      dispatch?: Record<string, unknown> | null;
      remote_state?: Record<string, unknown> | null;
      orders?: Record<string, unknown>[] | null;
      executions?: Record<string, unknown>[] | null;
      positions?: Record<string, unknown>[] | null;
      validation?: Record<string, unknown> | null;
      traceability?: Record<string, unknown> | null;
    }
  > | null;
};
