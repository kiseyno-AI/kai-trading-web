"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { useAppState } from "@/components/providers/app-state-provider";
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
  buildPortfolioMetricModels,
  formatPortfolioMoney,
  formatPortfolioPercent,
  getPortfolioAccounts,
  getPortfolioActivity,
  getPortfolioAllocations,
  getPortfolioHoldings,
  getPortfolioLastSyncedAt,
  getPortfolioSyncMessage,
  resolvePortfolioSummaryState,
  type PortfolioMetricId,
  type PortfolioSummaryState,
} from "@/features/portfolio/portfolio-display";

import styles from "./portfolio-page.module.css";

type PortfolioCopy = ReturnType<typeof useAppState>["t"]["portfolio"];

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
  return (
    <div className={styles.emptyState} role="status">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
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
  const className =
    tone === "warning"
      ? styles.errorState
      : tone === "loading"
        ? `${styles.emptyState} ${styles.loadingState}`
        : styles.emptyState;

  return (
    <div className={className} role={tone === "warning" ? "alert" : "status"}>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

type PortfolioSummaryFailure = Extract<TradingApiJsonResult<PortfolioSummaryDto>, { ok: false }>;

function getPortfolioUnavailableMessage(result: PortfolioSummaryFailure, copy: PortfolioCopy) {
  if (result.status === 404) {
    return `${copy.errors.endpointPending} HTTP ${result.status}`;
  }

  if (result.status === 500 && /TRADING_API_UPSTREAM|upstream.*config/i.test(result.message ?? "")) {
    return result.message ? `${copy.errors.configMissing} ${result.message}` : copy.errors.configMissing;
  }

  const detail = result.message ? `: ${result.message}` : "";
  return `${copy.errors.summaryUnavailable} HTTP ${result.status}${detail}`;
}

function getPortfolioStatusLabel(state: PortfolioSummaryState, summary: PortfolioSummaryDto | null, copy: PortfolioCopy) {
  if (state === "loading") return copy.loading;
  if (state === "unavailable") return copy.statusUnavailable;
  if (state === "empty") return copy.statusEmpty;
  if (state === "degraded") return humanizeToken(summary?.sync?.status, copy.statusDegraded);

  return humanizeToken(summary?.sync?.status, copy.statusReady);
}

function getPortfolioStatusPillClassName(state: PortfolioSummaryState) {
  if (state === "unavailable" || state === "degraded") {
    return `${styles.statusPill} ${styles.statusPillWarning}`;
  }

  if (state === "ready") {
    return `${styles.statusPill} ${styles.statusPillPositive}`;
  }

  return `${styles.statusPill} ${styles.statusPillNeutral}`;
}

function getUnavailableMetricDetail(state: PortfolioSummaryState, copy: PortfolioCopy) {
  if (state === "loading") return copy.metricLoadingDetail;
  if (state === "unavailable") return copy.metricUnavailableDetail;
  if (state === "degraded") return copy.metricDegradedDetail;
  if (state === "empty") return copy.metricEmptyDetail;

  return copy.waitingForAccountApi;
}

export default function PortfolioPageClient() {
  const { t } = useAppState();
  const copy = t.portfolio;
  const initialSummary = readTradingApiJsonSnapshot<PortfolioSummaryDto>(PORTFOLIO_SUMMARY_PATH);
  const [summary, setSummary] = useState<PortfolioSummaryDto | null>(() => initialSummary);
  const [loading, setLoading] = useState(() => initialSummary === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPortfolio = async () => {
      try {
        const result = await getTradingApiJsonResult<PortfolioSummaryDto>(
          resolveTradingApiClientPath(PORTFOLIO_SUMMARY_PATH),
        );

        if (cancelled) return;

        if (!result.ok) {
          setError(getPortfolioUnavailableMessage(result, copy));
          setSummary(null);
          setLoading(false);
          return;
        }

        if (!result.data || typeof result.data !== "object") {
          setError(copy.errors.emptyResponse);
          setSummary(null);
          setLoading(false);
          return;
        }

        seedTradingApiJsonSnapshot(PORTFOLIO_SUMMARY_PATH, result.data);
        setSummary(result.data);
        setError(null);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError(copy.errors.summaryUnavailable);
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
  const portfolioState = resolvePortfolioSummaryState({ error, loading, summary });
  const metrics = useMemo(() => buildPortfolioMetricModels(summary, copy.unavailable), [copy.unavailable, summary]);
  const lastSyncedAt = getPortfolioLastSyncedAt(summary);
  const lastSyncedLabel = formatDisplayTimestamp(
    lastSyncedAt,
    portfolioState === "loading" ? copy.loading : copy.waitingForAccountApi,
  );
  const statusLabel = getPortfolioStatusLabel(portfolioState, summary, copy);
  const accountCountLabel = `${accounts.length} ${accounts.length === 1 ? copy.account : copy.accounts}`;
  const holdingCountLabel = `${holdings.length} ${holdings.length === 1 ? copy.holding : copy.holdings}`;
  const syncMessage = getPortfolioSyncMessage(summary);
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

          {portfolioState === "loading" ? (
            <StateNotice title={copy.loadingTitle} body={copy.loadingPortfolio} tone="loading" />
          ) : null}
          {portfolioState === "unavailable" && error ? (
            <StateNotice title={copy.summaryUnavailableTitle} body={error} tone="warning" />
          ) : null}
          {portfolioState === "degraded" ? (
            <StateNotice title={copy.summaryDegradedTitle} body={syncMessage ?? copy.summaryDegradedBody} tone="warning" />
          ) : null}
          {summary?.notices?.filter((notice) => notice !== syncMessage).map((notice) => (
            <p key={notice} className={styles.notice}>{notice}</p>
          ))}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>{copy.accountState}</p>
              <h2 className={styles.sectionTitle}>{copy.accountsTitle}</h2>
            </div>
            <span className={styles.sectionMeta}>{accountCountLabel}</span>
          </div>

          {portfolioState === "loading" ? (
            <StateNotice title={copy.loadingTitle} body={copy.loadingPortfolio} tone="loading" />
          ) : portfolioState === "unavailable" ? (
            <StateNotice title={copy.summaryUnavailableTitle} body={copy.summaryUnavailableBody} tone="warning" />
          ) : accounts.length === 0 ? (
            <EmptyState title={copy.emptyAccountsTitle} body={copy.emptyAccountsBody} />
          ) : (
            <div className={styles.accountGrid}>
              {accounts.map((account) => (
                <article key={account.id} className={styles.accountCard}>
                  <div className={styles.cardHeader}>
                    <div>
                      <strong>{account.label}</strong>
                      <p>{[account.broker, account.accountType].filter(Boolean).join(" · ") || copy.account}</p>
                    </div>
                    <span className={styles.badge}>{humanizeToken(account.status, copy.waitingForAccountApi)}</span>
                  </div>

                  <dl className={styles.metaGrid}>
                    <div>
                      <dt>{copy.metrics.totalAssets.label}</dt>
                      <dd>{formatPortfolioMoney(account.summary?.totalAssets ?? account.summary?.totalEquity, copy.unavailable)}</dd>
                    </div>
                    <div>
                      <dt>{copy.cash}</dt>
                      <dd>{formatPortfolioMoney(account.summary?.cash, copy.unavailable)}</dd>
                    </div>
                    <div>
                      <dt>{copy.buyingPower}</dt>
                      <dd>{formatPortfolioMoney(account.summary?.buyingPower, copy.unavailable)}</dd>
                    </div>
                    <div>
                      <dt>{copy.lastSync}</dt>
                      <dd>{formatDisplayTimestamp(account.lastSyncedAt, copy.waitingForAccountApi)}</dd>
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
            <span className={styles.sectionMeta}>{holdingCountLabel}</span>
          </div>

          {portfolioState === "loading" ? (
            <StateNotice title={copy.loadingTitle} body={copy.loadingPortfolio} tone="loading" />
          ) : portfolioState === "unavailable" ? (
            <StateNotice title={copy.summaryUnavailableTitle} body={copy.summaryUnavailableBody} tone="warning" />
          ) : holdings.length === 0 ? (
            <EmptyState title={copy.emptyHoldingsTitle} body={copy.emptyHoldingsBody} />
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
                      {formatPortfolioPercent(holding.allocationPercent, copy.unavailable)}
                    </span>
                  </div>

                  <dl className={styles.metaGrid}>
                    <div>
                      <dt>{copy.quantity}</dt>
                      <dd>{typeof holding.quantity === "number" ? holding.quantity.toLocaleString("en-US") : copy.unavailable}</dd>
                    </div>
                    <div>
                      <dt>{copy.marketValue}</dt>
                      <dd>{formatPortfolioMoney(holding.marketValue, copy.unavailable)}</dd>
                    </div>
                    <div>
                      <dt>{copy.lastPrice}</dt>
                      <dd>{formatPortfolioMoney(holding.lastPrice, copy.unavailable)}</dd>
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
                        {formatPortfolioMoney(holding.unrealizedPnl, copy.unavailable)}
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
            <span className={styles.sectionMeta}>{copy.readyForExpansion}</span>
          </div>

          {portfolioState === "loading" ? (
            <StateNotice title={copy.loadingTitle} body={copy.loadingPortfolio} tone="loading" />
          ) : portfolioState === "unavailable" ? (
            <StateNotice title={copy.summaryUnavailableTitle} body={copy.summaryUnavailableBody} tone="warning" />
          ) : allocationRows.length === 0 ? (
            <EmptyState title={copy.emptyAllocationTitle} body={copy.emptyAllocationBody} />
          ) : (
            <div className={styles.allocationList}>
              {allocationRows.map((row) => (
                <div key={row.id} className={styles.allocationRow}>
                  <div>
                    <strong>{row.label}</strong>
                    <span>{formatPortfolioMoney(row.value, copy.unavailable)}</span>
                  </div>
                  <div className={styles.allocationBar} aria-hidden="true">
                    <span style={{ width: `${Math.max(0, Math.min(100, row.percent ?? 0))}%` }} />
                  </div>
                  <em>{formatPortfolioPercent(row.percent, copy.unavailable)}</em>
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
            <span className={styles.sectionMeta}>{copy.readOnly}</span>
          </div>

          {portfolioState === "loading" ? (
            <StateNotice title={copy.loadingTitle} body={copy.loadingPortfolio} tone="loading" />
          ) : portfolioState === "unavailable" ? (
            <StateNotice title={copy.summaryUnavailableTitle} body={copy.summaryUnavailableBody} tone="warning" />
          ) : activity.length === 0 ? (
            <EmptyState title={copy.emptyActivityTitle} body={copy.emptyActivityBody} />
          ) : (
            <div className={styles.activityList}>
              {activity.map((item) => (
                <article key={item.id} className={styles.activityCard}>
                  <div>
                    <strong>{item.symbol ?? copy.account}</strong>
                    <p>{humanizeToken(item.side, copy.order)} · {humanizeToken(item.status, copy.waitingForAccountApi)}</p>
                  </div>
                  <span>{formatDisplayTimestamp(item.updatedAt ?? item.submittedAt, copy.waitingForAccountApi)}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </MobileAppChrome>
  );
}
