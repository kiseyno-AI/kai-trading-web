"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { UnitRefreshFrame } from "@/components/ui/unit-refresh-frame";
import type { AggregateContextLoadState } from "@/app/dashboard/symbol/[symbol]/symbol-detail-state";
import { getDisclosureSectionState } from "@/app/dashboard/symbol/[symbol]/symbol-detail-state";
import type { SymbolDetailCopy } from "@/i18n/symbol-detail-copy";
import { formatDisplayTimestamp, formatPrice } from "@/lib/format";
import { useUnitData } from "@/lib/use-unit-data";
import type {
  AgentContextActionSummaryDto,
  AgentContextResponseDto,
  AgentContextTechnicalSnapshotDto,
  DartFundamentalsHistoryResponseDto,
  EodActionSummariesResponseDto,
  EodFreshnessResponseDto,
  EodPiotroskiFilterResultsResponseDto,
  EodTechnicalSnapshotsResponseDto,
} from "@/types/trading-api";
import styles from "@/app/dashboard/symbol/[symbol]/symbol-detail.module.css";

import { fetchUnitJson } from "./symbol-detail-api";
import {
  buildActionFreshnessDate,
  buildActionHeadline,
  buildActionTone,
  buildConfidenceTone,
  buildDisclosureCoverageNote,
  buildDisclosureReportHref,
  buildFreshnessTone,
  buildFundamentalsCoverageNote,
  buildFundamentalsDate,
  buildFundamentalsHistoryQuery,
  buildFundamentalsLatestLabel,
  buildFundamentalsMetricFallbacks,
  buildInsightTags,
  buildLatestDisclosure,
  buildLatestPriceLabel,
  buildModuleStatusTone,
  buildTechnicalFreshnessDate,
  buildTechnicalHeadline,
  buildTechnicalTone,
  formatHighlightLabel,
  formatHighlightValue,
  formatIsoDateLabel,
  formatNumberOrDash,
  formatSignedPercent,
  getPiotroskiLabel,
  humanizeToken,
  hasNumber,
  normalizeHighlightMetrics,
  pickFundamentalsCompany,
  buildHistoryEntryMetrics,
  buildQuoteSourceLabel,
} from "./symbol-detail-derived-state";
import type { QuoteResponse } from "./symbol-detail-types";

type SymbolDetailUnitProps = {
  copy: SymbolDetailCopy;
  fsDiv: string | null;
  marketDate: string | null;
  normalizedSymbol: string;
  symbol: string;
  symbolReady: boolean;
};

type UseSymbolAggregateContextOptions = Pick<
  SymbolDetailUnitProps,
  "copy" | "fsDiv" | "marketDate" | "normalizedSymbol" | "symbolReady"
> & {
  disclosureItemLimit?: number;
  enabled?: boolean;
};

function useSymbolAggregateContextData({
  copy,
  disclosureItemLimit = 4,
  enabled = true,
  fsDiv,
  marketDate,
  normalizedSymbol,
  symbolReady,
}: UseSymbolAggregateContextOptions) {
  const aggregateRequest = useMemo(
    () => ({
      enabled: enabled && symbolReady && Boolean(marketDate),
      key: [
        "symbol-detail",
        "aggregate-context",
        normalizedSymbol,
        marketDate ?? "pending",
        fsDiv ?? "default",
        disclosureItemLimit,
      ] as const,
      ttlMs: 30_000,
      fetcher: async () => {
        if (!marketDate) {
          throw new Error("Market date pending");
        }

        const aggregateParams = new URLSearchParams();
        aggregateParams.set("market_date", marketDate);
        aggregateParams.append("symbols", normalizedSymbol);
        aggregateParams.set("disclosures_limit", String(disclosureItemLimit));
        if (fsDiv) {
          aggregateParams.set("fs_div", fsDiv);
        }

        return fetchUnitJson<AgentContextResponseDto>(
          `/api/trading/agent-context/symbol-day?${aggregateParams.toString()}`,
        );
      },
    }),
    [disclosureItemLimit, enabled, fsDiv, marketDate, normalizedSymbol, symbolReady],
  );
  const aggregateResponseResult = useUnitData<AgentContextResponseDto>(aggregateRequest);
  const aggregateResponse = enabled ? aggregateResponseResult.data : null;
  const aggregateContext =
    aggregateResponse?.items.find((item) => item.symbol === normalizedSymbol) ?? null;
  const aggregateContextLoadState: AggregateContextLoadState =
    !enabled
      ? "success"
      : !marketDate
        ? "loading"
        : aggregateResponseResult.error && !aggregateResponse
          ? "error"
          : aggregateContext
            ? "success"
            : aggregateResponseResult.hasData
              ? "error"
              : "loading";
  const aggregateContextError =
    !enabled || !marketDate
      ? null
      : aggregateResponseResult.error && !aggregateResponse
        ? copy.errors.aggregateUnavailable
        : aggregateResponseResult.hasData && !aggregateContext
          ? copy.errors.aggregateMissing
          : null;
  const aggregateContextRefreshing =
    enabled &&
    aggregateResponse !== null &&
    aggregateResponseResult.isRefreshing;

  return {
    aggregateContext,
    aggregateContextError,
    aggregateContextLoadState,
    aggregateContextRefreshing,
    aggregateResponse,
  };
}

