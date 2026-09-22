"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { useAppState } from "@/components/providers/app-state-provider";
import {
  localizeDisclosureCaptureStatus,
  localizeDisclosureFilingCategory,
} from "@/features/symbol-detail/disclosure-report-display";
import { getSymbolDetailCopy } from "@/i18n/symbol-detail-copy";
import { buildDisclosureDocumentUrl } from "@/lib/disclosure-document-url";
import {
  resolveSymbolDetailActiveNav,
  resolveSymbolDetailNavContext,
  SYMBOL_DETAIL_NAV_CONTEXT_PARAM,
} from "../../symbol-detail-state";

import styles from "../../symbol-detail.module.css";

type SearchParamReader = {
  get: (name: string) => string | null;
};

const SYMBOL_QUERY_KEYS = [
  "name",
  "market",
  "standardCode",
  "marketDate",
  "fsDiv",
  "q",
  SYMBOL_DETAIL_NAV_CONTEXT_PARAM,
] as const;

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

function buildDartViewerUrl(receiptNo: string) {
  return `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${encodeURIComponent(receiptNo)}`;
}

function getSearchParam(searchParams: SearchParamReader, key: string, fallback: string) {
  const value = searchParams.get(key);
  return value && value.trim().length > 0 ? value : fallback;
}

type DisclosureReportClientProps = {
  receiptNo?: string;
  symbol?: string;
};

function readRouteParam(value: string | string[] | undefined) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return "";
}

export function DisclosureReportClient({ receiptNo: serverReceiptNo, symbol: serverSymbol }: DisclosureReportClientProps) {
  const { locale } = useAppState();
  const copy = getSymbolDetailCopy(locale).disclosures.reportDetail;
  const params = useParams<{ symbol?: string | string[]; receiptNo?: string | string[] }>();
  const searchParams = useSearchParams();
  const symbol = useMemo(() => {
    if (typeof serverSymbol === "string" && serverSymbol.trim().length > 0) {
      return serverSymbol;
    }

    return readRouteParam(params.symbol);
  }, [params.symbol, serverSymbol]);
  const receiptNo = useMemo(() => {
    if (typeof serverReceiptNo === "string" && serverReceiptNo.trim().length > 0) {
      return serverReceiptNo;
    }

    return readRouteParam(params.receiptNo);
  }, [params.receiptNo, serverReceiptNo]);
  const preservedQueryString = useMemo(() => buildPreservedSymbolQuery(searchParams), [searchParams]);
  const symbolDetailActiveNav = useMemo(
    () => resolveSymbolDetailActiveNav(resolveSymbolDetailNavContext(searchParams.get(SYMBOL_DETAIL_NAV_CONTEXT_PARAM))),
    [searchParams],
  );
  const backHref = useMemo(
    () => buildDisclosureCoverageHref(symbol, preservedQueryString),
    [preservedQueryString, symbol],
  );
  const reportName = getSearchParam(searchParams, "reportName", copy.fallbackReportName);
  const receiptDate = getSearchParam(searchParams, "receiptDate", copy.noReceiptDate);
  const filingCategory = localizeDisclosureFilingCategory(
    getSearchParam(searchParams, "filingCategory", copy.noCategory),
    copy,
  );
  const captureStatus = localizeDisclosureCaptureStatus(
    getSearchParam(searchParams, "captureStatus", copy.notCaptured),
    copy,
  );
  const corpName = getSearchParam(searchParams, "corpName", searchParams.get("name") ?? symbol);
  const documentUrl = useMemo(() => buildDisclosureDocumentUrl(receiptNo), [receiptNo]);
  const dartViewerUrl = useMemo(() => buildDartViewerUrl(receiptNo), [receiptNo]);

  return (
    <MobileAppChrome
      chrome={{
        activeNav: symbolDetailActiveNav,
        leading: (
          <Link href={backHref} className={styles.backButton} aria-label={copy.backToCoverage}>
            &larr;
          </Link>
        ),
        title: corpName,
        status: { label: copy.statusLabel, tone: "info" },
        toolbarAction: "dev-mode",
      }}
    >
      <div className={styles.reportDetailPage}>
        <section className={`${styles.panel} ${styles.reportHero}`}>
          <ComponentTag label="symbol.disclosure-report" api="/api/trading/disclosures/dart/filings/document" />
          <div className={styles.reportHeroTop}>
            <div>
              <p className={styles.sectionEyebrow}>{copy.eyebrow}</p>
              <h1 className={styles.reportTitle}>{reportName}</h1>
              <p className={`clamp-3 ${styles.supportingCopy}`}>
                {symbol} - {copy.receipt} {receiptNo} - {copy.filed} {receiptDate}
              </p>
            </div>
            <Link href={backHref} className={styles.detailLink}>
              {copy.backToDisclosures}
            </Link>
          </div>

          <div className={styles.reportMetaGrid}>
            <article className={styles.metricCard}>
              <span>{copy.company}</span>
              <strong>{corpName}</strong>
            </article>
            <article className={styles.metricCard}>
              <span>{copy.filingCategory}</span>
              <strong>{filingCategory}</strong>
            </article>
            <article className={styles.metricCard}>
              <span>{copy.captureStatus}</span>
              <strong>{captureStatus}</strong>
            </article>
          </div>

          <div className={styles.reportActions}>
            <a className={styles.detailLink} href={documentUrl}>
              {copy.downloadDocument}
            </a>
            <a className={styles.detailLink} href={dartViewerUrl} target="_blank" rel="noreferrer">
              {copy.openInDart}
            </a>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.reportViewerPanel}`}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.sectionEyebrow}>{copy.contentEyebrow}</p>
              <h2 className={styles.cardTitle}>{copy.documentTitle}</h2>
            </div>
            <span className="pill neutral">{copy.receiptNumber} {receiptNo}</span>
          </div>
          <div className={styles.reportFrameShell}>
            <iframe
              className={styles.reportFrame}
              sandbox=""
              src={documentUrl}
              title={`${reportName} ${copy.iframeTitleSuffix}`}
            />
          </div>
        </section>
      </div>
    </MobileAppChrome>
  );
}
