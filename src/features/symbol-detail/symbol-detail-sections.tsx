"use client";

import Link from "next/link";
import { memo, useEffect, useMemo } from "react";

import { useAppState } from "@/components/providers/app-state-provider";
import { ComponentTag } from "@/components/dev/component-tag";
import { UnitRefreshFrame } from "@/components/ui/unit-refresh-frame";
import type { AggregateContextLoadState } from "@/app/dashboard/symbol/[symbol]/symbol-detail-state";
import { getDisclosureSectionState } from "@/app/dashboard/symbol/[symbol]/symbol-detail-state";
import type { SymbolDetailCopy } from "@/i18n/symbol-detail-copy";
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
  buildDisclosureCoverageSectionModel,
  buildFundamentalsHistoryQuery,
  buildFundamentalsHistorySectionModel,
  buildHeroFundamentalLatestMetricModel,
  buildHeroPiotroskiMetricModel,
  buildLatestDisclosure,
  buildNormalizedActionSummaryState,
  buildSystemFreshnessSectionModel,
  buildTechnicalAnalysisSectionModel,
  buildTechnicalFreshnessDate,
  pickFundamentalsCompany,
  selectExactActionSummary,
} from "./symbol-detail-derived-state";
import type { QuoteResponse } from "./symbol-detail-types";
import { findExactSymbolItem } from "./use-symbol-detail-data";

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
    aggregateResponse ? findExactSymbolItem(aggregateResponse.items, normalizedSymbol) : null;
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

export const HeroFundamentalLatestMetric = memo(function HeroFundamentalLatestMetric({
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
  const metricModel = buildHeroFundamentalLatestMetricModel({
    aggregateContext,
    aggregateContextError,
    aggregateContextLoadState,
    copy,
    latestDisclosure,
    latestFundamentals,
  });

  return (
    <article className={styles.heroMetricCard} aria-busy={aggregateContextRefreshing || undefined}>
      <span>{copy.hero.fundamentalLatest}</span>
      <strong className="clamp-3">{metricModel.value}</strong>
      {metricModel.detailDateLabel ? <p className="clamp-3">{metricModel.detailDateLabel}</p> : null}
      {!metricModel.detailDateLabel && metricModel.errorLabel ? <p className="clamp-3">{metricModel.errorLabel}</p> : null}
    </article>
  );
});

export const HeroPiotroskiMetric = memo(function HeroPiotroskiMetric({
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
  const piotroskiLoadState: AggregateContextLoadState =
    !symbolReady || !marketDate
      ? "loading"
      : piotroskiResponseResult.data
        ? "success"
        : piotroskiResponseResult.error
          ? "error"
          : "loading";
  const metricModel = buildHeroPiotroskiMetricModel({
    copy,
    piotroskiLoadState,
    piotroskiResponse: piotroskiResponseResult.data,
    requestedMarketDate: marketDate,
    requestedSymbol: normalizedSymbol,
  });
  const piotroskiValueClassName =
    metricModel.tone === "positive" ? styles.positive : metricModel.tone === "negative" ? styles.negative : undefined;

  return (
    <article
      className={styles.heroMetricCard}
      aria-busy={
        (piotroskiResponseResult.isRefreshing ||
          (!piotroskiResponseResult.data?.item && piotroskiLoadState === "loading")) ||
        undefined
      }
    >
      <span>{copy.hero.piotroskiFilter}</span>
      <strong className={piotroskiValueClassName}>{metricModel.label}</strong>
    </article>
  );
});

function useNormalizedActionSummaryState(
  {
    copy,
    fsDiv,
    marketDate,
    normalizedSymbol,
    symbolReady,
  }: Pick<SymbolDetailUnitProps, "copy" | "fsDiv" | "marketDate" | "normalizedSymbol" | "symbolReady">,
  options?: { includePayloadMeta?: boolean },
) {
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

        return findExactSymbolItem(data.items, normalizedSymbol);
      },
    }),
    [marketDate, normalizedSymbol, symbolReady],
  );
  const actionSummaryResult = useUnitData<AgentContextActionSummaryDto | null>(actionSummaryRequest);
  const resolvedActionSummary =
    selectExactActionSummary(actionSummaryResult.data, normalizedSymbol, marketDate) ??
    selectExactActionSummary(aggregateContext?.action_summary, normalizedSymbol, marketDate);
  const actionSummaryRefreshing =
    (actionSummaryResult.hasData || aggregateContext !== null) &&
    (actionSummaryResult.isRefreshing || aggregateContextRefreshing);
  const actionSummaryPending =
    !resolvedActionSummary &&
    (aggregateContextLoadState === "loading" || actionSummaryResult.isInitialLoading || (!marketDate && symbolReady));

  return {
    busy: actionSummaryRefreshing || actionSummaryPending,
    hasValidatedActionSummary: resolvedActionSummary !== null,
    normalizedState: buildNormalizedActionSummaryState(resolvedActionSummary, actionSummaryPending, copy, options),
    refreshing: actionSummaryRefreshing,
  };
}

