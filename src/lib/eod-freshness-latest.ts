import type { EodFreshnessResponseDto } from "@/types/trading-api";

export type LatestEodPatchStageKey =
  | "price"
  | "technical_analysis"
  | "action_summary"
  | "fundamentals"
  | "unknown";

export type LatestEodPatchStageDetail = {
  key: LatestEodPatchStageKey;
  sourceKey: string;
  tradeDate: string | null;
  updatedAt: string | null;
  status: string | null;
  symbolsTotal: number | null;
  symbolsSucceeded: number | null;
  symbolsFailed: number | null;
};

export type LatestEodPatchSummary = {
  tradeDate: string | null;
  updatedAt: string | null;
  status: string | null;
  symbolsTotal: number | null;
  symbolsSucceeded: number | null;
  symbolsFailed: number | null;
  stageDetails: LatestEodPatchStageDetail[];
};

const STAGE_DETAIL_SOURCE_KEYS = ["stages", "stage_details", "stageDetails"] as const;
const SUMMARY_SOURCE_KEYS = ["summary", "aggregate", "overview"] as const;
const STATUS_KEYS = ["eod_status", "status", "run_status", "state"] as const;
const UPDATED_AT_KEYS = ["updated_at", "completed_at", "last_updated_at", "finished_at", "ended_at", "as_of"] as const;
const TRADE_DATE_KEYS = ["trade_date", "market_date", "latest_date", "date"] as const;
const TOTAL_KEYS = ["symbols_total", "total", "requested_count", "expected_count", "expected_symbols"] as const;
const SUCCEEDED_KEYS = [
  "symbols_succeeded",
  "succeeded",
  "completed_count",
  "processed",
  "symbols_checked",
  "checked",
] as const;
const FAILED_KEYS = ["symbols_failed", "failed", "error_count", "errors"] as const;

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getTextValue(record: Record<string, unknown> | null, keys: readonly string[]) {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && hasTextValue(value)) {
      return value.trim();
    }
  }

  return null;
}

function getNumberValue(record: Record<string, unknown> | null, keys: readonly string[]) {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function getNestedRecord(record: Record<string, unknown> | null, keys: readonly string[]) {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (isRecord(value)) {
      return value;
    }
  }

  return null;
}

function normalizeStageKey(key: string): LatestEodPatchStageKey {
  const normalized = key.trim().toLowerCase();

  if (["price", "price_collection", "price_fetch"].includes(normalized)) {
    return "price";
  }
  if (["technical", "technical_analysis", "technical_snapshot", "technical_snapshots"].includes(normalized)) {
    return "technical_analysis";
  }
  if (["action", "action_summary", "action_summaries"].includes(normalized)) {
    return "action_summary";
  }
  if (["fundamental", "fundamentals", "fundamentals_daily_refresh"].includes(normalized)) {
    return "fundamentals";
  }

  return "unknown";
}

function getStageTradeDate(detail: Record<string, unknown> | null, stageKey: LatestEodPatchStageKey) {
  const stageDateKeys =
    stageKey === "price"
      ? ["price_trade_date", ...TRADE_DATE_KEYS]
      : stageKey === "technical_analysis"
        ? ["technical_market_date", ...TRADE_DATE_KEYS]
        : stageKey === "action_summary"
          ? ["action_market_date", ...TRADE_DATE_KEYS]
          : TRADE_DATE_KEYS;

  return getTextValue(detail, stageDateKeys);
}

