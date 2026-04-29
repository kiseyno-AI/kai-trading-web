"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { DashboardToolbar, DashboardToolbarStatus } from "@/components/navigation/dashboard-toolbar";
import { getAgentFeedbackProgressMarketDate } from "@/lib/agent-feedback-progress";
import { formatDisplayTimestamp, formatPrice } from "@/lib/format";
import {
  buildSignalDeciderFeedbackSummary,
  buildSignalDeciderFeedbackPath,
  formatSignalDeciderActionLabel,
  SIGNAL_DECIDER_FEEDBACK_CLIENT_PATH,
  SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
  type SignalDeciderAction,
  type SignalDeciderFeedbackItem,
  type SignalDeciderFeedbackStatus,
  type SignalDeciderQualityTone,
  type SignalDeciderTraceEntry,
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

function getDecisionQualityLabel(item: SignalDeciderFeedbackItem) {
  return item.qualityTag?.label ?? item.qualityVerdict ?? null;
}

function getDecisionQualityDisplayLabel(item: SignalDeciderFeedbackItem) {
  return getDecisionQualityLabel(item) ?? UNKNOWN_LABEL;
}

function formatOutcomeSummary(item: SignalDeciderFeedbackItem) {
  if (item.outcomeHorizons.length === 0) return UNKNOWN_LABEL;

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

function getDecisionPlanRows(item: SignalDeciderFeedbackItem) {
  return [
    { label: "Target", value: formatCurrencyValue(item.targetPrice) },
    { label: "Stop", value: formatCurrencyValue(item.stopLossPrice) },
    { label: "Expected return", value: formatExpectedReturnValue(item.expectedReturnPct) },
  ];
}

function getRunContextRows(item: SignalDeciderFeedbackItem) {
  return [
    { label: "Symbol", value: item.symbol },
    { label: "Market date", value: item.marketDate || UNKNOWN_LABEL },
    { label: "Policy", value: item.policyVersion ?? UNKNOWN_LABEL },
    { label: "Run", value: item.runId ?? UNKNOWN_LABEL },
    { label: "Agent version", value: item.agentVersion ?? UNKNOWN_LABEL },
  ];
}

function formatActionMix(actionCounts: Record<SignalDeciderAction, number>) {
  const labels = (["buy", "wait", "reject", "unknown"] as const)
    .filter((action) => actionCounts[action] > 0)
    .map((action) => `${formatSignalDeciderActionLabel(action)} ${actionCounts[action].toLocaleString("en-US")}`);

  return labels.length > 0 ? labels.join(" · ") : UNKNOWN_LABEL;
}

function getTraceSummaryParts(item: SignalDeciderFeedbackItem) {
  return [
    item.riskFlags.length > 0 ? `${item.riskFlags.length} risks` : null,
    item.factorAttributions.length > 0 ? `${item.factorAttributions.length} factors` : null,
    item.gateResults.length > 0 ? `${item.gateResults.length} gates` : null,
    item.upstreamEvidence.length > 0 ? `${item.upstreamEvidence.length} evidence` : null,
  ].filter((part): part is string => part !== null);
}

function buildSymbolHref(item: SignalDeciderFeedbackItem) {
  const params = new URLSearchParams();
  if (hasTextValue(item.companyName)) params.set("name", item.companyName);
  if (hasTextValue(item.marketDate)) params.set("marketDate", item.marketDate);
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
  const requestedMarketDate = useMemo(() => searchParams.get("marketDate"), [searchParams]);
  const [marketDate, setMarketDate] = useState<string | null>(requestedMarketDate);
  const [marketDateDraft, setMarketDateDraft] = useState(requestedMarketDate ?? "");
  const [feedback, setFeedback] = useState<AgentFeedbackListResponseDto | null>(null);
  const [progress, setProgress] = useState<AgentFeedbackProgressResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">(
    requestedMarketDate ? "loading" : "idle",
  );
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    setMarketDate(requestedMarketDate);
  }, [requestedMarketDate]);

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
              limit: SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
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

  function handleMarketDateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextMarketDate = marketDateDraft.trim();
    if (!nextMarketDate) {
      router.push("/dashboard/signal-decider-feedback");
      return;
    }

    const params = new URLSearchParams({ marketDate: nextMarketDate });
    router.push(`/dashboard/signal-decider-feedback?${params.toString()}`);
  }

  return (
    <MobileAppChrome
      activeNav="dashboard"
      header={
        <DashboardToolbar
          status={<DashboardToolbarStatus>{displayedMarketDate ? `MD ${displayedMarketDate}` : "MD pending"}</DashboardToolbarStatus>}
          actions={<DevModeToggle />}
        />
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

          <form className={styles.controls} aria-label="Signal-decider feedback filters" onSubmit={handleMarketDateSubmit}>
            <label>
              <span>Search</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Symbol, thesis, risk" />
            </label>
            <label>
              <span>Market date</span>
              <div className={styles.inlineControl}>
                <input
                  type="date"
                  value={marketDateDraft}
                  onChange={(event) => setMarketDateDraft(event.target.value)}
                />
                <button type="submit">Load</button>
              </div>
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
          </form>

          {loadState === "loading" ? (
            <div className={styles.emptyState}>Loading signal-decider feedback...</div>
          ) : loadState === "error" ? (
            <div className={styles.emptyState}>{error ?? "Signal-decider feedback is unavailable."}</div>
          ) : visibleItems.length > 0 ? (
            <div className={styles.resultsList} aria-label="Signal-decider feedback results">
              {visibleItems.map((item) => {
                const decisionQualityLabel = getDecisionQualityDisplayLabel(item);
                const traceSummaryParts = getTraceSummaryParts(item);

                return (
                  <article
                    key={item.id}
                    className={styles.resultCard}
                    aria-label={`${item.companyName ?? item.symbol} signal-decider feedback`}
                    data-testid="signal-decider-result-card"
                  >
                    <header className={styles.resultHeader}>
                      <Link href={buildSymbolHref(item)} className={styles.symbolLink}>
                        <strong>{item.companyName ?? item.symbol}</strong>
                        <span>{item.symbol}</span>
                      </Link>
                      <div className={styles.resultBadges}>
                        <span className={`pill ${getActionToneClass(item.action)}`}>{item.actionLabel}</span>
                        <span className={`pill ${getPillToneClass(item.qualityTag?.tone)}`}>
                          {decisionQualityLabel}
                        </span>
                      </div>
                    </header>

                    <div className={styles.resultMetricGrid}>
                      <div className={styles.scoreStack} data-testid="signal-decider-score-area">
                        <span>
                          <span>Conviction</span>
                          <strong>{formatScore(item.convictionScore)}</strong>
                        </span>
                        <span>
                          <span>Confidence</span>
                          <strong>{formatScore(item.confidenceScore)}</strong>
                        </span>
                      </div>
                      <div className={styles.resultMetric}>
                        <span>Outcome</span>
                        <strong>{formatOutcomeSummary(item)}</strong>
                      </div>
                      <div className={styles.resultMetric}>
                        <span>Policy</span>
                        <strong>{item.policyVersion ?? UNKNOWN_LABEL}</strong>
                      </div>
                      <div className={styles.resultMetric}>
                        <span>Captured</span>
                        <strong>{formatDisplayTimestamp(item.capturedAt ?? item.receivedAt, UNKNOWN_LABEL)}</strong>
                      </div>
                    </div>

                    <section className={styles.resultThesis}>
                      <span>Thesis</span>
                      <p>{item.thesisSummary ?? UNKNOWN_LABEL}</p>
                    </section>

                    <footer className={styles.resultFooter}>
                      <div className={styles.traceSummary} aria-label="Trace summary">
                        {traceSummaryParts.length > 0
                          ? traceSummaryParts.map((part) => <span key={part}>{part}</span>)
                          : UNKNOWN_LABEL}
                      </div>
                      <button type="button" className={styles.reviewButton} onClick={() => setSelectedItemId(item.id)}>
                        Review
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              {displayedMarketDate
                ? `No signal-decider rows are stored for ${displayedMarketDate}.`
                : "Signal-decider market date is pending."}
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
                  <p className={styles.eyebrow}>Decision review</p>
                  <h2 id="signal-decider-detail-title">
                    {selectedItem.companyName ?? selectedItem.symbol}
                  </h2>
                  <p className={styles.detailSubtitle}>
                    {selectedItem.symbol} · {selectedItem.marketDate || "Market date pending"}
                  </p>
                  <div className={styles.detailBadges}>
                    <span className={`pill ${getActionToneClass(selectedItem.action)}`}>
                      {selectedItem.actionLabel}
                    </span>
                    <span className={`pill ${getPillToneClass(selectedItem.qualityTag?.tone)}`}>
                      {getDecisionQualityDisplayLabel(selectedItem)}
                    </span>
                  </div>
                </div>
                <button type="button" className={styles.closeButton} onClick={() => setSelectedItemId(null)}>
                  Close
                </button>
              </header>

              <div className={styles.detailBody}>
                <aside className={styles.detailSidebar} aria-label="Decision summary">
                  <section className={styles.detailGroup}>
                    <div className={styles.detailGroupHeader}>
                      <span>Decision</span>
                      <h3>Action plan</h3>
                    </div>
                    <div className={styles.decisionHero}>
                      <span className={`pill ${getActionToneClass(selectedItem.action)}`}>{selectedItem.actionLabel}</span>
                      <strong>{formatExpectedReturnValue(selectedItem.expectedReturnPct)}</strong>
                      <span>Expected return</span>
                    </div>
                    <dl className={styles.metricList}>
                      <div>
                        <dt>Conviction</dt>
                        <dd>{formatScore(selectedItem.convictionScore)}</dd>
                      </div>
                      <div>
                        <dt>Confidence</dt>
                        <dd>{formatScore(selectedItem.confidenceScore)}</dd>
                      </div>
                      {getDecisionPlanRows(selectedItem).map((row) => (
                        <div key={row.label}>
                          <dt>{row.label}</dt>
                          <dd>{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>

                  <section className={styles.detailGroup}>
                    <div className={styles.detailGroupHeader}>
                      <span>Context</span>
                      <h3>Run metadata</h3>
                    </div>
                    <dl className={styles.contextList}>
                      {getRunContextRows(selectedItem).map((row) => (
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
                    <h3>Thesis</h3>
                    <p>{selectedItem.thesisSummary ?? UNKNOWN_LABEL}</p>
                    {selectedItem.qualityReason ? <p>{selectedItem.qualityReason}</p> : null}
                  </section>

                  <section className={styles.detailSection}>
                    <h3>Realized result</h3>
                    {selectedItem.outcomeHorizons.length > 0 ? (
                      <div className={styles.outcomeGrid}>
                        {selectedItem.outcomeHorizons.map((outcome) => (
                          <div key={`${outcome.horizon}-${outcome.verdict ?? ""}`} className={styles.outcomeCard}>
                            <span>{outcome.horizon}</span>
                            <strong>{formatSignedPercent(outcome.returnPct) ?? outcome.verdict ?? UNKNOWN_LABEL}</strong>
                            <p>
                              {[
                                outcome.realizedPrice !== null ? `Price ₩${formatPrice(outcome.realizedPrice)}` : null,
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
                      <p className={styles.detailEmpty}>{UNKNOWN_LABEL}</p>
                    )}
                  </section>

                  <section className={styles.detailSection}>
                    <h3>Risks</h3>
                    {selectedItem.riskFlags.length > 0 ? (
                      <div className={styles.traceList}>
                        {selectedItem.riskFlags.map((risk) => (
                          <div key={risk} className={styles.traceRow}>
                            <span className="pill warning">Risk</span>
                            <p>{risk}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.detailEmpty}>{UNKNOWN_LABEL}</p>
                    )}
                  </section>

                  <div className={styles.evidenceGrid}>
                    <TraceEntryList title="Factors" entries={selectedItem.factorAttributions} />
                    <TraceEntryList title="Gates" entries={selectedItem.gateResults} />
                    <TraceEntryList title="Upstream evidence" entries={selectedItem.upstreamEvidence} />
                    <TraceEntryList title="Traceability" entries={selectedItem.traceability} />
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
