"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { ComponentTag } from "@/components/dev/component-tag";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { LanguageSwitchControl } from "@/components/navigation/language-switch-control";
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
import { RELEASE_VERSION_LABEL } from "@/lib/release-version";
import {
  buildSignalDeciderFeedbackSummary,
  formatSignalDeciderActionLabel,
  type SignalDeciderFeedbackStatus,
  type SignalDeciderFeedbackSummaryModel,
} from "@/lib/signal-decider-feedback";
import {
  buildPortfolioMetricModels,
  getPortfolioAccounts,
  getPortfolioHoldings,
  getPortfolioLastSyncedAt,
  getPortfolioSyncMessage,
  resolvePortfolioSummaryState,
  type PortfolioMetricId,
  type PortfolioMetricModel,
  type PortfolioSummaryState,
} from "@/features/portfolio/portfolio-display";
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
  buildFilteringCardModel,
  buildMarketSnapshotPresentation,
  buildProcessMonitorModel,
  formatEodSymbolCount,
  getAgentProgressStatusLabel,
  getAgentProgressStatusLabels,
  getAgentRoleStatusLabels,
  getDashboardLoadErrorMessage,
  getFirstTextValue,
  getFundamentalsCheckedCount,
  getFundamentalsUpdatedActivityModel,
  getFundamentalsUpdatedCountLabel,
  getFundamentalsFailureDetails,
  getFundamentalsFreshnessLayer,
  getFundamentalsStatusLabel,
  getFundamentalsStageStatusLabel,
  getFundamentalsUpdatedSymbolsDetail,
  getPipelineStageResolvedStatusDate,
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
  markAgentFeedbackProgressStopped,
  maskFutureEodStageCardsWhilePipelineRunning,
  mergeRunningPipelineStage,
  shouldShowAgentRoleProgress,
  shouldTreatAgentFeedbackStopDisconnectAsAccepted,
} from "@/features/dashboard/live-dashboard-derived-state";
import type {
  AgentRoleCard,
  AgentRoleStatus,
  EodStageCard,
  FilteringCardModel,
  FilteringStageModel,
  FundamentalsUpdatedActivityModel,
  FundamentalsFailureDetails,
  LiveDashboardClientProps,
  ProcessMonitorModel,
} from "@/features/dashboard/live-dashboard-types";
import { useLiveDashboardData } from "@/features/dashboard/use-live-dashboard-data";
import type {
  AgentContextCoreControlRequestDto,
  AgentContextCoreControlResponseDto,
  MarketSnapshotFlowDto,
  MarketSnapshotFxRateDto,
  MarketSnapshotIndexDto,
  MarketSnapshotResponseDto,
  PortfolioSummaryDto,
} from "@/types/trading-api";

import styles from "./live-dashboard-client.module.css";

const AGENT_FEEDBACK_STOP_DIALOG_ID = "agent-feedback-stop-dialog";
const AGENT_FEEDBACK_STOP_ERROR_ID = "agent-feedback-stop-error";
const PROCESS_MONITOR_DRAWER_ID = "dashboard-process-monitor-drawer";
const PROCESS_MONITOR_DRAWER_ANIMATION_MS = 240;
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
  fundamentalsUpdatedActivity: FundamentalsUpdatedActivityModel | null;
  fundamentalsUpdatesExpanded: boolean;
  fundamentalsFailureDetails: FundamentalsFailureDetails | null;
  onOpenFundamentalsDetails: () => void;
  onToggleFundamentalsUpdatesExpanded: () => void;
};

