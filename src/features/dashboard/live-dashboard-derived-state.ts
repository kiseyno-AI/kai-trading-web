import { type DashboardLiveCopy } from "@/i18n/dashboard-live-copy";
import {
  getLatestEodPatchStageDetail,
  getLatestActionMarketDate,
  getLatestEodStatus,
  getLatestPriceTradeDate,
  getLatestTechnicalMarketDate,
} from "@/lib/eod-freshness-latest";
import { formatDisplayTimestamp } from "@/lib/format";
import { buildFactorQualitySummary } from "@/lib/factor-quality";
import { resolvePiotroskiMarketDateResolution } from "@/lib/piotroski-pass-list";
import {
  getPresenterStageDisplayLabel,
  getPresenterStageTone,
  resolveNormalizedPresenterDate,
  resolvePresenterStageStatus,
} from "@/lib/stage-date-status-presenter";
import {
  getEodSymbolsFailed,
  getEodSymbolsSucceeded,
  getEodSymbolsTotal,
  getFundamentalsRunDate,
  getFundamentalsStageDisplayCounts,
  getLatestAvailableFundamentalsCoverage,
  getLatestEodSymbolsFailed,
  getLatestEodSymbolsSucceeded,
  getLatestEodSymbolsTotal,
  getLatestFundamentalsRun,
  isRunningPipelineStage,
} from "@/lib/dashboard-eod-stage-data";
import type {
  AgentFeedbackProgressResponseDto,
  AgentFeedbackRunStatus,
  DartFundamentalsDailyInspectResponseDto,
  DartFundamentalsDailyRunDto,
  DartFundamentalsDailyUpdatedEntriesSummaryDto,
  DartFundamentalsDailyUpdatedEntryDto,
  EodFreshnessLayerStatusDto,
  EodFreshnessResponseDto,
  EodMarketRiskFiltersResponseDto,
  EodFreshnessStageDto,
  EodMomentumFactorsResponseDto,
  EodPipelineStageDto,
  EodPipelineStageKey,
  EodPipelineStatusResponseDto,
  EodPiotroskiFilterResultsResponseDto,
  EodValueFactorItemDto,
  EodValueFactorsResponseDto,
  MarketSnapshotFlowDto,
  MarketSnapshotFxRateDto,
  MarketSnapshotIndexDto,
  MarketSnapshotResponseDto,
} from "@/types/trading-api";

import type {
  AgentRoleCard,
  AgentRoleMetric,
  AgentRoleProgressSnapshot,
  AgentRoleResultSnapshot,
  AgentRoleStatus,
  CoreMarketStatus,
  CoreTrackedQuotesResponse,
  DetailItem,
  EodStageCard,
  EodStageDetail,
  EodStageId,
  FilteringCardModel,
  FilteringStageLoadState,
  FilteringStageMetric,
  FilteringStageModel,
  FilteringStageStatus,
  FundamentalsFailureDetails,
  FundamentalsUpdatedActivityModel,
  FundamentalsUpdatedEntryModel,
  ProcessMonitorGroup,
  ProcessMonitorMetric,
  ProcessMonitorModel,
  ProcessMonitorStatus,
  ProcessMonitorStep,
  ScoringCardModel,
  ScoringStageKey,
  ScoringStageMetric,
  ScoringStageModel,
  ScoringStageStatus,
} from "./live-dashboard-types";

export const UNKNOWN_LABEL = "[확인 필요]";
const EOD_PIPELINE_STATUS_RUNNING_POLL_MS = 1_000;
const EOD_PIPELINE_STATUS_IDLE_POLL_MS = 30_000;
const AGENT_FEEDBACK_PROGRESS_RUNNING_POLL_MS = 1_000;
const AGENT_FEEDBACK_PROGRESS_IDLE_POLL_MS = 30_000;
const SIGNAL_DECIDER_FEEDBACK_ERROR_RETRY_POLL_MS = 5_000;
const MARKET_SNAPSHOT_IDLE_POLL_MS = 60_000;
const MARKET_SNAPSHOT_ERROR_RETRY_DELAYS_MS = [5_000, 15_000, 30_000] as const;
const FUNDAMENTALS_UPDATED_ENTRIES_PREVIEW_LIMIT = 3;
const FUNDAMENTALS_UPDATED_SYMBOL_SAMPLE_LIMIT = 4;

type ScoringStagePipelineDefinition = {
  key: ScoringStageKey;
  pipelineKey: EodPipelineStageKey;
  fallbackPipelineKeys: readonly EodPipelineStageKey[];
};

const SCORING_STAGE_DEFINITIONS = [
  {
    key: "unified-value",
    pipelineKey: "unified_value_factors",
    fallbackPipelineKeys: ["unified_value_scoring"],
  },
  {
    key: "quality",
    pipelineKey: "quality_factors",
    fallbackPipelineKeys: ["quality_scoring"],
  },
  {
    key: "momentum",
    pipelineKey: "momentum_factors",
    fallbackPipelineKeys: ["momentum_scoring"],
  },
] as const satisfies readonly ScoringStagePipelineDefinition[];
const DEFAULT_AGENT_ROLE_ORDER = [
  "eod-summarizer",
  "technical-summarizer",
  "fundamental-summarizer",
] as const;

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number";
}

function hasCompletedScoringResult({
  loadState,
  processedCount,
  totalCount,
}: {
  loadState: FilteringStageLoadState;
  processedCount: number | null;
  totalCount: number | null;
}) {
  if (loadState !== "ready") return false;
  if (hasNumber(processedCount)) return processedCount > 0;
  return hasNumber(totalCount) ? totalCount === 0 : false;
}

export function getAgentProgressStatusLabels(copy: DashboardLiveCopy) {
  return {
    pending: copy.agentFeedback.statuses.pending,
    running: copy.agentFeedback.statuses.running,
    stalled: copy.agentFeedback.statuses.stalled,
    completed: copy.agentFeedback.statuses.completed,
  } satisfies Record<AgentFeedbackRunStatus, string>;
}

export function getAgentRoleStatusLabels(copy: DashboardLiveCopy) {
  return {
    completed: copy.agentFeedback.roleStatuses.completed,
    running: copy.agentFeedback.roleStatuses.running,
    pending: copy.agentFeedback.roleStatuses.pending,
    attention: copy.agentFeedback.roleStatuses.attention,
  } satisfies Record<AgentRoleStatus, string>;
}

export function getStageStatusLabel(status: EodStageCard["statusLabel"], copy: DashboardLiveCopy) {
  return getPresenterStageDisplayLabel(status, copy.stage);
}

function getUsableCompanyName(symbol: string, ...values: Array<string | null | undefined>): string | null {
  const normalizedSymbol = symbol.trim().toUpperCase();
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed && trimmed.toUpperCase() !== normalizedSymbol) {
      return trimmed;
    }
  }

  return null;
}

export function getDashboardLoadErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to refresh dashboard data.";
}

export type MarketSnapshotPresentationStatus = "ready" | "partial" | "stale" | "unavailable";
export type MarketSnapshotPresentationTone = "positive" | "info" | "neutral" | "warning";
type MarketSnapshotNumberInput = number | string | null | undefined;
type MarketSnapshotIndexKey = "kospi" | "kosdaq";
type MarketSnapshotFlowKey = "foreign" | "institutional";
type MarketSnapshotIndicesRecord = {
  kospi?: MarketSnapshotIndexDto | null;
  kosdaq?: MarketSnapshotIndexDto | null;
};
type MarketSnapshotFxRecord = {
  usdkrw?: MarketSnapshotFxRateDto | null;
  usd_krw?: MarketSnapshotFxRateDto | null;
};
type MarketSnapshotFlowsRecord = {
  foreign?: MarketSnapshotFlowDto | null;
  institutional?: MarketSnapshotFlowDto | null;
};
export type MarketSnapshotFieldId =
  | "indices.kospi"
  | "indices.kosdaq"
  | "fx.usdkrw"
  | "flows.foreign"
  | "flows.institutional"
  | "summary";

const REQUIRED_MARKET_SNAPSHOT_FIELD_IDS = [
  "indices.kospi",
  "indices.kosdaq",
  "fx.usdkrw",
  "flows.foreign",
  "flows.institutional",
] as const satisfies readonly MarketSnapshotFieldId[];
const MARKET_SNAPSHOT_INDEX_KEYS = ["kospi", "kosdaq"] as const satisfies readonly MarketSnapshotIndexKey[];

const MARKET_SNAPSHOT_FIELD_ALIASES = {
  "indices.kospi": ["indices.kospi", "kospi", "kospi_index", "kospi index", "ks11"],
  "indices.kosdaq": ["indices.kosdaq", "kosdaq", "kosdaq_index", "kosdaq index", "kq11"],
  "fx.usdkrw": ["fx.usdkrw", "fx.usd_krw", "usdkrw", "usd_krw", "usd/krw", "usd-krw"],
  "flows.foreign": ["flows.foreign", "foreign", "foreign_flow", "foreign investor", "foreign_investor"],
  "flows.institutional": [
    "flows.institutional",
    "institutional",
    "institutional_flow",
    "institution",
    "기관",
  ],
  summary: ["summary", "summary.line", "market_bias", "breadth_summary", "market posture"],
} as const satisfies Record<MarketSnapshotFieldId, readonly string[]>;

function isMarketSnapshotRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asMarketSnapshotNumberInput(value: unknown): MarketSnapshotNumberInput {
  return typeof value === "number" || typeof value === "string" || value === null ? value : undefined;
}

export function readMarketSnapshotNumber(...values: MarketSnapshotNumberInput[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string") continue;
    const normalized = value.replace(/[,₩$%]/g, "").trim();
    if (!normalized) continue;
    const numericValue = Number(normalized);
    if (Number.isFinite(numericValue)) return numericValue;
  }

  return null;
}

export function normalizeMarketSnapshotToken(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "") ?? "";
}

function getRecordValueByNormalizedKey(record: Record<string, unknown>, aliases: readonly string[]) {
  const aliasTokens = aliases.map((alias) => normalizeMarketSnapshotToken(alias)).filter(Boolean);
  for (const [key, value] of Object.entries(record)) {
    if (aliasTokens.includes(normalizeMarketSnapshotToken(key))) return value;
  }

  return undefined;
}

function getNestedDataPayload(value: unknown) {
  if (!isMarketSnapshotRecord(value)) return null;
  const data = value.data;
  return isMarketSnapshotRecord(data) ? data : null;
}

function getLiveCoreMarketRow(
  root: Record<string, unknown>,
  key: MarketSnapshotIndexKey,
): Record<string, unknown> | null {
  const markets = root.markets;
  const aliases = MARKET_SNAPSHOT_FIELD_ALIASES[`indices.${key}`];

  if (Array.isArray(markets)) {
    return (
      markets.find((market): market is Record<string, unknown> => {
        if (!isMarketSnapshotRecord(market)) return false;
        const candidates = [
          market.id,
          market.label,
          market.symbol,
          market.code,
          market.market,
          market.name,
          market.index,
          market.index_name,
        ].map((candidate) => normalizeMarketSnapshotToken(asText(candidate)));
        return aliases.some((alias) => candidates.includes(normalizeMarketSnapshotToken(alias)));
      }) ?? null
    );
  }

  if (!isMarketSnapshotRecord(markets)) return null;
  const directValue = getRecordValueByNormalizedKey(markets, aliases);
  return isMarketSnapshotRecord(directValue) ? directValue : null;
}

function getLiveCoreMarketRows(root: Record<string, unknown>) {
  return MARKET_SNAPSHOT_INDEX_KEYS.map((key) => getLiveCoreMarketRow(root, key)).filter(
    (row): row is Record<string, unknown> => Boolean(row),
  );
}

function hasIndexEntry(indices: MarketSnapshotResponseDto["indices"], key: MarketSnapshotIndexKey) {
  const aliases = MARKET_SNAPSHOT_FIELD_ALIASES[`indices.${key}`];

  if (Array.isArray(indices)) {
    return indices.some((index) => {
      const record = index as Record<string, unknown>;
      const candidates = [
        index.id,
        index.label,
        index.symbol,
        index.code,
        index.market,
        index.name,
        asText(record.index),
        asText(record.index_name),
      ].map(normalizeMarketSnapshotToken);
      return aliases.some((alias) => candidates.includes(normalizeMarketSnapshotToken(alias)));
    });
  }

  return isMarketSnapshotRecord(indices) && isMarketSnapshotRecord(getRecordValueByNormalizedKey(indices, aliases));
}

function normalizeLiveCoreMarketIndex(
  root: Record<string, unknown>,
  row: Record<string, unknown>,
  key: MarketSnapshotIndexKey,
): MarketSnapshotIndexDto {
  return {
    ...(row as MarketSnapshotIndexDto),
    as_of: asText(row.as_of) ?? asText(root.as_of) ?? null,
    id: asText(row.id) ?? key,
    market: asText(row.market) ?? key.toUpperCase(),
    market_date: asText(row.market_date) ?? asText(root.market_date) ?? null,
    source: asText(row.source) ?? asText(root.source) ?? null,
    symbol: asText(row.symbol) ?? key.toUpperCase(),
  };
}

function normalizeLiveCoreMarketIndices(snapshot: MarketSnapshotResponseDto, root: Record<string, unknown>) {
  const liveRows = MARKET_SNAPSHOT_INDEX_KEYS.map((key) => ({
    key,
    row: getLiveCoreMarketRow(root, key),
  })).filter((entry): entry is { key: MarketSnapshotIndexKey; row: Record<string, unknown> } => Boolean(entry.row));

  if (liveRows.length === 0) return snapshot.indices;

  if (Array.isArray(snapshot.indices)) {
    let changed = false;
    const indices = [...snapshot.indices];
    for (const { key, row } of liveRows) {
      if (hasIndexEntry(indices, key)) continue;
      indices.push(normalizeLiveCoreMarketIndex(root, row, key));
      changed = true;
    }
    return changed ? indices : snapshot.indices;
  }

  const indices: MarketSnapshotIndicesRecord = isMarketSnapshotRecord(snapshot.indices)
    ? { ...(snapshot.indices as MarketSnapshotIndicesRecord) }
    : {};
  let changed = false;
  for (const { key, row } of liveRows) {
    if (hasIndexEntry(indices, key)) continue;
    indices[key] = normalizeLiveCoreMarketIndex(root, row, key);
    changed = true;
  }

  return changed ? indices : snapshot.indices;
}

function normalizeLiveCoreUsdKrwRate(root: Record<string, unknown>): MarketSnapshotFxRateDto | null {
  const directValue = getRecordValueByNormalizedKey(root, MARKET_SNAPSHOT_FIELD_ALIASES["fx.usdkrw"]);

  if (isMarketSnapshotRecord(directValue)) {
    return {
      ...(directValue as MarketSnapshotFxRateDto),
      pair: asText(directValue.pair) ?? "USD/KRW",
    };
  }

  const numericValue = readMarketSnapshotNumber(asMarketSnapshotNumberInput(directValue));
  if (numericValue === null) return null;

  return {
    pair: "USD/KRW",
    value: numericValue,
  };
}

function hasUsdKrwRateEntry(fx: MarketSnapshotResponseDto["fx"]) {
  const aliases = MARKET_SNAPSHOT_FIELD_ALIASES["fx.usdkrw"];

  if (Array.isArray(fx)) {
    return fx.some((rate) => {
      const record = rate as Record<string, unknown>;
      const candidates = [
        rate.id,
        rate.label,
        rate.code,
        rate.name,
        rate.pair,
        rate.base && rate.quote ? `${rate.base}${rate.quote}` : null,
        rate.base && rate.quote ? `${rate.base}/${rate.quote}` : null,
        asText(record.symbol),
      ].map(normalizeMarketSnapshotToken);
      return aliases.some((alias) => candidates.includes(normalizeMarketSnapshotToken(alias)));
    });
  }

  return isMarketSnapshotRecord(fx) && isMarketSnapshotRecord(getRecordValueByNormalizedKey(fx, aliases));
}

function normalizeLiveCoreFx(snapshot: MarketSnapshotResponseDto, root: Record<string, unknown>) {
  const usdKrwRate = normalizeLiveCoreUsdKrwRate(root);
  if (!usdKrwRate || hasUsdKrwRateEntry(snapshot.fx)) return snapshot.fx;

  if (Array.isArray(snapshot.fx)) return [...snapshot.fx, usdKrwRate];

  const fx: MarketSnapshotFxRecord = {
    ...(isMarketSnapshotRecord(snapshot.fx) ? (snapshot.fx as MarketSnapshotFxRecord) : {}),
    usdkrw: usdKrwRate,
  };
  return fx;
}

function getLiveCoreMarketRowFlowAmount(row: Record<string, unknown>, key: MarketSnapshotFlowKey) {
  const fieldNames =
    key === "foreign"
      ? [
          "foreign_net_value",
          "foreign_net_amount",
          "foreign_net_buy_amount",
          "foreign_net_buy",
          "foreign_net",
          "foreign_value",
          "foreign_amount",
        ]
      : [
          "institution_net_value",
          "institution_net_amount",
          "institution_net_buy_amount",
          "institution_net_buy",
          "institution_net",
          "institution_value",
          "institution_amount",
          "institutional_net_value",
          "institutional_net_amount",
          "institutional_net_buy_amount",
          "institutional_net_buy",
          "institutional_net",
          "institutional_value",
          "institutional_amount",
        ];

  return readMarketSnapshotNumber(...fieldNames.map((fieldName) => asMarketSnapshotNumberInput(row[fieldName])));
}

function buildLiveCoreFlowFromMarkets(
  root: Record<string, unknown>,
  key: MarketSnapshotFlowKey,
): MarketSnapshotFlowDto | null {
  const rowsWithAmounts = getLiveCoreMarketRows(root)
    .map((row) => ({
      amount: getLiveCoreMarketRowFlowAmount(row, key),
      row,
    }))
    .filter((entry): entry is { amount: number; row: Record<string, unknown> } => entry.amount !== null);

  if (rowsWithAmounts.length === 0) return null;

  const firstRow = rowsWithAmounts[0]?.row;
  return {
    as_of: asText(firstRow?.as_of) ?? asText(root.as_of) ?? null,
    investor_type: key,
    source: asText(firstRow?.source) ?? asText(root.source) ?? null,
    type: key,
    unit: asText(firstRow?.unit) ?? asText(firstRow?.currency) ?? "KRW",
    value: rowsWithAmounts.reduce((total, entry) => total + entry.amount, 0),
  };
}

function hasFlowEntry(flows: MarketSnapshotResponseDto["flows"], key: MarketSnapshotFlowKey) {
  const aliases = MARKET_SNAPSHOT_FIELD_ALIASES[`flows.${key}`];

  if (Array.isArray(flows)) {
    return flows.some((flow) => {
      const candidates = [
        flow.id,
        flow.name,
        flow.label,
        flow.market,
        flow.investor_type,
        flow.type,
      ].map(normalizeMarketSnapshotToken);
      return aliases.some((alias) => candidates.includes(normalizeMarketSnapshotToken(alias)));
    });
  }

  return isMarketSnapshotRecord(flows) && isMarketSnapshotRecord(getRecordValueByNormalizedKey(flows, aliases));
}

