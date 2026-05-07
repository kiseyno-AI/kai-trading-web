"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { useAppState } from "@/components/providers/app-state-provider";
import {
  SYMBOL_DETAIL_FEEDBACK_ACTION_PARAM,
  SYMBOL_DETAIL_FEEDBACK_NAV_CONTEXT,
  SYMBOL_DETAIL_FEEDBACK_SORT_PARAM,
  SYMBOL_DETAIL_NAV_CONTEXT_PARAM,
  SYMBOL_DETAIL_SEARCH_QUERY_PARAM,
} from "@/app/dashboard/symbol/[symbol]/symbol-detail-state";
import { getAgentFeedbackProgressMarketDate } from "@/lib/agent-feedback-progress";
import { formatDisplayTimestamp, formatPrice } from "@/lib/format";
import {
  buildSignalDeciderFeedbackSummary,
  buildSignalDeciderFeedbackPath,
  SIGNAL_DECIDER_FEEDBACK_CLIENT_PATH,
  SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
  type SignalDeciderAction,
  type DeciderFiveDayEvaluation,
  type SignalDeciderFeedbackItem,
  type SignalDeciderFeedbackStatus,
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
const ACTION_FILTERS = ["all", "buy", "wait", "reject", "unknown"] as const;
const SORT_MODES = ["priority", "symbol", "confidence", "captured"] as const;
type ActionFilter = (typeof ACTION_FILTERS)[number];
type SortMode = (typeof SORT_MODES)[number];
type FeedbackError = "feedbackUnavailable" | "marketDateUnavailable" | { message: string };

type SignalDeciderFeedbackCopy = ReturnType<typeof useAppState>["t"]["signalDeciderFeedback"];
type SignalDeciderStatusCopy = SignalDeciderFeedbackCopy["status"];
type SignalDeciderLabelCopy = SignalDeciderFeedbackCopy["labels"];
type SignalDeciderActionCopy = SignalDeciderFeedbackCopy["actions"];
type SignalDeciderReviewCopy = SignalDeciderFeedbackCopy["review"];
type SignalDeciderEvaluationCopy = SignalDeciderFeedbackCopy["evaluation"];
type SignalDeciderSummaryCopy = SignalDeciderFeedbackCopy["summary"];
type SignalDeciderCountCopy = SignalDeciderFeedbackCopy["counts"];

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function resolveActionFilterParam(value: string | null): ActionFilter {
  return ACTION_FILTERS.includes(value as ActionFilter) ? (value as ActionFilter) : "all";
}

function resolveSortModeParam(value: string | null): SortMode {
  return SORT_MODES.includes(value as SortMode) ? (value as SortMode) : "priority";
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
  if (action === "reject") return "warning";
  return "neutral";
}

function formatScore(value: number | null) {
  return value === null ? UNKNOWN_LABEL : `${value}/10`;
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
  return copy.unknown;
}

function formatActionMix(actionCounts: Record<SignalDeciderAction, number>, actionCopy: SignalDeciderActionCopy) {
  const labels = (["buy", "wait", "reject", "unknown"] as const)
    .filter((action) => actionCounts[action] > 0)
    .map((action) => `${getLocalizedActionLabel(action, actionCopy)} ${actionCounts[action].toLocaleString("en-US")}`);

  return labels.length > 0 ? labels.join(" · ") : UNKNOWN_LABEL;
}

function getSignalDeciderSummaryStatusLabel(
  loadState: "idle" | "loading" | "ready" | "error",
  status: SignalDeciderFeedbackStatus,
  statusCopy: SignalDeciderStatusCopy,
  summaryCopy: SignalDeciderSummaryCopy,
) {
  return loadState === "ready" ? getStatusLabel(status, statusCopy) : summaryCopy.loading;
}

function getSignalDeciderSummaryNumericValue(
  loadState: "idle" | "loading" | "ready" | "error",
  value: number,
) {
  return loadState === "ready" ? value.toLocaleString("en-US") : CARD_LOADING_LABEL;
}

function getSignalDeciderSummaryActionMix(
  loadState: "idle" | "loading" | "ready" | "error",
  actionCounts: Record<SignalDeciderAction, number>,
  actionCopy: SignalDeciderActionCopy,
) {
  return loadState === "ready" ? formatActionMix(actionCounts, actionCopy) : CARD_LOADING_LABEL;
}

function getSignalDeciderNoDataMessage({
  marketDate,
  status,
  summaryCopy,
}: {
  marketDate: string | null | undefined;
  status: SignalDeciderFeedbackStatus;
  summaryCopy: SignalDeciderSummaryCopy;
}) {
  const dateLabel = hasTextValue(marketDate) ? marketDate : summaryCopy.noDataDateLabel;

  if (status === "running") {
    return summaryCopy.stateRunning.replaceAll("{dateLabel}", dateLabel);
  }

  if (status === "partial") {
    return summaryCopy.statePartial.replaceAll("{dateLabel}", dateLabel);
  }

  if (status === "needs-review") {
    return summaryCopy.stateNeedsReview.replaceAll("{dateLabel}", dateLabel);
  }

  if (status === "waiting") {
    return summaryCopy.stateWaiting.replaceAll("{dateLabel}", dateLabel);
  }

  return summaryCopy.stateWaiting.replaceAll("{dateLabel}", dateLabel);
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
    { label: copy.window, value: evaluation.windowLabel ?? copy.windowPending },
  ];
}

