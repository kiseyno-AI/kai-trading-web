"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { DashboardToolbar, DashboardToolbarStatus } from "@/components/navigation/dashboard-toolbar";
import { useAppState } from "@/components/providers/app-state-provider";
import { getAgentFeedbackProgressMarketDate } from "@/lib/agent-feedback-progress";
import { formatDisplayTimestamp, formatPrice } from "@/lib/format";
import {
  buildSignalDeciderFeedbackPath,
  buildSignalDeciderFeedbackSummary,
  formatSignalDeciderActionLabel,
  SIGNAL_DECIDER_FEEDBACK_CLIENT_PATH,
  SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
  type SignalDeciderAction,
  type SignalDeciderFeedbackItem,
  type SignalDeciderFeedbackSummaryModel,
  type SignalDeciderFeedbackStatus,
  type SignalDeciderPathOutcome,
  type SignalDeciderQualityTone,
} from "@/lib/signal-decider-feedback";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import type {
  AgentFeedbackListResponseDto,
  AgentFeedbackProgressResponseDto,
  EodFreshnessResponseDto,
} from "@/types/trading-api";

import styles from "./signal-review-calendar-page.module.css";

const UNKNOWN_LABEL = "[확인 필요]";
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const ACTION_KEYS = ["buy", "wait", "reject", "unknown"] as const satisfies readonly SignalDeciderAction[];
const DAY_MS = 86_400_000;

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

async function getJsonNoCache<T>(path: string): Promise<T> {
  const response = await fetch(resolveTradingApiClientPath(path), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });
  const responseText = await response.text();
  let parsedBody: unknown = null;

  if (responseText) {
    parsedBody = JSON.parse(responseText) as T;
  }

  if (!response.ok) {
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

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDateKey(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getTodayDateKey() {
  return formatDateKey(new Date());
}

function getMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

function addMonths(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  return formatDateKey(new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1 + delta, 1))).slice(0, 7);
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
      item.outcomeHorizons.length > 0,
  ).length;
}

