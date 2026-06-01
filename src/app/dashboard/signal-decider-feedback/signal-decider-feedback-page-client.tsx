"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { useAppState } from "@/components/providers/app-state-provider";
import {
  SYMBOL_DETAIL_FEEDBACK_ACTION_PARAM,
  SYMBOL_DETAIL_DECIDER_FEEDBACK_RETURN_ROUTE,
  SYMBOL_DETAIL_FEEDBACK_NAV_CONTEXT,
  SYMBOL_DETAIL_FEEDBACK_RETURN_NAV_CONTEXT_PARAM,
  SYMBOL_DETAIL_FEEDBACK_RETURN_ROUTE_PARAM,
  SYMBOL_DETAIL_FEEDBACK_SORT_PARAM,
  SYMBOL_DETAIL_NAV_CONTEXT_PARAM,
  SYMBOL_DETAIL_SEARCH_QUERY_PARAM,
  SYMBOL_DETAIL_SIGNAL_DECIDER_FEEDBACK_RETURN_ROUTE,
  type SymbolDetailFeedbackReturnRoute,
} from "@/app/dashboard/symbol/[symbol]/symbol-detail-state";
import { getAgentFeedbackProgressMarketDate } from "@/lib/agent-feedback-progress";
import { formatDisplayTimestamp, formatPrice } from "@/lib/format";
import {
  buildDeciderDataGapCategorySummaries,
  buildDeciderFeedbackComparisons,
  buildDeciderFeedbackHref,
  buildDeciderFeedbackPath,
  buildDeciderDataGapReport,
  buildDeciderDataGapSymbolSummaries,
  buildDeciderFeedbackSummary,
  buildSignalDeciderFeedbackHref,
  DECIDER_DATA_GAP_CATEGORIES,
  DECIDER_FEEDBACK_CALENDAR_NAV_CONTEXT,
  DECIDER_FEEDBACK_NAV_CONTEXT_PARAM,
  DECIDER_FEEDBACK_DASHBOARD_PATH,
  filterDeciderDataGapRecords,
  getDeciderFeedbackComparisonKey,
  getOppositeDeciderAgentName,
  resolveDeciderFeedbackNavContext,
  resolveDeciderDataGapDisplayState,
  resolveDeciderAgentName,
  SHORT_TERM_DECIDER_AGENT_NAME,
  SIGNAL_DECIDER_AGENT_NAME,
  SIGNAL_DECIDER_FEEDBACK_CLIENT_PATH,
  SIGNAL_DECIDER_FEEDBACK_DASHBOARD_PATH,
  SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
  type DeciderDataGapCategory,
  type DeciderAgentName,
  type DeciderFeedbackComparison,
  type SignalDeciderAction,
  type DeciderFiveDayEvaluation,
  type SignalDeciderFeedbackItem,
  type SignalDeciderFeedbackStatus,
  type SignalDeciderHorizonEvaluation,
  type SignalDeciderReviewHorizonDay,
  type SignalDeciderQualityTone,
  type SignalDeciderTraceEntry,
} from "@/lib/signal-decider-feedback";
import {
  readLatestSignalDeciderFeedbackCache,
  readSignalDeciderFeedbackCache,
  selectSignalDeciderFeedbackResponse,
  writeSignalDeciderFeedbackCache,
} from "@/lib/signal-decider-feedback-cache";
import { getSignalDeciderReviewJson } from "@/lib/signal-decider-review-fetch";
import type {
  AgentFeedbackListResponseDto,
  AgentFeedbackProgressResponseDto,
  EodFreshnessResponseDto,
} from "@/types/trading-api";

import styles from "./signal-decider-feedback-page.module.css";

const UNKNOWN_LABEL = "[확인 필요]";
const CARD_LOADING_LABEL = "…";
const SIGNAL_DECIDER_FEEDBACK_READ_TIMEOUT_MS = 12_000;
const ACTION_FILTERS = ["all", "buy", "watch_for_trigger", "avoid_chase", "wait", "reject", "unknown"] as const;
const STATUS_FILTERS = ["all", "with-review", "review-pending", "with-risk"] as const;
const SORT_MODES = ["priority", "symbol", "confidence", "captured"] as const;
const GAP_CATEGORY_FILTERS = ["all", ...DECIDER_DATA_GAP_CATEGORIES] as const;
const DETAIL_DIALOG_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");
type ActionFilter = (typeof ACTION_FILTERS)[number];
type StatusFilter = (typeof STATUS_FILTERS)[number];
type SortMode = (typeof SORT_MODES)[number];
type GapCategoryFilter = (typeof GAP_CATEGORY_FILTERS)[number];
type FeedbackLoadState = "idle" | "loading" | "ready" | "error";
type FeedbackErrorSource = "feedback" | "marketDate" | "generic";
type DetailedFeedbackError = { message: string; source: FeedbackErrorSource };
type FeedbackError = "feedbackUnavailable" | "marketDateUnavailable" | DetailedFeedbackError;

type SignalDeciderFeedbackCopy = ReturnType<typeof useAppState>["t"]["signalDeciderFeedback"];
type SignalDeciderStatusCopy = SignalDeciderFeedbackCopy["status"];
type SignalDeciderLabelCopy = SignalDeciderFeedbackCopy["labels"];
type SignalDeciderActionCopy = SignalDeciderFeedbackCopy["actions"];
type SignalDeciderReviewCopy = SignalDeciderFeedbackCopy["review"];
type SignalDeciderEvaluationCopy = SignalDeciderFeedbackCopy["evaluation"];
type SignalDeciderSummaryCopy = SignalDeciderFeedbackCopy["summary"];
type SignalDeciderCountCopy = SignalDeciderFeedbackCopy["counts"];
type DeciderDataGapCopy = SignalDeciderFeedbackCopy["dataGaps"];

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function resolveActionFilterParam(value: string | null): ActionFilter {
  return ACTION_FILTERS.includes(value as ActionFilter) ? (value as ActionFilter) : "all";
}

function resolveStatusFilterParam(value: string | null): StatusFilter {
  return STATUS_FILTERS.includes(value as StatusFilter) ? (value as StatusFilter) : "all";
}

function resolveSortModeParam(value: string | null): SortMode {
  return SORT_MODES.includes(value as SortMode) ? (value as SortMode) : "priority";
}

function resolveGapCategoryParam(value: string | null): GapCategoryFilter {
  return GAP_CATEGORY_FILTERS.includes(value as GapCategoryFilter) ? (value as GapCategoryFilter) : "all";
}

function getStatusLabel(status: SignalDeciderFeedbackStatus, statusCopy: SignalDeciderStatusCopy) {
  switch (status) {
    case "completed":
      return statusCopy.completed;
    case "running":
      return statusCopy.running;
    case "partial":
      return statusCopy.partial;
    case "needs-review":
      return statusCopy.needsReview;
    case "waiting":
      return statusCopy.waiting;
  }
}

function getPreviousBusinessMarketDate(marketDate: string | null | undefined) {
  if (!hasTextValue(marketDate)) return null;
  const [year, month, day] = marketDate.split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  do {
    date.setUTCDate(date.getUTCDate() - 1);
  } while (date.getUTCDay() === 0 || date.getUTCDay() === 6);

  return date.toISOString().slice(0, 10);
}

function getStatusToneClass(status: SignalDeciderFeedbackStatus) {
  if (status === "completed") return styles.positiveTone;
  if (status === "partial" || status === "needs-review") return styles.warningTone;
  return styles.neutralTone;
}

function getPillToneClass(tone: SignalDeciderQualityTone | null | undefined) {
  if (tone === "positive") return "positive";
  if (tone === "warning") return "warning";
  if (tone === "negative") return "negative";
  if (tone === "info") return "info";
  return "neutral";
}

function getActionToneClass(action: SignalDeciderAction) {
  if (action === "buy") return "positive";
  if (action === "reject" || action === "avoid_chase") return "warning";
  if (action === "watch_for_trigger") return "info";
  return "neutral";
}

function formatScore(value: number | null) {
  return value === null ? UNKNOWN_LABEL : `${value}/10`;
}

function formatDeciderAgentCopy(template: string, agentLabel: string) {
  return template.replaceAll("{agentLabel}", agentLabel);
}

function getFeedbackError(
  error: unknown,
  source: "feedback" | "marketDate",
  fallback: "feedbackUnavailable" | "marketDateUnavailable",
): FeedbackError {
  return error instanceof Error ? { message: error.message, source } : fallback;
}

function hasFeedbackErrorSource(error: FeedbackError | null, source: FeedbackErrorSource): error is DetailedFeedbackError {
  return typeof error === "object" && error !== null && error.source === source;
}

