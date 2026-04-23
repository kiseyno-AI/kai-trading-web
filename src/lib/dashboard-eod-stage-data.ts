import type { EodFreshnessResponseDto, EodPipelineStageDto } from "@/types/trading-api";

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function getEodSymbolsSucceeded(
  freshness: EodFreshnessResponseDto | null,
  preferLatest = false,
) {
  return preferLatest
    ? freshness?.latest?.symbols_succeeded ??
        freshness?.today?.price?.symbols_succeeded ??
        freshness?.today?.symbols_succeeded
    : freshness?.today?.price?.symbols_succeeded ??
        freshness?.today?.symbols_succeeded ??
        freshness?.latest?.symbols_succeeded;
}

export function getLatestEodSymbolsSucceeded(freshness: EodFreshnessResponseDto | null) {
  return freshness?.latest?.symbols_succeeded;
}

export function getEodSymbolsTotal(
  freshness: EodFreshnessResponseDto | null,
  preferLatest = false,
) {
  return preferLatest
    ? freshness?.latest?.symbols_total ??
        freshness?.today?.price?.symbols_total ??
        freshness?.today?.symbols_total
    : freshness?.today?.price?.symbols_total ??
        freshness?.today?.symbols_total ??
        freshness?.latest?.symbols_total;
}

export function getLatestEodSymbolsTotal(freshness: EodFreshnessResponseDto | null) {
  return freshness?.latest?.symbols_total;
}

export function getEodSymbolsFailed(
  freshness: EodFreshnessResponseDto | null,
  preferLatest = false,
) {
  return preferLatest
    ? freshness?.latest?.symbols_failed ??
        freshness?.today?.price?.symbols_failed ??
        freshness?.today?.symbols_failed
    : freshness?.today?.price?.symbols_failed ??
        freshness?.today?.symbols_failed ??
        freshness?.latest?.symbols_failed;
}

export function getLatestEodSymbolsFailed(freshness: EodFreshnessResponseDto | null) {
  return freshness?.latest?.symbols_failed;
}

export function isRunningPipelineStage(pipelineStage: EodPipelineStageDto | null | undefined) {
  return pipelineStage?.status?.trim().toLowerCase() === "running";
}

export function shouldUseTodayStageData(
  todayTradeDate: string | null,
  latestDate: string | null,
  pipelineStage: EodPipelineStageDto | null | undefined,
) {
  if (isRunningPipelineStage(pipelineStage)) return true;
  if (!hasTextValue(todayTradeDate) || !hasTextValue(latestDate)) return true;
  return todayTradeDate.trim() === latestDate.trim();
}