export function HeroFundamentalLatestMetric({
  copy,
  fsDiv,
  marketDate,
  normalizedSymbol,
  symbolReady,
}: Pick<SymbolDetailUnitProps, "copy" | "fsDiv" | "marketDate" | "normalizedSymbol" | "symbolReady">) {
  const { aggregateContext, aggregateContextError, aggregateContextLoadState, aggregateContextRefreshing } =
    useSymbolAggregateContextData({
      copy,
      fsDiv,
      marketDate,
      normalizedSymbol,
      symbolReady,
    });
  const latestDisclosure = buildLatestDisclosure(aggregateContext?.recent_disclosures.items ?? []);
  const latestFundamentals = aggregateContext?.fundamentals.latest_snapshot ?? null;
  const value =
    latestDisclosure?.report_nm ??
    (latestFundamentals
      ? buildFundamentalsLatestLabel(null, latestFundamentals, copy)
      : aggregateContextLoadState === "loading"
        ? copy.hero.priceLoading
        : copy.disclosures.emptyTitle);
  const detailDate =
    latestDisclosure?.receipt_date ?? buildFundamentalsDate(null, latestFundamentals, aggregateContext);

  return (
    <article className={styles.heroMetricCard} aria-busy={aggregateContextRefreshing || undefined}>
      <span>{copy.hero.fundamentalLatest}</span>
      <strong className="clamp-3">{value}</strong>
      {detailDate ? <p className="clamp-3">{formatIsoDateLabel(detailDate)}</p> : null}
      {!detailDate && aggregateContextError ? <p className="clamp-3">{aggregateContextError}</p> : null}
    </article>
  );
}

export function HeroPiotroskiMetric({
  copy,
  marketDate,
  normalizedSymbol,
  symbolReady,
}: Pick<SymbolDetailUnitProps, "copy" | "marketDate" | "normalizedSymbol" | "symbolReady">) {
  const piotroskiRequest = useMemo(
    () => ({
      enabled: symbolReady && Boolean(marketDate),
      key: ["symbol-detail", "piotroski", normalizedSymbol, marketDate ?? "pending"] as const,
      ttlMs: 30_000,
      fetcher: async () => {
        if (!marketDate) {
          throw new Error("Market date pending");
        }

        const query = new URLSearchParams();
        query.set("market_date", marketDate);
        query.set("symbol", normalizedSymbol);

        return fetchUnitJson<EodPiotroskiFilterResultsResponseDto>(
          `/api/trading/eod/piotroski-filter-results?${query.toString()}`,
        );
      },
    }),
    [marketDate, normalizedSymbol, symbolReady],
  );
  const piotroskiResponseResult = useUnitData<EodPiotroskiFilterResultsResponseDto>(piotroskiRequest);
  const piotroskiResult = piotroskiResponseResult.data?.item ?? null;
  const piotroskiLoadState: AggregateContextLoadState =
    !symbolReady || !marketDate
      ? "loading"
      : piotroskiResponseResult.data
        ? "success"
        : piotroskiResponseResult.error
          ? "error"
          : "loading";
  const piotroskiLabel = getPiotroskiLabel(piotroskiResult, piotroskiLoadState, copy);
  const piotroskiValueClassName = piotroskiResult
    ? piotroskiResult.passed_filter
      ? styles.positive
      : styles.negative
    : undefined;

  return (
    <article
      className={styles.heroMetricCard}
      aria-busy={
        (piotroskiResponseResult.isRefreshing || (!piotroskiResult && piotroskiLoadState === "loading")) || undefined
      }
    >
      <span>{copy.hero.piotroskiFilter}</span>
      <strong className={piotroskiValueClassName}>{piotroskiLabel}</strong>
    </article>
  );
}

