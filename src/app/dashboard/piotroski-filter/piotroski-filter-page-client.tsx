"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { useAppState } from "@/components/providers/app-state-provider";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { getDashboardLiveCopy } from "@/i18n/dashboard-live-copy";
import {
  buildPiotroskiSymbolHref,
  getPiotroskiMarketDate,
  loadPiotroskiPassList,
  loadPiotroskiPassListItemEnrichment,
  getPiotroskiUnavailableChangeLabel,
  type PiotroskiPassListItem,
  type PiotroskiPassListResult,
} from "@/lib/piotroski-pass-list";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import { getCachedTradingApiJson } from "@/lib/trading-api-cache";
import { getUserFacingErrorMessage } from "@/lib/user-facing-errors";
import { cn } from "@/lib/utils";
import type { EodFreshnessResponseDto } from "@/types/trading-api";

import styles from "./piotroski-filter-page.module.css";

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number";
}

function formatSignedPercent(value: number | null | undefined, fallback: string) {
  if (!hasNumber(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatPiotroskiScore(value: number | null | undefined, fallback: string) {
  if (!hasNumber(value)) return fallback;
  return value.toLocaleString("ko-KR");
}

function getQuoteToneClass(value: number | null | undefined) {
  if (!hasNumber(value)) return styles.neutralTone;
  return value >= 0 ? styles.positiveTone : styles.negativeTone;
}

function getPiotroskiMarketDateNote(
  copy: ReturnType<typeof getDashboardLiveCopy>["piotroskiFilter"],
  requestedMarketDate: string | null | undefined,
  effectiveMarketDate: string | null | undefined,
  isLatestFallback: boolean,
) {
  const requestedDate = requestedMarketDate?.trim() || null;
  const effectiveDate = effectiveMarketDate?.trim() || null;
  const requestedMarketDateSuffix = copy.requestedMarketDateSuffix || ".";

  if (!effectiveDate) return null;

  if (requestedDate && requestedDate !== effectiveDate) {
    return isLatestFallback
      ? `${copy.requestedDatePrefix} ${requestedDate}. ${copy.latestAvailableSuffix} ${effectiveDate}${requestedMarketDateSuffix}`
      : `${copy.requestedDatePrefix} ${requestedDate}. ${copy.resolvedSuffix} ${effectiveDate}${requestedMarketDateSuffix}`;
  }

  if (isLatestFallback) {
    return `${copy.latestAvailableSuffix} ${effectiveDate}${requestedMarketDateSuffix}`;
  }

  return null;
}

function mergeEnrichedPiotroskiItem(
  currentData: PiotroskiPassListResult | null,
  enrichedItem: PiotroskiPassListItem,
) {
  if (!currentData) return currentData;

  const itemIndex = currentData.items.findIndex(
    (item) => item.symbol === enrichedItem.symbol && item.marketDate === enrichedItem.marketDate,
  );
  if (itemIndex < 0) return currentData;

  const nextItems = [...currentData.items];
  nextItems[itemIndex] = enrichedItem;
  return {
    ...currentData,
    items: nextItems,
  };
}

function getPiotroskiEmptyState(
  copy: ReturnType<typeof getDashboardLiveCopy>["piotroskiFilter"],
  data: PiotroskiPassListResult | null,
  displayedMarketDate: string | null,
) {
  if (data && data.totalPassedCount > 0 && data.items.length === 0) {
    const passedLabel = data.totalPassedCount.toLocaleString("ko-KR");
    const dateLabel = displayedMarketDate ?? data.marketDate;
    return copy.passedSummaryTemplate
      .replace("%passedCount%", passedLabel)
      .replace("%marketDate%", dateLabel);
  }

  return displayedMarketDate
    ? `${copy.noPassedSymbols} ${displayedMarketDate}.`
    : copy.marketDateUnavailable;
}

async function loadFreshness() {
  try {
    return await getCachedTradingApiJson<EodFreshnessResponseDto>(
      resolveTradingApiClientPath("/api/trading/eod/freshness"),
    );
  } catch (error) {
    throw error;
  }
}

export default function PiotroskiFilterPageClient() {
  const searchParams = useSearchParams();
  const { locale } = useAppState();
  const copy = getDashboardLiveCopy(locale).piotroskiFilter;
  const requestedMarketDate = useMemo(() => searchParams.get("marketDate"), [searchParams]);
  const [marketDate, setMarketDate] = useState<string | null>(requestedMarketDate);
  const [data, setData] = useState<PiotroskiPassListResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">(
    requestedMarketDate ? "loading" : "idle",
  );

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
        const freshness = await loadFreshness();
        if (!active) return;
        const resolvedMarketDate = getPiotroskiMarketDate(freshness, null);
        setMarketDate(resolvedMarketDate);
        if (!resolvedMarketDate) {
          setLoadState("error");
          setError(copy.unavailableDescription);
        }
      } catch (freshnessError) {
        if (!active) return;
        setLoadState("error");
        setError(freshnessError instanceof Error ? freshnessError.message : copy.marketDateUnavailableError);
      }
    };

    void loadFallbackMarketDate();

    return () => {
      active = false;
    };
  }, [copy.marketDateUnavailableError, copy.unavailableDescription, requestedMarketDate, retryNonce]);

  useEffect(() => {
    if (!marketDate) return;

    let active = true;
    setData(null);
    setLoadState("loading");
    setError(null);

    const loadData = async () => {
      try {
        const nextData = await loadPiotroskiPassList({ marketDate });
        if (!active) return;
        setData(nextData);
        setLoadState("ready");

        for (const item of nextData.items) {
          void loadPiotroskiPassListItemEnrichment(item).then((enrichedItem) => {
            if (!active) return;
            setData((currentData) => mergeEnrichedPiotroskiItem(currentData, enrichedItem));
          });
        }
      } catch (loadError) {
        console.error("Piotroski filter page load failed", loadError);
        if (!active) return;
        setData(null);
        setLoadState("error");
        setError(loadError instanceof Error ? loadError.message : copy.marketDateUnavailableError);
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [copy.marketDateUnavailableError, marketDate, retryNonce]);

  function handleRetry() {
    setData(null);
    setError(null);
    setLoadState("loading");
    setMarketDate(requestedMarketDate);
    setRetryNonce((current) => current + 1);
  }

  const displayedMarketDate = data?.marketDate ?? marketDate;
  const isUnavailable = loadState === "error";
  const marketDateNote = data
    ? getPiotroskiMarketDateNote(copy, data.requestedMarketDate, data.marketDate, data.isLatestFallback)
    : null;
  const pageCopyText = isUnavailable
    ? copy.unavailableDescription
    : displayedMarketDate
      ? marketDateNote
        ? `${copy.pageCopyPrefix} ${displayedMarketDate}${copy.pageCopySuffix} ${marketDateNote}`
        : `${copy.pageCopyPrefix} ${displayedMarketDate}${copy.pageCopySuffix}`
      : copy.pageCopyLoading;
  const errorDetail = getUserFacingErrorMessage(error, "");

  return (
    <MobileAppChrome
      chrome={{
        activeNav: "dashboard",
        status: {
          label: isUnavailable
            ? copy.unavailableStatus
            : displayedMarketDate
              ? `MD ${displayedMarketDate}`
              : copy.marketDatePending,
        },
        toolbarAction: "dev-mode",
      }}
    >
      <div className={styles.stack}>
        <section className={styles.heroPanel}>
          <div className={styles.heroCopy}>
            <ComponentTag
              label="dashboard.piotroski-board"
              api="/api/trading/eod/piotroski-filter-results + /api/trading/quotes/{symbol} + /api/trading/symbols/search"
            />
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1 className={styles.pageTitle}>{copy.title}</h1>
            <p className={styles.pageCopy}>{pageCopyText}</p>
          </div>

          <Link href="/dashboard" className={styles.backLink}>
            {copy.backToDashboard}
          </Link>
        </section>

        <section className={styles.panel}>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span>{copy.marketDateLabel}</span>
              <strong>{displayedMarketDate ?? (isUnavailable ? copy.unavailableValue : copy.pendingMarketDate)}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>{copy.passedSymbolsLabel}</span>
              <strong>
                {loadState === "ready"
                  ? data?.totalPassedCount.toLocaleString("ko-KR") ?? "0"
                  : isUnavailable
                    ? copy.unavailableValue
                    : "..."}
              </strong>
            </div>
            <div className={styles.summaryCard}>
              <span>{copy.sortLabel}</span>
              <strong>{copy.sortValue}</strong>
            </div>
          </div>

          {loadState === "loading" ? (
            <div className={styles.emptyState}>{copy.loading}</div>
          ) : loadState === "error" ? (
            <div className={cn(styles.emptyState, styles.errorState)} role="alert" data-testid="piotroski-error-state">
              <p className={styles.errorMessage}>{copy.unavailableDescription}</p>
              {errorDetail && errorDetail !== copy.unavailableDescription ? (
                <p className={styles.errorDetail}>{errorDetail}</p>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
                {copy.retry}
              </Button>
            </div>
          ) : data && data.items.length > 0 ? (
            <div className={styles.list}>
              {data.items.map((item) => {
                const companyName = item.companyName ?? copy.unknownCompany;
                const closeLabel =
                  item.quote?.available && hasNumber(item.quote.price)
                    ? `₩${formatPrice(item.quote.price)}`
                    : copy.closeUnavailable;
                const changeLabel = item.quote?.available
                  ? formatSignedPercent(item.quote.change_pct, copy.changeUnavailable)
                  : item.quote
                    ? getPiotroskiUnavailableChangeLabel(item.quote.unavailable_reason)
                    : copy.changeUnavailable;

                return (
                  <Link
                    key={item.symbol}
                    href={buildPiotroskiSymbolHref({
                      symbol: item.symbol,
                      companyName: item.companyName,
                      marketDate: item.marketDate,
                    })}
                    className={styles.row}
                  >
                    <div className={styles.rowMain}>
                      <strong className={styles.companyName}>{companyName}</strong>
                      <span className={styles.symbolCode}>{item.symbol}</span>
                    </div>

                    <div className={styles.metricGroup}>
                      <div className={styles.metric}>
                        <span>{copy.metricClose}</span>
                        <strong>{closeLabel}</strong>
                      </div>
                      <div className={styles.metric}>
                        <span>{copy.metricChange}</span>
                        <strong className={getQuoteToneClass(item.quote?.change_pct)}>{changeLabel}</strong>
                      </div>
                      <div className={styles.metric}>
                        <span>{copy.metricScore}</span>
                        <strong>{formatPiotroskiScore(item.piotroskiScore, copy.unknownScore)}</strong>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>{getPiotroskiEmptyState(copy, data, displayedMarketDate)}</div>
          )}
        </section>
      </div>
    </MobileAppChrome>
  );
}
