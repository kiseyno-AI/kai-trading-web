"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { getAgentFeedbackProgressMarketDate } from "@/lib/agent-feedback-progress";
import { formatDisplayTimestamp, formatPrice } from "@/lib/format";
import {
  buildSignalDeciderFeedbackSummary,
  buildSignalDeciderFeedbackPath,
  formatSignalDeciderActionLabel,
  SIGNAL_DECIDER_FEEDBACK_CLIENT_PATH,
  type SignalDeciderAction,
  type SignalDeciderFeedbackItem,
  type SignalDeciderFeedbackStatus,
} from "@/lib/signal-decider-feedback";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import type {
  AgentFeedbackListResponseDto,
  AgentFeedbackProgressResponseDto,
  EodFreshnessResponseDto,
} from "@/types/trading-api";

import styles from "./signal-decider-feedback-page.module.css";

const UNKNOWN_LABEL = "[확인 필요]";
const ACTION_FILTERS = ["all", "buy", "wait", "reject", "unknown"] as const;
type ActionFilter = (typeof ACTION_FILTERS)[number];
type SortMode = "priority" | "symbol" | "confidence" | "captured";

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

function getStatusLabel(status: SignalDeciderFeedbackStatus) {
  switch (status) {
    case "completed":
      return "Completed";
    case "running":
      return "Running";
    case "partial":
      return "Partial";
    case "needs-review":
      return "Needs review";
    case "waiting":
      return "Waiting";
  }
}

function getStatusToneClass(status: SignalDeciderFeedbackStatus) {
  if (status === "completed") return styles.positiveTone;
  if (status === "partial" || status === "needs-review") return styles.warningTone;
  return styles.neutralTone;
}

function formatScore(value: number | null) {
  return value === null ? UNKNOWN_LABEL : `${value}/10`;
}