function normalizeLiveCoreFlows(snapshot: MarketSnapshotResponseDto, root: Record<string, unknown>) {
  const liveFlows = (["foreign", "institutional"] as const).map((key) => ({
    key,
    flow: buildLiveCoreFlowFromMarkets(root, key),
  })).filter((entry): entry is { key: MarketSnapshotFlowKey; flow: MarketSnapshotFlowDto } => Boolean(entry.flow));

  if (liveFlows.length === 0) return snapshot.flows;

  if (Array.isArray(snapshot.flows)) {
    let changed = false;
    const flows = [...snapshot.flows];
    for (const { key, flow } of liveFlows) {
      if (hasFlowEntry(flows, key)) continue;
      flows.push(flow);
      changed = true;
    }
    return changed ? flows : snapshot.flows;
  }

  const flows: MarketSnapshotFlowsRecord = isMarketSnapshotRecord(snapshot.flows)
    ? { ...(snapshot.flows as MarketSnapshotFlowsRecord) }
    : {};
  let changed = false;
  for (const { key, flow } of liveFlows) {
    if (hasFlowEntry(flows, key)) continue;
    flows[key] = flow;
    changed = true;
  }

  return changed ? flows : snapshot.flows;
}

function normalizeLiveCoreMarketSnapshotShape(snapshot: MarketSnapshotResponseDto): MarketSnapshotResponseDto {
  const root = snapshot as Record<string, unknown>;
  const indices = normalizeLiveCoreMarketIndices(snapshot, root);
  const fx = normalizeLiveCoreFx(snapshot, root);
  const flows = normalizeLiveCoreFlows(snapshot, root);

  if (indices === snapshot.indices && fx === snapshot.fx && flows === snapshot.flows) return snapshot;

  return {
    ...snapshot,
    flows,
    fx,
    indices,
  };
}

export function normalizeMarketSnapshotResponse(
  marketSnapshot: MarketSnapshotResponseDto | null,
): MarketSnapshotResponseDto | null {
  if (!marketSnapshot) return null;

  const root = marketSnapshot as Record<string, unknown>;
  const data = getNestedDataPayload(root);
  if (!data) return normalizeLiveCoreMarketSnapshotShape(marketSnapshot);

  const normalizedData = normalizeMarketSnapshotResponse(data as MarketSnapshotResponseDto);
  if (!normalizedData) return null;
  const meta = isMarketSnapshotRecord(root.meta) ? root.meta : null;

  return normalizeLiveCoreMarketSnapshotShape({
    ...normalizedData,
    as_of: normalizedData.as_of ?? asText(root.as_of) ?? asText(meta?.generatedAt) ?? null,
    market_date: normalizedData.market_date ?? asText(root.market_date) ?? null,
    missing_fields:
      normalizedData.missing_fields ??
      (Array.isArray(root.missing_fields) ? root.missing_fields.filter((field): field is string => typeof field === "string") : null),
    source: normalizedData.source ?? asText(root.source) ?? asText(meta?.source) ?? null,
    stale_reason: normalizedData.stale_reason ?? asText(root.stale_reason) ?? null,
    status: normalizedData.status ?? asText(root.status) ?? null,
  });
}

export function getMarketSnapshotIndex(snapshot: MarketSnapshotResponseDto | null, key: "kospi" | "kosdaq") {
  const normalizedSnapshot = normalizeMarketSnapshotResponse(snapshot);
  const indices = normalizedSnapshot?.indices;
  if (!indices) return null;
  const aliases = MARKET_SNAPSHOT_FIELD_ALIASES[`indices.${key}`];

  if (Array.isArray(indices)) {
    return (
      indices.find((index) => {
        const record = index as Record<string, unknown>;
        const candidates = [
          index.id,
          index.label,
          index.symbol,
          index.code,
          index.market,
          index.name,
          asText(record.index),
          asText(record.index_name),
        ].map(normalizeMarketSnapshotToken);
        return aliases.some((alias) => candidates.includes(normalizeMarketSnapshotToken(alias)));
      }) ?? null
    );
  }

  const indexRecord = indices as Record<string, unknown>;
  const directValue = getRecordValueByNormalizedKey(indexRecord, aliases);
  return isMarketSnapshotRecord(directValue) ? (directValue as MarketSnapshotIndexDto) : null;
}

export function getMarketSnapshotFxRate(snapshot: MarketSnapshotResponseDto | null) {
  const normalizedSnapshot = normalizeMarketSnapshotResponse(snapshot);
  const fx = normalizedSnapshot?.fx;
  if (!fx) return null;
  const aliases = MARKET_SNAPSHOT_FIELD_ALIASES["fx.usdkrw"];

  if (Array.isArray(fx)) {
    return (
      fx.find((rate) => {
        const record = rate as Record<string, unknown>;
        const candidates = [
          rate.id,
          rate.label,
          rate.code,
          rate.name,
          rate.pair,
          rate.base && rate.quote ? `${rate.base}${rate.quote}` : null,
          rate.base && rate.quote ? `${rate.base}/${rate.quote}` : null,
          asText(record.symbol),
        ].map(normalizeMarketSnapshotToken);
        return aliases.some((alias) => candidates.includes(normalizeMarketSnapshotToken(alias)));
      }) ?? null
    );
  }

  const fxRecord = fx as Record<string, unknown>;
  const directValue = getRecordValueByNormalizedKey(fxRecord, aliases);
  return isMarketSnapshotRecord(directValue) ? (directValue as MarketSnapshotFxRateDto) : null;
}

export function getMarketSnapshotFlow(
  snapshot: MarketSnapshotResponseDto | null,
  key: "foreign" | "institutional",
) {
  const normalizedSnapshot = normalizeMarketSnapshotResponse(snapshot);
  const flows = normalizedSnapshot?.flows;
  if (!flows) return null;
  const aliases = MARKET_SNAPSHOT_FIELD_ALIASES[`flows.${key}`];

  if (Array.isArray(flows)) {
    return (
      flows.find((flow) => {
        const candidates = [
          flow.id,
          flow.name,
          flow.label,
          flow.market,
          flow.investor_type,
          flow.type,
        ].map(normalizeMarketSnapshotToken);
        return aliases.some((alias) => candidates.includes(normalizeMarketSnapshotToken(alias)));
      }) ?? null
    );
  }

  const flowsRecord = flows as Record<string, unknown>;
  const directValue = getRecordValueByNormalizedKey(flowsRecord, aliases);
  return isMarketSnapshotRecord(directValue) ? (directValue as MarketSnapshotFlowDto) : null;
}

export function getMarketSnapshotIndexLevel(index: MarketSnapshotIndexDto | null) {
  return readMarketSnapshotNumber(index?.level, index?.value, index?.close, index?.current, index?.price, index?.last, index?.last_price);
}

export function getMarketSnapshotIndexChange(index: MarketSnapshotIndexDto | null) {
  return readMarketSnapshotNumber(index?.change, index?.net_change, index?.point_change);
}

export function getMarketSnapshotIndexChangeRate(index: MarketSnapshotIndexDto | null) {
  return readMarketSnapshotNumber(
    index?.change_rate,
    index?.change_pct,
    index?.change_percent,
    index?.pct_change,
    index?.percent_change,
    index?.rate_change,
  );
}

export function getMarketSnapshotFxValue(fxRate: MarketSnapshotFxRateDto | null) {
  return readMarketSnapshotNumber(fxRate?.rate, fxRate?.value, fxRate?.close, fxRate?.current, fxRate?.price, fxRate?.last, fxRate?.last_price);
}

export function getMarketSnapshotFxChange(fxRate: MarketSnapshotFxRateDto | null) {
  return readMarketSnapshotNumber(fxRate?.change, fxRate?.net_change);
}

export function getMarketSnapshotFxChangeRate(fxRate: MarketSnapshotFxRateDto | null) {
  return readMarketSnapshotNumber(
    fxRate?.change_rate,
    fxRate?.change_pct,
    fxRate?.change_percent,
    fxRate?.pct_change,
    fxRate?.percent_change,
    fxRate?.rate_change,
  );
}

export function getMarketSnapshotFlowAmount(flow: MarketSnapshotFlowDto | null | undefined) {
  return readMarketSnapshotNumber(
    flow?.net_amount,
    flow?.net_buy_amount,
    flow?.net,
    flow?.net_buy,
    flow?.net_flow,
    flow?.net_purchase,
    flow?.amount,
    flow?.value,
  );
}

export function getMarketSnapshotSummaryLine(snapshot: MarketSnapshotResponseDto | null) {
  const summary = normalizeMarketSnapshotResponse(snapshot)?.summary;
  if (!summary) return null;
  if (typeof summary === "string") return summary.trim() || null;

  const bias = summary.market_bias?.trim() ?? "";
  const breadth = (summary.breadth_summary ?? summary.breadth ?? summary.market_breadth ?? "").trim();
  const line = summary.line?.trim() ?? "";

  if (line) return line;
  if (bias && breadth && bias !== breadth) return `${bias} · ${breadth}`;

  return bias || breadth || null;
}

function hasMarketSnapshotIndexData(snapshot: MarketSnapshotResponseDto | null, key: "kospi" | "kosdaq") {
  const index = getMarketSnapshotIndex(snapshot, key);
  return (
    getMarketSnapshotIndexLevel(index) !== null ||
    getMarketSnapshotIndexChange(index) !== null ||
    getMarketSnapshotIndexChangeRate(index) !== null
  );
}

function hasMarketSnapshotFxData(snapshot: MarketSnapshotResponseDto | null) {
  const fxRate = getMarketSnapshotFxRate(snapshot);
  return (
    getMarketSnapshotFxValue(fxRate) !== null ||
    getMarketSnapshotFxChange(fxRate) !== null ||
    getMarketSnapshotFxChangeRate(fxRate) !== null
  );
}

function hasMarketSnapshotFlowData(snapshot: MarketSnapshotResponseDto | null, key: "foreign" | "institutional") {
  const flow = getMarketSnapshotFlow(snapshot, key);
  return Boolean(flow?.summary?.trim() || flow?.direction?.trim() || getMarketSnapshotFlowAmount(flow) !== null);
}

function hasMarketSnapshotFieldData(snapshot: MarketSnapshotResponseDto | null, fieldId: MarketSnapshotFieldId) {
  if (fieldId === "indices.kospi") return hasMarketSnapshotIndexData(snapshot, "kospi");
  if (fieldId === "indices.kosdaq") return hasMarketSnapshotIndexData(snapshot, "kosdaq");
  if (fieldId === "fx.usdkrw") return hasMarketSnapshotFxData(snapshot);
  if (fieldId === "flows.foreign") return hasMarketSnapshotFlowData(snapshot, "foreign");
  if (fieldId === "flows.institutional") return hasMarketSnapshotFlowData(snapshot, "institutional");
  return Boolean(getMarketSnapshotSummaryLine(snapshot));
}

function hasAnyMarketSnapshotData(snapshot: MarketSnapshotResponseDto | null) {
  return (
    REQUIRED_MARKET_SNAPSHOT_FIELD_IDS.some((fieldId) => hasMarketSnapshotFieldData(snapshot, fieldId)) ||
    hasMarketSnapshotFieldData(snapshot, "summary")
  );
}

function getComputedMissingMarketSnapshotFields(snapshot: MarketSnapshotResponseDto | null) {
  return REQUIRED_MARKET_SNAPSHOT_FIELD_IDS.filter((fieldId) => !hasMarketSnapshotFieldData(snapshot, fieldId));
}

function resolveReportedMarketSnapshotMissingFields(snapshot: MarketSnapshotResponseDto | null) {
  const missingFields = normalizeMarketSnapshotResponse(snapshot)?.missing_fields ?? [];
  return missingFields
    .map((field) => field.trim())
    .filter(Boolean)
    .map((field) => {
      const fieldToken = normalizeMarketSnapshotToken(field);
      const knownField = (Object.keys(MARKET_SNAPSHOT_FIELD_ALIASES) as MarketSnapshotFieldId[]).find((fieldId) => {
        return MARKET_SNAPSHOT_FIELD_ALIASES[fieldId].some((alias) => normalizeMarketSnapshotToken(alias) === fieldToken);
      });
      return knownField ?? field;
    });
}

