import { normalizeDartFundamentalsMarketDate } from "@/lib/dart-fundamentals-daily";
import { getLatestEodTradeDate } from "@/lib/eod-freshness-latest";
import type {
  EodFreshnessResponseDto,
  EodPipelineStageDto,
  EodPipelineStageKey,
  EodPipelineStatusResponseDto,
} from "@/types/trading-api";

const REQUIRED_LATEST_COMPLETED_PIPELINE_KEYS = [
  "technical_snapshots",
  "action_summaries",
] as const satisfies readonly EodPipelineStageKey[];

export function getDashboardProcessRequestMarketDate(
  tradeDate: string | null | undefined,
  fallbackValue: string | null | undefined,
) {
  return normalizeDartFundamentalsMarketDate(tradeDate ?? fallbackValue);
}

export function getDashboardProcessResolvedMarketDate(
  pipelineStatus: EodPipelineStatusResponseDto | null,
  requestMarketDate: string | null | undefined,
) {
  return (
    normalizeDartFundamentalsMarketDate(pipelineStatus?.market_date) ??
    normalizeDartFundamentalsMarketDate(requestMarketDate)
  );
}

function normalizePipelineStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[_-]+/g, " ") ?? null;
}

function isRunningPipelineStatus(value: string | null | undefined) {
  return normalizePipelineStatus(value) === "running";
}

function isCompletedPipelineStatus(value: string | null | undefined) {
  const normalizedStatus = normalizePipelineStatus(value);
  return normalizedStatus !== null && ["completed", "ready", "available", "success"].includes(normalizedStatus);
}

function isProblemPipelineStatus(value: string | null | undefined) {
  const normalizedStatus = normalizePipelineStatus(value);
  return (
    normalizedStatus !== null &&
    ["failed", "error", "partial", "needs review", "completed with errors"].includes(normalizedStatus)
  );
}

function isRunningPipelineStage(stage: EodPipelineStageDto | null | undefined) {
  return isRunningPipelineStatus(stage?.status);
}

function isCompletedPipelineStage(stage: EodPipelineStageDto | null | undefined) {
  return isCompletedPipelineStatus(stage?.status);
}

function isProblemPipelineStage(stage: EodPipelineStageDto | null | undefined) {
  return isProblemPipelineStatus(stage?.status) || (typeof stage?.failed === "number" && stage.failed > 0);
}

function hasRunningPipelineStage(pipelineStatus: EodPipelineStatusResponseDto | null | undefined) {
  return Object.values(pipelineStatus?.stages ?? {}).some(isRunningPipelineStage);
}

function hasProblemPipelineStage(pipelineStatus: EodPipelineStatusResponseDto | null | undefined) {
  return Object.values(pipelineStatus?.stages ?? {}).some(isProblemPipelineStage);
}

function hasCompletedRequiredLatestPipelineStages(pipelineStatus: EodPipelineStatusResponseDto | null | undefined) {
  return REQUIRED_LATEST_COMPLETED_PIPELINE_KEYS.every((key) =>
    isCompletedPipelineStage(pipelineStatus?.stages?.[key]),
  );
}

function isCurrentPipelineStatusAuthoritative(pipelineStatus: EodPipelineStatusResponseDto | null | undefined) {
  return (
    isRunningPipelineStatus(pipelineStatus?.status) ||
    isCompletedPipelineStatus(pipelineStatus?.status) ||
    isProblemPipelineStatus(pipelineStatus?.status) ||
    hasRunningPipelineStage(pipelineStatus) ||
    hasProblemPipelineStage(pipelineStatus)
  );
}

function isCompletedLatestPipelineStatus(
  pipelineStatus: EodPipelineStatusResponseDto | null | undefined,
  expectedMarketDate: string | null,
) {
  if (!pipelineStatus || !expectedMarketDate) return false;
  const pipelineMarketDate = normalizeDartFundamentalsMarketDate(pipelineStatus.market_date);
  if (pipelineMarketDate !== expectedMarketDate) return false;
  if (isProblemPipelineStatus(pipelineStatus.status) || hasProblemPipelineStage(pipelineStatus)) return false;

  return isCompletedPipelineStatus(pipelineStatus.status) || hasCompletedRequiredLatestPipelineStages(pipelineStatus);
}

export function getDashboardLatestCompletedPipelineMarketDate(
  freshness: EodFreshnessResponseDto | null,
  requestMarketDate: string | null | undefined,
) {
  const latestMarketDate = normalizeDartFundamentalsMarketDate(getLatestEodTradeDate(freshness));
  const requestedMarketDate = normalizeDartFundamentalsMarketDate(requestMarketDate);

  if (!latestMarketDate || latestMarketDate === requestedMarketDate) return null;
  return latestMarketDate;
}

export function shouldRequestLatestCompletedPipelineStatus({
  currentPipelineStatus,
  freshness,
  requestMarketDate,
}: {
  currentPipelineStatus: EodPipelineStatusResponseDto | null;
  freshness: EodFreshnessResponseDto | null;
  requestMarketDate: string | null | undefined;
}) {
  if (!getDashboardLatestCompletedPipelineMarketDate(freshness, requestMarketDate)) return false;
  return !isCurrentPipelineStatusAuthoritative(currentPipelineStatus);
}

export function resolveDashboardProcessPipelineStatus({
  currentPipelineStatus,
  freshness,
  latestCompletedPipelineStatus,
  requestMarketDate,
}: {
  currentPipelineStatus: EodPipelineStatusResponseDto | null;
  freshness: EodFreshnessResponseDto | null;
  latestCompletedPipelineStatus: EodPipelineStatusResponseDto | null;
  requestMarketDate: string | null | undefined;
}) {
  const latestMarketDate = getDashboardLatestCompletedPipelineMarketDate(freshness, requestMarketDate);

  if (
    !isCurrentPipelineStatusAuthoritative(currentPipelineStatus) &&
    isCompletedLatestPipelineStatus(latestCompletedPipelineStatus, latestMarketDate)
  ) {
    return latestCompletedPipelineStatus;
  }

  return currentPipelineStatus;
}
