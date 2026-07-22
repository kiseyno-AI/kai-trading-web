"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { DocumentRouteLink } from "@/components/navigation/document-route-link";
import { useAppState } from "@/components/providers/app-state-provider";
import {
  SYMBOL_DETAIL_CALENDAR_NAV_CONTEXT,
  SYMBOL_DETAIL_NAV_CONTEXT_PARAM,
} from "@/app/dashboard/symbol/[symbol]/symbol-detail-state";
import { formatDisplayTimestamp, formatPrice } from "@/lib/format";
import { getCurrentProductMarketDate } from "@/lib/product-market-date";
import {
  buildSignalDeciderFeedbackPath,
  buildCalendarSummaryQuery,
  buildSignalDeciderFeedbackSummary,
  buildSignalDeciderFeedbackHref,
  buildReviewDateQuery,
  buildSignalDeciderFeedbackListFromReviewDateResponse,
  DECIDER_FEEDBACK_CALENDAR_NAV_CONTEXT,
  formatSignalDeciderActionLabel,
  SIGNAL_DECIDER_CALENDAR_SUMMARY_CLIENT_PATH,
  SIGNAL_DECIDER_FEEDBACK_CLIENT_PATH,
  SIGNAL_DECIDER_FEEDBACK_REVIEW_DATE_CLIENT_PATH,
  SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
  type SignalDeciderCalendarSummaryResponse,
  type SignalDeciderReviewDateResponse,
  type SignalDeciderAction,
  type SignalDeciderFeedbackItem,
  type SignalDeciderFeedbackSummaryModel,
  type SignalDeciderHorizonEvaluation,
  type SignalDeciderReviewHorizonDay,
  type SignalDeciderFeedbackStatus,
  type SignalDeciderPathOutcome,
  type SignalDeciderQualityTone,
} from "@/lib/signal-decider-feedback";
import {
  readLatestSignalDeciderFeedbackCacheByMarketDate,
  readSignalDeciderFeedbackCache,
  readSignalDeciderFeedbackCacheForMonth,
  selectSignalDeciderFeedbackResponse,
  writeSignalDeciderFeedbackCache,
} from "@/lib/signal-decider-feedback-cache";
import { getSignalDeciderReviewJson } from "@/lib/signal-decider-review-fetch";
import {
  getUserFacingSelectedDateReviewError,
  shouldSuppressSelectedDateReviewFallbackError,
} from "@/lib/signal-decider-calendar-error";
import type {
  AgentFeedbackListResponseDto,
  AgentFeedbackProgressResponseDto,
  Locale,
} from "@/types/trading-api";

import styles from "./signal-review-calendar-page.module.css";

const UNKNOWN_LABEL = "[확인 필요]";
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const ACTION_KEYS = ["buy", "wait", "reject", "unknown"] as const satisfies readonly SignalDeciderAction[];
const DAY_MS = 86_400_000;
const PRODUCT_DATE_REFRESH_INTERVAL_MS = 60_000;
const SIGNAL_REVIEW_READ_TIMEOUT_MS = 12_000;
const DETAIL_DIALOG_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type CalendarDay = {
  dateKey: string;
  dayNumber: number;
  inMonth: boolean;
  isFuture: boolean;
};

type DateSnapshotStatus = "loading" | "empty" | "stored" | "reviewed" | "partial" | "unavailable" | "future";

type CalendarDateSnapshot = {
  actionCounts: Record<SignalDeciderAction, number>;
  dateKey: string;
  decisionCount: number;
  error: string | null;
  reviewCount: number;
  status: DateSnapshotStatus;
};

type MonthLoadState = "idle" | "loading" | "ready" | "partial" | "unavailable";
type DetailLoadState = "idle" | "loading" | "ready" | "error";
type SelectedDateDisplayStatus = DateSnapshotStatus | SignalDeciderFeedbackStatus;

const EMPTY_ACTION_COUNTS = { buy: 0, wait: 0, reject: 0, watch_for_trigger: 0, avoid_chase: 0, unknown: 0 } as const;

type CompactCalendarCellStatus = DateSnapshotStatus | "waiting";

const COMPACT_CALENDAR_CELL_STATUS_LABELS = {
  en: {
    empty: "NO",
    future: "FUT",
    loading: "LOAD",
    partial: "PART",
    reviewed: "OK",
    stored: "SET",
    unavailable: "ERR",
    waiting: "WAIT",
  },
  ko: {
    empty: "없음",
    future: "미래",
    loading: "로딩",
    partial: "부분",
    reviewed: "완료",
    stored: "저장",
    unavailable: "불가",
    waiting: "대기",
  },
} as const satisfies Record<Locale, Record<CompactCalendarCellStatus, string>>;

const COMPACT_ACTION_LABELS = {
  en: {
    buy: "B",
    reject: "R",
    unknown: "?",
    wait: "W",
  },
  ko: {
    buy: "매수",
    reject: "제외",
    unknown: "확인",
    wait: "대기",
  },
} as const satisfies Record<Locale, Record<(typeof ACTION_KEYS)[number], string>>;

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeIdentityText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isSymbolLikeName(symbol: string, value: string) {
  const normalizedSymbol = normalizeIdentityText(symbol).toUpperCase();
  const normalizedValue = normalizeIdentityText(value).toUpperCase();
  const escapedSymbol = escapeRegExp(normalizedSymbol);
  return (
    normalizedValue === normalizedSymbol ||
    new RegExp(`^${escapedSymbol}\\s*\\(${escapedSymbol}\\)$`, "i").test(normalizedValue)
  );
}

function getDistinctCompanyName(symbol: string, companyName: string | null | undefined) {
  const trimmed = companyName?.trim();
  return trimmed && !isSymbolLikeName(symbol, trimmed) ? trimmed : null;
}

function getDecisionIdentity(
  item: SignalDeciderFeedbackItem,
  copy: ReturnType<typeof useAppState>["t"]["signalReview"],
) {
  const companyName = getDistinctCompanyName(item.symbol, item.companyName);
  return companyName
    ? {
        subtitle: item.symbol,
        title: companyName,
      }
    : {
        subtitle: copy.labels.nameUnavailable,
        title: item.symbol,
      };
}

function toCalendarInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.trunc(value));
  if (typeof value !== "string") return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number.parseInt(trimmed.replace(/,/g, ""), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function normalizeActionKey(value: string | null | undefined): SignalDeciderAction {
  const normalized = value?.trim().toLowerCase().replace(/\W+/g, " ").trim() ?? "";
  if (normalized === "buy") return "buy";
  if (normalized === "wait" || normalized === "watch" || normalized === "watchlist") return "wait";
  if (normalized === "watch for trigger" || normalized === "wait for trigger" || normalized === "trigger watch") {
    return "watch_for_trigger";
  }
  if (normalized === "avoid chase" || normalized === "avoid chasing" || normalized === "do not chase") {
    return "avoid_chase";
  }
  if (normalized === "reject" || normalized === "avoid" || normalized === "skip") return "reject";
  return "unknown";
}

type CompactCalendarStatus = "waiting" | "running" | "partial" | "completed" | "needs-review" | "empty" | "reviewed" | "stored";

function normalizeCalendarStatus(value: string | null | undefined): CompactCalendarStatus {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, "-") ?? "";
  if (
    normalized === "waiting" ||
    normalized === "running" ||
    normalized === "partial" ||
    normalized === "completed" ||
    normalized === "needs-review" ||
    normalized === "empty" ||
    normalized === "reviewed" ||
    normalized === "stored"
  ) {
    return normalized as CompactCalendarStatus;
  }
  return "empty";
}

function mapCalendarStatus({
  status,
  decisionCount,
  reviewCount,
}: {
  status: string | null | undefined;
  decisionCount: number;
  reviewCount: number;
}): Exclude<DateSnapshotStatus, "loading" | "future" | "unavailable"> {
  if (decisionCount <= 0) return "empty";
  const normalized = normalizeCalendarStatus(status);
  if (normalized === "reviewed" && reviewCount > 0) {
    return "reviewed";
  }
  if (reviewCount <= 0) {
    return "stored";
  }
  if (reviewCount >= decisionCount) {
    return "reviewed";
  }
  return "partial";
}

function buildLoadingDateSnapshot(dateKey: string): CalendarDateSnapshot {
  return {
    actionCounts: { ...EMPTY_ACTION_COUNTS },
    dateKey,
    decisionCount: 0,
    error: null,
    reviewCount: 0,
    status: "loading",
  };
}

function buildEmptyDateSnapshot(dateKey: string, error: string | null = null): CalendarDateSnapshot {
  return {
    actionCounts: { ...EMPTY_ACTION_COUNTS },
    dateKey,
    decisionCount: 0,
    error,
    reviewCount: 0,
    status: error ? "unavailable" : "empty",
  };
}

function getMonthLoadStateFromSnapshots({
  monthDays,
  snapshots,
}: {
  monthDays: CalendarDay[];
  snapshots: Record<string, CalendarDateSnapshot>;
}): MonthLoadState {
  if (monthDays.length === 0) return "ready";

  const statuses = monthDays.map((day) => snapshots[day.dateKey]?.status ?? "loading");
  const loadingCount = statuses.filter((status) => status === "loading").length;
  const unavailableCount = statuses.filter((status) => status === "unavailable").length;

  if (loadingCount > 0) {
    return loadingCount === statuses.length ? "loading" : "partial";
  }

  if (unavailableCount === statuses.length) return "unavailable";
  if (unavailableCount > 0) return "partial";
  return "ready";
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getTodayDateKey(now = new Date()) {
  return getCurrentProductMarketDate(now);
}

function getMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

function addMonths(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  return formatDateKey(new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1 + delta, 1))).slice(0, 7);
}

