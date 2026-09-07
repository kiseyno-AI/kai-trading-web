export type CalendarReviewEvidenceItem = {
  horizonEvaluations: ReadonlyArray<{ state: string }>;
  outcomeHorizons: ReadonlyArray<unknown>;
  pathOutcome: unknown | null;
  qualityReason: string | null;
  qualityVerdict: string | null;
  reviewConclusion: string | null;
};

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPendingReviewText(value: string | null | undefined) {
  if (!hasTextValue(value)) return false;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (
    normalized.includes("pending") ||
    normalized.includes("not_computed") ||
    normalized.includes("not_mature") ||
    normalized.includes("unavailable") ||
    normalized.includes("provisional")
  );
}

export function getReviewEvidenceCount(items: readonly CalendarReviewEvidenceItem[]) {
  return items.filter((item) => {
    const hasComputedHorizon = item.horizonEvaluations.some((horizon) => horizon.state === "computed");
    const hasPendingHorizon = item.horizonEvaluations.some((horizon) => horizon.state === "pending");
    const hasCompletedVerdict = hasTextValue(item.qualityVerdict) && !isPendingReviewText(item.qualityVerdict);
    const hasCompletedConclusion =
      hasTextValue(item.reviewConclusion) &&
      !isPendingReviewText(item.reviewConclusion) &&
      !(hasPendingHorizon && !hasComputedHorizon);

    return hasComputedHorizon || item.pathOutcome !== null || hasCompletedVerdict || hasCompletedConclusion;
  }).length;
}

function toReviewCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.trunc(value));
  if (typeof value !== "string") return 0;
  const parsed = Number.parseInt(value.trim().replace(/,/g, ""), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function getReviewedStatusCount(counts: Record<string, unknown> | null | undefined) {
  return Object.entries(counts ?? {}).reduce((total, [status, value]) => {
    return status.trim().toLowerCase() === "reviewed" ? total + toReviewCount(value) : total;
  }, 0);
}
