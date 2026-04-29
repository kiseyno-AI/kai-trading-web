"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { useAppState } from "@/components/providers/app-state-provider";
import { SurfaceState } from "@/components/ui/surface-state";
import { formatDisplayTimestamp } from "@/lib/format";
import { PORTFOLIO_SUMMARY_PATH } from "@/lib/mobile-toolbar-data";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import {
  getTradingApiJsonResult,
  readTradingApiJsonSnapshot,
  seedTradingApiJsonSnapshot,
  type TradingApiJsonResult,
} from "@/lib/trading-api-cache";
import type { PortfolioSummaryDto } from "@/types/trading-api";
import {
  buildPortfolioSectionStates,
  buildPortfolioMetricModels,
  classifyPortfolioSummaryFailure,
  formatPortfolioMoney,
  formatPortfolioPercent,
  getPortfolioAccounts,
  getPortfolioActivity,
  getPortfolioAllocations,
  getPortfolioHoldings,
  getPortfolioLastSyncedAt,
  getPortfolioNoticeMessages,
  getPortfolioSyncMessage,
  resolvePortfolioSummaryState,
  type PortfolioMetricId,
  type PortfolioSectionId,
  type PortfolioSectionState,
  type PortfolioSummaryFailureKind,
  type PortfolioSummaryState,
} from "@/features/portfolio/portfolio-display";

import styles from "./portfolio-page.module.css";

type PortfolioCopy = ReturnType<typeof useAppState>["t"]["portfolio"];

type PortfolioFailure = {
  kind: PortfolioSummaryFailureKind;
  message: string;
};