function getMonthNavigationDate(monthKey: string, selectedDate: string | null, todayKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const selectedDay = Number.parseInt((selectedDate ?? todayKey).slice(8, 10), 10);
  const lastDayOfMonth = new Date(Date.UTC(year ?? 1970, month ?? 1, 0)).getUTCDate();
  const day = Math.min(Number.isFinite(selectedDay) ? Math.max(selectedDay, 1) : 1, lastDayOfMonth);
  const nextDate = `${monthKey}-${String(day).padStart(2, "0")}`;

  return nextDate > todayKey ? todayKey : nextDate;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1)));
}

function buildCalendarDays(monthKey: string, todayKey: string): CalendarDay[] {
  const [year, month] = monthKey.split("-").map(Number);
  const firstOfMonth = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1));
  const startOffset = firstOfMonth.getUTCDay();
  const gridStart = new Date(firstOfMonth.getTime() - startOffset * DAY_MS);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getTime() + index * DAY_MS);
    const dateKey = formatDateKey(date);
    return {
      dateKey,
      dayNumber: date.getUTCDate(),
      inMonth: dateKey.startsWith(monthKey),
      isFuture: dateKey > todayKey,
    };
  });
}

function getReviewEvidenceCount(items: SignalDeciderFeedbackItem[]) {
  return items.filter(
    (item) =>
      hasTextValue(item.qualityVerdict) ||
      hasTextValue(item.qualityReason) ||
      hasTextValue(item.reviewConclusion) ||
      item.pathOutcome !== null ||
      item.outcomeHorizons.length > 0 ||
      item.horizonEvaluations.some((horizon) => horizon.state === "computed"),
  ).length;
}

function buildDateSnapshot(
  dateKey: string,
  feedback: AgentFeedbackListResponseDto | null,
  error: string | null = null,
): CalendarDateSnapshot {
  if (error) {
    return {
      actionCounts: { ...EMPTY_ACTION_COUNTS },
      dateKey,
      decisionCount: 0,
      error,
      reviewCount: 0,
      status: "unavailable",
    };
  }

  const summary = buildSignalDeciderFeedbackSummary({
    feedback,
    marketDate: dateKey,
    progress: null,
    previewLimit: 0,
  });
  const decisionCount = feedback?.summary?.count ?? summary.resultCount;
  const reviewCount = getReviewEvidenceCount(summary.items);
  const status = (() => {
    if (decisionCount <= 0) return "empty";
    if (reviewCount <= 0) return "stored";
    if (reviewCount >= decisionCount) return "reviewed";
    return "partial";
  })();

  return {
    actionCounts: summary.actionCounts,
    dateKey,
    decisionCount,
    error: null,
    reviewCount,
    status,
  };
}

function buildDateSnapshotFromCalendarSummary({
  dateKey,
  summaryItem,
  fallbackFeedback,
}: {
  dateKey: string;
  summaryItem: SignalDeciderCalendarSummaryResponse["items"][number] | null;
  fallbackFeedback: AgentFeedbackListResponseDto | null;
}): CalendarDateSnapshot {
  if (!summaryItem) return fallbackFeedback ? buildDateSnapshot(dateKey, fallbackFeedback) : buildEmptyDateSnapshot(dateKey);

  const decisionCount = toCalendarInt(summaryItem.decision_count);
  const reviewCount = Object.values(summaryItem.review_status_counts ?? {}).reduce<number>(
    (total, value) => total + toCalendarInt(value),
    0,
  );
  const actionCounts = { ...EMPTY_ACTION_COUNTS };
  for (const [actionKey, countValue] of Object.entries(summaryItem.decision_actions ?? {})) {
    const action = normalizeActionKey(actionKey);
    actionCounts[action] += toCalendarInt(countValue);
  }
  const status = mapCalendarStatus({
    decisionCount,
    reviewCount,
    status: summaryItem.calendar_status,
  });

  if (decisionCount <= 0 && status === "empty") {
    return buildEmptyDateSnapshot(dateKey);
  }

  return {
    actionCounts,
    dateKey,
    decisionCount,
    error: null,
    reviewCount,
    status,
  };
}

function parseCompactDateValue(value: string | null | undefined) {
  if (!hasTextValue(value)) return null;
  const trimmed = value.trim();
  const match = /^\d{4}-\d{2}-\d{2}/.exec(trimmed);
  return match?.[0] ?? null;
}

function getActionMixLabel(
  actionCounts: Record<SignalDeciderAction, number>,
  copy: ReturnType<typeof useAppState>["t"]["signalReview"],
) {
  const labels = ACTION_KEYS.filter((action) => actionCounts[action] > 0).map(
    (action) => `${copy.actions[action]} ${actionCounts[action].toLocaleString("en-US")}`,
  );
  return labels.length > 0 ? labels.join(" · ") : copy.status.pending;
}

function formatCompactCalendarNumber(value: number) {
  if (value > 999) return "999+";
  return value.toLocaleString("en-US");
}

function getCalendarCellStatusLabelKey(status: DateSnapshotStatus | SignalDeciderFeedbackStatus): CompactCalendarCellStatus {
  // Calendar cells do not carry live process evidence; route-level running state stays conservative here.
  if (status === "running") return "loading";
  if (status === "completed") return "reviewed";
  if (status === "needs-review") return "partial";
  return status;
}

function getCompactStatusLabel(status: DateSnapshotStatus | SignalDeciderFeedbackStatus, locale: Locale) {
  return COMPACT_CALENDAR_CELL_STATUS_LABELS[locale][getCalendarCellStatusLabelKey(status)];
}

function getCompactActionMixLabel(actionCounts: Record<SignalDeciderAction, number>, locale: Locale) {
  const visibleActions = ACTION_KEYS.filter((action) => actionCounts[action] > 0).sort((left, right) => {
    const countDifference = actionCounts[right] - actionCounts[left];
    return countDifference !== 0 ? countDifference : ACTION_KEYS.indexOf(left) - ACTION_KEYS.indexOf(right);
  });
  const primaryAction = visibleActions[0];

  if (!primaryAction) return getCompactStatusLabel("waiting", locale);

  const additionalActionsLabel = visibleActions.length > 1 ? " +" : "";
  return `${COMPACT_ACTION_LABELS[locale][primaryAction]}${additionalActionsLabel}`;
}

function getCalendarCellDisplaySnapshot({
  monthDecisionCount,
  monthLoadState,
  selectedReadyDateInDisplayedMonth,
  selectedDisplayLoadState,
  snapshot,
}: {
  monthDecisionCount: number;
  monthLoadState: MonthLoadState;
  selectedReadyDateInDisplayedMonth: boolean;
  selectedDisplayLoadState: DetailLoadState;
  snapshot: CalendarDateSnapshot;
}): CalendarDateSnapshot {
  if (
    snapshot.status !== "loading" ||
    monthLoadState !== "partial" ||
    monthDecisionCount <= 0 ||
    selectedDisplayLoadState !== "ready" ||
    !selectedReadyDateInDisplayedMonth
  ) {
    return snapshot;
  }

  return {
    ...snapshot,
    status: "partial",
  };
}

function getCalendarCellDecisionLabel(
  snapshot: CalendarDateSnapshot,
  copy: ReturnType<typeof useAppState>["t"]["signalReview"],
) {
  if (snapshot.decisionCount > 0) {
    return `${snapshot.decisionCount} ${copy.labels.decisions}`;
  }

  if (snapshot.status === "empty") return copy.status.empty;
  if (snapshot.status === "loading") return copy.status.pending;
  return getStatusLabel(snapshot.status, copy);
}

function getCompactCalendarCellDecisionLabel(snapshot: CalendarDateSnapshot) {
  if (snapshot.decisionCount > 0) return formatCompactCalendarNumber(snapshot.decisionCount);
  return "";
}

function getCalendarCellActionMixLabel(
  snapshot: CalendarDateSnapshot,
  copy: ReturnType<typeof useAppState>["t"]["signalReview"],
) {
  if (snapshot.decisionCount > 0) return getActionMixLabel(snapshot.actionCounts, copy);
  if (snapshot.status === "empty") return copy.status.empty;
  return getStatusLabel(snapshot.status, copy);
}

function getCompactCalendarCellActionMixLabel(snapshot: CalendarDateSnapshot, locale: Locale) {
  if (snapshot.decisionCount > 0) return getCompactActionMixLabel(snapshot.actionCounts, locale);
  return "";
}

function getCalendarCellAriaLabel({
  copy,
  dateKey,
  snapshot,
}: {
  copy: ReturnType<typeof useAppState>["t"]["signalReview"];
  dateKey: string;
  snapshot: CalendarDateSnapshot | null;
}) {
  if (!snapshot) return dateKey;

  const labels = [dateKey, getStatusLabel(snapshot.status, copy)];
  if (snapshot.decisionCount > 0) {
    labels.push(getCalendarCellDecisionLabel(snapshot, copy), getCalendarCellActionMixLabel(snapshot, copy));
  }

  return Array.from(new Set(labels.filter(Boolean))).join(" ");
}

