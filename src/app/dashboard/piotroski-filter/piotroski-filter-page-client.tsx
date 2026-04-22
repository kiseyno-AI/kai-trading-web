"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { formatPrice } from "@/lib/format";
import {
  buildPiotroskiSymbolHref,
  getPiotroskiMarketDate,
  loadPiotroskiPassList,
  type PiotroskiPassListResult,
} from "@/lib/piotroski-pass-list";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import { getCachedTradingApiJson } from "@/lib/trading-api-cache";
import type { EodFreshnessResponseDto } from "@/types/trading-api";

import styles from "./piotroski-filter-page.module.css";

const UNKNOWN_LABEL = "[확인 필요]";

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number";
}

function formatSignedPercent(value: number | null | undefined, fallback = "Unavailable") {
  if (!hasNumber(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatPiotroskiScore(value: number | null | undefined, fallback = UNKNOWN_LABEL) {
  if (!hasNumber(value)) return fallback;
  return value.toLocaleString("ko-KR");
}

function getQuoteToneClass(value: number | null | undefined) {
  if (!hasNumber(value)) return styles.neutralTone;
  return value >= 0 ? styles.positiveTone : styles.negativeTone;
}

async function loadFreshness() {
  return getCachedTradingApiJson<EodFreshnessResponseDto>(
    resolveTradingApiClientPath("/api/trading/eod/freshness"),
  );
}

export default function PiotroskiFilterPageClient() {
  const searchParams = useSearchParams();
  const requestedMarketDate = useMemo(() => searchParams.get("marketDate"), [searchParams]);
  const [marketDate, setMarketDate] = useState<string | null>(requestedMarketDate);
  const [data, setData] = useState<PiotroskiPassListResult | null>(null);
  const [error, setError] = useState<string | null>(null);
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
          setError("Piotroski market date is unavailable.");
        }
      } catch (freshnessError) {
        if (!active) return;
        setLoadState("error");
        setError(freshnessError instanceof Error ? freshnessError.message : "Piotroski market date is unavailable.");
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
    setData(null);
    setLoadState("loading");
    setError(null);

    const loadData = async () => {
      try {
        const nextData = await loadPiotroskiPassList({ marketDate });
        if (!active) return;
        setData(nextData);
        setLoadState("ready");
      } catch (loadError) {
        console.error("Piotroski filter page load failed", loadError);
        if (!active) return;
        setData(null);
        setLoadState("error");
        setError(loadError instanceof Error ? loadError.message : "Piotroski filter results are unavailable.");
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [marketDate]);

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
              {marketDate ? `MD ${marketDate}` : "MD pending"}
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
              label="dashboard.piotroski-board"
              api="/api/trading/eod/piotroski-filter-results + /api/trading/quotes/{symbol} + /api/trading/symbols/search"
            />
            <p className={styles.eyebrow}>Piotroski Filter</p>
            <h1 className={styles.pageTitle}>Piotroski filter pass list</h1>
            <p className={styles.pageCopy}>
              {marketDate
                ? `Showing passed symbols for ${marketDate}, ranked by Piotroski score descending.`
                : "Resolving the latest stored Piotroski market date."}
            </p>
          </div>

          <Link href="/dashboard" className={styles.backLink}>
            Back to dashboard
          </Link>
        </section>

        <section className={styles.panel}>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span>Market date</span>
              <strong>{marketDate ?? "Pending"}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>Passed symbols</span>
              <strong>{loadState === "ready" ? data?.totalPassedCount.toLocaleString("ko-KR") ?? "0" : "..."}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>Sort</span>
              <strong>Score desc</strong>
            </div>
          </div>

          {loadState === "loading" ? (
            <div className={styles.emptyState}>Loading Piotroski pass list...</div>
          ) : loadState === "error" ? (
            <div className={styles.emptyState}>{error ?? "Piotroski filter results are unavailable."}</div>
          ) : data && data.items.length > 0 ? (
            <div className={styles.list}>
              {data.items.map((item) => {
                const companyName = item.companyName ?? UNKNOWN_LABEL;
                const closeLabel =
                  item.quote?.available && hasNumber(item.quote.price)
                    ? `₩${formatPrice(item.quote.price)}`
                    : "Quote unavailable";
                const changeLabel = item.quote?.available
                  ? formatSignedPercent(item.quote.change_pct)
                  : item.quote?.unavailable_reason ?? "Unavailable";

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
                        <span>Close</span>
                        <strong>{closeLabel}</strong>
                      </div>
                      <div className={styles.metric}>
                        <span>Change</span>
                        <strong className={getQuoteToneClass(item.quote?.change_pct)}>{changeLabel}</strong>
                      </div>
                      <div className={styles.metric}>
                        <span>Score</span>
                        <strong>{formatPiotroskiScore(item.piotroskiScore)}</strong>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              {marketDate
                ? `No Piotroski pass symbols were stored for ${marketDate}.`
                : "Piotroski market date is pending."}
            </div>
          )}
        </section>
      </div>
    </MobileAppChrome>
  );
}
