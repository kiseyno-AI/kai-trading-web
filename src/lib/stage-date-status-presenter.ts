export type PresenterStageStatusLabel = "synced" | "running" | "break day" | "not synced";

export type PresenterTone = "positive" | "warning" | "info" | "neutral";

type PresenterStageStatusLabels = {
  synced: string;
  running: string;
  breakDay: string;
  notSynced: string;
};

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeStageStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

export function resolvePresenterDate(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (hasTextValue(value)) return value;
  }

  return null;
}

export function resolveNormalizedPresenterDate(...values: Array<string | null | undefined>) {
  return resolvePresenterDate(...values)?.trim() ?? null;
}

export function shouldPreferTodayPresenterStageData(
  todayTradeDate: string | null,
  latestDate: string | null,
  isRunning = false,
) {
  if (isRunning) return true;
  if (!hasTextValue(todayTradeDate) || !hasTextValue(latestDate)) return true;
  return todayTradeDate.trim() === latestDate.trim();
}

export function resolvePresenterStageStatus({
  stageStatus,
  todayTradeDate,
  latestDate,
  canShowBreakDay,
  staleReadyLabel = "synced",
}: {
  stageStatus: string | null | undefined;
  todayTradeDate: string | null;
  latestDate: string | null;
  canShowBreakDay: boolean;
  staleReadyLabel?: Exclude<PresenterStageStatusLabel, "running" | "break day">;
}): PresenterStageStatusLabel {
  const normalizedStatus = normalizeStageStatus(stageStatus);
  if (normalizedStatus === "running") return "running";

  const hasLatestDate = hasTextValue(latestDate);
  const hasStaleDate =
    hasTextValue(todayTradeDate) && hasLatestDate && todayTradeDate.trim() !== latestDate.trim();

  if (normalizedStatus === "ready" && hasStaleDate) {
    return canShowBreakDay ? "break day" : staleReadyLabel;
  }

  if (normalizedStatus === "ready" && hasLatestDate) return "synced";
  return "not synced";
}

export function getPresenterStageTone(statusLabel: PresenterStageStatusLabel): PresenterTone {
  if (statusLabel === "synced") return "positive";
  if (statusLabel === "running") return "info";
  if (statusLabel === "break day") return "neutral";
  return "warning";
}

export function getPresenterStageDisplayLabel(
  statusLabel: PresenterStageStatusLabel,
  labels: PresenterStageStatusLabels,
) {
  switch (statusLabel) {
    case "synced":
      return labels.synced;
    case "running":
      return labels.running;
    case "break day":
      return labels.breakDay;
    case "not synced":
      return labels.notSynced;
    default:
      return statusLabel;
  }
}

export function getPresenterFreshnessTone(status: string | null | undefined): PresenterTone {
  if (!status) return "warning";
  if (status === "completed") return "positive";
  if (status === "completed_with_errors") return "warning";
  if (status === "running") return "info";
  return "neutral";
}

export function getPresenterAvailabilityTone<TTone extends string>(available: boolean, fallbackTone: TTone) {
  return available ? "positive" : fallbackTone;
}
