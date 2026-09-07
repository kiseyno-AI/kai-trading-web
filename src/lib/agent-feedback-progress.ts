import type {
  AgentFeedbackProgressResponseDto,
  EodFreshnessResponseDto,
} from "@/types/trading-api";
import { getLatestPriceTradeDate } from "@/lib/eod-freshness-latest";

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeMarketDate(value: string | null | undefined) {
  if (!hasTextValue(value)) return null;
  return value.trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
}

export function isAgentFeedbackProgressResponseForMarketDate(
  progress: AgentFeedbackProgressResponseDto | null | undefined,
  marketDate: string | null | undefined,
) {
  const expectedMarketDate = normalizeMarketDate(marketDate);
  if (!progress || !expectedMarketDate) return false;

  const requestMarketDate = normalizeMarketDate(progress.request?.market_date);
  if (requestMarketDate !== expectedMarketDate) return false;

  const resultMarketDate = progress.result?.market_date;
  return !hasTextValue(resultMarketDate) || normalizeMarketDate(resultMarketDate) === expectedMarketDate;
}

export function getAgentFeedbackProgressMarketDate(freshness: EodFreshnessResponseDto | null) {
  const latestPriceDate = getLatestPriceTradeDate(freshness);
  if (hasTextValue(latestPriceDate)) return latestPriceDate;

  const todayTradeDate = freshness?.today?.trade_date;
  if (hasTextValue(todayTradeDate)) return todayTradeDate;

  return null;
}
