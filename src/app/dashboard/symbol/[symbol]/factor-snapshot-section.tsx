"use client";

import { useMemo } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { UnitRefreshFrame } from "@/components/ui/unit-refresh-frame";
import type { SymbolDetailCopy } from "@/i18n/symbol-detail-copy";
import {
  FACTOR_FAMILY_META,
  FACTOR_FAMILY_ORDER,
  getAdvancedValueFactorStatusDescriptor,
  getBetaFactorStatusDescriptor,
  getFactorStatusLabel,
  getLowRiskFactorStatusDescriptor,
  getMomentumFactorStatusDescriptor,
  getValueFactorStatusDescriptor,
  loadSymbolFactorSnapshot,
  type FactorFamilyId,
  type FactorFamilySnapshotResult,
  type FactorStatusDescriptor,
  type SymbolFactorSnapshotDto,
} from "@/lib/factor-snapshot";
import { useUnitData } from "@/lib/use-unit-data";
import type { EodValueFactorItemDto } from "@/types/trading-api";

import styles from "./symbol-detail.module.css";

type FactorSnapshotSectionProps = {
  copy: SymbolDetailCopy;
  marketDate: string | null;
  normalizedSymbol: string;
  numberLocale: string;
  symbolReady: boolean;
};

type FactorCardMetric = {
  label: string;
  value: string;
  valueClassName?: string;
};

type FactorCardModel = {
  family: FactorFamilyId;
  title: string;
  subtitle: string;
  status: FactorStatusDescriptor;
  body: string;
  metrics: FactorCardMetric[];
  notes: string[];
  meta: string;
};

