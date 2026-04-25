import type {
  DartFundamentalsDailyInspectResponseDto,
  DartFundamentalsDailyRunDto,
  EodFreshnessResponseDto,
  EodFreshnessStageDto,
  EodPipelineStageDto,
} from "@/types/trading-api";
import {
  getLatestEodPatchStageDetail,
  getLatestEodSymbolsFailed as getLatestPatchSymbolsFailed,
  getLatestEodSymbolsSucceeded as getLatestPatchSymbolsSucceeded,
  getLatestEodSymbolsTotal as getLatestPatchSymbolsTotal,
} from "@/lib/eod-freshness-latest";
import { shouldPreferTodayPresenterStageData } from "@/lib/stage-date-status-presenter";

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeFundamentalsStatusToken(value: string | null | undefined) {
  if (!hasTextValue(value)) return null;
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function getDatePart(value: string | null | undefined) {
  if (!hasTextValue(value)) return null;
  const datePart = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
}

function isCompletedFundamentalsStatus(value: string | null | undefined) {
  const normalizedStatus = normalizeFundamentalsStatusToken(value);
  return normalizedStatus !== null && ["completed", "ready", "available", "success"].includes(normalizedStatus);
}

function isNewerIsoDate(left: string | null, right: string | null) {
  if (!hasTextValue(left)) return false;
  if (!hasTextValue(right)) return true;
  return left.localeCompare(right) > 0;
}

export type LatestAvailableFundamentalsCoverageDto = {
  tradeDate: string | null;
  status: string | null;
  symbolsTotal: number | null;
  symbolsChecked: number | null;
  symbolsFailed: number | null;
  source: "freshness_latest" | "latest_run";
};

export function getLatestFundamentalsRun(
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
): DartFundamentalsDailyRunDto | null {
  return fundamentalsStatus?.latest_run ?? fundamentalsStatus?.runs?.[0] ?? null;
}

export function getFundamentalsRunDate(run: DartFundamentalsDailyRunDto | null) {
  return run?.market_date ?? getDatePart(run?.completed_at) ?? getDatePart(run?.started_at);
}

function buildCoverageFromLatestFreshnessStage(
  freshness: EodFreshnessResponseDto | null,
): LatestAvailableFundamentalsCoverageDto | null {
  const detail = getLatestEodPatchStageDetail(freshness, "fundamentals");

  if (
    !detail ||
    (!hasTextValue(detail.tradeDate) &&
      !hasTextValue(detail.status) &&
      !hasNumber(detail.symbolsTotal) &&
      !hasNumber(detail.symbolsSucceeded) &&
      !hasNumber(detail.symbolsFailed))
  ) {
    return null;
  }

  return {
    tradeDate: detail.tradeDate,
    status: detail.status,
    symbolsTotal: detail.symbolsTotal,
    symbolsChecked: detail.symbolsSucceeded,
    symbolsFailed: detail.symbolsFailed,
    source: "freshness_latest",
  };
}

function buildCoverageFromLatestRun(
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
): LatestAvailableFundamentalsCoverageDto | null {
  const latestRun = getLatestFundamentalsRun(fundamentalsStatus);

  if (
    !latestRun ||
    (!hasTextValue(getFundamentalsRunDate(latestRun)) &&
      !hasTextValue(latestRun.status) &&
      !hasNumber(latestRun.symbols_total) &&
      !hasNumber(latestRun.symbols_checked) &&
      !hasNumber(latestRun.symbols_failed))
  ) {
    return null;
  }

  return {
    tradeDate: getFundamentalsRunDate(latestRun),
    status: latestRun.status,
    symbolsTotal: latestRun.symbols_total,
    symbolsChecked: latestRun.symbols_checked,
    symbolsFailed: latestRun.symbols_failed,
    source: "latest_run",
  };
}

function mergeFundamentalsCoverage(
  primary: LatestAvailableFundamentalsCoverageDto,
  fallback: LatestAvailableFundamentalsCoverageDto,
): LatestAvailableFundamentalsCoverageDto {
  return {
    tradeDate: primary.tradeDate ?? fallback.tradeDate,
    status: primary.status ?? fallback.status,
    symbolsTotal: primary.symbolsTotal ?? fallback.symbolsTotal,
    symbolsChecked: primary.symbolsChecked ?? fallback.symbolsChecked,
    symbolsFailed: primary.symbolsFailed ?? fallback.symbolsFailed,
    source: primary.source,
  };
}

export function getLatestAvailableFundamentalsCoverage(
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
): LatestAvailableFundamentalsCoverageDto | null {
  const latestCoverage = buildCoverageFromLatestFreshnessStage(freshness);
  const latestRunCoverage = buildCoverageFromLatestRun(fundamentalsStatus);

  if (!latestCoverage) return latestRunCoverage;
  if (!latestRunCoverage) return latestCoverage;

  if (
    isCompletedFundamentalsStatus(latestRunCoverage.status) &&
    isNewerIsoDate(latestRunCoverage.tradeDate, latestCoverage.tradeDate)
  ) {
    return mergeFundamentalsCoverage(latestRunCoverage, latestCoverage);
  }

  return mergeFundamentalsCoverage(latestCoverage, latestRunCoverage);
}

export function getLatestAvailableFundamentalsDate(
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
) {
  return getLatestAvailableFundamentalsCoverage(freshness, fundamentalsStatus)?.tradeDate ?? null;
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
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  todayFundamentalsStage: EodFreshnessStageDto | null | undefined,
  useTodayStage: boolean,
) {
  const latestRun = getLatestFundamentalsRun(fundamentalsStatus);
  const latestRunStatus = normalizeFundamentalsStatusToken(latestRun?.status);
  const latestCoverage = getLatestAvailableFundamentalsCoverage(freshness, fundamentalsStatus);

  if (latestRunStatus === "running" && latestRun) {
    return {
      symbolsTotal: latestRun.symbols_total ?? null,
      symbolsChecked:
        latestRun.symbols_refreshed ??
        latestRun.symbols_checked ??
        latestRun.symbols_fresh ??
        latestRun.symbols_total ??
        null,
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

  if (latestCoverage) {
    return {
      symbolsTotal: latestCoverage.symbolsTotal,
      symbolsChecked: latestCoverage.symbolsChecked,
      symbolsFailed: latestCoverage.symbolsFailed,
    };
  }

  if (latestRun) {
    return {
      symbolsTotal: latestRun.symbols_total ?? null,
      symbolsChecked: latestRun.symbols_checked ?? null,
      symbolsFailed: latestRun.symbols_failed ?? null,
    };
  }

  return {
    symbolsTotal: todayFundamentalsStage?.symbols_total ?? null,
    symbolsChecked:
      todayFundamentalsStage?.symbols_succeeded ?? todayFundamentalsStage?.symbols_total ?? null,
    symbolsFailed: todayFundamentalsStage?.symbols_failed ?? null,
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
  return shouldPreferTodayPresenterStageData(todayTradeDate, latestDate, isRunningPipelineStage(pipelineStage));
}

export function shouldUseTodayFundamentalsStageData(
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  pipelineStage: EodPipelineStageDto | null | undefined,
) {
  if (isRunningPipelineStage(pipelineStage)) return true;
  return getLatestAvailableFundamentalsCoverage(freshness, fundamentalsStatus) === null;
}
