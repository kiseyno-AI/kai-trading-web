import { normalizeDartFundamentalsMarketDate } from "@/lib/dart-fundamentals-daily";
import { getLatestEodTradeDate } from "@/lib/eod-freshness-latest";
import { normalizeDailyPipelineStatusToken } from "@/lib/eod-pipeline-status";
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function getDashboardExecutionRuntimeMarketDate(
  pipelineStatus: EodPipelineStatusResponseDto | null,
  requestMarketDate: string | null | undefined,
) {
  const fallbackMarketDate = normalizeDartFundamentalsMarketDate(requestMarketDate);
  const stages = asRecord(pipelineStatus?.stages);
  const nextOpenStage = asRecord(stages?.next_open_execution_plan);

  if (
    !nextOpenStage ||
    !isCompletedPipelineStatus(
      typeof nextOpenStage.status === "string" ? nextOpenStage.status : null,
    )
  ) {
    return fallbackMarketDate;
  }

  const details = asRecord(nextOpenStage.details);
  const resultSummary = asRecord(details?.result_summary);
  const summary = asRecord(resultSummary?.summary);
  const request = asRecord(resultSummary?.request);

  return (
    normalizeDartFundamentalsMarketDate(
      typeof summary?.target_trade_date === "string" ? summary.target_trade_date : null,
    ) ??
    normalizeDartFundamentalsMarketDate(
      typeof request?.target_trade_date === "string" ? request.target_trade_date : null,
    ) ??
    fallbackMarketDate
  );
}

function isRunningPipelineStatus(value: string | null | undefined) {
  return normalizeDailyPipelineStatusToken(value) === "running";
}

function isCompletedPipelineStatus(value: string | null | undefined) {
  return normalizeDailyPipelineStatusToken(value) === "completed";
}

function isProblemPipelineStatus(value: string | null | undefined) {
  const normalizedStatus = normalizeDailyPipelineStatusToken(value);
  return normalizedStatus === "failed" || normalizedStatus === "partial";
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

function isNonTradingLatestCompletedBasisPartial({
  pipelineStatus,
  latestMarketDate,
  requestMarketDate,
}: {
  pipelineStatus: EodPipelineStatusResponseDto | null | undefined;
  latestMarketDate: string | null;
  requestMarketDate: string | null | undefined;
}) {
  if (normalizeDailyPipelineStatusToken(pipelineStatus?.status) !== "partial") return false;

  const requestedMarketDate = normalizeDartFundamentalsMarketDate(requestMarketDate);
  const pipelineMarketDate = normalizeDartFundamentalsMarketDate(pipelineStatus?.market_date);
  const sessionRequestedMarketDate = normalizeDartFundamentalsMarketDate(
    pipelineStatus?.market_session?.requested_date,
  );
  const sessionLatestValidTradingDate = normalizeDartFundamentalsMarketDate(
    pipelineStatus?.market_session?.latest_valid_trading_date,
  );
  const requestedDateIsTradingDay =
    pipelineStatus?.market_session?.requested_date_is_trading_day ??
    pipelineStatus?.market_session?.is_trading_day;
  const recommendationBasis = pipelineStatus?.market_session?.recommendation_basis?.trim().toLowerCase();

  return (
    requestedMarketDate !== null &&
    latestMarketDate !== null &&
    requestedMarketDate !== latestMarketDate &&
    pipelineMarketDate === requestedMarketDate &&
    sessionRequestedMarketDate === requestedMarketDate &&
    sessionLatestValidTradingDate === latestMarketDate &&
    requestedDateIsTradingDay === false &&
    recommendationBasis === "latest_completed_eod"
  );
}

function isCurrentPipelineStatusAuthoritative({
  pipelineStatus,
  latestMarketDate,
  requestMarketDate,
}: {
  pipelineStatus: EodPipelineStatusResponseDto | null | undefined;
  latestMarketDate: string | null;
  requestMarketDate: string | null | undefined;
}) {
  const hasAuthoritativeTopLevelProblem =
    isProblemPipelineStatus(pipelineStatus?.status) &&
    !isNonTradingLatestCompletedBasisPartial({
      pipelineStatus,
      latestMarketDate,
      requestMarketDate,
    });

  return (
    isRunningPipelineStatus(pipelineStatus?.status) ||
    isCompletedPipelineStatus(pipelineStatus?.status) ||
    hasAuthoritativeTopLevelProblem ||
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

  // A latest EOD cycle can be top-level partial while later/non-dashboard stages are still
  // pending or failed. For dashboard EOD cards, the completed price/technical/action stages
  // are still authoritative and should be used on no-new-EOD days.
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
  const latestMarketDate = getDashboardLatestCompletedPipelineMarketDate(freshness, requestMarketDate);
  if (!latestMarketDate) return false;
  return !isCurrentPipelineStatusAuthoritative({
    pipelineStatus: currentPipelineStatus,
    latestMarketDate,
    requestMarketDate,
  });
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
    !isCurrentPipelineStatusAuthoritative({
      pipelineStatus: currentPipelineStatus,
      latestMarketDate,
      requestMarketDate,
    }) &&
    isCompletedLatestPipelineStatus(latestCompletedPipelineStatus, latestMarketDate)
  ) {
    return latestCompletedPipelineStatus;
  }

  return currentPipelineStatus;
}