function getFiveDayEvaluationMissingValue(
  evaluation: DeciderFiveDayEvaluation,
  copy: SignalDeciderEvaluationCopy,
) {
  if (evaluation.state === "insufficient") return copy.insufficientValue;
  if (evaluation.state === "pending") return copy.pendingValue;
  if (evaluation.state === "not-computed") return copy.notComputedValue;
  return UNKNOWN_LABEL;
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

  return (
    <section
      className={variant === "detail" ? styles.evaluationDetailBlock : styles.evaluationBlock}
      data-testid="signal-decider-five-day-evaluation"
    >
      <div className={styles.evaluationHeader}>
        <span>{copy.title}</span>
        <strong className={`pill ${getPillToneClass(evaluation.tone)}`}>{evaluation.label}</strong>
      </div>
      <div className={styles.resultMetricGrid}>
        <div className={styles.resultMetric}>
          <span>{copy.status}</span>
          <strong>{evaluation.label}</strong>
        </div>
        {rows.map((row) => (
          <div key={row.label} className={styles.resultMetric}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
      {evaluation.dataQualityWarnings.length > 0 ? (
        <div className={styles.evaluationWarnings}>
          <strong>{copy.warnings}</strong>
          {evaluation.dataQualityWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : evaluation.state === "not-computed" ? (
        <p className={styles.evaluationStateNote}>{copy.notComputedMessage}</p>
      ) : evaluation.state === "pending" ? (
        <p className={styles.evaluationStateNote}>{copy.pendingWindowMessage}</p>
      ) : evaluation.state === "insufficient" ? (
        <p className={styles.evaluationStateNote}>{copy.insufficientDataMessage}</p>
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
    actionFilter: ActionFilter;
    query: string;
    sortMode: SortMode;
  },
) {
  const params = new URLSearchParams();
  if (hasTextValue(item.companyName)) params.set("name", item.companyName);
  if (hasTextValue(item.marketDate)) params.set("marketDate", item.marketDate);
  params.set(SYMBOL_DETAIL_NAV_CONTEXT_PARAM, SYMBOL_DETAIL_FEEDBACK_NAV_CONTEXT);
  const normalizedQuery = context.query.trim();
  if (normalizedQuery) params.set(SYMBOL_DETAIL_SEARCH_QUERY_PARAM, normalizedQuery);
  if (context.actionFilter !== "all") params.set(SYMBOL_DETAIL_FEEDBACK_ACTION_PARAM, context.actionFilter);
  if (context.sortMode !== "priority") params.set(SYMBOL_DETAIL_FEEDBACK_SORT_PARAM, context.sortMode);
  const query = params.toString();
  return `/dashboard/symbol/${encodeURIComponent(item.symbol)}${query ? `?${query}` : ""}`;
}

function filterAndSortItems({
  actionFilter,
  items,
  query,
  sortMode,
}: {
  actionFilter: ActionFilter;
  items: SignalDeciderFeedbackItem[];
  query: string;
  sortMode: SortMode;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = items.filter((item) => {
    const matchesAction = actionFilter === "all" || item.action === actionFilter;
    if (!matchesAction) return false;
    if (!normalizedQuery) return true;

    return [
      item.symbol,
      item.companyName,
      item.thesisSummary,
      item.policyVersion,
      item.qualityVerdict,
      item.qualityReason,
      ...item.riskFlags,
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

export default function SignalDeciderFeedbackPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useAppState();
  const copy = t.signalDeciderFeedback;
  const requestedMarketDate = useMemo(() => searchParams.get("marketDate"), [searchParams]);
  const requestedFeedbackQuery = useMemo(() => searchParams.get(SYMBOL_DETAIL_SEARCH_QUERY_PARAM) ?? "", [searchParams]);
  const requestedActionFilter = useMemo(
    () => resolveActionFilterParam(searchParams.get(SYMBOL_DETAIL_FEEDBACK_ACTION_PARAM)),
    [searchParams],
  );
  const requestedSortMode = useMemo(
    () => resolveSortModeParam(searchParams.get(SYMBOL_DETAIL_FEEDBACK_SORT_PARAM)),
    [searchParams],
  );
  const [marketDate, setMarketDate] = useState<string | null>(requestedMarketDate);
  const [marketDateDraft, setMarketDateDraft] = useState(requestedMarketDate ?? "");
  const [feedback, setFeedback] = useState<AgentFeedbackListResponseDto | null>(null);
  const [progress, setProgress] = useState<AgentFeedbackProgressResponseDto | null>(null);
  const [error, setError] = useState<FeedbackError | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">(
    requestedMarketDate ? "loading" : "idle",
  );
  const [query, setQuery] = useState(requestedFeedbackQuery);
  const [actionFilter, setActionFilter] = useState<ActionFilter>(requestedActionFilter);
  const [sortMode, setSortMode] = useState<SortMode>(requestedSortMode);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

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
    setSortMode(requestedSortMode);
  }, [requestedSortMode]);

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
    const cachedLatest = readLatestSignalDeciderFeedbackCache();
    if (cachedLatest) {
      queueMicrotask(() => {
        if (!active) return;
        setMarketDate(cachedLatest.marketDate);
        setMarketDateDraft(cachedLatest.marketDate);
        setFeedback(cachedLatest.feedback);
        setProgress(cachedLatest.progress);
        setLoadState("ready");
      });
    } else {
      setLoadState("loading");
    }
    setError(null);

    const loadFallbackMarketDate = async () => {
      try {
        const freshness = await getSignalDeciderReviewJson<EodFreshnessResponseDto>("/api/trading/eod/freshness");
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
        setError(freshnessError instanceof Error ? { message: freshnessError.message } : "marketDateUnavailable");
      }
    };

    void loadFallbackMarketDate();

    return () => {
      active = false;
    };
  }, [requestedMarketDate, copy.errors.marketDateUnavailable]);

  useEffect(() => {
    if (!marketDate) return;

    let active = true;
    const cachedSnapshot = readSignalDeciderFeedbackCache(marketDate);
    if (cachedSnapshot) {
      queueMicrotask(() => {
        if (!active) return;
        setFeedback(cachedSnapshot.feedback);
        setProgress(cachedSnapshot.progress);
        setLoadState("ready");
      });
    } else {
      setFeedback(null);
      setProgress(null);
      setLoadState("loading");
    }
    setError(null);
    setSelectedItemId(null);

    const loadData = async () => {
      try {
        const [feedbackData, progressData] = await Promise.all([
          getSignalDeciderReviewJson<AgentFeedbackListResponseDto>(
            buildSignalDeciderFeedbackPath({
              basePath: SIGNAL_DECIDER_FEEDBACK_CLIENT_PATH,
              limit: SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
              marketDate,
            }),
          ),
          getSignalDeciderReviewJson<AgentFeedbackProgressResponseDto>(
            `/api/trading/agent-context/feedback/progress?market_date=${encodeURIComponent(marketDate)}`,
          ).catch(() => null),
        ]);
        if (!active) return;
        const selectedFeedback = selectSignalDeciderFeedbackResponse({
          cached: cachedSnapshot,
          fetched: feedbackData,
        });
        const selectedProgress = selectedFeedback === cachedSnapshot?.feedback ? (progressData ?? cachedSnapshot.progress) : progressData;
        setFeedback(selectedFeedback);
        setProgress(selectedProgress);
        setLoadState("ready");
        if (selectedFeedback === feedbackData) {
          writeSignalDeciderFeedbackCache({
            feedback: feedbackData,
            marketDate,
            progress: progressData,
            source: "detail",
          });
        }
      } catch (loadError) {
        console.error("Signal decider feedback page load failed", loadError);
        if (!active) return;
        if (cachedSnapshot) {
          setFeedback(cachedSnapshot.feedback);
          setProgress(cachedSnapshot.progress);
          setLoadState("ready");
          setError(loadError instanceof Error ? { message: loadError.message } : "feedbackUnavailable");
          return;
        }
        setFeedback(null);
        setProgress(null);
        setLoadState("error");
        setError(loadError instanceof Error ? { message: loadError.message } : "feedbackUnavailable");
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [marketDate]);

  const summary = useMemo(
    () => buildSignalDeciderFeedbackSummary({ feedback, marketDate, progress, previewLimit: 5 }),
    [feedback, marketDate, progress],
  );
  const visibleItems = useMemo(
    () =>
      filterAndSortItems({
        actionFilter,
        items: summary.items,
        query,
        sortMode,
      }),
    [actionFilter, query, sortMode, summary.items],
  );
  const selectedItem = useMemo(
    () => summary.items.find((item) => item.id === selectedItemId) ?? null,
    [selectedItemId, summary.items],
  );
  const displayedMarketDate = summary.marketDate ?? marketDate;

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

  useEffect(() => {
    if (!selectedItem) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedItemId(null);
    };

    window.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedItem]);

  const displayError = useMemo(() => {
    if (error === null) return null;
    if (error === "feedbackUnavailable") return copy.errors.feedbackUnavailable;
    if (error === "marketDateUnavailable") return copy.errors.marketDateUnavailable;
    return error.message;
  }, [copy.errors.feedbackUnavailable, copy.errors.marketDateUnavailable, error]);

  function handleMarketDateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextMarketDate = marketDateDraft.trim();
    if (!nextMarketDate) {
      router.push("/dashboard/signal-decider-feedback");
      return;
    }

    const params = new URLSearchParams({ marketDate: nextMarketDate });
    const normalizedQuery = query.trim();
    if (normalizedQuery) params.set(SYMBOL_DETAIL_SEARCH_QUERY_PARAM, normalizedQuery);
    if (actionFilter !== "all") params.set(SYMBOL_DETAIL_FEEDBACK_ACTION_PARAM, actionFilter);
    if (sortMode !== "priority") params.set(SYMBOL_DETAIL_FEEDBACK_SORT_PARAM, sortMode);
    router.push(`/dashboard/signal-decider-feedback?${params.toString()}`);
  }

  return (
    <MobileAppChrome
      chrome={{
        activeNav: "dashboard",
        status: {
          label: displayedMarketDate ? `MD ${displayedMarketDate}` : copy.chrome.marketDatePending,
        },
      }}
    >
      <div className={styles.stack}>
        <section className={styles.heroPanel}>
          <div className={styles.heroCopy}>
            <ComponentTag
              label="dashboard.signal-decider-feedback"
              api="/api/trading/agent-context/feedback + /api/trading/agent-context/feedback/progress"
            />
            <p className={styles.eyebrow}>{copy.heroEyebrow}</p>
            <h1 className={styles.pageTitle}>{copy.heroTitle}</h1>
            <p className={styles.pageCopy}>{copy.heroCopy}</p>
          </div>

        </section>

        <section className={styles.panel}>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span>{labelsCopy.status}</span>
              <strong className={getStatusToneClass(loadState === "ready" ? summary.status : "running")}>
                {getSignalDeciderSummaryStatusLabel(loadState, summary.status, statusCopy, summaryCopy)}
              </strong>
            </div>
            <div className={styles.summaryCard}>
              <span>{labelsCopy.marketDate}</span>
              <strong>{displayedMarketDate ?? summaryCopy.pendingMarketDate}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>{labelsCopy.results}</span>
              <strong>{getSignalDeciderSummaryNumericValue(loadState, summary.resultCount)}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>{labelsCopy.actionMix}</span>
              <strong>{getSignalDeciderSummaryActionMix(loadState, summary.actionCounts, actionCopy)}</strong>
            </div>
          </div>

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
              <span>{labelsCopy.sort}</span>
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                <option value="priority">{sortCopy.priority}</option>
                <option value="confidence">{sortCopy.confidence}</option>
                <option value="symbol">{sortCopy.symbol}</option>
                <option value="captured">{sortCopy.captured}</option>
              </select>
            </label>
          </form>

          {loadState === "loading" ? (
            <div className={styles.emptyState}>{summaryCopy.loading}</div>
          ) : loadState === "error" ? (
            <div className={styles.emptyState}>{displayError ?? summaryCopy.error}</div>
          ) : visibleItems.length > 0 ? (
            <div className={styles.resultsList} aria-label={copy.labels.results}>
              {visibleItems.map((item) => {
                const reviewStateRows = getReviewStateRows(item, reviewCopy);
                const reviewNotes = getReviewNotes(item);
                const supportContextRows = getSupportContextRows(item, labelsCopy, countCopy);

                return (
                    <article
                      key={item.id}
                      className={styles.resultCard}
                      aria-label={`${item.companyName ?? item.symbol} ${copy.heroTitle}`}
                      data-testid="signal-decider-result-card"
                    >
                    <header className={styles.resultHeader}>
                      <Link href={buildSymbolHref(item, { actionFilter, query, sortMode })} className={styles.symbolLink}>
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
                          {item.fiveDayEvaluation.label}
                        </span>
                      </div>
                    </header>

                    <section className={styles.resultDecisionSection}>
                      <div className={styles.resultSectionHeader}>
                        <span>{labelsCopy.decision}</span>
                        <strong>{labelsCopy.storedSignal}</strong>
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
                        <span>{labelsCopy.thesis}</span>
                        <p>{item.thesisSummary ?? UNKNOWN_LABEL}</p>
                      </section>
                    </section>

                    <section className={styles.resultReviewSection}>
                      <div className={styles.resultSectionHeader}>
                        <span>{labelsCopy.reviewState}</span>
                        <strong>{hasReviewData(item) ? labelsCopy.result : reviewCopy.pending}</strong>
                      </div>
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
                        <span>{labelsCopy.supportContext}</span>
                        <strong>{labelsCopy.tracePolicy}</strong>
                      </div>
                      <div className={styles.resultMetricGrid} data-testid="signal-decider-support-context">
                        {supportContextRows.map((row) => (
                          <div key={row.label} className={styles.resultMetric}>
                            <span>{row.label}</span>
                            <strong>{row.value}</strong>
                          </div>
                        ))}
                      </div>
                    </section>

                    <footer className={styles.resultFooter}>
                      <button type="button" className={styles.reviewButton} onClick={() => setSelectedItemId(item.id)}>
                        {copy.labels.review}
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              {getSignalDeciderNoDataMessage({ marketDate: displayedMarketDate, status: summary.status, summaryCopy })}
            </div>
          )}
        </section>

        {selectedItem ? (
          <div className={styles.dialogBackdrop} onMouseDown={() => setSelectedItemId(null)}>
            <section
              className={styles.detailDialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby="signal-decider-detail-title"
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
                      {selectedItem.fiveDayEvaluation.label}
                    </span>
                  </div>
                </div>
                <button type="button" className={styles.closeButton} onClick={() => setSelectedItemId(null)}>
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
                    <h3>{detailCopy.risks}</h3>
                    {selectedItem.riskFlags.length > 0 ? (
                      <div className={styles.traceList}>
                        {selectedItem.riskFlags.map((risk) => (
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
                    <TraceEntryList title={labelsCopy.factors} entries={selectedItem.factorAttributions} />
                    <TraceEntryList title={labelsCopy.gates} entries={selectedItem.gateResults} />
                    <TraceEntryList title={labelsCopy.upstreamEvidence} entries={selectedItem.upstreamEvidence} />
                    <TraceEntryList title={labelsCopy.traceability} entries={selectedItem.traceability} />
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </MobileAppChrome>
  );
}