export const HeroActionRecommendationMetric = memo(function HeroActionRecommendationMetric({
  decisionContextLabel,
  copy,
  fsDiv,
  marketDate,
  normalizedSymbol,
  symbolReady,
}: Pick<SymbolDetailUnitProps, "copy" | "fsDiv" | "marketDate" | "normalizedSymbol" | "symbolReady"> & {
  decisionContextLabel?: string | null;
}) {
  const { busy, hasValidatedActionSummary, normalizedState } = useNormalizedActionSummaryState({
    copy,
    fsDiv,
    marketDate,
    normalizedSymbol,
    symbolReady,
  });
  const recommendation =
    normalizedState.kind === "pending"
      ? copy.hero.comingSoon
      : normalizedState.kind === "unavailable"
        ? normalizedState.sectionModel.badgeLabel
        : normalizedState.sectionModel.headline;

  return (
    <article
      className={styles.heroMetricCard}
      aria-busy={busy || undefined}
      data-action-state={normalizedState.kind}
    >
      <span>{copy.hero.recommendation}</span>
      <strong className="clamp-3">{recommendation}</strong>
      {decisionContextLabel && hasValidatedActionSummary ? (
        <p className={styles.heroMetricContext}>{decisionContextLabel}</p>
      ) : null}
    </article>
  );
});

