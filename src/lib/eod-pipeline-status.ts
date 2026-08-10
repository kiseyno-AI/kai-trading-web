import { normalizeDartFundamentalsMarketDate } from "@/lib/dart-fundamentals-daily";
import type {
  EodPipelineStageDto,
  EodPipelineStageKey,
  EodPipelineStatusResponseDto,
} from "@/types/trading-api";

export const EOD_PIPELINE_STATUS_UPSTREAM_PATH = "/eod/pipeline/status";
export const EOD_PIPELINE_STATUS_CLIENT_PATH = "/api/trading/eod/pipeline/status";
export const EOD_PIPELINE_STATUS_REQUEST_TIMEOUT_MS = 10_000;

const TRADING_API_UPSTREAM_NAMESPACES = new Set([
  "agent-context",
  "crypto",
  "disclosures",
  "eod",
  "execution",
  "market",
  "portfolio",
  "quotes",
  "scanner",
  "symbols",
]);

export function isPipelineApiInspectEndpoint(href: string) {
  const normalizedHref = href.trim();
  if (/(?:^|\/)api\/trading(?:[/?#]|$)/.test(normalizedHref)) return true;

  const upstreamPathMatch = normalizedHref.match(/^\/?([^/?#]+)\/[^/?#]+/);
  return upstreamPathMatch ? TRADING_API_UPSTREAM_NAMESPACES.has(upstreamPathMatch[1]) : false;
}

export const CANONICAL_EOD_PIPELINE_STAGE_ORDER = [
  "master_refresh",
  "pykrx_universe_refresh",
  "price_collection",
  "pykrx_enrichment",
  "technical_snapshots",
  "action_summaries",
  "trending_ranks",
  "signal_features",
  "market_risk_filter",
  "fundamentals_daily_refresh",
  "piotroski_filter",
  "momentum_factors",
  "value_factors",
  "low_risk_factors",
  "beta_factors",
  "advanced_value_factors",
  "unified_value_factors",
  "quality_factors",
  "composite_factors",
  "external_news_collect",
  "external_news_enrich",
  "agent_feedback_summaries",
  "signal_decider",
  "signal_decider_evaluations",
] as const satisfies readonly EodPipelineStageKey[];

export type CanonicalEodPipelineStageKey = (typeof CANONICAL_EOD_PIPELINE_STAGE_ORDER)[number];

export type DailyPipelineStageStatus =
  | "pending"
  | "blocked"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "skipped";

export type DailyPipelineProgressSource = "live_run_metadata" | "stored_rows" | "fallback_inference";

export type DailyPipelineInspectLink = {
  href: string;
  label: string;
};

export type DailyPipelineStageDependency = {
  key: string;
  label: string;
  status: DailyPipelineStageStatus | null;
};

export type DailyPipelineRunId = {
  key: string;
  value: string;
};

export type DailyPipelineStageModel = {
  key: CanonicalEodPipelineStageKey;
  label: string;
  order: number;
  status: DailyPipelineStageStatus;
  statusLabel: string;
  progressLabel: string;
  progressPercent: number;
  progressSource: DailyPipelineProgressSource;
  progressSourceLabel: string;
  reason: string;
  dependencies: DailyPipelineStageDependency[];
  blockingDependencies: DailyPipelineStageDependency[];
  failedBlockingDependencies: DailyPipelineStageDependency[];
  inspectLinks: DailyPipelineInspectLink[];
  sourceRunIds: DailyPipelineRunId[];
  sourceStatus: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  rowsPersisted: number | null;
  expectedRows: number | null;
};

export type DailyPipelineTimelineModel = {
  marketDate: string | null;
  status: DailyPipelineStageStatus;
  statusLabel: string;
  progressLabel: string;
  progressPercent: number;
  completedCount: number;
  totalCount: number;
  currentStage: DailyPipelineStageModel | null;
  hasLiveStatus: boolean;
  stages: DailyPipelineStageModel[];
};

type DailyPipelineStageDefinition = {
  key: CanonicalEodPipelineStageKey;
  label: string;
  dependencies: readonly CanonicalEodPipelineStageKey[];
  inspectLinks?: readonly DailyPipelineInspectLink[];
  aliases?: readonly string[];
};

const DAILY_PIPELINE_STATUS_LABELS = {
  pending: "Pending",
  blocked: "Blocked",
  running: "Running",
  completed: "Completed",
  partial: "Partial",
  failed: "Failed",
  skipped: "Skipped",
} as const satisfies Record<DailyPipelineStageStatus, string>;

const DAILY_PIPELINE_PROGRESS_SOURCE_LABELS = {
  live_run_metadata: "live run metadata",
  stored_rows: "stored rows",
  fallback_inference: "fallback inference",
} as const satisfies Record<DailyPipelineProgressSource, string>;

const PIPELINE_STATUS_TOKEN_MAP = new Map<string, DailyPipelineStageStatus>([
  ["available", "completed"],
  ["complete", "completed"],
  ["completed", "completed"],
  ["done", "completed"],
  ["ok", "completed"],
  ["ready", "completed"],
  ["success", "completed"],
  ["succeeded", "completed"],
  ["blocked", "blocked"],
  ["dependency blocked", "blocked"],
  ["dependency_blocked", "blocked"],
  ["waiting on dependency", "blocked"],
  ["active", "running"],
  ["in flight", "running"],
  ["in progress", "running"],
  ["in_progress", "running"],
  ["running", "running"],
  ["started", "running"],
  ["working", "running"],
  ["completed with errors", "partial"],
  ["completed_with_errors", "partial"],
  ["degraded", "partial"],
  ["needs review", "partial"],
  ["needs_review", "partial"],
  ["partial", "partial"],
  ["aborted", "failed"],
  ["cancelled", "failed"],
  ["canceled", "failed"],
  ["error", "failed"],
  ["failed", "failed"],
  ["interrupted", "failed"],
  ["stalled", "failed"],
  ["not started", "pending"],
  ["not_started", "pending"],
  ["pending", "pending"],
  ["queued", "pending"],
  ["waiting", "pending"],
  ["skipped", "skipped"],
]);

const DAILY_PIPELINE_STAGE_DEFINITIONS: readonly DailyPipelineStageDefinition[] = [
  {
    key: "master_refresh",
    label: "Master refresh",
    dependencies: [],
  },
  {
    key: "pykrx_universe_refresh",
    label: "PyKRX universe refresh",
    dependencies: ["master_refresh"],
  },
  {
    key: "price_collection",
    label: "Price collection",
    dependencies: ["pykrx_universe_refresh"],
    inspectLinks: [{ label: "Dashboard", href: "/dashboard" }],
  },
  {
    key: "pykrx_enrichment",
    label: "PyKRX enrichment",
    dependencies: ["price_collection"],
  },
  {
    key: "technical_snapshots",
    label: "Technical snapshots",
    dependencies: ["price_collection"],
    inspectLinks: [{ label: "Technical API", href: "/api/trading/eod/technical-snapshots" }],
  },
  {
    key: "action_summaries",
    label: "Action summaries",
    dependencies: ["technical_snapshots"],
    inspectLinks: [{ label: "Action API", href: "/api/trading/eod/action-summaries" }],
  },
  {
    key: "trending_ranks",
    label: "Trending ranks",
    dependencies: ["price_collection"],
    inspectLinks: [{ label: "Markets", href: "/markets" }],
  },
  {
    key: "signal_features",
    label: "Signal features",
    dependencies: ["technical_snapshots", "action_summaries", "trending_ranks"],
  },
  {
    key: "market_risk_filter",
    label: "Market risk filter",
    dependencies: ["signal_features"],
    aliases: ["market_risk_filters", "kis_market_risk_filter"],
    inspectLinks: [{ label: "KIS risk API", href: "/api/trading/eod/market-risk-filters" }],
  },
  {
    key: "fundamentals_daily_refresh",
    label: "DART fundamentals refresh",
    dependencies: ["master_refresh"],
    inspectLinks: [{ label: "DART inspect", href: "/api/trading/disclosures/dart/fundamentals/daily/inspect" }],
  },
  {
    key: "piotroski_filter",
    label: "Piotroski filter",
    dependencies: ["fundamentals_daily_refresh"],
    inspectLinks: [{ label: "Piotroski list", href: "/dashboard/piotroski-filter" }],
  },
  {
    key: "momentum_factors",
    label: "Momentum factors",
    dependencies: ["market_risk_filter"],
    aliases: ["momentum_scoring"],
    inspectLinks: [{ label: "Factor workspace", href: "/markets/factors" }],
  },
  {
    key: "value_factors",
    label: "Value factors",
    dependencies: ["fundamentals_daily_refresh"],
    inspectLinks: [{ label: "Factor workspace", href: "/markets/factors" }],
  },
  {
    key: "low_risk_factors",
    label: "Low risk factors",
    dependencies: ["market_risk_filter"],
    inspectLinks: [{ label: "Factor workspace", href: "/markets/factors" }],
  },
  {
    key: "beta_factors",
    label: "Beta factors",
    dependencies: ["market_risk_filter"],
    inspectLinks: [{ label: "Factor workspace", href: "/markets/factors" }],
  },
  {
    key: "advanced_value_factors",
    label: "Advanced value factors",
    dependencies: ["fundamentals_daily_refresh"],
    inspectLinks: [{ label: "Factor workspace", href: "/markets/factors" }],
  },
  {
    key: "unified_value_factors",
    label: "Unified value factors",
    dependencies: ["value_factors", "advanced_value_factors"],
    aliases: ["unified_value_scoring"],
    inspectLinks: [{ label: "Factor workspace", href: "/markets/factors" }],
  },
  {
    key: "quality_factors",
    label: "Quality factors",
    dependencies: ["fundamentals_daily_refresh"],
    aliases: ["quality_scoring"],
    inspectLinks: [{ label: "Factor workspace", href: "/markets/factors" }],
  },
  {
    key: "composite_factors",
    label: "Composite factors",
    dependencies: [
      "momentum_factors",
      "value_factors",
      "low_risk_factors",
      "beta_factors",
      "advanced_value_factors",
      "unified_value_factors",
      "quality_factors",
    ],
    inspectLinks: [{ label: "Factor workspace", href: "/markets/factors" }],
  },
  {
    key: "external_news_collect",
    label: "External news collect",
    dependencies: ["composite_factors"],
  },
  {
    key: "external_news_enrich",
    label: "External news enrich",
    dependencies: ["external_news_collect"],
  },
  {
    key: "agent_feedback_summaries",
    label: "Agent feedback summaries",
    dependencies: ["composite_factors", "external_news_enrich"],
    inspectLinks: [{ label: "Decider review", href: "/dashboard/signal-decider-feedback" }],
  },
  {
    key: "signal_decider",
    label: "Signal decider",
    dependencies: ["agent_feedback_summaries"],
    inspectLinks: [{ label: "Decider review", href: "/dashboard/signal-decider-feedback" }],
  },
  {
    key: "signal_decider_evaluations",
    label: "Signal decider evaluations",
    dependencies: ["signal_decider"],
    inspectLinks: [{ label: "Decider review", href: "/dashboard/signal-decider-feedback" }],
  },
];

export function buildEodPipelineStatusPath(basePath: string, marketDate: string | null | undefined) {
  const params = new URLSearchParams();
  const normalizedMarketDate = normalizeDartFundamentalsMarketDate(marketDate);

  if (normalizedMarketDate) {
    params.set("market_date", normalizedMarketDate);
  }

  return params.size > 0 ? `${basePath}?${params.toString()}` : basePath;
}

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeStatusToken(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ") ?? null;
}

export function normalizeDailyPipelineStatusToken(
  value: string | null | undefined,
): DailyPipelineStageStatus | null {
  const normalizedStatus = normalizeStatusToken(value);
  if (!normalizedStatus) return null;
  return PIPELINE_STATUS_TOKEN_MAP.get(normalizedStatus) ?? "pending";
}

export function isDailyPipelineStatusRunning(value: string | null | undefined) {
  return normalizeDailyPipelineStatusToken(value) === "running";
}

function getTextValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function humanizeToken(value: string, fallback = value) {
  const normalized = value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
  return normalized || fallback;
}

function formatCount(value: number, numberLocale: string) {
  return value.toLocaleString(numberLocale);
}

function formatProgressLabel(processed: number | null, total: number | null, numberLocale: string) {
  if (processed !== null && total !== null) return `${formatCount(processed, numberLocale)} / ${formatCount(total, numberLocale)}`;
  if (processed !== null) return formatCount(processed, numberLocale);
  if (total !== null) return `${formatCount(0, numberLocale)} / ${formatCount(total, numberLocale)}`;
  return null;
}

function formatStoredRowsProgressLabel(rowsPersisted: number, total: number | null, numberLocale: string) {
  if (total !== null && rowsPersisted > total) {
    return `${formatCount(rowsPersisted, numberLocale)} ${DAILY_PIPELINE_PROGRESS_SOURCE_LABELS.stored_rows}`;
  }

  return formatProgressLabel(rowsPersisted, total, numberLocale);
}

function formatStageProgressLabel({
  processed,
  progressSource,
  rowsPersisted,
  total,
  numberLocale,
}: {
  processed: number | null;
  progressSource: DailyPipelineProgressSource;
  rowsPersisted: number | null;
  total: number | null;
  numberLocale: string;
}) {
  if (progressSource === "stored_rows" && rowsPersisted !== null) {
    return formatStoredRowsProgressLabel(rowsPersisted, total, numberLocale);
  }

  return formatProgressLabel(processed, total, numberLocale);
}

function resolveStageStatus(
  stage: EodPipelineStageDto | null,
  rowsPersisted: number | null,
  expectedRows: number | null,
): DailyPipelineStageStatus {
  const rawStatus = getTextValue(stage?.status) ?? getTextValue(stage?.source_status);
  const normalizedStatus = normalizeDailyPipelineStatusToken(rawStatus);
  if (normalizedStatus) return normalizedStatus;

  if (!stage) return "pending";
  if (rowsPersisted !== null) {
    if (expectedRows !== null) {
      if (expectedRows === 0) return "skipped";
      if (rowsPersisted > 0) return "completed";
      return "pending";
    }
    if (rowsPersisted > 0) return "completed";
  }
  if (getNumberValue(stage.failed) !== null && getNumberValue(stage.failed)! > 0) return "partial";
  const processed = getNumberValue(stage.processed) ?? getNumberValue(stage.succeeded);
  const total = getNumberValue(stage.total);
  if (processed !== null && total !== null && total > 0) {
    if (processed >= total) return "completed";
    if (processed > 0) return "partial";
  }
  if (processed !== null || total !== null) return "pending";
  return "pending";
}

function getStageDetails(stage: EodPipelineStageDto | null) {
  return stage?.details && typeof stage.details === "object" ? stage.details : null;
}

function readStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string" || typeof item === "number") return String(item).trim();
        return null;
      })
      .filter((item): item is string => Boolean(item));
  }

  if (typeof value === "string") {
    return value
      .split(/[,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function mergeUniqueStrings(...values: string[][]) {
  return [...new Set(values.flat().filter(Boolean))];
}

function getDefinitionByKey(key: string) {
  return DAILY_PIPELINE_STAGE_DEFINITIONS.find((definition) => definition.key === key) ?? null;
}

function isCanonicalStageKey(value: unknown): value is CanonicalEodPipelineStageKey {
  return (
    typeof value === "string" &&
    CANONICAL_EOD_PIPELINE_STAGE_ORDER.includes(value as CanonicalEodPipelineStageKey)
  );
}

function getPipelineStageDefinitions(
  pipelineStatus: EodPipelineStatusResponseDto | null,
): readonly DailyPipelineStageDefinition[] {
  const stageOrder = Array.isArray(pipelineStatus?.stage_order) ? pipelineStatus.stage_order : [];
  const coreOrderedDefinitions = stageOrder
    .filter(isCanonicalStageKey)
    .map((key) => {
      const fallback = getDefinitionByKey(key);
      const reportedStage = pipelineStatus?.stages?.[key] ?? null;
      const details = getStageDetails(reportedStage);
      const reportedDependencies = readStringList(reportedStage?.depends_on ?? details?.depends_on)
        .filter(isCanonicalStageKey);
      return {
        key,
        label: getTextValue(reportedStage?.label) ?? fallback?.label ?? humanizeToken(key),
        dependencies: reportedDependencies.length > 0 ? reportedDependencies : (fallback?.dependencies ?? []),
        inspectLinks: fallback?.inspectLinks,
        aliases: fallback?.aliases,
      } satisfies DailyPipelineStageDefinition;
    });

  if (coreOrderedDefinitions.length === CANONICAL_EOD_PIPELINE_STAGE_ORDER.length) {
    return coreOrderedDefinitions;
  }

  return DAILY_PIPELINE_STAGE_DEFINITIONS;
}

function getStageLabel(key: string) {
  return getDefinitionByKey(key)?.label ?? humanizeToken(key);
}

function getReportedStage(
  pipelineStatus: EodPipelineStatusResponseDto | null,
  definition: DailyPipelineStageDefinition,
): EodPipelineStageDto | null {
  const stages = pipelineStatus?.stages as Record<string, EodPipelineStageDto | undefined> | undefined;
  if (!stages) return null;

  return (
    stages[definition.key] ??
    definition.aliases?.map((alias) => stages[alias]).find((stage): stage is EodPipelineStageDto => Boolean(stage)) ??
    null
  );
}

function getStageDependencies(definition: DailyPipelineStageDefinition, stage: EodPipelineStageDto | null) {
  const details = getStageDetails(stage);
  return mergeUniqueStrings(
    [...definition.dependencies],
    readStringList(stage?.depends_on),
    readStringList(stage?.dependencies),
    readStringList(details?.depends_on),
    readStringList(details?.dependencies),
  );
}

function getStageBlockingDependencyKeys(stage: EodPipelineStageDto | null) {
  const details = getStageDetails(stage);
  return mergeUniqueStrings(
    readStringList(stage?.blocking_stages),
    readStringList(stage?.blocking_dependencies),
    readStringList(stage?.failed_blocking_stages),
    readStringList(stage?.failed_blocking_dependencies),
    readStringList(details?.blocking_stages),
    readStringList(details?.blocking_dependencies),
    readStringList(details?.failed_blocking_stages),
    readStringList(details?.failed_blocking_dependencies),
  );
}

function getStageFailedBlockingDependencyKeys(stage: EodPipelineStageDto | null) {
  const details = getStageDetails(stage);
  return mergeUniqueStrings(
    readStringList(stage?.failed_blocking_stages),
    readStringList(stage?.failed_blocking_dependencies),
    readStringList(details?.failed_blocking_stages),
    readStringList(details?.failed_blocking_dependencies),
  );
}

function buildDependencyModel(
  key: string,
  stageModelsByKey: Map<string, DailyPipelineStageModel>,
): DailyPipelineStageDependency {
  const stage = stageModelsByKey.get(key);
  return {
    key,
    label: stage?.label ?? getStageLabel(key),
    status: stage?.status ?? null,
  };
}

function isDependencyBlocking(status: DailyPipelineStageStatus | null) {
  return status === "blocked" || status === "failed" || status === "partial";
}

function isDependencyIncomplete(status: DailyPipelineStageStatus | null) {
  return status !== "completed" && status !== "skipped";
}

function normalizeProgressSource(value: string | null | undefined): DailyPipelineProgressSource | null {
  const normalized = normalizeStatusToken(value);
  if (!normalized) return null;
  if (normalized.includes("stored") || normalized.includes("row")) return "stored_rows";
  if (normalized.includes("live") || normalized.includes("run") || normalized.includes("metadata")) return "live_run_metadata";
  if (normalized.includes("infer") || normalized.includes("fallback")) return "fallback_inference";
  return null;
}

function hasLiveRunMetadata(stage: EodPipelineStageDto | null) {
  if (!stage) return false;
  return Boolean(
    hasTextValue(stage.status) ||
      hasTextValue(stage.source_status) ||
      hasTextValue(stage.current_step) ||
      hasTextValue(stage.current_activity) ||
      hasTextValue(stage.current_symbol) ||
      hasTextValue(stage.current_period) ||
      getNumberValue(stage.processed) !== null ||
      getNumberValue(stage.total) !== null ||
      getNumberValue(stage.succeeded) !== null ||
      getNumberValue(stage.failed) !== null ||
      stage.source_run_ids ||
      stage.run_id ||
      stage.eod_run_id,
  );
}

function resolveProgressSource(
  stage: EodPipelineStageDto | null,
  status: DailyPipelineStageStatus,
  rowsPersisted: number | null,
): DailyPipelineProgressSource {
  if (status === "running" && hasLiveRunMetadata(stage)) return "live_run_metadata";

  const details = getStageDetails(stage);
  const explicitSource = normalizeProgressSource(getTextValue(details?.progress_source) ?? getTextValue(stage?.source_status));
  if (explicitSource) return explicitSource;
  if (rowsPersisted !== null) return "stored_rows";
  if (hasLiveRunMetadata(stage)) return "live_run_metadata";
  return "fallback_inference";
}

function getRowsPersisted(stage: EodPipelineStageDto | null) {
  return getNumberValue(getStageDetails(stage)?.rows_persisted);
}

function getExpectedRows(stage: EodPipelineStageDto | null) {
  return getNumberValue(getStageDetails(stage)?.expected_rows);
}

function getStageProcessedCount(
  stage: EodPipelineStageDto | null,
  rowsPersisted: number | null,
  progressSource: DailyPipelineProgressSource,
) {
  if (progressSource === "stored_rows" && rowsPersisted !== null) return rowsPersisted;
  return (
    getNumberValue(stage?.processed) ??
    getNumberValue(stage?.succeeded) ??
    rowsPersisted
  );
}

function getStageTotalCount(stage: EodPipelineStageDto | null, expectedRows: number | null) {
  return getNumberValue(stage?.total) ?? expectedRows;
}

function getProgressPercent(
  status: DailyPipelineStageStatus,
  processed: number | null,
  total: number | null,
) {
  if (total !== null && total > 0 && processed !== null) {
    return clampPercent((processed / total) * 100);
  }

  if (status === "completed" || status === "skipped") return 100;
  if (status === "partial") return 70;
  if (status === "running") return 40;
  return 0;
}

function getExplicitStageReason(stage: EodPipelineStageDto | null) {
  const details = getStageDetails(stage);
  const missingCount = getNumberValue(details?.missing_count);
  const missingSymbols = readStringList(details?.missing_symbols_sample).slice(0, 4);
  const missingSuffix =
    missingCount !== null && missingCount > 0
      ? ` Missing ${missingCount.toLocaleString()} symbol${missingCount === 1 ? "" : "s"}${missingSymbols.length > 0 ? `: ${missingSymbols.join(", ")}` : ""}.`
      : "";
  const explicitReason =
    getTextValue(details?.reason) ??
    getTextValue(details?.message) ??
    getTextValue(details?.failure_reason) ??
    getTextValue(details?.error_message) ??
    getTextValue(details?.skipped_reason) ??
    getTextValue(stage?.reason) ??
    getTextValue(stage?.message) ??
    getTextValue(stage?.failure_reason) ??
    getTextValue(stage?.error_message);

  if (explicitReason) return `${explicitReason}${missingSuffix}`.trim();
  if (missingSuffix) return missingSuffix.trim();

  return (
    null
  );
}

function getStageActivityLabel(stage: EodPipelineStageDto | null) {
  const parts = [
    getTextValue(stage?.current_step),
    getTextValue(stage?.current_activity),
    getTextValue(stage?.current_symbol) ? `Symbol ${getTextValue(stage?.current_symbol)}` : null,
    getTextValue(stage?.current_period),
  ].filter((item): item is string => Boolean(item));

  return parts.length > 0 ? parts.join(" · ") : null;
}

function getStageReason({
  blockingDependencies,
  expectedRows,
  explicitReason,
  progressSource,
  rowsPersisted,
  stage,
  status,
}: {
  blockingDependencies: DailyPipelineStageDependency[];
  expectedRows: number | null;
  explicitReason: string | null;
  progressSource: DailyPipelineProgressSource;
  rowsPersisted: number | null;
  stage: EodPipelineStageDto | null;
  status: DailyPipelineStageStatus;
}) {
  if (explicitReason) return explicitReason;

  if (status === "blocked") {
    const blockers = blockingDependencies.map((dependency) => dependency.label).join(", ");
    return blockers ? `Blocked by ${blockers}.` : "Blocked by an upstream prerequisite.";
  }

  if (status === "running") {
    const activity = getStageActivityLabel(stage);
    if (rowsPersisted === 0) {
      return activity
        ? `${activity}. Running from live run metadata; stored rows are still 0.`
        : "Running from live run metadata; stored rows are still 0.";
    }
    return activity ?? "Running from live run metadata.";
  }

  if (status === "completed") {
    if (progressSource === "stored_rows") return "Completed from stored row evidence.";
    return "Completed from pipeline metadata.";
  }

  if (status === "partial") return "Completed partially or with reported errors.";
  if (status === "failed") return "Pipeline metadata reports an interrupted or failed stage.";
  if (status === "skipped") return "Skipped by pipeline metadata.";
  if (expectedRows === 0) return "No expected rows for this stage.";
  return "Waiting to start after dependencies complete.";
}

function formatRunIdValue(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getSourceRunIds(stage: EodPipelineStageDto | null): DailyPipelineRunId[] {
  if (!stage) return [];

  const runIds: DailyPipelineRunId[] = [];
  const addRunId = (key: string, value: unknown) => {
    const formattedValue = formatRunIdValue(value);
    if (!formattedValue) return;
    runIds.push({ key, value: formattedValue });
  };

  addRunId("eod_run_id", stage.eod_run_id);
  addRunId("run_id", stage.run_id);

  if (Array.isArray(stage.source_run_ids)) {
    stage.source_run_ids.forEach((value, index) => addRunId(`source_${index + 1}`, value));
  } else if (stage.source_run_ids && typeof stage.source_run_ids === "object") {
    Object.entries(stage.source_run_ids).forEach(([key, value]) => addRunId(key, value));
  }

  const seen = new Set<string>();
  return runIds.filter((runId) => {
    const token = `${runId.key}:${runId.value}`;
    if (seen.has(token)) return false;
    seen.add(token);
    return true;
  });
}

function getStageInspectLinks(definition: DailyPipelineStageDefinition, stage: EodPipelineStageDto | null) {
  const details = getStageDetails(stage);
  const explicitHref = getTextValue(details?.inspect_href) ?? getTextValue(details?.inspect_path);
  const links = [...(definition.inspectLinks ?? [])];
  const inspectRoutes = readStringList(stage?.inspect_routes ?? details?.inspect_routes);
  inspectRoutes.forEach((route) => {
    const href = route.startsWith("/api/trading") ? route : `/api/trading${route.startsWith("/") ? route : `/${route}`}`;
    if (!links.some((link) => link.href === href)) {
      links.push({ label: humanizeToken(route.split("/").filter(Boolean).at(-1) ?? "Inspect"), href });
    }
  });
  if (explicitHref && !links.some((link) => link.href === explicitHref)) {
    links.unshift({ label: "Inspect", href: explicitHref });
  }
  if (!links.some((link) => link.href === EOD_PIPELINE_STATUS_CLIENT_PATH)) {
    links.push({ label: "Pipeline API", href: EOD_PIPELINE_STATUS_CLIENT_PATH });
  }
  return links;
}

function hasReportedStageEvidence(stage: DailyPipelineStageModel) {
  return Boolean(
    stage.sourceStatus ??
    stage.startedAt ??
    stage.updatedAt ??
    stage.completedAt ??
    stage.rowsPersisted ??
    stage.expectedRows ??
    stage.sourceRunIds.length,
  );
}

function getTimelineCurrentStage(
  stages: DailyPipelineStageModel[],
  hasLiveStatus: boolean,
  timelineStatus: DailyPipelineStageStatus,
  pipelineStatus: EodPipelineStatusResponseDto | null,
) {
  if (!hasLiveStatus) return null;
  const reportedCurrentStage = getTextValue(pipelineStatus?.current_stage);
  const reportedCurrent = reportedCurrentStage
    ? stages.find((stage) => stage.key === reportedCurrentStage)
    : null;
  if (reportedCurrent) return reportedCurrent;

  const reportedStages = stages.filter(hasReportedStageEvidence);
  const pendingCurrentStage = timelineStatus === "running"
    ? stages.find((stage) => stage.status === "pending")
    : null;

  return (
    reportedStages.find((stage) => stage.status === "running") ??
    reportedStages.find((stage) => stage.status === "failed") ??
    reportedStages.find((stage) => stage.status === "blocked") ??
    reportedStages.find((stage) => stage.status === "partial") ??
    pendingCurrentStage ??
    null
  );
}

function getTimelineStatus(
  stages: readonly DailyPipelineStageModel[],
  pipelineStatus: EodPipelineStatusResponseDto | null,
): DailyPipelineStageStatus {
  const reportedStatus = normalizeDailyPipelineStatusToken(pipelineStatus?.status);
  if (reportedStatus === "running" || reportedStatus === "failed" || reportedStatus === "partial") return reportedStatus;
  if (stages.some((stage) => stage.status === "running")) return "running";
  if (stages.some((stage) => stage.status === "failed")) return "failed";
  if (stages.some((stage) => stage.status === "blocked")) return "blocked";
  if (stages.some((stage) => stage.status === "partial")) return "partial";
  if (stages.length > 0 && stages.every((stage) => stage.status === "completed" || stage.status === "skipped")) {
    return "completed";
  }
  return reportedStatus ?? "pending";
}

export function buildDailyPipelineTimelineModel(
  pipelineStatus: EodPipelineStatusResponseDto | null,
  numberLocale: string,
): DailyPipelineTimelineModel {
  const stageModelsByKey = new Map<string, DailyPipelineStageModel>();
  const hasLiveStatus = Boolean(pipelineStatus);
  const stageDefinitions = getPipelineStageDefinitions(pipelineStatus);

  const stages = stageDefinitions.map((definition, index) => {
    const reportedStage = getReportedStage(pipelineStatus, definition);
    const rowsPersisted = getRowsPersisted(reportedStage);
    const expectedRows = getExpectedRows(reportedStage);
    const baseStatus = resolveStageStatus(reportedStage, rowsPersisted, expectedRows);
    const dependencies = getStageDependencies(definition, reportedStage).map((key) =>
      buildDependencyModel(key, stageModelsByKey),
    );
    const explicitBlockingKeys = getStageBlockingDependencyKeys(reportedStage);
    const failedBlockingKeys = getStageFailedBlockingDependencyKeys(reportedStage);
    const inferredBlockingDependencies = dependencies.filter((dependency) =>
      baseStatus === "blocked"
        ? isDependencyIncomplete(dependency.status)
        : isDependencyBlocking(dependency.status),
    );
    const explicitBlockingDependencies = explicitBlockingKeys.map((key) => buildDependencyModel(key, stageModelsByKey));
    const blockingDependencies =
      explicitBlockingDependencies.length > 0 ? explicitBlockingDependencies : inferredBlockingDependencies;
    const failedBlockingDependencies = failedBlockingKeys.length > 0
      ? failedBlockingKeys.map((key) => buildDependencyModel(key, stageModelsByKey))
      : blockingDependencies.filter((dependency) => isDependencyBlocking(dependency.status));
    const status =
      baseStatus === "pending" && blockingDependencies.length > 0
        ? "blocked"
        : baseStatus;
    const progressSource = resolveProgressSource(reportedStage, status, rowsPersisted);
    const processedCount = getStageProcessedCount(reportedStage, rowsPersisted, progressSource);
    const totalCount = getStageTotalCount(reportedStage, expectedRows);
    const completedProcessedCount =
      status === "completed" && processedCount === null && totalCount !== null ? totalCount : processedCount;
    const progressLabel =
      formatStageProgressLabel({
        processed: completedProcessedCount,
        progressSource,
        rowsPersisted,
        total: totalCount,
        numberLocale,
      }) ??
      DAILY_PIPELINE_STATUS_LABELS[status];
    const progressPercent = getProgressPercent(status, completedProcessedCount, totalCount);
    const explicitReason = getExplicitStageReason(reportedStage);
    const stageModel: DailyPipelineStageModel = {
      key: definition.key,
      label: getTextValue(reportedStage?.label) ?? definition.label,
      order: getNumberValue(reportedStage?.order) ?? index + 1,
      status,
      statusLabel: DAILY_PIPELINE_STATUS_LABELS[status],
      progressLabel,
      progressPercent,
      progressSource,
      progressSourceLabel: DAILY_PIPELINE_PROGRESS_SOURCE_LABELS[progressSource],
      reason: getStageReason({
        blockingDependencies,
        expectedRows,
        explicitReason,
        progressSource,
        rowsPersisted,
        stage: reportedStage,
        status,
      }),
      dependencies,
      blockingDependencies,
      failedBlockingDependencies,
      inspectLinks: getStageInspectLinks(definition, reportedStage),
      sourceRunIds: getSourceRunIds(reportedStage),
      sourceStatus: getTextValue(reportedStage?.source_status) ?? getTextValue(reportedStage?.status),
      startedAt: getTextValue(reportedStage?.started_at),
      updatedAt: getTextValue(reportedStage?.updated_at),
      completedAt: getTextValue(reportedStage?.completed_at),
      rowsPersisted,
      expectedRows,
    };

    stageModelsByKey.set(definition.key, stageModel);
    return stageModel;
  });
  const status = getTimelineStatus(stages, pipelineStatus);
  const completedCount =
    getNumberValue(pipelineStatus?.display_completed_stages) ??
    stages.filter((stage) => stage.status === "completed" || stage.status === "skipped").length;
  const totalCount = getNumberValue(pipelineStatus?.total_stages) ?? stages.length;

  return {
    marketDate: pipelineStatus?.market_date ?? null,
    status,
    statusLabel: DAILY_PIPELINE_STATUS_LABELS[status],
    progressLabel: `${formatCount(completedCount, numberLocale)} / ${formatCount(totalCount, numberLocale)}`,
    progressPercent: totalCount > 0 ? clampPercent((completedCount / totalCount) * 100) : 0,
    completedCount,
    totalCount,
    currentStage: getTimelineCurrentStage(stages, hasLiveStatus, status, pipelineStatus),
    hasLiveStatus,
    stages,
  };
}