function formatPricePlan(item: SignalDeciderFeedbackItem) {
  const parts = [
    item.targetPrice !== null ? `Target ₩${formatPrice(item.targetPrice)}` : null,
    item.stopLossPrice !== null ? `Stop ₩${formatPrice(item.stopLossPrice)}` : null,
    item.expectedReturnPct !== null ? `Return ${item.expectedReturnPct >= 0 ? "+" : ""}${item.expectedReturnPct.toFixed(2)}%` : null,
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(" · ") : UNKNOWN_LABEL;
}

function formatActionMix(actionCounts: Record<SignalDeciderAction, number>) {
  const labels = (["buy", "wait", "reject", "unknown"] as const)
    .filter((action) => actionCounts[action] > 0)
    .map((action) => `${formatSignalDeciderActionLabel(action)} ${actionCounts[action].toLocaleString("en-US")}`);

  return labels.length > 0 ? labels.join(" · ") : UNKNOWN_LABEL;
}

function buildSymbolHref(item: SignalDeciderFeedbackItem) {
  const params = new URLSearchParams();
  if (hasTextValue(item.companyName)) params.set("name", item.companyName);
  if (hasTextValue(item.marketDate)) params.set("marketDate", item.marketDate);
  const query = params.toString();
  return `/dashboard/symbol/${encodeURIComponent(item.symbol)}${query ? `?${query}` : ""}`;
}

function filterAndSortItems(items: SignalDeciderFeedbackItem[], query: string, actionFilter: ActionFilter, sortMode: SortMode) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = items.filter((item) => {
    const matchesAction = actionFilter === "all" || item.action === actionFilter;
    if (!matchesAction) return false;
    if (!normalizedQuery) return true;

    return [item.symbol, item.companyName, item.thesisSummary, ...item.riskFlags]
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

export default function SignalDeciderFeedbackPageClient() {
  const searchParams = useSearchParams();
  const requestedMarketDate = useMemo(() => searchParams.get("marketDate"), [searchParams]);
  const [marketDate, setMarketDate] = useState<string | null>(requestedMarketDate);
  const [feedback, setFeedback] = useState<AgentFeedbackListResponseDto | null>(null);
  const [progress, setProgress] = useState<AgentFeedbackProgressResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">(
    requestedMarketDate ? "loading" : "idle",
  );
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("priority");

  useEffect(() => {
    setMarketDate(requestedMarketDate);
  }, [requestedMarketDate]);

  useEffect(() => {
    if (requestedMarketDate) return;

    let active = true;
    setLoadState("loading");
    setError(null);

    const loadFallbackMarketDate = async () => {
      try {
        const freshness = await getJsonNoCache<EodFreshnessResponseDto>("/api/trading/eod/freshness");
        if (!active) return;
        const resolvedMarketDate = getAgentFeedbackProgressMarketDate(freshness);
        setMarketDate(resolvedMarketDate);
        if (!resolvedMarketDate) {
          setLoadState("error");
          setError("Signal-decider market date is unavailable.");
        }
      } catch (freshnessError) {
        if (!active) return;
        setLoadState("error");
        setError(freshnessError instanceof Error ? freshnessError.message : "Signal-decider market date is unavailable.");
      }
    };

    void loadFallbackMarketDate();

    return () => {
      active = false;
    };
  }, [requestedMarketDate]);

  useEffect(() => {
    if (!marketDate) return;

    let active = true;
    setLoadState("loading");
    setError(null);

    const loadData = async () => {
      try {
        const [feedbackData, progressData] = await Promise.all([
          getJsonNoCache<AgentFeedbackListResponseDto>(
            buildSignalDeciderFeedbackPath({
              basePath: SIGNAL_DECIDER_FEEDBACK_CLIENT_PATH,
              limit: 200,
              marketDate,
            }),
          ),
          getJsonNoCache<AgentFeedbackProgressResponseDto>(
            `/api/trading/agent-context/feedback/progress?market_date=${encodeURIComponent(marketDate)}`,
          ).catch(() => null),
        ]);
        if (!active) return;
        setFeedback(feedbackData);
        setProgress(progressData);
        setLoadState("ready");
      } catch (loadError) {
        console.error("Signal decider feedback page load failed", loadError);
        if (!active) return;
        setFeedback(null);
        setProgress(null);
        setLoadState("error");
        setError(loadError instanceof Error ? loadError.message : "Signal-decider feedback is unavailable.");
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
    () => filterAndSortItems(summary.items, query, actionFilter, sortMode),
    [actionFilter, query, sortMode, summary.items],
  );
  const displayedMarketDate = summary.marketDate ?? marketDate;

  return (
    <MobileAppChrome
      activeNav="dashboard"
      header={
        <>
          <div className={styles.appHeaderBrand}>
            <div className={styles.brandMark}>K</div>
            <div>
              <strong className={styles.brandTitle}>Trading Dashboard</strong>
            </div>
          </div>

          <div className={styles.appHeaderActions}>
            <span className={`pill ${styles.marketDatePill}`}>
              {displayedMarketDate ? `MD ${displayedMarketDate}` : "MD pending"}
            </span>
            <DevModeToggle />
          </div>
        </>
      }
    >
      <div className={styles.stack}>
        <section className={styles.heroPanel}>
          <div className={styles.heroCopy}>
            <ComponentTag
              label="dashboard.signal-decider-feedback"
              api="/api/trading/agent-context/feedback + /api/trading/agent-context/feedback/progress"
            />
            <p className={styles.eyebrow}>Agent feedback</p>
            <h1 className={styles.pageTitle}>Signal-decider feedback</h1>
            <p className={styles.pageCopy}>
              Decision-support results from the stored signal-decider feedback rows. This view does not create orders.
            </p>
          </div>

          <Link href="/dashboard" className={styles.backLink}>
            Back to dashboard
          </Link>
        </section>

        <section className={styles.panel}>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span>Status</span>
              <strong className={getStatusToneClass(summary.status)}>{getStatusLabel(summary.status)}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>Market date</span>
              <strong>{displayedMarketDate ?? "Pending"}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>Results</span>
              <strong>{summary.resultCount.toLocaleString("en-US")}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>Action mix</span>
              <strong>{formatActionMix(summary.actionCounts)}</strong>
            </div>
          </div>

          <div className={styles.controls} aria-label="Signal-decider feedback filters">
            <label>
              <span>Search</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Symbol, thesis, risk" />
            </label>
            <label>
              <span>Action</span>
              <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value as ActionFilter)}>
                {ACTION_FILTERS.map((action) => (
                  <option key={action} value={action}>
                    {action === "all" ? "All actions" : formatSignalDeciderActionLabel(action)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                <option value="priority">Action priority</option>
                <option value="confidence">Conviction</option>
                <option value="symbol">Symbol</option>
                <option value="captured">Captured time</option>
              </select>
            </label>
          </div>

          {loadState === "loading" ? (
            <div className={styles.emptyState}>Loading signal-decider feedback...</div>
          ) : loadState === "error" ? (
            <div className={styles.emptyState}>{error ?? "Signal-decider feedback is unavailable."}</div>
          ) : visibleItems.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.resultsTable}>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Action</th>
                    <th>Confidence</th>
                    <th>Thesis</th>
                    <th>Risks</th>
                    <th>Stop / target</th>
                    <th>Captured</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link href={buildSymbolHref(item)} className={styles.symbolLink}>
                          <strong>{item.companyName ?? item.symbol}</strong>
                          <span>{item.symbol}</span>
                        </Link>
                      </td>
                      <td>
                        <span className={`pill ${item.action === "buy" ? "positive" : item.action === "reject" ? "warning" : "neutral"}`}>
                          {item.actionLabel}
                        </span>
                      </td>
                      <td>
                        <span>Conviction {formatScore(item.convictionScore)}</span>
                        <span>Confidence {formatScore(item.confidenceScore)}</span>
                      </td>
                      <td>{item.thesisSummary ?? UNKNOWN_LABEL}</td>
                      <td>{item.riskFlags.length > 0 ? item.riskFlags.join(" · ") : UNKNOWN_LABEL}</td>
                      <td>{formatPricePlan(item)}</td>
                      <td>{formatDisplayTimestamp(item.capturedAt ?? item.receivedAt, UNKNOWN_LABEL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              {displayedMarketDate
                ? `No signal-decider rows are stored for ${displayedMarketDate}.`
                : "Signal-decider market date is pending."}
            </div>
          )}
        </section>
      </div>
    </MobileAppChrome>
  );
}