function getMarketSnapshotFieldLabel(field: MarketSnapshotFieldId | string, copy: DashboardLiveCopy) {
  const fieldToken = normalizeMarketSnapshotToken(field);

  for (const [fieldId, aliases] of Object.entries(MARKET_SNAPSHOT_FIELD_ALIASES) as Array<[MarketSnapshotFieldId, readonly string[]]>) {
    if (field === fieldId || aliases.some((alias) => normalizeMarketSnapshotToken(alias) === fieldToken)) {
      if (fieldId === "indices.kospi") return copy.marketOverview.kospi;
      if (fieldId === "indices.kosdaq") return copy.marketOverview.kosdaq;
      if (fieldId === "fx.usdkrw") return copy.marketOverview.usdKrw;
      if (fieldId === "flows.foreign") return copy.marketOverview.foreignFlow;
      if (fieldId === "flows.institutional") return copy.marketOverview.institutionalFlow;
      return copy.marketOverview.marketPosture;
    }
  }

  return field
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMarketSnapshotMissingFieldLabels(snapshot: MarketSnapshotResponseDto | null, copy: DashboardLiveCopy) {
  const computedMissing = getComputedMissingMarketSnapshotFields(snapshot);
  const reportedMissing = resolveReportedMarketSnapshotMissingFields(snapshot);
  const labels = [...computedMissing, ...reportedMissing].map((field) => getMarketSnapshotFieldLabel(field, copy));
  return [...new Set(labels)].filter(Boolean);
}

function normalizeMarketSnapshotStatus(status: string | null | undefined) {
  const normalizedStatus = normalizeMarketSnapshotToken(status ?? null);
  if (normalizedStatus === "ready" || normalizedStatus === "ok" || normalizedStatus === "complete") return "ready";
  if (normalizedStatus === "partial" || normalizedStatus === "degraded" || normalizedStatus === "incomplete") return "partial";
  if (normalizedStatus === "stale" || normalizedStatus === "cached") return "stale";
  if (normalizedStatus === "unavailable" || normalizedStatus === "missing" || normalizedStatus === "error") {
    return "unavailable";
  }
  return null;
}

function getMarketSnapshotStatusLabel(status: MarketSnapshotPresentationStatus, copy: DashboardLiveCopy) {
  if (status === "ready") return copy.marketOverview.snapshotReady;
  if (status === "partial") return copy.marketOverview.snapshotPartial;
  if (status === "stale") return copy.marketOverview.snapshotStale;
  return copy.marketOverview.snapshotUnavailable;
}

function getMarketSnapshotStatusTone(status: MarketSnapshotPresentationStatus): MarketSnapshotPresentationTone {
  if (status === "ready") return "positive";
  if (status === "partial") return "info";
  if (status === "stale") return "warning";
  return "warning";
}

export function buildMarketSnapshotPresentation(
  copy: DashboardLiveCopy,
  marketSnapshot: MarketSnapshotResponseDto | null,
  marketSnapshotError: string | null,
) {
  const displaySnapshot = normalizeMarketSnapshotResponse(marketSnapshot);
  const hasUsableData = hasAnyMarketSnapshotData(displaySnapshot);
  const normalizedPayloadStatus = normalizeMarketSnapshotStatus(displaySnapshot?.status);
  const reportedMissingFields = resolveReportedMarketSnapshotMissingFields(displaySnapshot);
  const computedMissingRequiredFields = getComputedMissingMarketSnapshotFields(displaySnapshot);
  const hasMissingFieldSignal = computedMissingRequiredFields.length > 0 || reportedMissingFields.length > 0;
  const status: MarketSnapshotPresentationStatus = !hasUsableData
    ? "unavailable"
    : marketSnapshotError
      ? "stale"
      : normalizedPayloadStatus === "stale"
        ? "stale"
        : normalizedPayloadStatus === "unavailable"
          ? "unavailable"
        : normalizedPayloadStatus === "partial" || hasMissingFieldSignal
          ? "partial"
          : "ready";
  const isReady = status === "ready";
  const missingFieldLabels = getMarketSnapshotMissingFieldLabels(displaySnapshot, copy);
  const staleReason = displaySnapshot?.stale_reason?.trim() || marketSnapshotError;
  const unavailableLabel = marketSnapshotError
    ? copy.marketOverview.snapshotDependencyPending
    : copy.marketOverview.snapshotWaiting;
  const fallbackContextLabel =
    status === "ready"
      ? copy.marketOverview.conditionNote
      : status === "partial"
        ? missingFieldLabels.length > 0
          ? `${copy.marketOverview.snapshotPartialContext} ${missingFieldLabels.join(", ")}`
          : copy.marketOverview.snapshotPartialContext
        : status === "stale"
          ? staleReason
            ? `${copy.marketOverview.snapshotStaleContext} ${staleReason}`
            : copy.marketOverview.snapshotStaleContext
          : unavailableLabel;

  return {
    displaySnapshot: status === "unavailable" ? null : displaySnapshot,
    fallbackContextLabel,
    isReady,
    missingFieldLabels,
    staleReason,
    status,
    statusLabel: getMarketSnapshotStatusLabel(status, copy),
    statusTone: getMarketSnapshotStatusTone(status),
  } satisfies {
    displaySnapshot: MarketSnapshotResponseDto | null;
    fallbackContextLabel: string;
    isReady: boolean;
    missingFieldLabels: string[];
    staleReason: string | null;
    status: MarketSnapshotPresentationStatus;
    statusLabel: string;
    statusTone: MarketSnapshotPresentationTone;
  };
}

export function getMarketSnapshotPollDelayMs({
  hadError,
  consecutiveErrorCount,
}: {
  hadError: boolean;
  consecutiveErrorCount: number;
}) {
  if (!hadError) return MARKET_SNAPSHOT_IDLE_POLL_MS;

  const normalizedErrorCount = Number.isFinite(consecutiveErrorCount)
    ? Math.max(1, Math.floor(consecutiveErrorCount))
    : 1;
  const retryIndex = normalizedErrorCount - 1;
  return MARKET_SNAPSHOT_ERROR_RETRY_DELAYS_MS[
    Math.min(retryIndex, MARKET_SNAPSHOT_ERROR_RETRY_DELAYS_MS.length - 1)
  ];
}

export function shouldTreatAgentFeedbackStopDisconnectAsAccepted(error: unknown) {
  const normalizedMessage = getDashboardLoadErrorMessage(error).trim().toLowerCase();
  return normalizedMessage === "fetch failed" || normalizedMessage === "failed to fetch";
}

export function markAgentFeedbackProgressStopped(
  progress: AgentFeedbackProgressResponseDto | null,
): AgentFeedbackProgressResponseDto | null {
  if (!progress) return null;

  return {
    ...progress,
    summary: {
      ...progress.summary,
      is_live: false,
      run_status: "stalled",
      run_table_status: "stalled",
      cycle_status: "stalled",
    },
  };
}

export function isOfflineTrackedPlaceholder(tracked: CoreTrackedQuotesResponse) {
  return (
    tracked.market_state === "offline-placeholder" ||
    tracked.items.some((item) => item.source === "mock" || item.fallback_reason === "offline_placeholder")
  );
}

function getFilterMarketDateNote(
  requestedMarketDate: string | null | undefined,
  effectiveMarketDate: string | null | undefined,
  isLatestFallback: boolean,
  copy: DashboardLiveCopy,
) {
  const requestedDate = typeof requestedMarketDate === "string" && requestedMarketDate.trim() ? requestedMarketDate : null;
  const effectiveDate = typeof effectiveMarketDate === "string" && effectiveMarketDate.trim() ? effectiveMarketDate : null;

  if (!effectiveDate) return null;

  if (requestedDate && requestedDate !== effectiveDate) {
    const resolvedLabel = isLatestFallback ? copy.piotroski.latestAvailableDate : copy.piotroski.resolvedDate;
    return `${copy.piotroski.requestedDate} ${requestedDate} · ${resolvedLabel} ${effectiveDate}`;
  }

  if (isLatestFallback) {
    return `${copy.piotroski.latestAvailableDate} ${effectiveDate}`;
  }

  return null;
}

function getFilteringStageStatus(
  loadState: FilteringStageLoadState,
  requestedMarketDate: string | null,
  isDailyProcessRunning: boolean,
): FilteringStageStatus {
  if (loadState === "ready") return "completed";
  if (loadState === "error") return "needs-review";
  if (isDailyProcessRunning && requestedMarketDate) return "waiting";
  return requestedMarketDate ? "pending" : "waiting";
}

function isDailyPipelineRunning(pipelineStatus: EodPipelineStatusResponseDto | null | undefined) {
  return normalizePipelineStatus(pipelineStatus?.status) === "running";
}

function getFilteringStageStatusLabel(status: FilteringStageStatus, copy: DashboardLiveCopy) {
  if (status === "completed") return copy.piotroski.completed;
  if (status === "loading") return copy.piotroski.loading;
  if (status === "needs-review") return copy.piotroski.needsReview;
  if (status === "pending") return copy.piotroski.pending;
  return copy.piotroski.waiting;
}

function getFilteringStageStatusTone(status: FilteringStageStatus): FilteringStageModel["statusTone"] {
  if (status === "completed") return "positive";
  if (status === "needs-review") return "warning";
  return "neutral";
}

function buildFilteringStageStatusModel({
  copy,
  displayMarketDate,
  loadState,
  requestedMarketDate,
  stageUnavailableMessage,
  stagePendingForDateMessage,
  stageMarketDatePendingMessage,
  stageError,
  isLatestFallback,
  isDailyProcessRunning,
}: {
  copy: DashboardLiveCopy;
  displayMarketDate: string | null;
  loadState: FilteringStageLoadState;
  requestedMarketDate: string | null;
  stageUnavailableMessage: string;
  stagePendingForDateMessage: string;
  stageMarketDatePendingMessage: string;
  stageError: string | null;
  isLatestFallback: boolean;
  isDailyProcessRunning: boolean;
}) {
  const status = getFilteringStageStatus(loadState, requestedMarketDate, isDailyProcessRunning);
  const statusLabel = getFilteringStageStatusLabel(status, copy);
  const statusTone = getFilteringStageStatusTone(status);
  const note =
    loadState === "error"
      ? stageError ?? stageUnavailableMessage
      : loadState === "ready"
        ? getFilterMarketDateNote(requestedMarketDate, displayMarketDate, isLatestFallback, copy)
        : requestedMarketDate
          ? stagePendingForDateMessage
          : stageMarketDatePendingMessage;

  return {
    note,
    status,
    statusLabel,
    statusTone,
  } satisfies Pick<FilteringStageModel, "note" | "status" | "statusLabel" | "statusTone">;
}

function buildFilteringMetric(key: string, label: string, value: string): FilteringStageMetric {
  return { key, label, value };
}

function getAgentFeedbackTargetSymbolCount(progress: AgentFeedbackProgressResponseDto | null | undefined) {
  const requestedSymbolsCount = progress?.request.symbols?.length;
  if (hasNumber(requestedSymbolsCount)) return requestedSymbolsCount;

  return progress?.summary.total_symbols ?? null;
}

function getFinalFilteredSymbolCount({
  agentFeedbackProgress,
  marketRiskStatus,
}: {
  agentFeedbackProgress: AgentFeedbackProgressResponseDto | null | undefined;
  marketRiskStatus: EodMarketRiskFiltersResponseDto | null;
}) {
  return getAgentFeedbackTargetSymbolCount(agentFeedbackProgress) ?? marketRiskStatus?.summary.passed_count ?? null;
}

function buildPiotroskiFilteringStageModel({
  copy,
  numberLocale,
  piotroskiStatus,
  piotroskiStatusError,
  piotroskiStatusLoadState,
  piotroskiMarketDate,
  isDailyProcessRunning,
}: {
  copy: DashboardLiveCopy;
  numberLocale: string;
  piotroskiStatus: EodPiotroskiFilterResultsResponseDto | null;
  piotroskiStatusError: string | null;
  piotroskiStatusLoadState: FilteringStageLoadState;
  piotroskiMarketDate: string | null;
  isDailyProcessRunning: boolean;
}): FilteringStageModel {
  const marketDateResolution = resolvePiotroskiMarketDateResolution(piotroskiStatus, piotroskiMarketDate);
  const displayMarketDate = marketDateResolution.effectiveMarketDate;
  const statusModel = buildFilteringStageStatusModel({
    copy,
    displayMarketDate,
    loadState: piotroskiStatusLoadState,
    requestedMarketDate: marketDateResolution.requestedMarketDate,
    stageUnavailableMessage: copy.piotroski.unavailable,
    stagePendingForDateMessage: copy.piotroski.pendingForDate,
    stageMarketDatePendingMessage: copy.piotroski.marketDatePending,
    stageError: piotroskiStatusError,
    isLatestFallback: marketDateResolution.isLatestFallback,
    isDailyProcessRunning,
  });
  const rawFilteredCountLabel = formatEodSymbolCount(piotroskiStatus?.summary.passed_count ?? null, numberLocale);
  const isWaitingFromRunning = (
    isDailyProcessRunning &&
    statusModel.status === "waiting" &&
    marketDateResolution.requestedMarketDate !== null
  );
  const filteredCountLabel = isWaitingFromRunning ? copy.piotroski.waiting : rawFilteredCountLabel;

  return {
    key: "piotroski",
    displayMarketDate,
    displayMarketDateLabel: displayMarketDate ?? UNKNOWN_LABEL,
    filteredCountLabel,
    label: copy.operational.piotroskiSectionTitle,
    metrics: [
      buildFilteringMetric(
        "filtered",
        copy.operational.filtered,
        filteredCountLabel,
      ),
    ],
    ...statusModel,
  };
}

function buildMarketRiskFilteringStageModel({
  copy,
  marketRiskStatus,
  marketRiskStatusError,
  marketRiskStatusLoadState,
  numberLocale,
  requestedMarketDate,
  isDailyProcessRunning,
}: {
  copy: DashboardLiveCopy;
  marketRiskStatus: EodMarketRiskFiltersResponseDto | null;
  marketRiskStatusError: string | null;
  marketRiskStatusLoadState: FilteringStageLoadState;
  numberLocale: string;
  requestedMarketDate: string | null;
  isDailyProcessRunning: boolean;
}): FilteringStageModel {
  const marketDateResolution = resolvePiotroskiMarketDateResolution(marketRiskStatus, requestedMarketDate);
  const displayMarketDate = marketDateResolution.effectiveMarketDate;
  const statusModel = buildFilteringStageStatusModel({
    copy,
    displayMarketDate,
    loadState: marketRiskStatusLoadState,
    requestedMarketDate: marketDateResolution.requestedMarketDate,
    stageUnavailableMessage: copy.marketRisk.unavailable,
    stagePendingForDateMessage: copy.marketRisk.pendingForDate,
    stageMarketDatePendingMessage: copy.marketRisk.marketDatePending,
    stageError: marketRiskStatusError,
    isLatestFallback: marketDateResolution.isLatestFallback,
    isDailyProcessRunning,
  });
  const rawFilteredCountLabel = formatEodSymbolCount(marketRiskStatus?.summary.passed_count ?? null, numberLocale);
  const isWaitingFromRunning = (
    isDailyProcessRunning &&
    statusModel.status === "waiting" &&
    marketDateResolution.requestedMarketDate !== null
  );
  const filteredCountLabel = isWaitingFromRunning ? copy.piotroski.waiting : rawFilteredCountLabel;

  return {
    key: "kis-risk",
    displayMarketDate,
    displayMarketDateLabel: displayMarketDate ?? UNKNOWN_LABEL,
    filteredCountLabel,
    label: copy.operational.kisRiskSectionTitle,
    metrics: [
      buildFilteringMetric(
        "filtered",
        copy.operational.filtered,
        filteredCountLabel,
      ),
    ],
    ...statusModel,
  };
}

export function buildFilteringCardModel({
  agentFeedbackProgress,
  copy,
  marketRiskStatus,
  marketRiskStatusError,
  marketRiskStatusLoadState,
  pipelineStatus,
  numberLocale,
  piotroskiMarketDate,
  piotroskiStatus,
  piotroskiStatusError,
  piotroskiStatusLoadState,
}: {
  agentFeedbackProgress?: AgentFeedbackProgressResponseDto | null;
  copy: DashboardLiveCopy;
  marketRiskStatus: EodMarketRiskFiltersResponseDto | null;
  marketRiskStatusError: string | null;
  marketRiskStatusLoadState: FilteringStageLoadState;
  pipelineStatus?: EodPipelineStatusResponseDto | null;
  numberLocale: string;
  piotroskiMarketDate: string | null;
  piotroskiStatus: EodPiotroskiFilterResultsResponseDto | null;
  piotroskiStatusError: string | null;
  piotroskiStatusLoadState: FilteringStageLoadState;
}): FilteringCardModel {
  const piotroskiStage = buildPiotroskiFilteringStageModel({
    copy,
    numberLocale,
    piotroskiStatus,
    piotroskiStatusError,
    piotroskiStatusLoadState,
    piotroskiMarketDate,
    isDailyProcessRunning: isDailyPipelineRunning(pipelineStatus),
  });
  const marketRiskStage = buildMarketRiskFilteringStageModel({
    copy,
    marketRiskStatus,
    marketRiskStatusError,
    marketRiskStatusLoadState,
    numberLocale,
    isDailyProcessRunning: isDailyPipelineRunning(pipelineStatus),
    requestedMarketDate: piotroskiMarketDate,
  });
  const finalFilteredCountLabel = formatEodSymbolCount(
    getFinalFilteredSymbolCount({ agentFeedbackProgress, marketRiskStatus }),
    numberLocale,
  );

  return {
    finalFilteredCountLabel,
    piotroskiDisplayMarketDate: piotroskiStage.displayMarketDate,
    stages: [piotroskiStage, marketRiskStage],
  };
}

function buildWaitingFilteringStageModel(
  stage: FilteringStageModel,
  copy: DashboardLiveCopy,
): FilteringStageModel {
  return {
    ...stage,
    displayMarketDate: null,
    displayMarketDateLabel: UNKNOWN_LABEL,
    filteredCountLabel: copy.piotroski.waiting,
    metrics: stage.metrics.map((metric) => ({
      ...metric,
      value: copy.piotroski.waiting,
    })),
    note: copy.piotroski.waiting,
    status: "waiting",
    statusLabel: getFilteringStageStatusLabel("waiting", copy),
    statusTone: "neutral",
  };
}

export function maskFilteringCardModelAsWaiting(
  model: FilteringCardModel,
  copy: DashboardLiveCopy,
): FilteringCardModel {
  return {
    finalFilteredCountLabel: copy.piotroski.waiting,
    piotroskiDisplayMarketDate: null,
    stages: [
      buildWaitingFilteringStageModel(model.stages[0], copy),
      buildWaitingFilteringStageModel(model.stages[1], copy),
    ],
  };
}

export function isFilteringCardChecking(model: FilteringCardModel) {
  return model.stages.some((stage) => stage.status === "loading");
}

function getScoringStageLabel(stageKey: ScoringStageKey, copy: DashboardLiveCopy) {
  if (stageKey === "unified-value") return copy.scoring.stages.unifiedValue;
  if (stageKey === "quality") return copy.scoring.stages.quality;
  return copy.scoring.stages.momentum;
}

type ScoringStageResultSummary = {
  displayMarketDate: string | null;
  error: string | null;
  hasResult: boolean;
  isLatestFallback: boolean;
  loadState: FilteringStageLoadState;
  metrics: ScoringStageMetric[];
  progressLabel: string;
  requestedMarketDate: string | null;
};

function getFactorInspectItems<TItem extends { symbol: string }>(
  response: {
    item?: TItem | null;
    items?: TItem[] | null;
  } | null,
) {
  const itemsBySymbol = new Map<string, TItem>();

  if (response?.item) {
    itemsBySymbol.set(response.item.symbol.trim().toUpperCase(), response.item);
  }

  for (const item of response?.items ?? []) {
    itemsBySymbol.set(item.symbol.trim().toUpperCase(), item);
  }

  return Array.from(itemsBySymbol.values());
}

function getScoringResultDateResolution(
  response: {
    market_date?: string | null;
    requested_market_date?: string | null;
    resolved_market_date?: string | null;
    is_latest_fallback?: boolean | null;
  } | null,
  requestedMarketDate: string | null,
) {
  return resolvePiotroskiMarketDateResolution(response, requestedMarketDate);
}

function getScoringCountProgressLabel(
  processedCount: number | null | undefined,
  totalCount: number | null | undefined,
  numberLocale: string,
) {
  if (hasNumber(processedCount) && hasNumber(totalCount)) {
    return buildProcessMonitorProgressLabel(processedCount, totalCount, numberLocale);
  }
  if (hasNumber(processedCount)) return processedCount.toLocaleString(numberLocale);
  if (hasNumber(totalCount)) return `0 / ${totalCount.toLocaleString(numberLocale)}`;
  return UNKNOWN_LABEL;
}

function addScoringCountMetric(
  metrics: ScoringStageMetric[],
  key: string,
  label: string,
  value: number | null | undefined,
  numberLocale: string,
) {
  if (!hasNumber(value) || value <= 0) return;
  metrics.push(buildScoringMetric(key, label, value.toLocaleString(numberLocale)));
}

function buildBaseScoringResultSummary({
  displayMarketDate,
  error,
  isLatestFallback,
  loadState,
  metrics,
  processedCount,
  requestedMarketDate,
  totalCount,
}: {
  displayMarketDate: string | null;
  error: string | null;
  isLatestFallback: boolean;
  loadState: FilteringStageLoadState;
  metrics: ScoringStageMetric[];
  processedCount: number | null;
  requestedMarketDate: string | null;
  totalCount: number | null;
}): ScoringStageResultSummary {
  return {
    displayMarketDate,
    error,
    hasResult: hasCompletedScoringResult({
      loadState,
      processedCount,
      totalCount,
    }),
    isLatestFallback,
    loadState,
    metrics,
    progressLabel: metrics[0]?.value ?? UNKNOWN_LABEL,
    requestedMarketDate,
  };
}

function buildUnifiedValueScoringResultSummary({
  copy,
  numberLocale,
  requestedMarketDate,
  response,
  responseError,
  responseLoadState,
}: {
  copy: DashboardLiveCopy;
  numberLocale: string;
  requestedMarketDate: string | null;
  response: EodValueFactorsResponseDto | null;
  responseError: string | null;
  responseLoadState: FilteringStageLoadState;
}): ScoringStageResultSummary {
  const resolution = getScoringResultDateResolution(response, requestedMarketDate);
  const scoredCount = response?.summary.scored_count ?? null;
  const totalCount = response?.summary.entries ?? null;
  const metrics = [
    buildScoringMetric(
      "progress",
      copy.processMonitor.progress,
      getScoringCountProgressLabel(scoredCount, totalCount, numberLocale),
    ),
  ];

  addScoringCountMetric(
    metrics,
    "invalid",
    copy.scoring.metrics.invalid,
    response?.summary.invalid_per_count,
    numberLocale,
  );
  addScoringCountMetric(
    metrics,
    "missing",
    copy.scoring.metrics.missing,
    response?.summary.missing_metric_count,
    numberLocale,
  );

  return buildBaseScoringResultSummary({
    displayMarketDate: resolution.effectiveMarketDate,
    error: responseError,
    isLatestFallback: resolution.isLatestFallback,
    loadState: responseLoadState,
    metrics,
    processedCount: scoredCount,
    requestedMarketDate: resolution.requestedMarketDate,
    totalCount,
  });
}

function summarizeQualityScoringRows(items: EodValueFactorItemDto[]) {
  return items.reduce(
    (summary, item) => {
      const quality = buildFactorQualitySummary(item);
      if (!quality?.hasQualityFields) return summary;

      if (quality.calculationState === "complete") summary.completeCount += 1;
      if (quality.calculationState === "partial") summary.partialCount += 1;
      if (quality.calculationState !== "unavailable") summary.scoredCount += 1;
      return summary;
    },
    {
      completeCount: 0,
      partialCount: 0,
      scoredCount: 0,
    },
  );
}

function buildQualityScoringResultSummary({
  copy,
  numberLocale,
  requestedMarketDate,
  response,
  responseError,
  responseLoadState,
}: {
  copy: DashboardLiveCopy;
  numberLocale: string;
  requestedMarketDate: string | null;
  response: EodValueFactorsResponseDto | null;
  responseError: string | null;
  responseLoadState: FilteringStageLoadState;
}): ScoringStageResultSummary {
  const resolution = getScoringResultDateResolution(response, requestedMarketDate);
  const items = response ? getFactorInspectItems(response) : [];
  const qualitySummary = summarizeQualityScoringRows(items);
  const totalCount = response?.summary.entries ?? (items.length > 0 ? items.length : null);
  const scoredCount = response ? qualitySummary.scoredCount : null;
  const missingCount = hasNumber(totalCount) ? Math.max(totalCount - qualitySummary.scoredCount, 0) : null;
  const metrics = [
    buildScoringMetric(
      "progress",
      copy.processMonitor.progress,
      getScoringCountProgressLabel(scoredCount, totalCount, numberLocale),
    ),
  ];

  addScoringCountMetric(
    metrics,
    "complete",
    copy.agentFeedback.metrics.complete,
    qualitySummary.completeCount,
    numberLocale,
  );
  addScoringCountMetric(metrics, "partial", copy.scoring.metrics.partial, qualitySummary.partialCount, numberLocale);
  addScoringCountMetric(metrics, "missing", copy.scoring.metrics.missing, missingCount, numberLocale);

  return {
    ...buildBaseScoringResultSummary({
      displayMarketDate: resolution.effectiveMarketDate,
      error: responseError,
      isLatestFallback: resolution.isLatestFallback,
      loadState: responseLoadState,
      metrics,
      processedCount: scoredCount,
      requestedMarketDate: resolution.requestedMarketDate,
      totalCount,
    }),
  };
}

function buildMomentumScoringResultSummary({
  copy,
  numberLocale,
  requestedMarketDate,
  response,
  responseError,
  responseLoadState,
}: {
  copy: DashboardLiveCopy;
  numberLocale: string;
  requestedMarketDate: string | null;
  response: EodMomentumFactorsResponseDto | null;
  responseError: string | null;
  responseLoadState: FilteringStageLoadState;
}): ScoringStageResultSummary {
  const resolution = getScoringResultDateResolution(response, requestedMarketDate);
  const rankedCount = response?.summary.ranked_symbols ?? null;
  const totalCount = response?.summary.entries ?? null;
  const metrics = [
    buildScoringMetric(
      "progress",
      copy.processMonitor.progress,
      getScoringCountProgressLabel(rankedCount, totalCount, numberLocale),
    ),
  ];

  addScoringCountMetric(
    metrics,
    "eligible",
    copy.scoring.metrics.eligible,
    response?.summary.eligible_symbols,
    numberLocale,
  );

  return buildBaseScoringResultSummary({
    displayMarketDate: resolution.effectiveMarketDate,
    error: responseError,
    isLatestFallback: resolution.isLatestFallback,
    loadState: responseLoadState,
    metrics,
    processedCount: rankedCount,
    requestedMarketDate: resolution.requestedMarketDate,
    totalCount,
  });
}

function isProblemPipelineStageStatus(normalizedStatus: string | null) {
  return (
    normalizedStatus !== null &&
    [
      "failed",
      "error",
      "partial",
      "needs review",
      "needs-review",
      "needs_review",
      "completed with errors",
      "completed-with-errors",
      "completed_with_errors",
    ].includes(normalizedStatus)
  );
}

function shouldUsePipelineScoringStage(pipelineStage: EodPipelineStageDto | null | undefined) {
  const normalizedStatus = normalizePipelineStageStatus(pipelineStage);
  return (
    isRunningPipelineStage(pipelineStage) ||
    isCompletedPipelineStage(pipelineStage) ||
    isProblemPipelineStageStatus(normalizedStatus) ||
    hasNumber(pipelineStage?.processed) ||
    hasNumber(pipelineStage?.total) ||
    (hasNumber(pipelineStage?.failed) && pipelineStage.failed > 0)
  );
}

function getScoringStageStatus(
  pipelineStage: EodPipelineStageDto | null | undefined,
  requestedMarketDate: string | null,
  resultSummary: ScoringStageResultSummary,
): ScoringStageStatus {
  if (shouldUsePipelineScoringStage(pipelineStage)) {
    if (isRunningPipelineStage(pipelineStage)) return "loading";
    if (isCompletedPipelineStage(pipelineStage)) return "completed";

    if (isProblemPipelineStageStatus(normalizePipelineStageStatus(pipelineStage))) {
      return "needs-review";
    }
    if (hasNumber(pipelineStage?.failed) && pipelineStage.failed > 0) return "needs-review";
  }

  if (resultSummary.loadState === "error") return "needs-review";
  if (resultSummary.hasResult) return "completed";

  return requestedMarketDate ? "pending" : "waiting";
}

function getScoringStageStatusLabel(status: ScoringStageStatus, copy: DashboardLiveCopy) {
  if (status === "completed") return copy.scoring.statuses.completed;
  if (status === "loading") return copy.scoring.statuses.running;
  if (status === "needs-review") return copy.scoring.statuses.needsReview;
  if (status === "pending") return copy.scoring.statuses.pending;
  return copy.scoring.statuses.waiting;
}

function getScoringStageStatusTone(status: ScoringStageStatus): ScoringStageModel["statusTone"] {
  if (status === "completed") return "positive";
  if (status === "needs-review") return "warning";
  return "neutral";
}

function buildScoringMetric(key: string, label: string, value: string): ScoringStageMetric {
  return { key, label, value };
}

function getScoringProgressLabel(
  pipelineStage: EodPipelineStageDto | null | undefined,
  numberLocale: string,
  resultSummary: ScoringStageResultSummary,
) {
  if (!shouldUsePipelineScoringStage(pipelineStage)) return resultSummary.progressLabel;

  const processedCount = pipelineStage?.processed;
  const totalCount = pipelineStage?.total;

  if (hasNumber(processedCount) && hasNumber(totalCount)) {
    return buildProcessMonitorProgressLabel(processedCount, totalCount, numberLocale);
  }
  if (hasNumber(processedCount)) return processedCount.toLocaleString(numberLocale);
  if (hasNumber(totalCount)) return `0 / ${totalCount.toLocaleString(numberLocale)}`;

  return UNKNOWN_LABEL;
}

function getPipelineActivityLabel(pipelineStage: EodPipelineStageDto | null | undefined) {
  const currentStep = formatPipelineDetailText(pipelineStage?.current_step);
  const currentActivity = formatPipelineDetailText(pipelineStage?.current_activity);
  const currentSymbol = pipelineStage?.current_symbol?.trim() || null;
  const titleParts = [currentStep, currentActivity, currentSymbol ? `Symbol ${currentSymbol}` : null].filter(Boolean);

  return titleParts.length > 0 ? titleParts.join(" · ") : null;
}

function getScoringStageNote(
  status: ScoringStageStatus,
  pipelineStage: EodPipelineStageDto | null | undefined,
  copy: DashboardLiveCopy,
  resultSummary: ScoringStageResultSummary,
) {
  const dateNote = getFilterMarketDateNote(
    resultSummary.requestedMarketDate,
    resultSummary.displayMarketDate,
    resultSummary.isLatestFallback,
    copy,
  );
  const baseNote =
    status === "completed"
      ? copy.scoring.notes.completed
      : status === "loading"
        ? (() => {
            const activityLabel = getPipelineActivityLabel(pipelineStage);
            return activityLabel ? `${copy.scoring.notes.running} ${activityLabel}` : copy.scoring.notes.running;
          })()
        : status === "needs-review"
          ? (resultSummary.error ?? copy.scoring.notes.needsReview)
          : status === "pending"
            ? copy.scoring.notes.pending
            : copy.scoring.notes.waiting;

  return [baseNote, dateNote].filter(Boolean).join(" ");
}

function getScoringStageMetrics(
  pipelineStage: EodPipelineStageDto | null | undefined,
  progressLabel: string,
  resultSummary: ScoringStageResultSummary,
  copy: DashboardLiveCopy,
  numberLocale: string,
) {
  if (!shouldUsePipelineScoringStage(pipelineStage)) return resultSummary.metrics;

  const metrics = [
    buildScoringMetric("progress", copy.processMonitor.progress, progressLabel),
  ];
  const failedCount = pipelineStage?.failed;

  if (hasNumber(failedCount)) {
    metrics.push(buildScoringMetric("failed", copy.operational.failed, failedCount.toLocaleString(numberLocale)));
  }

  return metrics;
}

function getScoringStageDisplayMarketDate(
  pipelineStage: EodPipelineStageDto | null | undefined,
  requestedMarketDate: string | null,
  resultSummary: ScoringStageResultSummary,
) {
  if (shouldUsePipelineScoringStage(pipelineStage)) return requestedMarketDate;
  return getFirstTextValue(resultSummary.displayMarketDate, requestedMarketDate);
}

function getScoringStageResultSummary(
  stageKey: ScoringStageKey,
  summaries: Record<ScoringStageKey, ScoringStageResultSummary>,
) {
  return summaries[stageKey];
}

function getScoringStageFallbackResultSummary(
  requestedMarketDate: string | null,
  copy: DashboardLiveCopy,
): ScoringStageResultSummary {
  return {
    displayMarketDate: requestedMarketDate,
    error: null,
    hasResult: false,
    isLatestFallback: false,
    loadState: "idle",
    metrics: [buildScoringMetric("progress", copy.processMonitor.progress, UNKNOWN_LABEL)],
    progressLabel: UNKNOWN_LABEL,
    requestedMarketDate,
  };
}

function buildScoringStageResultSummaries({
  copy,
  numberLocale,
  requestedMarketDate,
  scoringMomentumFactors,
  scoringMomentumFactorsError,
  scoringMomentumFactorsLoadState,
  scoringValueFactors,
  scoringValueFactorsError,
  scoringValueFactorsLoadState,
}: {
  copy: DashboardLiveCopy;
  numberLocale: string;
  requestedMarketDate: string | null;
  scoringMomentumFactors: EodMomentumFactorsResponseDto | null;
  scoringMomentumFactorsError: string | null;
  scoringMomentumFactorsLoadState: FilteringStageLoadState;
  scoringValueFactors: EodValueFactorsResponseDto | null;
  scoringValueFactorsError: string | null;
  scoringValueFactorsLoadState: FilteringStageLoadState;
}): Record<ScoringStageKey, ScoringStageResultSummary> {
  const fallback = getScoringStageFallbackResultSummary(requestedMarketDate, copy);

  return {
    "unified-value": scoringValueFactors || scoringValueFactorsLoadState !== "idle"
      ? buildUnifiedValueScoringResultSummary({
          copy,
          numberLocale,
          requestedMarketDate,
          response: scoringValueFactors,
          responseError: scoringValueFactorsError,
          responseLoadState: scoringValueFactorsLoadState,
        })
      : fallback,
    quality: scoringValueFactors || scoringValueFactorsLoadState !== "idle"
      ? buildQualityScoringResultSummary({
          copy,
          numberLocale,
          requestedMarketDate,
          response: scoringValueFactors,
          responseError: scoringValueFactorsError,
          responseLoadState: scoringValueFactorsLoadState,
        })
      : fallback,
    momentum: scoringMomentumFactors || scoringMomentumFactorsLoadState !== "idle"
      ? buildMomentumScoringResultSummary({
          copy,
          numberLocale,
          requestedMarketDate,
          response: scoringMomentumFactors,
          responseError: scoringMomentumFactorsError,
          responseLoadState: scoringMomentumFactorsLoadState,
        })
      : fallback,
  };
}

function buildScoringStageModel({
  copy,
  forceWaiting,
  numberLocale,
  pipelineStage,
  requestedMarketDate,
  resultSummary,
  stageKey,
  isDailyProcessRunning,
}: {
  copy: DashboardLiveCopy;
  forceWaiting: boolean;
  numberLocale: string;
  pipelineStage: EodPipelineStageDto | null | undefined;
  requestedMarketDate: string | null;
  resultSummary: ScoringStageResultSummary;
  stageKey: ScoringStageKey;
  isDailyProcessRunning: boolean;
}): ScoringStageModel {
  const baseStatus = getScoringStageStatus(pipelineStage, requestedMarketDate, resultSummary);
  const isWaitingFromRunning = isDailyProcessRunning && requestedMarketDate !== null && baseStatus === "pending";
  const shouldForceWaiting = forceWaiting || isWaitingFromRunning;
  const displayMarketDate = shouldForceWaiting
    ? null
    : getScoringStageDisplayMarketDate(pipelineStage, requestedMarketDate, resultSummary);
  const status = shouldForceWaiting ? "waiting" : baseStatus;
  const progressLabel = shouldForceWaiting
    ? copy.scoring.statuses.waiting
    : getScoringProgressLabel(pipelineStage, numberLocale, resultSummary);
  const metrics = shouldForceWaiting
    ? [buildScoringMetric("progress", copy.processMonitor.progress, copy.scoring.statuses.waiting)]
    : getScoringStageMetrics(pipelineStage, progressLabel, resultSummary, copy, numberLocale);

  return {
    key: stageKey,
    displayMarketDate,
    displayMarketDateLabel: displayMarketDate ?? UNKNOWN_LABEL,
    label: getScoringStageLabel(stageKey, copy),
    metrics,
    note: shouldForceWaiting ? copy.scoring.notes.waiting : getScoringStageNote(status, pipelineStage, copy, resultSummary),
    progressLabel,
    status,
    statusLabel: getScoringStageStatusLabel(status, copy),
    statusTone: getScoringStageStatusTone(status),
  };
}

export function buildScoringCardModel({
  copy,
  forceWaiting = false,
  numberLocale,
  pipelineStatus,
  scoringMomentumFactors = null,
  scoringMomentumFactorsError = null,
  scoringMomentumFactorsLoadState = "idle",
  scoringMarketDate,
  scoringValueFactors = null,
  scoringValueFactorsError = null,
  scoringValueFactorsLoadState = "idle",
}: {
  copy: DashboardLiveCopy;
  forceWaiting?: boolean;
  numberLocale: string;
  pipelineStatus: EodPipelineStatusResponseDto | null;
  scoringMomentumFactors?: EodMomentumFactorsResponseDto | null;
  scoringMomentumFactorsError?: string | null;
  scoringMomentumFactorsLoadState?: FilteringStageLoadState;
  scoringMarketDate: string | null;
  scoringValueFactors?: EodValueFactorsResponseDto | null;
  scoringValueFactorsError?: string | null;
  scoringValueFactorsLoadState?: FilteringStageLoadState;
}): ScoringCardModel {
  const requestedMarketDate = getFirstTextValue(pipelineStatus?.market_date, scoringMarketDate);
  const resultSummaries = buildScoringStageResultSummaries({
    copy,
    numberLocale,
    requestedMarketDate,
    scoringMomentumFactors,
    scoringMomentumFactorsError,
    scoringMomentumFactorsLoadState,
    scoringValueFactors,
    scoringValueFactorsError,
    scoringValueFactorsLoadState,
  });

  return {
    stages: SCORING_STAGE_DEFINITIONS.map((stage) =>
      buildScoringStageModel({
        copy,
        forceWaiting,
        numberLocale,
        pipelineStage: getScoringPipelineStage(pipelineStatus, stage),
        requestedMarketDate,
        resultSummary: getScoringStageResultSummary(stage.key, resultSummaries),
        stageKey: stage.key,
        isDailyProcessRunning: normalizePipelineStatus(pipelineStatus?.status) === "running",
      }),
    ),
  };
}

function getScoringPipelineStage(
  pipelineStatus: EodPipelineStatusResponseDto | null,
  stage: ScoringStagePipelineDefinition,
) {
  return (
    getPipelineStage(pipelineStatus, stage.pipelineKey) ??
    stage.fallbackPipelineKeys
      .map((pipelineKey) => getPipelineStage(pipelineStatus, pipelineKey))
      .find((pipelineStage): pipelineStage is EodPipelineStageDto => pipelineStage !== null) ??
    null
  );
}

export function isScoringCardChecking(model: ScoringCardModel) {
  return model.stages.some((stage) => stage.status === "loading");
}

export function getDailyProcessDependencyWaitState({
  eodStageCards,
  filteringCardModel,
  pipelineStatus,
  scoringCardModel,
}: {
  eodStageCards: readonly EodStageCard[];
  filteringCardModel: FilteringCardModel;
  pipelineStatus: EodPipelineStatusResponseDto | null;
  scoringCardModel: ScoringCardModel;
}) {
  const waitForFiltering = isEodProcessChecking(pipelineStatus, eodStageCards);
  const filteringChecking = !waitForFiltering && isFilteringCardChecking(filteringCardModel);
  const waitForScoring = waitForFiltering || filteringChecking;
  const scoringChecking = !waitForScoring && isScoringCardChecking(scoringCardModel);

  return {
    filteringChecking,
    scoringChecking,
    waitForAgentFeedback: waitForScoring || scoringChecking,
    waitForFiltering,
    waitForScoring,
  };
}

function getProcessMonitorStatusLabel(status: ProcessMonitorStatus, copy: DashboardLiveCopy) {
  return copy.processMonitor.statuses[status];
}

function parseProcessMonitorNumber(value: string | null | undefined) {
  if (!hasTextValue(value)) return null;

  const normalizedValue = value.replace(/[^\d.-]/g, "");
  if (!normalizedValue) return null;

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function getProcessMonitorProgressPercentFromLabel(value: string | null | undefined) {
  if (!hasTextValue(value) || !value.includes("/")) return null;

  const [completedRaw, totalRaw] = value.split("/");
  const completed = parseProcessMonitorNumber(completedRaw);
  const total = parseProcessMonitorNumber(totalRaw);
  if (!hasNumber(completed) || !hasNumber(total) || total <= 0) return null;

  return clampAgentProgressPercent((completed / total) * 100);
}

function getProcessMonitorStatusProgressPercent(status: ProcessMonitorStatus) {
  switch (status) {
    case "completed":
      return 100;
    case "partial":
      return 70;
    case "running":
      return 40;
    case "retry":
      return 25;
    case "pending":
    case "error":
      return 0;
  }
}

function getEodProcessMonitorProgressPercent(status: ProcessMonitorStatus, countedProgressPercent: number | null) {
  if (status === "running") return getProcessMonitorStatusProgressPercent(status);
  return countedProgressPercent ?? getProcessMonitorStatusProgressPercent(status);
}

function buildProcessMonitorProgressLabel(completedCount: number, totalCount: number, numberLocale: string) {
  return `${completedCount.toLocaleString(numberLocale)} / ${totalCount.toLocaleString(numberLocale)}`;
}

function hasPositiveProcessMetric(metrics: readonly ProcessMonitorMetric[], key: string) {
  const metric = metrics.find((item) => item.key === key);
  const count = parseProcessMonitorNumber(metric?.value);
  return hasNumber(count) && count > 0;
}

function getEodProcessMonitorStepStatus(stage: EodStageCard): ProcessMonitorStatus {
  if (stage.statusLabel === "running") return "running";

  const failedCount = parseProcessMonitorNumber(stage.details.find((detail) => detail.key === "failed")?.value);
  if (hasNumber(failedCount) && failedCount > 0) {
    return stage.statusLabel === "synced" ? "partial" : "error";
  }

  if (stage.statusLabel === "synced") return "completed";
  if (stage.statusLabel === "break day") return "pending";
  return "pending";
}

function buildEodProcessMonitorStep(stage: EodStageCard, copy: DashboardLiveCopy): ProcessMonitorStep {
  const metrics = stage.details.map((detail) => ({
    key: detail.key,
    label: detail.label || copy.processMonitor.progress,
    value: detail.value,
  }));
  const status = getEodProcessMonitorStepStatus(stage);
  const progressLabel = stage.details.find((detail) => detail.key === "count")?.value ?? UNKNOWN_LABEL;
  const countedProgressPercent = getProcessMonitorProgressPercentFromLabel(progressLabel);

  return {
    key: stage.id,
    label: stage.label,
    status,
    statusLabel: getProcessMonitorStatusLabel(status, copy),
    progressLabel,
    progressPercent: getEodProcessMonitorProgressPercent(status, countedProgressPercent),
    metrics,
    note: stage.statusBadgeTitle,
  };
}

function getFilteringProcessMonitorStepStatus(stage: FilteringStageModel): ProcessMonitorStatus {
  const normalizedNote = stage.note?.trim().toLowerCase() ?? "";

  if (/\bretry\b|\bretrying\b|재시도/.test(normalizedNote)) {
    return "retry";
  }
  if (stage.status === "loading") return "running";
  if (stage.status === "needs-review") return "error";
  if (stage.status === "completed") return "completed";
  return "pending";
}

function buildFilteringProcessMonitorStep(
  stage: FilteringStageModel,
  copy: DashboardLiveCopy,
): ProcessMonitorStep {
  const status = getFilteringProcessMonitorStepStatus(stage);
  const metrics = stage.metrics.map((metric) => ({
    key: metric.key,
    label: metric.label,
    value: metric.value,
  }));

  return {
    key: stage.key,
    label: stage.label,
    status,
    statusLabel: getProcessMonitorStatusLabel(status, copy),
    progressLabel: stage.filteredCountLabel,
    progressPercent: getProcessMonitorStatusProgressPercent(status),
    metrics,
    note: stage.note,
  };
}

function getScoringProcessMonitorStepStatus(stage: ScoringStageModel): ProcessMonitorStatus {
  if (stage.status === "loading") return "running";
  if (stage.status === "needs-review") return "error";
  if (stage.status === "completed") return "completed";
  return "pending";
}

function buildScoringProcessMonitorStep(stage: ScoringStageModel, copy: DashboardLiveCopy): ProcessMonitorStep {
  const status = getScoringProcessMonitorStepStatus(stage);
  const metrics = stage.metrics.map((metric) => ({
    key: metric.key,
    label: metric.label,
    value: metric.value,
  }));

  return {
    key: stage.key,
    label: stage.label,
    status,
    statusLabel: getProcessMonitorStatusLabel(status, copy),
    progressLabel: stage.progressLabel,
    progressPercent: getProcessMonitorProgressPercentFromLabel(stage.progressLabel)
      ?? getProcessMonitorStatusProgressPercent(status),
    metrics,
    note: stage.note,
  };
}

function getAgentProcessMonitorStepStatus(role: AgentRoleCard): ProcessMonitorStatus {
  if (role.status === "running") return "running";
  if (role.status === "pending") return "pending";
  if (role.status === "attention") return "error";

  if (hasPositiveProcessMetric(role.metrics, "errors")) {
    return hasPositiveProcessMetric(role.metrics, "completed") ? "partial" : "error";
  }

  return "completed";
}

function buildAgentProcessMonitorStep(role: AgentRoleCard, copy: DashboardLiveCopy): ProcessMonitorStep {
  const status = getAgentProcessMonitorStepStatus(role);
  const metrics = role.metrics.map((metric) => ({
    key: metric.key,
    label: metric.label,
    value: metric.value,
  }));

  return {
    key: role.role,
    label: role.label,
    status,
    statusLabel: getProcessMonitorStatusLabel(status, copy),
    progressLabel: role.progressLabel,
    progressPercent: role.progressPercent,
    metrics,
    note: null,
  };
}

function getProcessMonitorAggregateStatus(steps: readonly ProcessMonitorStep[]): ProcessMonitorStatus {
  if (steps.some((step) => step.status === "error")) return "error";
  if (steps.some((step) => step.status === "retry")) return "retry";
  if (steps.some((step) => step.status === "running")) return "running";
  if (steps.some((step) => step.status === "partial")) return "partial";
  if (steps.length > 0 && steps.every((step) => step.status === "completed")) return "completed";
  return "pending";
}

function getProcessMonitorCurrentStep(steps: readonly ProcessMonitorStep[]) {
  return (
    steps.find((step) => step.status === "error") ??
    steps.find((step) => step.status === "retry") ??
    steps.find((step) => step.status === "running") ??
    steps.find((step) => step.status === "partial") ??
    steps.find((step) => step.status === "pending") ??
    null
  );
}

function getProcessMonitorCompletedCount(steps: readonly ProcessMonitorStep[]) {
  return steps.filter((step) => step.status === "completed").length;
}

function getProcessMonitorGroupProgressPercent(steps: readonly ProcessMonitorStep[]) {
  if (steps.length === 0) return 0;
  const totalProgress = steps.reduce((sum, step) => sum + step.progressPercent, 0);
  return clampAgentProgressPercent(totalProgress / steps.length);
}

function buildProcessMonitorGroup(
  key: ProcessMonitorGroup["key"],
  label: string,
  steps: ProcessMonitorStep[],
  copy: DashboardLiveCopy,
  numberLocale: string,
): ProcessMonitorGroup {
  const status = getProcessMonitorAggregateStatus(steps);
  const completedCount = getProcessMonitorCompletedCount(steps);
  const totalCount = steps.length;
  const currentStep = getProcessMonitorCurrentStep(steps);

  return {
    key,
    label,
    status,
    statusLabel: getProcessMonitorStatusLabel(status, copy),
    progressLabel: buildProcessMonitorProgressLabel(completedCount, totalCount, numberLocale),
    progressPercent: getProcessMonitorGroupProgressPercent(steps),
    completedCount,
    totalCount,
    currentStepLabel: currentStep?.label ?? null,
    steps,
  };
}

export function buildProcessMonitorModel({
  agentRoleCards,
  copy,
  eodStageCards,
  filteringCardModel,
  numberLocale,
  patchDate = null,
  scoringCardModel,
}: {
  agentRoleCards: AgentRoleCard[];
  copy: DashboardLiveCopy;
  eodStageCards: readonly EodStageCard[];
  filteringCardModel: FilteringCardModel;
  numberLocale: string;
  patchDate?: string | null;
  scoringCardModel: ScoringCardModel;
}): ProcessMonitorModel {
  const groups = [
    buildProcessMonitorGroup(
      "patch",
      copy.processMonitor.groups.patch,
      eodStageCards.map((stage) => buildEodProcessMonitorStep(stage, copy)),
      copy,
      numberLocale,
    ),
    buildProcessMonitorGroup(
      "filter",
      copy.processMonitor.groups.filter,
      filteringCardModel.stages.map((stage) => buildFilteringProcessMonitorStep(stage, copy)),
      copy,
      numberLocale,
    ),
    buildProcessMonitorGroup(
      "scoring",
      copy.processMonitor.groups.scoring,
      scoringCardModel.stages.map((stage) => buildScoringProcessMonitorStep(stage, copy)),
      copy,
      numberLocale,
    ),
    buildProcessMonitorGroup(
      "agent-feedback",
      copy.processMonitor.groups.agentFeedback,
      agentRoleCards.map((role) => buildAgentProcessMonitorStep(role, copy)),
      copy,
      numberLocale,
    ),
  ];
  const status = getProcessMonitorAggregateStatus(groups.map((group) => ({
    key: group.key,
    label: group.label,
    status: group.status,
    statusLabel: group.statusLabel,
    progressLabel: group.progressLabel,
    progressPercent: group.progressPercent,
    metrics: [],
    note: null,
  } satisfies ProcessMonitorStep)));
  const completedCount = groups.reduce((sum, group) => sum + group.completedCount, 0);
  const totalCount = groups.reduce((sum, group) => sum + group.totalCount, 0);
  const currentGroup =
    groups.find((group) => group.status === "error") ??
    groups.find((group) => group.status === "retry") ??
    groups.find((group) => group.status === "running") ??
    groups.find((group) => group.status === "partial") ??
    groups.find((group) => group.status === "pending") ??
    null;

  return {
    status,
    statusLabel: getProcessMonitorStatusLabel(status, copy),
    progressLabel: buildProcessMonitorProgressLabel(completedCount, totalCount, numberLocale),
    progressPercent: totalCount > 0 ? clampAgentProgressPercent((completedCount / totalCount) * 100) : 0,
    completedCount,
    totalCount,
    patchDate: resolveNormalizedPresenterDate(patchDate),
    currentGroupLabel: currentGroup?.label ?? null,
    currentStepLabel: currentGroup?.currentStepLabel ?? null,
    groups,
  };
}

export function getFundamentalsFreshnessLayer(
  freshness: EodFreshnessResponseDto | null,
): EodFreshnessLayerStatusDto | null {
  return freshness?.fundamentals ?? freshness?.fundamental ?? null;
}

export function getFirstTextValue(...values: Array<string | null | undefined>) {
  return resolveNormalizedPresenterDate(...values);
}

function humanizeToken(value: string | null | undefined, fallback = UNKNOWN_LABEL) {
  if (!hasTextValue(value)) return fallback;
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeFundamentalsStatusToken(value: string | null | undefined) {
  if (!hasTextValue(value)) return null;
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function isCompletedLatestAvailableStatus(value: string | null | undefined) {
  const normalizedStatus = normalizeFundamentalsStatusToken(value);
  return normalizedStatus !== null && ["completed", "available", "ready", "success"].includes(normalizedStatus);
}

function isFundamentalsFailureStatus(value: string | null | undefined) {
  const normalizedStatus = normalizeFundamentalsStatusToken(value);
  return (
    normalizedStatus !== null &&
    ["failed", "partial", "needs review", "completed with errors", "error"].includes(normalizedStatus)
  );
}

function isCurrentOrNewerFundamentalsRun(
  run: DartFundamentalsDailyRunDto | null,
  latestAvailableCoverage: ReturnType<typeof getLatestAvailableFundamentalsCoverage>,
) {
  const runDate = getFundamentalsRunDate(run);
  const coverageDate = latestAvailableCoverage?.tradeDate ?? null;
  if (!hasTextValue(coverageDate)) return true;
  if (!hasTextValue(runDate)) return false;
  return runDate >= coverageDate;
}

export function getFundamentalsStatusLabel(
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  latestAvailableCoverage: ReturnType<typeof getLatestAvailableFundamentalsCoverage>,
  pipelineStage: EodPipelineStageDto | null,
): string {
  if (normalizePipelineStageStatus(pipelineStage) === "running") return "running";

  const todayStageStatus = normalizeFundamentalsStatusToken(freshness?.today?.fundamentals?.status);
  if (todayStageStatus === "running") return "running";

  const latestRun = getLatestFundamentalsRun(fundamentalsStatus);
  const runStatus = normalizeFundamentalsStatusToken(latestRun?.status);
  if (isFundamentalsFailureStatus(runStatus) && isCurrentOrNewerFundamentalsRun(latestRun, latestAvailableCoverage)) {
    return runStatus ?? UNKNOWN_LABEL;
  }

  const latestCoverageStatus = normalizeFundamentalsStatusToken(latestAvailableCoverage?.status);
  if (isCompletedLatestAvailableStatus(latestCoverageStatus) || hasTextValue(latestAvailableCoverage?.tradeDate)) {
    return latestCoverageStatus ?? "completed";
  }

  if (runStatus === "running" || runStatus === "completed" || isFundamentalsFailureStatus(runStatus)) {
    return runStatus ?? UNKNOWN_LABEL;
  }

  if (hasTextValue(latestCoverageStatus)) return latestCoverageStatus;
  if (hasTextValue(runStatus)) return runStatus;

  const freshnessLayer = getFundamentalsFreshnessLayer(freshness);
  if (freshnessLayer?.success === true) return "completed";
  if (freshnessLayer?.success === false) return "needs review";
  if (hasTextValue(latestAvailableCoverage?.tradeDate)) return "completed";

  return UNKNOWN_LABEL;
}

function getFundamentalsStatusDisplayLabel(statusLabel: string, copy: DashboardLiveCopy) {
  if (!hasTextValue(statusLabel) || statusLabel === UNKNOWN_LABEL) return UNKNOWN_LABEL;

  const normalizedStatus = normalizeFundamentalsStatusToken(statusLabel);
  if (normalizedStatus === "running") return copy.stage.running;
  if (normalizedStatus === "completed") return copy.agentFeedback.roleStatuses.completed;
  if (normalizedStatus === "needs review") return copy.piotroski.needsReview;

  return humanizeToken(statusLabel);
}

function getHumanCount(value: number | null | undefined, numberLocale: string) {
  if (!hasNumber(value)) return UNKNOWN_LABEL;
  return value.toLocaleString(numberLocale);
}

function getFailureCountPhrase(count: number, singularLabel: string, pluralLabel: string, numberLocale: string) {
  const label = count === 1 ? singularLabel : pluralLabel;
  return `${count.toLocaleString(numberLocale)} ${label}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatMetadataValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return hasTextValue(value) ? value : null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getFailureMetadata(run: DartFundamentalsDailyRunDto | null): DetailItem[] {
  if (!isRecord(run?.run_metadata)) return [];

  return Object.entries(run.run_metadata)
    .filter(([key, value]) => /(error|fail|reason|exception|message|missing|stale)/i.test(key) && value !== null)
    .map(([key, value]) => ({
      label: humanizeToken(key, key),
      value: formatMetadataValue(value) ?? UNKNOWN_LABEL,
    }))
    .filter((item) => item.value !== UNKNOWN_LABEL)
    .slice(0, 8);
}

function hasFundamentalsFailureSignal(
  freshness: EodFreshnessResponseDto | null,
  run: DartFundamentalsDailyRunDto | null,
  statusLabel: string,
) {
  const symbolsFailed = run?.symbols_failed;
  const eventsFailed = run?.events_failed;
  return (
    isFundamentalsFailureStatus(statusLabel) ||
    (hasNumber(symbolsFailed) && symbolsFailed > 0) ||
    (hasNumber(eventsFailed) && eventsFailed > 0) ||
    Boolean(hasTextValue(run?.error_message)) ||
    getFundamentalsFreshnessLayer(freshness)?.success === false
  );
}

function getFundamentalsFailureReason(
  freshness: EodFreshnessResponseDto | null,
  run: DartFundamentalsDailyRunDto | null,
  statusLabel: string,
  copy: DashboardLiveCopy,
  numberLocale: string,
) {
  if (hasTextValue(run?.error_message)) return run.error_message.trim();

  const failedCounts: string[] = [];
  const symbolsFailed = run?.symbols_failed;
  const eventsFailed = run?.events_failed;
  if (hasNumber(symbolsFailed) && symbolsFailed > 0) {
    failedCounts.push(
      getFailureCountPhrase(
        symbolsFailed,
        copy.fundamentalsFailure.failedSymbol.one,
        copy.fundamentalsFailure.failedSymbol.many,
        numberLocale,
      ),
    );
  }
  if (hasNumber(eventsFailed) && eventsFailed > 0) {
    failedCounts.push(
      getFailureCountPhrase(
        eventsFailed,
        copy.fundamentalsFailure.failedEvent.one,
        copy.fundamentalsFailure.failedEvent.many,
        numberLocale,
      ),
    );
  }

  if (failedCounts.length > 0) {
    return `${copy.fundamentalsFailure.coreReported} ${failedCounts.join(" and ")}.`;
  }

  if (getFundamentalsFreshnessLayer(freshness)?.success === false) {
    return copy.fundamentalsFailure.freshnessFailed;
  }

  return `${copy.fundamentalsFailure.markedAs} ${getFundamentalsStatusDisplayLabel(statusLabel, copy)}.`;
}

export function getFundamentalsFailureDetails(
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  latestFundamentalsDate: string | null,
  statusLabel: string,
  copy: DashboardLiveCopy,
  numberLocale: string,
): FundamentalsFailureDetails | null {
  const run = getLatestFundamentalsRun(fundamentalsStatus);

  if (!hasFundamentalsFailureSignal(freshness, run, statusLabel)) return null;

  const runDate = getFundamentalsRunDate(run) ?? latestFundamentalsDate ?? UNKNOWN_LABEL;
  const displayedStatusLabel = getFundamentalsStatusDisplayLabel(statusLabel, copy);

  return {
    key: `${run?.id ?? "freshness"}:${runDate}:${statusLabel}`,
    title: `${copy.fundamentalsFailure.titlePrefix} ${displayedStatusLabel.toLowerCase()}`,
    reason: getFundamentalsFailureReason(freshness, run, statusLabel, copy, numberLocale),
    details: [
      { label: copy.fundamentalsFailure.fields.runDate, value: runDate },
      { label: copy.fundamentalsFailure.fields.status, value: displayedStatusLabel },
      { label: copy.fundamentalsFailure.fields.fsDivision, value: run?.fs_div ?? UNKNOWN_LABEL },
      { label: copy.fundamentalsFailure.fields.trigger, value: humanizeToken(run?.trigger) },
      { label: copy.fundamentalsFailure.fields.symbolsTotal, value: getHumanCount(run?.symbols_total, numberLocale) },
      { label: copy.fundamentalsFailure.fields.symbolsChecked, value: getHumanCount(run?.symbols_checked, numberLocale) },
      { label: copy.fundamentalsFailure.fields.symbolsMissing, value: getHumanCount(run?.symbols_missing, numberLocale) },
      { label: copy.fundamentalsFailure.fields.symbolsStale, value: getHumanCount(run?.symbols_stale, numberLocale) },
      { label: copy.fundamentalsFailure.fields.symbolsFresh, value: getHumanCount(run?.symbols_fresh, numberLocale) },
      { label: copy.fundamentalsFailure.fields.symbolsRefreshed, value: getHumanCount(run?.symbols_refreshed, numberLocale) },
      { label: copy.fundamentalsFailure.fields.symbolsFailed, value: getHumanCount(run?.symbols_failed, numberLocale) },
      { label: copy.fundamentalsFailure.fields.eventsDetected, value: getHumanCount(run?.events_detected, numberLocale) },
      { label: copy.fundamentalsFailure.fields.eventsCaptured, value: getHumanCount(run?.events_captured, numberLocale) },
      { label: copy.fundamentalsFailure.fields.eventsFailed, value: getHumanCount(run?.events_failed, numberLocale) },
      { label: copy.fundamentalsFailure.fields.started, value: formatDisplayTimestamp(run?.started_at, UNKNOWN_LABEL) },
      { label: copy.fundamentalsFailure.fields.completed, value: formatDisplayTimestamp(run?.completed_at, UNKNOWN_LABEL) },
    ],
    metadata: getFailureMetadata(run),
  };
}

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function formatPipelineDetailText(value: string | null | undefined) {
  if (!hasTextValue(value)) return null;

  const trimmed = value.trim();
  return /[_-]/.test(trimmed) && !trimmed.includes(" ") ? humanizeToken(trimmed, trimmed) : trimmed;
}

function hasEodReadinessSignal(freshness: EodFreshnessResponseDto | null) {
  return (
    hasTextValue(getLatestPriceTradeDate(freshness)) ||
    hasNumber(getEodSymbolsSucceeded(freshness)) ||
    hasNumber(getEodSymbolsTotal(freshness))
  );
}

export function formatEodSymbolCount(value: number | null | undefined, numberLocale: string) {
  if (!hasNumber(value)) return UNKNOWN_LABEL;
  return value.toLocaleString(numberLocale);
}

function buildStage(
  status: string | null,
  symbolsTotal: number | null | undefined,
  symbolsSucceeded: number | null | undefined,
  symbolsFailed: number | null | undefined,
): EodFreshnessStageDto | null {
  if (!hasTextValue(status)) return null;

  return {
    status,
    symbols_total: symbolsTotal ?? null,
    symbols_succeeded: symbolsSucceeded ?? null,
    symbols_failed: symbolsFailed ?? null,
  };
}

function normalizeStageStatus(stage: EodFreshnessStageDto | null | undefined) {
  return stage?.status?.trim().toLowerCase() ?? null;
}

function isRunningFreshnessStage(stage: EodFreshnessStageDto | null | undefined) {
  return normalizeStageStatus(stage) === "running";
}

function isProblemFreshnessStage(stage: EodFreshnessStageDto | null | undefined) {
  const normalizedStatus = normalizeStageStatus(stage);
  return (
    (normalizedStatus !== null &&
      ["failed", "error", "partial", "completed with errors", "needs review"].includes(normalizedStatus)) ||
    (hasNumber(stage?.symbols_failed) && stage.symbols_failed > 0)
  );
}

function normalizePipelineStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

function normalizePipelineStageStatus(stage: EodPipelineStageDto | null | undefined) {
  return normalizePipelineStatus(stage?.status);
}

function isCompletedPipelineStage(pipelineStage: EodPipelineStageDto | null | undefined) {
  const normalizedStatus = normalizePipelineStageStatus(pipelineStage);
  return normalizedStatus !== null && ["completed", "ready", "available", "success"].includes(normalizedStatus);
}

export function getPipelineStage(
  pipelineStatus: EodPipelineStatusResponseDto | null,
  key: EodPipelineStageKey,
) {
  return pipelineStatus?.stages?.[key] ?? null;
}

export function mergeRunningPipelineStage(
  stage: EodFreshnessStageDto | null,
  pipelineStage: EodPipelineStageDto | null | undefined,
  options: { preferStageCountsOnCompleted?: boolean } = {},
) {
  if (isRunningPipelineStage(pipelineStage)) {
    return buildStage(
      "running",
      pipelineStage?.total ?? stage?.symbols_total,
      pipelineStage?.processed ?? stage?.symbols_succeeded,
      pipelineStage?.failed ?? stage?.symbols_failed,
    );
  }

  if (!isCompletedPipelineStage(pipelineStage)) return stage;

  if (options.preferStageCountsOnCompleted) {
    return buildStage(
      "ready",
      stage?.symbols_total ?? pipelineStage?.total,
      stage?.symbols_succeeded ?? pipelineStage?.processed,
      stage?.symbols_failed ?? pipelineStage?.failed,
    );
  }

  return buildStage(
    "ready",
    pipelineStage?.total ?? stage?.symbols_total,
    pipelineStage?.processed ?? stage?.symbols_succeeded ?? pipelineStage?.total,
    pipelineStage?.failed ?? stage?.symbols_failed,
  );
}

export function getPipelineStageResolvedStatusDate(
  pipelineStage: EodPipelineStageDto | null | undefined,
  resolvedMarketDate: string | null,
  latestDate: string | null,
) {
  if (!isCompletedPipelineStage(pipelineStage)) return latestDate;
  return getFirstTextValue(resolvedMarketDate, latestDate);
}

export function resolveFundamentalsPollingPresentation({
  latestFundamentalsDate,
  pipelineStage,
  processMarketDate,
  todayTradeDate,
}: {
  latestFundamentalsDate: string | null;
  pipelineStage: EodPipelineStageDto | null | undefined;
  processMarketDate: string | null;
  todayTradeDate: string | null;
}) {
  const useLivePollingView = isRunningPipelineStage(pipelineStage);

  return {
    latestDate: useLivePollingView
      ? getFirstTextValue(processMarketDate, todayTradeDate, latestFundamentalsDate)
      : latestFundamentalsDate,
    showStoredActivity: !useLivePollingView,
    useLivePollingView,
  };
}

function hasRunningDashboardPipelineStage(pipelineStatus: EodPipelineStatusResponseDto | null) {
  if (normalizePipelineStatus(pipelineStatus?.status) === "running") return true;

  return Object.values(pipelineStatus?.stages ?? {}).some((stage) => isRunningPipelineStage(stage));
}

export function getEodPipelineStatusPollDelayMs(pipelineStatus: EodPipelineStatusResponseDto | null) {
  return hasRunningDashboardPipelineStage(pipelineStatus)
    ? EOD_PIPELINE_STATUS_RUNNING_POLL_MS
    : EOD_PIPELINE_STATUS_IDLE_POLL_MS;
}

type FilteringFallbackStatus = {
  market_date?: string | null;
  requested_market_date?: string | null;
  resolved_market_date?: string | null;
  is_latest_fallback?: boolean | null;
};

function isFilteringFallbackForRequestedMarketDate(
  response: FilteringFallbackStatus | null | undefined,
  requestedMarketDate: string | null | undefined,
) {
  const currentRequestedMarketDate = resolvePiotroskiMarketDateResolution(null, requestedMarketDate).requestedMarketDate;
  if (!currentRequestedMarketDate) return false;

  const responseResolution = resolvePiotroskiMarketDateResolution(response, currentRequestedMarketDate);
  return (
    responseResolution.isLatestFallback &&
    responseResolution.requestedMarketDate === currentRequestedMarketDate &&
    responseResolution.effectiveMarketDate !== null &&
    responseResolution.effectiveMarketDate !== currentRequestedMarketDate
  );
}

export function shouldRevalidateFilteringFallback({
  requestedMarketDate,
  piotroskiStatus,
  marketRiskStatus,
  pipelineStatus,
  agentFeedbackProgress,
}: {
  requestedMarketDate: string | null | undefined;
  piotroskiStatus: FilteringFallbackStatus | null;
  marketRiskStatus: FilteringFallbackStatus | null;
  pipelineStatus: EodPipelineStatusResponseDto | null;
  agentFeedbackProgress: AgentFeedbackProgressResponseDto | null;
}) {
  return shouldRevalidateLatestAvailableFallback({
    requestedMarketDate,
    latestFallbackStatuses: [piotroskiStatus, marketRiskStatus],
    pipelineStatus,
    agentFeedbackProgress,
  });
}

export function shouldRevalidateLatestAvailableFallback({
  requestedMarketDate,
  latestFallbackStatuses,
  pipelineStatus,
  agentFeedbackProgress,
}: {
  requestedMarketDate: string | null | undefined;
  latestFallbackStatuses: Array<FilteringFallbackStatus | null>;
  pipelineStatus: EodPipelineStatusResponseDto | null;
  agentFeedbackProgress: AgentFeedbackProgressResponseDto | null;
}) {
  const hasRequestedDateFallback = latestFallbackStatuses.some((status) =>
    isFilteringFallbackForRequestedMarketDate(status, requestedMarketDate),
  );
  if (!hasRequestedDateFallback) return false;

  return (
    getEodPipelineStatusPollDelayMs(pipelineStatus) === EOD_PIPELINE_STATUS_RUNNING_POLL_MS ||
    getAgentFeedbackProgressPollDelayMs(agentFeedbackProgress) === AGENT_FEEDBACK_PROGRESS_RUNNING_POLL_MS ||
    hasRequestedDateFallback
  );
}

function normalizeMarketState(value: string | null | undefined) {
  return value?.trim().toUpperCase().replace(/[\s-]+/g, "_") ?? null;
}

function getIsoDatePart(value: string | null | undefined) {
  return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

function isWeekendIsoDate(value: string | null | undefined) {
  const datePart = getIsoDatePart(value);
  if (!datePart) return false;

  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return false;

  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

function hasBreakDayText(value: string | null | undefined) {
  const normalizedValue = value?.trim().toLowerCase() ?? "";
  return (
    normalizedValue.includes("weekend") ||
    normalizedValue.includes("holiday") ||
    normalizedValue.includes("break_day") ||
    normalizedValue.includes("break day") ||
    normalizedValue.includes("휴장") ||
    normalizedValue.includes("휴일")
  );
}

export function isBreakDayMarket(market: CoreMarketStatus) {
  if (market.is_trading_day === false) return true;
  if (market.is_trading_day === true) return false;
  if (hasBreakDayText(market.state) || hasBreakDayText(market.reason)) return true;

  const state = normalizeMarketState(market.state);
  const canUseWeekendFallback = state === "CLOSED" || state === "WEEKEND";
  return canUseWeekendFallback && isWeekendIsoDate(market.server_time ?? market.as_of);
}

function getTodayPriceFreshnessStage(freshness: EodFreshnessResponseDto | null): EodFreshnessStageDto | null {
  if (freshness?.today?.price) return freshness.today.price;

  const status = freshness?.today?.eod_status ?? getLatestEodStatus(freshness);
  const normalizedStatus = status?.trim().toLowerCase() ?? null;
  const resolvedStatus =
    normalizedStatus === "running"
      ? "running"
      : hasEodReadinessSignal(freshness)
        ? "ready"
        : hasTextValue(freshness?.today?.trade_date)
          ? "missing"
          : null;

  return buildStage(
    resolvedStatus,
    getEodSymbolsTotal(freshness),
    getEodSymbolsSucceeded(freshness),
    getEodSymbolsFailed(freshness),
  );
}

function getLatestPriceFreshnessStage(freshness: EodFreshnessResponseDto | null): EodFreshnessStageDto | null {
  const status = getLatestEodStatus(freshness);
  const normalizedStatus = status?.trim().toLowerCase() ?? null;
  const hasLatestSnapshot =
    hasNumber(getLatestEodSymbolsSucceeded(freshness)) ||
    hasNumber(getLatestEodSymbolsTotal(freshness)) ||
    hasNumber(getLatestEodSymbolsFailed(freshness));
  const hasReadyLatestStatus =
    normalizedStatus === "ready" || normalizedStatus === "completed" || normalizedStatus === "available";
  const hasFailedLatestStatus =
    normalizedStatus === "failed" || normalizedStatus === "missing" || normalizedStatus === "partial";
  const resolvedStatus =
    normalizedStatus === "running"
      ? "running"
      : hasFailedLatestStatus
        ? "missing"
        : hasReadyLatestStatus || hasLatestSnapshot
          ? "ready"
          : null;

  return buildStage(
    resolvedStatus,
    getLatestEodSymbolsTotal(freshness),
    getLatestEodSymbolsSucceeded(freshness),
    getLatestEodSymbolsFailed(freshness),
  );
}

function getPatchStageFreshnessStatus(
  stageStatus: string | null,
  symbolsTotal: number | null,
  symbolsSucceeded: number | null,
  hasLatestStageDate: boolean,
) {
  const normalizedStatus = stageStatus?.trim().toLowerCase().replace(/[_-]+/g, " ") ?? null;
  if (normalizedStatus === "running") return "running";
  if (
    normalizedStatus &&
    ["failed", "error", "missing", "partial", "completed with errors", "needs review"].includes(normalizedStatus)
  ) {
    return "missing";
  }
  if (normalizedStatus && ["ready", "completed", "available", "success"].includes(normalizedStatus)) {
    return "ready";
  }
  if (normalizedStatus && ["pending", "queued", "not started"].includes(normalizedStatus)) {
    return "pending";
  }
  if (hasNumber(symbolsTotal) && hasNumber(symbolsSucceeded)) {
    return symbolsSucceeded >= symbolsTotal ? "ready" : "running";
  }
  if (hasNumber(symbolsTotal) || hasNumber(symbolsSucceeded)) return "ready";
  if (hasLatestStageDate) return "ready";
  return null;
}

function getLatestPatchStageFreshnessStage(
  freshness: EodFreshnessResponseDto | null,
  key: "technical_analysis" | "action_summary",
): EodFreshnessStageDto | null {
  const detail = getLatestEodPatchStageDetail(freshness, key);
  if (!detail) return null;

  const hasStageEvidence =
    hasTextValue(detail.tradeDate) ||
    hasTextValue(detail.status) ||
    hasNumber(detail.symbolsTotal) ||
    hasNumber(detail.symbolsSucceeded) ||
    hasNumber(detail.symbolsFailed);
  if (!hasStageEvidence) return null;

  const status = getPatchStageFreshnessStatus(
    detail.status,
    detail.symbolsTotal,
    detail.symbolsSucceeded,
    hasTextValue(detail.tradeDate),
  );
  return buildStage(status, detail.symbolsTotal, detail.symbolsSucceeded, detail.symbolsFailed);
}

export function getPriceFreshnessStage(
  freshness: EodFreshnessResponseDto | null,
  useTodayStage: boolean,
): EodFreshnessStageDto | null {
  const todayStage = getTodayPriceFreshnessStage(freshness);
  if (isRunningFreshnessStage(todayStage)) return todayStage;

  return useTodayStage
    ? todayStage ?? getLatestPriceFreshnessStage(freshness)
    : getLatestPriceFreshnessStage(freshness) ?? todayStage;
}

function getLatestTechnicalFreshnessStage(freshness: EodFreshnessResponseDto | null): EodFreshnessStageDto | null {
  const latestTechnicalStage = getLatestPatchStageFreshnessStage(freshness, "technical_analysis");
  if (latestTechnicalStage) return latestTechnicalStage;

  const hasTechnicalDate =
    getFirstTextValue(freshness?.technical?.latest_date, getLatestTechnicalMarketDate(freshness)) !== null;
  if (hasTechnicalDate) return buildStage("ready", null, null, null);

  if (freshness?.technical?.success === false) {
    return buildStage("missing", null, null, null);
  }

  return null;
}

export function getTechnicalFreshnessStage(
  freshness: EodFreshnessResponseDto | null,
  useTodayStage: boolean,
): EodFreshnessStageDto | null {
  const todayStage = freshness?.today?.technical_analysis ?? null;
  if (isRunningFreshnessStage(todayStage)) return todayStage;
  if (useTodayStage && todayStage) return todayStage;

  const latestStage = getLatestTechnicalFreshnessStage(freshness);
  if (latestStage) return latestStage;
  if (isProblemFreshnessStage(todayStage)) return todayStage;

  return todayStage;
}

function getLatestActionFreshnessStage(freshness: EodFreshnessResponseDto | null): EodFreshnessStageDto | null {
  const latestActionStage = getLatestPatchStageFreshnessStage(freshness, "action_summary");
  if (latestActionStage) return latestActionStage;

  const latestActionDate = getFirstTextValue(freshness?.action?.latest_date, getLatestActionMarketDate(freshness));
  if (latestActionDate) return buildStage("ready", null, null, null);

  if (freshness?.action?.success === false) {
    return buildStage("missing", null, null, null);
  }

  return null;
}

export function getActionFreshnessStage(
  freshness: EodFreshnessResponseDto | null,
  useTodayStage: boolean,
): EodFreshnessStageDto | null {
  const todayStage = freshness?.today?.action_summary ?? null;
  if (isRunningFreshnessStage(todayStage)) return todayStage;
  if (useTodayStage && todayStage) return todayStage;

  const latestStage = getLatestActionFreshnessStage(freshness);
  if (latestStage) return latestStage;
  if (isProblemFreshnessStage(todayStage)) return todayStage;

  return todayStage;
}

export function getFundamentalsFreshnessStage(
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  fundamentalsStatusLabel: string,
  latestFundamentalsDate: string | null,
  useTodayStage: boolean,
): EodFreshnessStageDto | null {
  const { symbolsTotal, symbolsChecked, symbolsFailed } = getFundamentalsStageDisplayCounts(
    freshness,
    fundamentalsStatus,
    freshness?.today?.fundamentals,
    useTodayStage,
  );
  const normalizedStatus = normalizeFundamentalsStatusToken(fundamentalsStatusLabel);
  if (normalizedStatus === "running") return buildStage("running", symbolsTotal, symbolsChecked, symbolsFailed);
  const latestAvailableCoverage = getLatestAvailableFundamentalsCoverage(freshness, fundamentalsStatus);
  if (isCompletedLatestAvailableStatus(latestAvailableCoverage?.status)) {
    return buildStage("ready", symbolsTotal, symbolsChecked, symbolsFailed);
  }
  if (isFundamentalsFailureStatus(normalizedStatus)) {
    return buildStage("missing", symbolsTotal, symbolsChecked, symbolsFailed);
  }
  if (
    isCompletedLatestAvailableStatus(normalizedStatus) ||
    hasTextValue(latestFundamentalsDate)
  ) {
    return buildStage("ready", symbolsTotal, symbolsChecked, symbolsFailed);
  }

  return freshness?.today?.fundamentals ?? null;
}

function getEodStageStatusLabel(
  stage: EodFreshnessStageDto | null,
  todayTradeDate: string | null,
  latestDate: string | null,
  canShowBreakDay: boolean,
): EodStageCard["statusLabel"] {
  return resolvePresenterStageStatus({
    stageStatus: stage?.status,
    todayTradeDate,
    latestDate,
    canShowBreakDay,
  });
}

export function getFundamentalsStageStatusLabel(
  stage: EodFreshnessStageDto | null,
  todayTradeDate: string | null,
  latestDate: string | null,
  canShowBreakDay: boolean,
): EodStageCard["statusLabel"] {
  return resolvePresenterStageStatus({
    stageStatus: stage?.status,
    todayTradeDate,
    latestDate,
    canShowBreakDay,
  });
}

function getEodStageTone(statusLabel: EodStageCard["statusLabel"]): EodStageCard["tone"] {
  return getPresenterStageTone(statusLabel);
}

function getEodStageStatusBadge(
  statusLabel: EodStageCard["statusLabel"],
  pipelineStage: EodPipelineStageDto | null | undefined,
) {
  if (statusLabel !== "running") {
    return { label: statusLabel, title: null };
  }

  const currentStep = formatPipelineDetailText(pipelineStage?.current_step);
  const currentActivity = formatPipelineDetailText(pipelineStage?.current_activity);
  const currentSymbol = pipelineStage?.current_symbol?.trim() || null;
  const label = currentStep ?? currentActivity ?? statusLabel;
  const titleParts = [currentStep, currentActivity, currentSymbol ? `Symbol ${currentSymbol}` : null].filter(Boolean);

  return {
    label,
    title: titleParts.length > 0 ? titleParts.join(" · ") : null,
  };
}

export function isIconOnlyEodStageStatus(statusLabel: EodStageCard["statusLabel"]) {
  return statusLabel === "synced" || statusLabel === "not synced";
}

const DASHBOARD_EOD_PIPELINE_STAGE_SEQUENCE: readonly {
  cardId: EodStageId;
  pipelineKey: EodPipelineStageKey;
}[] = [
  { cardId: "price", pipelineKey: "price_collection" },
  { cardId: "technical", pipelineKey: "technical_snapshots" },
  { cardId: "action", pipelineKey: "action_summaries" },
  { cardId: "fundamentals", pipelineKey: "fundamentals_daily_refresh" },
] as const;

function getEodStageCardTotalCount(card: EodStageCard) {
  const countValue = card.details.find((detail) => detail.key === "count")?.value ?? "";
  const [, totalPart] = countValue.split("/").map((part) => part.trim());
  if (!hasTextValue(totalPart)) return null;

  const normalized = totalPart.replace(/[^\d.-]/g, "");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isDashboardEodPipelineStageKey(key: EodPipelineStageKey) {
  return DASHBOARD_EOD_PIPELINE_STAGE_SEQUENCE.some((stage) => stage.pipelineKey === key);
}

function hasDashboardEodPipelineStageEvidence(pipelineStatus: EodPipelineStatusResponseDto | null) {
  if (!pipelineStatus) return false;

  const orderedEodStage = pipelineStatus.stage_order.some(isDashboardEodPipelineStageKey);
  const reportedEodStage = DASHBOARD_EOD_PIPELINE_STAGE_SEQUENCE.some(({ pipelineKey }) =>
    Boolean(pipelineStatus.stages?.[pipelineKey]),
  );
  return orderedEodStage || reportedEodStage;
}

function hasExplicitRunningNonEodPipelineStage(pipelineStatus: EodPipelineStatusResponseDto | null) {
  if (!pipelineStatus) return false;

  return Object.entries(pipelineStatus.stages ?? {}).some(
    ([key, stage]) => !isDashboardEodPipelineStageKey(key as EodPipelineStageKey) && isRunningPipelineStage(stage),
  );
}

function getActiveDashboardEodPipelineStageIndex(pipelineStatus: EodPipelineStatusResponseDto | null) {
  if (normalizePipelineStatus(pipelineStatus?.status) !== "running") return null;

  const runningIndex = DASHBOARD_EOD_PIPELINE_STAGE_SEQUENCE.findIndex(({ pipelineKey }) =>
    isRunningPipelineStage(getPipelineStage(pipelineStatus, pipelineKey)),
  );
  if (runningIndex >= 0) return runningIndex;

  if (
    !hasDashboardEodPipelineStageEvidence(pipelineStatus) ||
    hasExplicitRunningNonEodPipelineStage(pipelineStatus)
  ) {
    return null;
  }

  const nextIncompleteIndex = DASHBOARD_EOD_PIPELINE_STAGE_SEQUENCE.findIndex(({ pipelineKey }) =>
    !isCompletedPipelineStage(getPipelineStage(pipelineStatus, pipelineKey)),
  );
  return nextIncompleteIndex >= 0 ? nextIncompleteIndex : null;
}

export function isEodProcessChecking(
  pipelineStatus: EodPipelineStatusResponseDto | null,
  eodStageCards: readonly EodStageCard[],
) {
  return (
    eodStageCards.some((card) => card.statusLabel === "running") ||
    getActiveDashboardEodPipelineStageIndex(pipelineStatus) !== null
  );
}

export function maskFutureEodStageCardsWhilePipelineRunning(
  cards: readonly EodStageCard[],
  pipelineStatus: EodPipelineStatusResponseDto | null,
  numberLocale: string,
): readonly EodStageCard[] {
  const activeStageIndex = getActiveDashboardEodPipelineStageIndex(pipelineStatus);
  if (activeStageIndex === null) return cards;

  return cards.map((card, index) => {
    if (index <= activeStageIndex) return card;

    const countDetail = card.details.find((detail) => detail.key === "count");
    const totalCount = getEodStageCardTotalCount(card);

    return {
      ...card,
      latestDate: null,
      statusLabel: "waiting",
      statusBadgeLabel: "waiting",
      statusBadgeTitle: null,
      tone: "neutral",
      details: [
        {
          key: "count",
          label: countDetail?.label ?? "",
          value: `${formatEodSymbolCount(0, numberLocale)} / ${formatEodSymbolCount(totalCount, numberLocale)}`,
          tone: "count",
        },
      ],
    } satisfies EodStageCard;
  });
}

export function buildEodStageCard(
  id: EodStageId,
  label: string,
  stage: EodFreshnessStageDto | null,
  todayTradeDate: string | null,
  latestDate: string | null,
  statusDate: string | null,
  primaryLatestCycleDate: string | null,
  canShowBreakDay: boolean,
  pipelineStage: EodPipelineStageDto | null | undefined,
  copy: DashboardLiveCopy,
  numberLocale: string,
  countDetail: Pick<EodStageDetail, "label" | "value"> = {
    label: "",
    value: `${formatEodSymbolCount(stage?.symbols_succeeded, numberLocale)} / ${formatEodSymbolCount(stage?.symbols_total, numberLocale)}`,
  },
  statusLabelResolver: (
    stage: EodFreshnessStageDto | null,
    todayTradeDate: string | null,
    latestDate: string | null,
    canShowBreakDay: boolean,
  ) => EodStageCard["statusLabel"] = getEodStageStatusLabel,
): EodStageCard {
  const statusLabel = statusLabelResolver(stage, todayTradeDate, statusDate, canShowBreakDay);
  const { label: statusBadgeLabel, title: statusBadgeTitle } = getEodStageStatusBadge(statusLabel, pipelineStage);
  const details: EodStageDetail[] = [
    {
      key: "count",
      tone: "count",
      ...countDetail,
    },
  ];

  const normalizedPrimaryLatestCycleDate = resolveNormalizedPresenterDate(primaryLatestCycleDate);
  const normalizedTodayTradeDate = resolveNormalizedPresenterDate(todayTradeDate);
  const normalizedLatestDate = resolveNormalizedPresenterDate(latestDate);
  const showLatestDateDetail = normalizedLatestDate
    ? normalizedPrimaryLatestCycleDate
      ? normalizedLatestDate !== normalizedPrimaryLatestCycleDate
      : normalizedTodayTradeDate
        ? normalizedLatestDate !== normalizedTodayTradeDate
        : true
    : false;

  if (showLatestDateDetail && normalizedLatestDate) {
    details.push({ key: "latest-date", label: copy.operational.latestDate, value: normalizedLatestDate, tone: "text" });
  }
  if (hasNumber(stage?.symbols_failed) && stage.symbols_failed > 0) {
    details.push({
      key: "failed",
      label: copy.operational.failed,
      value: formatEodSymbolCount(stage.symbols_failed, numberLocale),
      tone: "count",
    });
  }

  return {
    id,
    label,
    latestDate,
    statusLabel,
    statusBadgeLabel,
    statusBadgeTitle,
    tone: getEodStageTone(statusLabel),
    details,
  };
}

export function getFundamentalsCheckedCount(
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  stage: EodFreshnessStageDto | null,
) {
  const latestCoverage = getLatestAvailableFundamentalsCoverage(freshness, fundamentalsStatus);
  const latestRun = getLatestFundamentalsRun(fundamentalsStatus);
  if (normalizeStageStatus(stage) === "running") {
    return stage?.symbols_succeeded ?? latestRun?.symbols_checked ?? stage?.symbols_total ?? null;
  }

  return latestCoverage?.symbolsChecked ?? latestRun?.symbols_checked ?? stage?.symbols_succeeded ?? stage?.symbols_total ?? null;
}

function hasStructuredFundamentalsUpdatedEntriesPayload(run: DartFundamentalsDailyRunDto | null) {
  if (!run) return false;

  return run.updated_entries_summary != null || run.updated_entries_preview != null || run.updated_entries != null;
}

function getFundamentalsUpdatedEntriesSummary(run: DartFundamentalsDailyRunDto | null) {
  return run?.updated_entries_summary ?? null;
}

function getFundamentalsUpdatedPreviewLimit(
  summary: DartFundamentalsDailyUpdatedEntriesSummaryDto | null | undefined,
) {
  const preferredLimit = summary?.visible_preview_limit;
  if (!hasNumber(preferredLimit) || preferredLimit <= 0) return FUNDAMENTALS_UPDATED_ENTRIES_PREVIEW_LIMIT;
  return Math.min(FUNDAMENTALS_UPDATED_ENTRIES_PREVIEW_LIMIT, Math.max(1, Math.trunc(preferredLimit)));
}

function getFundamentalsUpdatedEntrySymbol(entry: DartFundamentalsDailyUpdatedEntryDto) {
  return getFirstTextValue(entry.symbol, entry.stock_code, entry.stockCode);
}

function getFundamentalsUpdatedEntryCompanyName(
  symbol: string,
  entry: DartFundamentalsDailyUpdatedEntryDto,
) {
  return getUsableCompanyName(symbol, entry.company_name, entry.companyName) ?? symbol;
}

function getFundamentalsUpdatedEntryCategoryLabel(entry: DartFundamentalsDailyUpdatedEntryDto) {
  const categoryLabel = getFirstTextValue(entry.category_label, entry.categoryLabel);
  if (categoryLabel) return categoryLabel;

  return humanizeToken(getFirstTextValue(entry.update_category, entry.updateCategory));
}

function getNormalizedFundamentalsUpdatedEntries(
  entries: DartFundamentalsDailyUpdatedEntryDto[] | null | undefined,
): FundamentalsUpdatedEntryModel[] {
  if (!Array.isArray(entries)) return [];

  const items: FundamentalsUpdatedEntryModel[] = [];
  const seenKeys = new Set<string>();

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;

    const symbol = getFundamentalsUpdatedEntrySymbol(entry);
    if (!symbol) continue;

    const companyName = getFundamentalsUpdatedEntryCompanyName(symbol, entry);
    const categoryLabel = getFundamentalsUpdatedEntryCategoryLabel(entry);
    const dedupeKey = `${symbol}:${categoryLabel}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    items.push({
      key: `${dedupeKey}:${items.length}`,
      symbol,
      companyName,
      categoryLabel,
    });
  }

  return items;
}

function getFundamentalsUpdatedEntries(run: DartFundamentalsDailyRunDto | null): FundamentalsUpdatedEntryModel[] {
  return getNormalizedFundamentalsUpdatedEntries(run?.updated_entries);
}

function getFundamentalsUpdatedPreviewEntries(
  run: DartFundamentalsDailyRunDto | null,
  allItems: FundamentalsUpdatedEntryModel[],
) {
  const previewItems = getNormalizedFundamentalsUpdatedEntries(run?.updated_entries_preview);
  if (previewItems.length > 0) return previewItems;
  return allItems;
}

function getFundamentalsUpdatedCount(
  run: DartFundamentalsDailyRunDto | null,
  items: FundamentalsUpdatedEntryModel[],
) {
  const summary = getFundamentalsUpdatedEntriesSummary(run);
  if (hasNumber(summary?.updated_count)) return summary.updated_count;
  if (hasStructuredFundamentalsUpdatedEntriesPayload(run) && Array.isArray(run?.updated_entries)) return items.length;
  return run?.symbols_refreshed ?? null;
}

function isActiveFundamentalsUpdatedRun(
  run: DartFundamentalsDailyRunDto | null,
  displayMarketDate: string | null,
) {
  const normalizedActiveMarketDate = getFirstTextValue(displayMarketDate);
  const latestRunDate = getFundamentalsRunDate(run);
  return Boolean(normalizedActiveMarketDate && latestRunDate === normalizedActiveMarketDate);
}

export function getFundamentalsUpdatedCountLabel(
  runDate: string | null | undefined,
  activeMarketDate: string | null | undefined,
  copy: DashboardLiveCopy,
) {
  const normalizedRunDate = getFirstTextValue(runDate);
  const normalizedActiveMarketDate = getFirstTextValue(activeMarketDate);
  return normalizedRunDate && normalizedActiveMarketDate && normalizedRunDate !== normalizedActiveMarketDate
    ? copy.operational.updatedRecently
    : copy.operational.updatedToday;
}

export function getFundamentalsUpdatedActivityModel(
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  displayMarketDate: string | null,
  numberLocale: string,
): FundamentalsUpdatedActivityModel | null {
  const latestRun = getLatestFundamentalsRun(fundamentalsStatus);
  if (!hasStructuredFundamentalsUpdatedEntriesPayload(latestRun)) return null;
  if (!isActiveFundamentalsUpdatedRun(latestRun, displayMarketDate)) return null;

  const allItems = getFundamentalsUpdatedEntries(latestRun);
  const previewSourceItems = getFundamentalsUpdatedPreviewEntries(latestRun, allItems);
  const updatedCount = getFundamentalsUpdatedCount(latestRun, allItems);
  if (!hasNumber(updatedCount)) return null;

  const previewLimit = getFundamentalsUpdatedPreviewLimit(getFundamentalsUpdatedEntriesSummary(latestRun));
  const previewItems = previewSourceItems.slice(0, previewLimit);
  const displayedItems = allItems.length > 0 ? allItems : previewSourceItems;
  return {
    key: `${latestRun?.id ?? "latest"}:${getFundamentalsRunDate(latestRun) ?? "unknown"}:${updatedCount}:${displayedItems.length}`,
    countLabel: formatEodSymbolCount(updatedCount, numberLocale),
    previewItems,
    allItems: displayedItems,
    canExpand: displayedItems.length > previewItems.length,
  };
}

function getSymbolCodeFromSampleItem(item: unknown): string | null {
  if (typeof item === "string") {
    return hasTextValue(item) ? item.trim() : null;
  }

  if (!isRecord(item)) return null;

  for (const key of ["symbol", "stock_code", "stockCode"]) {
    const value = item[key];
    if (typeof value === "string" && hasTextValue(value)) {
      return value.trim();
    }
  }

  return null;
}

function getSymbolCodesFromSample(value: unknown) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const symbols: string[] = [];

  for (const item of value) {
    const symbol = getSymbolCodeFromSampleItem(item);
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    symbols.push(symbol);
  }

  return symbols;
}

function getFundamentalsUpdatedSymbolSample(run: DartFundamentalsDailyRunDto | null) {
  const metadata = run?.run_metadata;
  if (!isRecord(metadata)) return [];

  const directSample = getSymbolCodesFromSample(metadata.refreshed_symbols_sample);
  if (directSample.length > 0) return directSample;

  const samples = metadata.samples;
  if (!isRecord(samples)) return [];

  return getSymbolCodesFromSample(samples.refreshed_symbols);
}

export function getFundamentalsUpdatedSymbolsDetail(
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  displayMarketDate: string | null,
  copy: DashboardLiveCopy,
  numberLocale: string,
  activeMarketDate: string | null = displayMarketDate,
): EodStageDetail | null {
  const latestRun = getLatestFundamentalsRun(fundamentalsStatus);
  if (hasStructuredFundamentalsUpdatedEntriesPayload(latestRun)) return null;

  const latestRunDate = getFundamentalsRunDate(latestRun);
  const normalizedActiveMarketDate = getFirstTextValue(displayMarketDate);
  if (!normalizedActiveMarketDate || latestRunDate !== normalizedActiveMarketDate) return null;

  const refreshedCount = latestRun?.symbols_refreshed;
  const symbolSample = getFundamentalsUpdatedSymbolSample(latestRun);

  if (!hasNumber(refreshedCount) && symbolSample.length === 0) return null;

  const visibleSymbols = symbolSample.slice(0, FUNDAMENTALS_UPDATED_SYMBOL_SAMPLE_LIMIT);
  const remainingSymbols = hasNumber(refreshedCount)
    ? Math.max(0, refreshedCount - visibleSymbols.length)
    : Math.max(0, symbolSample.length - visibleSymbols.length);
  const countLabel = formatEodSymbolCount(refreshedCount ?? symbolSample.length, numberLocale);
  const symbolLabel =
    visibleSymbols.length > 0
      ? ` (${visibleSymbols.join(", ")}${remainingSymbols > 0 ? ` +${formatEodSymbolCount(remainingSymbols, numberLocale)}` : ""})`
      : "";

  return {
    key: "updated-symbols",
    label: getFundamentalsUpdatedCountLabel(latestRunDate, activeMarketDate, copy),
    value: `${countLabel}${symbolLabel}`,
    tone: "text",
    layout: "stacked",
  };
}

function formatAgentProgressCountLabel(value: number | null | undefined, numberLocale: string) {
  if (!hasNumber(value)) return UNKNOWN_LABEL;
  return value.toLocaleString(numberLocale);
}

function clampAgentProgressPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatAgentProgressPercentValueLabel(value: number | null | undefined, numberLocale: string) {
  const percent = value;
  if (!hasNumber(percent)) return UNKNOWN_LABEL;
  return `${clampAgentProgressPercent(percent).toLocaleString(numberLocale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}%`;
}

function getAgentProgressPercentValue(progress: AgentFeedbackProgressResponseDto | null) {
  const percent = progress?.summary?.progress_percent;
  if (!hasNumber(percent)) return 0;
  return clampAgentProgressPercent(percent);
}

function getAgentProgressPercentFromCounts(
  completedCount: number | null | undefined,
  totalCount: number | null | undefined,
) {
  if (!hasNumber(completedCount) || !hasNumber(totalCount) || totalCount <= 0) return null;
  return clampAgentProgressPercent((completedCount / totalCount) * 100);
}

function getAgentProgressPercentFromRecord(record: Record<string, unknown>) {
  const percent = getRecordNumberValue(record, [
    "progress_percent",
    "percent",
    "completion_percent",
    "completed_percent",
  ]);
  if (hasNumber(percent)) return clampAgentProgressPercent(percent);

  const ratio = getRecordNumberValue(record, ["progress_ratio", "ratio", "completion_ratio", "completed_ratio"]);
  if (!hasNumber(ratio)) return null;

  return clampAgentProgressPercent(ratio <= 1 ? ratio * 100 : ratio);
}

function normalizeAgentProgressRunStatus(status: unknown): AgentFeedbackRunStatus | null {
  if (typeof status !== "string") return null;
  const normalized = status.trim().toLowerCase();
  return normalized === "pending" || normalized === "running" || normalized === "stalled" || normalized === "completed"
    ? (normalized as AgentFeedbackRunStatus)
    : null;
}

function hasAgentFeedbackLiveProgressEvidence(
  progress: AgentFeedbackProgressResponseDto | null,
  currentRole: string | null,
) {
  if (!progress || !currentRole || hasTextValue(progress.summary.run_completed_at)) return false;

  const hasRecentFeedbackTimestamp =
    hasTextValue(progress.summary.latest_feedback_at) &&
    (!hasNumber(progress.summary.seconds_since_last_feedback) ||
      !hasNumber(progress.summary.stalled_threshold_seconds) ||
      progress.summary.stalled_threshold_seconds <= 0 ||
      progress.summary.seconds_since_last_feedback <= progress.summary.stalled_threshold_seconds);

  return (
    progress.summary.is_live ||
    (hasNumber(progress.summary.processed_symbols) && progress.summary.processed_symbols > 0) ||
    (hasNumber(progress.summary.completed_feedback_count) && progress.summary.completed_feedback_count > 0) ||
    hasRecentFeedbackTimestamp
  );
}

export function getResolvedAgentProgressRunStatus(progress: AgentFeedbackProgressResponseDto | null) {
  if (!progress) return null;

  const summary = progress.summary;
  const runStatus = normalizeAgentProgressRunStatus(summary.run_status);
  const runTableStatus = normalizeAgentProgressRunStatus(summary.run_table_status);
  const cycleStatus = normalizeAgentProgressRunStatus(summary.cycle_status);
  const currentRole = normalizeAgentRole(summary.current_role);

  if (runStatus === "running" || runTableStatus === "running" || cycleStatus === "running") return "running";
  if (runStatus === "stalled" || runTableStatus === "stalled" || cycleStatus === "stalled") return "stalled";
  if (runStatus === "completed" || runTableStatus === "completed" || cycleStatus === "completed") {
    return "completed";
  }

  if (summary.is_live || hasAgentFeedbackLiveProgressEvidence(progress, currentRole)) return "running";
  if (summary.failed_items > 0) return "stalled";
  if (summary.progress_percent >= 100) return "completed";
  return runStatus ?? runTableStatus ?? cycleStatus ?? "pending";
}

export function isAgentFeedbackProgressRunning(progress: AgentFeedbackProgressResponseDto | null) {
  return getResolvedAgentProgressRunStatus(progress) === "running";
}

export function getAgentFeedbackProgressPollDelayMs(progress: AgentFeedbackProgressResponseDto | null) {
  return isAgentFeedbackProgressRunning(progress)
    ? AGENT_FEEDBACK_PROGRESS_RUNNING_POLL_MS
    : AGENT_FEEDBACK_PROGRESS_IDLE_POLL_MS;
}

export function getSignalDeciderFeedbackPollDelayMs({
  progress,
  hadError,
}: {
  progress: AgentFeedbackProgressResponseDto | null;
  hadError: boolean;
}) {
  if (isAgentFeedbackProgressRunning(progress)) return AGENT_FEEDBACK_PROGRESS_RUNNING_POLL_MS;
  return hadError ? SIGNAL_DECIDER_FEEDBACK_ERROR_RETRY_POLL_MS : null;
}

export function getAgentProgressStatusLabel(
  progress: AgentFeedbackProgressResponseDto | null,
  error: string | null,
  copy: DashboardLiveCopy,
) {
  const labels = getAgentProgressStatusLabels(copy);
  if (!progress) return error ? labels.stalled : UNKNOWN_LABEL;
  const runStatus = getResolvedAgentProgressRunStatus(progress);
  return runStatus ? labels[runStatus] : labels.pending;
}

function normalizeAgentRole(role: string | null | undefined) {
  return role?.trim().toLowerCase() ?? null;
}

function getAgentRoleLabel(role: string, copy: DashboardLiveCopy) {
  const normalizedRole = normalizeAgentRole(role);
  if (normalizedRole === "eod-summarizer") {
    return copy.agentFeedback.roles.eod;
  }
  if (normalizedRole === "technical-summarizer") {
    return copy.agentFeedback.roles.technical;
  }
  if (normalizedRole === "fundamental-summarizer") {
    return copy.agentFeedback.roles.fundamental;
  }
  if (normalizedRole === "short-term-decider") {
    return copy.agentFeedback.roles.shortTermDecider;
  }

  return humanizeToken(role, role);
}

function isSignalDeciderRole(role: string) {
  return normalizeAgentRole(role) === "signal-decider";
}

function isShortTermDeciderRole(role: string) {
  return normalizeAgentRole(role) === "short-term-decider";
}

function isDeciderRole(role: string) {
  return isSignalDeciderRole(role) || isShortTermDeciderRole(role);
}

function isAgentRoleMetricCapable(role: string) {
  return isSummarizerRole(role) || isDeciderRole(role);
}

function getOrderedAgentRoles(progress: AgentFeedbackProgressResponseDto | null) {
  const roles: string[] = [];
  const seenRoles = new Set<string>();
  const addRole = (role: string | null | undefined) => {
    if (!hasTextValue(role)) return;

    const normalizedRole = normalizeAgentRole(role);
    if (!normalizedRole || seenRoles.has(normalizedRole)) return;

    seenRoles.add(normalizedRole);
    roles.push(normalizedRole);
  };

  progress?.request?.expected_agents?.forEach(addRole);
  getSummaryAgentRoles(progress, "completed_roles").forEach(addRole);
  getSummaryAgentRoles(progress, "remaining_roles").forEach(addRole);
  getAgentRoleProgressSnapshots(progress).forEach((snapshot) => addRole(snapshot.role));
  getAgentRoleResultSnapshots(progress).forEach((snapshot) => addRole(snapshot.role));
  addRole(progress?.summary?.current_role);

  if (roles.length > 0) return roles;

  return [...DEFAULT_AGENT_ROLE_ORDER];
}

function getAgentRoleStatus(role: string, orderedRoles: string[], currentRole: string | null): AgentRoleStatus {
  if (currentRole === normalizeAgentRole(role)) return "running";
  if (!currentRole) return "pending";

  const roleIndex = orderedRoles.findIndex((candidate) => normalizeAgentRole(candidate) === normalizeAgentRole(role));
  const currentRoleIndex = orderedRoles.findIndex((candidate) => normalizeAgentRole(candidate) === currentRole);

  if (roleIndex >= 0 && currentRoleIndex >= 0 && roleIndex < currentRoleIndex) return "completed";
  return "pending";
}

function getAgentRoleSnapshotCount(snapshot: AgentRoleProgressSnapshot | null | undefined) {
  return snapshot?.completedCount ?? snapshot?.progressCount ?? null;
}

function buildAgentRoleMetrics(
  progress: AgentFeedbackProgressResponseDto | null,
  status: AgentRoleStatus,
  roleCompletedCount: number | null | undefined,
  snapshot: AgentRoleProgressSnapshot | null | undefined,
  copy: DashboardLiveCopy,
  numberLocale: string,
): AgentRoleMetric[] {
  if (!isAgentFeedbackProgressRunning(progress)) return [];

  const hasRoleSnapshot = snapshot !== null && snapshot !== undefined;
  const progressPercent = getAgentRoleProgressPercent(progress, status, roleCompletedCount, snapshot);
  const totalCount = hasNumber(snapshot?.totalCount)
    ? snapshot.totalCount
    : hasRoleSnapshot && status === "completed"
      ? getAgentRoleSnapshotCount(snapshot)
      : progress?.summary?.total_symbols;
  const failedCount = hasNumber(snapshot?.failedCount) ? snapshot.failedCount : progress?.summary?.failed_items;
  const metricCompletedCount =
    roleCompletedCount ??
    getAgentRoleSnapshotCount(snapshot) ??
    (getResolvedAgentProgressRunStatus(progress) === "running"
      ? progress?.summary?.processed_symbols
      : progress?.summary?.completed_symbols);

  return [
    {
      key: "progress",
      label: copy.agentFeedback.metrics.progress,
      value: formatAgentProgressPercentValueLabel(progressPercent, numberLocale),
    },
    {
      key: "total",
      label: copy.agentFeedback.metrics.total,
      value: formatAgentProgressCountLabel(totalCount, numberLocale),
    },
    {
      key: "failed",
      label: copy.agentFeedback.metrics.failed,
      value: formatAgentProgressCountLabel(failedCount, numberLocale),
    },
    {
      key: "completed",
      label: copy.agentFeedback.metrics.completed,
      value: formatAgentProgressCountLabel(metricCompletedCount, numberLocale),
    },
  ];
}

function getRecordStringValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && hasTextValue(value)) return value.trim();
  }

  return null;
}

function getRecordNumberValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }

  return null;
}

function normalizeAgentRoleCardStatus(value: unknown): AgentRoleStatus | null {
  if (typeof value !== "string") return null;

  switch (value.trim().toLowerCase()) {
    case "completed":
    case "complete":
    case "done":
    case "ready":
      return "completed";
    case "running":
    case "in_progress":
    case "processing":
    case "partial":
      return "running";
    case "pending":
    case "queued":
    case "idle":
      return "pending";
    case "stalled":
    case "failed":
    case "error":
    case "attention":
    case "needs_review":
    case "needs review":
      return "attention";
    default:
      return null;
  }
}

function extractAgentRoleSnapshot(role: string, value: unknown): AgentRoleProgressSnapshot | null {
  if (!isRecord(value)) return null;

  const completedCount = getRecordNumberValue(value, [
    "completed_symbols",
    "completed_count",
    "completed_feedback_count",
    "count",
  ]);
  const progressCount = getRecordNumberValue(value, [
    "processed_symbols",
    "processed_count",
    "completed_symbols",
    "completed_count",
    "completed_feedback_count",
    "count",
  ]);
  const totalCount = getRecordNumberValue(value, [
    "total_symbols",
    "expected_symbols",
    "total_count",
    "expected_count",
    "expected_feedback_count",
  ]);
  const failedCount = getRecordNumberValue(value, [
    "failed_items",
    "failed_symbols",
    "failed_count",
    "error_count",
    "errors",
  ]);
  const explicitStatus =
    normalizeAgentRoleCardStatus(
      getRecordStringValue(value, ["status", "run_status", "role_status", "progress_status", "boundary_status"]),
    );
  const status =
    explicitStatus ??
    ((hasNumber(progressCount) && progressCount > 0) || (hasNumber(completedCount) && completedCount > 0)
      ? "running"
      : "pending");
  const progressPercent =
    getAgentProgressPercentFromRecord(value) ?? getAgentProgressPercentFromCounts(progressCount, totalCount);

  return {
    role,
    status,
    completedCount,
    failedCount,
    progressCount,
    totalCount,
    progressPercent,
  };
}