function buildStageDetail(sourceKey: string, source: unknown): LatestEodPatchStageDetail | null {
  if (!isRecord(source)) return null;

  const summary = getNestedRecord(source, SUMMARY_SOURCE_KEYS);
  const normalizedKey = normalizeStageKey(sourceKey);
  const detail = summary ?? source;
  const tradeDate = getStageTradeDate(detail, normalizedKey) ?? getStageTradeDate(source, normalizedKey);
  const updatedAt = getTextValue(detail, UPDATED_AT_KEYS) ?? getTextValue(source, UPDATED_AT_KEYS);
  const status = getTextValue(detail, STATUS_KEYS) ?? getTextValue(source, STATUS_KEYS);
  const symbolsTotal = getNumberValue(detail, TOTAL_KEYS) ?? getNumberValue(source, TOTAL_KEYS);
  const symbolsSucceeded = getNumberValue(detail, SUCCEEDED_KEYS) ?? getNumberValue(source, SUCCEEDED_KEYS);
  const symbolsFailed = getNumberValue(detail, FAILED_KEYS) ?? getNumberValue(source, FAILED_KEYS);

  if (
    tradeDate === null &&
    updatedAt === null &&
    status === null &&
    symbolsTotal === null &&
    symbolsSucceeded === null &&
    symbolsFailed === null
  ) {
    return null;
  }

  return {
    key: normalizedKey,
    sourceKey,
    tradeDate,
    updatedAt,
    status,
    symbolsTotal,
    symbolsSucceeded,
    symbolsFailed,
  };
}

function mergeStageDetail(
  current: LatestEodPatchStageDetail,
  next: LatestEodPatchStageDetail,
): LatestEodPatchStageDetail {
  return {
    key: current.key,
    sourceKey: current.sourceKey,
    tradeDate: current.tradeDate ?? next.tradeDate,
    updatedAt: current.updatedAt ?? next.updatedAt,
    status: current.status ?? next.status,
    symbolsTotal: current.symbolsTotal ?? next.symbolsTotal,
    symbolsSucceeded: current.symbolsSucceeded ?? next.symbolsSucceeded,
    symbolsFailed: current.symbolsFailed ?? next.symbolsFailed,
  };
}

function sortStageDetails(stageDetails: LatestEodPatchStageDetail[]) {
  const stageOrder: Record<LatestEodPatchStageKey, number> = {
    price: 0,
    technical_analysis: 1,
    action_summary: 2,
    fundamentals: 3,
    unknown: 4,
  };

  return [...stageDetails].sort((left, right) => {
    const orderDiff = stageOrder[left.key] - stageOrder[right.key];
    if (orderDiff !== 0) return orderDiff;
    return left.sourceKey.localeCompare(right.sourceKey);
  });
}

function getLatestStageDetails(freshness: EodFreshnessResponseDto | null) {
  const latest = freshness?.latest;
  if (!isRecord(latest)) return [];

  const stageDetailsByKey = new Map<string, LatestEodPatchStageDetail>();
  const addStageDetail = (sourceKey: string, source: unknown) => {
    const detail = buildStageDetail(sourceKey, source);
    if (!detail) return;

    const mapKey = detail.key === "unknown" ? detail.sourceKey : detail.key;
    const existing = stageDetailsByKey.get(mapKey);
    stageDetailsByKey.set(mapKey, existing ? mergeStageDetail(existing, detail) : detail);
  };

  for (const sourceKey of STAGE_DETAIL_SOURCE_KEYS) {
    const source = latest[sourceKey];
    if (!isRecord(source)) continue;

    for (const [stageKey, value] of Object.entries(source)) {
      addStageDetail(stageKey, value);
    }
  }

  for (const directKey of [
    "price",
    "technical_analysis",
    "technical",
    "action_summary",
    "action",
    "fundamentals",
    "fundamental",
  ]) {
    addStageDetail(directKey, latest[directKey]);
  }

  return sortStageDetails([...stageDetailsByKey.values()]);
}

