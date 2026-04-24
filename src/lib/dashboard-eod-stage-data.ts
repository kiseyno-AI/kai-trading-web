import type {
  DartFundamentalsDailyInspectResponseDto,
  EodFreshnessResponseDto,
  EodFreshnessStageDto,
  EodPipelineStageDto,
} from "@/types/trading-api";
import {
  getLatestEodSymbolsFailed as getLatestPatchSymbolsFailed,
  getLatestEodSymbolsSucceeded as getLatestPatchSymbolsSucceeded,
  getLatestEodSymbolsTotal as getLatestPatchSymbolsTotal,
} from "@/lib/eod-freshness-latest";

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function getEodSymbolsSucceeded(
  freshness: EodFreshnessResponseDto | null,
  preferLatest = false,
) {
  return preferLatest
    ? getLatestPatchSymbolsSucceeded(freshness) ??
        freshness?.today?.price?.symbols_succeeded ??
        freshness?.today?.symbols_succeeded
    : freshness?.today?.price?.symbols_succeeded ??
        freshness?.today?.symbols_succeeded ??
        getLatestPatchSymbolsSucceeded(freshness);
}

export function getLatestEodSymbolsSucceeded(freshness: EodFreshnessResponseDto | null) {
  return getLatestPatchSymbolsSucceeded(freshness);
}

export function getEodSymbolsTotal(
  freshness: EodFreshnessResponseDto | null,
  preferLatest = false,
) {
  return preferLatest
    ? getLatestPatchSymbolsTotal(freshness) ??
        freshness?.today?.price?.symbols_total ??
        freshness?.today?.symbols_total
    : freshness?.today?.price?.symbols_total ??
        freshness?.today?.symbols_total ??
        getLatestPatchSymbolsTotal(freshness);
}

export function getLatestEodSymbolsTotal(freshness: EodFreshnessResponseDto | null) {
  return getLatestPatchSymbolsTotal(freshness);
}

export function getEodSymbolsFailed(
  freshness: EodFreshnessResponseDto | null,
  preferLatest = false,
) {
  return preferLatest
    ? getLatestPatchSymbolsFailed(freshness) ??
        freshness?.today?.price?.symbols_failed ??
        freshness?.today?.symbols_failed
    : freshness?.today?.price?.symbols_failed ??
        freshness?.today?.symbols_failed ??
        getLatestPatchSymbolsFailed(freshness);
}

export function getLatestEodSymbolsFailed(freshness: EodFreshnessResponseDto | null) {
  return getLatestPatchSymbolsFailed(freshness);
}

export function getFundamentalsStageDisplayCounts(
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  todayFundamentalsStage: EodFreshnessStageDto | null | undefined,
  useTodayStage: boolean,
) {
  const latestRun = fundamentalsStatus?.latest_run ?? fundamentalsStatus?.runs?.[0] ?? null;

  if (latestRun) {
    return {
      symbolsTotal: latestRun.symbols_total ?? null,
      symbolsChecked: latestRun.symbols_checked ?? null,
      symbolsFailed: latestRun.symbols_failed ?? null,
    };
  }

  if (useTodayStage) {
    return {
      symbolsTotal: todayFundamentalsStage?.symbols_total ?? null,
      symbolsChecked:
        todayFundamentalsStage?.symbols_succeeded ?? todayFundamentalsStage?.symbols_total ?? null,
      symbolsFailed: todayFundamentalsStage?.symbols_failed ?? null,
    };
  }

  return {
    symbolsTotal: null,
    symbolsChecked: null,
    symbolsFailed: null,
  };
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
