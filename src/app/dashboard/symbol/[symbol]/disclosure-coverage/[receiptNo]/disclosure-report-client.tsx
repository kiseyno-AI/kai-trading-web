"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";

import styles from "../../symbol-detail.module.css";

type SearchParamReader = {
  get: (name: string) => string | null;
};

const SYMBOL_QUERY_KEYS = ["name", "market", "standardCode", "marketDate", "fsDiv"] as const;

function buildPreservedSymbolQuery(searchParams: SearchParamReader) {
  const query = new URLSearchParams();

  for (const key of SYMBOL_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (value) {
      query.set(key, value);
    }
  }

  return query.toString();
}

function buildDisclosureCoverageHref(symbol: string, queryString: string) {
  const path = `/dashboard/symbol/${encodeURIComponent(symbol)}/disclosure-coverage`;
  return queryString ? `${path}?${queryString}` : path;
}

function buildDocumentUrl(receiptNo: string) {
  const query = new URLSearchParams({ rcept_no: receiptNo });
  return `/api/trading/disclosures/dart/filings/document?${query.toString()}`;
}

function buildDartViewerUrl(receiptNo: string) {
  return `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${encodeURIComponent(receiptNo)}`;
}

function getSearchParam(searchParams: SearchParamReader, key: string, fallback: string) {
  const value = searchParams.get(key);
  return value && value.trim().length > 0 ? value : fallback;
}

export function DisclosureReportClient() {
  const params = useParams<{ symbol: string; receiptNo: string }>();
  const searchParams = useSearchParams();
  const symbol = useMemo(() => decodeURIComponent(params.symbol), [params.symbol]);
  const receiptNo = useMemo(() => decodeURIComponent(params.receiptNo), [params.receiptNo]);
  const preservedQueryString = useMemo(() => buildPreservedSymbolQuery(searchParams), [searchParams]);
  const backHref = useMemo(
    () => buildDisclosureCoverageHref(symbol, preservedQueryString),
    [preservedQueryString, symbol],
  );
  const reportName = getSearchParam(searchParams, "reportName", "Disclosure report");
  const receiptDate = getSearchParam(searchParams, "receiptDate", "No receipt date");
  const filingCategory = getSearchParam(searchParams, "filingCategory", "No category");
  const captureStatus = getSearchParam(searchParams, "captureStatus", "Not captured");
  const corpName = getSearchParam(searchParams, "corpName", searchParams.get("name") ?? symbol);
  const documentUrl = useMemo(() => buildDocumentUrl(receiptNo), [receiptNo]);
  const dartViewerUrl = useMemo(() => buildDartViewerUrl(receiptNo), [receiptNo]);

  return (
    <MobileAppChrome
      activeNav="symbols"
      mySymbolsHref={backHref}
      header={
        <>
          <div className={styles.headerBrand}>
            <Link href={backHref} className={styles.backButton} aria-label="Back to disclosure coverage">
              &larr;
            </Link>
            <div>
              <strong className={styles.headerTitle} title={corpName}>
                {corpName}
              </strong>
            </div>
          </div>

          <div className={styles.headerActions}>
            <span className="pill info">S7 Report</span>
            <DevModeToggle />
          </div>
        </>
      }
    >
      <div className={styles.reportDetailPage}>
        <section className={`${styles.panel} ${styles.reportHero}`}>
          <ComponentTag label="symbol.disclosure-report" api="/api/trading/disclosures/dart/filings/document" />
          <div className={styles.reportHeroTop}>
            <div>
              <p className={styles.sectionEyebrow}>DART Report Detail</p>
              <h1 className={styles.reportTitle}>{reportName}</h1>
              <p className={`clamp-3 ${styles.supportingCopy}`}>
                {symbol} - Receipt {receiptNo} - Filed {receiptDate}
              </p>
            </div>
            <Link href={backHref} className={styles.detailLink}>
              Back to disclosures
            </Link>
          </div>

          <div className={styles.reportMetaGrid}>
            <article className={styles.metricCard}>
              <span>Company</span>
              <strong>{corpName}</strong>
            </article>
            <article className={styles.metricCard}>
              <span>Filing category</span>
              <strong>{filingCategory}</strong>
            </article>
            <article className={styles.metricCard}>
              <span>Capture status</span>
              <strong>{captureStatus}</strong>
            </article>
          </div>

          <div className={styles.reportActions}>
            <a className={styles.detailLink} href={documentUrl}>
              Download document
            </a>
            <a className={styles.detailLink} href={dartViewerUrl} target="_blank" rel="noreferrer">
              Open in DART
            </a>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.reportViewerPanel}`}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Report Content</p>
              <h2 className={styles.cardTitle}>Filing document</h2>
            </div>
            <span className="pill neutral">Rcept {receiptNo}</span>
          </div>
          <div className={styles.reportFrameShell}>
            <iframe
              className={styles.reportFrame}
              sandbox=""
              src={documentUrl}
              title={`${reportName} filing document`}
            />
          </div>
        </section>
      </div>
    </MobileAppChrome>
  );
}