function getPreferredAggregateStage(stageDetails: LatestEodPatchStageDetail[]) {
  for (const preferredKey of ["price", "technical_analysis", "action_summary", "fundamentals"] as const) {
    const detail = stageDetails.find((item) => item.key === preferredKey);
    if (
      detail &&
      (detail.tradeDate !== null ||
        detail.updatedAt !== null ||
        detail.status !== null ||
        detail.symbolsTotal !== null ||
        detail.symbolsSucceeded !== null ||
        detail.symbolsFailed !== null)
    ) {
      return detail;
    }
  }

  return stageDetails.find(
    (detail) =>
      detail.tradeDate !== null ||
      detail.updatedAt !== null ||
      detail.status !== null ||
      detail.symbolsTotal !== null ||
      detail.symbolsSucceeded !== null ||
      detail.symbolsFailed !== null,
  ) ?? null;
}

function getLatestStageUpdatedAt(stageDetails: LatestEodPatchStageDetail[]) {
  const updatedAtValues = stageDetails
    .map((detail) => detail.updatedAt)
    .filter((value): value is string => hasTextValue(value));

  if (updatedAtValues.length === 0) return null;

  const datedValues = updatedAtValues
    .map((value) => ({ value, time: Date.parse(value) }))
    .filter((entry) => Number.isFinite(entry.time));

  if (datedValues.length === 0) {
    return updatedAtValues[0] ?? null;
  }

  datedValues.sort((left, right) => right.time - left.time);
  return datedValues[0]?.value ?? null;
}

function getLatestSummaryRecord(freshness: EodFreshnessResponseDto | null) {
  const latest = freshness?.latest;
  if (!isRecord(latest)) return null;
  return getNestedRecord(latest, SUMMARY_SOURCE_KEYS);
}

function getLatestRecord(freshness: EodFreshnessResponseDto | null) {
  const latest = freshness?.latest;
  return isRecord(latest) ? latest : null;
}

function deriveLatestStatus(
  explicitStatus: string | null,
  failedCount: number | null,
  totalCount: number | null,
  succeededCount: number | null,
  stageDetails: LatestEodPatchStageDetail[],
) {
  if (hasTextValue(explicitStatus)) return explicitStatus;
  if (typeof failedCount === "number" && failedCount > 0) return "completed_with_errors";
  if (typeof totalCount === "number" && totalCount > 0 && typeof succeededCount === "number") {
    return succeededCount >= totalCount ? "completed" : "running";
  }

  const stageStatuses = stageDetails
    .map((detail) => detail.status?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));
  if (stageStatuses.some((value) => value === "running")) return "running";
  if (
    stageStatuses.some((value) =>
      ["completed_with_errors", "partial", "failed", "error", "needs_review", "needs review"].includes(value),
    )
  ) {
    return "completed_with_errors";
  }
  if (stageStatuses.some((value) => ["ready", "completed", "available", "success"].includes(value))) {
    return "completed";
  }

  return null;
}

export function getLatestEodPatchSummary(freshness: EodFreshnessResponseDto | null): LatestEodPatchSummary | null {
  if (!freshness?.latest) return null;

  const latestRecord = getLatestRecord(freshness);
  const summaryRecord = getLatestSummaryRecord(freshness);
  const stageDetails = getLatestStageDetails(freshness);
  const aggregateStage = getPreferredAggregateStage(stageDetails);

  const tradeDate =
    getTextValue(summaryRecord, TRADE_DATE_KEYS) ??
    getTextValue(latestRecord, ["trade_date", "market_date", "latest_date", "price_trade_date"]) ??
    aggregateStage?.tradeDate ??
    null;
  const updatedAt =
    getTextValue(summaryRecord, UPDATED_AT_KEYS) ??
    getTextValue(latestRecord, UPDATED_AT_KEYS) ??
    getLatestStageUpdatedAt(stageDetails);
  const symbolsTotal =
    getNumberValue(summaryRecord, TOTAL_KEYS) ??
    getNumberValue(latestRecord, TOTAL_KEYS) ??
    aggregateStage?.symbolsTotal ??
    null;
  const symbolsSucceeded =
    getNumberValue(summaryRecord, SUCCEEDED_KEYS) ??
    getNumberValue(latestRecord, SUCCEEDED_KEYS) ??
    aggregateStage?.symbolsSucceeded ??
    null;
  const symbolsFailed =
    getNumberValue(summaryRecord, FAILED_KEYS) ??
    getNumberValue(latestRecord, FAILED_KEYS) ??
    aggregateStage?.symbolsFailed ??
    null;
  const explicitStatus =
    getTextValue(summaryRecord, STATUS_KEYS) ??
    getTextValue(latestRecord, STATUS_KEYS) ??
    aggregateStage?.status ??
    null;
  const status = deriveLatestStatus(
    explicitStatus,
    symbolsFailed,
    symbolsTotal,
    symbolsSucceeded,
    stageDetails,
  );

  return {
    tradeDate,
    updatedAt,
    status,
    symbolsTotal,
    symbolsSucceeded,
    symbolsFailed,
    stageDetails,
  };
}