export function ActionSummarySection({
  copy,
  fsDiv,
  marketDate,
  normalizedSymbol,
  symbolReady,
}: Pick<SymbolDetailUnitProps, "copy" | "fsDiv" | "marketDate" | "normalizedSymbol" | "symbolReady">) {
  const { aggregateContext, aggregateContextLoadState, aggregateContextRefreshing } = useSymbolAggregateContextData({
    copy,
    fsDiv,
    marketDate,
    normalizedSymbol,
    symbolReady,
  });
  const actionSummaryRequest = useMemo(
    () => ({
      enabled: symbolReady && Boolean(marketDate),
      key: ["symbol-detail", "action-summary", normalizedSymbol, marketDate ?? "pending"] as const,
      ttlMs: 30_000,
      fetcher: async () => {
        if (!marketDate) {
          throw new Error("Market date pending");
        }

        const insightQuery = new URLSearchParams();
        insightQuery.set("market_date", marketDate);
        insightQuery.append("symbols", normalizedSymbol);
        const data = await fetchUnitJson<EodActionSummariesResponseDto>(
          `/api/trading/eod/action-summaries?${insightQuery.toString()}`,
        );

        return data.items.find((item) => item.symbol === normalizedSymbol) ?? data.items[0] ?? null;
      },
    }),
    [marketDate, normalizedSymbol, symbolReady],
  );
  const actionSummaryResult = useUnitData<AgentContextActionSummaryDto | null>(actionSummaryRequest);
  const resolvedActionSummary = actionSummaryResult.data ?? aggregateContext?.action_summary ?? null;
  const actionReasons = resolvedActionSummary?.reasons.slice(0, 4) ?? [];
  const actionPayloadTags = buildInsightTags(resolvedActionSummary?.summary_payload);
  const actionTone = buildActionTone(resolvedActionSummary);
  const actionScore = Math.max(0, Math.min(resolvedActionSummary?.signal_score ?? 0, 100));
  const actionSectionRefreshing =
    (actionSummaryResult.hasData || aggregateContext !== null) &&
    (actionSummaryResult.isRefreshing || aggregateContextRefreshing);
  const actionSectionBusy =
    actionSectionRefreshing ||
    (!resolvedActionSummary &&
      (aggregateContextLoadState === "loading" || actionSummaryResult.isInitialLoading || (!marketDate && symbolReady)));

  return (
    <section
      className={`${styles.panel} ${styles.insightCard}`}
      id="action"
      aria-busy={actionSectionBusy || undefined}
      data-refreshing={actionSectionRefreshing ? "true" : "false"}
    >
      <UnitRefreshFrame busy={actionSectionRefreshing} label={copy.common.refreshing}>
        <ComponentTag
          label="symbol.action-summary"
          api="/api/trading/eod/action-summaries + /api/trading/agent-context/symbol-day"
        />

        <div className={styles.cardHeader}>
          <div>
            <p className={styles.sectionEyebrow}>{copy.action.eyebrow}</p>
            <h2 className={styles.cardTitle}>{copy.action.title}</h2>
          </div>
          <span className={`pill ${actionTone}`}>
            {resolvedActionSummary ? humanizeToken(resolvedActionSummary.action_label) : copy.action.unavailable}
          </span>
        </div>

        <div className={styles.signalMeter}>
          <div className={styles.signalTrack}>
            <span className={styles.signalSell}>{copy.action.sell}</span>
            <span className={styles.signalStrong}>{copy.action.strongBuy}</span>
            <div className={styles.signalFill} style={{ width: `${actionScore}%` }} />
          </div>
        </div>

        <strong className={`clamp-3 ${styles.insightHeadline}`}>
          {buildActionHeadline(resolvedActionSummary, copy)}
        </strong>
        <p className={`clamp-3 ${styles.supportingCopy}`}>
          {actionReasons.length > 0 ? actionReasons.join(" ") : copy.action.emptyBody}
        </p>

        <div className={styles.metricGrid}>
          <article className={styles.metricCard}>
            <span>{copy.action.confidence}</span>
            <strong>{humanizeToken(resolvedActionSummary?.confidence_tier)}</strong>
          </article>
          <article className={styles.metricCard}>
            <span>{copy.action.risk}</span>
            <strong>{humanizeToken(resolvedActionSummary?.risk_tier)}</strong>
          </article>
          <article className={styles.metricCard}>
            <span>{copy.action.trigger}</span>
            <strong>
              {hasNumber(resolvedActionSummary?.trigger_price)
                ? `₩${formatPrice(resolvedActionSummary.trigger_price)}`
                : copy.action.noTriggerPrice}
            </strong>
          </article>
        </div>

        <div className={styles.tagGroup}>
          {(actionReasons.length > 0 ? actionReasons : [copy.action.noRationaleRows]).map((reason) => (
            <span key={reason} className={styles.tagChip}>
              {reason}
            </span>
          ))}
        </div>

        <p className={styles.metaCaption}>
          {copy.action.payloadKeys}: {actionPayloadTags.join(" · ")}
        </p>
      </UnitRefreshFrame>
    </section>
  );
}