const EodStatusCard = memo(function EodStatusCard({
  copy,
  eodStageCards,
  fundamentalsDialogOpen,
  fundamentalsUpdatedActivity,
  fundamentalsUpdatesExpanded,
  fundamentalsFailureDetails,
  onOpenFundamentalsDetails,
  onToggleFundamentalsUpdatesExpanded,
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
          const visibleFundamentalsUpdatedItems =
            stage.id === "fundamentals" && fundamentalsUpdatedActivity
              ? fundamentalsUpdatesExpanded
                ? fundamentalsUpdatedActivity.allItems
                : fundamentalsUpdatedActivity.previewItems
              : [];

          return (
            <div
              key={stage.id}
              className={styles.eodStageCard}
              aria-label={`${stage.label} freshness`}
              data-stage={stage.id}
              data-status={stage.statusLabel}
            >
              <div className={styles.eodStageTop}>
                <div className={styles.eodStageSummary}>
                  <span className={styles.eodStageTitle}>{stage.label}</span>
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
                    {visibleFundamentalsUpdatedItems.length > 0 ? (
                      <div className={styles.fundamentalsUpdatedBlock}>
                        <span className={styles.fundamentalsUpdatedLabel}>{copy.operational.updatedCompanies}</span>
                        <div
                          id="fundamentals-updated-company-list"
                          className={styles.fundamentalsUpdatedList}
                          role="list"
                          aria-label={copy.operational.updatedCompanies}
                        >
                          {visibleFundamentalsUpdatedItems.map((item) => (
                            <div key={item.key} className={styles.fundamentalsUpdatedRow} role="listitem">
                              <span className={styles.fundamentalsUpdatedCompany}>{item.companyName}</span>
                              <span className={styles.fundamentalsUpdatedCategory}>{item.categoryLabel}</span>
                            </div>
                          ))}
                        </div>
                        {fundamentalsUpdatedActivity?.canExpand ? (
                          <button
                            type="button"
                            className={styles.inlineToggleButton}
                            aria-expanded={fundamentalsUpdatesExpanded}
                            aria-controls="fundamentals-updated-company-list"
                            aria-label={
                              fundamentalsUpdatesExpanded
                                ? copy.operational.showFewerUpdatedCompanies
                                : copy.operational.showAllUpdatedCompanies
                            }
                            onClick={onToggleFundamentalsUpdatesExpanded}
                          >
                            {fundamentalsUpdatesExpanded ? copy.operational.less : copy.operational.more}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
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
                      <span className={styles.statusPillLabel}>
                        {stage.statusLabel === "running" ? (
                          <span className={styles.runningStatusLabel}>
                            <span className={styles.runningStatusSpinner} aria-hidden="true" />
                            <span className={styles.runningStatusText}>{displayedStatusLabel}</span>
                          </span>
                        ) : (
                          displayedStatusLabel
                        )}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
});

type FilteringCardProps = {
  copy: DashboardLiveCopy;
  filteringCardModel: FilteringCardModel;
  patchDate: string | null;
};

function getFilteringStatusIconClassName(status: FilteringStageModel["status"]) {
  if (status === "completed") return styles.syncedStatusIcon;
  if (status === "loading") return styles.filterLoadingStatusIcon;
  if (status === "needs-review") return styles.filterNeedsReviewStatusIcon;
  return styles.filterPendingStatusIcon;
}

const FilteringCard = memo(function FilteringCard({
  copy,
  filteringCardModel,
  patchDate,
}: FilteringCardProps) {
  return (
    <article className={`${styles.integrityStat} ${styles.filteringCard}`}>
      <div className={styles.sectionHeaderRow}>
        <div>
          <p className={styles.sectionEyebrow}>{copy.operational.filteringEyebrow}</p>
          <h2 className={styles.sectionTitle}>{copy.operational.filteringTitle}</h2>
        </div>
        <Link
          href={buildPiotroskiListHref(filteringCardModel.piotroskiDisplayMarketDate)}
          className={styles.sectionLink}
          aria-label={copy.operational.openPiotroskiList}
        >
          {copy.operational.more}
        </Link>
      </div>

      <div className={styles.filterStageList}>
        {filteringCardModel.stages.map((stage) => {
          const displayMarketDateContext = getExceptionDateLabel(stage.displayMarketDate, patchDate);
          const statusIconClassName = getFilteringStatusIconClassName(stage.status);

          return (
            <section
              key={stage.key}
              className={styles.filterStageSection}
              data-filter-stage={stage.key}
              data-filter-status={stage.status}
              aria-label={`${stage.label} filtering status`}
            >
              <div className={styles.filterStageHeader}>
                <div>
                  <h3 className={styles.filterStageTitle}>{stage.label}</h3>
                  {displayMarketDateContext ? (
                    <p className={styles.cardContext}>
                      {copy.operational.marketDate} {displayMarketDateContext}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`${styles.statusIconBadge} ${styles.filterStatusIcon} ${statusIconClassName}`}
                  title={stage.statusLabel}
                  data-filter-status-badge={stage.status}
                  role="img"
                  aria-label={stage.statusLabel}
                />
              </div>

              <div className={styles.statusMetricGrid}>
                {stage.metrics.map((metric) => (
                  <div key={metric.key} className={styles.statusMetric}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                  </div>
                ))}
              </div>

              {stage.note ? <p className={styles.cardContext}>{stage.note}</p> : null}
            </section>
          );
        })}
      </div>

      <div className={styles.filterFinalCount} aria-label={copy.operational.finalFilteredSymbols}>
        <span>{copy.operational.finalFilteredSymbols}</span>
        <strong>{filteringCardModel.finalFilteredCountLabel}</strong>
      </div>
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
  const statusClass = isAgentFeedbackRunning ? styles.runningStatusPill : "";

  return (
    <article className={`${styles.integrityStat} ${styles.agentFeedbackCard}`}>
      <div className={styles.sectionHeaderRow}>
        <div>
          <h2 className={styles.sectionTitle}>{copy.operational.agentTitle}</h2>
          {agentProgressDateContext ? (
            <p className={styles.cardContext}>{copy.operational.agentDate} {agentProgressDateContext}</p>
          ) : null}
        </div>
        <span className={`pill ${agentFeedbackStatusTone} ${statusClass}`}>
          {isAgentFeedbackRunning ? (
            <span className={styles.runningStatusLabel}>
              <span className={styles.runningStatusSpinner} aria-hidden="true" />
              <span className={styles.runningStatusText}>{agentFeedbackHeaderStatusLabel}</span>
            </span>
          ) : (
            agentFeedbackHeaderStatusLabel
          )}
        </span>
      </div>
      {agentRoleCards.length > 0 ? (
        <div className={styles.agentRoleList} role="list" aria-label={copy.operational.agentRoleProgress}>
          {agentRoleCards.map((role) => {
            const showRoleProgress = shouldShowAgentRoleProgress(role);

            return (
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
                    {showRoleProgress ? (
                      <span
                        className={styles.agentRoleProgressIcon}
                        data-role-progress-icon={role.status}
                        aria-hidden="true"
                      />
                    ) : null}
                  </span>
                  {showRoleProgress ? (
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
            );
          })}
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

function getSignalDeciderStatusCopyKey(status: SignalDeciderFeedbackStatus) {
  return status === "needs-review" ? "needsReview" : status;
}

function getSignalDeciderStatusTone(status: SignalDeciderFeedbackStatus) {
  if (status === "completed") return "positive";
  if (status === "partial" || status === "needs-review") return "warning";
  return "neutral";
}

function getSignalDeciderQualityTone(tone: string | null | undefined) {
  if (tone === "positive" || tone === "warning" || tone === "negative" || tone === "info") return tone;
  return "neutral";
}

function formatSignalDeciderResultCount(model: SignalDeciderFeedbackSummaryModel, numberLocale: string) {
  const completedCount = typeof model.completedCount === "number" ? model.completedCount : model.resultCount;
  const resultCount = completedCount.toLocaleString(numberLocale);
  if (typeof model.requestedCount === "number" && model.requestedCount > completedCount) {
    return `${resultCount} / ${model.requestedCount.toLocaleString(numberLocale)}`;
  }
  return resultCount;
}

function formatSignalDeciderActionMix(model: SignalDeciderFeedbackSummaryModel, numberLocale: string) {
  const visibleActions = (["buy", "wait", "reject"] as const)
    .filter((action) => model.actionCounts[action] > 0)
    .map((action) => `${formatSignalDeciderActionLabel(action)} ${model.actionCounts[action].toLocaleString(numberLocale)}`);

  if (model.actionCounts.unknown > 0) {
    visibleActions.push(`Unknown ${model.actionCounts.unknown.toLocaleString(numberLocale)}`);
  }

  return visibleActions.length > 0 ? visibleActions.join(" · ") : UNKNOWN_LABEL;
}

type SignalDeciderFeedbackCardProps = {
  copy: DashboardLiveCopy;
  error: string | null;
  model: SignalDeciderFeedbackSummaryModel;
  numberLocale: string;
};

const SignalDeciderFeedbackCard = memo(function SignalDeciderFeedbackCard({
  copy,
  error,
  model,
  numberLocale,
}: SignalDeciderFeedbackCardProps) {
  const statusCopyKey = getSignalDeciderStatusCopyKey(model.status);
  const statusLabel = copy.signalDecider.statuses[statusCopyKey];
  const statusTone = getSignalDeciderStatusTone(model.status);

  return (
    <article
      className={`${styles.integrityStat} ${styles.primaryInsightCard} ${styles.signalDeciderCard}`}
      data-signal-decider-status={model.status}
    >
      <div className={styles.sectionHeaderRow}>
        <div>
          <h2 className={styles.sectionTitle}>{copy.signalDecider.title}</h2>
          <p className={styles.cardContext}>{copy.signalDecider.decisionSupportOnly}</p>
        </div>
        <span className={`pill ${statusTone}`}>{statusLabel}</span>
      </div>

      <div className={styles.statusMetricGrid}>
        <div className={styles.statusMetric}>
          <span>{copy.signalDecider.results}</span>
          <strong>{formatSignalDeciderResultCount(model, numberLocale)}</strong>
        </div>
        <div className={styles.statusMetric}>
          <span>{copy.signalDecider.date}</span>
          <strong>{model.marketDate ?? UNKNOWN_LABEL}</strong>
        </div>
        <div className={styles.statusMetric}>
          <span>{copy.signalDecider.actionMix}</span>
          <strong>{formatSignalDeciderActionMix(model, numberLocale)}</strong>
        </div>
      </div>

      {error ? <p className={styles.cardContext}>{copy.signalDecider.unavailable} {error}</p> : null}

      {model.previewItems.length > 0 ? (
        <div className={styles.signalDeciderPreviewList} role="list" aria-label={copy.signalDecider.preview}>
          {model.previewItems.map((item) => (
            <div
              key={item.id}
              className={styles.signalDeciderPreviewRow}
              role="listitem"
              aria-label={`${item.companyName ?? item.symbol} signal-decider feedback`}
            >
              <div className={styles.signalDeciderPreviewMain}>
                <strong>{item.companyName ?? item.symbol}</strong>
                <span>{item.symbol}</span>
              </div>
              <div className={styles.signalDeciderPreviewMeta}>
                <span className={`pill ${item.action === "buy" ? "positive" : item.action === "reject" ? "warning" : "neutral"}`}>
                  {item.actionLabel}
                </span>
                {item.qualityTag ? (
                  <span className={`pill ${getSignalDeciderQualityTone(item.qualityTag.tone)}`}>
                    {item.qualityTag.label}
                  </span>
                ) : null}
                <span className={styles.signalDeciderPreviewScore}>
                  {item.convictionScore !== null
                    ? `${item.convictionScore}/10`
                    : item.confidenceScore !== null
                      ? `${item.confidenceScore}/10`
                      : UNKNOWN_LABEL}
                </span>
              </div>
              {item.thesisSummary ? <p className="clamp-3">{item.thesisSummary}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>{copy.signalDecider.empty}</div>
      )}

      <Link href={model.detailHref} className={styles.signalDeciderMoreLink} aria-label={copy.signalDecider.openDetail}>
        {copy.signalDecider.viewDetail}
      </Link>
    </article>
  );
});

function getPortfolioMetricLabel(id: PortfolioMetricId, copy: DashboardLiveCopy) {
  if (id === "total-assets") return copy.portfolioState.metrics.totalAssets;
  if (id === "day-pnl") return copy.portfolioState.metrics.dayPnl;
  if (id === "unrealized-pnl") return copy.portfolioState.metrics.unrealizedPnl;
  return copy.portfolioState.metrics.cashBuyingPower;
}

function getPortfolioMetricClassName(metric: PortfolioMetricModel) {
  if (metric.tone === "positive") return styles.positive;
  if (metric.tone === "negative") return styles.negative;
  return "";
}

function formatPortfolioCount(count: number, singularLabel: string, pluralLabel: string, numberLocale: string) {
  const label = count === 1 ? singularLabel : pluralLabel;
  return `${count.toLocaleString(numberLocale)} ${label}`;
}

function humanizePortfolioStatus(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function getPortfolioStateStatusLabel(state: PortfolioSummaryState, summary: PortfolioSummaryDto | null, copy: DashboardLiveCopy) {
  if (state === "loading") return copy.portfolioState.statusLoading;
  if (state === "connected-empty") return copy.portfolioState.statusEmpty;
  if (
    state === "endpoint-pending" ||
    state === "invalid-response" ||
    state === "not-configured" ||
    state === "upstream-unavailable"
  ) {
    return copy.portfolioState.statusUnavailable;
  }
  if (state === "partial-data" || state === "stale-sync") return copy.portfolioState.statusDegraded;

  return summary?.sync?.status ? humanizePortfolioStatus(summary.sync.status) : copy.portfolioState.statusReady;
}

function getPortfolioStateStatusTone(state: PortfolioSummaryState) {
  if (state === "fully-synced") return "positive";
  if (
    state === "endpoint-pending" ||
    state === "invalid-response" ||
    state === "not-configured" ||
    state === "partial-data" ||
    state === "stale-sync" ||
    state === "upstream-unavailable"
  ) {
    return "warning";
  }
  return "neutral";
}

function getPortfolioStateMetricFallback(state: PortfolioSummaryState, copy: DashboardLiveCopy) {
  if (state === "loading") return copy.portfolioState.loading;
  if (
    state === "endpoint-pending" ||
    state === "invalid-response" ||
    state === "not-configured" ||
    state === "upstream-unavailable"
  ) {
    return copy.portfolioState.unavailableMetric;
  }
  if (state === "partial-data" || state === "stale-sync") return copy.portfolioState.degradedMetric;
  if (state === "connected-empty") return copy.portfolioState.emptyMetric;

  return copy.portfolioState.waiting;
}

type PortfolioStateCardProps = {
  copy: DashboardLiveCopy;
  error: string | null;
  loadState: "error" | "loading" | "success";
  numberLocale: string;
  summary: PortfolioSummaryDto | null;
};

const PortfolioStateCard = memo(function PortfolioStateCard({
  copy,
  error,
  loadState,
  numberLocale,
  summary,
}: PortfolioStateCardProps) {
  const state = resolvePortfolioSummaryState({
    error,
    loading: loadState === "loading",
    summary,
  });
  const metrics = buildPortfolioMetricModels(summary, getPortfolioStateMetricFallback(state, copy));
  const accounts = getPortfolioAccounts(summary);
  const holdings = getPortfolioHoldings(summary);
  const lastSyncedAt = getPortfolioLastSyncedAt(summary);
  const statusLabel = getPortfolioStateStatusLabel(state, summary, copy);
  const statusTone = getPortfolioStateStatusTone(state);
  const lastSyncedLabel = formatDisplayTimestamp(lastSyncedAt, copy.portfolioState.waiting);
  const syncMessage = getPortfolioSyncMessage(summary);
  const context =
    state === "loading"
      ? copy.portfolioState.loadingSummary
      : state === "endpoint-pending" ||
          state === "invalid-response" ||
          state === "not-configured" ||
          state === "upstream-unavailable"
        ? error ?? copy.portfolioState.unavailable
        : state === "partial-data" || state === "stale-sync"
          ? syncMessage ?? copy.portfolioState.degradedSummary
          : state === "connected-empty"
            ? copy.portfolioState.emptySummary
            : null;

  return (
    <article className={`${styles.integrityStat} ${styles.primaryInsightCard} ${styles.portfolioStateCard}`}>
      <ComponentTag label="dashboard.portfolio-state" api="/api/trading/portfolio/summary" />

      <div className={styles.sectionHeaderRow}>
        <div>
          <p className={styles.sectionEyebrow}>{copy.portfolioState.eyebrow}</p>
          <h2 className={styles.sectionTitle}>{copy.portfolioState.title}</h2>
        </div>
        <span className={`pill ${statusTone}`}>{statusLabel}</span>
      </div>

      <div className={styles.portfolioMetricGrid} aria-label={copy.portfolioState.summaryMetrics}>
        {metrics.map((metric) => (
          <div key={metric.id} className={styles.portfolioMetric} data-portfolio-metric={metric.id}>
            <span>{getPortfolioMetricLabel(metric.id, copy)}</span>
            <strong className={getPortfolioMetricClassName(metric)}>{metric.value}</strong>
          </div>
        ))}
      </div>

      <dl className={styles.insightStateList}>
        <div>
          <dt>{copy.portfolioState.accountState}</dt>
          <dd>{formatPortfolioCount(accounts.length, copy.portfolioState.account, copy.portfolioState.accounts, numberLocale)}</dd>
        </div>
        <div>
          <dt>{copy.portfolioState.holdings}</dt>
          <dd>
            {formatPortfolioCount(
              holdings.length,
              copy.portfolioState.holding,
              copy.portfolioState.holdingsPlural,
              numberLocale,
            )}
          </dd>
        </div>
        <div>
          <dt>{copy.portfolioState.lastSync}</dt>
          <dd>{lastSyncedLabel}</dd>
        </div>
      </dl>

      {context ? <p className={styles.cardContext}>{context}</p> : null}

      <Link href="/portfolio" className={styles.signalDeciderDetailLink} aria-label={copy.portfolioState.openDetail}>
        {copy.portfolioState.openDetail}
      </Link>
    </article>
  );
});

type MarketSnapshotTone = "positive" | "negative" | null;

function readMarketSnapshotNumber(...values: Array<number | string | null | undefined>) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string") continue;
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) continue;
    const numericValue = Number(normalized);
    if (Number.isFinite(numericValue)) return numericValue;
  }

  return null;
}

function getMarketSnapshotTone(value: number | null): MarketSnapshotTone {
  if (value === null || value === 0) return null;
  return value > 0 ? "positive" : "negative";
}

function getMarketSnapshotToneClassName(tone: MarketSnapshotTone) {
  if (tone === "positive") return styles.positive;
  if (tone === "negative") return styles.negative;
  return "";
}

function formatMarketSnapshotNumber(value: number | null, numberLocale: string, maximumFractionDigits = 2) {
  if (value === null) return UNKNOWN_LABEL;

  return value.toLocaleString(numberLocale, {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits,
  });
}

function formatSignedMarketSnapshotNumber(value: number | null, numberLocale: string, maximumFractionDigits = 2) {
  if (value === null) return UNKNOWN_LABEL;
  const prefix = value > 0 ? "+" : "";

  return `${prefix}${formatMarketSnapshotNumber(value, numberLocale, maximumFractionDigits)}`;
}

function formatSignedMarketSnapshotPercent(value: number | null, numberLocale: string) {
  if (value === null) return UNKNOWN_LABEL;

  return `${formatSignedMarketSnapshotNumber(value, numberLocale, 2)}%`;
}

function formatMarketSnapshotDelta(change: number | null, changeRate: number | null, numberLocale: string) {
  const changeLabel = formatSignedMarketSnapshotNumber(change, numberLocale, 2);
  const rateLabel = formatSignedMarketSnapshotPercent(changeRate, numberLocale);

  if (changeLabel === UNKNOWN_LABEL && rateLabel === UNKNOWN_LABEL) return UNKNOWN_LABEL;
  if (changeLabel === UNKNOWN_LABEL) return rateLabel;
  if (rateLabel === UNKNOWN_LABEL) return changeLabel;

  return `${changeLabel} (${rateLabel})`;
}

function compactMarketSnapshotAmount(value: number, numberLocale: string) {
  const absoluteValue = Math.abs(value);

  if (absoluteValue >= 1_000_000_000_000) {
    return `${(absoluteValue / 1_000_000_000_000).toLocaleString(numberLocale, {
      maximumFractionDigits: 1,
    })}T`;
  }

  if (absoluteValue >= 1_000_000_000) {
    return `${(absoluteValue / 1_000_000_000).toLocaleString(numberLocale, {
      maximumFractionDigits: 1,
    })}B`;
  }

  if (absoluteValue >= 1_000_000) {
    return `${(absoluteValue / 1_000_000).toLocaleString(numberLocale, {
      maximumFractionDigits: 1,
    })}M`;
  }

  return absoluteValue.toLocaleString(numberLocale, { maximumFractionDigits: 0 });
}

function formatSignedMarketSnapshotAmount(
  value: number | null,
  flow: MarketSnapshotFlowDto | null | undefined,
  numberLocale: string,
) {
  if (value === null) return UNKNOWN_LABEL;
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  const currency = flow?.currency?.trim().toUpperCase() ?? "";
  const unit = flow?.unit?.trim();
  const amountLabel = compactMarketSnapshotAmount(value, numberLocale);

  if (unit) return `${prefix}${amountLabel} ${unit}`;
  if (currency === "KRW") return `${prefix}₩${amountLabel}`;
  if (currency) return `${prefix}${amountLabel} ${currency}`;

  return `${prefix}${amountLabel}`;
}

function normalizeMarketSnapshotToken(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[\s_-]+/g, "") ?? "";
}

function getMarketSnapshotIndex(snapshot: MarketSnapshotResponseDto | null, key: "kospi" | "kosdaq") {
  const indices = snapshot?.indices;
  if (!indices) return null;

  if (Array.isArray(indices)) {
    return (
      indices.find((index) => {
        const candidates = [index.code, index.market, index.name].map(normalizeMarketSnapshotToken);
        return candidates.some((candidate) => candidate === key);
      }) ?? null
    );
  }

  return indices[key] ?? null;
}

function getMarketSnapshotFxRate(snapshot: MarketSnapshotResponseDto | null) {
  return snapshot?.fx?.usdkrw ?? snapshot?.fx?.usd_krw ?? null;
}

function getMarketSnapshotIndexLevel(index: MarketSnapshotIndexDto | null) {
  return readMarketSnapshotNumber(index?.level, index?.value, index?.close, index?.current);
}

function getMarketSnapshotIndexChange(index: MarketSnapshotIndexDto | null) {
  return readMarketSnapshotNumber(index?.change);
}

function getMarketSnapshotIndexChangeRate(index: MarketSnapshotIndexDto | null) {
  return readMarketSnapshotNumber(index?.change_rate, index?.change_pct, index?.change_percent);
}

function getMarketSnapshotFxValue(fxRate: MarketSnapshotFxRateDto | null) {
  return readMarketSnapshotNumber(fxRate?.rate, fxRate?.value);
}

function getMarketSnapshotFxChange(fxRate: MarketSnapshotFxRateDto | null) {
  return readMarketSnapshotNumber(fxRate?.change);
}

function getMarketSnapshotFxChangeRate(fxRate: MarketSnapshotFxRateDto | null) {
  return readMarketSnapshotNumber(fxRate?.change_rate, fxRate?.change_pct, fxRate?.change_percent);
}

function getMarketSnapshotFlowAmount(flow: MarketSnapshotFlowDto | null | undefined) {
  return readMarketSnapshotNumber(flow?.net_amount, flow?.net_buy_amount, flow?.amount, flow?.value);
}

function getMarketSnapshotFlowTone(flow: MarketSnapshotFlowDto | null | undefined): MarketSnapshotTone {
  const amount = getMarketSnapshotFlowAmount(flow);
  if (amount !== null) return getMarketSnapshotTone(amount);

  const direction = normalizeMarketSnapshotToken(flow?.direction);
  if (direction.includes("buy") || direction.includes("inflow") || direction.includes("positive")) return "positive";
  if (direction.includes("sell") || direction.includes("outflow") || direction.includes("negative")) return "negative";

  return null;
}

function formatMarketSnapshotFlow(flow: MarketSnapshotFlowDto | null | undefined, numberLocale: string) {
  const summary = flow?.summary?.trim();
  if (summary) return summary;

  const amount = getMarketSnapshotFlowAmount(flow);
  if (amount !== null) return formatSignedMarketSnapshotAmount(amount, flow, numberLocale);

  return flow?.direction?.trim() || UNKNOWN_LABEL;
}

function getMarketSnapshotSummaryLine(snapshot: MarketSnapshotResponseDto | null) {
  const summary = snapshot?.summary;
  if (!summary) return null;
  if (typeof summary === "string") return summary.trim() || null;

  const bias = summary.market_bias?.trim() ?? "";
  const breadth = (summary.breadth_summary ?? summary.breadth ?? summary.market_breadth ?? "").trim();
  const line = summary.line?.trim() ?? "";

  if (line) return line;
  if (bias && breadth && bias !== breadth) return `${bias} · ${breadth}`;

  return bias || breadth || null;
}

function getMarketSnapshotAsOf(
  snapshot: MarketSnapshotResponseDto | null,
  kospi: MarketSnapshotIndexDto | null,
  kosdaq: MarketSnapshotIndexDto | null,
  fxRate: MarketSnapshotFxRateDto | null,
) {
  return getFirstTextValue(
    snapshot?.as_of,
    snapshot?.market_date,
    kospi?.as_of,
    kospi?.market_date,
    kosdaq?.as_of,
    kosdaq?.market_date,
    fxRate?.as_of,
  );
}

type MarketOverviewCardProps = {
  copy: DashboardLiveCopy;
  marketSnapshot: MarketSnapshotResponseDto | null;
  marketSnapshotError: string | null;
  numberLocale: string;
};

const MarketOverviewCard = memo(function MarketOverviewCard({
  copy,
  marketSnapshot,
  marketSnapshotError,
  numberLocale,
}: MarketOverviewCardProps) {
  const snapshotPresentation = buildMarketSnapshotPresentation(copy, marketSnapshot, marketSnapshotError);
  const displaySnapshot = snapshotPresentation.displaySnapshot;
  const kospi = getMarketSnapshotIndex(displaySnapshot, "kospi");
  const kosdaq = getMarketSnapshotIndex(displaySnapshot, "kosdaq");
  const fxRate = getMarketSnapshotFxRate(displaySnapshot);
  const kospiLevel = getMarketSnapshotIndexLevel(kospi);
  const kospiChange = getMarketSnapshotIndexChange(kospi);
  const kospiChangeRate = getMarketSnapshotIndexChangeRate(kospi);
  const kosdaqLevel = getMarketSnapshotIndexLevel(kosdaq);
  const kosdaqChange = getMarketSnapshotIndexChange(kosdaq);
  const kosdaqChangeRate = getMarketSnapshotIndexChangeRate(kosdaq);
  const usdKrwRate = getMarketSnapshotFxValue(fxRate);
  const usdKrwChange = getMarketSnapshotFxChange(fxRate);
  const usdKrwChangeRate = getMarketSnapshotFxChangeRate(fxRate);
  const foreignFlow = displaySnapshot?.flows?.foreign ?? null;
  const institutionalFlow = displaySnapshot?.flows?.institutional ?? null;
  const summaryLine = getMarketSnapshotSummaryLine(displaySnapshot);
  const asOfLabel = getMarketSnapshotAsOf(displaySnapshot, kospi, kosdaq, fxRate);

  return (
    <article className={`${styles.integrityStat} ${styles.primaryInsightCard} ${styles.marketOverviewCard}`}>
      <ComponentTag
        label="dashboard.market-overview"
        api="/api/trading/market/snapshot"
      />

      <div className={styles.sectionHeaderRow}>
        <div>
          <p className={styles.sectionEyebrow}>{copy.marketOverview.eyebrow}</p>
          <h2 className={styles.sectionTitle}>{copy.marketOverview.title}</h2>
        </div>
        <span className={`pill ${snapshotPresentation.statusTone}`}>
          {snapshotPresentation.statusLabel}
        </span>
      </div>

      <div className={styles.marketIndexGrid} aria-label={copy.marketOverview.indexSummary}>
        <div className={styles.marketIndexCard}>
          <div className={styles.marketIndexHeader}>
            <span>{copy.marketOverview.kospi}</span>
            <span>{asOfLabel ? formatDisplayTimestamp(asOfLabel, asOfLabel) : UNKNOWN_LABEL}</span>
          </div>
          <strong>{formatMarketSnapshotNumber(kospiLevel, numberLocale, 2)}</strong>
          <span className={getMarketSnapshotToneClassName(getMarketSnapshotTone(kospiChange))}>
            {formatMarketSnapshotDelta(kospiChange, kospiChangeRate, numberLocale)}
          </span>
        </div>

        <div className={styles.marketIndexCard}>
          <div className={styles.marketIndexHeader}>
            <span>{copy.marketOverview.kosdaq}</span>
            <span>{asOfLabel ? formatDisplayTimestamp(asOfLabel, asOfLabel) : UNKNOWN_LABEL}</span>
          </div>
          <strong>{formatMarketSnapshotNumber(kosdaqLevel, numberLocale, 2)}</strong>
          <span className={getMarketSnapshotToneClassName(getMarketSnapshotTone(kosdaqChange))}>
            {formatMarketSnapshotDelta(kosdaqChange, kosdaqChangeRate, numberLocale)}
          </span>
        </div>
      </div>

      <div className={styles.marketContextGrid}>
        <div>
          <span>{copy.marketOverview.usdKrw}</span>
          <strong>{formatMarketSnapshotNumber(usdKrwRate, numberLocale, 2)}</strong>
          <small className={getMarketSnapshotToneClassName(getMarketSnapshotTone(usdKrwChange))}>
            {formatMarketSnapshotDelta(usdKrwChange, usdKrwChangeRate, numberLocale)}
          </small>
        </div>
        <div>
          <span>{copy.marketOverview.foreignFlow}</span>
          <strong className={getMarketSnapshotToneClassName(getMarketSnapshotFlowTone(foreignFlow))}>
            {formatMarketSnapshotFlow(foreignFlow, numberLocale)}
          </strong>
        </div>
        <div>
          <span>{copy.marketOverview.institutionalFlow}</span>
          <strong className={getMarketSnapshotToneClassName(getMarketSnapshotFlowTone(institutionalFlow))}>
            {formatMarketSnapshotFlow(institutionalFlow, numberLocale)}
          </strong>
        </div>
      </div>

      {summaryLine ? (
        <p className={styles.marketSummaryLine}>{summaryLine}</p>
      ) : (
        <p className={styles.cardContext}>{snapshotPresentation.fallbackContextLabel}</p>
      )}

      <div className={styles.cardActionRow}>
        <Link href="/markets" className={styles.signalDeciderDetailLink} aria-label={copy.marketOverview.openMarkets}>
          {copy.marketOverview.openMarkets}
        </Link>
      </div>
    </article>
  );
});

type ProcessMonitorTriggerProps = {
  copy: DashboardLiveCopy;
  model: ProcessMonitorModel;
  open: boolean;
  placement: "desktop" | "mobile";
  onOpen: () => void;
};

function getProcessMonitorCurrentLabel(model: ProcessMonitorModel, copy: DashboardLiveCopy) {
  if (model.currentGroupLabel && model.currentStepLabel) {
    return `${copy.processMonitor.current}: ${model.currentGroupLabel} · ${model.currentStepLabel}`;
  }

  return copy.processMonitor.allComplete;
}

const ProcessMonitorTrigger = memo(function ProcessMonitorTrigger({
  copy,
  model,
  open,
  placement,
  onOpen,
}: ProcessMonitorTriggerProps) {
  const currentLabel = getProcessMonitorCurrentLabel(model, copy);
  const showLoadingSummary = placement === "mobile" && model.status === "running";
  const summaryLabel = showLoadingSummary ? model.statusLabel : model.progressLabel;

  return (
    <button
      type="button"
      className={`${styles.processMonitorBar} ${
        placement === "desktop" ? styles.processMonitorDesktopBar : styles.processMonitorMobileBar
      }`}
      data-process-monitor-status={model.status}
      aria-label={`${copy.processMonitor.open}: ${currentLabel} (${summaryLabel})`}
      aria-busy={showLoadingSummary || undefined}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={PROCESS_MONITOR_DRAWER_ID}
      onClick={onOpen}
    >
      <span className={styles.processMonitorMain}>
        <span className={styles.processMonitorEyebrow}>{copy.processMonitor.drawerDescription}</span>
        <strong>{copy.processMonitor.compactTitle}</strong>
        <span className={styles.processMonitorCurrent}>{currentLabel}</span>
      </span>

      <span
        className={styles.processMonitorSummary}
        data-process-status={model.status}
        data-process-summary-mode={showLoadingSummary ? "loading" : "progress"}
      >
        <span>{model.statusLabel}</span>
        {showLoadingSummary ? (
          <strong className={styles.processMonitorLoadingValue} aria-label={model.statusLabel}>
            <span className={styles.processMonitorLoadingSpinner} aria-hidden="true" />
            <span className={styles.processMonitorLoadingText}>{model.statusLabel}</span>
          </strong>
        ) : (
          <strong>{model.progressLabel}</strong>
        )}
      </span>
    </button>
  );
});

type ProcessMonitorDrawerProps = {
  children?: ReactNode;
  copy: DashboardLiveCopy;
  patchDate: string | null;
  state: "open" | "closing";
  onClose: () => void;
};

const ProcessMonitorDrawer = memo(function ProcessMonitorDrawer({
  children,
  copy,
  patchDate,
  state,
  onClose,
}: ProcessMonitorDrawerProps) {
  return (
    <div className={styles.processMonitorDrawerBackdrop} data-process-monitor-state={state} onPointerDown={onClose}>
      <section
        id={PROCESS_MONITOR_DRAWER_ID}
        className={styles.processMonitorDrawer}
        data-process-monitor-state={state}
        role="dialog"
        aria-modal="true"
        aria-labelledby="process-monitor-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={styles.processMonitorDrawerCollapseButton}
          onClick={onClose}
          aria-label={copy.processMonitor.close}
          autoFocus
        >
          <span
            className={styles.processMonitorDrawerCollapseIcon}
            data-process-monitor-collapse-icon="down"
            aria-hidden="true"
          />
        </button>

        <div className={styles.dialogHeader}>
          <div>
            <p className={styles.sectionEyebrow}>{copy.processMonitor.drawerEyebrow}</p>
            <h2 id="process-monitor-title" className={styles.dialogTitle}>
              {copy.processMonitor.drawerTitle}
            </h2>
            <p className={styles.processMonitorDrawerDescription}>{copy.processMonitor.drawerDescription}</p>
          </div>
        </div>

        {children ? (
          <div className={`${styles.integrityGrid} ${styles.processMonitorDetailCards}`}>{children}</div>
        ) : null}
        {patchDate ? (
          <div className={styles.processMonitorPatchDate} aria-label={copy.processMonitor.patchDate}>
            <span>{copy.processMonitor.patchDate}</span>
            <strong>{patchDate}</strong>
          </div>
        ) : null}
      </section>
    </div>
  );
});

export function LiveDashboardClient({
  initialError = null,
  initialMarket,
  initialTracked,
  initialFreshness,
  initialFundamentalsStatus,
  initialPipelineStatus,
  initialMarketSnapshot,
  initialAgentFeedbackProgress,
  initialSignalDeciderFeedback,
  initialPortfolioSummary,
}: LiveDashboardClientProps) {
  const { locale, t } = useAppState();
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
    marketSnapshot,
    marketSnapshotError,
    marketRiskStatus,
    marketRiskStatusError,
    marketRiskStatusLoadState,
    marketError,
    piotroskiStatus,
    piotroskiStatusError,
    piotroskiStatusLoadState,
    pipelineStatus,
    portfolioSummary,
    portfolioSummaryError,
    portfolioSummaryLoadState,
    setAgentFeedbackProgress,
    setAgentFeedbackProgressError,
    signalDeciderFeedback,
    signalDeciderFeedbackError,
    tracked,
    trackedError,
  } = useLiveDashboardData({
    initialAgentFeedbackProgress,
    initialError,
    initialFreshness,
    initialFundamentalsStatus,
    initialMarket,
    initialMarketSnapshot,
    initialPipelineStatus,
    initialTracked,
    initialSignalDeciderFeedback,
    initialPortfolioSummary,
  });
  const [agentFeedbackStopPending, setAgentFeedbackStopPending] = useState(false);
  const [agentFeedbackStopError, setAgentFeedbackStopError] = useState<string | null>(null);
  const [agentFeedbackStopDialogOpen, setAgentFeedbackStopDialogOpen] = useState(false);
  const [fundamentalsUpdatesExpanded, setFundamentalsUpdatesExpanded] = useState(false);
  const [openFundamentalsFailureKey, setOpenFundamentalsFailureKey] = useState<string | null>(null);
  const [processMonitorDrawerOpen, setProcessMonitorDrawerOpen] = useState(false);
  const [processMonitorDrawerClosing, setProcessMonitorDrawerClosing] = useState(false);
  const processMonitorDrawerCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const fundamentalsActivityDate = getFirstTextValue(latestFundamentalsDate, eodStatusMarketDate);
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
  const fundamentalsUpdatedActivity = useMemo(
    () => getFundamentalsUpdatedActivityModel(fundamentalsStatus, fundamentalsActivityDate, numberLocale),
    [fundamentalsActivityDate, fundamentalsStatus, numberLocale],
  );
  const fundamentalsUpdatedSymbolsDetail = useMemo(
    () =>
      fundamentalsUpdatedActivity
        ? null
        : getFundamentalsUpdatedSymbolsDetail(
            fundamentalsStatus,
            fundamentalsActivityDate,
            copy,
            numberLocale,
            eodStatusMarketDate,
          ),
    [copy, eodStatusMarketDate, fundamentalsActivityDate, fundamentalsStatus, fundamentalsUpdatedActivity, numberLocale],
  );
  const fundamentalsPrimaryCountDetail = useMemo(
    () =>
      fundamentalsUpdatedActivity
        ? {
            label: getFundamentalsUpdatedCountLabel(
              getFundamentalsRunDate(getLatestFundamentalsRun(fundamentalsStatus)),
              eodStatusMarketDate,
              copy,
            ),
            value: fundamentalsUpdatedActivity.countLabel,
          }
        : {
            label: copy.operational.checked,
            value: formatEodSymbolCount(
              getFundamentalsCheckedCount(freshness, fundamentalsStatus, fundamentalsFreshnessWithPipelineStage),
              numberLocale,
            ),
          },
    [
      copy,
      eodStatusMarketDate,
      freshness,
      fundamentalsFreshnessWithPipelineStage,
      fundamentalsStatus,
      fundamentalsUpdatedActivity,
      numberLocale,
    ],
  );
  const eodStageCards = useMemo(() => {
    const fundamentalsStageCard = buildEodStageCard(
      "fundamentals",
      copy.stage.fundamentals,
      fundamentalsFreshnessWithPipelineStage,
      eodStatusMarketDate,
      latestFundamentalsDate,
      getPipelineStageResolvedStatusDate(fundamentalsPipelineStage, eodStatusMarketDate, latestFundamentalsDate),
      primaryLatestCycleDate,
      isBreakDay,
      fundamentalsPipelineStage,
      copy,
      numberLocale,
      fundamentalsPrimaryCountDetail,
      getFundamentalsStageStatusLabel,
    );

    const stageCards = [
      buildEodStageCard(
        "price",
        copy.stage.price,
        priceFreshnessStage,
        eodStatusMarketDate,
        priceLatestDate,
        getPipelineStageResolvedStatusDate(pricePipelineStage, eodStatusMarketDate, priceLatestDate),
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
        getPipelineStageResolvedStatusDate(technicalPipelineStage, eodStatusMarketDate, technicalLatestDate),
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
        getPipelineStageResolvedStatusDate(actionPipelineStage, eodStatusMarketDate, actionLatestDate),
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

    return maskFutureEodStageCardsWhilePipelineRunning(stageCards, pipelineStatus, numberLocale);
  }, [
    actionFreshnessStage,
    actionLatestDate,
    actionPipelineStage,
    copy,
    eodStatusMarketDate,
    fundamentalsFreshnessWithPipelineStage,
    fundamentalsPipelineStage,
    fundamentalsPrimaryCountDetail,
    fundamentalsUpdatedSymbolsDetail,
    isBreakDay,
    latestFundamentalsDate,
    numberLocale,
    primaryLatestCycleDate,
    pipelineStatus,
    priceFreshnessStage,
    priceLatestDate,
    pricePipelineStage,
    technicalFreshnessStage,
    technicalLatestDate,
    technicalPipelineStage,
  ]);
  useEffect(() => {
    setFundamentalsUpdatesExpanded(false);
  }, [fundamentalsUpdatedActivity?.key]);
  const toggleFundamentalsUpdatesExpanded = useCallback(() => {
    if (!fundamentalsUpdatedActivity?.canExpand) return;
    setFundamentalsUpdatesExpanded((current) => !current);
  }, [fundamentalsUpdatedActivity?.canExpand]);
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
  const signalDeciderFeedbackModel = useMemo(
    () =>
      buildSignalDeciderFeedbackSummary({
        feedback: signalDeciderFeedback,
        marketDate: rawAgentProgressDate,
        progress: displayedAgentFeedbackProgress,
      }),
    [displayedAgentFeedbackProgress, rawAgentProgressDate, signalDeciderFeedback],
  );
  const filteringCardModel = useMemo(
    () =>
      buildFilteringCardModel({
        agentFeedbackProgress: displayedAgentFeedbackProgress,
        copy,
        marketRiskStatus,
        marketRiskStatusError,
        marketRiskStatusLoadState,
        numberLocale,
        piotroskiStatus,
        piotroskiStatusError,
        piotroskiStatusLoadState,
        piotroskiMarketDate,
      }),
    [
      copy,
      displayedAgentFeedbackProgress,
      marketRiskStatus,
      marketRiskStatusError,
      marketRiskStatusLoadState,
      numberLocale,
      piotroskiStatus,
      piotroskiStatusError,
      piotroskiStatusLoadState,
      piotroskiMarketDate,
    ],
  );
  const processMonitorModel = useMemo(
    () =>
      buildProcessMonitorModel({
        agentRoleCards,
        copy,
        eodStageCards,
        filteringCardModel,
        numberLocale,
        patchDate: primaryLatestCycleDate,
      }),
    [agentRoleCards, copy, eodStageCards, filteringCardModel, numberLocale, primaryLatestCycleDate],
  );
  const marketBadgeLabel = market.is_open ? copy.marketOpen : copy.marketClosed;
  const coreUnavailable =
    market.state === "OFFLINE PLACEHOLDER" ||
    isOfflineTrackedPlaceholder(tracked) ||
    Boolean(marketError || trackedError);
  const error = trackedError ?? marketError;
  const fundamentalsDialogOpen =
    Boolean(fundamentalsFailureDetails) && openFundamentalsFailureKey === fundamentalsFailureDetails?.key;
  const processMonitorDrawerMounted = processMonitorDrawerOpen || processMonitorDrawerClosing;
  const processMonitorDrawerState = processMonitorDrawerOpen ? "open" : "closing";
  const dialogOpen = fundamentalsDialogOpen || agentFeedbackStopDialogOpen || processMonitorDrawerMounted;

  const openAgentFeedbackStopDialog = useCallback(() => {
    if (!isAgentFeedbackRunning) return;
    setAgentFeedbackStopError(null);
    setAgentFeedbackStopDialogOpen(true);
  }, [isAgentFeedbackRunning]);

  const openFundamentalsDetails = useCallback(() => {
    if (!fundamentalsFailureDetails) return;
    setOpenFundamentalsFailureKey(fundamentalsFailureDetails.key);
  }, [fundamentalsFailureDetails]);

  const openProcessMonitorDrawer = useCallback(() => {
    if (processMonitorDrawerCloseTimerRef.current) {
      clearTimeout(processMonitorDrawerCloseTimerRef.current);
      processMonitorDrawerCloseTimerRef.current = null;
    }

    setProcessMonitorDrawerClosing(false);
    setProcessMonitorDrawerOpen(true);
  }, []);

  const closeProcessMonitorDrawer = useCallback(() => {
    if (processMonitorDrawerCloseTimerRef.current) {
      clearTimeout(processMonitorDrawerCloseTimerRef.current);
    }

    setProcessMonitorDrawerOpen(false);
    setProcessMonitorDrawerClosing(true);
    processMonitorDrawerCloseTimerRef.current = setTimeout(() => {
      setProcessMonitorDrawerClosing(false);
      processMonitorDrawerCloseTimerRef.current = null;
    }, PROCESS_MONITOR_DRAWER_ANIMATION_MS);
  }, []);

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
    return () => {
      if (processMonitorDrawerCloseTimerRef.current) {
        clearTimeout(processMonitorDrawerCloseTimerRef.current);
      }
    };
  }, []);

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
        if (processMonitorDrawerMounted) {
          closeProcessMonitorDrawer();
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
  }, [
    agentFeedbackStopDialogOpen,
    agentFeedbackStopPending,
    dialogOpen,
    fundamentalsDialogOpen,
    closeProcessMonitorDrawer,
    processMonitorDrawerMounted,
  ]);

  return (
    <MobileAppChrome
      activeNav="dashboard"
      showDesktopRailLocaleSwitch={false}
      showMobileMetaRow={false}
      header={
        <>
          <div className={styles.appHeaderBrand}>
            <div className={styles.brandMark}>K</div>
            <div className={styles.brandCopy}>
              <strong className={styles.brandTitle}>{copy.brandTitle}</strong>
              <span
                className={styles.brandVersion}
                aria-label={t.mobileChrome.releaseVersion}
                data-testid="dashboard-header-release"
              >
                {RELEASE_VERSION_LABEL}
              </span>
            </div>
          </div>

          <div className={styles.appHeaderActions}>
            <span className={`pill ${styles.marketStatusPill} ${market.is_open ? "positive" : styles.marketStatusClosedPill}`}>
              {marketBadgeLabel}
            </span>
            <LanguageSwitchControl testId="dashboard-header-language-switch" />
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

        <section className={`${styles.panel} ${styles.insightPanel}`} id="dashboard-freshness">
          <ComponentTag
            label="dashboard.primary-insights"
            api="/api/trading/agent-context/feedback + /api/trading/portfolio/summary + /api/trading/market/status + /api/trading/eod/piotroski-filter-results + /api/trading/eod/market-risk-filters + grouped process monitor data"
          />

          <div className={styles.panelHeader}>
            <div>
              <p className={styles.sectionEyebrow}>{copy.insights.eyebrow}</p>
              <h1 className={styles.heroTitle}>{copy.insights.title}</h1>
            </div>
          </div>

          <ProcessMonitorTrigger
            copy={copy}
            model={processMonitorModel}
            open={processMonitorDrawerOpen}
            placement="desktop"
            onOpen={openProcessMonitorDrawer}
          />

          <div className={styles.primaryInsightGrid}>
            <SignalDeciderFeedbackCard
              copy={copy}
              error={signalDeciderFeedbackError}
              model={signalDeciderFeedbackModel}
              numberLocale={numberLocale}
            />

            <PortfolioStateCard
              copy={copy}
              error={portfolioSummaryError}
              loadState={portfolioSummaryLoadState}
              numberLocale={numberLocale}
              summary={portfolioSummary}
            />

            <MarketOverviewCard
              copy={copy}
              marketSnapshot={marketSnapshot}
              marketSnapshotError={marketSnapshotError}
              numberLocale={numberLocale}
            />
          </div>
        </section>

      </div>

      <ProcessMonitorTrigger
        copy={copy}
        model={processMonitorModel}
        open={processMonitorDrawerOpen}
        placement="mobile"
        onOpen={openProcessMonitorDrawer}
      />

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

      {processMonitorDrawerMounted
        ? createPortal(
            <ProcessMonitorDrawer
              copy={copy}
              patchDate={processMonitorModel.patchDate}
              state={processMonitorDrawerState}
              onClose={closeProcessMonitorDrawer}
            >
              <EodStatusCard
                copy={copy}
                eodStageCards={eodStageCards}
                fundamentalsDialogOpen={fundamentalsDialogOpen}
                fundamentalsUpdatedActivity={fundamentalsUpdatedActivity}
                fundamentalsUpdatesExpanded={fundamentalsUpdatesExpanded}
                fundamentalsFailureDetails={fundamentalsFailureDetails}
                onOpenFundamentalsDetails={openFundamentalsDetails}
                onToggleFundamentalsUpdatesExpanded={toggleFundamentalsUpdatesExpanded}
              />

              <FilteringCard
                copy={copy}
                filteringCardModel={filteringCardModel}
                patchDate={processMonitorModel.patchDate}
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
            </ProcessMonitorDrawer>,
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