export function getLatestEodTradeDate(freshness: EodFreshnessResponseDto | null) {
  return getLatestEodPatchSummary(freshness)?.tradeDate ?? null;
}

export function getLatestEodUpdatedAt(freshness: EodFreshnessResponseDto | null) {
  return getLatestEodPatchSummary(freshness)?.updatedAt ?? null;
}

export function getLatestEodStatus(freshness: EodFreshnessResponseDto | null) {
  return getLatestEodPatchSummary(freshness)?.status ?? null;
}

export function getLatestEodSymbolsTotal(freshness: EodFreshnessResponseDto | null) {
  return getLatestEodPatchSummary(freshness)?.symbolsTotal ?? null;
}

export function getLatestEodSymbolsSucceeded(freshness: EodFreshnessResponseDto | null) {
  return getLatestEodPatchSummary(freshness)?.symbolsSucceeded ?? null;
}

export function getLatestEodSymbolsFailed(freshness: EodFreshnessResponseDto | null) {
  return getLatestEodPatchSummary(freshness)?.symbolsFailed ?? null;
}

export function getLatestPriceTradeDate(freshness: EodFreshnessResponseDto | null) {
  const summaryRecord = getLatestSummaryRecord(freshness);
  const latestRecord = getLatestRecord(freshness);
  const stageDetail = getLatestStageDetails(freshness).find((detail) => detail.key === "price") ?? null;

  return (
    getTextValue(summaryRecord, ["trade_date", "market_date", "latest_date"]) ??
    getTextValue(latestRecord, ["price_trade_date", "trade_date", "market_date", "latest_date"]) ??
    stageDetail?.tradeDate ??
    null
  );
}

export function getLatestTechnicalMarketDate(freshness: EodFreshnessResponseDto | null) {
  const summaryRecord = getLatestSummaryRecord(freshness);
  const latestRecord = getLatestRecord(freshness);
  const stageDetail = getLatestStageDetails(freshness).find((detail) => detail.key === "technical_analysis") ?? null;

  return (
    getTextValue(latestRecord, ["technical_market_date"]) ??
    stageDetail?.tradeDate ??
    getTextValue(summaryRecord, ["trade_date", "market_date", "latest_date"]) ??
    getTextValue(latestRecord, ["trade_date", "market_date", "latest_date"]) ??
    null
  );
}

export function getLatestActionMarketDate(freshness: EodFreshnessResponseDto | null) {
  const summaryRecord = getLatestSummaryRecord(freshness);
  const latestRecord = getLatestRecord(freshness);
  const stageDetail = getLatestStageDetails(freshness).find((detail) => detail.key === "action_summary") ?? null;

  return (
    getTextValue(latestRecord, ["action_market_date"]) ??
    stageDetail?.tradeDate ??
    getTextValue(summaryRecord, ["trade_date", "market_date", "latest_date"]) ??
    getTextValue(latestRecord, ["trade_date", "market_date", "latest_date"]) ??
    null
  );
}
