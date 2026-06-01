"use client";

import { memo, useMemo } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { UnitRefreshFrame } from "@/components/ui/unit-refresh-frame";
import {
  formatFactorSnapshotStatusLabel,
  formatFactorSnapshotTokenLabel,
  formatQualityCalculationLabel,
  formatQualityComponentLabel,
} from "@/features/symbol-detail/factor-snapshot-display";
import type { SymbolDetailCopy } from "@/i18n/symbol-detail-copy";
import {
  buildFactorQualitySummary,
  formatQualityCount,
  formatQualityRank,
  formatQualityScore,
  type FactorQualitySummary,
} from "@/lib/factor-quality";
import {
  FACTOR_FAMILY_META,
  FACTOR_FAMILY_ORDER,
  getAdvancedValueFactorStatusDescriptor,
  getBetaFactorStatusDescriptor,
  getLowRiskFactorStatusDescriptor,
  getMomentumFactorStatusDescriptor,
  getUnifiedValueStatusDescriptor,
  getValueFactorStatusDescriptor,
  hasUnifiedValueFields,
  isLowRiskTradingValueUnavailable,
  resolveLowRiskTradingValueStatus,
  loadSymbolFactorSnapshot,
  resolveUnifiedValueStatusCode,
  type FactorFamilyId,
  type FactorFamilySnapshotResult,
  type FactorStatusDescriptor,
  type SymbolFactorSnapshotDto,
} from "@/lib/factor-snapshot";
import { useUnitData } from "@/lib/use-unit-data";
import type { EodAdvancedValueFactorItemDto, EodValueFactorItemDto } from "@/types/trading-api";

import styles from "./symbol-detail.module.css";

type FactorSnapshotSectionProps = {
  copy: SymbolDetailCopy;
  marketDate: string | null;
  marketDateBasisCopy: string | null;
  marketDateLabel: string;
  normalizedSymbol: string;
  numberLocale: string;
  symbolReady: boolean;
};

type FactorCardMetric = {
  label: string;
  value: string;
  valueClassName?: string;
};

type FactorQualityModel = {
  title: string;
  statusLabel: string;
  tone: FactorQualitySummary["tone"];
  calculationLabel: string;
  summary: string;
  metrics: FactorCardMetric[];
  componentNotes: string[];
};

type FactorCardModel = {
  family: FactorFamilyId;
  title: string;
  subtitle: string;
  status: FactorStatusDescriptor;
  body: string;
  metrics: FactorCardMetric[];
  quality: FactorQualityModel | null;
  notes: string[];
  meta: string;
};

type AnyFactorFamilyResult =
  | FactorFamilySnapshotResult<"momentum">
  | FactorFamilySnapshotResult<"lowRisk">
  | FactorFamilySnapshotResult<"beta">
  | FactorFamilySnapshotResult<"value">
  | FactorFamilySnapshotResult<"advancedValue">;

type FactorCardBuildContext = {
  advancedValueResult: FactorFamilySnapshotResult<"advancedValue"> | null;
  valueHasUnifiedFields: boolean;
};

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatIsoDateLabel(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${year}.${month}.${day}`;
}

function formatFactorScore(value: number | null | undefined, fallback: string) {
  if (!hasNumber(value)) return fallback;
  return `${(value * 100).toFixed(1)}%`;
}

function formatDecimalPercent(
  value: number | null | undefined,
  fallback: string,
  options?: { signed?: boolean },
) {
  if (!hasNumber(value)) return fallback;
  const percentValue = value * 100;
  const signPrefix = options?.signed && percentValue > 0 ? "+" : "";
  return `${signPrefix}${percentValue.toFixed(1)}%`;
}

function formatRatio(value: number | null | undefined, fallback: string) {
  if (!hasNumber(value)) return fallback;
  return value.toFixed(2);
}

function formatRank(value: number | null | undefined, fallback: string) {
  return hasNumber(value) ? `#${value.toLocaleString("en-US")}` : fallback;
}