export const ActionSummarySection = memo(function ActionSummarySection({
  copy,
  dashboardRecommendationEvidenceHref,
  decisionContextLabel,
  fsDiv,
  marketDate,
  normalizedSymbol,
  symbolReady,
}: Pick<SymbolDetailUnitProps, "copy" | "fsDiv" | "marketDate" | "normalizedSymbol" | "symbolReady"> & {
  dashboardRecommendationEvidenceHref?: string | null;
  decisionContextLabel?: string | null;
}) {
  const { devMode } = useAppState();
  const { busy, hasValidatedActionSummary, normalizedState, refreshing } = useNormalizedActionSummaryState(
    {
      copy,
      fsDiv,
      marketDate,
      normalizedSymbol,
      symbolReady,
    },
    { includePayloadMeta: devMode },
  );
  const resolvedActionSectionModel = normalizedState.sectionModel;
  const actionSectionBadgeLabel =
    normalizedState.kind === "pending" ? copy.hero.comingSoon : resolvedActionSectionModel.badgeLabel;
  const shouldShowDashboardEvidenceFallback =
    Boolean(dashboardRecommendationEvidenceHref) &&
    (normalizedState.kind === "unavailable" || normalizedState.kind === "insufficient-history");
  const signalTrackProps = {
    "aria-label": resolvedActionSectionModel.meter.ariaLabel,
    "aria-valuemax": 100,
    "aria-valuemin": 0,
    "aria-valuenow": resolvedActionSectionModel.score,
    "aria-valuetext": resolvedActionSectionModel.meter.valueLabel,
    role: "meter" as const,
  };

  return (
    <section
      className={`${styles.panel} ${styles.insightCard}`}
      id="action"
      aria-busy={busy || undefined}
      data-action-state={normalizedState.kind}
      data-refreshing={refreshing ? "true" : "false"}
    >
      <UnitRefreshFrame busy={refreshing} label={copy.common.refreshing}>
        <ComponentTag
          label="symbol.action-summary"
          api="/api/trading/eod/action-summaries + /api/trading/agent-context/symbol-day"
        />

        <div className={styles.cardHeader}>
          <div>
            <p className={styles.sectionEyebrow}>{copy.action.eyebrow}</p>
            <h2 className={styles.cardTitle}>{copy.action.title}</h2>
          </div>
          <span className={`pill ${resolvedActionSectionModel.tone}`}>{actionSectionBadgeLabel}</span>
        </div>

        {decisionContextLabel && hasValidatedActionSummary ? (
          <p className={styles.decisionContextLabel}>{decisionContextLabel}</p>
        ) : null}

        <div className={styles.signalMeter}>
          <div className={styles.signalMeterHeader}>
            <span>{resolvedActionSectionModel.meter.label}</span>
            <strong>{resolvedActionSectionModel.meter.valueLabel}</strong>
          </div>
          {resolvedActionSectionModel.meter.state === "resolved" ? (
            <>
              <div className={styles.signalTrack} data-state={resolvedActionSectionModel.meter.state} {...signalTrackProps}>
                <div className={styles.signalFill} style={{ width: `${resolvedActionSectionModel.score}%` }} />
              </div>
              <p className={styles.signalCurrent}>{resolvedActionSectionModel.meter.currentLabel}</p>
            </>
          ) : (
            <p className={styles.signalUnavailable} role="status" aria-label={resolvedActionSectionModel.meter.ariaLabel}>
              {resolvedActionSectionModel.meter.currentLabel}
            </p>
          )}
        </div>

        <strong className={`clamp-3 ${styles.insightHeadline}`}>{resolvedActionSectionModel.headline}</strong>
        <p className={`clamp-3 ${styles.supportingCopy}`}>{resolvedActionSectionModel.body}</p>

        <div className={styles.metricGrid}>
          {resolvedActionSectionModel.metrics.map((metric) => (
            <article key={metric.key} className={styles.metricCard}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>

        <div className={styles.tagGroup}>
          {resolvedActionSectionModel.reasonTags.map((reason) => (
            <span key={reason} className={styles.tagChip}>
              {reason}
            </span>
          ))}
        </div>

        {resolvedActionSectionModel.metaCaption ? <p className={styles.metaCaption}>{resolvedActionSectionModel.metaCaption}</p> : null}

        {shouldShowDashboardEvidenceFallback && dashboardRecommendationEvidenceHref ? (
          <Link
            href={dashboardRecommendationEvidenceHref}
            className={`${styles.detailLink} ${styles.dashboardEvidenceFallback}`}
          >
            {copy.dashboardRecommendation.actionRationaleUnavailableEvidence}
          </Link>
        ) : null}
      </UnitRefreshFrame>
    </section>
  );
});

export const TechnicalAnalysisSection = memo(function TechnicalAnalysisSection({
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

        return findExactSymbolItem(data.items, normalizedSymbol);
      },
    }),
    [marketDate, normalizedSymbol, symbolReady],
  );
  const technicalSnapshotResult = useUnitData<AgentContextTechnicalSnapshotDto | null>(technicalSnapshotRequest);
  const resolvedTechnicalSnapshot = technicalSnapshotResult.data ?? aggregateContext?.technical_snapshot ?? null;
  const technicalFreshnessDate = buildTechnicalFreshnessDate(resolvedTechnicalSnapshot, null);
  const technicalSectionModel = buildTechnicalAnalysisSectionModel(
    resolvedTechnicalSnapshot,
    technicalFreshnessDate,
    copy,
  );
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
          <span className={`pill ${technicalSectionModel.tone}`}>{technicalSectionModel.badgeLabel}</span>
        </div>

        <strong className={`clamp-3 ${styles.insightHeadline}`}>{technicalSectionModel.headline}</strong>
        <p className={`clamp-3 ${styles.supportingCopy}`}>{technicalSectionModel.body}</p>

        <div className={styles.metricGrid}>
          {technicalSectionModel.metrics.map((metric) => (
            <article key={metric.key} className={styles.metricCard}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>

        <div className={styles.tagGroup}>
          {technicalSectionModel.payloadTags.map((tag) => (
            <span key={tag} className={styles.tagChip}>
              {tag}
            </span>
          ))}
        </div>

        <p className={styles.metaCaption}>{technicalSectionModel.metaCaption}</p>
      </UnitRefreshFrame>
    </section>
  );
});

export const FundamentalsHistorySection = memo(function FundamentalsHistorySection({
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
  const fundamentalsSectionModel = buildFundamentalsHistorySectionModel({
    companyHistory,
    copy,
    fundamentalsEntryLimit,
    fundamentalsLoading,
    fsDiv,
    introTitle,
    latestFundamentals,
    latestHistoryEntry,
    symbol,
  });

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
          <span className={`pill ${fundamentalsSectionModel.fsTone}`}>{fundamentalsSectionModel.fsValue}</span>
        </div>

        <div className={styles.companyStrip}>
          <div className={styles.companyAvatar}>{fundamentalsSectionModel.introInitial}</div>
          <div>
            <strong>{fundamentalsSectionModel.introTitle}</strong>
            <p className="clamp-3">{fundamentalsSectionModel.introBody}</p>
          </div>
        </div>

        <div className={styles.metricGrid}>
          {fundamentalsSectionModel.highlights.map((metric) => (
            <article key={metric.key} className={styles.metricCard}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>

        <div className={styles.historyList}>
          {fundamentalsSectionModel.state === "list" ? (
            fundamentalsSectionModel.entries.map((entry) => (
              <article key={entry.key} className={styles.historyCard}>
                <div className={styles.historyHeader}>
                  <div>
                    <strong className="clamp-3">{entry.title}</strong>
                    <p className="clamp-3">{entry.subtitle}</p>
                  </div>
                  <span className="pill neutral">{entry.badgeLabel}</span>
                </div>
                <div className={styles.historyMetrics}>
                  {entry.metrics.map((metric) => (
                    <div key={metric.key} className={styles.historyMetricRow}>
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </div>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <div className={styles.emptyPanel}>
              <strong>{fundamentalsSectionModel.emptyTitle}</strong>
              <p className="clamp-3">{fundamentalsSectionModel.emptyBody}</p>
            </div>
          )}
        </div>
      </UnitRefreshFrame>
    </section>
  );
});

export const DisclosureCoverageSection = memo(function DisclosureCoverageSection({
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
  const disclosureSectionModel = buildDisclosureCoverageSectionModel({
    copy,
    disclosureCount: aggregateContext?.recent_disclosures.count ?? 0,
    disclosureItemLimit,
    latestDisclosure,
    recentDisclosures: aggregateContext?.recent_disclosures.items ?? [],
    routeQueryString,
    sectionState: disclosureSectionState,
    symbol,
  });
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
          <span className={`pill ${disclosureSectionModel.badgeTone}`}>{disclosureSectionModel.badgeValue}</span>
        </div>

        {disclosureSectionModel.state === "list" ? (
          <div className={styles.disclosureList}>
            {disclosureSectionModel.cards.map((item) => (
              <Link
                key={item.key}
                className={styles.disclosureCard}
                href={item.href}
                aria-label={item.ariaLabel}
              >
                <div className={styles.disclosureHeader}>
                  <strong className="clamp-3">{item.title}</strong>
                  <span className="pill neutral">{item.dateLabel}</span>
                </div>
                <p className="clamp-3">{item.body}</p>
                <div className={styles.disclosureMeta}>
                  <span>{item.receiptLabel}</span>
                  <span>{item.receiptNoLabel}</span>
                </div>
                <span className={styles.disclosureAction}>{item.actionLabel}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className={styles.emptyPanel}>
            <strong>{disclosureSectionModel.emptyTitle}</strong>
            <p className="clamp-3">{disclosureSectionModel.emptyBody}</p>
          </div>
        )}

        <div className={styles.coverageNote}>
          <strong>{disclosureSectionModel.coverageTitle}</strong>
          <p className="clamp-3">{disclosureSectionModel.coverageBody}</p>
        </div>
      </UnitRefreshFrame>
    </section>
  );
});

export const SystemFreshnessSection = memo(function SystemFreshnessSection({
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
  const hasFundamentalsHistory = (aggregateContext?.fundamentals.history_summary?.entries ?? 0) > 0;
  const latestDisclosure = buildLatestDisclosure(aggregateContext?.recent_disclosures.items ?? []);
  const disclosureSectionState = getDisclosureSectionState(
    aggregateContextLoadState,
    aggregateContext !== null,
    aggregateContext?.recent_disclosures.count ?? 0,
  );
  const freshnessSectionModel = buildSystemFreshnessSectionModel({
    actionSummary,
    aggregateContext,
    copy,
    disclosureSectionState,
    freshness,
    hasFundamentalsHistory,
    latestDisclosure,
    latestFundamentals,
    marketDate,
    quote,
    technicalSnapshot,
  });
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
          <span className={`pill ${freshnessSectionModel.tone}`}>{freshnessSectionModel.statusLabel}</span>
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
          {freshnessSectionModel.metrics.map((metric) => (
            <article key={metric.key} className={styles.metricCard}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>

        <div className={styles.moduleRows}>
          {freshnessSectionModel.moduleRows.map((row) => (
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
});