function buildDateSnapshot(
  dateKey: string,
  feedback: AgentFeedbackListResponseDto | null,
  error: string | null = null,
): CalendarDateSnapshot {
  if (error) {
    return {
      actionCounts: { buy: 0, wait: 0, reject: 0, unknown: 0 },
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

function getActionMixLabel(
  actionCounts: Record<SignalDeciderAction, number>,
  copy: ReturnType<typeof useAppState>["t"]["signalReview"],
) {
  const labels = ACTION_KEYS.filter((action) => actionCounts[action] > 0).map(
    (action) => `${copy.actions[action]} ${actionCounts[action].toLocaleString("en-US")}`,
  );
  return labels.length > 0 ? labels.join(" · ") : copy.status.pending;
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

function getFeedbackStatusLabel(
  status: SignalDeciderFeedbackStatus,
  copy: ReturnType<typeof useAppState>["t"]["signalReview"],
) {
  if (status === "completed") return copy.status.reviewed;
  if (status === "needs-review") return copy.status.needsReview;
  if (status === "running") return copy.status.loading;
  return copy.status[status];
}

function getPathOutcomeCounts(items: SignalDeciderFeedbackItem[]) {
  return items.reduce(
    (counts, item) => {
      if (item.pathOutcome?.kind === "target-first" || item.pathOutcome?.kind === "target-hit") {
        counts.target += 1;
        return counts;
      }
      if (item.pathOutcome?.kind === "stop-first" || item.pathOutcome?.kind === "stop-hit") {
        counts.stop += 1;
        return counts;
      }
      if (item.pathOutcome?.kind === "ambiguous") {
        counts.ambiguous += 1;
        return counts;
      }
      counts.unresolved += 1;
      return counts;
    },
    { ambiguous: 0, stop: 0, target: 0, unresolved: 0 },
  );
}

function getHorizonSummary(item: SignalDeciderFeedbackItem, day: number) {
  const outcome = item.outcomeHorizons.find((candidate) => {
    const normalized = candidate.horizon.toLowerCase().replace(/\s+/g, "");
    return normalized === `${day}d` || normalized === `d+${day}` || normalized === `${day}day`;
  });
  if (!outcome) return UNKNOWN_LABEL;
  return formatSignedPercent(outcome.returnPct) !== UNKNOWN_LABEL
    ? formatSignedPercent(outcome.returnPct)
    : outcome.verdict ?? outcome.notes ?? UNKNOWN_LABEL;
}

function getDetailSummary(item: SignalDeciderFeedbackItem) {
  return item.reviewConclusion ?? item.qualityReason ?? item.qualityVerdict ?? UNKNOWN_LABEL;
}

function buildSymbolHref(item: SignalDeciderFeedbackItem) {
  const params = new URLSearchParams();
  if (hasTextValue(item.companyName)) params.set("name", item.companyName);
  if (hasTextValue(item.marketDate)) params.set("marketDate", item.marketDate);
  const query = params.toString();
  return `/dashboard/symbol/${encodeURIComponent(item.symbol)}${query ? `?${query}` : ""}`;
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
  const requestedDateKey = isDateKey(requestedDate) ? requestedDate : null;
  const todayKey = useMemo(() => getTodayDateKey(), []);
  const initialDate = requestedDateKey;
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const [monthKey, setMonthKey] = useState(getMonthKey(initialDate ?? todayKey));
  const [monthLoadState, setMonthLoadState] = useState<MonthLoadState>("idle");
  const [monthSnapshots, setMonthSnapshots] = useState<Record<string, CalendarDateSnapshot>>({});
  const [selectedFeedback, setSelectedFeedback] = useState<AgentFeedbackListResponseDto | null>(null);
  const [selectedProgress, setSelectedProgress] = useState<AgentFeedbackProgressResponseDto | null>(null);
  const [selectedDataDate, setSelectedDataDate] = useState<string | null>(null);
  const [selectedLoadState, setSelectedLoadState] = useState<DetailLoadState>(initialDate ? "loading" : "idle");
  const [selectedError, setSelectedError] = useState<string | null>(null);
  const [progressUnavailable, setProgressUnavailable] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const { t } = useAppState();
  const copy = t.signalReview;

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
    const loadLatestDate = async () => {
      try {
        const freshness = await getJsonNoCache<EodFreshnessResponseDto>("/api/trading/eod/freshness");
        if (!active) return;
        const resolvedDate = getAgentFeedbackProgressMarketDate(freshness) ?? todayKey;
        setSelectedDate(resolvedDate);
        setMonthKey(getMonthKey(resolvedDate));
        router.replace(`/calendar?date=${encodeURIComponent(resolvedDate)}`);
      } catch {
        if (!active) return;
        setSelectedDate(todayKey);
        setMonthKey(getMonthKey(todayKey));
      }
    };

    void loadLatestDate();

    return () => {
      active = false;
    };
  }, [router, selectedDate, todayKey]);

  useEffect(() => {
    let active = true;

    const loadMonth = async () => {
      const monthDays = buildCalendarDays(monthKey, todayKey).filter((day) => day.inMonth && !day.isFuture);
      setMonthLoadState("loading");
      setMonthSnapshots((current) => {
        const next = { ...current };
        for (const day of monthDays) {
          next[day.dateKey] = {
            actionCounts: { buy: 0, wait: 0, reject: 0, unknown: 0 },
            dateKey: day.dateKey,
            decisionCount: 0,
            error: null,
            reviewCount: 0,
            status: "loading",
          };
        }
        return next;
      });
      const results = await Promise.all(
        monthDays.map(async (day) => {
          try {
            const feedback = await getJsonNoCache<AgentFeedbackListResponseDto>(
              buildSignalDeciderFeedbackPath({
                basePath: SIGNAL_DECIDER_FEEDBACK_CLIENT_PATH,
                limit: SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
                marketDate: day.dateKey,
              }),
            );
            return buildDateSnapshot(day.dateKey, feedback);
          } catch (error) {
            return buildDateSnapshot(day.dateKey, null, error instanceof Error ? error.message : copy.states.unavailableMonth);
          }
        }),
      );
      if (!active) return;
      const nextSnapshots = results.reduce<Record<string, CalendarDateSnapshot>>((snapshots, snapshot) => {
        snapshots[snapshot.dateKey] = snapshot;
        return snapshots;
      }, {});
      const failedCount = results.filter((snapshot) => snapshot.status === "unavailable").length;
      setMonthSnapshots((current) => ({ ...current, ...nextSnapshots }));
      setMonthLoadState(
        failedCount === results.length && results.length > 0 ? "unavailable" : failedCount > 0 ? "partial" : "ready",
      );
    };

    void loadMonth();

    return () => {
      active = false;
    };
  }, [copy.states.unavailableMonth, monthKey, todayKey]);

  useEffect(() => {
    if (!selectedDate) return;

    let active = true;

    const loadSelectedDate = async () => {
      setSelectedLoadState("loading");
      setSelectedError(null);
      setProgressUnavailable(false);
      setSelectedFeedback(null);
      setSelectedProgress(null);
      setSelectedDataDate(null);
      setSelectedItemId(null);
      try {
        const [feedback, progress] = await Promise.all([
          getJsonNoCache<AgentFeedbackListResponseDto>(
            buildSignalDeciderFeedbackPath({
              basePath: SIGNAL_DECIDER_FEEDBACK_CLIENT_PATH,
              limit: SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
              marketDate: selectedDate,
            }),
          ),
          getJsonNoCache<AgentFeedbackProgressResponseDto>(
            `/api/trading/agent-context/feedback/progress?market_date=${encodeURIComponent(selectedDate)}`,
          ).catch(() => null),
        ]);
        if (!active) return;
        setSelectedFeedback(feedback);
        setSelectedProgress(progress);
        setSelectedDataDate(selectedDate);
        setProgressUnavailable(progress === null);
        setSelectedLoadState("ready");
      } catch (error) {
        if (!active) return;
        setSelectedFeedback(null);
        setSelectedProgress(null);
        setSelectedDataDate(selectedDate);
        setSelectedLoadState("error");
        setSelectedError(error instanceof Error ? error.message : copy.states.selectedUnavailable);
      }
    };

    void loadSelectedDate();

    return () => {
      active = false;
    };
  }, [copy.states.selectedUnavailable, selectedDate]);

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
  const pathCounts = useMemo(() => getPathOutcomeCounts(selectedSummary.items), [selectedSummary.items]);
  const monthDecisionCount = useMemo(
    () =>
      Object.values(monthSnapshots)
        .filter((snapshot) => snapshot.dateKey.startsWith(monthKey))
        .reduce((sum, snapshot) => sum + snapshot.decisionCount, 0),
    [monthKey, monthSnapshots],
  );

  function handleSelectDate(dateKey: string) {
    setSelectedDate(dateKey);
    setMonthKey(getMonthKey(dateKey));
    router.push(`/calendar?date=${encodeURIComponent(dateKey)}`);
  }

  function handleMonthChange(delta: number) {
    setMonthKey((value) => addMonths(value, delta));
  }

  function renderCalendarCell(day: CalendarDay) {
    const snapshot = day.inMonth
      ? monthSnapshots[day.dateKey] ?? {
          actionCounts: { buy: 0, wait: 0, reject: 0, unknown: 0 },
          dateKey: day.dateKey,
          decisionCount: 0,
          error: null,
          reviewCount: 0,
          status: day.isFuture ? "future" : "loading",
        }
      : null;
    const active = day.dateKey === selectedDate;
    const disabled = !day.inMonth || day.isFuture;

    return (
      <button
        key={day.dateKey}
        type="button"
        className={`${styles.dayCell} ${!day.inMonth ? styles.outsideMonth : ""} ${active ? styles.selectedDay : ""}`.trim()}
        disabled={disabled}
        aria-pressed={active || undefined}
        aria-label={`${day.dateKey} ${snapshot ? getStatusLabel(snapshot.status, copy) : ""}`.trim()}
        onClick={() => handleSelectDate(day.dateKey)}
      >
        <span className={styles.dayNumber}>{day.dayNumber}</span>
        {snapshot ? (
          <>
            <span className={`${styles.dayStatus} ${getStatusToneClass(snapshot.status)}`}>
              {getStatusLabel(snapshot.status, copy)}
            </span>
            <strong>{snapshot.decisionCount > 0 ? `${snapshot.decisionCount} ${copy.labels.decisions}` : copy.status.empty}</strong>
            <small>{snapshot.decisionCount > 0 ? getActionMixLabel(snapshot.actionCounts, copy) : copy.status.pending}</small>
          </>
        ) : null}
      </button>
    );
  }

  return (
    <MobileAppChrome
      activeNav="calendar"
      header={
        <DashboardToolbar
          title={copy.headerTitle}
          subtitle={getSelectedDateHeader(selectedDate, copy)}
          status={<DashboardToolbarStatus>{formatMonthLabel(monthKey)}</DashboardToolbarStatus>}
          actions={<DevModeToggle />}
        />
      }
    >
      <div className={styles.stack}>
        <section className={styles.heroPanel}>
          <div className={styles.heroCopy}>
            <ComponentTag
              label="calendar.signal-review"
              api="/api/trading/agent-context/feedback + /api/trading/agent-context/feedback/progress"
            />
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1 className={styles.pageTitle}>{copy.title}</h1>
            <p className={styles.pageCopy}>{copy.heroCopy}</p>
          </div>

          <div className={styles.heroActions}>
            <Link href="/dashboard/signal-decider-feedback" className={styles.secondaryLink}>
              {copy.actions.openFeedback}
            </Link>
            <Link href="/dashboard" className={styles.secondaryLink}>
              {copy.actions.backDashboard}
            </Link>
          </div>
        </section>

        <section className={styles.noticePanel}>
          <strong>{copy.states.dependencyGapTitle}</strong>
          <p>{copy.states.dependencyGapBody}</p>
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
                <button type="button" onClick={() => setMonthKey(getMonthKey(todayKey))}>
                  {copy.actions.today}
                </button>
                <button type="button" onClick={() => handleMonthChange(1)} aria-label={copy.actions.nextMonth}>
                  →
                </button>
              </div>
            </header>

            <div className={styles.monthStateRow}>
              <span className={`${styles.dayStatus} ${monthLoadState === "partial" ? styles.warningTone : styles.neutralTone}`}>
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
            <div className={styles.calendarGrid}>{calendarDays.map(renderCalendarCell)}</div>
          </div>

          <aside className={styles.panel}>
            <header className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>{copy.selected.eyebrow}</p>
                <h2>{selectedDate ?? copy.status.pending}</h2>
              </div>
              <span className={`${styles.dayStatus} ${getStatusToneClass(selectedSummary.status)}`}>
                {selectedDisplayLoadState === "loading"
                  ? copy.status.loading
                  : selectedDisplayLoadState === "error"
                    ? copy.status.unavailable
                    : getFeedbackStatusLabel(selectedSummary.status, copy)}
              </span>
            </header>

            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}>
                <span>{copy.summary.total}</span>
                <strong>{selectedSummary.resultCount.toLocaleString("en-US")}</strong>
              </div>
              <div className={styles.summaryCard}>
                <span>{copy.summary.actionMix}</span>
                <strong>{getActionMixLabel(selectedSummary.actionCounts, copy)}</strong>
              </div>
              <div className={styles.summaryCard}>
                <span>{copy.summary.reviewed}</span>
                <strong>{reviewCount.toLocaleString("en-US")}</strong>
              </div>
              <div className={styles.summaryCard}>
                <span>{copy.summary.path}</span>
                <strong>
                  {copy.outcomes.target} {pathCounts.target} · {copy.outcomes.stop} {pathCounts.stop} ·{" "}
                  {copy.outcomes.unresolved} {pathCounts.unresolved}
                </strong>
              </div>
            </div>

            {progressUnavailable && selectedDisplayLoadState === "ready" ? (
              <div className={styles.inlineNotice}>{copy.states.progressUnavailable}</div>
            ) : null}

            {selectedDisplayLoadState === "loading" ? (
              <div className={styles.emptyState}>{copy.states.loadingSelected}</div>
            ) : selectedDisplayLoadState === "error" ? (
              <div className={styles.emptyState}>{selectedError ?? copy.states.selectedUnavailable}</div>
            ) : selectedSummary.items.length === 0 ? (
              <div className={styles.emptyState}>{copy.states.emptySelected}</div>
            ) : (
              <div className={styles.decisionList}>
                {selectedSummary.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.decisionRow} ${selectedItemId === item.id ? styles.selectedDecision : ""}`.trim()}
                    onClick={() => setSelectedItemId(item.id)}
                  >
                    <span className={styles.symbolBlock}>
                      <strong>{item.companyName ?? item.symbol}</strong>
                      <small>{item.symbol}</small>
                    </span>
                    <span className={`pill ${getActionToneClass(item.action)}`}>{formatSignalDeciderActionLabel(item.action)}</span>
                    <span>{item.pathOutcome?.label ?? item.qualityVerdict ?? copy.status.pending}</span>
                    <span>{getDetailSummary(item)}</span>
                  </button>
                ))}
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

          {selectedDisplayLoadState === "loading" ? (
            <div className={styles.emptyState}>{copy.states.loadingSelected}</div>
          ) : selectedDisplayLoadState === "error" ? (
            <div className={styles.emptyState}>{selectedError ?? copy.states.selectedUnavailable}</div>
          ) : selectedSummary.items.length > 0 ? (
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
                  {selectedSummary.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link href={buildSymbolHref(item)} className={styles.symbolLink}>
                          <strong>{item.companyName ?? item.symbol}</strong>
                          <span>{item.symbol}</span>
                        </Link>
                      </td>
                      <td>
                        <span className={`pill ${getActionToneClass(item.action)}`}>{item.actionLabel}</span>
                      </td>
                      <td>
                        <div className={styles.targetStopStack}>
                          <span>{copy.table.target}: {formatCurrencyValue(item.targetPrice)}</span>
                          <span>{copy.table.stop}: {formatCurrencyValue(item.stopLossPrice)}</span>
                        </div>
                      </td>
                      <td>{getHorizonSummary(item, 1)}</td>
                      <td>{getHorizonSummary(item, 3)}</td>
                      <td>{getHorizonSummary(item, 5)}</td>
                      <td>
                        {item.pathOutcome ? (
                          <span className={`pill ${getPillToneClass(item.pathOutcome.tone)}`}>{item.pathOutcome.label}</span>
                        ) : (
                          copy.states.pathUnavailable
                        )}
                      </td>
                      <td>{getDetailSummary(item)}</td>
                      <td>
                        <button type="button" className={styles.reviewButton} onClick={() => setSelectedItemId(item.id)}>
                          {copy.actions.review}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>{copy.states.emptySelected}</div>
          )}
        </section>

        {selectedItem ? (
          <DetailPanel
            copy={copy}
            item={selectedItem}
            onClose={() => setSelectedItemId(null)}
            status={selectedSummary}
          />
        ) : null}
      </div>
    </MobileAppChrome>
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

  return (
    <div className={styles.dialogBackdrop} onMouseDown={onClose}>
      <section
        className={styles.detailDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signal-review-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.detailHeader}>
          <div>
            <p className={styles.eyebrow}>{copy.detail.eyebrow}</p>
            <h2 id="signal-review-detail-title">{item.companyName ?? item.symbol}</h2>
            <p>
              {item.symbol} · {item.marketDate || status.marketDate || copy.status.pending}
            </p>
            <div className={styles.detailBadges}>
              <span className={`pill ${getActionToneClass(item.action)}`}>{item.actionLabel}</span>
              {item.qualityTag ? (
                <span className={`pill ${getPillToneClass(item.qualityTag.tone)}`}>{item.qualityTag.label}</span>
              ) : null}
              {pathOutcome ? (
                <span className={`pill ${getPillToneClass(pathOutcome.tone)}`}>{pathOutcome.label}</span>
              ) : null}
            </div>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose}>
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
                  <dd>{item.actionLabel}</dd>
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
              <h3>{copy.detail.conclusion}</h3>
              <p>{getDetailSummary(item)}</p>
              {item.thesisSummary ? <p>{item.thesisSummary}</p> : null}
            </section>

            <section className={styles.detailSection}>
              <h3>{copy.detail.pathInterpretation}</h3>
              <p>{pathOutcome?.detail ?? pathOutcome?.label ?? item.intradayPathResult ?? copy.states.pathUnavailable}</p>
            </section>

            <section className={styles.detailSection}>
              <h3>{copy.detail.replaySummary}</h3>
              {item.outcomeHorizons.length > 0 ? (
                <div className={styles.outcomeGrid}>
                  {item.outcomeHorizons.map((outcome) => (
                    <div key={`${outcome.horizon}-${outcome.verdict ?? ""}`} className={styles.outcomeCard}>
                      <span>{outcome.horizon}</span>
                      <strong>{formatSignedPercent(outcome.returnPct)}</strong>
                      <p>
                        {[
                          outcome.realizedPrice !== null ? `₩${formatPrice(outcome.realizedPrice)}` : null,
                          outcome.verdict,
                          outcome.notes,
                        ]
                          .filter((part): part is string => hasTextValue(part))
                          .join(" · ") || UNKNOWN_LABEL}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>{copy.states.replayUnavailable}</p>
              )}
            </section>

            <section className={styles.detailSection}>
              <h3>{copy.detail.risks}</h3>
              {item.riskFlags.length > 0 ? (
                <div className={styles.riskList}>
                  {item.riskFlags.map((risk) => (
                    <span key={risk}>{risk}</span>
                  ))}
                </div>
              ) : (
                <p>{UNKNOWN_LABEL}</p>
              )}
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}
