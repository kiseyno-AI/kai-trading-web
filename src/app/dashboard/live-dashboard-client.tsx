"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ComponentTag } from "@/components/dev/component-tag";
import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { useAppState } from "@/components/providers/app-state-provider";
import { getDashboardLiveCopy, type DashboardLiveCopy } from "@/i18n/dashboard-live-copy";
import { getAgentFeedbackProgressMarketDate } from "@/lib/agent-feedback-progress";
import {
  getLatestActionMarketDate,
  getLatestEodTradeDate,
  getLatestPriceTradeDate,
  getLatestTechnicalMarketDate,
} from "@/lib/eod-freshness-latest";
import { formatDisplayTimestamp } from "@/lib/format";
import { buildPiotroskiListHref } from "@/lib/piotroski-pass-list";
import {
  getFundamentalsRunDate,
  getLatestAvailableFundamentalsCoverage,
  getLatestAvailableFundamentalsDate,
  getLatestFundamentalsRun,
  shouldUseTodayFundamentalsStageData,
  shouldUseTodayStageData,
} from "@/lib/dashboard-eod-stage-data";
import { getNumberLocale } from "@/lib/locale";
import {
  UNKNOWN_LABEL,
  buildAgentRoleCards,
  buildEodStageCard,
  buildPiotroskiFilteringCardModel,
  buildTrackedSymbolCardModels,
  formatEodSymbolCount,
  getAgentProgressStatusLabel,
  getAgentProgressStatusLabels,
  getAgentRoleStatusLabels,
  getDashboardLoadErrorMessage,
  getFirstTextValue,
  getFundamentalsCheckedCount,
  getFundamentalsFailureDetails,
  getFundamentalsFreshnessLayer,
  getFundamentalsStatusLabel,
  getFundamentalsStageStatusLabel,
  getFundamentalsUpdatedSymbolsDetail,
  getPipelineStage,
  getPriceFreshnessStage,
  getResolvedAgentProgressRunStatus,
  getStageStatusLabel,
  getTechnicalFreshnessStage,
  getActionFreshnessStage,
  getFundamentalsFreshnessStage,
  hasCompletedDefaultAgentRoles,
  isAgentFeedbackProgressRunning,
  isBreakDayMarket,
  isIconOnlyEodStageStatus,
  isOfflineTrackedPlaceholder,
  isSummarizerRole,
  markAgentFeedbackProgressStopped,
  mergeRunningPipelineStage,
  shouldTreatAgentFeedbackStopDisconnectAsAccepted,
} from "@/features/dashboard/live-dashboard-derived-state";
import type {
  AgentRoleCard,
  AgentRoleStatus,
  EodStageCard,
  FundamentalsFailureDetails,
  LiveDashboardClientProps,
  PiotroskiFilteringCardModel,
  TrackedSymbolCardModel,
} from "@/features/dashboard/live-dashboard-types";
import { useLiveDashboardData } from "@/features/dashboard/use-live-dashboard-data";
import type {
  AgentContextCoreControlRequestDto,
  AgentContextCoreControlResponseDto,
} from "@/types/trading-api";

import styles from "./live-dashboard-client.module.css";

const AGENT_FEEDBACK_STOP_DIALOG_ID = "agent-feedback-stop-dialog";
const AGENT_FEEDBACK_STOP_ERROR_ID = "agent-feedback-stop-error";
const AGENT_FEEDBACK_STOP_CONTROL_CLIENT_PATH = "/api/trading/agent-context/internal/core/control";
const AGENT_FEEDBACK_STOP_REQUEST = {
  action: "kill",
  signal_name: "SIGKILL",
  port: 8000,
} satisfies AgentContextCoreControlRequestDto;

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const responseText = await response.text();
  let parsedBody: unknown = null;

  if (responseText) {
    try {
      parsedBody = JSON.parse(responseText) as T;
    } catch (error) {
      throw new Error(`Failed to parse JSON for ${path}: ${getDashboardLoadErrorMessage(error)}`);
    }
  }

  if (!response.ok) {
    if (
      parsedBody &&
      typeof parsedBody === "object" &&
      "message" in parsedBody &&
      typeof parsedBody.message === "string"
    ) {
      throw new Error(parsedBody.message);
    }

    if (
      parsedBody &&
      typeof parsedBody === "object" &&
      "detail" in parsedBody &&
      typeof parsedBody.detail === "string"
    ) {
      throw new Error(parsedBody.detail);
    }

    throw new Error(`HTTP ${response.status} for ${path}`);
  }

  return parsedBody as T;
}

function getExceptionDateLabel(date: string | null | undefined, primaryLatestCycleDate: string | null | undefined) {
  const normalizedDate = getFirstTextValue(date);
  if (!normalizedDate) return null;

  const normalizedPrimaryLatestCycleDate = getFirstTextValue(primaryLatestCycleDate);
  if (normalizedPrimaryLatestCycleDate && normalizedDate === normalizedPrimaryLatestCycleDate) {
    return null;
  }

  return normalizedDate;
}