function formatSignedPercent(value: number | null) {
  if (value === null) return null;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatKnownBoolean(value: boolean | null, copy: SignalDeciderEvaluationCopy, unknownLabel = UNKNOWN_LABEL) {
  if (value === true) return copy.yes;
  if (value === false) return copy.no;
  return unknownLabel;
}

function getDecisionQualityLabel(item: SignalDeciderFeedbackItem) {
  return item.qualityTag?.label ?? item.qualityVerdict ?? null;
}

function getDecisionQualityDisplayLabel(item: SignalDeciderFeedbackItem, reviewCopy: SignalDeciderReviewCopy) {
  return getDecisionQualityLabel(item) ?? reviewCopy.pending;
}

function formatOutcomeSummary(item: SignalDeciderFeedbackItem) {
  if (item.outcomeHorizons.length === 0) {
    return item.pathOutcome?.label ?? item.intradayPathResult ?? UNKNOWN_LABEL;
  }

  return item.outcomeHorizons
    .slice(0, 2)
    .map((outcome) => {
      const result = formatSignedPercent(outcome.returnPct) ?? outcome.verdict ?? outcome.notes;
      return result ? `${outcome.horizon} ${result}` : outcome.horizon;
    })
    .join(" · ");
}

function formatCurrencyValue(value: number | null) {
  return value === null ? UNKNOWN_LABEL : `₩${formatPrice(value)}`;
}

function formatExpectedReturnValue(value: number | null) {
  if (value === null) return UNKNOWN_LABEL;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getDecisionPlanRows(item: SignalDeciderFeedbackItem, actionCopy: SignalDeciderActionCopy) {
  const planAction = item.nextDayOpenAction !== "unknown" ? item.nextDayOpenAction : item.preferredAction;
  const actionRows = [
    {
      label:
        item.nextDayOpenAction !== "unknown"
          ? actionCopy.nextDay
          : actionCopy.preferred,
      value: getLocalizedActionLabel(planAction, actionCopy),
    },
  ];

  if (item.preferredAction !== "unknown" && item.preferredAction !== item.action) {
    actionRows.push({
      label: actionCopy.preferred,
      value: getLocalizedActionLabel(item.preferredAction, actionCopy),
    });
  }

  return [
    ...actionRows,
    { label: actionCopy.target, value: formatCurrencyValue(item.targetPrice) },
    { label: actionCopy.stopLoss, value: formatCurrencyValue(item.stopLossPrice) },
    ...(item.triggerCondition ? [{ label: actionCopy.trigger, value: item.triggerCondition }] : []),
    ...(item.entryCondition ? [{ label: actionCopy.entryCondition, value: item.entryCondition }] : []),
    ...(item.invalidationCondition ? [{ label: actionCopy.invalidation, value: item.invalidationCondition }] : []),
    ...(item.expectedReturnPct !== null
      ? [{ label: actionCopy.expectedReturn, value: formatExpectedReturnValue(item.expectedReturnPct) }]
      : []),
    ...(item.entryPriceBasis ? [{ label: actionCopy.entryBasis, value: item.entryPriceBasis }] : []),
    ...(item.suggestedHoldingPeriod ? [{ label: actionCopy.holdingPeriod, value: item.suggestedHoldingPeriod }] : []),
  ];
}

function getRunContextRows(item: SignalDeciderFeedbackItem, labelsCopy: SignalDeciderLabelCopy) {
  return [
    { label: labelsCopy.symbol, value: item.symbol },
    { label: labelsCopy.marketDate, value: item.marketDate || UNKNOWN_LABEL },
    { label: labelsCopy.policy, value: item.policyVersion ?? UNKNOWN_LABEL },
    { label: labelsCopy.run, value: item.runId ?? UNKNOWN_LABEL },
    { label: labelsCopy.agentVersion, value: item.agentVersion ?? UNKNOWN_LABEL },
  ];
}

function getLocalizedActionLabel(action: SignalDeciderAction, copy: SignalDeciderActionCopy) {
  if (action === "buy") return copy.buy;
  if (action === "wait") return copy.wait;
  if (action === "reject") return copy.reject;
  if (action === "watch_for_trigger") return copy.watchForTrigger;
  if (action === "avoid_chase") return copy.avoidChase;
  return copy.unknown;
}

function formatActionMix(actionCounts: Record<SignalDeciderAction, number>, actionCopy: SignalDeciderActionCopy) {
  const labels = (["buy", "watch_for_trigger", "avoid_chase", "wait", "reject", "unknown"] as const)
    .filter((action) => actionCounts[action] > 0)
    .map((action) => `${getLocalizedActionLabel(action, actionCopy)} ${actionCounts[action].toLocaleString("en-US")}`);

  return labels.length > 0 ? labels.join(" · ") : UNKNOWN_LABEL;
}

function getSignalDeciderSummaryStatusLabel(
  loadState: FeedbackLoadState,
  status: SignalDeciderFeedbackStatus,
  statusCopy: SignalDeciderStatusCopy,
  summaryCopy: SignalDeciderSummaryCopy,
  agentLabel: string,
  error: FeedbackError | null,
  marketDateUnavailableMessage: string,
) {
  if (loadState === "ready") return getStatusLabel(status, statusCopy);
  if (loadState === "error") {
    if (error === "marketDateUnavailable" || hasFeedbackErrorSource(error, "marketDate")) {
      return marketDateUnavailableMessage;
    }
    if (hasFeedbackErrorSource(error, "generic")) return error.message;

    return formatDeciderAgentCopy(summaryCopy.error, agentLabel);
  }
  return formatDeciderAgentCopy(summaryCopy.loading, agentLabel);
}

function getSignalDeciderSummaryNumericValue(
  loadState: FeedbackLoadState,
  value: number,
  unavailableLabel: string,
) {
  if (loadState === "error") return unavailableLabel;
  return loadState === "ready" ? value.toLocaleString("en-US") : CARD_LOADING_LABEL;
}

function getSignalDeciderSummaryActionMix(
  loadState: FeedbackLoadState,
  actionCounts: Record<SignalDeciderAction, number>,
  actionCopy: SignalDeciderActionCopy,
  unavailableLabel: string,
) {
  if (loadState === "error") return unavailableLabel;
  return loadState === "ready" ? formatActionMix(actionCounts, actionCopy) : CARD_LOADING_LABEL;
}

function getLoadStateGatedValue(loadState: FeedbackLoadState, readyValue: string, unavailableLabel: string) {
  if (loadState === "error") return unavailableLabel;
  return loadState === "ready" ? readyValue : CARD_LOADING_LABEL;
}

function getSignalDeciderNoDataMessage({
  agentLabel,
  hasStoredRows,
  marketDate,
  status,
  summaryCopy,
}: {
  agentLabel: string;
  hasStoredRows: boolean;
  marketDate: string | null | undefined;
  status: SignalDeciderFeedbackStatus;
  summaryCopy: SignalDeciderSummaryCopy;
}) {
  const dateLabel = hasTextValue(marketDate) ? marketDate : summaryCopy.noDataDateLabel;

  if (hasStoredRows) {
    return formatDeciderAgentCopy(summaryCopy.statePartial, agentLabel).replaceAll("{dateLabel}", dateLabel);
  }

  if (status === "running") {
    return formatDeciderAgentCopy(summaryCopy.stateRunning, agentLabel).replaceAll("{dateLabel}", dateLabel);
  }

  if (status === "partial") {
    return formatDeciderAgentCopy(summaryCopy.statePartial, agentLabel).replaceAll("{dateLabel}", dateLabel);
  }

  if (status === "needs-review") {
    return formatDeciderAgentCopy(summaryCopy.stateNeedsReview, agentLabel).replaceAll("{dateLabel}", dateLabel);
  }

  if (status === "completed") {
    return formatDeciderAgentCopy(summaryCopy.noDataMarketDateUnavailable, agentLabel);
  }

  if (status === "waiting") {
    return formatDeciderAgentCopy(summaryCopy.stateWaiting, agentLabel).replaceAll("{dateLabel}", dateLabel);
  }

  return formatDeciderAgentCopy(summaryCopy.stateWaiting, agentLabel).replaceAll("{dateLabel}", dateLabel);
}

function getTraceSummaryParts(item: SignalDeciderFeedbackItem, countCopy: SignalDeciderCountCopy) {
  return [
    item.riskFlags.length > 0 ? `${item.riskFlags.length} ${countCopy.risks}` : null,
    item.factorAttributions.length > 0 ? `${item.factorAttributions.length} ${countCopy.factors}` : null,
    item.gateResults.length > 0 ? `${item.gateResults.length} ${countCopy.gates}` : null,
    item.upstreamEvidence.length > 0 ? `${item.upstreamEvidence.length} ${countCopy.evidence}` : null,
  ].filter((part): part is string => part !== null);
}

function hasQualityVerdict(item: SignalDeciderFeedbackItem) {
  return hasTextValue(getDecisionQualityLabel(item));
}

function hasReviewNarrative(item: SignalDeciderFeedbackItem) {
  return hasTextValue(item.qualityReason) || hasTextValue(item.reviewConclusion);
}

function hasOutcomeReview(item: SignalDeciderFeedbackItem) {
  return item.outcomeHorizons.length > 0 || item.pathOutcome !== null || hasTextValue(item.intradayPathResult);
}

function hasRiskOrDataGap(item: SignalDeciderFeedbackItem) {
  return item.riskFlags.length > 0 || item.dataGapFlags.length > 0 || item.fiveDayEvaluation.dataQualityWarnings.length > 0;
}

function hasReviewData(item: SignalDeciderFeedbackItem) {
  return hasQualityVerdict(item) || hasOutcomeReview(item);
}

function getFiveDayEvaluationRows(
  evaluation: DeciderFiveDayEvaluation,
  copy: SignalDeciderEvaluationCopy,
) {
  const missingValue = getFiveDayEvaluationMissingValue(evaluation, copy);

  return [
    { label: copy.targetHit, value: formatKnownBoolean(evaluation.targetHitWithin5d, copy, missingValue) },
    { label: copy.stopHit, value: formatKnownBoolean(evaluation.stopHitWithin5d, copy, missingValue) },
    { label: copy.firstHit, value: evaluation.firstHitLabel ?? missingValue },
    { label: copy.maxFavorableExcursion, value: formatSignedPercent(evaluation.maxFavorableExcursionPct) ?? missingValue },
    { label: copy.maxAdverseExcursion, value: formatSignedPercent(evaluation.maxAdverseExcursionPct) ?? missingValue },
    { label: copy.window, value: evaluation.windowLabel ?? getFiveDayEvaluationWindowFallback(evaluation, copy) },
  ];
}

function getFiveDayEvaluationMissingValue(
  evaluation: DeciderFiveDayEvaluation,
  copy: SignalDeciderEvaluationCopy,
) {
  if (evaluation.state === "insufficient") return copy.insufficientValue;
  if (evaluation.state === "pending") return copy.pendingValue;
  if (evaluation.state === "not-computed") return copy.notComputedValue;
  if (evaluation.state === "unknown") return copy.unknownValue;
  return UNKNOWN_LABEL;
}

function getFiveDayEvaluationDisplayLabel(
  evaluation: DeciderFiveDayEvaluation,
  copy: SignalDeciderEvaluationCopy,
) {
  if (evaluation.state === "pending") return copy.pendingBadge;
  if (evaluation.state === "insufficient") return copy.insufficientBadge;
  if (evaluation.state === "not-computed") return copy.notComputedBadge;
  if (evaluation.state === "unknown") return copy.unknownBadge;
  return evaluation.label;
}

function getHorizonEvaluation(item: SignalDeciderFeedbackItem, day: SignalDeciderReviewHorizonDay) {
  return item.horizonEvaluations.find((candidate) => candidate.day === day) ?? {
    day,
    horizon: `${day}d`,
    label: `${day}D`,
    state: "not-computed",
    outcome: null,
    status: "not_computed_yet",
    statusLabel: "Not computed",
    tone: "neutral",
    returnPct: null,
    realizedPrice: null,
    verdict: null,
    notes: null,
    tradingDaysRemaining: null,
  } satisfies SignalDeciderHorizonEvaluation;
}

function getHorizonOutcomeIcon(horizon: SignalDeciderHorizonEvaluation) {
  if (horizon.state === "pending") return "⏳";
  if (horizon.state === "insufficient") return "⚠️";
  if (horizon.outcome === "target_hit") return "🎯";
  if (horizon.outcome === "stop_hit") return "🛑";
  if (horizon.outcome === "ambiguous") return "⚠️";
  if (horizon.outcome === "sideways") return "↔️";
  return null;
}

function getHorizonOutcomeLabel(horizon: SignalDeciderHorizonEvaluation, copy: SignalDeciderEvaluationCopy) {
  if (horizon.state === "pending") return copy.pendingValue;
  if (horizon.state === "insufficient") return copy.insufficientBadge;
  if (horizon.state === "not-computed") return copy.notComputedValue;
  if (horizon.state === "unknown") return copy.unknownValue;
  if (horizon.outcome === "target_hit") return copy.targetHitBadge;
  if (horizon.outcome === "stop_hit") return copy.stopHitBadge;
  if (horizon.outcome === "ambiguous") return copy.ambiguousBadge;
  if (horizon.outcome === null) return copy.evaluatedBadge;
  return copy.sidewaysBadge;
}

function HorizonOutcomeStrip({
  copy,
  item,
}: {
  copy: SignalDeciderEvaluationCopy;
  item: SignalDeciderFeedbackItem;
}) {
  return (
    <div className={styles.horizonOutcomeStrip} data-testid="signal-decider-horizon-outcomes">
      {([1, 3, 5] as const).map((day) => {
        const horizon = getHorizonEvaluation(item, day);
        const icon = getHorizonOutcomeIcon(horizon);
        return (
          <span key={day} className={styles.horizonOutcomeChip}>
            <span className={`pill ${getPillToneClass(horizon.tone)}`}>{horizon.label}</span>
            <span>{icon ? `${icon} ` : ""}{getHorizonOutcomeLabel(horizon, copy)}</span>
          </span>
        );
      })}
    </div>
  );
}

function getFiveDayEvaluationWindowFallback(
  evaluation: DeciderFiveDayEvaluation,
  copy: SignalDeciderEvaluationCopy,
) {
  if (evaluation.state === "pending") return copy.windowPending;
  if (evaluation.state === "insufficient") return copy.windowInsufficient;
  if (evaluation.state === "not-computed") return copy.windowNotComputed;
  if (evaluation.state === "unknown") return copy.windowUnknown;
  return copy.windowUnavailable;
}

function getFiveDayEvaluationStateNote(
  evaluation: DeciderFiveDayEvaluation,
  copy: SignalDeciderEvaluationCopy,
) {
  if (evaluation.state === "not-computed") return copy.notComputedMessage;
  if (evaluation.state === "pending") {
    if (evaluation.tradingDaysRemaining !== null) {
      return copy.pendingWindowMessage.replaceAll(
        "{days}",
        evaluation.tradingDaysRemaining.toLocaleString("en-US"),
      );
    }
    return copy.pendingWindowMessageUnknown;
  }
  if (evaluation.state === "insufficient") return copy.insufficientDataMessage;
  if (evaluation.state === "unknown") return copy.unknownMessage;
  return null;
}

function FiveDayEvaluationBlock({
  copy,
  evaluation,
  variant = "card",
}: {
  copy: SignalDeciderEvaluationCopy;
  evaluation: DeciderFiveDayEvaluation;
  variant?: "card" | "detail";
}) {
  const rows = getFiveDayEvaluationRows(evaluation, copy);
  const statusLabel = getFiveDayEvaluationDisplayLabel(evaluation, copy);
  const stateNote = getFiveDayEvaluationStateNote(evaluation, copy);

  return (
    <section
      className={variant === "detail" ? styles.evaluationDetailBlock : styles.evaluationBlock}
      data-testid="signal-decider-five-day-evaluation"
    >
      <div className={styles.evaluationHeader}>
        <span>{copy.title}</span>
        <strong className={`pill ${getPillToneClass(evaluation.tone)}`}>{statusLabel}</strong>
      </div>
      <div className={styles.resultMetricGrid}>
        <div className={styles.resultMetric}>
          <span>{copy.status}</span>
          <strong>{statusLabel}</strong>
        </div>
        {rows.map((row) => (
          <div key={row.label} className={styles.resultMetric}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
      {stateNote ? <p className={styles.evaluationStateNote}>{stateNote}</p> : null}
      {evaluation.dataQualityWarnings.length > 0 ? (
        <div className={styles.evaluationWarnings}>
          <strong>{copy.warnings}</strong>
          {evaluation.dataQualityWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function getReviewStateRows(item: SignalDeciderFeedbackItem, copy: SignalDeciderReviewCopy) {
  return [
    {
      label: copy.verdict,
      value: hasQualityVerdict(item) ? getDecisionQualityDisplayLabel(item, copy) : copy.pending,
    },
    { label: copy.outcome, value: hasOutcomeReview(item) ? formatOutcomeSummary(item) : copy.pending },
  ];
}

function getReviewNotes(item: SignalDeciderFeedbackItem) {
  return [item.reviewConclusion, item.qualityReason].filter(
    (note, index, notes): note is string => hasTextValue(note) && notes.indexOf(note) === index,
  );
}

function getTraceContextValue(item: SignalDeciderFeedbackItem, countCopy: SignalDeciderCountCopy) {
  const traceSummaryParts = getTraceSummaryParts(item, countCopy);
  return traceSummaryParts.length > 0 ? traceSummaryParts.join(" · ") : UNKNOWN_LABEL;
}

function getSupportContextRows(item: SignalDeciderFeedbackItem, countLabels: SignalDeciderLabelCopy, countCopy: SignalDeciderCountCopy) {
  return [
    { label: countLabels.captured, value: formatDisplayTimestamp(item.capturedAt ?? item.receivedAt, UNKNOWN_LABEL) },
    { label: countLabels.policy, value: item.policyVersion ?? UNKNOWN_LABEL },
    { label: countLabels.traceEvidence, value: getTraceContextValue(item, countCopy) },
    { label: countLabels.run, value: item.runId ?? UNKNOWN_LABEL },
  ];
}

function buildSymbolHref(
  item: SignalDeciderFeedbackItem,
  context: {
    agentName: DeciderAgentName;
    actionFilter: ActionFilter;
    feedbackNavContext: string | null;
    feedbackReturnRoute: SymbolDetailFeedbackReturnRoute;
    query: string;
    sortMode: SortMode;
    statusFilter: StatusFilter;
  },
) {
  const params = new URLSearchParams();
  if (hasTextValue(item.companyName)) params.set("name", item.companyName);
  if (hasTextValue(item.marketDate)) params.set("marketDate", item.marketDate);
  params.set(SYMBOL_DETAIL_NAV_CONTEXT_PARAM, SYMBOL_DETAIL_FEEDBACK_NAV_CONTEXT);
  const normalizedQuery = context.query.trim();
  if (normalizedQuery) params.set(SYMBOL_DETAIL_SEARCH_QUERY_PARAM, normalizedQuery);
  if (context.actionFilter !== "all") params.set(SYMBOL_DETAIL_FEEDBACK_ACTION_PARAM, context.actionFilter);
  if (context.statusFilter !== "all") params.set("feedbackStatus", context.statusFilter);
  params.set("agent", context.agentName);
  if (context.sortMode !== "priority") params.set(SYMBOL_DETAIL_FEEDBACK_SORT_PARAM, context.sortMode);
  if (context.feedbackNavContext) {
    params.set(SYMBOL_DETAIL_FEEDBACK_RETURN_NAV_CONTEXT_PARAM, context.feedbackNavContext);
  }
  params.set(SYMBOL_DETAIL_FEEDBACK_RETURN_ROUTE_PARAM, context.feedbackReturnRoute);
  const query = params.toString();
  return `/dashboard/symbol/${encodeURIComponent(item.symbol)}${query ? `?${query}` : ""}`;
}

function filterAndSortItems({
  actionFilter,
  items,
  query,
  sortMode,
  statusFilter,
}: {
  actionFilter: ActionFilter;
  items: SignalDeciderFeedbackItem[];
  query: string;
  sortMode: SortMode;
  statusFilter: StatusFilter;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = items.filter((item) => {
    const matchesAction = actionFilter === "all" || item.action === actionFilter;
    if (!matchesAction) return false;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "with-review" && hasReviewData(item)) ||
      (statusFilter === "review-pending" && !hasReviewData(item)) ||
      (statusFilter === "with-risk" && hasRiskOrDataGap(item));
    if (!matchesStatus) return false;
    if (!normalizedQuery) return true;

    return [
      item.symbol,
      item.companyName,
      item.thesisSummary,
      item.policyVersion,
      item.qualityVerdict,
      item.qualityReason,
      item.triggerCondition,
      item.entryCondition,
      item.invalidationCondition,
      ...item.riskFlags,
      ...item.dataGapFlags,
      ...item.fiveDayEvaluation.dataQualityWarnings,
      ...item.supportingEvidence.map((entry) => `${entry.label} ${entry.value ?? ""}`),
      ...item.contextBadges.map((entry) => `${entry.label} ${entry.value ?? ""}`),
      ...item.factorAttributions.map((entry) => `${entry.label} ${entry.value ?? ""}`),
      ...item.gateResults.map((entry) => `${entry.label} ${entry.value ?? ""}`),
      ...item.upstreamEvidence.map((entry) => `${entry.label} ${entry.value ?? ""}`),
    ]
      .filter((value): value is string => hasTextValue(value))
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  });

  return [...filtered].sort((left, right) => {
    if (sortMode === "symbol") return left.symbol.localeCompare(right.symbol, "en");
    if (sortMode === "confidence") {
      const leftScore = left.convictionScore ?? left.confidenceScore ?? Number.NEGATIVE_INFINITY;
      const rightScore = right.convictionScore ?? right.confidenceScore ?? Number.NEGATIVE_INFINITY;
      return rightScore - leftScore;
    }
    if (sortMode === "captured") {
      return (right.capturedAt ?? right.receivedAt ?? "").localeCompare(left.capturedAt ?? left.receivedAt ?? "");
    }
    return 0;
  });
}

function TraceEntryList({ entries, title }: { entries: SignalDeciderTraceEntry[]; title: string }) {
  return (
    <section className={styles.detailSection}>
      <h3>{title}</h3>
      {entries.length > 0 ? (
        <div className={styles.traceList}>
          {entries.map((entry) => (
            <div key={`${entry.label}-${entry.value ?? ""}`} className={styles.traceRow}>
              <span className={`pill ${getPillToneClass(entry.tone)}`}>{entry.label}</span>
              {entry.value ? <p>{entry.value}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.detailEmpty}>{UNKNOWN_LABEL}</p>
      )}
    </section>
  );
}

function getStatusFilterLabel(statusFilter: StatusFilter, copy: SignalDeciderFeedbackCopy["statusFilters"]) {
  if (statusFilter === "with-review") return copy.withReview;
  if (statusFilter === "review-pending") return copy.reviewPending;
  if (statusFilter === "with-risk") return copy.withRisk;
  return copy.all;
}

function getDataGapCategoryLabel(category: DeciderDataGapCategory, copy: DeciderDataGapCopy["categories"]) {
  return copy[category].label;
}

function getDataGapCategoryOwner(category: DeciderDataGapCategory, copy: DeciderDataGapCopy["categories"]) {
  return copy[category].owner;
}

function formatDataGapTrend(
  trend: ReturnType<typeof buildDeciderDataGapReport>["trend"],
  copy: DeciderDataGapCopy["summary"],
) {
  if (!trend) return copy.trendUnavailable;
  if (trend.deltaRowsWithDataGaps === 0) {
    return copy.trendFlat.replaceAll("{date}", trend.previousMarketDate);
  }

  const direction = trend.deltaRowsWithDataGaps > 0 ? copy.trendUp : copy.trendDown;
  return direction
    .replaceAll("{date}", trend.previousMarketDate)
    .replaceAll("{count}", Math.abs(trend.deltaRowsWithDataGaps).toLocaleString("en-US"));
}

function formatTopDataGapCategories(
  report: ReturnType<typeof buildDeciderDataGapReport>,
  copy: DeciderDataGapCopy,
) {
  if (report.topCategories.length === 0) return copy.summary.noneDetected;

  return report.topCategories
    .map(
      (category) =>
        `${getDataGapCategoryLabel(category.category, copy.categories)} ${category.affectedSymbolCount.toLocaleString("en-US")}`,
    )
    .join(" · ");
}

function formatDataGapListSummary(values: string[], emptyLabel: string) {
  if (values.length === 0) return emptyLabel;
  const visibleValues = values.slice(0, 3);
  const hiddenCount = values.length - visibleValues.length;
  return hiddenCount > 0 ? `${visibleValues.join(", ")} +${hiddenCount}` : visibleValues.join(", ");
}

function getDataGapEmptyMessage(
  state: ReturnType<typeof resolveDeciderDataGapDisplayState>,
  copy: DeciderDataGapCopy["empty"],
) {
  if (state === "no-feedback") return copy.noFeedback;
  if (state === "no-data-gaps") return copy.noDataGaps;
  if (state === "no-filtered-gaps") return copy.noFilteredGaps;
  return null;
}

function getFocusableDetailDialogElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(DETAIL_DIALOG_FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.closest("[aria-hidden='true'], [inert]")) return false;
    const styles = window.getComputedStyle(element);
    return styles.display !== "none" && styles.visibility !== "hidden";
  });
}

function formatConfidenceDelta(value: number | null) {
  if (value === null) return UNKNOWN_LABEL;
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function getComparisonBadgeTone(comparison: DeciderFeedbackComparison) {
  if (comparison.agreement === "agreement") return "positive";
  if (comparison.agreement === "disagreement") return "warning";
  return "neutral";
}

function getComparisonAgreementLabel(comparison: DeciderFeedbackComparison, copy: SignalDeciderFeedbackCopy["comparison"]) {
  if (comparison.agreement === "agreement") return copy.agreement;
  if (comparison.agreement === "disagreement") return copy.disagreement;
  return copy.unknown;
}

function ComparisonRow({
  actionCopy,
  comparison,
  copy,
}: {
  actionCopy: SignalDeciderActionCopy;
  comparison: DeciderFeedbackComparison;
  copy: SignalDeciderFeedbackCopy["comparison"];
}) {
  return (
    <section className={styles.comparisonRow} data-testid="decider-comparison-row">
      <div className={styles.resultSectionHeader}>
        <span>{copy.title}</span>
        <strong className={`pill ${getComparisonBadgeTone(comparison)}`}>
          {getComparisonAgreementLabel(comparison, copy)}
        </strong>
      </div>
      <div className={styles.comparisonGrid}>
        <div className={styles.resultMetric}>
          <span>{copy.shortTermAction}</span>
          <strong>{getLocalizedActionLabel(comparison.shortTermAction, actionCopy)}</strong>
        </div>
        <div className={styles.resultMetric}>
          <span>{copy.signalAction}</span>
          <strong>{getLocalizedActionLabel(comparison.signalAction, actionCopy)}</strong>
        </div>
        <div className={styles.resultMetric}>
          <span>{copy.confidenceDelta}</span>
          <strong>{formatConfidenceDelta(comparison.confidenceDelta)}</strong>
        </div>
      </div>
      {comparison.reasonContrast ? <p>{comparison.reasonContrast}</p> : null}
      {comparison.riskContrast ? <p>{comparison.riskContrast}</p> : null}
    </section>
  );
}

export default function SignalDeciderFeedbackPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useAppState();
  const copy = t.signalDeciderFeedback;
  const isSharedRoute = pathname === DECIDER_FEEDBACK_DASHBOARD_PATH;
  const activeAgent = useMemo<DeciderAgentName>(
    () => (isSharedRoute ? resolveDeciderAgentName(searchParams.get("agent")) : SIGNAL_DECIDER_AGENT_NAME),
    [isSharedRoute, searchParams],
  );
  const comparisonAgent = useMemo(() => getOppositeDeciderAgentName(activeAgent), [activeAgent]);
  const isShortTermAgent = activeAgent === SHORT_TERM_DECIDER_AGENT_NAME;
  const requestedMarketDate = useMemo(() => searchParams.get("marketDate"), [searchParams]);
  const requestedFeedbackQuery = useMemo(() => searchParams.get(SYMBOL_DETAIL_SEARCH_QUERY_PARAM) ?? "", [searchParams]);
  const requestedActionFilter = useMemo(
    () => resolveActionFilterParam(searchParams.get(SYMBOL_DETAIL_FEEDBACK_ACTION_PARAM)),
    [searchParams],
  );
  const requestedStatusFilter = useMemo(
    () => resolveStatusFilterParam(searchParams.get("feedbackStatus")),
    [searchParams],
  );
  const requestedSortMode = useMemo(
    () => resolveSortModeParam(searchParams.get(SYMBOL_DETAIL_FEEDBACK_SORT_PARAM)),
    [searchParams],
  );
  const requestedGapCategory = useMemo(() => resolveGapCategoryParam(searchParams.get("gapCategory")), [searchParams]);
  const requestedGapSymbol = useMemo(() => searchParams.get("gapSymbol") ?? "all", [searchParams]);
  const navContext = useMemo(
    () => resolveDeciderFeedbackNavContext(searchParams.get(DECIDER_FEEDBACK_NAV_CONTEXT_PARAM)),
    [searchParams],
  );
  const isCalendarContext = navContext === DECIDER_FEEDBACK_CALENDAR_NAV_CONTEXT;
  const [marketDate, setMarketDate] = useState<string | null>(requestedMarketDate);
  const [marketDateDraft, setMarketDateDraft] = useState(requestedMarketDate ?? "");
  const [feedback, setFeedback] = useState<AgentFeedbackListResponseDto | null>(null);
  const [comparisonFeedback, setComparisonFeedback] = useState<AgentFeedbackListResponseDto | null>(null);
  const [previousFeedback, setPreviousFeedback] = useState<AgentFeedbackListResponseDto | null>(null);
  const [progress, setProgress] = useState<AgentFeedbackProgressResponseDto | null>(null);
  const [error, setError] = useState<FeedbackError | null>(null);
  const [loadState, setLoadState] = useState<FeedbackLoadState>(requestedMarketDate ? "loading" : "idle");
  const [query, setQuery] = useState(requestedFeedbackQuery);
  const [actionFilter, setActionFilter] = useState<ActionFilter>(requestedActionFilter);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(requestedStatusFilter);
  const [sortMode, setSortMode] = useState<SortMode>(requestedSortMode);
  const [gapCategory, setGapCategory] = useState<GapCategoryFilter>(requestedGapCategory);
  const [gapSymbol, setGapSymbol] = useState(requestedGapSymbol);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const detailDialogRef = useRef<HTMLElement | null>(null);
  const detailCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const detailOpenerRef = useRef<HTMLElement | null>(null);
  const shouldRestoreDetailFocusRef = useRef(false);

  useEffect(() => {
    setMarketDate(requestedMarketDate);
  }, [requestedMarketDate]);

  useEffect(() => {
    setQuery(requestedFeedbackQuery);
  }, [requestedFeedbackQuery]);

  useEffect(() => {
    setActionFilter(requestedActionFilter);
  }, [requestedActionFilter]);

  useEffect(() => {
    setStatusFilter(requestedStatusFilter);
  }, [requestedStatusFilter]);

  useEffect(() => {
    setSortMode(requestedSortMode);
  }, [requestedSortMode]);

  useEffect(() => {
    setGapCategory(requestedGapCategory);
  }, [requestedGapCategory]);

  useEffect(() => {
    setGapSymbol(requestedGapSymbol);
  }, [requestedGapSymbol]);

  useEffect(() => {
    if (requestedMarketDate) {
      setMarketDateDraft(requestedMarketDate);
      return;
    }

    if (marketDate) setMarketDateDraft(marketDate);
  }, [marketDate, requestedMarketDate]);

  useEffect(() => {
    if (requestedMarketDate) return;

    let active = true;
    const cachedLatest = activeAgent === SIGNAL_DECIDER_AGENT_NAME ? readLatestSignalDeciderFeedbackCache() : null;
    if (cachedLatest) {
      queueMicrotask(() => {
        if (!active) return;
        setMarketDate(cachedLatest.marketDate);
        setMarketDateDraft(cachedLatest.marketDate);
        setFeedback(cachedLatest.feedback);
        setPreviousFeedback(null);
        setProgress(cachedLatest.progress);
        setLoadState("ready");
      });
    } else {
      setLoadState("loading");
    }
    setError(null);

    const loadFallbackMarketDate = async () => {
      try {
        const freshness = await getSignalDeciderReviewJson<EodFreshnessResponseDto>("/api/trading/eod/freshness", {
          timeoutMs: SIGNAL_DECIDER_FEEDBACK_READ_TIMEOUT_MS,
        });
        if (!active) return;
        const resolvedMarketDate = getAgentFeedbackProgressMarketDate(freshness);
        if (!resolvedMarketDate) {
          if (cachedLatest) return;
          setMarketDate(null);
          setLoadState("error");
          setError("marketDateUnavailable");
          return;
        }
        setMarketDate(resolvedMarketDate);
      } catch (freshnessError) {
        if (!active) return;
        if (cachedLatest) return;
        setLoadState("error");
        setError(getFeedbackError(freshnessError, "marketDate", "marketDateUnavailable"));
      }
    };

    void loadFallbackMarketDate();

    return () => {
      active = false;
    };
  }, [activeAgent, requestedMarketDate, copy.errors.marketDateUnavailable]);

  useEffect(() => {
    if (!marketDate) return;

    let active = true;
    const cachedSnapshot = activeAgent === SIGNAL_DECIDER_AGENT_NAME ? readSignalDeciderFeedbackCache(marketDate) : null;
    if (cachedSnapshot) {
      queueMicrotask(() => {
        if (!active) return;
        setFeedback(cachedSnapshot.feedback);
        setComparisonFeedback(null);
        setPreviousFeedback(null);
        setProgress(cachedSnapshot.progress);
        setLoadState("ready");
      });
    } else {
      setFeedback(null);
      setComparisonFeedback(null);
      setPreviousFeedback(null);
      setProgress(null);
      setLoadState("loading");
    }
    setError(null);
    setSelectedItemId(null);

    const loadAdditionalFeedback = async (selectedFeedback: AgentFeedbackListResponseDto) => {
      const comparisonData = getSignalDeciderReviewJson<AgentFeedbackListResponseDto>(
        buildDeciderFeedbackPath({
          agentName: comparisonAgent,
          basePath: SIGNAL_DECIDER_FEEDBACK_CLIENT_PATH,
          limit: SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
          marketDate,
        }),
        { timeoutMs: SIGNAL_DECIDER_FEEDBACK_READ_TIMEOUT_MS },
      ).catch(() => null);

      const previousMarketDate = getPreviousBusinessMarketDate(marketDate);
      const previousFeedbackData =
        previousMarketDate && (selectedFeedback.items ?? []).length > 0
          ? getSignalDeciderReviewJson<AgentFeedbackListResponseDto>(
              buildDeciderFeedbackPath({
                agentName: activeAgent,
                basePath: SIGNAL_DECIDER_FEEDBACK_CLIENT_PATH,
                limit: SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
                marketDate: previousMarketDate,
              }),
              { timeoutMs: SIGNAL_DECIDER_FEEDBACK_READ_TIMEOUT_MS },
            ).catch(() => null)
          : Promise.resolve(null);

      const [loadedComparisonData, loadedPreviousFeedbackData] = await Promise.all([comparisonData, previousFeedbackData]);
      if (!active) return;
      setComparisonFeedback(loadedComparisonData);
      setPreviousFeedback(loadedPreviousFeedbackData);
    };

    const loadData = async () => {
      try {
        const [feedbackData, progressData] = await Promise.all([
          getSignalDeciderReviewJson<AgentFeedbackListResponseDto>(
            buildDeciderFeedbackPath({
              agentName: activeAgent,
              basePath: SIGNAL_DECIDER_FEEDBACK_CLIENT_PATH,
              limit: SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
              marketDate,
            }),
            { timeoutMs: SIGNAL_DECIDER_FEEDBACK_READ_TIMEOUT_MS },
          ),
          getSignalDeciderReviewJson<AgentFeedbackProgressResponseDto>(
            `/api/trading/agent-context/feedback/progress?market_date=${encodeURIComponent(marketDate)}`,
            { timeoutMs: SIGNAL_DECIDER_FEEDBACK_READ_TIMEOUT_MS },
          ).catch(() => null),
        ]);
        if (!active) return;
        const selectedFeedback = selectSignalDeciderFeedbackResponse({
          cached: cachedSnapshot,
          fetched: feedbackData,
        });
        const selectedProgress = selectedFeedback === cachedSnapshot?.feedback ? (progressData ?? cachedSnapshot.progress) : progressData;
        if (!active) return;
        setFeedback(selectedFeedback);
        setComparisonFeedback(null);
        setPreviousFeedback(null);
        setProgress(selectedProgress);
        setLoadState("ready");
        if (activeAgent === SIGNAL_DECIDER_AGENT_NAME && selectedFeedback === feedbackData) {
          writeSignalDeciderFeedbackCache({
            feedback: feedbackData,
            marketDate,
            progress: progressData,
            source: "detail",
          });
        }

        void loadAdditionalFeedback(selectedFeedback);
      } catch (loadError) {
        console.error("Signal decider feedback page load failed", loadError);
        if (!active) return;
        if (cachedSnapshot) {
          setFeedback(cachedSnapshot.feedback);
          setComparisonFeedback(null);
          setPreviousFeedback(null);
          setProgress(cachedSnapshot.progress);
          setLoadState("ready");
          setError(getFeedbackError(loadError, "feedback", "feedbackUnavailable"));
          return;
        }
        setFeedback(null);
        setComparisonFeedback(null);
        setPreviousFeedback(null);
        setProgress(null);
        setLoadState("error");
        setError(getFeedbackError(loadError, "feedback", "feedbackUnavailable"));
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [activeAgent, comparisonAgent, marketDate]);

  const summary = useMemo(
    () => buildDeciderFeedbackSummary({ agentName: activeAgent, feedback, marketDate, progress, previewLimit: 5 }),
    [activeAgent, feedback, marketDate, progress],
  );
  const displayedMarketDate = summary.marketDate ?? marketDate;
  const comparisonSummary = useMemo(
    () =>
      buildDeciderFeedbackSummary({
        agentName: comparisonAgent,
        feedback: comparisonFeedback,
        marketDate,
        progress: null,
        previewLimit: SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
      }),
    [comparisonAgent, comparisonFeedback, marketDate],
  );
  const previousSummary = useMemo(
    () =>
      previousFeedback
        ? buildDeciderFeedbackSummary({
            agentName: activeAgent,
            feedback: previousFeedback,
            marketDate: getPreviousBusinessMarketDate(displayedMarketDate ?? marketDate),
            progress: null,
            previewLimit: SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
          })
        : null,
    [activeAgent, displayedMarketDate, marketDate, previousFeedback],
  );
  const dataGapReport = useMemo(
    () =>
      buildDeciderDataGapReport({
        items: summary.items,
        previousItems: previousSummary && previousSummary.items.length > 0 ? previousSummary.items : null,
      }),
    [previousSummary, summary.items],
  );
  const validGapSymbol = useMemo(() => {
    if (gapSymbol === "all") return "all";
    return dataGapReport.symbolSummaries.some((summaryItem) => summaryItem.symbol === gapSymbol) ? gapSymbol : "all";
  }, [dataGapReport.symbolSummaries, gapSymbol]);
  const filteredDataGapRecords = useMemo(
    () =>
      filterDeciderDataGapRecords({
        category: gapCategory,
        records: dataGapReport.records,
        symbol: validGapSymbol,
      }),
    [dataGapReport.records, gapCategory, validGapSymbol],
  );
  const filteredDataGapCategorySummaries = useMemo(
    () => buildDeciderDataGapCategorySummaries(filteredDataGapRecords),
    [filteredDataGapRecords],
  );
  const filteredDataGapSymbolSummaries = useMemo(
    () => buildDeciderDataGapSymbolSummaries(filteredDataGapRecords),
    [filteredDataGapRecords],
  );
  const dataGapDisplayState = resolveDeciderDataGapDisplayState({
    filteredRecords: filteredDataGapRecords,
    report: dataGapReport,
  });
  const comparisonByKey = useMemo(() => {
    const signalItems = activeAgent === SIGNAL_DECIDER_AGENT_NAME ? summary.items : comparisonSummary.items;
    const shortTermItems = activeAgent === SHORT_TERM_DECIDER_AGENT_NAME ? summary.items : comparisonSummary.items;
    return new Map(
      buildDeciderFeedbackComparisons({ shortTermItems, signalItems }).map((comparison) => [
        `${comparison.marketDate}:${comparison.symbol}`,
        comparison,
      ]),
    );
  }, [activeAgent, comparisonSummary.items, summary.items]);
  const comparisonCount = comparisonByKey.size;
  const activeAgentLabel =
    activeAgent === SHORT_TERM_DECIDER_AGENT_NAME ? copy.summary.shortTermAgentName : copy.summary.signalAgentName;
  const pageTitle = isSharedRoute ? copy.heroTitle : copy.legacyHeroTitle;
  const pageCopy = isShortTermAgent ? copy.shortTermHeroCopy : copy.heroCopy;
  const componentTagLabel = isSharedRoute ? "dashboard.decider-feedback" : "dashboard.signal-decider-feedback";
  const componentTagApi =
    activeAgent === SHORT_TERM_DECIDER_AGENT_NAME
      ? "/api/trading/agent-context/feedback?agent_name=short-term-decider + /api/trading/agent-context/feedback/progress"
      : "/api/trading/agent-context/feedback?agent_name=signal-decider + /api/trading/agent-context/feedback/progress";
  const selectedTabLabel =
    activeAgent === SHORT_TERM_DECIDER_AGENT_NAME ? copy.tabs.shortTermDecider : copy.tabs.signalDecider;
  const preservedTabState = {
    actionFilter,
    gapCategory,
    gapSymbol: validGapSymbol,
    marketDate: displayedMarketDate,
    navContext,
    query,
    sortMode,
    statusFilter,
  };
  const signalTabHref = buildDeciderFeedbackHref({ ...preservedTabState, agentName: SIGNAL_DECIDER_AGENT_NAME });
  const shortTermTabHref = buildDeciderFeedbackHref({ ...preservedTabState, agentName: SHORT_TERM_DECIDER_AGENT_NAME });
  const noComparisonMessage =
    comparisonFeedback === null
      ? copy.comparison.unavailable
      : copy.comparison.empty.replaceAll("{agentLabel}", activeAgentLabel);
  const shouldShowGlobalComparisonNotice =
    loadState === "ready" && summary.items.length > 0 && (comparisonFeedback === null || comparisonCount === 0);
  const visibleItems = useMemo(
    () =>
      filterAndSortItems({
        actionFilter,
        items: summary.items,
        query,
        sortMode,
        statusFilter,
      }),
    [actionFilter, query, sortMode, statusFilter, summary.items],
  );
  const selectedItem = useMemo(
    () => summary.items.find((item) => item.id === selectedItemId) ?? null,
    [selectedItemId, summary.items],
  );

  const summaryCopy = copy.summary;
  const labelsCopy = copy.labels;
  const actionCopy = copy.actions;
  const statusCopy = copy.status;
  const sortCopy = copy.sortOptions;
  const filtersCopy = copy.filters;
  const detailCopy = copy.detail;
  const reviewCopy = copy.review;
  const evaluationCopy = copy.evaluation;
  const countCopy = copy.counts;
  const dataGapCopy = copy.dataGaps;
  const feedbackLoadingMessage = formatDeciderAgentCopy(summaryCopy.loading, activeAgentLabel);
  const feedbackErrorMessage = formatDeciderAgentCopy(summaryCopy.error, activeAgentLabel);
  const feedbackUnavailableMessage = formatDeciderAgentCopy(copy.errors.feedbackUnavailable, activeAgentLabel);
  const marketDateUnavailableMessage = formatDeciderAgentCopy(copy.errors.marketDateUnavailable, activeAgentLabel);
  const calendarReturnDate = displayedMarketDate ?? marketDate ?? requestedMarketDate;
  const calendarReturnHref =
    isCalendarContext && calendarReturnDate ? `/calendar?date=${encodeURIComponent(calendarReturnDate)}` : null;
  const calendarBreadcrumb =
    isCalendarContext && calendarReturnDate
      ? copy.calendarContext.breadcrumb.replaceAll("{marketDate}", calendarReturnDate)
      : null;
  const calendarContextNav = isCalendarContext ? DECIDER_FEEDBACK_CALENDAR_NAV_CONTEXT : null;
  const dataGapSummaryUnavailableLabel = statusCopy.unavailable;
  const dataGapTotalRows = getLoadStateGatedValue(
    loadState,
    dataGapReport.totalFeedbackRows.toLocaleString("en-US"),
    dataGapSummaryUnavailableLabel,
  );
  const dataGapRowsWithGaps = getLoadStateGatedValue(
    loadState,
    `${dataGapReport.rowsWithDataGaps.toLocaleString("en-US")}${
      dataGapReport.totalFeedbackRows > 0
        ? ` · ${Math.round(dataGapReport.gapRowRatio * 100).toLocaleString("en-US")}%`
        : ""
    }`,
    dataGapSummaryUnavailableLabel,
  );
  const dataGapTopCategories = getLoadStateGatedValue(
    loadState,
    formatTopDataGapCategories(dataGapReport, dataGapCopy),
    dataGapSummaryUnavailableLabel,
  );
  const dataGapTrend = getLoadStateGatedValue(
    loadState,
    formatDataGapTrend(dataGapReport.trend, dataGapCopy.summary),
    dataGapSummaryUnavailableLabel,
  );
  const openDetailDialog = useCallback((itemId: string, opener: HTMLElement) => {
    detailOpenerRef.current = opener;
    shouldRestoreDetailFocusRef.current = true;
    setSelectedItemId(itemId);
  }, []);
  const closeDetailDialog = useCallback(() => {
    setSelectedItemId(null);
  }, []);

  useEffect(() => {
    if (selectedItem) return;
    if (!shouldRestoreDetailFocusRef.current) return;

    shouldRestoreDetailFocusRef.current = false;
    const opener = detailOpenerRef.current;
    detailOpenerRef.current = null;

    queueMicrotask(() => {
      if (!opener?.isConnected) return;
      opener.focus({ preventScroll: true });
    });
  }, [selectedItem]);

  useEffect(() => {
    if (!selectedItem) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    queueMicrotask(() => {
      const dialog = detailDialogRef.current;
      if (!dialog) return;
      const initialFocusTarget = detailCloseButtonRef.current ?? getFocusableDetailDialogElements(dialog)[0] ?? dialog;
      initialFocusTarget.focus({ preventScroll: true });
    });

    const keepFocusInDialog = (event: KeyboardEvent) => {
      const dialog = detailDialogRef.current;
      if (!dialog) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeDetailDialog();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = getFocusableDetailDialogElements(dialog);
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!activeElement || !dialog.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus({ preventScroll: true });
        return;
      }

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus({ preventScroll: true });
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", keepFocusInDialog, true);

    return () => {
      document.removeEventListener("keydown", keepFocusInDialog, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeDetailDialog, selectedItem]);

  const displayError = useMemo(() => {
    if (error === null) return null;
    if (error === "feedbackUnavailable") return feedbackUnavailableMessage;
    if (error === "marketDateUnavailable") return marketDateUnavailableMessage;
    if (error.source === "feedback") return `${feedbackUnavailableMessage} ${error.message}`;
    if (error.source === "marketDate") return `${marketDateUnavailableMessage} ${error.message}`;
    return error.message;
  }, [error, feedbackUnavailableMessage, marketDateUnavailableMessage]);

  function handleMarketDateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextMarketDate = marketDateDraft.trim();
    if (!nextMarketDate) {
      router.push(
        isSharedRoute
          ? buildDeciderFeedbackHref({ agentName: activeAgent, navContext: calendarContextNav })
          : buildSignalDeciderFeedbackHref(null, { navContext: calendarContextNav }),
      );
      return;
    }

    const params = new URLSearchParams({ marketDate: nextMarketDate });
    if (isSharedRoute) params.set("agent", activeAgent);
    const normalizedQuery = query.trim();
    if (normalizedQuery) params.set(SYMBOL_DETAIL_SEARCH_QUERY_PARAM, normalizedQuery);
    if (actionFilter !== "all") params.set(SYMBOL_DETAIL_FEEDBACK_ACTION_PARAM, actionFilter);
    if (gapCategory !== "all") params.set("gapCategory", gapCategory);
    if (validGapSymbol !== "all") params.set("gapSymbol", validGapSymbol);
    if (statusFilter !== "all") params.set("feedbackStatus", statusFilter);
    if (sortMode !== "priority") params.set(SYMBOL_DETAIL_FEEDBACK_SORT_PARAM, sortMode);
    if (calendarContextNav) params.set(DECIDER_FEEDBACK_NAV_CONTEXT_PARAM, calendarContextNav);
    router.push(`${isSharedRoute ? DECIDER_FEEDBACK_DASHBOARD_PATH : SIGNAL_DECIDER_FEEDBACK_DASHBOARD_PATH}?${params.toString()}`);
  }

  const feedbackResultsBlock = loadState === "loading" ? (
    <div className={styles.emptyState}>{feedbackLoadingMessage}</div>
  ) : loadState === "error" ? (
    <div className={styles.emptyState}>{displayError ?? feedbackErrorMessage}</div>
  ) : visibleItems.length > 0 ? (
    <div className={styles.resultsList} aria-label={copy.labels.results}>
      {visibleItems.map((item) => {
        const reviewStateRows = getReviewStateRows(item, reviewCopy);
        const reviewNotes = getReviewNotes(item);
        const supportContextRows = getSupportContextRows(item, labelsCopy, countCopy);
        const comparison = comparisonByKey.get(getDeciderFeedbackComparisonKey(item));
        const riskAndGapFlags = [...item.riskFlags, ...item.dataGapFlags];

        return (
          <article
            key={item.id}
            className={styles.resultCard}
            aria-label={`${item.companyName ?? item.symbol} ${pageTitle}`}
            data-testid="signal-decider-result-card"
            data-agent-name={activeAgent}
          >
            <header className={styles.resultHeader}>
              <Link
                href={buildSymbolHref(item, {
                  actionFilter,
                  agentName: activeAgent,
                  feedbackNavContext: calendarContextNav,
                  feedbackReturnRoute: isSharedRoute
                    ? SYMBOL_DETAIL_DECIDER_FEEDBACK_RETURN_ROUTE
                    : SYMBOL_DETAIL_SIGNAL_DECIDER_FEEDBACK_RETURN_ROUTE,
                  query,
                  sortMode,
                  statusFilter,
                })}
                className={styles.symbolLink}
              >
                <strong>{item.companyName ?? item.symbol}</strong>
                <span>{item.symbol}</span>
              </Link>
              <div className={styles.resultBadges}>
                <span className={`pill ${getActionToneClass(item.action)}`}>
                  {getLocalizedActionLabel(item.action, actionCopy)}
                </span>
                {getDecisionQualityLabel(item) ? (
                  <span className={`pill ${getPillToneClass(item.qualityTag?.tone)}`}>
                    {getDecisionQualityDisplayLabel(item, reviewCopy)}
                  </span>
                ) : null}
                <span className={`pill ${getPillToneClass(item.fiveDayEvaluation.tone)}`}>
                  {getFiveDayEvaluationDisplayLabel(item.fiveDayEvaluation, evaluationCopy)}
                </span>
              </div>
            </header>

            {comparison ? (
              <ComparisonRow actionCopy={actionCopy} comparison={comparison} copy={copy.comparison} />
            ) : shouldShowGlobalComparisonNotice ? null : (
              <section className={styles.comparisonRow} data-testid="decider-comparison-empty">
                <div className={styles.resultSectionHeader}>
                  <span>{copy.comparison.title}</span>
                  <strong className="pill neutral">{copy.comparison.noPair}</strong>
                </div>
                <p>{noComparisonMessage}</p>
              </section>
            )}

            <section className={styles.resultDecisionSection}>
              <div className={styles.resultSectionHeader}>
                <span>{isShortTermAgent ? labelsCopy.tacticalDecision : labelsCopy.decision}</span>
                <strong>{isShortTermAgent ? selectedTabLabel : labelsCopy.storedSignal}</strong>
              </div>
              <div className={styles.resultMetricGrid}>
                <div className={styles.scoreStack} data-testid="signal-decider-score-area">
                  <span>
                    <span>{labelsCopy.conviction}</span>
                    <strong>{formatScore(item.convictionScore)}</strong>
                  </span>
                  <span>
                    <span>{labelsCopy.confidence}</span>
                    <strong>{formatScore(item.confidenceScore)}</strong>
                  </span>
                </div>
                {getDecisionPlanRows(item, actionCopy).map((row) => (
                  <div key={row.label} className={styles.resultMetric}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
              <section className={styles.resultThesis}>
                <span>{isShortTermAgent ? labelsCopy.shortTermThesis : labelsCopy.thesis}</span>
                <p>{item.thesisSummary ?? UNKNOWN_LABEL}</p>
              </section>
              {isShortTermAgent && item.supportingEvidence.length > 0 ? (
                <TraceEntryList title={labelsCopy.supportingEvidence} entries={item.supportingEvidence.slice(0, 3)} />
              ) : null}
            </section>

            {isShortTermAgent ? (
              <section className={styles.resultDecisionSection} data-testid="short-term-trigger-plan">
                <div className={styles.resultSectionHeader}>
                  <span>{labelsCopy.triggerPlan}</span>
                  <strong>{actionCopy.holdingPeriod}</strong>
                </div>
                <div className={styles.resultMetricGrid}>
                  {[
                    { label: actionCopy.trigger, value: item.triggerCondition ?? UNKNOWN_LABEL },
                    { label: actionCopy.entryCondition, value: item.entryCondition ?? item.entryPriceBasis ?? UNKNOWN_LABEL },
                    { label: actionCopy.target, value: formatCurrencyValue(item.targetPrice) },
                    { label: actionCopy.stopLoss, value: formatCurrencyValue(item.stopLossPrice) },
                    { label: actionCopy.invalidation, value: item.invalidationCondition ?? UNKNOWN_LABEL },
                    { label: actionCopy.holdingPeriod, value: item.suggestedHoldingPeriod ?? UNKNOWN_LABEL },
                  ].map((row) => (
                    <div key={row.label} className={styles.resultMetric}>
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className={styles.resultReviewSection}>
              <div className={styles.resultSectionHeader}>
                <span>{labelsCopy.reviewState}</span>
                <strong>{hasReviewData(item) ? labelsCopy.result : reviewCopy.pending}</strong>
              </div>
              <HorizonOutcomeStrip copy={evaluationCopy} item={item} />
              <div className={styles.resultMetricGrid} data-testid="signal-decider-review-state">
                {reviewStateRows.map((row) => (
                  <div key={row.label} className={styles.resultMetric}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
              <FiveDayEvaluationBlock copy={evaluationCopy} evaluation={item.fiveDayEvaluation} />
              {hasReviewData(item) ? (
                <>
                  {reviewNotes.map((note) => (
                    <p key={note} className={styles.reviewNote}>
                      {note}
                    </p>
                  ))}
                </>
              ) : (
                <div className={styles.reviewPending} data-testid="signal-decider-review-pending">
                  <strong>{reviewCopy.pending}</strong>
                  <p>{reviewCopy.pendingMessage}</p>
                </div>
              )}
            </section>

            <section className={styles.resultSupportSection}>
              <div className={styles.resultSectionHeader}>
                <span>{isShortTermAgent ? labelsCopy.riskAndDataGaps : labelsCopy.supportContext}</span>
                <strong>{isShortTermAgent ? labelsCopy.contextBadges : labelsCopy.tracePolicy}</strong>
              </div>
              {isShortTermAgent ? (
                <>
                  {riskAndGapFlags.length > 0 ? (
                    <div className={styles.traceList} data-testid="short-term-risk-data-gaps">
                      {riskAndGapFlags.map((risk) => (
                        <div key={risk} className={styles.traceRow}>
                          <span className="pill warning">{labelsCopy.risks}</span>
                          <p>{risk}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.detailEmpty}>{UNKNOWN_LABEL}</p>
                  )}
                  {item.contextBadges.length > 0 ? (
                    <div className={styles.resultBadges} data-testid="short-term-context-badges">
                      {item.contextBadges.map((badge) => (
                        <span key={`${badge.label}-${badge.value ?? ""}`} className={`pill ${getPillToneClass(badge.tone)}`}>
                          {badge.label}{badge.value ? ` · ${badge.value}` : ""}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className={styles.resultMetricGrid} data-testid="signal-decider-support-context">
                  {supportContextRows.map((row) => (
                    <div key={row.label} className={styles.resultMetric}>
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <footer className={styles.resultFooter}>
              <button
                type="button"
                className={styles.reviewButton}
                onClick={(event) => openDetailDialog(item.id, event.currentTarget)}
              >
                {copy.labels.review}
              </button>
            </footer>
          </article>
        );
      })}
    </div>
  ) : (
    <div className={styles.emptyState}>
      {getSignalDeciderNoDataMessage({
        agentLabel: activeAgentLabel,
        hasStoredRows: summary.items.length > 0,
        marketDate: displayedMarketDate,
        status: summary.status,
        summaryCopy,
      })}
    </div>
  );

  const selectedDetailDialog = selectedItem ? (
    <div className={styles.dialogBackdrop} onMouseDown={closeDetailDialog}>
      <section
        ref={detailDialogRef}
        className={styles.detailDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signal-decider-detail-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.detailHeader}>
          <div className={styles.detailTitleBlock}>
            <p className={styles.eyebrow}>{detailCopy.hero}</p>
            <h2 id="signal-decider-detail-title">
              {selectedItem.companyName ?? selectedItem.symbol}
            </h2>
            <p className={styles.detailSubtitle}>
              {selectedItem.symbol} · {selectedItem.marketDate || labelsCopy.marketDatePending}
            </p>
            <div className={styles.detailBadges}>
              <span className={`pill ${getActionToneClass(selectedItem.action)}`}>
                {getLocalizedActionLabel(selectedItem.action, actionCopy)}
              </span>
              <span className={`pill ${getPillToneClass(selectedItem.qualityTag?.tone)}`}>
                {getDecisionQualityDisplayLabel(selectedItem, reviewCopy)}
              </span>
              <span className={`pill ${getPillToneClass(selectedItem.fiveDayEvaluation.tone)}`}>
                {getFiveDayEvaluationDisplayLabel(selectedItem.fiveDayEvaluation, evaluationCopy)}
              </span>
            </div>
          </div>
          <button ref={detailCloseButtonRef} type="button" className={styles.closeButton} onClick={closeDetailDialog}>
            {detailCopy.close}
          </button>
        </header>

        <div className={styles.detailBody}>
          <aside className={styles.detailSidebar} aria-label={labelsCopy.decisionContext}>
            <section className={styles.detailGroup}>
              <div className={styles.detailGroupHeader}>
                <span>{labelsCopy.decision}</span>
                <h3>{detailCopy.actionPlan}</h3>
              </div>
              <div className={styles.decisionHero}>
                <strong>
                  {getLocalizedActionLabel(
                    selectedItem.nextDayOpenAction !== "unknown" ? selectedItem.nextDayOpenAction : selectedItem.preferredAction,
                    actionCopy,
                  )}
                </strong>
                <span>
                  {selectedItem.nextDayOpenAction !== "unknown" ? actionCopy.nextDay : actionCopy.preferred}
                </span>
                {selectedItem.expectedReturnPct !== null ? (
                  <p>
                    {detailCopy.expectedReturn} {formatExpectedReturnValue(selectedItem.expectedReturnPct)}
                  </p>
                ) : null}
              </div>
              <dl className={styles.metricList}>
                <div>
                  <dt>{labelsCopy.conviction}</dt>
                  <dd>{formatScore(selectedItem.convictionScore)}</dd>
                </div>
                <div>
                  <dt>{labelsCopy.confidence}</dt>
                  <dd>{formatScore(selectedItem.confidenceScore)}</dd>
                </div>
                {getDecisionPlanRows(selectedItem, actionCopy).map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className={styles.detailGroup}>
              <div className={styles.detailGroupHeader}>
                <span>{labelsCopy.decisionContext}</span>
                <h3>{detailCopy.context}</h3>
              </div>
              <dl className={styles.contextList}>
                {getRunContextRows(selectedItem, labelsCopy).map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </aside>

          <div className={styles.detailMain}>
            <section className={`${styles.detailSection} ${styles.thesisSection}`}>
              <h3>{detailCopy.decisionThesis}</h3>
              <p>{selectedItem.thesisSummary ?? UNKNOWN_LABEL}</p>
            </section>

            <section className={`${styles.detailSection} ${styles.reviewDetailSection}`}>
              <h3>{detailCopy.reviewResult}</h3>
              <FiveDayEvaluationBlock
                copy={evaluationCopy}
                evaluation={selectedItem.fiveDayEvaluation}
                variant="detail"
              />
              <HorizonOutcomeStrip copy={evaluationCopy} item={selectedItem} />
              {hasReviewData(selectedItem) ? (
                <>
                  {hasQualityVerdict(selectedItem) || hasReviewNarrative(selectedItem) ? (
                    <div className={styles.reviewVerdictBlock}>
                      {hasQualityVerdict(selectedItem) ? (
                        <span className={`pill ${getPillToneClass(selectedItem.qualityTag?.tone)}`}>
                          {getDecisionQualityDisplayLabel(selectedItem, reviewCopy)}
                        </span>
                      ) : null}
                      <p>
                        {selectedItem.reviewConclusion ??
                          selectedItem.qualityReason ??
                          getDecisionQualityDisplayLabel(selectedItem, reviewCopy)}
                      </p>
                      {selectedItem.qualityReason && selectedItem.qualityReason !== selectedItem.reviewConclusion ? (
                        <p>{selectedItem.qualityReason}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {selectedItem.outcomeHorizons.length > 0 ? (
                    <div className={styles.outcomeGrid}>
                      {selectedItem.outcomeHorizons.map((outcome) => (
                        <div key={`${outcome.horizon}-${outcome.verdict ?? ""}`} className={styles.outcomeCard}>
                          <span>{outcome.horizon}</span>
                          <strong>
                            {formatSignedPercent(outcome.returnPct) ?? outcome.verdict ?? reviewCopy.resultEmpty}
                          </strong>
                          <p>
                            {[
                              outcome.realizedPrice !== null ? `Price ₩${formatPrice(outcome.realizedPrice)}` : null,
                              outcome.verdict,
                              outcome.notes,
                            ]
                              .filter((part): part is string => hasTextValue(part))
                              .join(" · ") || reviewCopy.resultEmpty}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : hasOutcomeReview(selectedItem) ? (
                    <p>
                      {selectedItem.pathOutcome?.detail ??
                        selectedItem.pathOutcome?.label ??
                        selectedItem.intradayPathResult}
                    </p>
                  ) : (
                    <p className={styles.detailEmpty}>{reviewCopy.noRealizedOutcome}</p>
                  )}
                </>
              ) : (
                <div className={styles.reviewPending} data-testid="signal-decider-review-pending">
                  <strong>{reviewCopy.pending}</strong>
                  <p>{reviewCopy.pendingMessage}</p>
                </div>
              )}
            </section>

            <section className={styles.detailSection}>
              <h3>{isShortTermAgent ? labelsCopy.riskAndDataGaps : detailCopy.risks}</h3>
              {[...selectedItem.riskFlags, ...selectedItem.dataGapFlags].length > 0 ? (
                <div className={styles.traceList}>
                  {[...selectedItem.riskFlags, ...selectedItem.dataGapFlags].map((risk) => (
                    <div key={risk} className={styles.traceRow}>
                      <span className="pill warning">{labelsCopy.risks}</span>
                      <p>{risk}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.detailEmpty}>{UNKNOWN_LABEL}</p>
              )}
            </section>

            <div className={styles.evidenceGrid}>
              {isShortTermAgent ? (
                <>
                  <TraceEntryList title={labelsCopy.supportingEvidence} entries={selectedItem.supportingEvidence} />
                  <TraceEntryList title={labelsCopy.contextBadges} entries={selectedItem.contextBadges} />
                </>
              ) : null}
              <TraceEntryList title={labelsCopy.factors} entries={selectedItem.factorAttributions} />
              <TraceEntryList title={labelsCopy.gates} entries={selectedItem.gateResults} />
              <TraceEntryList title={labelsCopy.upstreamEvidence} entries={selectedItem.upstreamEvidence} />
              <TraceEntryList title={labelsCopy.traceability} entries={selectedItem.traceability} />
            </div>
          </div>
        </div>
      </section>
    </div>
  ) : null;

  return (
    <MobileAppChrome
      chrome={{
        activeNav: isCalendarContext ? "calendar" : "dashboard",
        hrefs: calendarReturnHref ? { calendar: calendarReturnHref } : undefined,
        modalLayer: selectedDetailDialog,
        modalOpen: Boolean(selectedItem),
        status: {
          label: displayedMarketDate ? `MD ${displayedMarketDate}` : copy.chrome.marketDatePending,
        },
        subtitle: calendarBreadcrumb,
      }}
    >
      <div className={styles.stack}>
        <section className={styles.heroPanel}>
          <div className={styles.heroCopy}>
            <ComponentTag
              label={componentTagLabel}
              api={componentTagApi}
            />
            <p className={styles.eyebrow}>{copy.heroEyebrow}</p>
            <h1 className={styles.pageTitle}>{pageTitle}</h1>
            <p className={styles.pageCopy}>{pageCopy}</p>
          </div>

          {calendarReturnHref && calendarBreadcrumb ? (
            <nav className={styles.contextNav} aria-label={copy.calendarContext.label}>
              <span className={styles.contextBreadcrumb}>{calendarBreadcrumb}</span>
              <Link href={calendarReturnHref} className={styles.contextReturnLink}>
                {copy.calendarContext.backToCalendar}
              </Link>
            </nav>
          ) : null}
        </section>

        <section className={styles.panel}>
          <nav className={styles.agentTabs} aria-label={copy.tabs.label}>
            <Link
              href={signalTabHref}
              className={activeAgent === SIGNAL_DECIDER_AGENT_NAME ? styles.activeAgentTab : styles.agentTab}
              aria-current={activeAgent === SIGNAL_DECIDER_AGENT_NAME ? "page" : undefined}
            >
              {copy.tabs.signalDecider}
            </Link>
            <Link
              href={shortTermTabHref}
              className={activeAgent === SHORT_TERM_DECIDER_AGENT_NAME ? styles.activeAgentTab : styles.agentTab}
              aria-current={activeAgent === SHORT_TERM_DECIDER_AGENT_NAME ? "page" : undefined}
            >
              {copy.tabs.shortTermDecider}
            </Link>
          </nav>

          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span>{labelsCopy.status}</span>
              <strong
                className={
                  loadState === "error"
                    ? styles.warningTone
                    : getStatusToneClass(loadState === "ready" ? summary.status : "running")
                }
              >
                {getSignalDeciderSummaryStatusLabel(
                  loadState,
                  summary.status,
                  statusCopy,
                  summaryCopy,
                  activeAgentLabel,
                  error,
                  marketDateUnavailableMessage,
                )}
              </strong>
            </div>
            <div className={styles.summaryCard}>
              <span>{labelsCopy.marketDate}</span>
              <strong>{displayedMarketDate ?? summaryCopy.pendingMarketDate}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>{labelsCopy.results}</span>
              <strong>
                {getSignalDeciderSummaryNumericValue(loadState, summary.resultCount, statusCopy.unavailable)}
              </strong>
            </div>
            <div className={styles.summaryCard}>
              <span>{labelsCopy.actionMix}</span>
              <strong>
                {getSignalDeciderSummaryActionMix(
                  loadState,
                  summary.actionCounts,
                  actionCopy,
                  statusCopy.unavailable,
                )}
              </strong>
            </div>
            <div className={styles.summaryCard}>
              <span>{labelsCopy.comparisons}</span>
              <strong>
                {loadState === "ready"
                  ? comparisonCount.toLocaleString("en-US")
                  : loadState === "error"
                    ? statusCopy.unavailable
                    : CARD_LOADING_LABEL}
              </strong>
            </div>
          </div>

          {shouldShowGlobalComparisonNotice ? (
            <section
              className={`${styles.comparisonRow} ${styles.comparisonNotice}`}
              data-testid="decider-comparison-global-notice"
              role="note"
              aria-label={copy.comparison.title}
            >
              <div className={styles.resultSectionHeader}>
                <span>{copy.comparison.title}</span>
                <strong className="pill neutral">{copy.comparison.noPair}</strong>
              </div>
              <p>{noComparisonMessage}</p>
            </section>
          ) : null}

          <form className={styles.controls} aria-label={labelsCopy.filters} onSubmit={handleMarketDateSubmit}>
            <label>
              <span>{labelsCopy.search}</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={filtersCopy.searchPlaceholder}
              />
            </label>
            <label>
              <span>{labelsCopy.marketDate}</span>
              <div className={styles.inlineControl}>
                <input
                  type="date"
                  value={marketDateDraft}
                  onChange={(event) => setMarketDateDraft(event.target.value)}
                />
                <button type="submit">{filtersCopy.load}</button>
              </div>
            </label>
            <label>
              <span>{labelsCopy.action}</span>
              <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value as ActionFilter)}>
                {ACTION_FILTERS.map((action) => (
                  <option key={action} value={action}>
                    {action === "all" ? actionCopy.all : getLocalizedActionLabel(action, actionCopy)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{labelsCopy.statusFilter}</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                {STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>
                    {getStatusFilterLabel(status, copy.statusFilters)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{labelsCopy.sort}</span>
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                <option value="priority">{sortCopy.priority}</option>
                <option value="confidence">{sortCopy.confidence}</option>
                <option value="symbol">{sortCopy.symbol}</option>
                <option value="captured">{sortCopy.captured}</option>
              </select>
            </label>
          </form>

          {isCalendarContext ? feedbackResultsBlock : null}

          <section
            className={styles.dataGapPanel}
            aria-labelledby="decider-data-gaps-title"
            data-testid="decider-data-gaps-report"
          >
            <header className={styles.dataGapHeader}>
              <div>
                <p className={styles.eyebrow}>{dataGapCopy.eyebrow}</p>
                <h2 id="decider-data-gaps-title">{dataGapCopy.title}</h2>
                <p>{dataGapCopy.description}</p>
              </div>
              <strong className={`pill ${dataGapReport.rowsWithDataGaps > 0 ? "warning" : "neutral"}`}>
                {activeAgentLabel}
              </strong>
            </header>

            <div className={styles.dataGapSummaryGrid}>
              <div className={styles.summaryCard} data-testid="decider-data-gap-total-rows">
                <span>{dataGapCopy.summary.totalRows}</span>
                <strong>{dataGapTotalRows}</strong>
              </div>
              <div className={styles.summaryCard} data-testid="decider-data-gap-rows-with-gaps">
                <span>{dataGapCopy.summary.rowsWithGaps}</span>
                <strong>{dataGapRowsWithGaps}</strong>
              </div>
              <div className={styles.summaryCard} data-testid="decider-data-gap-top-categories">
                <span>{dataGapCopy.summary.topCategories}</span>
                <strong>{dataGapTopCategories}</strong>
              </div>
              <div className={styles.summaryCard} data-testid="decider-data-gap-trend">
                <span>{dataGapCopy.summary.trend}</span>
                <strong>{dataGapTrend}</strong>
              </div>
            </div>

            {loadState === "ready" ? (
              <div className={styles.dataGapControls} aria-label={dataGapCopy.filters.label}>
                <label>
                  <span>{dataGapCopy.filters.category}</span>
                  <select value={gapCategory} onChange={(event) => setGapCategory(event.target.value as GapCategoryFilter)}>
                    <option value="all">{dataGapCopy.filters.allCategories}</option>
                    {DECIDER_DATA_GAP_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {getDataGapCategoryLabel(category, dataGapCopy.categories)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{dataGapCopy.filters.symbol}</span>
                  <select value={validGapSymbol} onChange={(event) => setGapSymbol(event.target.value)}>
                    <option value="all">{dataGapCopy.filters.allSymbols}</option>
                    {dataGapReport.symbolSummaries.map((summaryItem) => (
                      <option key={summaryItem.symbol} value={summaryItem.symbol}>
                        {summaryItem.companyName ? `${summaryItem.companyName} · ${summaryItem.symbol}` : summaryItem.symbol}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {loadState === "loading" ? (
              <div className={styles.emptyState}>{feedbackLoadingMessage}</div>
            ) : loadState === "error" ? (
              <div className={styles.emptyState}>{displayError ?? feedbackErrorMessage}</div>
            ) : dataGapDisplayState === "has-data-gaps" ? (
              <>
                <div className={styles.dataGapCategoryCards} aria-label={dataGapCopy.table.category}>
                  {filteredDataGapCategorySummaries.map((categorySummary) => {
                    const categoryLabel = getDataGapCategoryLabel(categorySummary.category, dataGapCopy.categories);

                    return (
                      <article
                        key={categorySummary.category}
                        className={styles.dataGapCategoryCard}
                        data-testid="decider-data-gap-category-card"
                        aria-label={`${categoryLabel} ${dataGapCopy.table.category}`}
                      >
                        <div className={styles.dataGapCategoryCardHeader}>
                          <span>{dataGapCopy.table.category}</span>
                          <strong>{categoryLabel}</strong>
                        </div>
                        <dl className={styles.dataGapCategoryFacts}>
                          <div>
                            <dt>{dataGapCopy.table.affectedSymbols}</dt>
                            <dd>
                              {categorySummary.affectedSymbolCount.toLocaleString("en-US")} ·{" "}
                              {formatDataGapListSummary(categorySummary.affectedSymbols, UNKNOWN_LABEL)}
                            </dd>
                          </div>
                          <div>
                            <dt>{dataGapCopy.table.affectedAgents}</dt>
                            <dd>
                              {categorySummary.affectedAgentCount.toLocaleString("en-US")} ·{" "}
                              {formatDataGapListSummary(categorySummary.affectedAgents, UNKNOWN_LABEL)}
                            </dd>
                          </div>
                          <div>
                            <dt>{dataGapCopy.table.example}</dt>
                            <dd>{categorySummary.examples[0] ?? UNKNOWN_LABEL}</dd>
                          </div>
                          <div>
                            <dt>{dataGapCopy.table.owner}</dt>
                            <dd>{getDataGapCategoryOwner(categorySummary.category, dataGapCopy.categories)}</dd>
                          </div>
                        </dl>
                      </article>
                    );
                  })}
                </div>

                <div className={styles.dataGapTableWrap}>
                  <table className={styles.dataGapTable}>
                    <thead>
                      <tr>
                        <th>{dataGapCopy.table.category}</th>
                        <th>{dataGapCopy.table.affectedSymbols}</th>
                        <th>{dataGapCopy.table.affectedAgents}</th>
                        <th>{dataGapCopy.table.example}</th>
                        <th>{dataGapCopy.table.owner}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDataGapCategorySummaries.map((categorySummary) => (
                        <tr key={categorySummary.category}>
                          <td>{getDataGapCategoryLabel(categorySummary.category, dataGapCopy.categories)}</td>
                          <td>
                            {categorySummary.affectedSymbolCount.toLocaleString("en-US")} ·{" "}
                            {formatDataGapListSummary(categorySummary.affectedSymbols, UNKNOWN_LABEL)}
                          </td>
                          <td>
                            {categorySummary.affectedAgentCount.toLocaleString("en-US")} ·{" "}
                            {formatDataGapListSummary(categorySummary.affectedAgents, UNKNOWN_LABEL)}
                          </td>
                          <td>{categorySummary.examples[0] ?? UNKNOWN_LABEL}</td>
                          <td>{getDataGapCategoryOwner(categorySummary.category, dataGapCopy.categories)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <section className={styles.dataGapDrilldown} aria-labelledby="decider-data-gap-symbol-drilldown">
                  <div className={styles.resultSectionHeader}>
                    <span>{dataGapCopy.symbolDrilldown.eyebrow}</span>
                    <strong id="decider-data-gap-symbol-drilldown">
                      {validGapSymbol === "all" ? dataGapCopy.symbolDrilldown.allSymbols : validGapSymbol}
                    </strong>
                  </div>
                  {validGapSymbol === "all" ? (
                    <div className={styles.dataGapSymbolGrid}>
                      {filteredDataGapSymbolSummaries.slice(0, 6).map((symbolSummary) => (
                        <div key={symbolSummary.symbol} className={styles.dataGapSymbolCard}>
                          <strong>{symbolSummary.companyName ?? symbolSummary.symbol}</strong>
                          <span>{symbolSummary.symbol}</span>
                          <p>
                            {symbolSummary.repeatedGapCount.toLocaleString("en-US")} ·{" "}
                            {symbolSummary.categories
                              .map((category) => getDataGapCategoryLabel(category, dataGapCopy.categories))
                              .join(", ")}
                          </p>
                          <p>{symbolSummary.examples[0] ?? UNKNOWN_LABEL}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.traceList}>
                      {filteredDataGapRecords.map((record) => (
                        <div key={`${record.itemId}-${record.category}`} className={styles.traceRow}>
                          <span className="pill warning">
                            {getDataGapCategoryLabel(record.category, dataGapCopy.categories)}
                          </span>
                          <p>
                            {record.agentName} · {record.example}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            ) : (
              <div className={styles.emptyState}>
                {getDataGapEmptyMessage(dataGapDisplayState, dataGapCopy.empty)}
              </div>
            )}
          </section>

          {isCalendarContext ? null : feedbackResultsBlock}
        </section>
      </div>
    </MobileAppChrome>
  );
}