function extractAgentRoleResultSnapshot(role: string, value: unknown): AgentRoleResultSnapshot | null {
  if (!isRecord(value)) return null;

  const requestedCount = getRecordNumberValue(value, ["requested_count", "requestedCount"]);
  const completedCount = getRecordNumberValue(value, ["completed_count", "completedCount"]);
  const errorCount = getRecordNumberValue(value, ["error_count", "errorCount"]);

  if (requestedCount === null && completedCount === null && errorCount === null) return null;

  return {
    role,
    requestedCount,
    completedCount,
    errorCount,
  };
}

function getAgentRoleResultSnapshots(progress: AgentFeedbackProgressResponseDto | null) {
  if (!progress) return [];

  const progressRecord = isRecord(progress) ? (progress as Record<string, unknown>) : null;
  const resultRecord = isRecord(progressRecord?.result) ? (progressRecord.result as Record<string, unknown>) : null;
  const source = resultRecord?.roles;

  if (Array.isArray(source)) {
    return source
      .map((item) => {
        if (!isRecord(item)) return null;
        const role = getRecordStringValue(item, ["role", "agent", "name", "label"]);
        if (!role) return null;
        return extractAgentRoleResultSnapshot(role, item);
      })
      .filter((item): item is AgentRoleResultSnapshot => item !== null);
  }

  if (!isRecord(source)) return [];

  return Object.entries(source)
    .map(([role, value]) => extractAgentRoleResultSnapshot(role, value))
    .filter((item): item is AgentRoleResultSnapshot => item !== null);
}