export function TechnicalAnalysisSection({
  copy,
  fsDiv,
  marketDate,
  normalizedSymbol,
  symbolReady,
}: Pick<SymbolDetailUnitProps, "copy" | "fsDiv" | "marketDate" | "normalizedSymbol" | "symbolReady">) {
  const { aggregateContext, aggregateContextRefreshing, aggregateContextLoadState } = useSymbolAggregateContextData({
    copy,
    fsDiv,
    marketDate,
    normalizedSymbol,
    symbolReady,
  });
  const technicalSnapshotRequest = useMemo(
    () => ({
      enabled: symbolReady && Boolean(marketDate),
      key: ["symbol-detail", "technical-snapshot", normalizedSymbol, marketDate ?? "pending"] as const,
      ttlMs: 30_000,
      fetcher: async () => {
        if (!marketDate) {
          throw new Error("Market date pending");
        }

        const insightQuery = new URLSearchParams();
        insightQuery.set("market_date", marketDate);
        insightQuery.append("symbols", normalizedSymbol);
        const data = await fetchUnitJson<EodTechnicalSnapshotsResponseDto>(
          `/api/trading/eod/technical-snapshots?${insightQuery.toString()}`,
        );

        return data.items.find((item) => item.symbol === normalizedSymbol) ?? data.items[0] ?? null;
      },
    }),
    [marketDate, normalizedSymbol, symbolReady],
  );
  const technicalSnapshotResult = useUnitData<AgentContextTechnicalSnapshotDto | null>(technicalSnapshotRequest);
  const resolvedTechnicalSnapshot = technicalSnapshotResult.data ?? aggregateContext?.technical_snapshot ?? null;
  const technicalPayloadTags = buildInsightTags(resolvedTechnicalSnapshot?.signal_payload);
  const technicalTone = buildTechnicalTone(resolvedTechnicalSnapshot);
  const technicalFreshnessDate = buildTechnicalFreshnessDate(resolvedTechnicalSnapshot, null);
  const technicalSectionRefreshing =
    (technicalSnapshotResult.hasData || aggregateContext !== null) &&
    (technicalSnapshotResult.isRefreshing || aggregateContextRefreshing);
  const technicalSectionBusy =
    technicalSectionRefreshing ||
    (!resolvedTechnicalSnapshot &&
      (aggregateContextLoadState === "loading" || technicalSnapshotResult.isInitialLoading || (!marketDate && symbolReady)));

  return (
    <section
      className={`${styles.panel} ${styles.insightCard}`}
      id="technical"
      aria-busy={technicalSectionBusy || undefined}
      data-refreshing={technicalSectionRefreshing ? "true" : "false"}
    >
      <UnitRefreshFrame busy={technicalSectionRefreshing} label={copy.common.refreshing}>
        <ComponentTag
          label="symbol.technical-analysis"
          api="/api/trading/eod/technical-snapshots + /api/trading/agent-context/symbol-day"
        />

        <div className={styles.cardHeader}>
          <div>
            <p className={styles.sectionEyebrow}>{copy.technical.eyebrow}</p>
            <h2 className={styles.cardTitle}>{copy.technical.title}</h2>
          </div>
          <span className={`pill ${technicalTone}`}>
            {resolvedTechnicalSnapshot
              ? humanizeToken(resolvedTechnicalSnapshot.trend_state)
              : copy.technical.unavailable}
          </span>
        </div>

        <strong className={`clamp-3 ${styles.insightHeadline}`}>
          {buildTechnicalHeadline(resolvedTechnicalSnapshot, copy)}
        </strong>
        <p className={`clamp-3 ${styles.supportingCopy}`}>
          {resolvedTechnicalSnapshot
            ? `${copy.technical.breakout20d} ${resolvedTechnicalSnapshot.breakout_20d ? copy.technical.yes : copy.technical.no} · ${copy.technical.breakdown20d} ${resolvedTechnicalSnapshot.breakdown_20d ? copy.technical.yes : copy.technical.no} · ${copy.technical.source} ${resolvedTechnicalSnapshot.source}`
            : copy.technical.emptyBody}
        </p>

        <div className={styles.metricGrid}>
          <article className={styles.metricCard}>
            <span>{copy.technical.return5d}</span>
            <strong>{formatSignedPercent(resolvedTechnicalSnapshot?.return_5d, copy.technical.noReturn5d)}</strong>
          </article>
          <article className={styles.metricCard}>
            <span>{copy.technical.return20d}</span>
            <strong>{formatSignedPercent(resolvedTechnicalSnapshot?.return_20d, copy.technical.noReturn20d)}</strong>
          </article>
          <article className={styles.metricCard}>
            <span>{copy.technical.volumeRatio20d}</span>
            <strong>{formatNumberOrDash(resolvedTechnicalSnapshot?.volume_ratio_20d)}</strong>
          </article>
          <article className={styles.metricCard}>
            <span>{copy.technical.atr14}</span>
            <strong>{formatNumberOrDash(resolvedTechnicalSnapshot?.atr_14)}</strong>
          </article>
        </div>

        <div className={styles.tagGroup}>
          {technicalPayloadTags.map((tag) => (
            <span key={tag} className={styles.tagChip}>
              {tag}
            </span>
          ))}
        </div>

        <p className={styles.metaCaption}>
          {copy.technical.sourceDate} {technicalFreshnessDate ?? copy.technical.noSourceDate} ·{" "}
          {copy.technical.freshnessNote}
        </p>
      </UnitRefreshFrame>
    </section>
  );
}