function getStatusToneClass(status: DateSnapshotStatus | SignalDeciderFeedbackStatus) {
  if (status === "reviewed" || status === "completed") return styles.positiveTone;
  if (status === "partial" || status === "needs-review" || status === "stored") return styles.warningTone;
  if (status === "unavailable") return styles.negativeTone;
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

function getCalendarActionLabel(
  action: SignalDeciderAction,
  copy: ReturnType<typeof useAppState>["t"]["signalReview"],
) {
  if (action === "buy") return copy.actions.buy;
  if (action === "wait") return copy.actions.wait;
  if (action === "reject") return copy.actions.reject;
  if (action === "unknown") return copy.actions.unknown;
  return formatSignalDeciderActionLabel(action);
}

function formatSignedPercent(value: number | null) {
  if (value === null) return UNKNOWN_LABEL;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatCurrencyValue(value: number | null) {
  return value === null ? UNKNOWN_LABEL : `₩${formatPrice(value)}`;
}

function formatScore(value: number | null) {
  return value === null ? UNKNOWN_LABEL : `${value}/10`;
}

function getStatusLabel(
  status: DateSnapshotStatus | SignalDeciderFeedbackStatus,
  copy: ReturnType<typeof useAppState>["t"]["signalReview"],
) {
  if (status === "completed") return copy.status.reviewed;
  if (status === "needs-review") return copy.status.needsReview;
  if (status === "running") return copy.status.loading;
  return copy.status[status];
}

function getSelectedDateDisplayStatus({
  loadState,
  selectedError,
  selectedSnapshot,
  summary,
}: {
  loadState: DetailLoadState;
  selectedError: string | null;
  selectedSnapshot: CalendarDateSnapshot | null;
  summary: SignalDeciderFeedbackSummaryModel;
}): SelectedDateDisplayStatus {
  if (loadState === "loading") return selectedSnapshot?.status === "unavailable" ? "unavailable" : "loading";
  if (loadState === "error") return "unavailable";
  if (loadState === "idle") return summary.status;
  if (selectedError) return "unavailable";
  if (selectedSnapshot?.status === "unavailable") return "unavailable";

  if (summary.resultCount <= 0) {
    if (
      selectedSnapshot?.status === "empty" ||
      selectedSnapshot?.status === "future" ||
      selectedSnapshot?.status === "partial"
    ) {
      return selectedSnapshot.status;
    }
    if (summary.status === "running" || summary.status === "partial" || summary.status === "needs-review") {
      return summary.status;
    }
    if (!selectedSnapshot || selectedSnapshot.status === "loading") return summary.status;
    return "empty";
  }

  return summary.status;
}

function getSelectedDateActionMixLabel({
  copy,
  displayStatus,
  summary,
}: {
  copy: ReturnType<typeof useAppState>["t"]["signalReview"];
  displayStatus: SelectedDateDisplayStatus;
  summary: SignalDeciderFeedbackSummaryModel;
}) {
  if (isSelectedDateMetricUnavailable(displayStatus)) return copy.status.unavailable;
  if (summary.resultCount > 0) return getActionMixLabel(summary.actionCounts, copy);
  if (displayStatus === "loading" || displayStatus === "running") return copy.status.pending;
  return getStatusLabel(displayStatus, copy);
}

function isSelectedDateMetricUnavailable(displayStatus: SelectedDateDisplayStatus) {
  return displayStatus === "unavailable";
}

function getSelectedDateCountMetricLabel({
  copy,
  count,
  displayStatus,
}: {
  copy: ReturnType<typeof useAppState>["t"]["signalReview"];
  count: number;
  displayStatus: SelectedDateDisplayStatus;
}) {
  if (isSelectedDateMetricUnavailable(displayStatus)) return copy.status.unavailable;
  return count.toLocaleString("en-US");
}

function getSelectedDatePrimaryHorizonMetricLabel({
  copy,
  counts,
  displayStatus,
}: {
  copy: ReturnType<typeof useAppState>["t"]["signalReview"];
  counts: ReturnType<typeof getPrimaryHorizonCounts>;
  displayStatus: SelectedDateDisplayStatus;
}) {
  if (isSelectedDateMetricUnavailable(displayStatus)) return copy.status.unavailable;

  return `${copy.outcomes.target} ${counts.target} · ${copy.outcomes.stop} ${counts.stop} · ${copy.outcomes.unresolved} ${counts.unresolved}`;
}

function getSelectedDatePendingHorizonMetricLabel({
  copy,
  counts,
  displayStatus,
}: {
  copy: ReturnType<typeof useAppState>["t"]["signalReview"];
  counts: ReturnType<typeof getPrimaryHorizonCounts>;
  displayStatus: SelectedDateDisplayStatus;
}) {
  if (isSelectedDateMetricUnavailable(displayStatus)) return copy.status.unavailable;

  return `${copy.horizons.pendingMaturity} ${counts.pending} · ${copy.horizons.insufficientData} ${counts.insufficient} · ${copy.horizons.notComputed} ${counts.notComputed}`;
}

function getSelectedDateShorterHorizonMetricLabel({
  copy,
  count,
  displayStatus,
}: {
  copy: ReturnType<typeof useAppState>["t"]["signalReview"];
  count: number;
  displayStatus: SelectedDateDisplayStatus;
}) {
  if (isSelectedDateMetricUnavailable(displayStatus)) return copy.status.unavailable;

  return copy.horizons.shorterComputed.replaceAll("{count}", count.toLocaleString("en-US"));
}

function getSelectedDateEmptyStateMessage({
  copy,
  displayStatus,
  selectedError,
}: {
  copy: ReturnType<typeof useAppState>["t"]["signalReview"];
  displayStatus: SelectedDateDisplayStatus;
  selectedError: string | null;
}) {
  if (displayStatus === "unavailable" && selectedError) {
    return selectedError;
  }
  if (displayStatus === "unavailable") {
    return copy.states.selectedUnavailable;
  }
  if (displayStatus === "loading" || displayStatus === "running") {
    return copy.states.loadingSelected;
  }
  return copy.states.emptySelected;
}

function getPrimaryHorizonCounts(items: SignalDeciderFeedbackItem[]) {
  return items.reduce(
    (counts, item) => {
      const primaryHorizon = getHorizonEvaluation(item, 5);
      if (primaryHorizon.state === "pending") {
        counts.pending += 1;
        return counts;
      }
      if (primaryHorizon.state === "insufficient") {
        counts.insufficient += 1;
        return counts;
      }
      if (primaryHorizon.state === "not-computed" || primaryHorizon.state === "unknown") {
        counts.notComputed += 1;
        return counts;
      }
      if (primaryHorizon.outcome === "target_hit") {
        counts.target += 1;
        return counts;
      }
      if (primaryHorizon.outcome === "stop_hit") {
        counts.stop += 1;
        return counts;
      }
      if (primaryHorizon.outcome === "ambiguous") {
        counts.ambiguous += 1;
        return counts;
      }
      if (primaryHorizon.outcome === "sideways") {
        counts.unresolved += 1;
        return counts;
      }
      counts.computed += 1;
      return counts;
    },
    { ambiguous: 0, computed: 0, insufficient: 0, notComputed: 0, pending: 0, stop: 0, target: 0, unresolved: 0 },
  );
}

function getShorterHorizonComputedCount(items: SignalDeciderFeedbackItem[]) {
  return items.filter((item) =>
    item.horizonEvaluations.some((horizon) => (horizon.day === 1 || horizon.day === 3) && horizon.state === "computed"),
  ).length;
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

function getHorizonStateLabel(
  horizon: SignalDeciderHorizonEvaluation,
  copy: ReturnType<typeof useAppState>["t"]["signalReview"],
) {
  if (horizon.state === "pending") return copy.horizons.pendingMaturity;
  if (horizon.state === "insufficient") return copy.horizons.insufficientData;
  if (horizon.state === "not-computed") return copy.horizons.notComputed;
  if (horizon.state === "unknown") return copy.horizons.unknown;
  return copy.horizons.evaluated;
}

function getHorizonChipLabel(
  horizon: SignalDeciderHorizonEvaluation,
  copy: ReturnType<typeof useAppState>["t"]["signalReview"],
) {
  if (horizon.state !== "computed") return getHorizonStateLabel(horizon, copy);
  if (horizon.outcome === "target_hit") return copy.outcomes.target;
  if (horizon.outcome === "stop_hit") return copy.outcomes.stop;
  if (horizon.outcome === "ambiguous") return copy.outcomes.ambiguous;
  if (horizon.outcome === null) return getHorizonStateLabel(horizon, copy);
  return copy.outcomes.unresolved;
}

function getLocalizedPendingReviewText(
  value: string,
  copy: ReturnType<typeof useAppState>["t"]["signalReview"],
) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  const pendingHorizonMatch = /^(?:the\s+)?(\d+)[-\s]?day replay window is not mature yet\.?$/.exec(normalized);
  if (pendingHorizonMatch?.[1]) {
    return `${pendingHorizonMatch[1]}D ${copy.horizons.pendingMaturity}`;
  }

  const provisionalHorizonMatch =
    /^(?:the\s+)?requested (\d+)[-\s]?day replay window is not fully observed yet, so the review remains provisional\.?$/.exec(
      normalized,
    );
  if (provisionalHorizonMatch?.[1]) {
    return copy.states.replayWindowProvisional.replaceAll("{days}", provisionalHorizonMatch[1]);
  }

  if (
    normalized === "pending maturity" ||
    normalized === "pending_maturity" ||
    normalized === "not mature" ||
    normalized === "not_mature" ||
    (normalized.includes("not mature") && normalized.includes("replay window"))
  ) {
    return copy.horizons.pendingMaturity;
  }

  if (
    normalized === "replay review is pending" ||
    normalized === "replay review is pending." ||
    normalized.includes("replay review is pending for the")
  ) {
    return copy.states.replayVerdictUnavailable;
  }

  return value;
}

function getCalendarReviewText(
  value: string | null | undefined,
  copy: ReturnType<typeof useAppState>["t"]["signalReview"],
) {
  return hasTextValue(value) ? getLocalizedPendingReviewText(value, copy) : null;
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

function getHorizonDetailLabel(
  horizon: SignalDeciderHorizonEvaluation,
  copy: ReturnType<typeof useAppState>["t"]["signalReview"],
) {
  const realizedReturn = horizon.returnPct !== null ? formatSignedPercent(horizon.returnPct) : null;
  if (horizon.state === "computed") {
    return realizedReturn !== UNKNOWN_LABEL ? realizedReturn : getCalendarReviewText(horizon.verdict ?? horizon.notes, copy);
  }
  if (horizon.state === "pending" && horizon.tradingDaysRemaining !== null) {
    return copy.horizons.daysRemaining.replaceAll(
      "{days}",
      horizon.tradingDaysRemaining.toLocaleString("en-US"),
    );
  }
  return getCalendarReviewText(horizon.notes, copy);
}

function getHorizonProgressSummary(
  item: SignalDeciderFeedbackItem,
  copy: ReturnType<typeof useAppState>["t"]["signalReview"],
) {
  return ([1, 3, 5] as const)
    .map((day) => {
      const horizon = getHorizonEvaluation(item, day);
      return `${horizon.label} ${getHorizonChipLabel(horizon, copy)}`;
    })
    .join(" · ");
}

function HorizonChip({
  copy,
  horizon,
  showDetail = false,
}: {
  copy: ReturnType<typeof useAppState>["t"]["signalReview"];
  horizon: SignalDeciderHorizonEvaluation;
  showDetail?: boolean;
}) {
  const detail = showDetail ? getHorizonDetailLabel(horizon, copy) : null;
  const icon = getHorizonOutcomeIcon(horizon);
  return (
    <span className={styles.horizonChip}>
      <span className={`pill ${getPillToneClass(horizon.tone)}`}>{horizon.label}</span>
      <span>{icon ? `${icon} ` : ""}{getHorizonChipLabel(horizon, copy)}</span>
      {detail ? <small>{detail}</small> : null}
    </span>
  );
}

function getStoredReviewSummary(item: SignalDeciderFeedbackItem) {
  return item.reviewConclusion ?? item.qualityReason ?? item.qualityVerdict ?? null;
}

function isPlainWaitPendingRow(item: SignalDeciderFeedbackItem) {
  return item.action === "wait" && item.pathOutcome === null && getStoredReviewSummary(item) === null;
}

function getDecisionRowDetailSummary(
  item: SignalDeciderFeedbackItem,
  copy: ReturnType<typeof useAppState>["t"]["signalReview"],
  status: SignalDeciderFeedbackStatus,
) {
  const summary = getStoredReviewSummary(item);
  if (summary) return getCalendarReviewText(summary, copy);
  if (isPlainWaitPendingRow(item) && status !== "needs-review") return null;
  return UNKNOWN_LABEL;
}

function getTableInsightSummary(
  item: SignalDeciderFeedbackItem,
  copy: ReturnType<typeof useAppState>["t"]["signalReview"],
  status: SignalDeciderFeedbackStatus,
) {
  const summary = getStoredReviewSummary(item);
  if (summary) return getCalendarReviewText(summary, copy);
  if (isPlainWaitPendingRow(item) && status !== "needs-review") return copy.status.pending;
  return UNKNOWN_LABEL;
}

function isDiagnosticRiskToken(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed === trimmed.toLowerCase() && /^[a-z0-9]+(?:[_-][a-z0-9]+)+$/.test(trimmed);
}

function humanizeRiskToken(value: string) {
  const label = value
    .trim()
    .split(/[_-]+/)
    .filter(Boolean)
    .join(" ");

  return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : "";
}

function splitRiskFlags(riskFlags: string[]) {
  return riskFlags.reduce(
    (groups, risk) => {
      if (isDiagnosticRiskToken(risk)) {
        const label = humanizeRiskToken(risk);
        if (label && !groups.diagnosticRiskTags.includes(label)) groups.diagnosticRiskTags.push(label);
        return groups;
      }

      if (!groups.operatorRiskContext.includes(risk)) groups.operatorRiskContext.push(risk);
      return groups;
    },
    { diagnosticRiskTags: [] as string[], operatorRiskContext: [] as string[] },
  );
}

function buildSymbolHref(item: SignalDeciderFeedbackItem) {
  const params = new URLSearchParams();
  const companyName = getDistinctCompanyName(item.symbol, item.companyName);
  if (hasTextValue(companyName)) params.set("name", companyName);
  if (hasTextValue(item.marketDate)) params.set("marketDate", item.marketDate);
  params.set(SYMBOL_DETAIL_NAV_CONTEXT_PARAM, SYMBOL_DETAIL_CALENDAR_NAV_CONTEXT);
  const query = params.toString();
  return `/dashboard/symbol/${encodeURIComponent(item.symbol)}${query ? `?${query}` : ""}`;
}

function getFocusableDetailDialogElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(DETAIL_DIALOG_FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.closest("[aria-hidden='true'], [inert]")) return false;
    const styles = window.getComputedStyle(element);
    return styles.display !== "none" && styles.visibility !== "hidden";
  });
}

