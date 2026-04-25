import type {
  AgentFeedbackProgressResponseDto,
  DartFundamentalsDailyInspectResponseDto,
  EodFreshnessResponseDto,
  EodPipelineStatusResponseDto,
} from "@/types/trading-api";

export type CoreMarketStatus = {
  market?: string | null;
  state: string;
  is_trading_day?: boolean | null;
  is_open: boolean;
  server_time?: string | null;
  as_of?: string | null;
  session_open_at?: string | null;
  session_close_at?: string | null;
  reason?: string | null;
};

export type CoreTrackedQuote = {
  symbol: string;
  company_name?: string | null;
  name?: string | null;
  name_ko?: string | null;
  price: number | null;
  change: number | null;
  change_pct: number | null;
  volume: number | null;
  turnover: number | null;
  as_of: string | null;
  market_state: string;
  source: string;
  fallback: boolean;
  is_live: boolean;
  available: boolean;
  trade_date?: string | null;
  cached_at?: string | null;
  fallback_reason?: string | null;
  unavailable_reason?: string | null;
};

export type CoreTrackedQuotesResponse = {
  market_state: string;
  as_of: string;
  items: CoreTrackedQuote[];
};

export type LiveDashboardClientProps = {
  initialError?: string | null;
  initialMarket: CoreMarketStatus;
  initialTracked: CoreTrackedQuotesResponse;
  initialFreshness: EodFreshnessResponseDto | null;
  initialFundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null;
  initialPipelineStatus: EodPipelineStatusResponseDto | null;
  initialAgentFeedbackProgress: AgentFeedbackProgressResponseDto | null;
};

export type DetailItem = {
  label: string;
  value: string;
};

export type FundamentalsFailureDetails = {
  key: string;
  title: string;
  reason: string;
  details: DetailItem[];
  metadata: DetailItem[];
};

export type SymbolMetadataItem = {
  symbol: string;
  company_name?: string | null;
  name?: string | null;
  name_ko?: string | null;
  market?: string | null;
  standard_code?: string | null;
};

export type SymbolSearchResponse = {
  items: SymbolMetadataItem[];
};

export type EodStageId = "price" | "technical" | "action" | "fundamentals";

export type EodStageDetail = {
  key: string;
  label: string;
  value: string;
  tone?: "count" | "text";
  layout?: "inline" | "stacked";
};

export type EodStageCard = {
  id: EodStageId;
  label: string;
  latestDate: string | null;
  statusLabel: "synced" | "running" | "break day" | "not synced";
  statusBadgeLabel: string;
  statusBadgeTitle: string | null;
  tone: "positive" | "info" | "neutral" | "warning";
  details: EodStageDetail[];
};

export type AgentRoleStatus = "completed" | "running" | "pending" | "attention";

export type AgentRoleMetric = {
  key: string;
  label: string;
  value: string;
};

export type AgentRoleCard = {
  role: string;
  label: string;
  status: AgentRoleStatus;
  progressPercent: number;
  progressLabel: string;
  metrics: AgentRoleMetric[];
};

export type AgentRoleProgressSnapshot = {
  role: string;
  status: AgentRoleStatus;
  completedCount: number | null;
  progressPercent: number | null;
};

export type AgentRoleResultSnapshot = {
  role: string;
  requestedCount: number | null;
  completedCount: number | null;
  errorCount: number | null;
};

export type PiotroskiBoardLoadState = "idle" | "loading" | "ready" | "error";
