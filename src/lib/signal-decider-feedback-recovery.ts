import { getAgentFeedbackProgressMarketDate } from "@/lib/agent-feedback-progress";
import { getLatestActionMarketDate } from "@/lib/eod-freshness-latest";
import type { EodFreshnessResponseDto } from "@/types/trading-api";

function normalizeMarketDate(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  if (!match) return null;

  const marketDate = match[1];
  const parsedDate = new Date(`${marketDate}T00:00:00Z`);
  return Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== marketDate
    ? null
    : marketDate;
}

export function getSignalDeciderFeedbackRecoveryCandidateDates({
  freshness,
  unavailableMarketDate,
}: {
  freshness: EodFreshnessResponseDto | null;
  unavailableMarketDate: string | null | undefined;
}) {
  const normalizedUnavailableMarketDate = normalizeMarketDate(unavailableMarketDate);

  return Array.from(
    new Set(
      [getLatestActionMarketDate(freshness), getAgentFeedbackProgressMarketDate(freshness)]
        .map(normalizeMarketDate)
        .filter((marketDate): marketDate is string => marketDate !== null),
    ),
  )
    .filter((marketDate) => marketDate !== normalizedUnavailableMarketDate)
    .sort((left, right) => right.localeCompare(left));
}