function getAgentRoleProgressSnapshots(progress: AgentFeedbackProgressResponseDto | null) {
  if (!progress) return [];

  const progressRecord = isRecord(progress) ? (progress as Record<string, unknown>) : null;
  const summaryRecord = isRecord(progressRecord?.summary)
    ? (progressRecord.summary as Record<string, unknown>)
    : null;
  const sources = [
    progressRecord?.role_progress,
    progressRecord?.roles,
    summaryRecord?.role_progress,
    summaryRecord?.roles,
    summaryRecord?.role_statuses,
  ];

  for (const source of sources) {
    if (Array.isArray(source)) {
      const snapshots = source
        .map((item) => {
          if (!isRecord(item)) return null;
          const role = getRecordStringValue(item, ["role", "agent", "name", "label"]);
          if (!role) return null;
          return extractAgentRoleSnapshot(role, item);
        })
        .filter((item): item is AgentRoleProgressSnapshot => item !== null);
      if (snapshots.length > 0) return snapshots;
      continue;
    }

    if (!isRecord(source)) continue;

    const snapshots = Object.entries(source)
      .map(([role, value]) => extractAgentRoleSnapshot(role, value))
      .filter((item): item is AgentRoleProgressSnapshot => item !== null);
    if (snapshots.length > 0) return snapshots;
  }

  return [];
}

