import { isRawUpstreamDiagnosticMessage } from "./user-facing-errors";

const REVIEW_ENDPOINT_PATTERN = /\bagent-context\/feedback\b(?:\/[^\s"]*)?/i;

function isDependencyGapWarning(value: string): boolean {
  const normalized = value.toLowerCase();
  const normalizedValue = value.toLowerCase();
  return (
    normalized.includes("전용 core 계약") ||
    normalized.includes("캘린더 인덱스") ||
    normalizedValue.includes("dependency gap") ||
    normalizedValue.includes("dedicated core contract") ||
    normalizedValue.includes("dedicated calendar/replay endpoint") ||
    normalizedValue.includes("real generic signal-decider feedback")
  );
}

function isReviewBackendError(value: string): boolean {
  const normalized = value.toLowerCase();
  return REVIEW_ENDPOINT_PATTERN.test(normalized) || isRawUpstreamDiagnosticMessage(value);
}

export function getUserFacingSelectedDateReviewError({
  errorMessage,
  selectedUnavailable,
  devMode,
}: {
  errorMessage: string;
  selectedUnavailable: string;
  devMode: boolean;
}) {
  const normalizedError = errorMessage.trim();
  if (!normalizedError) return selectedUnavailable;
  if (isReviewBackendError(normalizedError)) return selectedUnavailable;
  if (!devMode && isDependencyGapWarning(normalizedError)) return selectedUnavailable;
  return normalizedError;
}

export function shouldSuppressSelectedDateReviewFallbackError({
  errorMessage,
  devMode,
}: {
  errorMessage: string;
  devMode: boolean;
}) {
  const normalizedError = errorMessage.trim();
  return !devMode && normalizedError.length > 0 && isDependencyGapWarning(normalizedError);
}