function formatCompactNumber(
  value: number | null | undefined,
  fallback: string,
  numberLocale: string,
) {
  if (!hasNumber(value)) return fallback;

  return new Intl.NumberFormat(numberLocale, {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
}

function getValueToneClassName(value: number | null | undefined) {
  if (!hasNumber(value) || value === 0) return undefined;
  return value > 0 ? styles.positive : styles.negative;
}

function getRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readPayloadStatus(payload: Record<string, unknown> | null, key: string) {
  const statusSources = [
    getRecord(payload?.unified_value_component_statuses),
    getRecord(payload?.unified_component_statuses),
    getRecord(payload?.component_statuses),
    getRecord(payload?.metric_statuses),
    payload,
  ];

  for (const source of statusSources) {
    const status = getString(source?.[key]);
    if (status) return status;
  }

  return null;
}

function uniqueNotes(notes: Array<string | null | undefined>) {
  return Array.from(new Set(notes.filter((note): note is string => Boolean(note && note.trim().length > 0))));
}

function getFamilyTitle(copy: SymbolDetailCopy, family: FactorFamilyId, usesUnifiedValue = false) {
  switch (family) {
    case "momentum":
      return copy.factors.momentumFamilyTitle;
    case "lowRisk":
      return copy.factors.lowRiskFamilyTitle;
    case "beta":
      return copy.factors.betaFamilyTitle;
    case "value":
      return usesUnifiedValue ? copy.factors.valueFamilyTitleUnified : copy.factors.valueFamilyTitleLegacy;
    case "advancedValue":
      return copy.factors.advancedValueFamilyTitle;
  }
}

function getFamilySubtitle(copy: SymbolDetailCopy, family: FactorFamilyId, usesUnifiedValue = false) {
  switch (family) {
    case "momentum":
      return copy.factors.momentumFamilySubtitle;
    case "lowRisk":
      return copy.factors.lowRiskFamilySubtitle;
    case "beta":
      return copy.factors.betaFamilySubtitle;
    case "value":
      return usesUnifiedValue
        ? copy.factors.valueFamilySubtitleUnified
        : copy.factors.valueFamilySubtitleLegacy;
    case "advancedValue":
      return usesUnifiedValue
        ? copy.factors.advancedValueFamilySubtitleUnified
        : copy.factors.advancedValueFamilySubtitleLegacy;
  }
}

function buildCardMeta(copy: SymbolDetailCopy, result: AnyFactorFamilyResult) {
  const dataDate = result.marketDate ?? result.requestedMarketDate;
  const featureVersion = result.featureVersion ?? copy.common.pending;

  return [
    `${copy.factors.dataDate}: ${formatIsoDateLabel(dataDate, copy.common.datePending)}`,
    `${copy.factors.featureVersion}: ${featureVersion}`,
    `${copy.factors.endpoint}: ${FACTOR_FAMILY_META[result.family].api}`,
  ].join(" · ");
}

function buildUnavailableCardModel(copy: SymbolDetailCopy, result: AnyFactorFamilyResult): FactorCardModel {
  const entries = result.summary?.entries ?? 0;

  return {
    family: result.family,
    title: getFamilyTitle(copy, result.family),
    subtitle: getFamilySubtitle(copy, result.family),
    status: result.ok ? { code: "missing_row", tone: "neutral" } : { code: "unavailable", tone: "warning" },
    body: result.ok
      ? copy.factors.missingBody
      : `${copy.factors.unavailableBody} ${formatFactorSnapshotTokenLabel(copy, result.error, copy.common.unavailable)}.`,
    metrics: [
      { label: copy.factors.metricEntries, value: String(entries) },
      {
        label: copy.factors.requestedMarketDate,
        value: formatIsoDateLabel(result.requestedMarketDate, copy.common.datePending),
      },
    ],
    quality: null,
    notes: uniqueNotes([
      result.ok ? copy.factors.missingRowNote : null,
      !result.ok ? `${copy.factors.missingRowErrorPrefix} ${formatFactorSnapshotTokenLabel(copy, result.error, copy.common.unavailable)}` : null,
    ]),
    meta: buildCardMeta(copy, result),
  };
}

function buildMomentumBody(copy: SymbolDetailCopy, status: FactorStatusDescriptor) {
  switch (status.code) {
    case "eligible":
      return copy.factors.momentumBodyEligible;
    case "overheated":
      return copy.factors.momentumBodyOverheated;
    case "insufficient_history":
      return copy.factors.momentumBodyInsufficientHistory;
    default:
      return copy.factors.momentumBodyDefault;
  }
}

function buildMomentumCardModel(
  copy: SymbolDetailCopy,
  result: FactorFamilySnapshotResult<"momentum">,
): FactorCardModel {
  const item = result.item;
  if (!item) return buildUnavailableCardModel(copy, result);

  const payload = getRecord(item.factor_payload);
  const insufficientHistoryReason = getString(payload?.insufficient_history_reason);
  const status = getMomentumFactorStatusDescriptor(item);

  return {
    family: result.family,
    title: getFamilyTitle(copy, result.family),
    subtitle: getFamilySubtitle(copy, result.family),
    status,
    body: buildMomentumBody(copy, status),
    metrics: [
      {
        label: copy.factors.metricMomentum12,
        value: formatDecimalPercent(item.momentum_12_1, copy.common.unavailable, { signed: true }),
        valueClassName: getValueToneClassName(item.momentum_12_1),
      },
      { label: copy.factors.metricPercentile, value: formatFactorScore(item.momentum_percentile, copy.common.unavailable) },
      { label: copy.factors.metricRank, value: formatRank(item.momentum_rank, copy.factors.metricRankUnavailable) },
      {
        label: copy.factors.metric5dReturn,
        value: formatDecimalPercent(item.return_5d, copy.common.unavailable, { signed: true }),
        valueClassName: getValueToneClassName(item.return_5d),
      },
    ],
    quality: null,
    notes: uniqueNotes([
      item.has_sufficient_history
        ? copy.factors.momentumNoteHistoryReady
        : formatFactorSnapshotTokenLabel(copy, insufficientHistoryReason, copy.factors.momentumNoteHistoryMissing),
      item.is_price_above_ma120 ? copy.factors.momentumNotePriceAboveMa : copy.factors.momentumNotePriceBelowMa,
      item.is_ma60_above_ma120 ? copy.factors.momentumNoteMa60Above : copy.factors.momentumNoteMa60Below,
      item.is_recent_overheated
        ? copy.factors.momentumNoteOverheatTripped
        : copy.factors.momentumNoteOverheatClear,
    ]),
    meta: buildCardMeta(copy, result),
  };
}

function buildLowRiskBody(copy: SymbolDetailCopy, status: FactorStatusDescriptor) {
  switch (status.code) {
    case "eligible":
      return copy.factors.lowRiskBodyEligible;
    case "watchlist":
      return copy.factors.lowRiskBodyWatchlist;
    case "liquidity_excluded":
      return copy.factors.lowRiskBodyLiquidityExcluded;
    case "insufficient_history":
      return copy.factors.lowRiskBodyInsufficientHistory;
    case "missing_market_date_bar":
      return copy.factors.lowRiskBodyMissingBar;
    default:
      return copy.factors.lowRiskBodyDefault;
  }
}

function buildLowRiskCardModel(
  copy: SymbolDetailCopy,
  numberLocale: string,
  result: FactorFamilySnapshotResult<"lowRisk">,
): FactorCardModel {
  const item = result.item;
  if (!item) return buildUnavailableCardModel(copy, result);

  const status = getLowRiskFactorStatusDescriptor(item);

  return {
    family: result.family,
    title: getFamilyTitle(copy, result.family),
    subtitle: getFamilySubtitle(copy, result.family),
    status,
    body: buildLowRiskBody(copy, status),
    metrics: [
      {
        label: copy.factors.metricLowRiskScore,
        value: formatFactorScore(item.low_risk_score, copy.common.unavailable),
      },
      {
        label: copy.factors.metricLiquidityPercentile,
        value: formatFactorScore(item.liquidity_percentile, copy.common.unavailable),
      },
      {
        label: copy.factors.metricDrawdown120d,
        value: formatDecimalPercent(item.max_drawdown_120d, copy.common.unavailable, { signed: true }),
        valueClassName: getValueToneClassName(item.max_drawdown_120d),
      },
      {
        label: copy.factors.metricVolatility120d,
        value: formatDecimalPercent(item.volatility_120d, copy.common.unavailable),
      },
      {
        label: copy.factors.metricTradingValue20d,
        value: isLowRiskTradingValueUnavailable(item)
          ? copy.factors.tradingValueUnavailable
          : formatCompactNumber(item.avg_trading_value_20d, copy.common.unavailable, numberLocale),
      },
    ],
    quality: null,
    notes: uniqueNotes([
      item.passes_liquidity_floor === true
        ? copy.factors.liquidityFloorPassed
        : item.passes_liquidity_floor === false
          ? copy.factors.liquidityFloorFailed
          : copy.factors.liquidityFloorPending,
      `${item.history_days_available} ${copy.factors.metricHistoryDays}`,
      item.low_risk_classification ? formatFactorSnapshotTokenLabel(copy, item.low_risk_classification) : null,
      resolveLowRiskTradingValueStatus(item)
        ? `${copy.factors.tradingValueStatusPrefix}: ${formatFactorSnapshotTokenLabel(copy, resolveLowRiskTradingValueStatus(item), copy.factors.unavailableValueStatus)}`
        : null,
    ]),
    meta: buildCardMeta(copy, result),
  };
}

function buildBetaBody(copy: SymbolDetailCopy, status: FactorStatusDescriptor, benchmarkId: string | null) {
  switch (status.code) {
    case "eligible":
      return copy.factors.betaBodyEligible.replace("%benchmark%", benchmarkId ?? copy.factors.betaBenchmarkFallback);
    case "watchlist":
      return copy.factors.betaBodyWatchlist.replace("%benchmark%", benchmarkId ?? copy.factors.betaBenchmarkFallback);
    case "insufficient_history":
      return copy.factors.betaBodyInsufficientHistory;
    case "missing_market_date_bar":
      return copy.factors.betaBodyMissingBar;
    default:
      return copy.factors.betaBodyDefault;
  }
}

function buildBetaCardModel(
  copy: SymbolDetailCopy,
  result: FactorFamilySnapshotResult<"beta">,
): FactorCardModel {
  const item = result.item;
  if (!item) return buildUnavailableCardModel(copy, result);

  const status = getBetaFactorStatusDescriptor(item);

  return {
    family: result.family,
    title: copy.factors.betaFamilyTitle,
    subtitle: copy.factors.betaFamilySubtitle,
    status,
    body: buildBetaBody(copy, status, item.benchmark_id),
    metrics: [
      { label: copy.factors.metricLowBetaScore, value: formatFactorScore(item.low_beta_score, copy.common.unavailable) },
      { label: copy.factors.metricBeta60d, value: formatRatio(item.beta_60d, copy.common.unavailable) },
      { label: copy.factors.metricBeta120d, value: formatRatio(item.beta_120d, copy.common.unavailable) },
      {
        label: copy.factors.metricPercentile120d,
        value: formatFactorScore(item.beta_120d_percentile, copy.common.unavailable),
      },
      { label: copy.factors.metricBenchmark, value: item.benchmark_id ?? copy.common.unavailable },
    ],
    quality: null,
    notes: uniqueNotes([
      item.low_beta_classification ? formatFactorSnapshotTokenLabel(copy, item.low_beta_classification) : null,
      `${item.history_days_available} ${copy.factors.metricHistoryDays}`,
      item.benchmark_market ? `${item.benchmark_market} ${copy.factors.benchmarkMarketContext}` : null,
    ]),
    meta: buildCardMeta(copy, result),
  };
}

function readValueMetricStatuses(
  item: EodValueFactorItemDto | EodAdvancedValueFactorItemDto,
  advancedItem?: EodAdvancedValueFactorItemDto | null,
) {
  const payload = getRecord(item.factor_payload);
  const advancedPayload = getRecord(advancedItem?.factor_payload);

  return {
    dividendYield:
      ("dividend_yield_status" in item ? item.dividend_yield_status : null) ??
      readPayloadStatus(payload, "dividend_yield") ??
      readPayloadStatus(advancedPayload, "dividend_yield"),
    evToEbitda:
      ("ev_to_ebitda_status" in item ? item.ev_to_ebitda_status : null) ??
      advancedItem?.ev_to_ebitda_status ??
      readPayloadStatus(payload, "ev_to_ebitda") ??
      readPayloadStatus(advancedPayload, "ev_to_ebitda"),
    fcfYield:
      ("fcf_yield_status" in item ? item.fcf_yield_status : null) ??
      advancedItem?.fcf_yield_status ??
      readPayloadStatus(payload, "fcf_yield") ??
      readPayloadStatus(advancedPayload, "fcf_yield"),
    pbr:
      ("pbr_status" in item ? item.pbr_status : null) ??
      readPayloadStatus(payload, "pbr") ??
      readPayloadStatus(advancedPayload, "pbr"),
    per:
      ("per_status" in item ? item.per_status : null) ??
      readPayloadStatus(payload, "per") ??
      readPayloadStatus(advancedPayload, "per"),
  };
}

function buildValueComponentNotes(
  copy: SymbolDetailCopy,
  item: EodValueFactorItemDto | EodAdvancedValueFactorItemDto,
  advancedItem?: EodAdvancedValueFactorItemDto | null,
) {
  const statuses = readValueMetricStatuses(item, advancedItem);
  const hints = [
    [copy.factors.metricLabelPer, statuses.per],
    [copy.factors.metricLabelPbr, statuses.pbr],
    [copy.factors.metricLabelDividendYield, statuses.dividendYield],
    [copy.factors.metricLabelFcfYield, statuses.fcfYield],
    [copy.factors.metricLabelEvToEbitda, statuses.evToEbitda],
  ] as const;

  return hints.map(([label, status]) => (status ? `${label}: ${formatFactorSnapshotTokenLabel(copy, status)}` : null));
}

function buildQualityProgressLabel(copy: SymbolDetailCopy, quality: FactorQualitySummary) {
  if (quality.componentsPossible === null && quality.componentsUsed === null) {
    return copy.factors.componentCoverageUnavailable;
  }

  return copy.factors.qualityCoverageTemplate
    .replace("%used%", formatQualityCount(quality.componentsUsed, copy.common.unavailable))
    .replace("%possible%", formatQualityCount(quality.componentsPossible, copy.common.unavailable));
}

function buildQualitySummaryText(copy: SymbolDetailCopy, quality: FactorQualitySummary) {
  switch (quality.calculationState) {
    case "complete":
      return `${copy.factors.qualityCalculationCompletePrefix} ${buildQualityProgressLabel(copy, quality)}.`;
    case "partial":
      return `${copy.factors.qualityCalculationPartialPrefix} ${buildQualityProgressLabel(copy, quality)}.`;
    case "unavailable":
      return `${copy.factors.qualityCalculationUnavailablePrefix} ${buildQualityProgressLabel(copy, quality)}.`;
  }
}

function buildQualityModel(
  item: EodValueFactorItemDto | EodAdvancedValueFactorItemDto,
  copy: SymbolDetailCopy,
  options: { force?: boolean } = {},
): FactorQualityModel | null {
  const quality = buildFactorQualitySummary(item, options);
  if (!quality) return null;
  const calculationLabel = formatQualityCalculationLabel(copy, quality.calculationState);
  const statusLabel = formatFactorSnapshotTokenLabel(copy, quality.statusCode, copy.factors.metricStatusUnavailable);

  return {
    calculationLabel,
    componentNotes: quality.componentStatuses.map(
      (component) =>
        `${formatQualityComponentLabel(copy, component.key, component.label)}: ${formatFactorSnapshotTokenLabel(
          copy,
          component.status,
          copy.factors.metricStatusUnavailable,
        )}`,
    ),
    metrics: [
      { label: copy.factors.metricQualityScore, value: formatQualityScore(quality.score, copy.common.unavailable) },
      { label: copy.factors.metricQualityPercentile, value: formatQualityScore(quality.percentile, copy.common.unavailable) },
      { label: copy.factors.metricQualityRank, value: formatQualityRank(quality.rank, copy.factors.metricRankUnavailable) },
      { label: copy.factors.metricScoreStatus, value: statusLabel },
      { label: copy.factors.metricPossibleComponents, value: formatQualityCount(quality.componentsPossible, copy.common.unavailable) },
      { label: copy.factors.metricUsedComponents, value: formatQualityCount(quality.componentsUsed, copy.common.unavailable) },
      { label: copy.factors.metricCalculation, value: calculationLabel },
    ],
    statusLabel,
    summary: buildQualitySummaryText(copy, quality),
    title: copy.factors.qualityHeaderTitle,
    tone: quality.tone,
  };
}

function buildValueBody(copy: SymbolDetailCopy, status: FactorStatusDescriptor, usesUnifiedValue: boolean) {
  switch (status.code) {
    case "scored":
      return usesUnifiedValue ? copy.factors.valueBodyScoredUnified : copy.factors.valueBodyScoredLegacy;
    case "invalid_per":
      return copy.factors.valueBodyInvalidPer;
    case "missing_metric":
      return usesUnifiedValue ? copy.factors.valueBodyMissingMetricUnified : copy.factors.valueBodyMissingMetricLegacy;
    case "insufficient_components":
      return copy.factors.valueBodyInsufficientComponents;
    case "insufficient_fundamentals":
      return copy.factors.valueBodyInsufficientFundamentals;
    case "missing_market_date_bar":
      return copy.factors.valueBodyMissingMarketDateBar;
    default:
      return usesUnifiedValue ? copy.factors.valueBodyDefaultUnified : copy.factors.valueBodyDefaultLegacy;
  }
}

function buildValueCardModel(
  copy: SymbolDetailCopy,
  result: FactorFamilySnapshotResult<"value">,
  advancedValueResult: FactorFamilySnapshotResult<"advancedValue"> | null,
): FactorCardModel {
  const item = result.item;
  if (!item) return buildUnavailableCardModel(copy, result);

  const advancedItem = advancedValueResult?.item ?? null;
  const usesUnifiedValue = hasUnifiedValueFields(item);
  const status = usesUnifiedValue
    ? getUnifiedValueStatusDescriptor(resolveUnifiedValueStatusCode(item))
    : getValueFactorStatusDescriptor(item);
  const componentNotes = buildValueComponentNotes(copy, item, advancedItem);
  const quality = buildQualityModel(item, copy, { force: true });

  return {
    family: result.family,
    title: getFamilyTitle(copy, result.family, usesUnifiedValue),
    subtitle: getFamilySubtitle(copy, result.family, usesUnifiedValue),
    status,
    body: buildValueBody(copy, status, usesUnifiedValue),
    metrics: usesUnifiedValue
      ? [
          {
            label: copy.factors.valueMetricUnifiedScore,
            value: formatFactorScore(item.unified_value_score, copy.common.unavailable),
          },
          {
            label: copy.factors.valueMetricUnifiedPercentile,
            value: formatFactorScore(item.unified_value_percentile, copy.common.unavailable),
          },
          { label: copy.factors.metricOverallStatus, value: formatFactorSnapshotStatusLabel(copy, status.code) },
          {
            label: copy.factors.valueMetricLegacyValueScore,
            value: formatFactorScore(item.value_score, copy.common.unavailable),
          },
        ]
      : [
          { label: copy.factors.valueMetricLegacyValueScore, value: formatFactorScore(item.value_score, copy.common.unavailable) },
          {
            label: copy.factors.valueMetricLegacyPercentile,
            value: formatFactorScore(item.value_percentile, copy.common.unavailable),
          },
          { label: copy.factors.metricRank, value: formatRank(item.value_rank, copy.factors.metricRankUnavailable) },
          { label: copy.factors.valueMetricPer, value: formatRatio(item.per, copy.common.unavailable) },
          { label: copy.factors.valueMetricPbr, value: formatRatio(item.pbr, copy.common.unavailable) },
          {
            label: copy.factors.valueMetricDividendYield,
            value: formatDecimalPercent(item.dividend_yield, copy.common.unavailable),
          },
        ],
    quality,
    notes: uniqueNotes([
      quality ? `${quality.title}: ${quality.calculationLabel}` : null,
      ...componentNotes,
      item.unified_value_status
        ? `${copy.factors.valueUnifiedStatusLabel}: ${formatFactorSnapshotTokenLabel(copy, item.unified_value_status, copy.factors.unavailableValueStatus)}`
        : null,
      item.value_status
        ? `${copy.factors.valueLegacyStatusLabel}: ${formatFactorSnapshotTokenLabel(copy, item.value_status, copy.factors.unavailableValueStatus)}`
        : null,
    ]),
    meta: buildCardMeta(copy, result),
  };
}

function buildAdvancedValueBody(copy: SymbolDetailCopy, status: FactorStatusDescriptor, usesUnifiedValue: boolean) {
  if (usesUnifiedValue) {
    return buildValueBody(copy, status, true);
  }

  switch (status.code) {
    case "eligible":
      return copy.factors.advancedValueCardBodyEligible;
    case "watchlist":
      return copy.factors.advancedValueCardBodyWatchlist;
    case "insufficient_fundamentals":
      return copy.factors.advancedValueCardBodyInsufficientFundamentals;
    case "insufficient_components":
      return copy.factors.advancedValueCardBodyInsufficientComponents;
    case "missing_market_date_bar":
      return copy.factors.valueBodyMissingMarketDateBar;
    default:
      return copy.factors.advancedValueCardBodyDefault;
  }
}

function buildAdvancedValueCardModel(
  copy: SymbolDetailCopy,
  result: FactorFamilySnapshotResult<"advancedValue">,
  context: FactorCardBuildContext,
): FactorCardModel {
  const item = result.item;
  if (!item) return buildUnavailableCardModel(copy, result);

  const usesUnifiedValue = hasUnifiedValueFields(item) && !context.valueHasUnifiedFields;
  const status = usesUnifiedValue
    ? getUnifiedValueStatusDescriptor(resolveUnifiedValueStatusCode(item))
    : getAdvancedValueFactorStatusDescriptor(item);
  const componentNotes = buildValueComponentNotes(copy, item);
  const quality = usesUnifiedValue ? buildQualityModel(item, copy) : null;

  return {
    family: result.family,
    title: getFamilyTitle(copy, result.family),
    subtitle: usesUnifiedValue
      ? copy.factors.advancedValueFamilySubtitleUnified
      : copy.factors.advancedValueFamilySubtitleLegacy,
    status,
    body: buildAdvancedValueBody(copy, status, usesUnifiedValue),
    metrics: usesUnifiedValue
      ? [
          {
            label: copy.factors.valueMetricUnifiedScore,
            value: formatFactorScore(item.unified_value_score, copy.common.unavailable),
          },
          {
            label: copy.factors.valueMetricUnifiedPercentile,
            value: formatFactorScore(item.unified_value_percentile, copy.common.unavailable),
          },
          {
            label: copy.factors.metricRank,
            value: formatRank(item.unified_value_rank, copy.factors.metricRankUnavailable),
          },
          { label: copy.factors.metricOverallStatus, value: formatFactorSnapshotStatusLabel(copy, status.code) },
          {
            label: copy.factors.advancedValueMetricComponentScore,
            value: formatFactorScore(item.advanced_value_score, copy.common.unavailable),
          },
        ]
      : [
          {
            label: copy.factors.advancedValueMetricComponentScore,
            value: formatFactorScore(item.advanced_value_score, copy.common.unavailable),
          },
          {
            label: copy.factors.advancedValueMetricComponentPercentile,
            value: formatFactorScore(item.advanced_value_percentile, copy.common.unavailable),
          },
          {
            label: copy.factors.valueMetricFcfYield,
            value: formatDecimalPercent(item.fcf_yield, copy.common.unavailable, { signed: true }),
            valueClassName: getValueToneClassName(item.fcf_yield),
          },
          {
            label: copy.factors.valueMetricEvToEbitda,
            value: formatRatio(item.ev_to_ebitda, copy.common.unavailable),
          },
          {
            label: copy.factors.advancedValueMetricComponents,
            value: `${item.advanced_value_components_used} / 2`,
          },
        ],
    quality,
    notes: uniqueNotes([
      quality ? `${quality.title}: ${quality.calculationLabel}` : null,
      ...componentNotes,
      item.unified_value_status
        ? `${copy.factors.valueUnifiedStatusLabel}: ${formatFactorSnapshotTokenLabel(copy, item.unified_value_status, copy.factors.unavailableValueStatus)}`
        : null,
      item.advanced_value_classification
        ? `${copy.factors.advancedValueClassificationLabel}: ${formatFactorSnapshotTokenLabel(copy, item.advanced_value_classification, copy.factors.unavailableValueStatus)}`
        : null,
    ]),
    meta: buildCardMeta(copy, result),
  };
}

function buildFactorCardModel(
  copy: SymbolDetailCopy,
  numberLocale: string,
  result: AnyFactorFamilyResult,
  context: FactorCardBuildContext,
): FactorCardModel {
  switch (result.family) {
    case "momentum":
      return buildMomentumCardModel(copy, result);
    case "lowRisk":
      return buildLowRiskCardModel(copy, numberLocale, result);
    case "beta":
      return buildBetaCardModel(copy, result);
    case "value":
      return buildValueCardModel(copy, result, context.advancedValueResult);
    case "advancedValue":
      return buildAdvancedValueCardModel(copy, result, context);
  }
}

export const FactorSnapshotSection = memo(function FactorSnapshotSection({
  copy,
  marketDate,
  marketDateBasisCopy,
  marketDateLabel,
  normalizedSymbol,
  numberLocale,
  symbolReady,
}: FactorSnapshotSectionProps) {
  const factorSnapshotRequest = useMemo(
    () => ({
      enabled: symbolReady && Boolean(marketDate),
      key: ["symbol-detail", "factor-snapshot", normalizedSymbol, marketDate ?? "pending"] as const,
      ttlMs: 30_000,
      fetcher: async () => {
        if (!marketDate) {
          throw new Error("Market date pending");
        }

        return loadSymbolFactorSnapshot({
          marketDate,
          symbol: normalizedSymbol,
        });
      },
    }),
    [marketDate, normalizedSymbol, symbolReady],
  );
  const factorSnapshotResult = useUnitData<SymbolFactorSnapshotDto>(factorSnapshotRequest);
  const factorSnapshot = factorSnapshotResult.data;
  const factorSectionRefreshing = factorSnapshot !== null && factorSnapshotResult.isRefreshing;
  const factorSectionBusy =
    factorSectionRefreshing ||
    (!factorSnapshot && (factorSnapshotResult.isInitialLoading || (!marketDate && symbolReady)));
  const familyResults = useMemo(
    () =>
      FACTOR_FAMILY_ORDER.map((family) => factorSnapshot?.families[family]).filter(
        (result): result is AnyFactorFamilyResult => Boolean(result),
      ),
    [factorSnapshot],
  );
  const advancedValueResult = factorSnapshot?.families.advancedValue ?? null;
  const valueHasUnifiedFields = Boolean(
    factorSnapshot?.families.value.item && hasUnifiedValueFields(factorSnapshot.families.value.item),
  );
  const familyCards = useMemo(
    () =>
      familyResults.map((result) =>
        buildFactorCardModel(copy, numberLocale, result, {
          advancedValueResult,
          valueHasUnifiedFields,
        }),
      ),
    [advancedValueResult, copy, familyResults, numberLocale, valueHasUnifiedFields],
  );
  const readyFamilyCount = useMemo(
    () => familyResults.filter((result) => result.ok && result.item).length,
    [familyResults],
  );
  const partialFailureCount = useMemo(
    () => familyResults.filter((result) => !result.ok).length,
    [familyResults],
  );

  if (!factorSnapshot && factorSectionBusy) {
    return (
      <section
        className={`${styles.panel} ${styles.factorSnapshotCard}`}
        id="factor-snapshot"
        aria-busy={true}
        data-refreshing="false"
      >
        <ComponentTag label="symbol.factor-snapshot" api="factor snapshot loading" />
        <div className={styles.emptyPanel}>
          <strong>{copy.factors.loadingTitle}</strong>
          <p className="clamp-3">{copy.factors.loadingBody}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`${styles.panel} ${styles.factorSnapshotCard}`}
      id="factor-snapshot"
      aria-busy={factorSectionBusy || undefined}
      data-refreshing={factorSectionRefreshing ? "true" : "false"}
    >
      <UnitRefreshFrame busy={factorSectionRefreshing} label={copy.common.refreshing}>
        <ComponentTag
          label="symbol.factor-snapshot"
          api="/api/trading/eod/momentum-factors + /api/trading/eod/low-risk-factors + /api/trading/eod/beta-factors + /api/trading/eod/value-factors + /api/trading/eod/advanced-value-factors"
        />

        <div className={styles.cardHeader}>
          <div>
            <p className={styles.sectionEyebrow}>{copy.factors.eyebrow}</p>
            <h2 className={styles.cardTitle}>{copy.factors.title}</h2>
          </div>
          <span className={`pill ${partialFailureCount > 0 ? "warning" : readyFamilyCount > 0 ? "info" : "neutral"}`}>
            {readyFamilyCount} / {FACTOR_FAMILY_ORDER.length} {copy.factors.familiesReady}
          </span>
        </div>

        <article className={styles.factorCompositeCard}>
          <div className={styles.factorCompositeHeader}>
            <div>
              <p className={styles.sectionEyebrow}>{copy.factors.compositeEyebrow}</p>
              <strong className={styles.factorFamilyTitle}>{copy.factors.compositeTitle}</strong>
            </div>
            <span className="pill neutral">{copy.factors.compositePending}</span>
          </div>

          <p className={`clamp-3 ${styles.supportingCopy}`}>
            {partialFailureCount > 0 ? copy.factors.partialFailureBody : copy.factors.compositeBody}
          </p>
          {marketDateBasisCopy ? <p className={styles.metaCaption}>{marketDateBasisCopy}</p> : null}

          <div className={styles.factorCompositeGrid}>
            <article className={styles.metricCard}>
              <span>{marketDateLabel}</span>
              <strong>{formatIsoDateLabel(marketDate, copy.common.datePending)}</strong>
            </article>
            <article className={styles.metricCard}>
              <span>{copy.factors.familiesReady}</span>
              <strong>
                {readyFamilyCount} / {FACTOR_FAMILY_ORDER.length}
              </strong>
            </article>
            <article className={styles.metricCard}>
              <span>{copy.factors.partialFailures}</span>
              <strong>{partialFailureCount}</strong>
            </article>
            <article className={styles.metricCard}>
              <span>{copy.factors.featureVersion}</span>
              <strong>{copy.factors.compositePending}</strong>
            </article>
          </div>
        </article>

        <div className={styles.factorFamilyGrid}>
          {familyCards.map((card) => (
            <article key={card.family} className={styles.factorFamilyCard}>
              <div className={styles.factorFamilyHeader}>
                <div>
                  <strong className={styles.factorFamilyTitle}>{card.title}</strong>
                  <p className={`clamp-3 ${styles.factorFamilySubtitle}`}>{card.subtitle}</p>
                </div>
                <span className={`pill ${card.status.tone}`}>
                  {formatFactorSnapshotStatusLabel(copy, card.status.code)}
                </span>
              </div>

              <p className={`clamp-3 ${styles.supportingCopy}`}>{card.body}</p>

              <div className={styles.metricGrid}>
                {card.metrics.map((metric) => (
                  <article key={`${card.family}-${metric.label}`} className={styles.metricCard}>
                    <span>{metric.label}</span>
                    <strong className={metric.valueClassName}>{metric.value}</strong>
                  </article>
                ))}
              </div>

              {card.quality ? (
                <div className={styles.factorQualityBlock} aria-label={`${card.title} quality score status`}>
                  <div className={styles.factorQualityHeader}>
                    <div>
                      <strong>{card.quality.title}</strong>
                      <p className={styles.supportingCopy}>{card.quality.summary}</p>
                    </div>
                    <span className={`pill ${card.quality.tone}`}>{card.quality.calculationLabel}</span>
                  </div>

                  <div className={styles.factorQualityMetricGrid}>
                    {card.quality.metrics.map((metric) => (
                      <article key={`${card.family}-quality-${metric.label}`} className={styles.metricCard}>
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                      </article>
                    ))}
                  </div>

                  {card.quality.componentNotes.length > 0 ? (
                    <div className={styles.tagGroup}>
                      {card.quality.componentNotes.map((note) => (
                        <span key={`${card.family}-quality-${note}`} className={styles.tagChip}>
                          {note}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className={styles.tagGroup}>
                {card.notes.map((note) => (
                  <span key={`${card.family}-${note}`} className={styles.tagChip}>
                    {note}
                  </span>
                ))}
              </div>

              <p className={styles.metaCaption}>{card.meta}</p>
            </article>
          ))}
        </div>
      </UnitRefreshFrame>
    </section>
  );
});