function getSummaryAgentRoles(
  progress: AgentFeedbackProgressResponseDto | null,
  key: "completed_roles" | "remaining_roles",
) {
  const source = progress?.summary?.[key];
  if (!Array.isArray(source)) return [];

  return source
    .filter((item): item is string => typeof item === "string" && hasTextValue(item))
    .map((item) => item.trim());
}

function getCompletedAgentRoleSet(progress: AgentFeedbackProgressResponseDto | null) {
  return new Set(getSummaryAgentRoles(progress, "completed_roles").map((role) => normalizeAgentRole(role) ?? role));
}

function buildAgentRoleResultMetrics(
  snapshot: AgentRoleResultSnapshot,
  copy: DashboardLiveCopy,
  numberLocale: string,
): AgentRoleMetric[] {
  return [
    {
      key: "completed",
      label: copy.agentFeedback.metrics.completed,
      value: formatAgentProgressCountLabel(snapshot.completedCount, numberLocale),
    },
    {
      key: "errors",
      label: copy.agentFeedback.metrics.errors,
      value: formatAgentProgressCountLabel(snapshot.errorCount, numberLocale),
    },
  ];
}

function isCompletedAgentRoleResult(snapshot: AgentRoleResultSnapshot) {
  return snapshot.errorCount === 0;
}