function humanizeToken(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  return trimmed
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function getMetricCopy(id: PortfolioMetricId, copy: PortfolioCopy) {
  if (id === "total-assets") return copy.metrics.totalAssets;
  if (id === "day-pnl") return copy.metrics.dayPnl;
  if (id === "unrealized-pnl") return copy.metrics.unrealizedPnl;
  return copy.metrics.cashBuyingPower;
}

function getToneClassName(tone: "positive" | "negative" | "neutral") {
  if (tone === "positive") return styles.positiveText;
  if (tone === "negative") return styles.negativeText;
  return styles.neutralText;
}

function getSummaryValueClassName(tone: "positive" | "negative" | "neutral") {
  if (tone === "positive") return `${styles.summaryValue} ${styles.positiveText}`;
  if (tone === "negative") return `${styles.summaryValue} ${styles.negativeText}`;
  return styles.summaryValue;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <SurfaceState title={title}>{body}</SurfaceState>;
}

function StateNotice({
  body,
  title,
  tone = "neutral",
}: {
  body: string;
  title: string;
  tone?: "loading" | "neutral" | "warning";
}) {
  return (
    <SurfaceState
      title={title}
      tone={tone === "warning" ? "warning" : tone === "loading" ? "loading" : "neutral"}
    >
      {body}
    </SurfaceState>
  );
}

type PortfolioSummaryFailure = Extract<TradingApiJsonResult<PortfolioSummaryDto>, { ok: false }>;

function getHttpFailureDetail(result: PortfolioSummaryFailure) {
  const detail = result.message ? `: ${result.message}` : "";
  return `HTTP ${result.status}${detail}`;
}

function getPortfolioFailure(result: PortfolioSummaryFailure, copy: PortfolioCopy): PortfolioFailure {
  const kind = classifyPortfolioSummaryFailure(result);
  const httpDetail = getHttpFailureDetail(result);

  if (kind === "endpoint-pending") {
    return {
      kind,
      message: `${copy.errors.endpointPending} ${httpDetail}`,
    };
  }

  if (kind === "not-configured") {
    return {
      kind,
      message: result.message ? `${copy.errors.configMissing} ${result.message}` : copy.errors.configMissing,
    };
  }

  return {
    kind,
    message: `${copy.errors.upstreamUnavailable} ${httpDetail}`,
  };
}

function getPortfolioStatusLabel(state: PortfolioSummaryState, summary: PortfolioSummaryDto | null, copy: PortfolioCopy) {
  if (state === "loading") return copy.loading;
  if (state === "endpoint-pending") return copy.statusEndpointPending;
  if (state === "invalid-response") return copy.statusInvalidResponse;
  if (state === "not-configured") return copy.statusNotConfigured;
  if (state === "upstream-unavailable") return copy.statusUpstreamUnavailable;
  if (state === "connected-empty") return copy.statusEmpty;
  if (state === "stale-sync") return humanizeToken(summary?.sync?.status, copy.statusStaleSync);
  if (state === "partial-data") return humanizeToken(summary?.sync?.status, copy.statusPartialData);

  return humanizeToken(summary?.sync?.status, copy.statusFullySynced);
}

function getPortfolioStatusPillClassName(state: PortfolioSummaryState) {
  if (
    state === "endpoint-pending" ||
    state === "invalid-response" ||
    state === "not-configured" ||
    state === "partial-data" ||
    state === "stale-sync" ||
    state === "upstream-unavailable"
  ) {
    return `${styles.statusPill} ${styles.statusPillWarning}`;
  }

  if (state === "fully-synced") {
    return `${styles.statusPill} ${styles.statusPillPositive}`;
  }

  return `${styles.statusPill} ${styles.statusPillNeutral}`;
}

function getUnavailableMetricDetail(state: PortfolioSummaryState, copy: PortfolioCopy) {
  if (state === "loading") return copy.metricLoadingDetail;
  if (state === "endpoint-pending") return copy.metricEndpointPendingDetail;
  if (state === "invalid-response") return copy.metricInvalidResponseDetail;
  if (state === "not-configured") return copy.metricNotConfiguredDetail;
  if (state === "upstream-unavailable") return copy.metricUpstreamUnavailableDetail;
  if (state === "stale-sync") return copy.metricStaleSyncDetail;
  if (state === "partial-data") return copy.metricPartialDataDetail;
  if (state === "connected-empty") return copy.metricEmptyDetail;

  return copy.fieldNotReported;
}

function getMetricValueFallback(state: PortfolioSummaryState, copy: PortfolioCopy) {
  if (state === "loading") return copy.loading;
  if (state === "endpoint-pending") return copy.fieldEndpointPending;
  if (state === "invalid-response") return copy.fieldInvalidResponse;
  if (state === "not-configured") return copy.fieldNotConfigured;
  if (state === "upstream-unavailable") return copy.fieldUpstreamUnavailable;
  if (state === "stale-sync") return copy.fieldStale;
  if (state === "partial-data") return copy.fieldPartial;
  if (state === "connected-empty") return copy.fieldEmpty;

  return copy.fieldNotReported;
}

function getFieldFallback(state: PortfolioSectionState, copy: PortfolioCopy) {
  if (state === "loading") return copy.loading;
  if (state === "endpoint-pending") return copy.fieldEndpointPending;
  if (state === "invalid-response") return copy.fieldInvalidResponse;
  if (state === "not-configured") return copy.fieldNotConfigured;
  if (state === "upstream-unavailable") return copy.fieldUpstreamUnavailable;
  if (state === "stale-sync") return copy.fieldStale;
  if (state === "partial-data") return copy.fieldPartial;
  if (state === "empty") return copy.fieldEmpty;

  return copy.fieldNotReported;
}

function getTimestampFallback(state: PortfolioSummaryState | PortfolioSectionState, copy: PortfolioCopy) {
  if (state === "loading") return copy.loading;
  if (state === "endpoint-pending") return copy.fieldEndpointPending;
  if (state === "invalid-response") return copy.fieldInvalidResponse;
  if (state === "not-configured") return copy.fieldNotConfigured;
  if (state === "upstream-unavailable") return copy.fieldUpstreamUnavailable;
  if (state === "stale-sync") return copy.timestampMissingStale;
  if (state === "partial-data") return copy.timestampMissingPartial;

  return copy.timestampMissing;
}

function getPortfolioStateNotice(
  state: PortfolioSummaryState | PortfolioSectionState,
  failureMessage: string | null,
  syncMessage: string | null,
  copy: PortfolioCopy,
) {
  if (state === "loading") {
    return { body: copy.loadingPortfolio, title: copy.loadingTitle, tone: "loading" as const };
  }

  if (state === "endpoint-pending") {
    return { body: failureMessage ?? copy.endpointPendingBody, title: copy.endpointPendingTitle, tone: "warning" as const };
  }

  if (state === "invalid-response") {
    return { body: failureMessage ?? copy.invalidResponseBody, title: copy.invalidResponseTitle, tone: "warning" as const };
  }

  if (state === "not-configured") {
    return { body: failureMessage ?? copy.notConfiguredBody, title: copy.notConfiguredTitle, tone: "warning" as const };
  }

  if (state === "upstream-unavailable") {
    return { body: failureMessage ?? copy.upstreamUnavailableBody, title: copy.upstreamUnavailableTitle, tone: "warning" as const };
  }

  if (state === "stale-sync") {
    return { body: syncMessage ?? copy.staleSyncBody, title: copy.staleSyncTitle, tone: "warning" as const };
  }

  if (state === "partial-data") {
    return { body: syncMessage ?? copy.partialDataBody, title: copy.partialDataTitle, tone: "warning" as const };
  }

  if (state === "connected-empty") {
    return { body: copy.connectedEmptyBody, title: copy.connectedEmptyTitle, tone: "neutral" as const };
  }

  return null;
}

function getBlockingSectionNotice(
  state: PortfolioSectionState,
  failureMessage: string | null,
  syncMessage: string | null,
  copy: PortfolioCopy,
) {
  if (
    state === "loading" ||
    state === "endpoint-pending" ||
    state === "invalid-response" ||
    state === "not-configured" ||
    state === "upstream-unavailable"
  ) {
    return getPortfolioStateNotice(state, failureMessage, syncMessage, copy);
  }

  return null;
}

function getSectionStatusLabel(state: PortfolioSectionState, copy: PortfolioCopy) {
  if (state === "empty") return copy.statusSectionEmpty;
  return getPortfolioStatusLabel(state, null, copy);
}

function getSectionMeta(baseLabel: string, state: PortfolioSectionState, copy: PortfolioCopy) {
  if (state === "fully-synced") return baseLabel;

  return `${baseLabel} · ${getSectionStatusLabel(state, copy)}`;
}

function getEmptyStateCopy(section: PortfolioSectionId, state: PortfolioSectionState, copy: PortfolioCopy) {
  if (state === "partial-data") {
    if (section === "accounts") return { body: copy.partialAccountsBody, title: copy.partialAccountsTitle };
    if (section === "holdings") return { body: copy.partialHoldingsBody, title: copy.partialHoldingsTitle };
    if (section === "allocation") return { body: copy.partialAllocationBody, title: copy.partialAllocationTitle };
    if (section === "activity") return { body: copy.partialActivityBody, title: copy.partialActivityTitle };
  }

  if (section === "accounts") return { body: copy.emptyAccountsBody, title: copy.emptyAccountsTitle };
  if (section === "holdings") return { body: copy.emptyHoldingsBody, title: copy.emptyHoldingsTitle };
  if (section === "allocation") return { body: copy.emptyAllocationBody, title: copy.emptyAllocationTitle };

  return { body: copy.emptyActivityBody, title: copy.emptyActivityTitle };
}

export default function PortfolioPageClient() {
  const { t } = useAppState();
  const copy = t.portfolio;
  const initialSummary = readTradingApiJsonSnapshot<PortfolioSummaryDto>(PORTFOLIO_SUMMARY_PATH);
  const [summary, setSummary] = useState<PortfolioSummaryDto | null>(() => initialSummary);
  const [loading, setLoading] = useState(() => initialSummary === null);
  const [failure, setFailure] = useState<PortfolioFailure | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPortfolio = async () => {
      try {
        const result = await getTradingApiJsonResult<PortfolioSummaryDto>(
          resolveTradingApiClientPath(PORTFOLIO_SUMMARY_PATH),
        );

        if (cancelled) return;

        if (!result.ok) {
          setFailure(getPortfolioFailure(result, copy));
          setSummary(null);
          setLoading(false);
          return;
        }

        if (!result.data || typeof result.data !== "object") {
          setFailure({ kind: "invalid-response", message: copy.errors.emptyResponse });
          setSummary(null);
          setLoading(false);
          return;
        }

        seedTradingApiJsonSnapshot(PORTFOLIO_SUMMARY_PATH, result.data);
        setSummary(result.data);
        setFailure(null);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setFailure({ kind: "upstream-unavailable", message: copy.errors.upstreamUnavailable });
          setLoading(false);
        }
      }
    };

    void loadPortfolio();

    return () => {
      cancelled = true;
    };
  }, [copy]);

  const accounts = getPortfolioAccounts(summary);
  const holdings = getPortfolioHoldings(summary);
  const allocations = getPortfolioAllocations(summary);
  const activity = getPortfolioActivity(summary);
  const portfolioState = resolvePortfolioSummaryState({
    error: failure?.message,
    failureKind: failure?.kind,
    loading,
    summary,
  });
  const sectionStates = useMemo(() => buildPortfolioSectionStates(summary, portfolioState), [portfolioState, summary]);
  const metrics = useMemo(
    () => buildPortfolioMetricModels(summary, getMetricValueFallback(portfolioState, copy)),
    [copy, portfolioState, summary],
  );
  const lastSyncedAt = getPortfolioLastSyncedAt(summary);
  const lastSyncedLabel = formatDisplayTimestamp(lastSyncedAt, getTimestampFallback(portfolioState, copy));
  const statusLabel = getPortfolioStatusLabel(portfolioState, summary, copy);
  const accountCountLabel = `${accounts.length} ${accounts.length === 1 ? copy.account : copy.accounts}`;
  const holdingCountLabel = `${holdings.length} ${holdings.length === 1 ? copy.holding : copy.holdings}`;
  const syncMessage = getPortfolioSyncMessage(summary);
  const noticeMessages = getPortfolioNoticeMessages(summary, portfolioState);
  const portfolioNotice = getPortfolioStateNotice(portfolioState, failure?.message ?? null, syncMessage, copy);
  const accountSectionState = sectionStates.accounts;
  const holdingsSectionState = sectionStates.holdings;
  const allocationSectionState = sectionStates.allocation;
  const activitySectionState = sectionStates.activity;
  const accountFieldFallback = getFieldFallback(accountSectionState, copy);
  const holdingsFieldFallback = getFieldFallback(holdingsSectionState, copy);
  const allocationFieldFallback = getFieldFallback(allocationSectionState, copy);
  const accountBlockingNotice = getBlockingSectionNotice(accountSectionState, failure?.message ?? null, syncMessage, copy);
  const holdingsBlockingNotice = getBlockingSectionNotice(holdingsSectionState, failure?.message ?? null, syncMessage, copy);
  const allocationBlockingNotice = getBlockingSectionNotice(allocationSectionState, failure?.message ?? null, syncMessage, copy);
  const activityBlockingNotice = getBlockingSectionNotice(activitySectionState, failure?.message ?? null, syncMessage, copy);
  const allocationRows =
    allocations.length > 0
      ? allocations
      : holdings
          .filter((holding) => typeof holding.allocationPercent === "number")
          .map((holding) => ({
            id: holding.id ?? holding.symbol,
            label: holding.name?.trim() || holding.symbol,
            value: holding.marketValue,
            percent: holding.allocationPercent,
          }));

  return (
    <MobileAppChrome
      activeNav="portfolio"
      portfolioHref="/portfolio"
      header={
        <>
          <div className={styles.headerBrand}>
            <div className={styles.brandMark}>K</div>
            <div>
              <strong className={styles.brandTitle}>{copy.title}</strong>
              <span className={styles.brandMeta}>{copy.brandMeta}</span>
            </div>
          </div>

          <div className={styles.headerActions}>
            <span className={getPortfolioStatusPillClassName(portfolioState)}>{statusLabel}</span>
            <DevModeToggle />
          </div>
        </>
      }
    >
      <div className={styles.page}>
        <section className={`${styles.panel} ${styles.heroPanel}`}>
          <ComponentTag label="portfolio.summary" api={PORTFOLIO_SUMMARY_PATH} />
          <p className={styles.heroEyebrow}>{copy.breadcrumb}</p>
          <h1 className={styles.heroTitle}>{copy.title}</h1>
          <p className={styles.heroCopy}>{copy.heroCopy}</p>

          <div className={styles.summaryGrid} aria-label={copy.summaryMetrics}>
            {metrics.map((metric) => {
              const metricCopy = getMetricCopy(metric.id, copy);
              return (
                <article key={metric.id} className={styles.summaryCard}>
                  <span>{metricCopy.label}</span>
                  <strong className={getSummaryValueClassName(metric.tone)}>{metric.value}</strong>
                  <small>{metric.available ? metricCopy.detail : getUnavailableMetricDetail(portfolioState, copy)}</small>
                </article>
              );
            })}
          </div>

          <dl className={styles.syncGrid}>
            <div>
              <dt>{copy.accountState}</dt>
              <dd>{accountCountLabel}</dd>
            </div>
            <div>
              <dt>{copy.holdings}</dt>
              <dd>{holdingCountLabel}</dd>
            </div>
            <div>
              <dt>{copy.lastSync}</dt>
              <dd>{lastSyncedLabel}</dd>
            </div>
          </dl>

          <div className={styles.heroActions}>
            <Link href="/dashboard" className={styles.secondaryLink}>
              {copy.backToDashboard}
            </Link>
            <Link href="/my-symbols" className={styles.secondaryLink}>
              {copy.openMySymbols}
            </Link>
          </div>

          {portfolioNotice ? (
            <StateNotice title={portfolioNotice.title} body={portfolioNotice.body} tone={portfolioNotice.tone} />
          ) : null}
          {noticeMessages.map((notice, index) => (
            <p key={`${notice}-${index}`} className={styles.notice}>{notice}</p>
          ))}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>{copy.accountState}</p>
              <h2 className={styles.sectionTitle}>{copy.accountsTitle}</h2>
            </div>
            <span className={styles.sectionMeta}>{getSectionMeta(accountCountLabel, accountSectionState, copy)}</span>
          </div>

          {accountBlockingNotice ? (
            <StateNotice {...accountBlockingNotice} />
          ) : accounts.length === 0 ? (
            <EmptyState {...getEmptyStateCopy("accounts", accountSectionState, copy)} />
          ) : (
            <div className={styles.accountGrid}>
              {accounts.map((account) => (
                <article key={account.id} className={styles.accountCard}>
                  <div className={styles.cardHeader}>
                    <div>
                      <strong>{account.label}</strong>
                      <p>{[account.broker, account.accountType].filter(Boolean).join(" · ") || copy.account}</p>
                    </div>
                    <span className={styles.badge}>{humanizeToken(account.status, copy.statusMissing)}</span>
                  </div>

                  <dl className={styles.metaGrid}>
                    <div>
                      <dt>{copy.metrics.totalAssets.label}</dt>
                      <dd>{formatPortfolioMoney(account.summary?.totalAssets ?? account.summary?.totalEquity, accountFieldFallback)}</dd>
                    </div>
                    <div>
                      <dt>{copy.cash}</dt>
                      <dd>{formatPortfolioMoney(account.summary?.cash, accountFieldFallback)}</dd>
                    </div>
                    <div>
                      <dt>{copy.buyingPower}</dt>
                      <dd>{formatPortfolioMoney(account.summary?.buyingPower, accountFieldFallback)}</dd>
                    </div>
                    <div>
                      <dt>{copy.lastSync}</dt>
                      <dd>{formatDisplayTimestamp(account.lastSyncedAt, getTimestampFallback(accountSectionState, copy))}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>{copy.positionVisibility}</p>
              <h2 className={styles.sectionTitle}>{copy.holdingsTitle}</h2>
            </div>
            <span className={styles.sectionMeta}>{getSectionMeta(holdingCountLabel, holdingsSectionState, copy)}</span>
          </div>

          {holdingsBlockingNotice ? (
            <StateNotice {...holdingsBlockingNotice} />
          ) : holdings.length === 0 ? (
            <EmptyState {...getEmptyStateCopy("holdings", holdingsSectionState, copy)} />
          ) : (
            <div className={styles.holdingList} aria-label={copy.holdingsList}>
              {holdings.map((holding, index) => (
                <article key={`${holding.id ?? holding.symbol}-${index}`} className={styles.holdingCard}>
                  <div className={styles.cardHeader}>
                    <div>
                      <strong>{holding.name?.trim() || holding.symbol}</strong>
                      <p>{holding.symbol}{holding.market ? ` · ${holding.market}` : ""}</p>
                    </div>
                    <span className={styles.badge}>
                      {formatPortfolioPercent(holding.allocationPercent, copy.fieldNotAllocated)}
                    </span>
                  </div>

                  <dl className={styles.metaGrid}>
                    <div>
                      <dt>{copy.quantity}</dt>
                      <dd>{typeof holding.quantity === "number" ? holding.quantity.toLocaleString("en-US") : holdingsFieldFallback}</dd>
                    </div>
                    <div>
                      <dt>{copy.marketValue}</dt>
                      <dd>{formatPortfolioMoney(holding.marketValue, holdingsFieldFallback)}</dd>
                    </div>
                    <div>
                      <dt>{copy.lastPrice}</dt>
                      <dd>{formatPortfolioMoney(holding.lastPrice, holdingsFieldFallback)}</dd>
                    </div>
                    <div>
                      <dt>{copy.unrealizedPnl}</dt>
                      <dd className={getToneClassName(
                        (holding.unrealizedPnl?.amount ?? 0) > 0
                          ? "positive"
                          : (holding.unrealizedPnl?.amount ?? 0) < 0
                            ? "negative"
                            : "neutral",
                      )}>
                        {formatPortfolioMoney(holding.unrealizedPnl, holdingsFieldFallback)}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>{copy.accountAnalytics}</p>
              <h2 className={styles.sectionTitle}>{copy.allocationTitle}</h2>
            </div>
            <span className={styles.sectionMeta}>{getSectionMeta(copy.readyForExpansion, allocationSectionState, copy)}</span>
          </div>

          {allocationBlockingNotice ? (
            <StateNotice {...allocationBlockingNotice} />
          ) : allocationRows.length === 0 ? (
            <EmptyState {...getEmptyStateCopy("allocation", allocationSectionState, copy)} />
          ) : (
            <div className={styles.allocationList}>
              {allocationRows.map((row) => (
                <div key={row.id} className={styles.allocationRow}>
                  <div>
                    <strong>{row.label}</strong>
                    <span>{formatPortfolioMoney(row.value, allocationFieldFallback)}</span>
                  </div>
                  <div className={styles.allocationBar} aria-hidden="true">
                    <span style={{ width: `${Math.max(0, Math.min(100, row.percent ?? 0))}%` }} />
                  </div>
                  <em>{formatPortfolioPercent(row.percent, copy.fieldNotAllocated)}</em>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>{copy.tradingVisibility}</p>
              <h2 className={styles.sectionTitle}>{copy.recentActivityTitle}</h2>
            </div>
            <span className={styles.sectionMeta}>{getSectionMeta(copy.readOnly, activitySectionState, copy)}</span>
          </div>

          {activityBlockingNotice ? (
            <StateNotice {...activityBlockingNotice} />
          ) : activity.length === 0 ? (
            <EmptyState {...getEmptyStateCopy("activity", activitySectionState, copy)} />
          ) : (
            <div className={styles.activityList}>
              {activity.map((item) => (
                <article key={item.id} className={styles.activityCard}>
                  <div>
                    <strong>{item.symbol ?? copy.account}</strong>
                    <p>{humanizeToken(item.side, copy.order)} · {humanizeToken(item.status, copy.statusMissing)}</p>
                  </div>
                  <span>{formatDisplayTimestamp(item.updatedAt ?? item.submittedAt, getTimestampFallback(activitySectionState, copy))}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </MobileAppChrome>
  );
}
