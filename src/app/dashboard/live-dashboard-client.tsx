"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  type PortfolioMetricId,
  type PortfolioMetricModel,
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
  buildProcessMonitorModel,
  buildTrackedSymbolCardModels,
  formatEodSymbolCount,
  getAgentProgressStatusLabel,
  getAgentProgressStatusLabels,
  getAgentRoleStatusLabels,
  getDashboardLoadErrorMessage,
  getFirstTextValue,
  getFundamentalsCheckedCount,
  getFundamentalsUpdatedActivityModel,
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
  isSummarizerRole,
  markAgentFeedbackProgressStopped,
  mergeRunningPipelineStage,
  shouldTreatAgentFeedbackStopDisconnectAsAccepted,
} from "@/features/dashboard/live-dashboard-derived-state";
import type {
  AgentRoleCard,
  AgentRoleStatus,
  CoreMarketStatus,
  EodStageCard,
  FilteringCardModel,
  FundamentalsUpdatedActivityModel,
  FundamentalsFailureDetails,
  LiveDashboardClientProps,
  ProcessMonitorModel,
  TrackedSymbolCardModel,
} from "@/features/dashboard/live-dashboard-types";
import { useLiveDashboardData } from "@/features/dashboard/use-live-dashboard-data";
import type {
  AgentContextCoreControlRequestDto,
  AgentContextCoreControlResponseDto,
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
};