function getAgentRoleResultProgressPercent(snapshot: AgentRoleResultSnapshot) {
  if (isCompletedAgentRoleResult(snapshot)) return 100;
  if (!hasNumber(snapshot.requestedCount) || snapshot.requestedCount <= 0) return null;

  const completedCount = hasNumber(snapshot.completedCount) ? snapshot.completedCount : 0;
  const errorCount = hasNumber(snapshot.errorCount) ? snapshot.errorCount : 0;
  return clampAgentProgressPercent(((completedCount + errorCount) / snapshot.requestedCount) * 100);
}

export function isSummarizerRole(role: string) {
  return (normalizeAgentRole(role) ?? "").includes("summarizer");
}

export function shouldShowAgentRoleProgress(role: AgentRoleCard) {
  return (
    isSummarizerRole(role.role) ||
    isDeciderRole(role.role) ||
    role.metrics.some((metric) => metric.key === "progress")
  );
}

function shouldShowAgentRoleMetrics(role: string, status: AgentRoleStatus, fallbackRole: string | null) {
  if (!isAgentRoleMetricCapable(role)) return false;
  if (status === "running") return true;
  return fallbackRole !== null && normalizeAgentRole(role) === fallbackRole;
}

function getRunningAgentRoleStatus(
  role: string,
  orderedRoles: string[],
  currentRole: string | null,
  snapshot: AgentRoleProgressSnapshot | null | undefined,
  completedRoles: Set<string>,
): AgentRoleStatus {
  const normalizedRole = normalizeAgentRole(role) ?? role;
  if (snapshot?.status === "attention") return "attention";
  if (currentRole === normalizedRole) return "running";
  if (completedRoles.has(normalizedRole)) return "completed";

  const roleIndex = orderedRoles.findIndex((candidate) => normalizeAgentRole(candidate) === normalizedRole);
  const currentRoleIndex =
    currentRole === null ? -1 : orderedRoles.findIndex((candidate) => normalizeAgentRole(candidate) === currentRole);

  if (roleIndex >= 0 && currentRoleIndex >= 0) {
    if (roleIndex < currentRoleIndex) return "completed";
    if (roleIndex > currentRoleIndex) return "pending";
  }

  if (snapshot?.status === "completed") return "completed";
  if (snapshot?.status === "running") return "running";
  if (
    (hasNumber(snapshot?.progressCount) && snapshot.progressCount > 0) ||
    (hasNumber(snapshot?.completedCount) && snapshot.completedCount > 0)
  ) {
    return "running";
  }

  return snapshot?.status ?? getAgentRoleStatus(role, orderedRoles, currentRole);
}

function getNonRunningAgentRoleStatus(
  runStatus: AgentFeedbackRunStatus | null,
  role: string,
  orderedRoles: string[],
  currentRole: string | null,
): AgentRoleStatus {
  if (runStatus === "completed") return "completed";
  if (runStatus === "pending" || runStatus === null) return "pending";
  if (runStatus !== "stalled" || !currentRole) return "attention";

  const roleIndex = orderedRoles.findIndex((candidate) => normalizeAgentRole(candidate) === normalizeAgentRole(role));
  const currentRoleIndex = orderedRoles.findIndex((candidate) => normalizeAgentRole(candidate) === currentRole);

  if (roleIndex >= 0 && currentRoleIndex >= 0) {
    if (roleIndex < currentRoleIndex) return "completed";
    if (roleIndex === currentRoleIndex) return "attention";
    return "pending";
  }

  return "attention";
}

function getNonRunningAgentRoleCompletedCount(
  progress: AgentFeedbackProgressResponseDto | null,
  runStatus: AgentFeedbackRunStatus | null,
  role: string,
  orderedRoles: string[],
  currentRole: string | null,
) {
  const totalSymbols = progress?.summary.total_symbols ?? null;
  const completedSymbols = progress?.summary.completed_symbols ?? null;

  if (runStatus === "completed") {
    return totalSymbols ?? completedSymbols;
  }

  if (runStatus === "pending" || runStatus === null) {
    return 0;
  }

  if (runStatus !== "stalled" || !currentRole) {
    return completedSymbols;
  }

  const roleIndex = orderedRoles.findIndex((candidate) => normalizeAgentRole(candidate) === normalizeAgentRole(role));
  const currentRoleIndex = orderedRoles.findIndex((candidate) => normalizeAgentRole(candidate) === currentRole);

  if (roleIndex >= 0 && currentRoleIndex >= 0) {
    if (roleIndex < currentRoleIndex) return totalSymbols;
    if (roleIndex === currentRoleIndex) return completedSymbols;
    return 0;
  }

  return completedSymbols;
}

function getAgentRoleProgressPercent(
  progress: AgentFeedbackProgressResponseDto | null,
  status: AgentRoleStatus,
  completedCount: number | null | undefined,
  snapshot: AgentRoleProgressSnapshot | null | undefined,
) {
  if (hasNumber(snapshot?.progressPercent)) return snapshot.progressPercent;

  const snapshotCountedPercent = getAgentProgressPercentFromCounts(snapshot?.progressCount, snapshot?.totalCount);
  if (snapshotCountedPercent !== null) return snapshotCountedPercent;

  if (status === "completed") return 100;
  if (status === "pending") return 0;

  const totalSymbols = progress?.summary.total_symbols ?? null;
  const countedPercent = getAgentProgressPercentFromCounts(completedCount, totalSymbols);
  if (countedPercent !== null) return countedPercent;

  return getAgentProgressPercentValue(progress);
}

function buildAgentRoleCard(
  progress: AgentFeedbackProgressResponseDto | null,
  role: string,
  status: AgentRoleStatus,
  completedCount: number | null | undefined,
  snapshot: AgentRoleProgressSnapshot | null | undefined,
  metrics: AgentRoleMetric[],
  copy: DashboardLiveCopy,
  numberLocale: string,
  progressPercentOverride: number | null = null,
): AgentRoleCard {
  const progressPercent =
    progressPercentOverride ?? getAgentRoleProgressPercent(progress, status, completedCount, snapshot);

  return {
    role,
    label: getAgentRoleLabel(role, copy),
    status,
    progressPercent,
    progressLabel: formatAgentProgressPercentValueLabel(progressPercent, numberLocale),
    metrics,
  };
}

export function buildAgentRoleCards(
  progress: AgentFeedbackProgressResponseDto | null,
  copy: DashboardLiveCopy,
  numberLocale: string,
): AgentRoleCard[] {
  const orderedRoles = getOrderedAgentRoles(progress);
  if (orderedRoles.length === 0) return [];

  const currentRole = normalizeAgentRole(progress?.summary?.current_role);
  const runStatus = getResolvedAgentProgressRunStatus(progress);
  const roleResultSnapshots = getAgentRoleResultSnapshots(progress);
  const roleResultSnapshotByRole = new Map(
    roleResultSnapshots.map((snapshot) => [normalizeAgentRole(snapshot.role) ?? snapshot.role, snapshot] as const),
  );
  const roleSnapshots = getAgentRoleProgressSnapshots(progress);
  const roleSnapshotByRole = new Map(
    roleSnapshots.map((snapshot) => [normalizeAgentRole(snapshot.role) ?? snapshot.role, snapshot] as const),
  );
  const completedRoles = getCompletedAgentRoleSet(progress);

  if (!isAgentFeedbackProgressRunning(progress)) {
    return orderedRoles.map((role) => {
      const normalizedRole = normalizeAgentRole(role) ?? role;
      const resultSnapshot = roleResultSnapshotByRole.get(normalizedRole);
      const snapshot = roleSnapshotByRole.get(normalizedRole);
      const fallbackStatus = getNonRunningAgentRoleStatus(runStatus, role, orderedRoles, currentRole);
      const status = resultSnapshot
        ? isCompletedAgentRoleResult(resultSnapshot)
          ? "completed"
          : fallbackStatus
        : snapshot?.status === "attention"
          ? "attention"
          : completedRoles.has(normalizedRole)
            ? "completed"
            : snapshot?.status ?? fallbackStatus;
      const completedCount =
        resultSnapshot?.completedCount ??
        getAgentRoleSnapshotCount(snapshot) ??
        getNonRunningAgentRoleCompletedCount(progress, runStatus, role, orderedRoles, currentRole);
      const metrics = resultSnapshot
        ? buildAgentRoleResultMetrics(resultSnapshot, copy, numberLocale)
        : [
            {
              key: "completed",
              label: copy.agentFeedback.metrics.complete,
              value: formatAgentProgressCountLabel(completedCount, numberLocale),
            },
          ];

      return buildAgentRoleCard(
        progress,
        role,
        status,
        completedCount,
        snapshot,
        metrics,
        copy,
        numberLocale,
        resultSnapshot ? getAgentRoleResultProgressPercent(resultSnapshot) : null,
      );
    });
  }

  const fallbackMetricsRole =
    currentRole === null
      ? normalizeAgentRole(orderedRoles.find((role) => isAgentRoleMetricCapable(role)) ?? orderedRoles[0])
      : null;

  return orderedRoles.map((role) => {
    const snapshot = roleSnapshotByRole.get(normalizeAgentRole(role) ?? role);
    const status = getRunningAgentRoleStatus(role, orderedRoles, currentRole, snapshot, completedRoles);
    const completedCount = getAgentRoleSnapshotCount(snapshot);
    const roleMetrics = shouldShowAgentRoleMetrics(role, status, fallbackMetricsRole)
      ? buildAgentRoleMetrics(progress, status, completedCount, snapshot, copy, numberLocale)
      : [];

    return buildAgentRoleCard(
      progress,
      role,
      status,
      completedCount,
      snapshot,
      roleMetrics,
      copy,
      numberLocale,
    );
  });
}

export function maskAgentRoleCardsAsWaiting(roleCards: AgentRoleCard[], numberLocale: string): AgentRoleCard[] {
  return roleCards.map((role) => ({
    ...role,
    status: "pending",
    progressPercent: 0,
    progressLabel: formatAgentProgressPercentValueLabel(0, numberLocale),
    metrics: [],
  }));
}

export function hasCompletedDefaultAgentRoles(roleCards: AgentRoleCard[]) {
  const completedRoles = new Set(
    roleCards
      .filter((role) => role.status === "completed")
      .map((role) => normalizeAgentRole(role.role) ?? role.role),
  );

  return DEFAULT_AGENT_ROLE_ORDER.every((role) => completedRoles.has(role));
}
