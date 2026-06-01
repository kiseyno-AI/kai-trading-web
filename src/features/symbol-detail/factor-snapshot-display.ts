import type { SymbolDetailCopy } from "@/i18n/symbol-detail-copy";
import type { FactorQualityCalculationState } from "@/lib/factor-quality";

function shouldExposeBackendTokenFallback(copy: SymbolDetailCopy) {
  return copy.common.unavailable === "Unavailable";
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function humanizeEnglishToken(value: string) {
  return normalizeToken(value)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getKnownTokenLabel(copy: SymbolDetailCopy, value: string) {
  const metricLabels: Partial<Record<string, string>> = copy.factors.metricStatusLabels;
  const factorLabels: Partial<Record<string, string>> = copy.factors.factorStatusLabels;
  const normalized = normalizeToken(value);

  return metricLabels[value] ?? factorLabels[value] ?? metricLabels[normalized] ?? factorLabels[normalized] ?? null;
}

function getOperatorFallbackLabel(copy: SymbolDetailCopy, value: string) {
  const normalized = normalizeToken(value);
  const metricLabels: Partial<Record<string, string>> = copy.factors.metricStatusLabels;
  const factorLabels: Partial<Record<string, string>> = copy.factors.factorStatusLabels;

  if (/^requires_at_least_\d+_stored_trading_bars$/.test(normalized)) {
    return factorLabels.insufficient_history ?? metricLabels.insufficient_history ?? copy.factors.unavailableValueStatus;
  }

  if (normalized === "calculation_unavailable") {
    return copy.factors.qualityCalculationLabels.unavailable;
  }

  if (normalized === "unranked") {
    return copy.factors.metricRankUnavailable;
  }

  if (normalized.includes("depreciation") && normalized.includes("amortization") && normalized.includes("missing")) {
    return metricLabels.missing_depreciation_and_amortization ?? metricLabels.missing_metric ?? copy.factors.unavailableValueStatus;
  }

  if (normalized.startsWith("missing_")) {
    return metricLabels.missing_metric ?? copy.factors.unavailableValueStatus;
  }

  if (normalized.includes("pending") || normalized.includes("waiting")) {
    return metricLabels.pending ?? copy.factors.unavailableValueStatus;
  }

  if (normalized.includes("unavailable")) {
    return metricLabels.unavailable ?? copy.common.unavailable;
  }

  return null;
}

export function formatFactorSnapshotTokenLabel(
  copy: SymbolDetailCopy,
  value: string | null | undefined,
  fallback = copy.common.unavailable,
) {
  if (!value?.trim()) return fallback;

  const knownLabel = getKnownTokenLabel(copy, value.trim());
  if (knownLabel) return knownLabel;

  const operatorFallback = getOperatorFallbackLabel(copy, value);
  if (operatorFallback) return operatorFallback;

  return shouldExposeBackendTokenFallback(copy) ? humanizeEnglishToken(value) : fallback;
}

export function formatFactorSnapshotStatusLabel(copy: SymbolDetailCopy, statusCode: string | null | undefined) {
  return formatFactorSnapshotTokenLabel(copy, statusCode, copy.factors.unavailableValueStatus);
}

export function formatQualityCalculationLabel(copy: SymbolDetailCopy, state: FactorQualityCalculationState) {
  return copy.factors.qualityCalculationLabels[state];
}

export function formatQualityComponentLabel(
  copy: SymbolDetailCopy,
  componentKey: string,
  fallback: string,
) {
  const componentLabels: Partial<Record<string, string>> = copy.factors.qualityComponentLabels;

  return componentLabels[componentKey] ?? (shouldExposeBackendTokenFallback(copy) ? fallback : copy.factors.componentCoverageUnavailable);
}
