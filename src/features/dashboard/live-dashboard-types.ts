import type {
  AgentFeedbackProgressResponseDto,
  AgentFeedbackListResponseDto,
  DartFundamentalsDailyInspectResponseDto,
  EodFreshnessResponseDto,
  EodMarketRiskFiltersResponseDto,
  EodMomentumFactorsResponseDto,
  EodPipelineStatusResponseDto,
  EodPiotroskiFilterResultsResponseDto,
  EodValueFactorsResponseDto,
  ExecutionRuntimeDailyBoardResponseDto,
  ExecutionRuntimeMonitoredSymbolsResponseDto,
  ExecutionRuntimeStatusResponseDto,
  MarketSnapshotResponseDto,
  PortfolioSummaryDto,
} from "@/types/trading-api";
import type { DailyPipelineTimelineModel } from "@/lib/eod-pipeline-status";

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
  initialPiotroskiStatus?: EodPiotroskiFilterResultsResponseDto | null;
  initialMarketRiskStatus?: EodMarketRiskFiltersResponseDto | null;
  initialScoringValueFactors?: EodValueFactorsResponseDto | null;
  initialScoringMomentumFactors?: EodMomentumFactorsResponseDto | null;
  initialMarketSnapshot: MarketSnapshotResponseDto | null;
  initialAgentFeedbackProgress: AgentFeedbackProgressResponseDto | null;
  initialSignalDeciderFeedback: AgentFeedbackListResponseDto | null;
  initialLatestSignalDeciderFeedback?: AgentFeedbackListResponseDto | null;
  initialPortfolioSummary: PortfolioSummaryDto | null;
  initialExecutionRuntimeStatus: ExecutionRuntimeStatusResponseDto | null;
  initialExecutionRuntimeMonitoredSymbols: ExecutionRuntimeMonitoredSymbolsResponseDto | null;
  initialExecutionRuntimeDailyBoard: ExecutionRuntimeDailyBoardResponseDto | null;
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

export type EodStageId = "price" | "technical" | "action" | "fundamentals";

export type EodStageDetail = {
  key: string;
  label: string;
  value: string;
  tone?: "count" | "text";
  layout?: "inline" | "stacked";
};

export type FundamentalsUpdatedEntryModel = {
  key: string;
  symbol: string;
  companyName: string;
  categoryLabel: string;
};

export type FundamentalsUpdatedActivityModel = {
  key: string;
  countLabel: string;
  previewItems: FundamentalsUpdatedEntryModel[];
  allItems: FundamentalsUpdatedEntryModel[];
  canExpand: boolean;
};

export type EodStageCard = {
  id: EodStageId;
  label: string;
  latestDate: string | null;
  statusLabel: "synced" | "running" | "waiting" | "break day" | "not synced";
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
  detailHref: string | null;
};

export type FilteringStageMetric = {
  key: string;
  label: string;
  value: string;
};

export type FilteringStageStatus = "completed" | "loading" | "needs-review" | "pending" | "waiting";

export type FilteringStageModel = {
  key: "piotroski" | "kis-risk";
  displayMarketDate: string | null;
  displayMarketDateLabel: string;
  filteredCountLabel: string;
  label: string;
  metrics: FilteringStageMetric[];
  note: string | null;
  status: FilteringStageStatus;
  statusLabel: string;
  statusTone: "positive" | "neutral" | "warning";
};

export type FilteringCardModel = {
  finalFilteredCountLabel: string;
  piotroskiDisplayMarketDate: string | null;
  stages: [FilteringStageModel, FilteringStageModel];
};

export type ScoringStageKey = "unified-value" | "quality" | "momentum";

export type ScoringStageStatus = "completed" | "loading" | "needs-review" | "pending" | "waiting";

export type ScoringStageMetric = {
  key: string;
  label: string;
  value: string;
};

export type ScoringStageModel = {
  key: ScoringStageKey;
  displayMarketDate: string | null;
  displayMarketDateLabel: string;
  label: string;
  metrics: ScoringStageMetric[];
  note: string | null;
  progressLabel: string;
  status: ScoringStageStatus;
  statusLabel: string;
  statusTone: "positive" | "neutral" | "warning";
};

export type ScoringCardModel = {
  stages: ScoringStageModel[];
};

export type ProcessMonitorStatus = "completed" | "pending" | "running" | "partial" | "error" | "retry";

export type ProcessMonitorMetric = {
  key: string;
  label: string;
  value: string;
};

export type ProcessMonitorStep = {
  key: string;
  label: string;
  status: ProcessMonitorStatus;
  statusLabel: string;
  progressLabel: string;
  progressPercent: number;
  metrics: ProcessMonitorMetric[];
  note: string | null;
};

export type ProcessMonitorGroupKey = "patch" | "filter" | "scoring" | "agent-feedback";

export type ProcessMonitorGroup = {
  key: ProcessMonitorGroupKey;
  label: string;
  status: ProcessMonitorStatus;
  statusLabel: string;
  progressLabel: string;
  progressPercent: number;
  completedCount: number;
  totalCount: number;
  currentStepLabel: string | null;
  steps: ProcessMonitorStep[];
};

export type ProcessMonitorModel = {
  status: ProcessMonitorStatus;
  statusLabel: string;
  progressLabel: string;
  progressPercent: number;
  completedCount: number;
  totalCount: number;
  patchDate: string | null;
  currentGroupLabel: string | null;
  currentStepLabel: string | null;
  pipeline: DailyPipelineTimelineModel;
  groups: ProcessMonitorGroup[];
};

export type AgentRoleProgressSnapshot = {
  role: string;
  status: AgentRoleStatus;
  completedCount: number | null;
  failedCount: number | null;
  progressCount: number | null;
  totalCount: number | null;
  progressPercent: number | null;
};

export type AgentRoleResultSnapshot = {
  role: string;
  requestedCount: number | null;
  completedCount: number | null;
  errorCount: number | null;
};

export type FilteringStageLoadState = "idle" | "loading" | "ready" | "error";