type AgentRoleStatusLabels = Record<AgentRoleStatus, string>;

type EodStatusCardProps = {
  copy: DashboardLiveCopy;
  eodStageCards: readonly EodStageCard[];
  fundamentalsDialogOpen: boolean;
  fundamentalsFailureDetails: FundamentalsFailureDetails | null;
  onOpenFundamentalsDetails: () => void;
};

const EodStatusCard = memo(function EodStatusCard({
  copy,
  eodStageCards,
  fundamentalsDialogOpen,
  fundamentalsFailureDetails,
  onOpenFundamentalsDetails,
}: EodStatusCardProps) {
  return (
    <article className={`${styles.integrityStat} ${styles.eodStatusCard}`}>
      <div className={styles.sectionHeaderRow}>
        <div>
          <p className={styles.sectionEyebrow}>{copy.operational.eodEyebrow}</p>
          <h2 className={styles.sectionTitle}>{copy.operational.eodTitle}</h2>
        </div>
      </div>

      <div className={styles.eodStageGrid}>
        {eodStageCards.map((stage) => {
          const isIconOnlyStatus = isIconOnlyEodStageStatus(stage.statusLabel);
          const isStandaloneStatusIcon = stage.statusLabel === "synced" || stage.statusLabel === "not synced";
          const statusClass = stage.statusLabel === "running" ? styles.runningStatusPill : "";
          const localizedStatusLabel = getStageStatusLabel(stage.statusLabel, copy);
          const displayedStatusLabel =
            stage.statusLabel === "running" && stage.statusBadgeLabel !== stage.statusLabel
              ? stage.statusBadgeLabel
              : localizedStatusLabel;
          const statusAriaLabel =
            stage.statusLabel === "running" && stage.statusBadgeLabel !== stage.statusLabel
              ? `${localizedStatusLabel} · ${stage.statusBadgeLabel}`
              : localizedStatusLabel;
          const statusTitle = stage.statusBadgeTitle ?? (isIconOnlyStatus ? statusAriaLabel : undefined);
          const standaloneStatusClass =
            stage.statusLabel === "not synced" ? styles.notSyncedStatusIcon : styles.syncedStatusIcon;

          return (
            <div
              key={stage.id}
              className={styles.eodStageCard}
              aria-label={`${stage.label} freshness`}
              data-stage={stage.id}
              data-status={stage.statusLabel}
            >
              <div className={styles.eodStageTop}>
                <span className={styles.eodStageTitle}>{stage.label}</span>
                {isStandaloneStatusIcon ? (
                  <span
                    className={`${styles.statusIconBadge} ${standaloneStatusClass}`}
                    title={statusTitle}
                    data-status-badge={stage.statusLabel}
                    role="img"
                    aria-label={statusAriaLabel}
                  />
                ) : (
                  <span
                    className={`pill ${stage.tone} ${statusClass} ${isIconOnlyStatus ? styles.iconStatusPill : ""}`}
                    title={statusTitle}
                    data-status-badge={stage.statusLabel}
                    role={isIconOnlyStatus ? "img" : undefined}
                    aria-label={isIconOnlyStatus ? statusAriaLabel : undefined}
                  >
                    {isIconOnlyStatus ? (
                      <span className={styles.statusPillIcon} aria-hidden="true" />
                    ) : (
                      <span className={styles.statusPillLabel}>{displayedStatusLabel}</span>
                    )}
                  </span>
                )}
              </div>
              <div className={styles.eodStageDetails}>
                {stage.details.map((detail) => (
                  <span
                    key={detail.key}
                    className={styles.eodStageDetailLine}
                    data-detail-tone={detail.tone ?? "text"}
                    data-detail-layout={detail.layout ?? "inline"}
                  >
                    {detail.label ? <span>{detail.label}</span> : null}
                    {detail.label ? " " : null}
                    <span className={styles.eodStageDetailValue}>{detail.value}</span>
                  </span>
                ))}
                {stage.id === "fundamentals" && fundamentalsFailureDetails ? (
                  <button
                    type="button"
                    className={styles.detailButton}
                    aria-label={copy.operational.viewFundamentalsRunDetails}
                    aria-haspopup="dialog"
                    aria-expanded={fundamentalsDialogOpen}
                    aria-controls="fundamentals-failure-dialog"
                    onClick={onOpenFundamentalsDetails}
                  >
                    {copy.operational.viewDetail}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
});

type PiotroskiFilteringCardProps = {
  copy: DashboardLiveCopy;
  filteringCardModel: PiotroskiFilteringCardModel;
  marketDateContext: string | null;
};

const PiotroskiFilteringCard = memo(function PiotroskiFilteringCard({
  copy,
  filteringCardModel,
  marketDateContext,
}: PiotroskiFilteringCardProps) {
  return (
    <article className={`${styles.integrityStat} ${styles.filteringCard}`}>
      <div className={styles.sectionHeaderRow}>
        <div>
          <p className={styles.sectionEyebrow}>{copy.operational.piotroskiEyebrow}</p>
          <h2 className={styles.sectionTitle}>{copy.operational.piotroskiTitle}</h2>
          {marketDateContext ? (
            <p className={styles.cardContext}>{copy.operational.marketDate} {marketDateContext}</p>
          ) : null}
        </div>
        <Link
          href={buildPiotroskiListHref(filteringCardModel.displayMarketDate)}
          className={styles.sectionLink}
          aria-label={copy.operational.openPiotroskiList}
        >
          {copy.operational.more}
        </Link>
      </div>

      <div className={styles.statusMetricGrid}>
        <div className={styles.statusMetric}>
          <span>{copy.operational.status}</span>
          <strong>
            <span className={`pill ${filteringCardModel.statusTone}`}>{filteringCardModel.statusLabel}</span>
          </strong>
        </div>
        <div className={styles.statusMetric}>
          <span>{copy.operational.checked}</span>
          <strong>{filteringCardModel.checkedCountLabel}</strong>
        </div>
        <div className={styles.statusMetric}>
          <span>{copy.operational.pass}</span>
          <strong>{filteringCardModel.passCountLabel}</strong>
        </div>
      </div>

      {filteringCardModel.note ? <p className={styles.cardContext}>{filteringCardModel.note}</p> : null}
    </article>
  );
});

type AgentFeedbackCardProps = {
  agentFeedbackHeaderStatusLabel: string;
  agentFeedbackStatusTone: "positive" | "neutral" | "warning";
  agentFeedbackStopDialogOpen: boolean;
  agentProgressDateContext: string | null;
  agentRoleCards: AgentRoleCard[];
  agentRoleStatusLabels: AgentRoleStatusLabels;
  copy: DashboardLiveCopy;
  isAgentFeedbackRunning: boolean;
  onOpenAgentFeedbackStopDialog: () => void;
};

const AgentFeedbackCard = memo(function AgentFeedbackCard({
  agentFeedbackHeaderStatusLabel,
  agentFeedbackStatusTone,
  agentFeedbackStopDialogOpen,
  agentProgressDateContext,
  agentRoleCards,
  agentRoleStatusLabels,
  copy,
  isAgentFeedbackRunning,
  onOpenAgentFeedbackStopDialog,
}: AgentFeedbackCardProps) {
  return (
    <article className={`${styles.integrityStat} ${styles.agentFeedbackCard}`}>
      <div className={styles.sectionHeaderRow}>
        <div>
          <h2 className={styles.sectionTitle}>{copy.operational.agentTitle}</h2>
          {agentProgressDateContext ? (
            <p className={styles.cardContext}>{copy.operational.agentDate} {agentProgressDateContext}</p>
          ) : null}
        </div>
        <span className={`pill ${agentFeedbackStatusTone}`}>{agentFeedbackHeaderStatusLabel}</span>
      </div>
      {agentRoleCards.length > 0 ? (
        <div className={styles.agentRoleList} role="list" aria-label={copy.operational.agentRoleProgress}>
          {agentRoleCards.map((role) => (
            <div
              key={role.role}
              className={styles.agentRoleRow}
              data-role-status={role.status}
              role="listitem"
              aria-label={`${role.label} ${agentRoleStatusLabels[role.status]}`}
            >
              <div className={styles.agentRoleContent}>
                <span className={styles.agentRoleTitleRow}>
                  <span className={styles.agentRoleName}>{role.label}</span>
                  {isSummarizerRole(role.role) ? (
                    <span
                      className={styles.agentRoleProgressIcon}
                      data-role-progress-icon={role.status}
                      aria-hidden="true"
                    />
                  ) : null}
                </span>
                {isSummarizerRole(role.role) ? (
                  <div
                    className={styles.agentRoleProgressTrack}
                    data-role-progress-track={role.status}
                    data-role-progress-value={role.progressPercent}
                    role="progressbar"
                    aria-label={`${role.label} ${copy.agentFeedback.metrics.progress}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={role.progressPercent}
                    aria-valuetext={role.progressLabel}
                  >
                    <i style={{ width: `${role.progressPercent}%` }} />
                  </div>
                ) : null}
                <span className={styles.agentRoleStatusText}>{agentRoleStatusLabels[role.status]}</span>
                {role.metrics.length > 0 ? (
                  <dl className={styles.agentRoleMetrics}>
                    {role.metrics.map((metric) => (
                      <div key={metric.key} className={styles.agentRoleMetric}>
                        <dt>{metric.label}</dt>
                        <dd>{metric.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>{copy.operational.agentProgressUnavailable}</div>
      )}
      {isAgentFeedbackRunning ? (
        <div className={styles.agentFeedbackActions}>
          <button
            type="button"
            className={styles.agentFeedbackStopButton}
            aria-label={copy.operational.stop}
            aria-haspopup="dialog"
            aria-expanded={agentFeedbackStopDialogOpen}
            aria-controls={AGENT_FEEDBACK_STOP_DIALOG_ID}
            onClick={onOpenAgentFeedbackStopDialog}
          >
            {copy.operational.stop}
          </button>
        </div>
      ) : null}
    </article>
  );
});

type TrackedSymbolsSectionProps = {
  copy: DashboardLiveCopy;
  trackedSymbolCards: TrackedSymbolCardModel[];
};

const TrackedSymbolsSection = memo(function TrackedSymbolsSection({
  copy,
  trackedSymbolCards,
}: TrackedSymbolsSectionProps) {
  return (
    <section className={`${styles.panel} ${styles.trackedPanel}`} id="tracked-symbols">
      <div className={styles.sectionHeaderRow}>
        <div>
          <p className={styles.sectionEyebrow}>{copy.operational.trackedEyebrow}</p>
          <h2 className={styles.sectionTitle}>{copy.operational.trackedTitle}</h2>
        </div>
        <Link href="/my-symbols" className={styles.sectionLink} aria-label={copy.operational.openMySymbols}>
          {copy.operational.more}
        </Link>
      </div>

      <div className={styles.trackedList}>
        {trackedSymbolCards.map((item) => (
          <Link
            key={item.symbol}
            href={item.href}
            className={`${styles.trackedCard} ${item.isMuted ? styles.trackedCardMuted : ""}`.trim()}
          >
            <ComponentTag label={`dashboard.symbol-card.${item.symbol}`} api="/api/trading/quotes/tracked" />

            <div className={styles.trackedCardTop}>
              <div>
                <strong className={styles.companyName}>{item.companyName}</strong>
                <p className={`clamp-3 ${styles.symbolCode}`}>{item.symbol}</p>
              </div>
              <span className={`pill ${item.availabilityTone}`}>{item.availabilityLabel}</span>
            </div>

            <div className={styles.priceBlock}>
              <strong>{item.priceLabel}</strong>
              <span
                className={
                  item.changeTone === "positive"
                    ? styles.positive
                    : item.changeTone === "negative"
                      ? styles.negative
                      : ""
                }
              >
                {item.changeLabel}
              </span>
            </div>

            <div className={styles.cardMeta}>
              <div>
                <span>{copy.operational.priceFreshness}</span>
                <strong>{item.priceFreshnessLabel}</strong>
              </div>
              <div>
                <span>{copy.operational.technicalFreshness}</span>
                <strong>{item.technicalFreshnessLabel}</strong>
              </div>
            </div>

            <div className={styles.cardFooter}>
              <span className="clamp-3">{item.sourceLabel}</span>
              <span className="clamp-3">{item.turnoverLabel}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
});

export function LiveDashboardClient({
  initialError = null,
  initialMarket,
  initialTracked,
  initialFreshness,
  initialFundamentalsStatus,
  initialPipelineStatus,
  initialAgentFeedbackProgress,
}: LiveDashboardClientProps) {
  const { locale } = useAppState();
  const copy = getDashboardLiveCopy(locale);
  const numberLocale = getNumberLocale(locale);
  const agentProgressStatusLabels = useMemo(() => getAgentProgressStatusLabels(copy), [copy]);
  const agentRoleStatusLabels = useMemo(() => getAgentRoleStatusLabels(copy), [copy]);
  const {
    agentFeedbackProgress,
    agentFeedbackProgressError,
    dashboardProcessMarketDate,
    freshness,
    fundamentalsStatus,
    market,
    marketError,
    piotroskiBoard,
    piotroskiBoardError,
    piotroskiBoardLoadState,
    pipelineStatus,
    setAgentFeedbackProgress,
    setAgentFeedbackProgressError,
    symbolMetaBySymbol,
    tracked,
    trackedError,
  } = useLiveDashboardData({
    initialAgentFeedbackProgress,
    initialError,
    initialFreshness,
    initialFundamentalsStatus,
    initialMarket,
    initialPipelineStatus,
    initialTracked,
  });
  const [agentFeedbackStopPending, setAgentFeedbackStopPending] = useState(false);
  const [agentFeedbackStopError, setAgentFeedbackStopError] = useState<string | null>(null);
  const [agentFeedbackStopDialogOpen, setAgentFeedbackStopDialogOpen] = useState(false);
  const [openFundamentalsFailureKey, setOpenFundamentalsFailureKey] = useState<string | null>(null);
  const agentFeedbackProgressRef = useRef(agentFeedbackProgress);

  useEffect(() => {
    agentFeedbackProgressRef.current = agentFeedbackProgress;
  }, [agentFeedbackProgress]);

  const latestAvailableFundamentalsCoverage = getLatestAvailableFundamentalsCoverage(freshness, fundamentalsStatus);
  const latestFundamentalsDate = getFirstTextValue(
    getLatestAvailableFundamentalsDate(freshness, fundamentalsStatus),
    getFundamentalsFreshnessLayer(freshness)?.latest_date,
    getFundamentalsRunDate(getLatestFundamentalsRun(fundamentalsStatus)),
  );
  const todayTradeDate = getFirstTextValue(freshness?.today?.trade_date);
  const latestEodTradeDate = getLatestEodTradeDate(freshness);
  const priceLatestDate = getFirstTextValue(getLatestPriceTradeDate(freshness), latestEodTradeDate);
  const technicalLatestDate = getFirstTextValue(
    freshness?.technical?.latest_date,
    getLatestTechnicalMarketDate(freshness),
    latestEodTradeDate,
  );
  const actionLatestDate = getFirstTextValue(
    freshness?.action?.latest_date,
    getLatestActionMarketDate(freshness),
    latestEodTradeDate,
  );
  const pricePipelineStage = getPipelineStage(pipelineStatus, "price_collection");
  const technicalPipelineStage = getPipelineStage(pipelineStatus, "technical_snapshots");
  const fundamentalsPipelineStage = getPipelineStage(pipelineStatus, "fundamentals_daily_refresh");
  const actionPipelineStage = getPipelineStage(pipelineStatus, "action_summaries");
  const primaryLatestCycleDate = getFirstTextValue(
    latestEodTradeDate,
    priceLatestDate,
    technicalLatestDate,
    actionLatestDate,
    latestFundamentalsDate,
    dashboardProcessMarketDate,
    todayTradeDate,
  );
  const primaryLatestCycleDateLabel = primaryLatestCycleDate ?? UNKNOWN_LABEL;
  const useTodayPriceStage = shouldUseTodayStageData(todayTradeDate, priceLatestDate, pricePipelineStage);
  const useTodayTechnicalStage = shouldUseTodayStageData(todayTradeDate, technicalLatestDate, technicalPipelineStage);
  const useTodayActionStage = shouldUseTodayStageData(todayTradeDate, actionLatestDate, actionPipelineStage);
  const useTodayFundamentalsStage = shouldUseTodayFundamentalsStageData(
    freshness,
    fundamentalsStatus,
    fundamentalsPipelineStage,
  );
  const fundamentalsStatusLabel = getFundamentalsStatusLabel(
    freshness,
    fundamentalsStatus,
    latestAvailableFundamentalsCoverage,
    fundamentalsPipelineStage,
  );
  const fundamentalsFreshnessStage = getFundamentalsFreshnessStage(
    freshness,
    fundamentalsStatus,
    fundamentalsStatusLabel,
    latestFundamentalsDate,
    useTodayFundamentalsStage,
  );
  const fundamentalsFailureDetails = useMemo(
    () =>
      getFundamentalsFailureDetails(
        freshness,
        fundamentalsStatus,
        latestFundamentalsDate,
        fundamentalsStatusLabel,
        copy,
        numberLocale,
      ),
    [copy, freshness, fundamentalsStatus, fundamentalsStatusLabel, latestFundamentalsDate, numberLocale],
  );

  const piotroskiMarketDate = dashboardProcessMarketDate;
  const eodStatusMarketDate = dashboardProcessMarketDate;
  const isBreakDay = isBreakDayMarket(market);
  const priceFreshnessStage = mergeRunningPipelineStage(
    getPriceFreshnessStage(freshness, useTodayPriceStage),
    pricePipelineStage,
  );
  const technicalFreshnessStage = mergeRunningPipelineStage(
    getTechnicalFreshnessStage(freshness, useTodayTechnicalStage),
    technicalPipelineStage,
  );
  const actionFreshnessStage = mergeRunningPipelineStage(
    getActionFreshnessStage(freshness, useTodayActionStage),
    actionPipelineStage,
  );
  const fundamentalsFreshnessWithPipelineStage = mergeRunningPipelineStage(
    fundamentalsFreshnessStage,
    fundamentalsPipelineStage,
  );
  const fundamentalsUpdatedSymbolsDetail = useMemo(
    () => getFundamentalsUpdatedSymbolsDetail(fundamentalsStatus, todayTradeDate, copy, numberLocale),
    [copy, fundamentalsStatus, numberLocale, todayTradeDate],
  );
  const eodStageCards = useMemo(() => {
    const fundamentalsStageCard = buildEodStageCard(
      "fundamentals",
      copy.stage.fundamentals,
      fundamentalsFreshnessWithPipelineStage,
      eodStatusMarketDate,
      latestFundamentalsDate,
      primaryLatestCycleDate,
      isBreakDay,
      fundamentalsPipelineStage,
      copy,
      numberLocale,
      {
        label: copy.operational.checked,
        value: formatEodSymbolCount(
          getFundamentalsCheckedCount(freshness, fundamentalsStatus, fundamentalsFreshnessWithPipelineStage),
          numberLocale,
        ),
      },
      getFundamentalsStageStatusLabel,
    );

    return [
      buildEodStageCard(
        "price",
        copy.stage.price,
        priceFreshnessStage,
        eodStatusMarketDate,
        priceLatestDate,
        primaryLatestCycleDate,
        isBreakDay,
        pricePipelineStage,
        copy,
        numberLocale,
      ),
      buildEodStageCard(
        "technical",
        copy.stage.technical,
        technicalFreshnessStage,
        eodStatusMarketDate,
        technicalLatestDate,
        primaryLatestCycleDate,
        isBreakDay,
        technicalPipelineStage,
        copy,
        numberLocale,
      ),
      buildEodStageCard(
        "action",
        copy.stage.action,
        actionFreshnessStage,
        eodStatusMarketDate,
        actionLatestDate,
        primaryLatestCycleDate,
        isBreakDay,
        actionPipelineStage,
        copy,
        numberLocale,
      ),
      fundamentalsUpdatedSymbolsDetail
        ? {
            ...fundamentalsStageCard,
            details: [...fundamentalsStageCard.details, fundamentalsUpdatedSymbolsDetail],
          }
        : fundamentalsStageCard,
    ] as const;
  }, [
    actionFreshnessStage,
    actionLatestDate,
    actionPipelineStage,
    copy,
    eodStatusMarketDate,
    freshness,
    fundamentalsFreshnessWithPipelineStage,
    fundamentalsPipelineStage,
    fundamentalsStatus,
    fundamentalsUpdatedSymbolsDetail,
    isBreakDay,
    latestFundamentalsDate,
    numberLocale,
    primaryLatestCycleDate,
    priceFreshnessStage,
    priceLatestDate,
    pricePipelineStage,
    technicalFreshnessStage,
    technicalLatestDate,
    technicalPipelineStage,
  ]);
  const agentProgressMarketDate = getAgentFeedbackProgressMarketDate(freshness);
  const displayedAgentFeedbackProgress = useMemo(
    () =>
      agentProgressMarketDate && agentFeedbackProgress?.request?.market_date === agentProgressMarketDate
        ? agentFeedbackProgress
        : null,
    [agentFeedbackProgress, agentProgressMarketDate],
  );
  const displayedAgentFeedbackProgressError = agentProgressMarketDate ? agentFeedbackProgressError : null;
  const agentProgressStatusLabel = getAgentProgressStatusLabel(
    displayedAgentFeedbackProgress,
    displayedAgentFeedbackProgressError,
    copy,
  );
  const rawAgentProgressDate = displayedAgentFeedbackProgress?.request?.market_date ?? agentProgressMarketDate;
  const agentProgressDateContext = getExceptionDateLabel(rawAgentProgressDate, primaryLatestCycleDate);
  const isAgentFeedbackRunning = isAgentFeedbackProgressRunning(displayedAgentFeedbackProgress);
  const agentRoleCards = useMemo(
    () => buildAgentRoleCards(displayedAgentFeedbackProgress, copy, numberLocale),
    [copy, displayedAgentFeedbackProgress, numberLocale],
  );
  const agentProgressRunStatus = getResolvedAgentProgressRunStatus(displayedAgentFeedbackProgress);
  const showCompletedAgentFeedbackStatus =
    agentProgressRunStatus === "pending" && hasCompletedDefaultAgentRoles(agentRoleCards);
  const agentFeedbackHeaderStatusLabel = showCompletedAgentFeedbackStatus
    ? agentProgressStatusLabels.completed
    : agentProgressStatusLabel;
  const agentFeedbackStatusTone =
    showCompletedAgentFeedbackStatus || agentProgressRunStatus === "completed"
      ? "positive"
      : agentProgressRunStatus === "running"
        ? "neutral"
        : agentProgressRunStatus === "stalled"
          ? "warning"
          : "neutral";
  const filteringCardModel = useMemo(
    () =>
      buildPiotroskiFilteringCardModel({
        copy,
        numberLocale,
        piotroskiBoard,
        piotroskiBoardError,
        piotroskiBoardLoadState,
        piotroskiMarketDate,
    }),
    [copy, numberLocale, piotroskiBoard, piotroskiBoardError, piotroskiBoardLoadState, piotroskiMarketDate],
  );
  const filteringCardMarketDateContext = getExceptionDateLabel(
    filteringCardModel.displayMarketDate,
    primaryLatestCycleDate,
  );
  const trackedSymbolCards = useMemo(
    () => buildTrackedSymbolCardModels(tracked, symbolMetaBySymbol, freshness, copy, numberLocale),
    [copy, freshness, numberLocale, symbolMetaBySymbol, tracked],
  );
  const marketBadgeLabel = market.is_open ? copy.marketOpen : copy.marketClosed;
  const coreUnavailable =
    market.state === "OFFLINE PLACEHOLDER" ||
    isOfflineTrackedPlaceholder(tracked) ||
    Boolean(marketError || trackedError);
  const error = trackedError ?? marketError;
  const fundamentalsDialogOpen =
    Boolean(fundamentalsFailureDetails) && openFundamentalsFailureKey === fundamentalsFailureDetails?.key;
  const dialogOpen = fundamentalsDialogOpen || agentFeedbackStopDialogOpen;

  const openAgentFeedbackStopDialog = useCallback(() => {
    if (!isAgentFeedbackRunning) return;
    setAgentFeedbackStopError(null);
    setAgentFeedbackStopDialogOpen(true);
  }, [isAgentFeedbackRunning]);

  const openFundamentalsDetails = useCallback(() => {
    if (!fundamentalsFailureDetails) return;
    setOpenFundamentalsFailureKey(fundamentalsFailureDetails.key);
  }, [fundamentalsFailureDetails]);

  function closeAgentFeedbackStopDialog() {
    if (agentFeedbackStopPending) return;
    setAgentFeedbackStopError(null);
    setAgentFeedbackStopDialogOpen(false);
  }

  async function handleAgentFeedbackStopConfirm() {
    if (agentFeedbackStopPending) return;

    setAgentFeedbackStopPending(true);
    setAgentFeedbackStopError(null);

    try {
      await postJson<AgentContextCoreControlResponseDto>(
        AGENT_FEEDBACK_STOP_CONTROL_CLIENT_PATH,
        AGENT_FEEDBACK_STOP_REQUEST,
      );
      setAgentFeedbackStopDialogOpen(false);
    } catch (stopError) {
      if (shouldTreatAgentFeedbackStopDisconnectAsAccepted(stopError)) {
        const stoppedProgress = markAgentFeedbackProgressStopped(agentFeedbackProgressRef.current);
        agentFeedbackProgressRef.current = stoppedProgress;
        setAgentFeedbackProgress(stoppedProgress);
        setAgentFeedbackProgressError(null);
        setAgentFeedbackStopDialogOpen(false);
        return;
      }

      console.error("Dashboard agent feedback stop request failed", stopError);
      setAgentFeedbackStopError(getDashboardLoadErrorMessage(stopError));
    } finally {
      setAgentFeedbackStopPending(false);
    }
  }

  useEffect(() => {
    if (isAgentFeedbackRunning) return;
    setAgentFeedbackStopError(null);
    setAgentFeedbackStopDialogOpen(false);
  }, [isAgentFeedbackRunning]);

  useEffect(() => {
    if (!dialogOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (agentFeedbackStopPending) return;
        if (agentFeedbackStopDialogOpen) {
          setAgentFeedbackStopError(null);
          setAgentFeedbackStopDialogOpen(false);
          return;
        }
        setOpenFundamentalsFailureKey(null);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [agentFeedbackStopDialogOpen, agentFeedbackStopPending, dialogOpen, fundamentalsDialogOpen]);

  return (
    <MobileAppChrome
      activeNav="dashboard"
      header={
        <>
          <div className={styles.appHeaderBrand}>
            <div className={styles.brandMark}>K</div>
            <div>
              <strong className={styles.brandTitle}>{copy.brandTitle}</strong>
            </div>
          </div>

          <div className={styles.appHeaderActions}>
            <span className={`pill ${styles.marketStatusPill} ${market.is_open ? "positive" : styles.marketStatusClosedPill}`}>
              {marketBadgeLabel}
            </span>
            <DevModeToggle />
          </div>
        </>
      }
    >
      <div className={`${styles.stack} ${styles.dashboardWideShell}`}>
        {coreUnavailable ? (
          <section className={`${styles.panel} ${styles.alertPanel}`}>
            <ComponentTag label="dashboard.core-unavailable" api="/api/trading/market/status + /api/trading/quotes/tracked" />
            <p className={styles.sectionEyebrow}>{copy.coreUnavailable.eyebrow}</p>
            <strong className={styles.alertTitle}>{copy.coreUnavailable.title}</strong>
            <p className="clamp-3">
              {error ?? copy.coreUnavailable.description}
            </p>
          </section>
        ) : null}

        <section className={`${styles.panel} ${styles.integrityPanel}`} id="dashboard-freshness">
          <ComponentTag
            label="dashboard.operational-integrity"
            api="/api/trading/eod/freshness + /api/trading/eod/pipeline/status + /api/trading/market/status + /api/trading/agent-context/feedback/progress + /api/trading/agent-context/internal/core/control + /api/trading/disclosures/dart/fundamentals/daily/inspect + /api/trading/eod/piotroski-filter-results"
          />

          <div className={styles.panelHeader}>
            <div>
              <p className={styles.sectionEyebrow}>{copy.operational.eyebrow}</p>
              <h1 className={styles.heroTitle}>{copy.operational.title}</h1>
              <div className={styles.primaryDateList}>
                <p className={styles.primaryDateItem}>
                  <span className={styles.primaryDateLabel}>{copy.operational.serverTime}</span>
                  <strong className={styles.primaryDateValue}>{formatDisplayTimestamp(market.server_time)}</strong>
                </p>
                <p className={styles.primaryDateItem}>
                  <span className={styles.primaryDateLabel}>{copy.operational.latestCycleDate}</span>
                  <strong className={styles.primaryDateValue}>{primaryLatestCycleDateLabel}</strong>
                </p>
              </div>
            </div>
          </div>

          <div className={styles.integrityGrid}>
            <EodStatusCard
              copy={copy}
              eodStageCards={eodStageCards}
              fundamentalsDialogOpen={fundamentalsDialogOpen}
              fundamentalsFailureDetails={fundamentalsFailureDetails}
              onOpenFundamentalsDetails={openFundamentalsDetails}
            />

            <PiotroskiFilteringCard
              copy={copy}
              filteringCardModel={filteringCardModel}
              marketDateContext={filteringCardMarketDateContext}
            />

            <AgentFeedbackCard
              agentFeedbackHeaderStatusLabel={agentFeedbackHeaderStatusLabel}
              agentFeedbackStatusTone={agentFeedbackStatusTone}
              agentFeedbackStopDialogOpen={agentFeedbackStopDialogOpen}
              agentProgressDateContext={agentProgressDateContext}
              agentRoleCards={agentRoleCards}
              agentRoleStatusLabels={agentRoleStatusLabels}
              copy={copy}
              isAgentFeedbackRunning={isAgentFeedbackRunning}
              onOpenAgentFeedbackStopDialog={openAgentFeedbackStopDialog}
            />
          </div>
        </section>

        <TrackedSymbolsSection copy={copy} trackedSymbolCards={trackedSymbolCards} />
      </div>

      {fundamentalsDialogOpen && fundamentalsFailureDetails
        ? createPortal(
            <div className={styles.dialogBackdrop} onMouseDown={() => setOpenFundamentalsFailureKey(null)}>
              <section
                id="fundamentals-failure-dialog"
                className={styles.failureDialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="fundamentals-failure-title"
                aria-describedby="fundamentals-failure-reason"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className={styles.dialogHeader}>
                  <div>
                    <p className={styles.sectionEyebrow}>{copy.operational.fundamentalsDialogEyebrow}</p>
                    <h2 id="fundamentals-failure-title" className={styles.dialogTitle}>
                      {fundamentalsFailureDetails.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    className={styles.dialogCloseButton}
                    onClick={() => setOpenFundamentalsFailureKey(null)}
                    aria-label={copy.operational.closeFundamentalsDetails}
                    autoFocus
                  >
                    {copy.operational.close}
                  </button>
                </div>

                <p id="fundamentals-failure-reason" className={styles.failureReason}>
                  {fundamentalsFailureDetails.reason}
                </p>

                <dl className={styles.failureDetailGrid}>
                  {fundamentalsFailureDetails.details.map((item) => (
                    <div key={item.label} className={styles.failureDetailItem}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>

                {fundamentalsFailureDetails.metadata.length > 0 ? (
                  <div className={styles.metadataBlock}>
                    <strong>{copy.operational.failureMetadata}</strong>
                    <dl>
                      {fundamentalsFailureDetails.metadata.map((item) => (
                        <div key={item.label}>
                          <dt>{item.label}</dt>
                          <dd>{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}
              </section>
            </div>,
            document.body,
          )
        : null}

      {agentFeedbackStopDialogOpen
        ? createPortal(
            <div className={styles.dialogBackdrop} onMouseDown={closeAgentFeedbackStopDialog}>
              <section
                id={AGENT_FEEDBACK_STOP_DIALOG_ID}
                className={`${styles.failureDialog} ${styles.confirmationDialog}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="agent-feedback-stop-title"
                aria-describedby={agentFeedbackStopError ? AGENT_FEEDBACK_STOP_ERROR_ID : undefined}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className={styles.dialogHeader}>
                  <div>
                    <p className={styles.sectionEyebrow}>{copy.operational.stopDialogEyebrow}</p>
                    <h2 id="agent-feedback-stop-title" className={styles.dialogTitle}>
                      {copy.operational.stopDialogTitle}
                    </h2>
                  </div>
                </div>

                {agentFeedbackStopError ? (
                  <p
                    id={AGENT_FEEDBACK_STOP_ERROR_ID}
                    className={`${styles.confirmationMessage} ${styles.confirmationError}`}
                    role="alert"
                  >
                    {agentFeedbackStopError}
                  </p>
                ) : null}

                <div className={styles.dialogActions}>
                  <button
                    type="button"
                    className={`${styles.dialogActionButton} ${styles.dialogActionSecondary}`}
                    onClick={closeAgentFeedbackStopDialog}
                    autoFocus
                    disabled={agentFeedbackStopPending}
                  >
                    {copy.operational.stopDialogNo}
                  </button>
                  <button
                    type="button"
                    className={`${styles.dialogActionButton} ${styles.dialogActionDanger}`}
                    onClick={() => void handleAgentFeedbackStopConfirm()}
                    disabled={agentFeedbackStopPending}
                  >
                    {agentFeedbackStopPending ? copy.operational.stopDialogStopping : copy.operational.stopDialogYes}
                  </button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </MobileAppChrome>
  );
}