const FilteringCard = memo(function FilteringCard({
  copy,
  filteringCardModel,
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
        {filteringCardModel.stages.map((stage) => (
          <section
            key={stage.key}
            className={styles.filterStageSection}
            data-filter-stage={stage.key}
            aria-label={`${stage.label} filtering status`}
          >
            <div className={styles.filterStageHeader}>
              <div>
                <h3 className={styles.filterStageTitle}>{stage.label}</h3>
                {stage.displayMarketDate ? (
                  <p className={styles.cardContext}>{copy.operational.marketDate} {stage.displayMarketDateLabel}</p>
                ) : null}
              </div>
              <span className={`pill ${stage.statusTone}`}>{stage.statusLabel}</span>
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
        ))}
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
            const showRoleProgress =
              isSummarizerRole(role.role) || role.metrics.some((metric) => metric.key === "progress");

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

function formatSignalDeciderCount(value: number | null | undefined, numberLocale: string) {
  return typeof value === "number" ? value.toLocaleString(numberLocale) : UNKNOWN_LABEL;
}

function formatSignalDeciderResultCount(model: SignalDeciderFeedbackSummaryModel, numberLocale: string) {
  const resultCount = model.resultCount.toLocaleString(numberLocale);
  if (typeof model.requestedCount === "number" && model.requestedCount > model.resultCount) {
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
          <span>{copy.signalDecider.run}</span>
          <strong>{model.runId ?? UNKNOWN_LABEL}</strong>
        </div>
        <div className={styles.statusMetric}>
          <span>{copy.signalDecider.errors}</span>
          <strong>{formatSignalDeciderCount(model.errorCount, numberLocale)}</strong>
        </div>
        <div className={styles.statusMetric}>
          <span>{copy.signalDecider.actionMix}</span>
          <strong>{formatSignalDeciderActionMix(model, numberLocale)}</strong>
        </div>
      </div>

      {error ? <p className={styles.cardContext}>{copy.signalDecider.unavailable} {error}</p> : null}

      {model.previewItems.length > 0 ? (
        <div className={styles.signalDeciderPreviewList} aria-label={copy.signalDecider.preview}>
          {model.previewItems.map((item) => (
            <div key={item.id} className={styles.signalDeciderPreviewRow}>
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
                <span>
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

      <Link href={model.detailHref} className={styles.signalDeciderDetailLink} aria-label={copy.signalDecider.openDetail}>
        {copy.signalDecider.viewDetail}
      </Link>
    </article>
  );
});

function humanizeDashboardToken(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  return trimmed
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

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

type PortfolioStateCardProps = {
  copy: DashboardLiveCopy;
  error: string | null;
  numberLocale: string;
  summary: PortfolioSummaryDto | null;
};

const PortfolioStateCard = memo(function PortfolioStateCard({
  copy,
  error,
  numberLocale,
  summary,
}: PortfolioStateCardProps) {
  const metrics = buildPortfolioMetricModels(summary, copy.portfolioState.waiting);
  const accounts = getPortfolioAccounts(summary);
  const holdings = getPortfolioHoldings(summary);
  const lastSyncedAt = getPortfolioLastSyncedAt(summary);
  const hasAvailableMetrics = metrics.some((metric) => metric.available);
  const statusLabel = error
    ? copy.portfolioState.statusUnavailable
    : hasAvailableMetrics
      ? copy.portfolioState.statusReady
      : copy.portfolioState.statusWaiting;
  const statusTone = error ? "warning" : hasAvailableMetrics ? "positive" : "neutral";
  const lastSyncedLabel = formatDisplayTimestamp(lastSyncedAt, copy.portfolioState.waiting);

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

      {error ? <p className={styles.cardContext}>{error}</p> : null}

      <Link href="/portfolio" className={styles.signalDeciderDetailLink} aria-label={copy.portfolioState.openDetail}>
        {copy.portfolioState.openDetail}
      </Link>
    </article>
  );
});

function getFilteringMetricValue(stage: FilteringCardModel["stages"][number] | null, key: string) {
  return stage?.metrics.find((metric) => metric.key === key)?.value ?? UNKNOWN_LABEL;
}

function getMarketSessionTone(market: CoreMarketStatus) {
  return market.is_open ? "positive" : "neutral";
}

type MarketOverviewCardProps = {
  copy: DashboardLiveCopy;
  filteringCardModel: FilteringCardModel;
  market: CoreMarketStatus;
  primaryLatestCycleDateLabel: string;
};

const MarketOverviewCard = memo(function MarketOverviewCard({
  copy,
  filteringCardModel,
  market,
  primaryLatestCycleDateLabel,
}: MarketOverviewCardProps) {
  const piotroskiStage = filteringCardModel.stages.find((stage) => stage.key === "piotroski") ?? null;
  const riskStage = filteringCardModel.stages.find((stage) => stage.key === "kis-risk") ?? null;
  const tradingDayLabel =
    market.is_trading_day === false
      ? copy.marketOverview.breakDay
      : market.is_trading_day === true
        ? copy.marketOverview.tradingDayOpen
        : copy.marketOverview.unknown;

  return (
    <article className={`${styles.integrityStat} ${styles.primaryInsightCard} ${styles.marketOverviewCard}`}>
      <ComponentTag
        label="dashboard.market-overview"
        api="/api/trading/market/status + /api/trading/eod/piotroski-filter-results + /api/trading/eod/market-risk-filters"
      />

      <div className={styles.sectionHeaderRow}>
        <div>
          <p className={styles.sectionEyebrow}>{copy.marketOverview.eyebrow}</p>
          <h2 className={styles.sectionTitle}>{copy.marketOverview.title}</h2>
        </div>
        <span className={`pill ${getMarketSessionTone(market)}`}>{market.is_open ? copy.marketOpen : copy.marketClosed}</span>
      </div>

      <dl className={styles.insightStateList}>
        <div>
          <dt>{copy.marketOverview.marketState}</dt>
          <dd>{humanizeDashboardToken(market.state, copy.marketOverview.unknown)}</dd>
        </div>
        <div>
          <dt>{copy.marketOverview.tradingDay}</dt>
          <dd>{tradingDayLabel}</dd>
        </div>
        <div>
          <dt>{copy.marketOverview.latestCycle}</dt>
          <dd>{primaryLatestCycleDateLabel}</dd>
        </div>
        <div>
          <dt>{copy.marketOverview.serverTime}</dt>
          <dd>{formatDisplayTimestamp(market.server_time, UNKNOWN_LABEL)}</dd>
        </div>
      </dl>

      <div className={styles.marketSignalGrid}>
        <div>
          <span>{copy.marketOverview.piotroskiBreadth}</span>
          <strong>{getFilteringMetricValue(piotroskiStage, "pass")}</strong>
        </div>
        <div>
          <span>{copy.marketOverview.riskPosture}</span>
          <strong>{getFilteringMetricValue(riskStage, "pass")}</strong>
        </div>
        <div>
          <span>{copy.marketOverview.riskWatchlist}</span>
          <strong>{getFilteringMetricValue(riskStage, "watchlist")}</strong>
        </div>
      </div>

      <p className={styles.cardContext}>{copy.marketOverview.conditionNote}</p>

      <div className={styles.cardActionRow}>
        <Link href="/markets" className={styles.signalDeciderDetailLink} aria-label={copy.marketOverview.openMarkets}>
          {copy.marketOverview.openMarkets}
        </Link>
        <Link
          href="/markets/factors"
          className={styles.signalDeciderDetailLink}
          aria-label={copy.marketOverview.openFactorScreening}
        >
          {copy.marketOverview.openFactorScreening}
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
  state: "open" | "closing";
  onClose: () => void;
};

const ProcessMonitorDrawer = memo(function ProcessMonitorDrawer({
  children,
  copy,
  state,
  onClose,
}: ProcessMonitorDrawerProps) {
  return (
    <div className={styles.processMonitorDrawerBackdrop} data-process-monitor-state={state}>
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
          <span className={styles.processMonitorDrawerHandle} aria-hidden="true" />
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
      </section>
    </div>
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
  initialSignalDeciderFeedback,
  initialPortfolioSummary,
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
    setAgentFeedbackProgress,
    setAgentFeedbackProgressError,
    signalDeciderFeedback,
    signalDeciderFeedbackError,
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
  const fundamentalsUpdatedActivity = useMemo(
    () => getFundamentalsUpdatedActivityModel(fundamentalsStatus, eodStatusMarketDate, numberLocale),
    [eodStatusMarketDate, fundamentalsStatus, numberLocale],
  );
  const fundamentalsUpdatedSymbolsDetail = useMemo(
    () =>
      fundamentalsUpdatedActivity
        ? null
        : getFundamentalsUpdatedSymbolsDetail(fundamentalsStatus, eodStatusMarketDate, copy, numberLocale),
    [copy, eodStatusMarketDate, fundamentalsStatus, fundamentalsUpdatedActivity, numberLocale],
  );
  const fundamentalsPrimaryCountDetail = useMemo(
    () =>
      fundamentalsUpdatedActivity
        ? {
            label: copy.operational.updatedToday,
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
      copy.operational.checked,
      copy.operational.updatedToday,
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

    return [
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
  const trackedSymbolCards = useMemo(
    () => buildTrackedSymbolCardModels(tracked, symbolMetaBySymbol, freshness, copy, numberLocale),
    [copy, freshness, numberLocale, symbolMetaBySymbol, tracked],
  );
  const processMonitorModel = useMemo(
    () =>
      buildProcessMonitorModel({
        agentRoleCards,
        copy,
        eodStageCards,
        filteringCardModel,
        numberLocale,
      }),
    [agentRoleCards, copy, eodStageCards, filteringCardModel, numberLocale],
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

        <section className={`${styles.panel} ${styles.insightPanel}`} id="dashboard-freshness">
          <ComponentTag
            label="dashboard.primary-insights"
            api="/api/trading/agent-context/feedback + /api/trading/portfolio/summary + /api/trading/market/status + /api/trading/eod/piotroski-filter-results + /api/trading/eod/market-risk-filters + grouped process monitor data"
          />

          <div className={styles.panelHeader}>
            <div>
              <p className={styles.sectionEyebrow}>{copy.insights.eyebrow}</p>
              <h1 className={styles.heroTitle}>{copy.insights.title}</h1>
              <p className={styles.supportingCopy}>{copy.insights.description}</p>
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
              numberLocale={numberLocale}
              summary={portfolioSummary}
            />

            <MarketOverviewCard
              copy={copy}
              filteringCardModel={filteringCardModel}
              market={market}
              primaryLatestCycleDateLabel={primaryLatestCycleDateLabel}
            />
          </div>
        </section>

        <TrackedSymbolsSection copy={copy} trackedSymbolCards={trackedSymbolCards} />
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

              <FilteringCard copy={copy} filteringCardModel={filteringCardModel} />

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