function getSelectedDateHeader(
  selectedDate: string | null,
  copy: ReturnType<typeof useAppState>["t"]["signalReview"],
) {
  return selectedDate ?? copy.status.pending;
}

export default function SignalReviewCalendarPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedDate = searchParams.get("date");
  const requestedDateKey = parseCompactDateValue(requestedDate);
  const [todayKey, setTodayKey] = useState(() => getTodayDateKey());
  const initialDate = requestedDateKey;
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const [monthKey, setMonthKey] = useState(getMonthKey(initialDate ?? todayKey));
  const [monthLoadState, setMonthLoadState] = useState<MonthLoadState>("idle");
  const [monthSnapshots, setMonthSnapshots] = useState<Record<string, CalendarDateSnapshot>>({});
  const [selectedFeedback, setSelectedFeedback] = useState<AgentFeedbackListResponseDto | null>(null);
  const [selectedProgress, setSelectedProgress] = useState<AgentFeedbackProgressResponseDto | null>(null);
  const [selectedDataDate, setSelectedDataDate] = useState<string | null>(null);
  const [latestUsableFeedbackDate, setLatestUsableFeedbackDate] = useState<string | null>(null);
  const [selectedLoadState, setSelectedLoadState] = useState<DetailLoadState>(initialDate ? "loading" : "idle");
  const [selectedError, setSelectedError] = useState<string | null>(null);
  const [progressUnavailable, setProgressUnavailable] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const detailOpenerRef = useRef<HTMLElement | null>(null);
  const shouldRestoreDetailFocusRef = useRef(false);
  const { devMode, locale, t } = useAppState();
  const copy = t.signalReview;
  const selectedUnavailable = copy.states.selectedUnavailable;
  const feedbackDate = useMemo(() => parseCompactDateValue(selectedDate), [selectedDate]);
  const refreshLatestUsableFeedbackDate = useCallback(() => {
    const latestEntry = readLatestSignalDeciderFeedbackCacheByMarketDate();
    const nextLatestDate = latestEntry?.marketDate ?? null;
    setLatestUsableFeedbackDate((current) => (current === nextLatestDate ? current : nextLatestDate));
  }, []);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) return;
      refreshLatestUsableFeedbackDate();
    });

    return () => {
      active = false;
    };
  }, [refreshLatestUsableFeedbackDate]);

  useEffect(() => {
    const refreshTodayKey = () => {
      const nextTodayKey = getTodayDateKey();
      setTodayKey((current) => (current === nextTodayKey ? current : nextTodayKey));
    };

    refreshTodayKey();
    const intervalId = window.setInterval(refreshTodayKey, PRODUCT_DATE_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) return;

      if (requestedDateKey) {
        setSelectedDate((current) => (current === requestedDateKey ? current : requestedDateKey));
        setMonthKey((current) => {
          const nextMonthKey = getMonthKey(requestedDateKey);
          return current === nextMonthKey ? current : nextMonthKey;
        });
        return;
      }

      setSelectedDate((current) => (current === null ? current : null));
    });

    return () => {
      active = false;
    };
  }, [requestedDate, requestedDateKey]);

  useEffect(() => {
    if (selectedDate) return;

    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setSelectedDate(todayKey);
      setMonthKey(getMonthKey(todayKey));
      router.replace(`/calendar?date=${encodeURIComponent(todayKey)}`);
    });

    return () => {
      active = false;
    };
  }, [router, selectedDate, todayKey]);

  useEffect(() => {
    let active = true;

    const loadMonth = async () => {
      const monthDays = buildCalendarDays(monthKey, todayKey).filter((day) => day.inMonth && !day.isFuture);
      const cachedEntries = readSignalDeciderFeedbackCacheForMonth(monthKey);
      const cachedByDate = new Map(cachedEntries.map((entry) => [entry.marketDate, entry]));
      const loadingSnapshots = monthDays.reduce<Record<string, CalendarDateSnapshot>>((snapshots, day) => {
        const cachedSnapshot = cachedByDate.get(day.dateKey);
        snapshots[day.dateKey] = cachedSnapshot
          ? buildDateSnapshot(day.dateKey, cachedSnapshot.feedback)
          : buildLoadingDateSnapshot(day.dateKey);
        return snapshots;
      }, {});
      setMonthLoadState("loading");
      setMonthSnapshots((current) => {
        const next = { ...current };
        for (const day of monthDays) {
          next[day.dateKey] = loadingSnapshots[day.dateKey];
        }
        return next;
      });
      const monthSummaryQuery = buildCalendarSummaryQuery({
        month: monthKey,
      });
      const monthSummaryPath = `${SIGNAL_DECIDER_CALENDAR_SUMMARY_CLIENT_PATH}?${monthSummaryQuery}`;

      try {
        const calendarSummary = await getSignalDeciderReviewJson<SignalDeciderCalendarSummaryResponse>(
          monthSummaryPath,
          { timeoutMs: SIGNAL_REVIEW_READ_TIMEOUT_MS },
        );
        if (!active) return;

        const summaryByDate = new Map<string, SignalDeciderCalendarSummaryResponse["items"][number]>();
        for (const item of calendarSummary.items ?? []) {
          const dateKey = parseCompactDateValue(item.market_date);
          if (dateKey) {
            summaryByDate.set(dateKey, item);
          }
        }

        const nextSnapshots = monthDays.reduce<Record<string, CalendarDateSnapshot>>((snapshots, day) => {
          const summaryItem = summaryByDate.get(day.dateKey) ?? null;
          const cachedSnapshot = cachedByDate.get(day.dateKey) ?? null;
          snapshots[day.dateKey] = buildDateSnapshotFromCalendarSummary({
            dateKey: day.dateKey,
            summaryItem,
            fallbackFeedback: cachedSnapshot?.feedback ?? null,
          });
          return snapshots;
        }, {});
        setMonthSnapshots((current) => ({ ...current, ...nextSnapshots }));
        setMonthLoadState(
          getMonthLoadStateFromSnapshots({
            monthDays,
            snapshots: { ...loadingSnapshots, ...nextSnapshots },
          }),
        );
        return;
      } catch {
        if (!active) return;
      }

      const nextSnapshots = { ...loadingSnapshots };
      const fallbackSnapshots = monthDays.map(async (day) => {
        const cachedSnapshot = cachedByDate.get(day.dateKey) ?? null;
        try {
          const feedback = await getSignalDeciderReviewJson<AgentFeedbackListResponseDto>(
            buildSignalDeciderFeedbackPath({
              basePath: SIGNAL_DECIDER_FEEDBACK_CLIENT_PATH,
              limit: SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
              marketDate: day.dateKey,
            }),
            { timeoutMs: SIGNAL_REVIEW_READ_TIMEOUT_MS },
          );
          const selectedFeedback = selectSignalDeciderFeedbackResponse({
            cached: cachedSnapshot,
            fetched: feedback,
          });
          if (selectedFeedback === feedback) {
            const wroteCache = writeSignalDeciderFeedbackCache({
              feedback,
              marketDate: day.dateKey,
              progress: null,
              source: "calendar",
            });
            if (wroteCache) refreshLatestUsableFeedbackDate();
          }
          return buildDateSnapshot(day.dateKey, selectedFeedback);
        } catch (error) {
          if (cachedSnapshot) return buildDateSnapshot(day.dateKey, cachedSnapshot.feedback);
          return buildDateSnapshot(
            day.dateKey,
            null,
            error instanceof Error ? error.message : copy.states.unavailableMonth,
          );
        }
      });

      await Promise.all(
        fallbackSnapshots.map((snapshotPromise) =>
          snapshotPromise.then((snapshot) => {
            if (!active) return;
            nextSnapshots[snapshot.dateKey] = snapshot;
            setMonthSnapshots((current) => ({ ...current, [snapshot.dateKey]: snapshot }));
            setMonthLoadState(getMonthLoadStateFromSnapshots({ monthDays, snapshots: nextSnapshots }));
          }),
        ),
      );
      if (!active) return;
      setMonthSnapshots((current) => ({ ...current, ...nextSnapshots }));
      setMonthLoadState(getMonthLoadStateFromSnapshots({ monthDays, snapshots: nextSnapshots }));
    };

    void loadMonth();

    return () => {
      active = false;
    };
  }, [copy.states.unavailableMonth, monthKey, refreshLatestUsableFeedbackDate, todayKey]);

  useEffect(() => {
    if (!selectedDate) return;

    let active = true;
    const cachedSnapshot = readSignalDeciderFeedbackCache(selectedDate);

    const loadSelectedDate = async () => {
      setSelectedLoadState(cachedSnapshot ? "ready" : "loading");
      setSelectedError(null);
      setProgressUnavailable(cachedSnapshot ? cachedSnapshot.progress === null : false);
      setSelectedFeedback(cachedSnapshot?.feedback ?? null);
      setSelectedProgress(cachedSnapshot?.progress ?? null);
      setSelectedDataDate(cachedSnapshot ? selectedDate : null);
      setSelectedItemId(null);

      const selectedProgressPromise = getSignalDeciderReviewJson<AgentFeedbackProgressResponseDto>(
        `/api/trading/agent-context/feedback/progress?market_date=${encodeURIComponent(selectedDate)}`,
        { timeoutMs: SIGNAL_REVIEW_READ_TIMEOUT_MS },
      ).catch(() => null);
      const reviewDatePath = `${SIGNAL_DECIDER_FEEDBACK_REVIEW_DATE_CLIENT_PATH}?${buildReviewDateQuery({
        marketDate: selectedDate,
      })}`;

      try {
        const [reviewDateResponse] = await Promise.all([
          getSignalDeciderReviewJson<SignalDeciderReviewDateResponse>(reviewDatePath, {
            timeoutMs: SIGNAL_REVIEW_READ_TIMEOUT_MS,
          }),
        ]);
        const feedback = buildSignalDeciderFeedbackListFromReviewDateResponse({
          response: reviewDateResponse,
          fallbackMarketDate: selectedDate,
        });
        const selectedProgress = await selectedProgressPromise;
        if (!active) return;
        const selectedFeedback = selectSignalDeciderFeedbackResponse({
          cached: cachedSnapshot,
          fetched: feedback,
        });
        const selectedProgressFallback = selectedFeedback === cachedSnapshot?.feedback ? (selectedProgress ?? cachedSnapshot.progress) : selectedProgress;
        setSelectedFeedback(selectedFeedback);
        setSelectedProgress(selectedProgressFallback);
        setSelectedDataDate(selectedDate);
        setProgressUnavailable(selectedProgressFallback === null);
        setSelectedLoadState("ready");
        setSelectedError(null);
        if (selectedFeedback === feedback) {
          const wroteCache = writeSignalDeciderFeedbackCache({
            feedback,
            marketDate: selectedDate,
            progress: selectedProgress,
            source: "calendar",
          });
          if (wroteCache) refreshLatestUsableFeedbackDate();
        }
      } catch (error) {
        try {
          const [feedback] = await Promise.all([
            getSignalDeciderReviewJson<AgentFeedbackListResponseDto>(
              buildSignalDeciderFeedbackPath({
                basePath: SIGNAL_DECIDER_FEEDBACK_CLIENT_PATH,
                limit: SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
                marketDate: selectedDate,
              }),
              { timeoutMs: SIGNAL_REVIEW_READ_TIMEOUT_MS },
            ),
          ]);
          const progress = await selectedProgressPromise;
          if (!active) return;
          const selectedFeedback = selectSignalDeciderFeedbackResponse({
            cached: cachedSnapshot,
            fetched: feedback,
          });
          const selectedProgress = selectedFeedback === cachedSnapshot?.feedback ? (progress ?? cachedSnapshot.progress) : progress;
          const selectedReviewError =
            error instanceof Error
              ? shouldSuppressSelectedDateReviewFallbackError({ errorMessage: error.message, devMode })
                ? null
                : getUserFacingSelectedDateReviewError({
                    errorMessage: error.message,
                    selectedUnavailable,
                    devMode,
                  })
              : selectedUnavailable;
          setSelectedFeedback(selectedFeedback);
          setSelectedProgress(selectedProgress);
          setSelectedDataDate(selectedDate);
          setProgressUnavailable(selectedProgress === null);
          setSelectedLoadState("ready");
          setSelectedError(selectedReviewError);
          if (selectedFeedback === feedback) {
            const wroteCache = writeSignalDeciderFeedbackCache({
              feedback,
              marketDate: selectedDate,
              progress,
              source: "calendar",
            });
            if (wroteCache) refreshLatestUsableFeedbackDate();
          }
          return;
        } catch (fallbackError) {
          if (!active) return;
          if (cachedSnapshot) {
            setSelectedFeedback(cachedSnapshot.feedback);
            setSelectedProgress(cachedSnapshot.progress);
            setSelectedDataDate(selectedDate);
            setProgressUnavailable(cachedSnapshot.progress === null);
            setSelectedLoadState("ready");
            setSelectedError(
              fallbackError instanceof Error
                ? getUserFacingSelectedDateReviewError({
                  errorMessage: fallbackError.message,
                  selectedUnavailable,
                  devMode,
                })
                : selectedUnavailable,
            );
            return;
          }
          setSelectedFeedback(null);
          setSelectedProgress(null);
          setSelectedDataDate(selectedDate);
          setSelectedLoadState("error");
          setSelectedError(
            fallbackError instanceof Error
                ? getUserFacingSelectedDateReviewError({
                  errorMessage: fallbackError.message,
                  selectedUnavailable,
                  devMode,
                })
              : selectedUnavailable,
          );
        }
      }
    };

    void loadSelectedDate();

    return () => {
      active = false;
    };
  }, [selectedUnavailable, devMode, refreshLatestUsableFeedbackDate, selectedDate]);

  const calendarDays = useMemo(() => buildCalendarDays(monthKey, todayKey), [monthKey, todayKey]);
  const selectedDataMatchesDate = selectedDate !== null && selectedDataDate === selectedDate;
  const selectedDisplayLoadState: DetailLoadState =
    selectedDate === null ? "idle" : selectedDataMatchesDate ? selectedLoadState : "loading";
  const selectedSummary = useMemo(
    () =>
      buildSignalDeciderFeedbackSummary({
        feedback: selectedDisplayLoadState === "ready" ? selectedFeedback : null,
        marketDate: selectedDate,
        progress: selectedDisplayLoadState === "ready" ? selectedProgress : null,
        previewLimit: SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
      }),
    [selectedDate, selectedDisplayLoadState, selectedFeedback, selectedProgress],
  );
  const selectedItem = useMemo(
    () =>
      selectedDisplayLoadState === "ready"
        ? (selectedSummary.items.find((item) => item.id === selectedItemId) ?? null)
        : null,
    [selectedDisplayLoadState, selectedItemId, selectedSummary.items],
  );
  const reviewCount = useMemo(() => getReviewEvidenceCount(selectedSummary.items), [selectedSummary.items]);
  const primaryHorizonCounts = useMemo(() => getPrimaryHorizonCounts(selectedSummary.items), [selectedSummary.items]);
  const shorterHorizonComputedCount = useMemo(
    () => getShorterHorizonComputedCount(selectedSummary.items),
    [selectedSummary.items],
  );
  const monthDecisionCount = useMemo(
    () =>
      Object.values(monthSnapshots)
        .filter((snapshot) => snapshot.dateKey.startsWith(monthKey))
        .reduce((sum, snapshot) => sum + snapshot.decisionCount, 0),
    [monthKey, monthSnapshots],
  );
  const selectedReadyDateInDisplayedMonth =
    selectedDate !== null && selectedDisplayLoadState === "ready" && getMonthKey(selectedDate) === monthKey;
  const selectedSnapshot = selectedDate ? (monthSnapshots[selectedDate] ?? null) : null;
  const selectedDisplayStatus = getSelectedDateDisplayStatus({
    loadState: selectedDisplayLoadState,
    selectedError,
    selectedSnapshot,
    summary: selectedSummary,
  });
  const selectedDateUnavailable = isSelectedDateMetricUnavailable(selectedDisplayStatus);
  const selectedActionMixLabel = getSelectedDateActionMixLabel({
    copy,
    displayStatus: selectedDisplayStatus,
    summary: selectedSummary,
  });
  const selectedResultCountLabel = getSelectedDateCountMetricLabel({
    copy,
    count: selectedSummary.resultCount,
    displayStatus: selectedDisplayStatus,
  });
  const selectedReviewCountLabel = getSelectedDateCountMetricLabel({
    copy,
    count: reviewCount,
    displayStatus: selectedDisplayStatus,
  });
  const selectedPrimaryHorizonMetricLabel = getSelectedDatePrimaryHorizonMetricLabel({
    copy,
    counts: primaryHorizonCounts,
    displayStatus: selectedDisplayStatus,
  });
  const selectedPendingHorizonMetricLabel = getSelectedDatePendingHorizonMetricLabel({
    copy,
    counts: primaryHorizonCounts,
    displayStatus: selectedDisplayStatus,
  });
  const selectedShorterHorizonMetricLabel = getSelectedDateShorterHorizonMetricLabel({
    copy,
    count: shorterHorizonComputedCount,
    displayStatus: selectedDisplayStatus,
  });
  const selectedEmptyStateMessage = getSelectedDateEmptyStateMessage({
    copy,
    displayStatus: selectedDisplayStatus,
    selectedError,
  });
  const selectedFeedbackNavigationBlocked =
    !feedbackDate ||
    selectedDisplayLoadState === "idle" ||
    selectedDisplayLoadState === "loading" ||
    (selectedDateUnavailable && selectedSummary.items.length === 0);
  const latestUsableFeedbackCtaDate =
    selectedFeedbackNavigationBlocked && latestUsableFeedbackDate && latestUsableFeedbackDate !== feedbackDate
      ? latestUsableFeedbackDate
      : null;
  const feedbackCtaHref = selectedFeedbackNavigationBlocked
    ? latestUsableFeedbackCtaDate
      ? buildSignalDeciderFeedbackHref(latestUsableFeedbackCtaDate, {
          navContext: DECIDER_FEEDBACK_CALENDAR_NAV_CONTEXT,
        })
      : null
    : buildSignalDeciderFeedbackHref(feedbackDate, { navContext: DECIDER_FEEDBACK_CALENDAR_NAV_CONTEXT });
  const feedbackCtaState = selectedFeedbackNavigationBlocked
    ? latestUsableFeedbackCtaDate
      ? "latest"
      : "disabled"
    : "selected";
  const feedbackCtaLabel =
    feedbackCtaState === "latest"
      ? copy.actions.openLatestFeedback
      : feedbackCtaState === "disabled"
        ? copy.actions.feedbackUnavailable
        : copy.actions.openFeedback;
  const feedbackCtaNotice =
    feedbackCtaState === "latest" && latestUsableFeedbackCtaDate
      ? copy.states.openLatestFeedback.replaceAll("{marketDate}", latestUsableFeedbackCtaDate)
      : feedbackCtaState === "disabled"
        ? copy.states.feedbackTableUnavailable
        : null;

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) return;

      const monthDays = calendarDays.filter((day) => day.inMonth && !day.isFuture);
      const nextMonthLoadState = getMonthLoadStateFromSnapshots({
        monthDays,
        snapshots: monthSnapshots,
      });
      setMonthLoadState((current) => (current === nextMonthLoadState ? current : nextMonthLoadState));
    });

    return () => {
      active = false;
    };
  }, [calendarDays, monthSnapshots]);

  useEffect(() => {
    if (!selectedDate || selectedDisplayLoadState !== "ready" || getMonthKey(selectedDate) !== monthKey) return;

    let active = true;

    queueMicrotask(() => {
      if (!active) return;

      const selectedSnapshot = buildDateSnapshot(selectedDate, selectedFeedback);
      setMonthSnapshots((current) => {
        const currentSnapshot = current[selectedDate];
        const currentSnapshotUnresolved = !currentSnapshot || currentSnapshot.status === "loading";
        if (
          currentSnapshotUnresolved &&
          selectedSnapshot.decisionCount <= 0 &&
          selectedSummary.status === "running"
        ) {
          return current;
        }

        if (currentSnapshot?.status === "unavailable" && selectedSnapshot.decisionCount <= 0) {
          return current;
        }

        if (
          currentSnapshot &&
          currentSnapshot.status !== "loading" &&
          currentSnapshot.status !== "unavailable" &&
          currentSnapshot.decisionCount >= selectedSnapshot.decisionCount
        ) {
          return current;
        }

        return {
          ...current,
          [selectedDate]: selectedSnapshot,
        };
      });
    });

    return () => {
      active = false;
    };
  }, [monthKey, selectedDate, selectedDisplayLoadState, selectedFeedback, selectedSummary.status]);

  function handleSelectDate(dateKey: string) {
    setSelectedDate(dateKey);
    setMonthKey(getMonthKey(dateKey));
    router.push(`/calendar?date=${encodeURIComponent(dateKey)}`);
  }

  function handleSelectToday() {
    const nextTodayKey = getTodayDateKey();
    setTodayKey((current) => (current === nextTodayKey ? current : nextTodayKey));
    handleSelectDate(nextTodayKey);
  }

  function handleMonthChange(delta: number) {
    const nextMonthKey = addMonths(monthKey, delta);
    handleSelectDate(getMonthNavigationDate(nextMonthKey, selectedDate, todayKey));
  }

  const openDetailPanel = useCallback((itemId: string) => {
    detailOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    shouldRestoreDetailFocusRef.current = false;
    setSelectedItemId(itemId);
  }, []);

  const closeDetailPanel = useCallback(() => {
    shouldRestoreDetailFocusRef.current = true;
    setSelectedItemId(null);
  }, []);

  useEffect(() => {
    if (selectedItemId !== null || !shouldRestoreDetailFocusRef.current) return;

    shouldRestoreDetailFocusRef.current = false;
    const opener = detailOpenerRef.current;
    detailOpenerRef.current = null;
    if (opener?.isConnected) {
      opener.focus({ preventScroll: true });
    }
  }, [selectedItemId]);

  function renderCalendarCell(day: CalendarDay) {
    const rawSnapshot = day.inMonth
      ? monthSnapshots[day.dateKey] ?? {
          actionCounts: { ...EMPTY_ACTION_COUNTS },
          dateKey: day.dateKey,
          decisionCount: 0,
          error: null,
          reviewCount: 0,
          status: day.isFuture ? "future" : "loading",
        }
      : null;
    const snapshot = rawSnapshot
      ? getCalendarCellDisplaySnapshot({
          monthDecisionCount,
          monthLoadState,
          selectedReadyDateInDisplayedMonth,
          selectedDisplayLoadState,
          snapshot: rawSnapshot,
        })
      : null;
    const active = day.dateKey === selectedDate;
    const disabled = !day.inMonth || day.isFuture;
    const statusLabel = snapshot ? getStatusLabel(snapshot.status, copy) : "";
    const decisionLabel = snapshot ? getCalendarCellDecisionLabel(snapshot, copy) : "";
    const actionMixLabel = snapshot ? getCalendarCellActionMixLabel(snapshot, copy) : "";
    const compactStatusLabel = snapshot ? getCompactStatusLabel(snapshot.status, locale) : "";
    const compactDecisionLabel = snapshot ? getCompactCalendarCellDecisionLabel(snapshot) : "";
    const compactActionMixLabel = snapshot ? getCompactCalendarCellActionMixLabel(snapshot, locale) : "";
    const ariaLabel = getCalendarCellAriaLabel({ copy, dateKey: day.dateKey, snapshot });

    return (
      <button
        key={day.dateKey}
        type="button"
        className={`${styles.dayCell} ${!day.inMonth ? styles.outsideMonth : ""} ${active ? styles.selectedDay : ""}`.trim()}
        data-calendar-cell={day.dateKey}
        disabled={disabled}
        aria-pressed={active || undefined}
        aria-label={ariaLabel}
        onClick={() => handleSelectDate(day.dateKey)}
      >
        <span className={styles.dayNumber}>{day.dayNumber}</span>
        {snapshot ? (
          <>
            <span className={`${styles.dayStatus} ${getStatusToneClass(snapshot.status)}`} data-calendar-cell-label="status">
              <span
                className={styles.dayCellTextFull}
                data-calendar-cell-label="full"
                data-calendar-label-variant="full"
              >
                {statusLabel}
              </span>
              <span
                className={styles.dayCellTextCompact}
                data-calendar-cell-label="compact"
                data-calendar-label-variant="compact"
              >
                {compactStatusLabel}
              </span>
            </span>
            <strong
              data-calendar-cell-label="count"
              data-calendar-compact-empty={compactDecisionLabel ? undefined : "true"}
            >
              <span
                className={styles.dayCellTextFull}
                data-calendar-cell-label="full"
                data-calendar-label-variant="full"
              >
                {decisionLabel}
              </span>
              <span
                className={styles.dayCellTextCompact}
                data-calendar-cell-label="compact"
                data-calendar-label-variant="compact"
              >
                {compactDecisionLabel}
              </span>
            </strong>
            <small
              data-calendar-cell-label="action-mix"
              data-calendar-compact-empty={compactActionMixLabel ? undefined : "true"}
            >
              <span
                className={styles.dayCellTextFull}
                data-calendar-cell-label="full"
                data-calendar-label-variant="full"
              >
                {actionMixLabel}
              </span>
              <span
                className={styles.dayCellTextCompact}
                data-calendar-cell-label="compact"
                data-calendar-label-variant="compact"
              >
                {compactActionMixLabel}
              </span>
            </small>
          </>
        ) : null}
      </button>
    );
  }

  return (
    <MobileAppChrome
      chrome={{
        activeNav: "calendar",
        contentScrollMode: "contained",
        modalLayer: selectedItem ? (
          <DetailPanel copy={copy} item={selectedItem} onClose={closeDetailPanel} status={selectedSummary} />
        ) : null,
        modalOpen: Boolean(selectedItem),
        title: t.mobileChrome.calendar,
        subtitle: getSelectedDateHeader(selectedDate, copy),
      }}
    >
      <div className={styles.stack}>
        <section className={styles.heroPanel}>
          <div className={styles.heroCopy}>
            <ComponentTag
              label="calendar.signal-review"
              api="/api/trading/agent-context/feedback + /api/trading/agent-context/feedback/progress + /api/trading/agent-context/feedback/calendar + /api/trading/agent-context/feedback/review"
            />
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1 className={styles.pageTitle}>{copy.title}</h1>
            <p className={styles.pageCopy}>{copy.heroCopy}</p>
          </div>

          <div className={styles.heroActionStack}>
            <div className={styles.heroActions}>
              {feedbackCtaHref ? (
                <DocumentRouteLink
                  href={feedbackCtaHref}
                  className={styles.secondaryLink}
                  data-calendar-feedback-cta-state={feedbackCtaState}
                  data-testid="calendar-feedback-cta"
                >
                  {feedbackCtaLabel}
                </DocumentRouteLink>
              ) : (
                <button
                  type="button"
                  className={`${styles.secondaryLink} ${styles.disabledSecondaryLink}`}
                  data-calendar-feedback-cta-state={feedbackCtaState}
                  data-testid="calendar-feedback-cta"
                  disabled
                >
                  {feedbackCtaLabel}
                </button>
              )}
              <Link href="/dashboard" className={styles.secondaryLink}>
                {copy.actions.backDashboard}
              </Link>
            </div>
            {feedbackCtaNotice ? (
              <p className={styles.feedbackRecoveryNotice} data-testid="calendar-feedback-recovery-notice">
                {feedbackCtaNotice}
              </p>
            ) : null}
          </div>
        </section>

        <section className={styles.workspaceGrid}>
          <div className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>{copy.calendar.eyebrow}</p>
                <h2>{formatMonthLabel(monthKey)}</h2>
              </div>
              <div className={styles.monthControls}>
                <button type="button" onClick={() => handleMonthChange(-1)} aria-label={copy.actions.previousMonth}>
                  ←
                </button>
                <button type="button" onClick={handleSelectToday}>
                  {copy.actions.today}
                </button>
                <button type="button" onClick={() => handleMonthChange(1)} aria-label={copy.actions.nextMonth}>
                  →
                </button>
              </div>
            </header>

            <div className={styles.monthStateRow} data-testid="calendar-month-state">
              <span
                className={`${styles.dayStatus} ${monthLoadState === "partial" ? styles.warningTone : styles.neutralTone}`}
                data-testid="calendar-month-status"
              >
                {monthLoadState === "loading"
                  ? copy.states.loadingMonth
                  : monthLoadState === "partial"
                    ? copy.states.partialMonth
                    : monthLoadState === "unavailable"
                      ? copy.states.unavailableMonth
                      : copy.states.readyMonth}
              </span>
              <strong>{monthDecisionCount.toLocaleString("en-US")} {copy.labels.monthDecisions}</strong>
            </div>

            <div className={styles.weekHeader} aria-hidden="true">
              {WEEKDAY_KEYS.map((day) => (
                <span key={day}>{copy.weekdays[day]}</span>
              ))}
            </div>
            <div className={styles.calendarGrid} data-calendar-grid>
              {calendarDays.map(renderCalendarCell)}
            </div>
          </div>

          <aside className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>{copy.selected.eyebrow}</p>
                <h2>{selectedDate ?? copy.status.pending}</h2>
              </div>
              <span
                className={`${styles.dayStatus} ${getStatusToneClass(selectedDisplayStatus)}`}
                data-selected-date-status={selectedDisplayStatus}
              >
                {getStatusLabel(selectedDisplayStatus, copy)}
              </span>
            </header>

            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}>
                <span>{copy.summary.total}</span>
                <strong>{selectedResultCountLabel}</strong>
              </div>
              <div className={styles.summaryCard}>
                <span>{copy.summary.actionMix}</span>
                <strong>{selectedActionMixLabel}</strong>
              </div>
              <div className={styles.summaryCard}>
                <span>{copy.summary.reviewed}</span>
                <strong>{selectedReviewCountLabel}</strong>
              </div>
              <div className={styles.summaryCard}>
                <span>{copy.summary.primary5d}</span>
                <strong>{selectedPrimaryHorizonMetricLabel}</strong>
              </div>
              <div className={styles.summaryCard}>
                <span>{copy.summary.pendingMaturity}</span>
                <strong>{selectedPendingHorizonMetricLabel}</strong>
              </div>
              <div className={styles.summaryCard}>
                <span>{copy.summary.shorterHorizons}</span>
                <strong>{selectedShorterHorizonMetricLabel}</strong>
              </div>
            </div>

            {progressUnavailable && selectedDisplayLoadState === "ready" && !selectedDateUnavailable ? (
              <div className={styles.inlineNotice}>{copy.states.progressUnavailable}</div>
            ) : null}

            {selectedDateUnavailable ? (
              <div className={styles.emptyState}>{selectedEmptyStateMessage}</div>
            ) : selectedDisplayLoadState === "loading" ? (
              <div className={styles.emptyState}>{copy.states.loadingSelected}</div>
            ) : selectedDisplayLoadState === "error" ? (
              <div className={styles.emptyState}>{selectedError ?? copy.states.selectedUnavailable}</div>
            ) : selectedSummary.items.length === 0 ? (
              <div className={styles.emptyState}>{selectedEmptyStateMessage}</div>
            ) : (
              <div className={styles.decisionList}>
                {selectedSummary.items.map((item) => {
                  const decisionRowDetail = getDecisionRowDetailSummary(item, copy, selectedSummary.status);
                  const identity = getDecisionIdentity(item, copy);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`${styles.decisionRow} ${selectedItemId === item.id ? styles.selectedDecision : ""}`.trim()}
                      onClick={() => openDetailPanel(item.id)}
                    >
                      <span className={styles.symbolBlock}>
                        <strong>{identity.title}</strong>
                        <small>{identity.subtitle}</small>
                      </span>
                      <span className={`pill ${getActionToneClass(item.action)}`}>
                        {getCalendarActionLabel(item.action, copy)}
                      </span>
                      <span className={styles.horizonChipRow}>
                        {([1, 3, 5] as const).map((day) => (
                          <HorizonChip key={day} copy={copy} horizon={getHorizonEvaluation(item, day)} />
                        ))}
                      </span>
                      <span className={styles.horizonProgressSummary}>{getHorizonProgressSummary(item, copy)}</span>
                      {decisionRowDetail ? <span className={styles.decisionDetail}>{decisionRowDetail}</span> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </aside>
        </section>

        <section className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>{copy.table.eyebrow}</p>
              <h2>{copy.table.title}</h2>
            </div>
          </header>

          {selectedDateUnavailable ? (
            <div className={styles.emptyState}>{selectedEmptyStateMessage}</div>
          ) : selectedDisplayLoadState === "loading" ? (
            <div className={styles.emptyState}>{copy.states.loadingSelected}</div>
          ) : selectedDisplayLoadState === "error" ? (
            <div className={styles.emptyState}>{selectedError ?? copy.states.selectedUnavailable}</div>
          ) : selectedSummary.items.length > 0 ? (
            <>
              <div className={styles.mobileDecisionCards}>
                {selectedSummary.items.map((item) => (
                  <MobileDecisionCard
                    key={item.id}
                    copy={copy}
                    feedbackHref={buildSignalDeciderFeedbackHref(item.marketDate, {
                      navContext: DECIDER_FEEDBACK_CALENDAR_NAV_CONTEXT,
                    })}
                    item={item}
                    onReview={() => openDetailPanel(item.id)}
                    status={selectedSummary}
                  />
                ))}
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.resultsTable}>
                  <thead>
                    <tr>
                      <th>{copy.table.symbol}</th>
                      <th>{copy.table.decision}</th>
                      <th>{copy.table.targetStop}</th>
                      <th>{copy.table.d1}</th>
                      <th>{copy.table.d3}</th>
                      <th>{copy.table.d5}</th>
                      <th>{copy.table.path}</th>
                      <th>{copy.table.insight}</th>
                      <th>{copy.table.review}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSummary.items.map((item) => {
                      const identity = getDecisionIdentity(item, copy);
                      return (
                        <tr key={item.id}>
                          <td>
                            <Link href={buildSymbolHref(item)} className={styles.symbolLink}>
                              <strong>{identity.title}</strong>
                              <span>{identity.subtitle}</span>
                            </Link>
                          </td>
                          <td>
                            <span className={`pill ${getActionToneClass(item.action)}`}>
                              {getCalendarActionLabel(item.action, copy)}
                            </span>
                          </td>
                          <td>
                            <div className={styles.targetStopStack}>
                              <span>{copy.table.target}: {formatCurrencyValue(item.targetPrice)}</span>
                              <span>{copy.table.stop}: {formatCurrencyValue(item.stopLossPrice)}</span>
                            </div>
                          </td>
                          <td>
                            <HorizonChip copy={copy} horizon={getHorizonEvaluation(item, 1)} showDetail />
                          </td>
                          <td>
                            <HorizonChip copy={copy} horizon={getHorizonEvaluation(item, 3)} showDetail />
                          </td>
                          <td>
                            <HorizonChip copy={copy} horizon={getHorizonEvaluation(item, 5)} showDetail />
                          </td>
                          <td>
                            {item.pathOutcome ? (
                              <span className={`pill ${getPillToneClass(item.pathOutcome.tone)}`}>{item.pathOutcome.label}</span>
                            ) : (
                              copy.states.pathUnavailable
                            )}
                          </td>
                          <td>{getTableInsightSummary(item, copy, selectedSummary.status)}</td>
                          <td>
                            <button type="button" className={styles.reviewButton} onClick={() => openDetailPanel(item.id)}>
                              {copy.actions.review}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>{selectedEmptyStateMessage}</div>
          )}
        </section>

      </div>
    </MobileAppChrome>
  );
}

function MobileDecisionCard({
  copy,
  feedbackHref,
  item,
  onReview,
  status,
}: {
  copy: ReturnType<typeof useAppState>["t"]["signalReview"];
  feedbackHref: string;
  item: SignalDeciderFeedbackItem;
  onReview: () => void;
  status: SignalDeciderFeedbackSummaryModel;
}) {
  const identity = getDecisionIdentity(item, copy);

  return (
    <article
      className={styles.mobileDecisionCard}
      data-testid="calendar-mobile-decision-card"
      aria-label={`${identity.title} ${copy.table.title}`}
    >
      <header className={styles.mobileDecisionHeader}>
        <Link href={buildSymbolHref(item)} className={styles.symbolLink}>
          <strong>{identity.title}</strong>
          <span>{identity.subtitle}</span>
        </Link>
        <span className={`pill ${getActionToneClass(item.action)}`}>{getCalendarActionLabel(item.action, copy)}</span>
      </header>

      <dl className={styles.mobileDecisionFacts}>
        <div>
          <dt>{copy.table.target}</dt>
          <dd>{formatCurrencyValue(item.targetPrice)}</dd>
        </div>
        <div>
          <dt>{copy.table.stop}</dt>
          <dd>{formatCurrencyValue(item.stopLossPrice)}</dd>
        </div>
        <div>
          <dt>{copy.table.d1}</dt>
          <dd>
            <HorizonChip copy={copy} horizon={getHorizonEvaluation(item, 1)} showDetail />
          </dd>
        </div>
        <div>
          <dt>{copy.table.d3}</dt>
          <dd>
            <HorizonChip copy={copy} horizon={getHorizonEvaluation(item, 3)} showDetail />
          </dd>
        </div>
        <div>
          <dt>{copy.table.d5}</dt>
          <dd>
            <HorizonChip copy={copy} horizon={getHorizonEvaluation(item, 5)} showDetail />
          </dd>
        </div>
        <div>
          <dt>{copy.table.path}</dt>
          <dd>
            {item.pathOutcome ? (
              <span className={`pill ${getPillToneClass(item.pathOutcome.tone)}`}>{item.pathOutcome.label}</span>
            ) : (
              copy.states.pathUnavailable
            )}
          </dd>
        </div>
        <div className={styles.mobileDecisionWideFact}>
          <dt>{copy.table.insight}</dt>
          <dd>{getTableInsightSummary(item, copy, status.status)}</dd>
        </div>
      </dl>

      <footer className={styles.mobileDecisionActions}>
        <DocumentRouteLink href={feedbackHref} className={styles.mobileDecisionLink}>
          {copy.actions.openFeedback}
        </DocumentRouteLink>
        <button type="button" className={styles.reviewButton} onClick={onReview}>
          {copy.actions.review}
        </button>
      </footer>
    </article>
  );
}

function DetailPanel({
  copy,
  item,
  onClose,
  status,
}: {
  copy: ReturnType<typeof useAppState>["t"]["signalReview"];
  item: SignalDeciderFeedbackItem;
  onClose: () => void;
  status: SignalDeciderFeedbackSummaryModel;
}) {
  const pathOutcome: SignalDeciderPathOutcome | null = item.pathOutcome;
  const pathOutcomeDetail = getCalendarReviewText(
    pathOutcome?.detail ?? pathOutcome?.label ?? item.intradayPathResult,
    copy,
  );
  const hasReplayVerdict = hasTextValue(item.reviewConclusion) || hasTextValue(item.qualityVerdict);
  const hasQualityReason = hasTextValue(item.qualityReason) && item.qualityReason !== item.reviewConclusion;
  const { diagnosticRiskTags, operatorRiskContext } = splitRiskFlags(item.riskFlags);
  const identity = getDecisionIdentity(item, copy);
  const reviewConclusion = getCalendarReviewText(item.reviewConclusion, copy);
  const qualityVerdict = getCalendarReviewText(item.qualityVerdict, copy);
  const qualityReason = getCalendarReviewText(item.qualityReason, copy);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    queueMicrotask(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const initialFocusTarget = closeButtonRef.current ?? getFocusableDetailDialogElements(dialog)[0] ?? dialog;
      initialFocusTarget.focus({ preventScroll: true });
    });

    const keepFocusInDialog = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
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
  }, [onClose]);

  return (
    <div className={styles.dialogBackdrop} onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className={styles.detailDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signal-review-detail-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.detailHeader}>
          <div>
            <p className={styles.eyebrow}>{copy.detail.eyebrow}</p>
            <h2 id="signal-review-detail-title">{identity.title}</h2>
            <p>
              {identity.subtitle} · {item.marketDate || status.marketDate || copy.status.pending}
            </p>
            <div className={styles.detailBadges}>
              <span className={`pill ${getActionToneClass(item.action)}`}>{getCalendarActionLabel(item.action, copy)}</span>
              {item.qualityTag ? (
                <span className={`pill ${getPillToneClass(item.qualityTag.tone)}`}>{item.qualityTag.label}</span>
              ) : null}
              {pathOutcome ? (
                <span className={`pill ${getPillToneClass(pathOutcome.tone)}`}>{pathOutcome.label}</span>
              ) : null}
            </div>
          </div>
          <button ref={closeButtonRef} type="button" className={styles.closeButton} onClick={onClose}>
            {copy.actions.close}
          </button>
        </header>

        <div className={styles.detailBody}>
          <aside className={styles.detailSidebar}>
            <section className={styles.detailGroup}>
              <span>{copy.detail.actionPlan}</span>
              <dl>
                <div>
                  <dt>{copy.table.decision}</dt>
                  <dd>{getCalendarActionLabel(item.action, copy)}</dd>
                </div>
                <div>
                  <dt>{copy.table.target}</dt>
                  <dd>{formatCurrencyValue(item.targetPrice)}</dd>
                </div>
                <div>
                  <dt>{copy.table.stop}</dt>
                  <dd>{formatCurrencyValue(item.stopLossPrice)}</dd>
                </div>
                <div>
                  <dt>{copy.labels.conviction}</dt>
                  <dd>{formatScore(item.convictionScore)}</dd>
                </div>
                <div>
                  <dt>{copy.labels.confidence}</dt>
                  <dd>{formatScore(item.confidenceScore)}</dd>
                </div>
              </dl>
            </section>

            <section className={styles.detailGroup}>
              <span>{copy.detail.runContext}</span>
              <dl>
                <div>
                  <dt>{copy.labels.run}</dt>
                  <dd>{item.runId ?? UNKNOWN_LABEL}</dd>
                </div>
                <div>
                  <dt>{copy.labels.policy}</dt>
                  <dd>{item.policyVersion ?? UNKNOWN_LABEL}</dd>
                </div>
                <div>
                  <dt>{copy.labels.captured}</dt>
                  <dd>{formatDisplayTimestamp(item.capturedAt ?? item.receivedAt, UNKNOWN_LABEL)}</dd>
                </div>
              </dl>
            </section>
          </aside>

          <div className={styles.detailMain}>
            <section className={styles.detailSection}>
              <h3>{copy.detail.signalRationale}</h3>
              {item.thesisSummary ? (
                <p className={styles.primaryDetailText}>{item.thesisSummary}</p>
              ) : (
                <p className={styles.pendingDetailText}>{copy.states.signalRationaleUnavailable}</p>
              )}
            </section>

            <section className={styles.detailSection}>
              <h3>{copy.detail.replayVerdict}</h3>
              {hasReplayVerdict ? (
                <>
                  <p className={styles.primaryDetailText}>
                    {reviewConclusion ?? qualityVerdict ?? copy.status.pending}
                  </p>
                  {hasQualityReason ? <p>{qualityReason}</p> : null}
                </>
              ) : (
                <p className={styles.pendingDetailText}>{copy.states.replayVerdictUnavailable}</p>
              )}
            </section>

            <section className={styles.detailSection}>
              <h3>{copy.detail.pathInterpretation}</h3>
              <p className={pathOutcomeDetail ? undefined : styles.pendingDetailText}>
                {pathOutcomeDetail ?? copy.states.pathUnavailable}
              </p>
            </section>

            <section className={styles.detailSection}>
              <h3>{copy.detail.replaySummary}</h3>
              {item.horizonEvaluations.length > 0 ? (
                <div className={styles.outcomeGrid}>
                  {item.horizonEvaluations.map((horizon) => (
                    <div key={horizon.horizon} className={styles.outcomeCard}>
                      <span>{horizon.label}</span>
                      <strong>{getHorizonChipLabel(horizon, copy)}</strong>
                      <p>
                        {[
                          getHorizonDetailLabel(horizon, copy),
                          horizon.realizedPrice !== null ? `₩${formatPrice(horizon.realizedPrice)}` : null,
                          getCalendarReviewText(horizon.verdict, copy),
                          getCalendarReviewText(horizon.notes, copy),
                        ]
                          .filter((part): part is string => hasTextValue(part))
                          .filter((part, index, all) => all.indexOf(part) === index)
                          .join(" · ") || getHorizonStateLabel(horizon, copy)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.pendingDetailText}>{copy.states.replayUnavailable}</p>
              )}
            </section>

            <section className={styles.detailSection}>
              <h3>{copy.detail.riskContext}</h3>
              {operatorRiskContext.length > 0 ? (
                <div className={styles.riskList}>
                  {operatorRiskContext.map((risk) => (
                    <span key={risk}>{risk}</span>
                  ))}
                </div>
              ) : (
                <p className={styles.pendingDetailText}>{copy.states.riskContextUnavailable}</p>
              )}
            </section>

            {diagnosticRiskTags.length > 0 ? (
              <section className={`${styles.detailSection} ${styles.diagnosticSection}`}>
                <h3>{copy.detail.diagnosticRiskTags}</h3>
                <div className={`${styles.riskList} ${styles.diagnosticRiskList}`}>
                  {diagnosticRiskTags.map((risk) => (
                    <span key={risk}>{risk}</span>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
