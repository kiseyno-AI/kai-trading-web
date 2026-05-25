"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { ComponentTag } from "@/components/dev/component-tag";
import { useIncrementalList } from "@/components/dashboard/use-incremental-list";
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
import type {
  DailyPipelineStageModel,
  DailyPipelineStageStatus,
  DailyPipelineTimelineModel,
} from "@/lib/eod-pipeline-status";
import {
  buildSignalDeciderFeedbackSummary,
  selectSignalDeciderDashboardFeedback,
} from "@/lib/signal-decider-feedback";
import { writeSignalDeciderFeedbackCache } from "@/lib/signal-decider-feedback-cache";
import { resolvePortfolioSummaryState } from "@/features/portfolio/portfolio-display";
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
  buildDashboardDeciderOverviewModel,
  buildDashboardPortfolioOverviewModel,
  type DashboardDeciderOverviewModel,
  type DashboardPortfolioOverviewModel,
  type DashboardPortfolioTradeRow,
} from "@/features/dashboard/dashboard-overview-cards";
import {
  UNKNOWN_LABEL,
  buildAgentRoleCards,
  buildEodStageCard,
  buildFilteringCardModel,
  buildProcessMonitorModel,
  buildScoringCardModel,
  formatEodSymbolCount,
  getAgentProgressStatusLabel,
  getAgentProgressStatusLabels,
  getAgentRoleStatusLabels,
  getDashboardLoadErrorMessage,
  getFirstTextValue,
  getFundamentalsCheckedCount,
  getDailyProcessDependencyWaitState,
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
  markAgentFeedbackProgressStopped,
  maskAgentRoleCardsAsWaiting,
  maskFilteringCardModelAsWaiting,
  maskFutureEodStageCardsWhilePipelineRunning,
  mergeRunningPipelineStage,
  resolveFundamentalsPollingPresentation,
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
  ProcessMonitorStatus,
  ScoringCardModel,
  ScoringStageModel,
} from "@/features/dashboard/live-dashboard-types";
import { useLiveDashboardData } from "@/features/dashboard/use-live-dashboard-data";
import type {
  AgentContextCoreControlRequestDto,
  AgentContextCoreControlResponseDto,
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
  idScope: string;
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
  idScope,
  onOpenFundamentalsDetails,
  onToggleFundamentalsUpdatesExpanded,
}: EodStatusCardProps) {
  const fundamentalsUpdatedCompanyListId = `${idScope}-fundamentals-updated-company-list`;

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
                          id={fundamentalsUpdatedCompanyListId}
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
                            aria-controls={fundamentalsUpdatedCompanyListId}
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

type ScoringCardProps = {
  copy: DashboardLiveCopy;
  patchDate: string | null;
  scoringCardModel: ScoringCardModel;
};

function getScoringStatusIconClassName(status: ScoringStageModel["status"]) {
  if (status === "completed") return styles.syncedStatusIcon;
  if (status === "loading") return styles.filterLoadingStatusIcon;
  if (status === "needs-review") return styles.filterNeedsReviewStatusIcon;
  return styles.filterPendingStatusIcon;
}

const ScoringCard = memo(function ScoringCard({
  copy,
  patchDate,
  scoringCardModel,
}: ScoringCardProps) {
  return (
    <article className={`${styles.integrityStat} ${styles.scoringCard}`}>
      <div className={styles.sectionHeaderRow}>
        <div>
          <p className={styles.sectionEyebrow}>{copy.scoring.eyebrow}</p>
          <h2 className={styles.sectionTitle}>{copy.scoring.title}</h2>
        </div>
        <Link
          href="/markets/factors"
          className={styles.sectionLink}
          aria-label={copy.scoring.openFactorScreening}
        >
          {copy.operational.more}
        </Link>
      </div>

      <div className={styles.filterStageList}>
        {scoringCardModel.stages.map((stage) => {
          const displayMarketDateContext = getExceptionDateLabel(stage.displayMarketDate, patchDate);
          const statusIconClassName = getScoringStatusIconClassName(stage.status);

          return (
            <section
              key={stage.key}
              className={`${styles.filterStageSection} ${styles.scoringStageSection}`}
              data-scoring-stage={stage.key}
              data-scoring-status={stage.status}
              aria-label={`${stage.label} status`}
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
                  data-scoring-status-badge={stage.status}
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
            const roleContent = (
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
            );

            return (
              <div
                key={role.role}
                className={styles.agentRoleRow}
                data-role-status={role.status}
                role="listitem"
                aria-label={`${role.label} ${agentRoleStatusLabels[role.status]}`}
              >
                {role.detailHref ? (
                  <Link href={role.detailHref} className={styles.agentRoleLink}>
                    {roleContent}
                  </Link>
                ) : (
                  roleContent
                )}
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

type OperationalIntegrityCardsProps = {
  agentFeedbackHeaderStatusLabel: string;
  agentFeedbackStatusTone: "positive" | "neutral" | "warning";
  agentFeedbackStopDialogOpen: boolean;
  agentProgressDateContext: string | null;
  agentRoleCards: AgentRoleCard[];
  agentRoleStatusLabels: AgentRoleStatusLabels;
  copy: DashboardLiveCopy;
  eodCardIdScope: string;
  eodStageCards: readonly EodStageCard[];
  filteringCardModel: FilteringCardModel;
  fundamentalsDialogOpen: boolean;
  fundamentalsFailureDetails: FundamentalsFailureDetails | null;
  fundamentalsUpdatedActivity: FundamentalsUpdatedActivityModel | null;
  fundamentalsUpdatesExpanded: boolean;
  isAgentFeedbackRunning: boolean;
  patchDate: string | null;
  scoringCardModel: ScoringCardModel;
  onOpenAgentFeedbackStopDialog: () => void;
  onOpenFundamentalsDetails: () => void;
  onToggleFundamentalsUpdatesExpanded: () => void;
};

const OperationalIntegrityCards = memo(function OperationalIntegrityCards({
  agentFeedbackHeaderStatusLabel,
  agentFeedbackStatusTone,
  agentFeedbackStopDialogOpen,
  agentProgressDateContext,
  agentRoleCards,
  agentRoleStatusLabels,
  copy,
  eodCardIdScope,
  eodStageCards,
  filteringCardModel,
  fundamentalsDialogOpen,
  fundamentalsFailureDetails,
  fundamentalsUpdatedActivity,
  fundamentalsUpdatesExpanded,
  isAgentFeedbackRunning,
  patchDate,
  scoringCardModel,
  onOpenAgentFeedbackStopDialog,
  onOpenFundamentalsDetails,
  onToggleFundamentalsUpdatesExpanded,
}: OperationalIntegrityCardsProps) {
  return (
    <>
      <EodStatusCard
        copy={copy}
        eodStageCards={eodStageCards}
        fundamentalsDialogOpen={fundamentalsDialogOpen}
        fundamentalsUpdatedActivity={fundamentalsUpdatedActivity}
        fundamentalsUpdatesExpanded={fundamentalsUpdatesExpanded}
        fundamentalsFailureDetails={fundamentalsFailureDetails}
        idScope={eodCardIdScope}
        onOpenFundamentalsDetails={onOpenFundamentalsDetails}
        onToggleFundamentalsUpdatesExpanded={onToggleFundamentalsUpdatesExpanded}
      />

      <FilteringCard
        copy={copy}
        filteringCardModel={filteringCardModel}
        patchDate={patchDate}
      />

      <ScoringCard
        copy={copy}
        patchDate={patchDate}
        scoringCardModel={scoringCardModel}
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
        onOpenAgentFeedbackStopDialog={onOpenAgentFeedbackStopDialog}
      />
    </>
  );
});

function getOverviewValueClassName(tone: "positive" | "negative" | "neutral" | "warning") {
  if (tone === "positive") return styles.positive;
  if (tone === "negative") return styles.negative;
  if (tone === "warning") return styles.warningText;
  return "";
}

function getMoreRowsLabel(copy: DashboardLiveCopy, remainingCount: number, numberLocale: string) {
  return `${copy.dashboardOverview.moreRows} (${remainingCount.toLocaleString(numberLocale)})`;
}

function IncrementalListMoreButton({
  ariaControls,
  copy,
  numberLocale,
  remainingCount,
  testId,
  onClick,
}: {
  ariaControls: string;
  copy: DashboardLiveCopy;
  numberLocale: string;
  remainingCount: number;
  testId: string;
  onClick: () => void;
}) {
  const label = getMoreRowsLabel(copy, remainingCount, numberLocale);

  return (
    <button
      type="button"
      className={styles.incrementalListMoreButton}
      aria-controls={ariaControls}
      aria-label={label}
      data-testid={testId}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

type DeciderRecommendationCardProps = {
  copy: DashboardLiveCopy;
  detailHref: string;
  feedbackStatus: string;
  model: DashboardDeciderOverviewModel;
  numberLocale: string;
};

const DeciderRecommendationCard = memo(function DeciderRecommendationCard({
  copy,
  detailHref,
  feedbackStatus,
  model,
  numberLocale,
}: DeciderRecommendationCardProps) {
  const listId = "dashboard-decider-recommendations-list";
  const incrementalRows = useIncrementalList(model.rows);

  return (
    <article
      className={`${styles.integrityStat} ${styles.primaryInsightCard} ${styles.signalDeciderCard}`}
      data-decider-overview-mode={model.mode}
      data-signal-decider-status={feedbackStatus}
    >
      <ComponentTag
        label="dashboard.decider-recommendations"
        api="/api/trading/execution/runtime/monitored-symbols + /api/trading/execution/runtime/daily-board + /api/trading/quotes/tracked"
      />

      <div className={styles.sectionHeaderRow}>
        <div>
          <p className={styles.sectionEyebrow}>{copy.dashboardOverview.deciderEyebrow}</p>
          <h2 className={styles.sectionTitle}>{copy.dashboardOverview.deciderTitle}</h2>
          {model.contextLabel ? <p className={styles.cardContext}>{model.contextLabel}</p> : null}
        </div>
        <span className={`pill ${model.statusTone}`}>{model.statusLabel}</span>
      </div>

      {model.rows.length > 0 ? (
        <>
          <div
            id={listId}
            className={styles.overviewSymbolList}
            role="list"
            aria-label={copy.dashboardOverview.deciderTitle}
            data-testid="dashboard-decider-list"
          >
            {incrementalRows.visibleItems.map((row) => (
              <div
                key={row.key}
                className={styles.overviewSymbolRow}
                role="listitem"
                data-testid="dashboard-decider-row"
              >
                <div className={styles.overviewSymbolIdentity}>
                  <strong>{row.nameLabel}</strong>
                  <span>
                    {row.symbol}
                    {row.marketLabel ? ` · ${row.marketLabel}` : ""}
                  </span>
                </div>
                {row.compactPriceLine ? (
                  <p className={styles.overviewCompactPriceLine} title={row.compactPriceLine}>
                    {row.compactPriceLine}
                  </p>
                ) : null}
                <dl className={styles.overviewValueGrid}>
                  {row.prices.map((price) => (
                    <div key={price.key}>
                      <dt>{price.label}</dt>
                      <dd>{price.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          {incrementalRows.canRevealMore ? (
            <IncrementalListMoreButton
              ariaControls={listId}
              copy={copy}
              numberLocale={numberLocale}
              remainingCount={incrementalRows.remainingCount}
              testId="dashboard-decider-more"
              onClick={incrementalRows.revealMore}
            />
          ) : null}
        </>
      ) : (
        <div className={styles.emptyState}>{model.emptyLabel}</div>
      )}

      <RuntimeDiagnosticsHint copy={copy} diagnostics={model.diagnostics} />

      <Link href={detailHref} className={styles.signalDeciderMoreLink} aria-label={copy.signalDecider.openDetail}>
        {copy.signalDecider.viewDetail}
      </Link>
    </article>
  );
});

function RuntimeDiagnosticsHint({
  copy,
  diagnostics,
}: {
  copy: DashboardLiveCopy;
  diagnostics: readonly string[];
}) {
  if (diagnostics.length === 0) return null;

  const diagnosticText = diagnostics.join("\n");

  return (
    <span className={styles.runtimeDiagnosticHint} data-diagnostic-detail={diagnosticText} title={diagnosticText}>
      {copy.dashboardOverview.diagnosticsAvailable}
    </span>
  );
}

function TradeRowList({
  copy,
  emptyLabel,
  label,
  listId,
  numberLocale,
  rows,
  testId,
}: {
  copy: DashboardLiveCopy;
  emptyLabel: string | null;
  label: string;
  listId: string;
  numberLocale: string;
  rows: DashboardPortfolioTradeRow[];
  testId: string;
}) {
  const incrementalRows = useIncrementalList(rows);

  if (rows.length === 0 && !emptyLabel) return null;

  return (
    <section className={styles.tradeListSection} aria-label={label}>
      <h3>{label}</h3>
      {rows.length > 0 ? (
        <>
          <div
            id={listId}
            className={styles.tradeRowList}
            role="list"
            aria-label={label}
            data-testid={`${testId}-list`}
          >
            {incrementalRows.visibleItems.map((row) => (
              <div key={row.key} className={styles.tradeRow} role="listitem" data-testid={`${testId}-row`}>
                <div className={styles.overviewSymbolIdentity}>
                  <strong>{row.nameLabel}</strong>
                  <span>
                    {row.symbol}
                    {row.marketLabel ? ` · ${row.marketLabel}` : ""}
                  </span>
                </div>
                <dl className={styles.tradeValueList}>
                  {row.values.map((value) => (
                    <div key={value.key}>
                      <dt>{value.label}</dt>
                      <dd>{value.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          {incrementalRows.canRevealMore ? (
            <IncrementalListMoreButton
              ariaControls={listId}
              copy={copy}
              numberLocale={numberLocale}
              remainingCount={incrementalRows.remainingCount}
              testId={`${testId}-more`}
              onClick={incrementalRows.revealMore}
            />
          ) : null}
        </>
      ) : emptyLabel ? (
        <div className={styles.emptyState}>{emptyLabel}</div>
      ) : null}
    </section>
  );
}

type PortfolioStatusCardProps = {
  copy: DashboardLiveCopy;
  model: DashboardPortfolioOverviewModel;
  numberLocale: string;
};

const PortfolioStatusCard = memo(function PortfolioStatusCard({
  copy,
  model,
  numberLocale,
}: PortfolioStatusCardProps) {
  return (
    <article className={`${styles.integrityStat} ${styles.primaryInsightCard} ${styles.portfolioStateCard}`}>
      <ComponentTag
        label="dashboard.portfolio-status"
        api="/api/trading/portfolio/summary + /api/trading/execution/runtime/status + /api/trading/execution/runtime/daily-board"
      />

      <div className={styles.sectionHeaderRow}>
        <div>
          <p className={styles.sectionEyebrow}>{copy.dashboardOverview.portfolioEyebrow}</p>
          <h2 className={styles.sectionTitle}>{copy.dashboardOverview.portfolioTitle}</h2>
        </div>
        <span className={`pill ${model.statusTone}`}>{model.statusLabel}</span>
      </div>

      <div className={styles.portfolioMetricGrid} aria-label={copy.portfolioState.summaryMetrics}>
        {model.metrics.map((metric) => (
          <div key={metric.key} className={styles.portfolioMetric} data-portfolio-metric={metric.key}>
            <span>{metric.label}</span>
            <strong className={getOverviewValueClassName(metric.tone)}>{metric.value}</strong>
          </div>
        ))}
      </div>

      {model.contextLabel ? <p className={styles.cardContext}>{model.contextLabel}</p> : null}
      {model.executionBoardStateLabel ? <div className={styles.emptyState}>{model.executionBoardStateLabel}</div> : null}
      <RuntimeDiagnosticsHint copy={copy} diagnostics={model.diagnostics} />

      <TradeRowList
        copy={copy}
        emptyLabel={model.buyStateLabel}
        label={copy.dashboardOverview.todayBought}
        listId="dashboard-today-bought-list"
        numberLocale={numberLocale}
        rows={model.buyRows}
        testId="dashboard-today-bought"
      />
      <TradeRowList
        copy={copy}
        emptyLabel={model.sellStateLabel}
        label={copy.dashboardOverview.todaySold}
        listId="dashboard-today-sold-list"
        numberLocale={numberLocale}
        rows={model.sellRows}
        testId="dashboard-today-sold"
      />

      <Link href="/portfolio" className={styles.signalDeciderDetailLink} aria-label={copy.portfolioState.openDetail}>
        {copy.portfolioState.openDetail}
      </Link>
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

type ProcessMonitorTriggerSummary = {
  progressLabel: string;
  source: ProcessMonitorModel["summarySource"];
  status: ProcessMonitorStatus;
  statusLabel: string;
};

function hasIncompleteCanonicalPipeline(pipeline: DailyPipelineTimelineModel) {
  return (
    pipeline.completedCount < pipeline.totalCount ||
    pipeline.stages.some((stage) => stage.status !== "completed" && stage.status !== "skipped")
  );
}

function getCanonicalPipelineProcessMonitorStatus(pipeline: DailyPipelineTimelineModel): ProcessMonitorStatus {
  if (pipeline.status === "failed") return "error";
  if (pipeline.status === "blocked" || pipeline.status === "partial") return "partial";
  if (pipeline.status === "running") return "running";
  if (pipeline.status === "pending") {
    return pipeline.completedCount > 0 && pipeline.completedCount < pipeline.totalCount ? "partial" : "pending";
  }
  if (pipeline.status === "completed" && hasIncompleteCanonicalPipeline(pipeline)) return "partial";
  return "completed";
}

function getProcessMonitorTriggerSummary(
  model: ProcessMonitorModel,
  copy: DashboardLiveCopy,
): ProcessMonitorTriggerSummary {
  if (model.pipeline.hasLiveStatus) {
    const status = getCanonicalPipelineProcessMonitorStatus(model.pipeline);
    return {
      progressLabel: model.pipeline.progressLabel,
      source: "canonical-pipeline",
      status,
      statusLabel: copy.processMonitor.statuses[status],
    };
  }

  return {
    progressLabel: model.progressLabel,
    source: model.summarySource,
    status: model.status,
    statusLabel: model.statusLabel,
  };
}

function getProcessMonitorCurrentLabel(
  model: ProcessMonitorModel,
  copy: DashboardLiveCopy,
  triggerSummary: ProcessMonitorTriggerSummary,
) {
  if (triggerSummary.source === "canonical-pipeline") {
    if (model.pipeline.currentStage) {
      return `${copy.processMonitor.current}: ${model.pipeline.currentStage.label}`;
    }

    if (triggerSummary.status === "completed") {
      return `${copy.processMonitor.fullPipelineEyebrow}: ${triggerSummary.statusLabel}`;
    }

    return `${copy.processMonitor.current}: ${copy.processMonitor.noCurrentStage}`;
  }

  if (model.currentGroupLabel && model.currentStepLabel) {
    return `${copy.processMonitor.current}: ${model.currentGroupLabel} · ${model.currentStepLabel}`;
  }

  return triggerSummary.status === "completed"
    ? copy.processMonitor.allComplete
    : `${copy.processMonitor.current}: ${triggerSummary.statusLabel}`;
}

const ProcessMonitorTrigger = memo(function ProcessMonitorTrigger({
  copy,
  model,
  open,
  placement,
  onOpen,
}: ProcessMonitorTriggerProps) {
  const triggerSummary = getProcessMonitorTriggerSummary(model, copy);
  const currentLabel = getProcessMonitorCurrentLabel(model, copy, triggerSummary);
  const showLoadingSummary = placement === "mobile" && triggerSummary.status === "running";
  const summaryLabel = showLoadingSummary ? triggerSummary.statusLabel : triggerSummary.progressLabel;

  return (
    <button
      type="button"
      className={`${styles.processMonitorBar} ${
        placement === "desktop" ? styles.processMonitorDesktopBar : styles.processMonitorMobileBar
      }`}
      data-process-monitor-status={triggerSummary.status}
      data-process-summary-source={triggerSummary.source}
      aria-label={`${copy.processMonitor.open}: ${currentLabel} (${summaryLabel})`}
      aria-busy={showLoadingSummary || undefined}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={PROCESS_MONITOR_DRAWER_ID}
      onClick={onOpen}
    >
      <span className={styles.processMonitorMain}>
        <strong>{copy.processMonitor.compactTitle}</strong>
        <span className={styles.processMonitorCurrent}>{currentLabel}</span>
      </span>

      <span
        className={styles.processMonitorSummary}
        data-process-status={triggerSummary.status}
        data-process-summary-mode={showLoadingSummary ? "loading" : "progress"}
      >
        {showLoadingSummary ? null : <span>{triggerSummary.statusLabel}</span>}
        {showLoadingSummary ? (
          <strong className={styles.processMonitorLoadingValue} aria-label={triggerSummary.statusLabel}>
            <span className={styles.processMonitorLoadingSpinner} aria-hidden="true" />
            <span className={styles.processMonitorLoadingText}>{triggerSummary.statusLabel}</span>
          </strong>
        ) : (
          <strong>{triggerSummary.progressLabel}</strong>
        )}
      </span>
    </button>
  );
});

function getPipelineStatusLabel(status: DailyPipelineStageStatus, copy: DashboardLiveCopy) {
  return copy.processMonitor.stageStatuses[status] ?? status;
}

function getPipelineStatusTone(status: DailyPipelineStageStatus) {
  if (status === "completed" || status === "skipped") return "positive";
  if (status === "running") return "neutral";
  if (status === "blocked" || status === "failed" || status === "partial") return "warning";
  return "neutral";
}

function formatPipelineDependencyList(
  dependencies: DailyPipelineStageModel["dependencies"],
  copy: DashboardLiveCopy,
) {
  if (dependencies.length === 0) return null;

  return dependencies
    .map((dependency) => {
      const statusLabel = dependency.status ? getPipelineStatusLabel(dependency.status, copy).toLowerCase() : null;
      return statusLabel ? `${dependency.label} (${statusLabel})` : dependency.label;
    })
    .join(", ");
}

function formatPipelineRunIds(runIds: DailyPipelineStageModel["sourceRunIds"]) {
  if (runIds.length === 0) return null;
  return runIds.map((runId) => `${runId.key}: ${runId.value}`).join(", ");
}

type DailyPipelineTimelineProps = {
  copy: DashboardLiveCopy;
  pipeline: DailyPipelineTimelineModel;
};

const DailyPipelineTimeline = memo(function DailyPipelineTimeline({
  copy,
  pipeline,
}: DailyPipelineTimelineProps) {
  const currentStage = pipeline.currentStage;
  const currentStatus = currentStage?.status ?? pipeline.status;
  const currentStatusLabel = currentStage
    ? getPipelineStatusLabel(currentStage.status, copy)
    : pipeline.hasLiveStatus
      ? getPipelineStatusLabel(pipeline.status, copy)
      : copy.processMonitor.noCurrentStage;
  const currentReason = currentStage?.reason ?? copy.processMonitor.noCurrentStageDetail;

  return (
    <section className={styles.pipelineTimelinePanel} aria-label={copy.processMonitor.fullPipelineTitle}>
      <div className={styles.pipelineTimelineHeader}>
        <div>
          <p className={styles.sectionEyebrow}>{copy.processMonitor.fullPipelineEyebrow}</p>
          <h3 className={styles.pipelineTimelineTitle}>{copy.processMonitor.currentStageTitle}</h3>
          <p className={styles.pipelineTimelineCurrent}>
            {currentStage ? currentStage.label : copy.processMonitor.noCurrentStage}
          </p>
        </div>
        <span
          className={`pill ${getPipelineStatusTone(currentStatus)}`}
          data-pipeline-status-badge={currentStatus}
        >
          {currentStatusLabel}
        </span>
      </div>

      <div className={styles.pipelineSummaryGrid}>
        <div>
          <span>{copy.processMonitor.progress}</span>
          <strong>{pipeline.progressLabel}</strong>
        </div>
        <div>
          <span>{copy.operational.marketDate}</span>
          <strong>{pipeline.marketDate ?? UNKNOWN_LABEL}</strong>
        </div>
        <div>
          <span>{copy.processMonitor.progressSource}</span>
          <strong>{currentStage?.progressSourceLabel ?? copy.processMonitor.sourceLabels.fallbackInference}</strong>
        </div>
      </div>

      <p className={styles.pipelineCurrentReason}>{currentReason}</p>

      <div className={styles.pipelineTimelineList} role="list" aria-label={copy.processMonitor.stageOrder}>
        {pipeline.stages.map((stage) => {
          const dependencyList = formatPipelineDependencyList(stage.dependencies, copy);
          const blockingList = formatPipelineDependencyList(stage.blockingDependencies, copy);
          const failedBlockingList = formatPipelineDependencyList(stage.failedBlockingDependencies, copy);
          const runIds = formatPipelineRunIds(stage.sourceRunIds);
          const statusLabel = getPipelineStatusLabel(stage.status, copy);

          return (
            <section
              key={stage.key}
              className={styles.pipelineStageRow}
              data-pipeline-stage={stage.key}
              data-pipeline-stage-status={stage.status}
              role="listitem"
              aria-label={`${stage.order}. ${stage.label} ${statusLabel}`}
            >
              <div className={styles.pipelineStageHeader}>
                <span className={styles.pipelineStageIndex}>{stage.order}</span>
                <div className={styles.pipelineStageTitleBlock}>
                  <strong>{stage.label}</strong>
                  <span>{stage.key}</span>
                </div>
                <span
                  className={`pill ${getPipelineStatusTone(stage.status)}`}
                  data-pipeline-status-badge={stage.status}
                >
                  {statusLabel}
                </span>
              </div>

              <div
                className={styles.pipelineProgressTrack}
                role="progressbar"
                aria-label={`${stage.label} ${copy.processMonitor.progress}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={stage.progressPercent}
                aria-valuetext={stage.progressLabel}
              >
                <i style={{ width: `${stage.progressPercent}%` }} />
              </div>

              <dl className={styles.pipelineStageMeta}>
                <div>
                  <dt>{copy.processMonitor.progress}</dt>
                  <dd>{stage.progressLabel}</dd>
                </div>
                <div>
                  <dt>{copy.processMonitor.progressSource}</dt>
                  <dd>{stage.progressSourceLabel}</dd>
                </div>
                {dependencyList ? (
                  <div>
                    <dt>{copy.processMonitor.dependencies}</dt>
                    <dd>{dependencyList}</dd>
                  </div>
                ) : null}
                {blockingList ? (
                  <div>
                    <dt>{copy.processMonitor.blockingDependencies}</dt>
                    <dd>{blockingList}</dd>
                  </div>
                ) : null}
                {failedBlockingList ? (
                  <div>
                    <dt>{copy.processMonitor.failedBlockingDependencies}</dt>
                    <dd>{failedBlockingList}</dd>
                  </div>
                ) : null}
                {runIds ? (
                  <div>
                    <dt>{copy.processMonitor.sourceRuns}</dt>
                    <dd>{runIds}</dd>
                  </div>
                ) : null}
                {stage.startedAt ? (
                  <div>
                    <dt>{copy.processMonitor.started}</dt>
                    <dd>{formatDisplayTimestamp(stage.startedAt, stage.startedAt)}</dd>
                  </div>
                ) : null}
                {stage.updatedAt ? (
                  <div>
                    <dt>{copy.processMonitor.updated}</dt>
                    <dd>{formatDisplayTimestamp(stage.updatedAt, stage.updatedAt)}</dd>
                  </div>
                ) : null}
                {stage.completedAt ? (
                  <div>
                    <dt>{copy.processMonitor.completedAt}</dt>
                    <dd>{formatDisplayTimestamp(stage.completedAt, stage.completedAt)}</dd>
                  </div>
                ) : null}
              </dl>

              <p className={styles.pipelineStageReason}>{stage.reason}</p>

              {stage.inspectLinks.length > 0 ? (
                <div className={styles.pipelineInspectLinks} aria-label={copy.processMonitor.inspectLinks}>
                  {stage.inspectLinks.map((link) => (
                    <Link key={`${stage.key}:${link.href}`} href={link.href}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </section>
  );
});

type ProcessMonitorDrawerProps = {
  children?: ReactNode;
  copy: DashboardLiveCopy;
  model: ProcessMonitorModel;
  patchDate: string | null;
  state: "open" | "closing";
  onClose: () => void;
};

const ProcessMonitorDrawer = memo(function ProcessMonitorDrawer({
  children,
  copy,
  model,
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
        <ComponentTag
          label="dashboard.process-monitor"
          api="/api/trading/eod/freshness + /api/trading/eod/pipeline/status + /api/trading/agent-context/feedback/progress + /api/trading/disclosures/dart/fundamentals/daily/inspect + /api/trading/eod/piotroski-filter-results + /api/trading/eod/market-risk-filters"
          placement="inline"
        />
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

        <DailyPipelineTimeline copy={copy} pipeline={model.pipeline} />

        {children ? (
          <div className={`${styles.integrityGrid} ${styles.processMonitorDetailCards} ${styles.processMonitorCardsGrid}`}>{children}</div>
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
  initialPiotroskiStatus,
  initialMarketRiskStatus,
  initialScoringValueFactors,
  initialScoringMomentumFactors,
  initialAgentFeedbackProgress,
  initialSignalDeciderFeedback,
  initialLatestSignalDeciderFeedback,
  initialPortfolioSummary,
  initialExecutionRuntimeStatus,
  initialExecutionRuntimeMonitoredSymbols,
  initialExecutionRuntimeDailyBoard,
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
    executionRuntimeDailyBoard,
    executionRuntimeDailyBoardError,
    executionRuntimeMarketDate,
    executionRuntimeMonitoredSymbols,
    executionRuntimeMonitoredSymbolsError,
    executionRuntimeStatus,
    executionRuntimeStatusError,
    freshness,
    fundamentalsStatus,
    latestSignalDeciderFeedback,
    market,
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
    scoringMomentumFactors,
    scoringMomentumFactorsError,
    scoringMomentumFactorsLoadState,
    scoringValueFactors,
    scoringValueFactorsError,
    scoringValueFactorsLoadState,
    setAgentFeedbackProgress,
    setAgentFeedbackProgressError,
    signalDeciderFeedback,
    tracked,
    trackedError,
  } = useLiveDashboardData({
    initialAgentFeedbackProgress,
    initialError,
    initialFreshness,
    initialFundamentalsStatus,
    initialMarket,
    initialMarketRiskStatus,
    initialPipelineStatus,
    initialPiotroskiStatus,
    initialScoringMomentumFactors,
    initialScoringValueFactors,
    initialTracked,
    initialSignalDeciderFeedback,
    initialLatestSignalDeciderFeedback,
    initialPortfolioSummary,
    initialExecutionRuntimeStatus,
    initialExecutionRuntimeMonitoredSymbols,
    initialExecutionRuntimeDailyBoard,
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
  const fundamentalsPollingPresentation = resolveFundamentalsPollingPresentation({
    latestFundamentalsDate,
    pipelineStage: fundamentalsPipelineStage,
    processMarketDate: eodStatusMarketDate,
    todayTradeDate,
  });
  const fundamentalsActivityDate = getFirstTextValue(
    fundamentalsPollingPresentation.latestDate,
    eodStatusMarketDate,
  );
  const isBreakDay = isBreakDayMarket(market);
  const priceFreshnessStage = mergeRunningPipelineStage(
    getPriceFreshnessStage(freshness, useTodayPriceStage),
    pricePipelineStage,
  );
  const technicalFreshnessStage = mergeRunningPipelineStage(
    getTechnicalFreshnessStage(freshness, useTodayTechnicalStage),
    technicalPipelineStage,
    { preferStageCountsOnCompleted: true },
  );
  const actionFreshnessStage = mergeRunningPipelineStage(
    getActionFreshnessStage(freshness, useTodayActionStage),
    actionPipelineStage,
    { preferStageCountsOnCompleted: true },
  );
  const fundamentalsFreshnessWithPipelineStage = mergeRunningPipelineStage(
    fundamentalsFreshnessStage,
    fundamentalsPipelineStage,
    { preferStageCountsOnCompleted: true },
  );
  const fundamentalsUpdatedActivity = useMemo(
    () =>
      fundamentalsPollingPresentation.showStoredActivity
        ? getFundamentalsUpdatedActivityModel(fundamentalsStatus, fundamentalsActivityDate, numberLocale)
        : null,
    [fundamentalsActivityDate, fundamentalsPollingPresentation.showStoredActivity, fundamentalsStatus, numberLocale],
  );
  const fundamentalsUpdatedSymbolsDetail = useMemo(
    () =>
      fundamentalsUpdatedActivity || !fundamentalsPollingPresentation.showStoredActivity
        ? null
        : getFundamentalsUpdatedSymbolsDetail(
            fundamentalsStatus,
            fundamentalsActivityDate,
            copy,
            numberLocale,
            eodStatusMarketDate,
          ),
    [
      copy,
      eodStatusMarketDate,
      fundamentalsActivityDate,
      fundamentalsPollingPresentation.showStoredActivity,
      fundamentalsStatus,
      fundamentalsUpdatedActivity,
      numberLocale,
    ],
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
      fundamentalsPollingPresentation.latestDate,
      getPipelineStageResolvedStatusDate(
        fundamentalsPipelineStage,
        eodStatusMarketDate,
        fundamentalsPollingPresentation.latestDate,
      ),
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
    fundamentalsPollingPresentation.latestDate,
    fundamentalsPipelineStage,
    fundamentalsPrimaryCountDetail,
    fundamentalsUpdatedSymbolsDetail,
    isBreakDay,
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
  const currentSignalDeciderMarketDate = executionRuntimeMarketDate ?? rawAgentProgressDate;
  const agentProgressDateContext = getExceptionDateLabel(rawAgentProgressDate, primaryLatestCycleDate);
  const baseAgentRoleCards = useMemo(
    () => buildAgentRoleCards(displayedAgentFeedbackProgress, copy, numberLocale),
    [copy, displayedAgentFeedbackProgress, numberLocale],
  );
  const rawFilteringCardModel = useMemo(
    () =>
      buildFilteringCardModel({
        agentFeedbackProgress: displayedAgentFeedbackProgress,
        copy,
        pipelineStatus,
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
      pipelineStatus,
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
  const rawScoringCardModel = useMemo(
    () =>
      buildScoringCardModel({
        copy,
        numberLocale,
        pipelineStatus,
        scoringMomentumFactors,
        scoringMomentumFactorsError,
        scoringMomentumFactorsLoadState,
        scoringMarketDate: eodStatusMarketDate,
        scoringValueFactors,
        scoringValueFactorsError,
        scoringValueFactorsLoadState,
      }),
    [
      copy,
      eodStatusMarketDate,
      numberLocale,
      pipelineStatus,
      scoringMomentumFactors,
      scoringMomentumFactorsError,
      scoringMomentumFactorsLoadState,
      scoringValueFactors,
      scoringValueFactorsError,
      scoringValueFactorsLoadState,
    ],
  );
  const dependencyWaitState = getDailyProcessDependencyWaitState({
    eodStageCards,
    filteringCardModel: rawFilteringCardModel,
    pipelineStatus,
    scoringCardModel: rawScoringCardModel,
  });
  const filteringCardModel = useMemo(
    () =>
      dependencyWaitState.waitForFiltering
        ? maskFilteringCardModelAsWaiting(rawFilteringCardModel, copy)
        : rawFilteringCardModel,
    [copy, dependencyWaitState.waitForFiltering, rawFilteringCardModel],
  );
  const scoringCardModel = useMemo(
    () =>
      dependencyWaitState.waitForScoring
        ? buildScoringCardModel({
            copy,
            forceWaiting: true,
            numberLocale,
            pipelineStatus,
            scoringMomentumFactors,
            scoringMomentumFactorsError,
            scoringMomentumFactorsLoadState,
            scoringMarketDate: eodStatusMarketDate,
            scoringValueFactors,
            scoringValueFactorsError,
            scoringValueFactorsLoadState,
          })
        : rawScoringCardModel,
    [
      copy,
      dependencyWaitState.waitForScoring,
      eodStatusMarketDate,
      numberLocale,
      pipelineStatus,
      rawScoringCardModel,
      scoringMomentumFactors,
      scoringMomentumFactorsError,
      scoringMomentumFactorsLoadState,
      scoringValueFactors,
      scoringValueFactorsError,
      scoringValueFactorsLoadState,
    ],
  );
  const waitForAgentFeedback = dependencyWaitState.waitForAgentFeedback;
  const agentRoleCards = useMemo(
    () =>
      waitForAgentFeedback
        ? maskAgentRoleCardsAsWaiting(baseAgentRoleCards, numberLocale)
        : baseAgentRoleCards,
    [baseAgentRoleCards, numberLocale, waitForAgentFeedback],
  );
  const displayedAgentRoleStatusLabels = useMemo(
    () =>
      waitForAgentFeedback
        ? {
            ...agentRoleStatusLabels,
            pending: copy.scoring.statuses.waiting,
          }
        : agentRoleStatusLabels,
    [agentRoleStatusLabels, copy.scoring.statuses.waiting, waitForAgentFeedback],
  );
  const agentProgressRunStatus = getResolvedAgentProgressRunStatus(displayedAgentFeedbackProgress);
  const isAgentFeedbackRunning =
    !waitForAgentFeedback && isAgentFeedbackProgressRunning(displayedAgentFeedbackProgress);
  const showCompletedAgentFeedbackStatus =
    !waitForAgentFeedback && agentProgressRunStatus === "pending" && hasCompletedDefaultAgentRoles(agentRoleCards);
  const agentFeedbackHeaderStatusLabel = waitForAgentFeedback
    ? copy.scoring.statuses.waiting
    : showCompletedAgentFeedbackStatus
      ? agentProgressStatusLabels.completed
      : agentProgressStatusLabel;
  const agentFeedbackStatusTone =
    waitForAgentFeedback
      ? "neutral"
      : showCompletedAgentFeedbackStatus || agentProgressRunStatus === "completed"
        ? "positive"
        : agentProgressRunStatus === "running"
          ? "neutral"
          : agentProgressRunStatus === "stalled"
            ? "warning"
            : "neutral";
  const signalDeciderFeedbackSelection = useMemo(
    () =>
      selectSignalDeciderDashboardFeedback({
        currentFeedback: signalDeciderFeedback,
        currentMarketDate: currentSignalDeciderMarketDate,
        latestCompletedFeedback: latestSignalDeciderFeedback,
        progress: waitForAgentFeedback ? null : displayedAgentFeedbackProgress,
      }),
    [
      currentSignalDeciderMarketDate,
      displayedAgentFeedbackProgress,
      latestSignalDeciderFeedback,
      signalDeciderFeedback,
      waitForAgentFeedback,
    ],
  );
  const signalDeciderFeedbackModel = useMemo(
    () =>
      buildSignalDeciderFeedbackSummary({
        currentMarketDate: signalDeciderFeedbackSelection.currentMarketDate,
        feedback: signalDeciderFeedbackSelection.feedback,
        isLatestCompletedFallback: signalDeciderFeedbackSelection.isLatestCompletedFallback,
        marketDate:
          signalDeciderFeedbackSelection.feedback?.request?.market_date ??
          currentSignalDeciderMarketDate ??
          rawAgentProgressDate,
        progress: waitForAgentFeedback ? null : displayedAgentFeedbackProgress,
        statusOverride: waitForAgentFeedback ? "running" : undefined,
      }),
    [
      displayedAgentFeedbackProgress,
      currentSignalDeciderMarketDate,
      rawAgentProgressDate,
      signalDeciderFeedbackSelection,
      waitForAgentFeedback,
    ],
  );
  useEffect(() => {
    if (
      !signalDeciderFeedbackSelection.feedback ||
      signalDeciderFeedbackModel.resultCount <= 0
    ) {
      return;
    }

    writeSignalDeciderFeedbackCache({
      feedback: signalDeciderFeedbackSelection.feedback,
      marketDate: signalDeciderFeedbackModel.marketDate,
      progress: signalDeciderFeedbackSelection.isLatestCompletedFallback ? null : displayedAgentFeedbackProgress,
      source: "dashboard",
    });
  }, [
    displayedAgentFeedbackProgress,
    signalDeciderFeedbackModel,
    signalDeciderFeedbackSelection.feedback,
    signalDeciderFeedbackSelection.isLatestCompletedFallback,
  ]);
  const processMonitorModel = useMemo(
    () =>
      buildProcessMonitorModel({
        agentRoleCards,
        copy,
        eodStageCards,
        filteringCardModel,
        numberLocale,
        patchDate: primaryLatestCycleDate,
        pipelineStatus,
        scoringCardModel,
      }),
    [
      agentRoleCards,
      copy,
      eodStageCards,
      filteringCardModel,
      numberLocale,
      pipelineStatus,
      primaryLatestCycleDate,
      scoringCardModel,
    ],
  );
  const portfolioSummaryState = resolvePortfolioSummaryState({
    error: portfolioSummaryError,
    loading: portfolioSummaryLoadState === "loading",
    summary: portfolioSummary,
  });
  const deciderOverviewModel = useMemo(
    () =>
      buildDashboardDeciderOverviewModel({
        board: executionRuntimeDailyBoard,
        boardError: executionRuntimeDailyBoardError,
        copy,
        market,
        monitoredSymbols: executionRuntimeMonitoredSymbols,
        monitoredSymbolsError: executionRuntimeMonitoredSymbolsError,
        numberLocale,
        processStatus: processMonitorModel.status,
        tracked,
        trackedError,
      }),
    [
      copy,
      executionRuntimeDailyBoard,
      executionRuntimeDailyBoardError,
      executionRuntimeMonitoredSymbols,
      executionRuntimeMonitoredSymbolsError,
      market,
      numberLocale,
      processMonitorModel.status,
      tracked,
      trackedError,
    ],
  );
  const portfolioOverviewModel = useMemo(
    () =>
      buildDashboardPortfolioOverviewModel({
        board: executionRuntimeDailyBoard,
        boardError: executionRuntimeDailyBoardError,
        copy,
        executionStatus: executionRuntimeStatus,
        executionStatusError: executionRuntimeStatusError,
        marketDate: executionRuntimeMarketDate,
        numberLocale,
        portfolioState: portfolioSummaryState,
        summary: portfolioSummary,
      }),
    [
      copy,
      executionRuntimeDailyBoard,
      executionRuntimeDailyBoardError,
      executionRuntimeMarketDate,
      executionRuntimeStatus,
      executionRuntimeStatusError,
      numberLocale,
      portfolioSummary,
      portfolioSummaryState,
    ],
  );
  const marketStatusUnavailable = market.state === "OFFLINE PLACEHOLDER" || Boolean(marketError);
  const marketBadgeLabel = marketStatusUnavailable
    ? copy.dashboardOverview.unavailable
    : market.is_open
      ? copy.marketOpen
      : copy.marketClosed;
  const marketBadgeTone = marketStatusUnavailable ? "warning" : market.is_open ? "positive" : "closed";
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

  const processMonitorFloatingLayer = processMonitorDrawerMounted ? (
    <ProcessMonitorDrawer
      copy={copy}
      model={processMonitorModel}
      patchDate={processMonitorModel.patchDate}
      state={processMonitorDrawerState}
      onClose={closeProcessMonitorDrawer}
    >
      <OperationalIntegrityCards
        agentFeedbackHeaderStatusLabel={agentFeedbackHeaderStatusLabel}
        agentFeedbackStatusTone={agentFeedbackStatusTone}
        agentFeedbackStopDialogOpen={agentFeedbackStopDialogOpen}
        agentProgressDateContext={agentProgressDateContext}
        agentRoleCards={agentRoleCards}
        agentRoleStatusLabels={displayedAgentRoleStatusLabels}
        copy={copy}
        eodCardIdScope="process-monitor"
        eodStageCards={eodStageCards}
        filteringCardModel={filteringCardModel}
        fundamentalsDialogOpen={fundamentalsDialogOpen}
        fundamentalsFailureDetails={fundamentalsFailureDetails}
        fundamentalsUpdatedActivity={fundamentalsUpdatedActivity}
        fundamentalsUpdatesExpanded={fundamentalsUpdatesExpanded}
        isAgentFeedbackRunning={isAgentFeedbackRunning}
        patchDate={processMonitorModel.patchDate}
        scoringCardModel={scoringCardModel}
        onOpenAgentFeedbackStopDialog={openAgentFeedbackStopDialog}
        onOpenFundamentalsDetails={openFundamentalsDetails}
        onToggleFundamentalsUpdatesExpanded={toggleFundamentalsUpdatesExpanded}
      />
    </ProcessMonitorDrawer>
  ) : null;

  return (
    <MobileAppChrome
      chrome={{
        activeNav: "dashboard",
        bottomAccessory: (
          <ProcessMonitorTrigger
            copy={copy}
            model={processMonitorModel}
            open={processMonitorDrawerOpen}
            placement="mobile"
            onOpen={openProcessMonitorDrawer}
          />
        ),
        floatingLayer: processMonitorFloatingLayer,
        status: { label: marketBadgeLabel, tone: marketBadgeTone },
      }}
    >
      <div className={`${styles.stack} ${styles.dashboardWideShell}`}>
        <section className={styles.primaryInsightsSection} id="dashboard-freshness">
          <ComponentTag
            label="dashboard.primary-insights"
            api="/api/trading/agent-context/feedback + /api/trading/portfolio/summary + /api/trading/market/status + /api/trading/eod/piotroski-filter-results + /api/trading/eod/market-risk-filters + grouped process monitor data"
          />

          <ProcessMonitorTrigger
            copy={copy}
            model={processMonitorModel}
            open={processMonitorDrawerOpen}
            placement="desktop"
            onOpen={openProcessMonitorDrawer}
          />

          <div className={styles.primaryInsightGrid}>
            <DeciderRecommendationCard
              copy={copy}
              detailHref={signalDeciderFeedbackModel.detailHref}
              feedbackStatus={signalDeciderFeedbackModel.status}
              model={deciderOverviewModel}
              numberLocale={numberLocale}
            />

            <PortfolioStatusCard
              copy={copy}
              model={portfolioOverviewModel}
              numberLocale={numberLocale}
            />
          </div>
        </section>

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
