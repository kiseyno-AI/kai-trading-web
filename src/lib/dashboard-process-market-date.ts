import { normalizeDartFundamentalsMarketDate } from "@/lib/dart-fundamentals-daily";
import type { EodPipelineStatusResponseDto } from "@/types/trading-api";

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
