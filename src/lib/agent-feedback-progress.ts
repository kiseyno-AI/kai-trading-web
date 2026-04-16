import type { EodFreshnessResponseDto } from "@/types/trading-api";

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function getAgentFeedbackProgressMarketDate(freshness: EodFreshnessResponseDto | null) {
  const latestPriceDate = freshness?.latest?.price_trade_date;
  if (hasTextValue(latestPriceDate)) return latestPriceDate;

  const todayTradeDate = freshness?.today?.trade_date;
  if (hasTextValue(todayTradeDate)) return todayTradeDate;

  return null;
}