type AnyFactorFamilyResult =
  | FactorFamilySnapshotResult<"momentum">
  | FactorFamilySnapshotResult<"lowRisk">
  | FactorFamilySnapshotResult<"beta">
  | FactorFamilySnapshotResult<"value">
  | FactorFamilySnapshotResult<"advancedValue">;

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function humanizeToken(value: string | null | undefined, fallback = "Unavailable") {
  if (!value) return fallback;

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function uniqueNotes(notes: Array<string | null | undefined>) {
  return Array.from(new Set(notes.filter((note): note is string => Boolean(note && note.trim().length > 0))));
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
  const meta = FACTOR_FAMILY_META[result.family];
  const entries = result.summary?.entries ?? 0;

  return {
    family: result.family,
    title: meta.title,
    subtitle: meta.subtitle,
    status: result.ok ? { code: "missing_row", tone: "neutral" } : { code: "unavailable", tone: "warning" },
    body: result.ok
      ? copy.factors.missingBody
      : `${copy.factors.unavailableBody} ${result.error ?? copy.common.unavailable}.`,
    metrics: [
      { label: "Entries", value: String(entries) },
      {
        label: copy.factors.requestedMarketDate,
        value: formatIsoDateLabel(result.requestedMarketDate, copy.common.datePending),
      },
    ],
    notes: uniqueNotes([
      result.ok ? "Stored factor row not found for this symbol-date." : null,
      !result.ok ? result.error : null,
    ]),
    meta: buildCardMeta(copy, result),
  };
}

function buildMomentumBody(status: FactorStatusDescriptor) {
  switch (status.code) {
    case "eligible":
      return "12-1 momentum passed the trend filters and the recent overheat guard.";
    case "overheated":
      return "The trend was present, but the recent 5D move tripped the overheat filter.";
    case "insufficient_history":
      return "The stored bar history is too short for 12-1 momentum ranking.";
    default:
      return "Momentum row exists, but the trend confirmation filters did not all pass.";
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
    title: FACTOR_FAMILY_META[result.family].title,
    subtitle: FACTOR_FAMILY_META[result.family].subtitle,
    status,
    body: buildMomentumBody(status),
    metrics: [
      {
        label: "12-1 momentum",
        value: formatDecimalPercent(item.momentum_12_1, copy.common.unavailable, { signed: true }),
        valueClassName: getValueToneClassName(item.momentum_12_1),
      },
      { label: "Percentile", value: formatFactorScore(item.momentum_percentile, copy.common.unavailable) },
      { label: "Rank", value: formatRank(item.momentum_rank, "Unranked") },
      {
        label: "5D return",
        value: formatDecimalPercent(item.return_5d, copy.common.unavailable, { signed: true }),
        valueClassName: getValueToneClassName(item.return_5d),
      },
    ],
    notes: uniqueNotes([
      item.has_sufficient_history ? "253-bar history ready" : insufficientHistoryReason ?? "History below 253 bars",
      item.is_price_above_ma120 ? "Price above MA120" : "Price below MA120",
      item.is_ma60_above_ma120 ? "MA60 above MA120" : "MA60 below MA120",
      item.is_recent_overheated ? "Overheat guard tripped" : "Overheat guard clear",
    ]),
    meta: buildCardMeta(copy, result),
  };
}

function buildLowRiskBody(status: FactorStatusDescriptor) {
  switch (status.code) {
    case "eligible":
      return "Volatility, drawdown, and liquidity checks place the symbol inside the eligible low-risk bucket.";
    case "watchlist":
      return "The symbol passed the liquidity gate but did not reach the eligible low-risk score.";
    case "liquidity_excluded":
      return "Low-volatility signals were present, but the liquidity floor excluded the symbol.";
    case "insufficient_history":
      return "The stored history is not deep enough to score this low-risk row completely.";
    case "missing_market_date_bar":
      return "No stored market-date bar was available for the requested date.";
    default:
      return "The row is stored, but the low-risk score did not meet the classification thresholds.";
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
    title: FACTOR_FAMILY_META[result.family].title,
    subtitle: FACTOR_FAMILY_META[result.family].subtitle,
    status,
    body: buildLowRiskBody(status),
    metrics: [
      { label: "Low-risk score", value: formatFactorScore(item.low_risk_score, copy.common.unavailable) },
      {
        label: "Liquidity percentile",
        value: formatFactorScore(item.liquidity_percentile, copy.common.unavailable),
      },
      {
        label: "120D drawdown",
        value: formatDecimalPercent(item.max_drawdown_120d, copy.common.unavailable, { signed: true }),
        valueClassName: getValueToneClassName(item.max_drawdown_120d),
      },
      {
        label: "120D volatility",
        value: formatDecimalPercent(item.volatility_120d, copy.common.unavailable),
      },
      {
        label: "20D trading value",
        value: formatCompactNumber(item.avg_trading_value_20d, copy.common.unavailable, numberLocale),
      },
    ],
    notes: uniqueNotes([
      item.passes_liquidity_floor === true
        ? "Liquidity floor passed"
        : item.passes_liquidity_floor === false
          ? "Liquidity floor failed"
          : "Liquidity floor pending",
      `${item.history_days_available} history days`,
      item.low_risk_classification ? humanizeToken(item.low_risk_classification) : null,
    ]),
    meta: buildCardMeta(copy, result),
  };
}

function buildBetaBody(status: FactorStatusDescriptor, benchmarkId: string | null) {
  switch (status.code) {
    case "eligible":
      return `Trailing beta sits inside the eligible low-beta band versus ${benchmarkId ?? "the configured benchmark"}.`;
    case "watchlist":
      return `Beta is reasonable versus ${benchmarkId ?? "the configured benchmark"}, but the score stopped at watchlist.`;
    case "insufficient_history":
      return "The shared return window is too short to score beta for this symbol-date.";
    case "missing_market_date_bar":
      return "No stored market-date bar was available for the requested date.";
    default:
      return "The low-beta score did not reach the eligible or watchlist thresholds.";
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
    title: FACTOR_FAMILY_META[result.family].title,
    subtitle: FACTOR_FAMILY_META[result.family].subtitle,
    status,
    body: buildBetaBody(status, item.benchmark_id),
    metrics: [
      { label: "Low-beta score", value: formatFactorScore(item.low_beta_score, copy.common.unavailable) },
      { label: "Beta 60D", value: formatRatio(item.beta_60d, copy.common.unavailable) },
      { label: "Beta 120D", value: formatRatio(item.beta_120d, copy.common.unavailable) },
      {
        label: "120D percentile",
        value: formatFactorScore(item.beta_120d_percentile, copy.common.unavailable),
      },
      { label: "Benchmark", value: item.benchmark_id ?? copy.common.unavailable },
    ],
    notes: uniqueNotes([
      item.low_beta_classification ? humanizeToken(item.low_beta_classification) : null,
      `${item.history_days_available} history days`,
      item.benchmark_market ? `${item.benchmark_market} benchmark context` : null,
    ]),
    meta: buildCardMeta(copy, result),
  };
}

function readValueMetricStatuses(item: EodValueFactorItemDto) {
  const payload = getRecord(item.factor_payload);
  const metricStatuses = getRecord(payload?.metric_statuses);

  return {
    per: item.per_status,
    pbr: getString(metricStatuses?.pbr),
    dividendYield: getString(metricStatuses?.dividend_yield),
  };
}

function buildValueBody(status: FactorStatusDescriptor) {
  switch (status.code) {
    case "scored":
      return "Cross-sectional value ranks are available across PER, PBR, and dividend yield.";
    case "invalid_per":
      return "PER is non-positive, so the symbol is stored but cannot be value-scored.";
    case "missing_market_date_bar":
      return "No stored market-date bar was available for the requested date.";
    default:
      return "One or more required value inputs were missing for this stored symbol-date row.";
  }
}

function buildValueCardModel(
  copy: SymbolDetailCopy,
  result: FactorFamilySnapshotResult<"value">,
): FactorCardModel {
  const item = result.item;
  if (!item) return buildUnavailableCardModel(copy, result);

  const status = getValueFactorStatusDescriptor(item);
  const metricStatuses = readValueMetricStatuses(item);

  return {
    family: result.family,
    title: FACTOR_FAMILY_META[result.family].title,
    subtitle: FACTOR_FAMILY_META[result.family].subtitle,
    status,
    body: buildValueBody(status),
    metrics: [
      { label: "Value score", value: formatFactorScore(item.value_score, copy.common.unavailable) },
      {
        label: "Value percentile",
        value: formatFactorScore(item.value_percentile, copy.common.unavailable),
      },
      { label: "PER", value: formatRatio(item.per, copy.common.unavailable) },
      { label: "PBR", value: formatRatio(item.pbr, copy.common.unavailable) },
      {
        label: "Dividend yield",
        value: formatDecimalPercent(item.dividend_yield, copy.common.unavailable),
      },
    ],
    notes: uniqueNotes([
      metricStatuses.per ? `PER status: ${humanizeToken(metricStatuses.per)}` : null,
      metricStatuses.pbr ? `PBR status: ${humanizeToken(metricStatuses.pbr)}` : null,
      metricStatuses.dividendYield ? `Yield status: ${humanizeToken(metricStatuses.dividendYield)}` : null,
      item.value_status ? `Row status: ${humanizeToken(item.value_status)}` : null,
    ]),
    meta: buildCardMeta(copy, result),
  };
}

function buildAdvancedValueBody(status: FactorStatusDescriptor) {
  switch (status.code) {
    case "eligible":
      return "FCF yield and EV / EBITDA both scored, so the advanced-value rank is fully available.";
    case "watchlist":
      return "Both advanced-value components scored, but the combined score stopped at watchlist.";
    case "insufficient_fundamentals":
      return "The symbol did not have a usable stored annual fundamentals snapshot on or before this market date.";
    case "insufficient_components":
      return "Only part of the advanced-value methodology could be scored from the stored price and DART inputs.";
    case "missing_market_date_bar":
      return "No stored market-date bar was available for the requested date.";
    default:
      return "The advanced-value score was available but did not meet the eligible threshold.";
  }
}

function buildAdvancedValueCardModel(
  copy: SymbolDetailCopy,
  result: FactorFamilySnapshotResult<"advancedValue">,
): FactorCardModel {
  const item = result.item;
  if (!item) return buildUnavailableCardModel(copy, result);

  const status = getAdvancedValueFactorStatusDescriptor(item);

  return {
    family: result.family,
    title: FACTOR_FAMILY_META[result.family].title,
    subtitle: FACTOR_FAMILY_META[result.family].subtitle,
    status,
    body: buildAdvancedValueBody(status),
    metrics: [
      {
        label: "Advanced score",
        value: formatFactorScore(item.advanced_value_score, copy.common.unavailable),
      },
      {
        label: "Advanced percentile",
        value: formatFactorScore(item.advanced_value_percentile, copy.common.unavailable),
      },
      {
        label: "FCF yield",
        value: formatDecimalPercent(item.fcf_yield, copy.common.unavailable, { signed: true }),
        valueClassName: getValueToneClassName(item.fcf_yield),
      },
      { label: "EV / EBITDA", value: formatRatio(item.ev_to_ebitda, copy.common.unavailable) },
      { label: "Components", value: `${item.advanced_value_components_used} / 2` },
    ],
    notes: uniqueNotes([
      item.fcf_yield_status ? `FCF yield: ${humanizeToken(item.fcf_yield_status)}` : null,
      item.ev_to_ebitda_status ? `EV / EBITDA: ${humanizeToken(item.ev_to_ebitda_status)}` : null,
      item.advanced_value_classification
        ? `Classification: ${humanizeToken(item.advanced_value_classification)}`
        : null,
    ]),
    meta: buildCardMeta(copy, result),
  };
}

function buildFactorCardModel(
  copy: SymbolDetailCopy,
  numberLocale: string,
  result: AnyFactorFamilyResult,
): FactorCardModel {
  switch (result.family) {
    case "momentum":
      return buildMomentumCardModel(copy, result);
    case "lowRisk":
      return buildLowRiskCardModel(copy, numberLocale, result);
    case "beta":
      return buildBetaCardModel(copy, result);
    case "value":
      return buildValueCardModel(copy, result);
    case "advancedValue":
      return buildAdvancedValueCardModel(copy, result);
  }
}

export function FactorSnapshotSection({
  copy,
  marketDate,
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

  const familyResults = FACTOR_FAMILY_ORDER.map((family) =>
    factorSnapshot?.families[family],
  ).filter((result): result is AnyFactorFamilyResult => Boolean(result));
  const familyCards = familyResults.map((result) => buildFactorCardModel(copy, numberLocale, result));
  const readyFamilyCount = familyResults.filter((result) => result.ok && result.item).length;
  const partialFailureCount = familyResults.filter((result) => !result.ok).length;

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

          <div className={styles.factorCompositeGrid}>
            <article className={styles.metricCard}>
              <span>{copy.factors.requestedMarketDate}</span>
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
                <span className={`pill ${card.status.tone}`}>{getFactorStatusLabel(card.status.code)}</span>
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
}