export function FundamentalsHistorySection({
  copy,
  fsDiv,
  marketDate,
  normalizedSymbol,
  symbol,
  symbolReady,
  introTitle,
  fundamentalsEntryLimit,
}: SymbolDetailUnitProps & {
  fundamentalsEntryLimit: number;
  introTitle: string;
}) {
  const { aggregateContext, aggregateContextLoadState, aggregateContextRefreshing } = useSymbolAggregateContextData({
    copy,
    fsDiv,
    marketDate,
    normalizedSymbol,
    symbolReady,
  });
  const fundamentalsHistoryRequest = useMemo(
    () => ({
      enabled: symbolReady && Boolean(marketDate),
      key: [
        "symbol-detail",
        "fundamentals-history",
        normalizedSymbol,
        marketDate ?? "pending",
        fsDiv ?? "default",
      ] as const,
      ttlMs: 30_000,
      fetcher: async () => {
        if (!marketDate) {
          throw new Error("Market date pending");
        }

        const query = buildFundamentalsHistoryQuery(normalizedSymbol, marketDate, fsDiv);
        return fetchUnitJson<DartFundamentalsHistoryResponseDto>(
          `/api/trading/disclosures/dart/fundamentals/history?${query}`,
        );
      },
    }),
    [fsDiv, marketDate, normalizedSymbol, symbolReady],
  );
  const fundamentalsHistoryResult = useUnitData<DartFundamentalsHistoryResponseDto>(fundamentalsHistoryRequest);
  const fundamentalsHistory = fundamentalsHistoryResult.data;
  const latestFundamentals = aggregateContext?.fundamentals.latest_snapshot ?? null;
  const companyHistory = pickFundamentalsCompany(fundamentalsHistory, symbol);
  const latestHistoryEntry = companyHistory?.entries[0] ?? null;
  const latestHistoryHighlights = normalizeHighlightMetrics(latestHistoryEntry?.highlights).slice(0, 3);
  const latestAggregateHighlights = normalizeHighlightMetrics(latestFundamentals?.highlights).slice(0, 3);
  const latestHighlights =
    latestHistoryHighlights.length > 0
      ? latestHistoryHighlights
      : latestAggregateHighlights.length > 0
        ? latestAggregateHighlights
        : buildFundamentalsMetricFallbacks(latestFundamentals, latestHistoryEntry, copy);
  const fundamentalsSectionRefreshing =
    (fundamentalsHistory !== null || aggregateContext !== null) &&
    (fundamentalsHistoryResult.isRefreshing || aggregateContextRefreshing);
  const fundamentalsSectionBusy =
    fundamentalsSectionRefreshing ||
    (!companyHistory?.entries.length &&
      !latestFundamentals &&
      (aggregateContextLoadState === "loading" || fundamentalsHistoryResult.isInitialLoading || (!marketDate && symbolReady)));
  const fundamentalsLoading =
    !companyHistory?.entries.length &&
    !latestFundamentals &&
    (aggregateContextLoadState === "loading" || fundamentalsHistoryResult.isInitialLoading || (!marketDate && symbolReady));

  return (
    <section
      className={`${styles.panel} ${styles.evidenceCard}`}
      id="fundamentals"
      aria-busy={fundamentalsSectionBusy || undefined}
      data-refreshing={fundamentalsSectionRefreshing ? "true" : "false"}
    >
      <UnitRefreshFrame busy={fundamentalsSectionRefreshing} label={copy.common.refreshing}>
        <ComponentTag
          label="symbol.fundamentals-history"
          api="/api/trading/disclosures/dart/fundamentals/history + /api/trading/agent-context/symbol-day"
        />

        <div className={styles.cardHeader}>
          <div>
            <p className={styles.sectionEyebrow}>{copy.fundamentals.eyebrow}</p>
            <h2 className={styles.cardTitle}>{copy.fundamentals.title}</h2>
          </div>
          <span className={`pill ${buildConfidenceTone(fsDiv)}`}>{fsDiv ?? copy.fundamentals.defaultFs}</span>
        </div>

        <div className={styles.companyStrip}>
          <div className={styles.companyAvatar}>{symbol.slice(0, 1)}</div>
          <div>
            <strong>{introTitle}</strong>
            <p className="clamp-3">
              {copy.fundamentals.latestFilingPrefix} {buildFundamentalsLatestLabel(latestHistoryEntry, latestFundamentals, copy)}.
            </p>
          </div>
        </div>

        <div className={styles.metricGrid}>
          {latestHighlights.length > 0 ? (
            latestHighlights.map((metric, index) => (
              <article key={`${formatHighlightLabel(metric, index)}-${index}`} className={styles.metricCard}>
                <span>{formatHighlightLabel(metric, index)}</span>
                <strong>{formatHighlightValue(metric, copy)}</strong>
              </article>
            ))
          ) : (
            <article className={styles.metricCard}>
              <span>{copy.fundamentals.latestFiling}</span>
              <strong>{buildFundamentalsLatestLabel(latestHistoryEntry, latestFundamentals, copy)}</strong>
            </article>
          )}
        </div>

        <div className={styles.historyList}>
          {companyHistory?.entries.length ? (
            companyHistory.entries.slice(0, fundamentalsEntryLimit).map((entry) => {
              const visibleHighlights = buildHistoryEntryMetrics(entry, copy);

              return (
                <article key={entry.filing.rcept_no} className={styles.historyCard}>
                  <div className={styles.historyHeader}>
                    <div>
                      <strong className="clamp-3">
                        {entry.period.report_label ??
                          `${entry.period.business_year ?? copy.fundamentals.unknownYear} ${entry.period.report_code ?? ""}`}
                      </strong>
                      <p className="clamp-3">
                        {entry.filing.report_nm ?? copy.fundamentals.unnamedFiling} · {copy.fundamentals.receipt}{" "}
                        {entry.filing.receipt_date ?? copy.fundamentals.noReceiptDate}
                      </p>
                    </div>
                    <span className="pill neutral">{entry.statement.fs_div ?? copy.fundamentals.fsPending}</span>
                  </div>
                  <div className={styles.historyMetrics}>
                    {visibleHighlights.map((metric, index) => (
                      <div
                        key={`${entry.filing.rcept_no}-${formatHighlightLabel(metric, index)}-${index}`}
                        className={styles.historyMetricRow}
                      >
                        <span>{formatHighlightLabel(metric, index)}</span>
                        <strong>{formatHighlightValue(metric, copy)}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })
          ) : fundamentalsLoading ? (
            <div className={styles.emptyPanel}>
              <strong>{copy.fundamentals.loadingTitle}</strong>
              <p className="clamp-3">{copy.fundamentals.loadingBody}</p>
            </div>
          ) : (
            <div className={styles.emptyPanel}>
              <strong>{copy.fundamentals.emptyTitle}</strong>
              <p className="clamp-3">{buildFundamentalsCoverageNote(companyHistory, latestFundamentals, copy)}</p>
            </div>
          )}
        </div>
      </UnitRefreshFrame>
    </section>
  );
}

export function DisclosureCoverageSection({
  copy,
  fsDiv,
  marketDate,
  normalizedSymbol,
  routeQueryString,
  symbol,
  symbolReady,
  disclosureItemLimit,
}: SymbolDetailUnitProps & {
  disclosureItemLimit: number;
  routeQueryString: string;
}) {
  const {
    aggregateContext,
    aggregateContextLoadState,
    aggregateContextRefreshing,
    aggregateResponse,
  } = useSymbolAggregateContextData({
    copy,
    disclosureItemLimit,
    fsDiv,
    marketDate,
    normalizedSymbol,
    symbolReady,
  });
  const disclosureSectionState = getDisclosureSectionState(
    aggregateContextLoadState,
    aggregateContext !== null,
    aggregateContext?.recent_disclosures.count ?? 0,
  );
  const latestDisclosure = buildLatestDisclosure(aggregateContext?.recent_disclosures.items ?? []);
  const disclosureSectionRefreshing = aggregateResponse !== null && aggregateContextRefreshing;
  const disclosureSectionBusy =
    disclosureSectionRefreshing ||
    disclosureSectionState === "loading" ||
    (!aggregateContext && !marketDate && symbolReady);

  return (
    <section
      className={`${styles.panel} ${styles.evidenceCard}`}
      id="disclosures"
      aria-busy={disclosureSectionBusy || undefined}
      data-refreshing={disclosureSectionRefreshing ? "true" : "false"}
    >
      <UnitRefreshFrame busy={disclosureSectionRefreshing} label={copy.common.refreshing}>
        <ComponentTag label="symbol.disclosures" api="/api/trading/agent-context/symbol-day" />

        <div className={styles.cardHeader}>
          <div>
            <p className={styles.sectionEyebrow}>{copy.disclosures.eyebrow}</p>
            <h2 className={styles.cardTitle}>{copy.disclosures.title}</h2>
          </div>
          <span
            className={`pill ${disclosureSectionState === "list" ? "info" : disclosureSectionState === "empty" ? "neutral" : "warning"}`}
          >
            {aggregateContext?.recent_disclosures.count ?? 0} {copy.disclosures.items}
          </span>
        </div>

        {disclosureSectionState === "list" ? (
          <div className={styles.disclosureList}>
            {aggregateContext?.recent_disclosures.items.slice(0, disclosureItemLimit).map((item) => (
              <Link
                key={item.rcept_no}
                className={styles.disclosureCard}
                href={buildDisclosureReportHref(symbol, item, routeQueryString)}
                aria-label={`${copy.disclosures.openReportPrefix} ${item.report_nm}`}
              >
                <div className={styles.disclosureHeader}>
                  <strong className="clamp-3">{item.report_nm}</strong>
                  <span className="pill neutral">{item.receipt_date ?? copy.disclosures.noReceiptDate}</span>
                </div>
                <p className="clamp-3">
                  {humanizeToken(item.filing_category, copy.disclosures.noCategory)} · {copy.disclosures.capture}{" "}
                  {humanizeToken(item.fundamentals_capture_status, copy.disclosures.notCaptured)}
                </p>
                <div className={styles.disclosureMeta}>
                  <span>{copy.disclosures.receipt} {item.receipt_date ?? copy.disclosures.noReceiptDate}</span>
                  <span>{copy.disclosures.receiptNo} {item.rcept_no}</span>
                </div>
                <span className={styles.disclosureAction}>{copy.disclosures.viewReportDetail}</span>
              </Link>
            ))}
          </div>
        ) : disclosureSectionState === "loading" ? (
          <div className={styles.emptyPanel}>
            <strong>{copy.disclosures.loadingTitle}</strong>
            <p className="clamp-3">{copy.disclosures.loadingBody}</p>
          </div>
        ) : disclosureSectionState === "empty" ? (
          <div className={styles.emptyPanel}>
            <strong>{copy.disclosures.emptyTitle}</strong>
            <p className="clamp-3">{copy.disclosures.emptyBody}</p>
          </div>
        ) : (
          <div className={styles.emptyPanel}>
            <strong>{copy.disclosures.unavailableTitle}</strong>
            <p className="clamp-3">{copy.disclosures.unavailableBody}</p>
          </div>
        )}

        <div className={styles.coverageNote}>
          <strong>{latestDisclosure ? copy.disclosures.latestDisclosureAvailable : copy.disclosures.partialAnalystCoverage}</strong>
          <p className="clamp-3">
            {buildDisclosureCoverageNote(latestDisclosure, aggregateContext?.recent_disclosures.count ?? 0, copy)}
          </p>
        </div>
      </UnitRefreshFrame>
    </section>
  );
}

export function SystemFreshnessSection({
  copy,
  fsDiv,
  marketDate,
  normalizedSymbol,
  onOpenDetail,
  quote,
  showOverview,
  symbolReady,
}: Pick<SymbolDetailUnitProps, "copy" | "fsDiv" | "marketDate" | "normalizedSymbol" | "symbolReady"> & {
  onOpenDetail?: () => void;
  quote: QuoteResponse | null;
  showOverview: boolean;
}) {
  const { aggregateContext, aggregateContextLoadState, aggregateContextRefreshing, aggregateResponse } =
    useSymbolAggregateContextData({
      copy,
      fsDiv,
      marketDate,
      normalizedSymbol,
      symbolReady,
    });
  const freshnessRequest = useMemo(
    () => ({
      enabled: true,
      key: ["symbol-detail", "freshness"] as const,
      ttlMs: 30_000,
      fetcher: async () => fetchUnitJson<EodFreshnessResponseDto>("/api/trading/eod/freshness"),
    }),
    [],
  );
  const freshnessResult = useUnitData<EodFreshnessResponseDto>(freshnessRequest);
  const freshness = freshnessResult.data;
  const refetchFreshness = freshnessResult.refetch;

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refetchFreshness();
    }, 30_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [refetchFreshness]);

  const technicalSnapshot = aggregateContext?.technical_snapshot ?? null;
  const actionSummary = aggregateContext?.action_summary ?? null;
  const latestFundamentals = aggregateContext?.fundamentals.latest_snapshot ?? null;
  const hasFundamentalsHistory = (aggregateContext?.fundamentals.history_summary.entries ?? 0) > 0;
  const latestDisclosure = buildLatestDisclosure(aggregateContext?.recent_disclosures.items ?? []);
  const technicalFreshnessDate = buildTechnicalFreshnessDate(technicalSnapshot, freshness);
  const actionFreshnessDate = buildActionFreshnessDate(actionSummary, freshness);
  const fundamentalsDate = buildFundamentalsDate(null, latestFundamentals, aggregateContext);
  const freshnessTone = buildFreshnessTone(freshness?.today?.eod_status);
  const disclosureSectionState = getDisclosureSectionState(
    aggregateContextLoadState,
    aggregateContext !== null,
    aggregateContext?.recent_disclosures.count ?? 0,
  );
  const moduleRows = [
    {
      id: "price",
      label: copy.freshness.priceModule,
      date: buildLatestPriceLabel(freshness, quote, copy),
      detail: quote?.available
        ? buildQuoteSourceLabel(quote, copy)
        : quote?.unavailable_reason ?? copy.freshness.quoteCoverageUnavailable,
      tone: buildModuleStatusTone(Boolean(quote?.available)),
      status: quote?.available
        ? quote.is_live
          ? copy.freshness.live
          : copy.freshness.fallback
        : copy.freshness.unavailable,
      api: "/api/trading/quotes/{symbol}",
    },
    {
      id: "technical",
      label: copy.freshness.technicalModule,
      date: technicalFreshnessDate ?? copy.freshness.noTechnicalDate,
      detail: technicalSnapshot
        ? `${humanizeToken(technicalSnapshot.trend_state)} · ${copy.technical.maAlignment} ${humanizeToken(technicalSnapshot.ma_alignment)}`
        : copy.freshness.technicalUnavailable,
      tone: technicalSnapshot || freshness?.technical?.success ? buildTechnicalTone(technicalSnapshot) : "warning",
      status:
        technicalSnapshot || freshness?.technical?.success ? copy.freshness.synced : copy.freshness.pending,
      api: "/api/trading/eod/technical-snapshots",
    },
    {
      id: "action",
      label: copy.freshness.actionModule,
      date: actionFreshnessDate ?? copy.freshness.noActionDate,
      detail: actionSummary
        ? `${humanizeToken(actionSummary.action_label)} · ${copy.action.risk} ${humanizeToken(actionSummary.risk_tier)}`
        : copy.freshness.actionUnavailable,
      tone: actionSummary ? buildActionTone(actionSummary) : "warning",
      status: actionSummary ? copy.freshness.resolved : copy.freshness.pending,
      api: "/api/trading/eod/action-summaries",
    },
    {
      id: "fundamentals",
      label: copy.freshness.fundamentalsModule,
      date: fundamentalsDate ?? copy.fundamentals.noReceiptDate,
      detail: buildFundamentalsCoverageNote(null, latestFundamentals, copy),
      tone: hasFundamentalsHistory || latestFundamentals ? "info" : "warning",
      status: hasFundamentalsHistory
        ? copy.freshness.historyLoaded
        : latestFundamentals
          ? copy.freshness.aggregateOnly
          : copy.freshness.noHistory,
      api: "/api/trading/disclosures/dart/fundamentals/history",
    },
    {
      id: "disclosures",
      label: copy.freshness.disclosuresModule,
      date:
        latestDisclosure?.receipt_date ??
        (disclosureSectionState === "loading"
          ? copy.common.loading
          : disclosureSectionState === "empty"
            ? copy.freshness.noDisclosures
            : copy.freshness.unavailable),
      detail: buildDisclosureCoverageNote(latestDisclosure, aggregateContext?.recent_disclosures.count ?? 0, copy),
      tone:
        disclosureSectionState === "list"
          ? "info"
          : disclosureSectionState === "empty"
            ? "neutral"
            : "warning",
      status:
        disclosureSectionState === "list"
          ? copy.freshness.coverage
          : disclosureSectionState === "empty"
            ? copy.freshness.empty
            : disclosureSectionState === "loading"
              ? copy.freshness.loading
              : copy.freshness.unavailable,
      api: "/api/trading/agent-context/symbol-day",
    },
  ] as const;
  const freshnessSectionRefreshing =
    (freshness !== null && freshnessResult.isRefreshing) ||
    (aggregateResponse !== null && aggregateContextRefreshing);
  const freshnessSectionBusy =
    freshnessSectionRefreshing ||
    (!freshness &&
      (freshnessResult.isInitialLoading || aggregateContextLoadState === "loading" || (!marketDate && symbolReady)));

  return (
    <section
      className={`${styles.panel} ${styles.freshnessCard}`}
      id="freshness"
      aria-busy={freshnessSectionBusy || undefined}
      data-refreshing={freshnessSectionRefreshing ? "true" : "false"}
    >
      <UnitRefreshFrame busy={freshnessSectionRefreshing} label={copy.common.refreshing}>
        <ComponentTag
          label="symbol.system-freshness"
          api="/api/trading/eod/freshness + /api/trading/quotes/{symbol}"
        />

        <div className={styles.cardHeader}>
          <div>
            <p className={styles.sectionEyebrow}>{copy.freshness.eyebrow}</p>
            <h2 className={styles.cardTitle}>{copy.freshness.title}</h2>
          </div>
          <span className={`pill ${freshnessTone}`}>
            {humanizeToken(freshness?.today?.eod_status, copy.freshness.statusPending)}
          </span>
        </div>
        {showOverview && onOpenDetail ? (
          <button
            type="button"
            className={styles.detailLink}
            onClick={onOpenDetail}
          >
            {copy.freshness.openDetail}
          </button>
        ) : null}

        <div className={styles.metricGrid}>
          <article className={styles.metricCard}>
            <span>{copy.freshness.eodTradeDate}</span>
            <strong>{freshness?.today?.trade_date ?? marketDate ?? copy.common.datePending}</strong>
          </article>
          <article className={styles.metricCard}>
            <span>{copy.freshness.priceLatest}</span>
            <strong>
              {freshness?.latest?.price_trade_date ??
                quote?.trade_date ??
                formatDisplayTimestamp(quote?.cached_at, copy.hero.quotePending)}
            </strong>
          </article>
          <article className={styles.metricCard}>
            <span>{copy.freshness.technicalLatest}</span>
            <strong>{technicalFreshnessDate ?? copy.freshness.noTechnicalDate}</strong>
          </article>
          <article className={styles.metricCard}>
            <span>{copy.freshness.actionLatest}</span>
            <strong>{actionFreshnessDate ?? copy.freshness.noActionDate}</strong>
          </article>
        </div>

        <div className={styles.moduleRows}>
          {moduleRows.map((row) => (
            <article key={row.id} className={styles.moduleRow}>
              <div>
                <strong>{row.label}</strong>
                <p className="clamp-3">{row.detail}</p>
                <span className={styles.moduleApi}>{row.api}</span>
              </div>
              <div className={styles.moduleAside}>
                <span>{row.date}</span>
                <span className={`pill ${row.tone}`}>{row.status}</span>
              </div>
            </article>
          ))}
        </div>
      </UnitRefreshFrame>
    </section>
  );
}
