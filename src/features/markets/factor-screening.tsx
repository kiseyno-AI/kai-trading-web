"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { useAppState } from "@/components/providers/app-state-provider";
import { PageIntro } from "@/components/ui/page-intro";
import { UnitRefreshFrame } from "@/components/ui/unit-refresh-frame";
import {
  FACTOR_SCREENING_FILTER_MODES,
  FACTOR_SCREENING_FAMILY_ORDER,
  filterFactorScreeningRows,
  getFactorScreeningMarketDateNote,
  loadFactorScreeningWorkspace,
  resolveFactorScreeningFamily,
  resolveFactorScreeningMarketDate,
  resolveFactorScreeningRouteStatus,
  type FactorScreeningDataset,
  type FactorScreeningFilterMode,
  type FactorScreeningFamilyId,
  type FactorScreeningRouteStatus,
  type FactorScreeningWorkspace,
} from "@/lib/factor-screening";
import { getNumberLocale } from "@/lib/locale";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import { useUnitData } from "@/lib/use-unit-data";
import type { EodFreshnessResponseDto, Locale } from "@/types/trading-api";

import styles from "./factor-screening.module.css";

const VISIBLE_ROW_OPTIONS = [25, 50, 100] as const;

const copyByLocale = {
  en: {
    activeDate: "Active date",
    activeFilters: "Active filters",
    allFamilies: "Factor families",
    applyDate: "Apply date",
    auditRows: "Audit rows",
    backToMarkets: "Back to markets",
    compositeReady: "Composite-ready layout",
    controlsEyebrow: "Screen controls",
    controlsTitle: "Family, date, and eligibility filters",
    controlsBody:
      "Switch factor families, pin a market date, and keep only the rows that fit the current screening intent.",
    countSummary: (visible: number, total: number) => `${visible.toLocaleString("en-US")} visible / ${total.toLocaleString("en-US")} matching`,
    emptyFilters: "No rows match the current filters for this factor family.",
    emptyRows: "Core returned no rows for this factor family and market date.",
    familySummary: "Family summary",
    featureVersion: "Feature version",
    filterEyebrow: "Eligibility filters",
    futureSlotBody:
      "Composite is intentionally wired as a reserved slot now. When the composite endpoint lands, it can fill this screen without redesigning the family selector or ranked-row layout.",
    futureSlotTitle: "Composite ranking slot reserved",
    filterModes: {
      all: "All",
      audit: "Audit",
      caution: "Caution",
      eligible: "Eligible",
      review: "Review set",
    },
    introDescription:
      "A market-date aware ranking surface built on the live factor inspect APIs. Switch factor families, keep eligibility explicit, and drill straight into symbol detail without inventing client-side factor math.",
    introEyebrow: "Factor Screening",
    introTitle: "Factor ranking workspace",
    latestDate: "Use latest",
    loadError: "Factor screening is unavailable right now.",
    loadingRows: "Loading factor ranking rows...",
    marketDate: "Market date",
    marketDatePending: "Factor market date pending.",
    matchingRows: "Matching rows",
    nameUnavailable: "Name unavailable",
    note: "Note",
    openSymbol: (companyName: string | null, symbol: string) =>
      companyName ? `Open ${companyName} (${symbol})` : `Open ${symbol} (name unavailable)`,
    queryLabel: "Quick filter",
    queryPlaceholder: "005930 or Samsung",
    refresh: "Refresh",
    requestedDate: "Requested date",
    resolvedDate: "Resolved date",
    resultsEyebrow: "Ranked rows",
    resultsTitle: "Rows",
    rowsReturned: "Rows returned",
    searchStatus: "Search status",
    selectedFamily: "Selected family",
    showingFirst: (visible: number, total: number) =>
      `Showing the first ${visible.toLocaleString("en-US")} rows out of ${total.toLocaleString("en-US")} matching rows.`,
    sortBasis: "Sort basis",
    state: {
      error: "Unavailable",
      future: "Future slot",
      ready: "Ready",
    },
    statusAudit: "Audit",
    statusCaution: "Caution",
    statusEligible: "Eligible",
    summaryEyebrow: "Core factor APIs",
    summaryTitle: "Market-date aware ranking and drill-in",
    summaryBody:
      "The ranked list always stays tied to the selected market date, and every row keeps enough factor context to make the drill-in path explainable.",
    visibleRows: "Visible rows",
  },
  ko: {
    activeDate: "활성 날짜",
    activeFilters: "활성 필터",
    allFamilies: "팩터 패밀리",
    applyDate: "날짜 적용",
    auditRows: "감사용 행",
    backToMarkets: "마켓으로 돌아가기",
    compositeReady: "합성 준비 완료 레이아웃",
    controlsEyebrow: "스크린 제어",
    controlsTitle: "패밀리, 날짜, 적격성 필터",
    controlsBody:
      "팩터 패밀리를 전환하고, 시장 날짜를 고정하고, 현재 스크리닝 목적에 맞는 행만 남길 수 있습니다.",
    countSummary: (visible: number, total: number) => `${visible.toLocaleString("ko-KR")}개 표시 / ${total.toLocaleString("ko-KR")}개 일치`,
    emptyFilters: "현재 필터에 맞는 행이 없습니다.",
    emptyRows: "이 팩터 패밀리와 시장 날짜에 대해 Core가 반환한 행이 없습니다.",
    familySummary: "패밀리 요약",
    featureVersion: "피처 버전",
    filterEyebrow: "적격성 필터",
    futureSlotBody:
      "합성은 지금부터 예약 슬롯으로 배치했습니다. 합성 엔드포인트가 추가되면 패밀리 선택기나 순위 행 레이아웃을 다시 설계하지 않고 이 화면에 바로 연결할 수 있습니다.",
    futureSlotTitle: "합성 순위 슬롯 예약됨",
    filterModes: {
      all: "전체",
      audit: "감사",
      caution: "주의",
      eligible: "적격",
      review: "검토 세트",
    },
    introDescription:
      "실제 팩터 inspect API 위에 구축한 시장 날짜 인지형 순위 화면입니다. 팩터 패밀리를 전환하고, 적격성을 명확히 유지하고, 클라이언트에서 팩터 수학을 재구성하지 않고 종목 상세로 바로 내려갈 수 있습니다.",
    introEyebrow: "팩터 스크리닝",
    introTitle: "팩터 순위 워크스페이스",
    latestDate: "최신 날짜 사용",
    loadError: "현재 팩터 스크리닝을 불러올 수 없습니다.",
    loadingRows: "팩터 순위 행을 불러오는 중...",
    marketDate: "시장 날짜",
    marketDatePending: "팩터 시장 날짜 대기 중입니다.",
    matchingRows: "일치 행",
    nameUnavailable: "종목명 미제공",
    note: "메모",
    openSymbol: (companyName: string | null, symbol: string) =>
      companyName ? `${companyName} (${symbol}) 상세 열기` : `${symbol} (종목명 미제공) 상세 열기`,
    queryLabel: "빠른 필터",
    queryPlaceholder: "005930 또는 Samsung",
    refresh: "새로고침",
    requestedDate: "요청 날짜",
    resolvedDate: "해결 날짜",
    resultsEyebrow: "순위 행",
    resultsTitle: "행",
    rowsReturned: "반환 행",
    searchStatus: "검색 상태",
    selectedFamily: "선택 패밀리",
    showingFirst: (visible: number, total: number) =>
      `일치한 ${total.toLocaleString("ko-KR")}개 중 처음 ${visible.toLocaleString("ko-KR")}개를 표시합니다.`,
    sortBasis: "정렬 기준",
    state: {
      error: "사용 불가",
      future: "향후 슬롯",
      ready: "준비 완료",
    },
    statusAudit: "감사",
    statusCaution: "주의",
    statusEligible: "적격",
    summaryEyebrow: "Core factor APIs",
    summaryTitle: "시장 날짜 인지형 순위와 드릴인",
    summaryBody:
      "순위 목록은 항상 선택한 시장 날짜와 정렬 상태를 함께 유지하고, 각 행은 종목 상세로 내려가기 전에 충분한 팩터 맥락을 보여 줍니다.",
    visibleRows: "표시 행 수",
  },
} satisfies Record<
  Locale,
  {
    activeDate: string;
    activeFilters: string;
    allFamilies: string;
    applyDate: string;
    auditRows: string;
    backToMarkets: string;
    compositeReady: string;
    controlsEyebrow: string;
    controlsTitle: string;
    controlsBody: string;
    countSummary: (visible: number, total: number) => string;
    emptyFilters: string;
    emptyRows: string;
    familySummary: string;
    featureVersion: string;
    filterEyebrow: string;
    futureSlotBody: string;
    futureSlotTitle: string;
    filterModes: Record<FactorScreeningFilterMode, string>;
    introDescription: string;
    introEyebrow: string;
    introTitle: string;
    latestDate: string;
    loadError: string;
    loadingRows: string;
    marketDate: string;
    marketDatePending: string;
    matchingRows: string;
    nameUnavailable: string;
    note: string;
    openSymbol: (companyName: string | null, symbol: string) => string;
    queryLabel: string;
    queryPlaceholder: string;
    refresh: string;
    requestedDate: string;
    resolvedDate: string;
    resultsEyebrow: string;
    resultsTitle: string;
    rowsReturned: string;
    searchStatus: string;
    selectedFamily: string;
    showingFirst: (visible: number, total: number) => string;
    sortBasis: string;
    state: Record<FactorScreeningDataset["state"], string>;
    statusAudit: string;
    statusCaution: string;
    statusEligible: string;
    summaryEyebrow: string;
    summaryTitle: string;
    summaryBody: string;
    visibleRows: string;
  }
>;

async function fetchUnitJson<T>(path: string): Promise<T> {
  const response = await fetch(resolveTradingApiClientPath(path), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

function formatIsoDateLabel(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${year}.${month}.${day}`;
}

function getFamilyTone(dataset: FactorScreeningDataset) {
  if (dataset.state === "error") return "warning";
  if (dataset.state === "future") return "neutral";
  return "info";
}

function getFamilyFallbackLabel(family: FactorScreeningFamilyId) {
  switch (family) {
    case "lowRisk":
      return "Low risk";
    case "advancedValue":
      return "Advanced value components";
    case "composite":
      return "Composite";
    default:
      return family.charAt(0).toUpperCase() + family.slice(1);
  }
}

function getFilterModeCount(dataset: FactorScreeningDataset | null, mode: FactorScreeningFilterMode) {
  if (!dataset) return 0;

  switch (mode) {
    case "all":
      return dataset.totalRows;
    case "eligible":
      return dataset.eligibleCount;
    case "caution":
      return dataset.cautionCount;
    case "audit":
      return dataset.auditCount;
    case "review":
      return dataset.eligibleCount + dataset.cautionCount;
  }
}

type FactorScreeningProps = {
  onRouteStatusChange?: (status: FactorScreeningRouteStatus) => void;
};

export function FactorScreening({ onRouteStatusChange }: FactorScreeningProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale } = useAppState();
  const copy = copyByLocale[locale];
  const numberLocale = useMemo(() => getNumberLocale(locale), [locale]);
  const requestedMarketDate = useMemo(() => searchParams.get("marketDate"), [searchParams]);
  const selectedFamily = useMemo(
    () => resolveFactorScreeningFamily(searchParams.get("family")) ?? "momentum",
    [searchParams],
  );
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [filterMode, setFilterMode] = useState<FactorScreeningFilterMode>("review");
  const [visibleRows, setVisibleRows] = useState<number>(50);

  const updateSearch = (updater: (nextParams: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    updater(nextParams);
    const nextQuery = nextParams.toString();

    startTransition(() => {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    });
  };

  const freshnessRequest = useMemo(
    () => ({
      enabled: !requestedMarketDate,
      key: ["factor-screening", "freshness-market-date"] as const,
      ttlMs: 5 * 60_000,
      fetcher: async () => fetchUnitJson<EodFreshnessResponseDto>("/api/trading/eod/freshness"),
    }),
    [requestedMarketDate],
  );
  const freshnessResult = useUnitData<EodFreshnessResponseDto>(freshnessRequest);
  const fallbackMarketDate = useMemo(
    () => resolveFactorScreeningMarketDate(freshnessResult.data),
    [freshnessResult.data],
  );
  const activeMarketDate = requestedMarketDate ?? fallbackMarketDate;
  const dateFieldKey = `${requestedMarketDate ?? "latest"}:${activeMarketDate ?? "pending"}`;

  const workspaceRequest = useMemo(
    () => ({
      enabled: Boolean(activeMarketDate),
      key: ["factor-screening", "workspace", activeMarketDate ?? "pending", numberLocale] as const,
      ttlMs: 60_000,
      fetcher: async () => {
        if (!activeMarketDate) {
          throw new Error(copy.marketDatePending);
        }

        return loadFactorScreeningWorkspace({
          marketDate: activeMarketDate,
          numberLocale,
        });
      },
    }),
    [activeMarketDate, copy.marketDatePending, numberLocale],
  );
  const workspaceResult = useUnitData<FactorScreeningWorkspace>(workspaceRequest);
  const workspace = workspaceResult.data;

  const selectedDataset = workspace?.families[selectedFamily] ?? null;
  const familyDatasets = useMemo(
    () => FACTOR_SCREENING_FAMILY_ORDER.map((family) => workspace?.families[family] ?? null),
    [workspace],
  );
  const filteredRows = useMemo(
    () =>
      selectedDataset?.rows
        ? filterFactorScreeningRows(selectedDataset.rows, {
            mode: filterMode,
            query: deferredQuery,
          })
        : [],
    [deferredQuery, filterMode, selectedDataset],
  );
  const visibleRowItems = filteredRows.slice(0, visibleRows);
  const hiddenRowsCount = Math.max(0, filteredRows.length - visibleRowItems.length);
  const marketDateNote = getFactorScreeningMarketDateNote(
    selectedDataset?.requestedMarketDate ?? activeMarketDate,
    selectedDataset?.marketDate ?? activeMarketDate,
  );
  const summaryError =
    !requestedMarketDate && freshnessResult.error && !activeMarketDate
      ? freshnessResult.error.message
      : workspaceResult.error && !workspace
        ? workspaceResult.error.message
        : null;
  const summaryBusy =
    workspaceResult.isRefreshing ||
    (!workspace && (workspaceResult.isInitialLoading || (!requestedMarketDate && freshnessResult.isInitialLoading)));
  const routeStatus = resolveFactorScreeningRouteStatus({
    activeMarketDate,
    hasError: Boolean(summaryError),
    isBusy: summaryBusy,
    selectedFamily,
    workspace,
  });

  useEffect(() => {
    onRouteStatusChange?.(routeStatus);
  }, [onRouteStatusChange, routeStatus]);

  const handleFamilySelect = (family: FactorScreeningFamilyId) => {
    updateSearch((nextParams) => {
      if (family === "momentum") {
        nextParams.delete("family");
      } else {
        nextParams.set("family", family);
      }
    });
  };

  const handleDateSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const trimmedDate = String(formData.get("marketDate") ?? "").trim();

    updateSearch((nextParams) => {
      if (trimmedDate) {
        nextParams.set("marketDate", trimmedDate);
      } else {
        nextParams.delete("marketDate");
      }
    });
  };

  const handleUseLatestDate = () => {
    updateSearch((nextParams) => {
      nextParams.delete("marketDate");
    });
  };

  const handleRefresh = () => {
    if (!requestedMarketDate) {
      void freshnessResult.refetch();
    }

    if (activeMarketDate) {
      void workspaceResult.refetch();
    }
  };

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow={copy.introEyebrow}
        title={copy.introTitle}
        description={copy.introDescription}
        aside={
          <div className={styles.introAside}>
            <span className="pill info">
              {copy.activeDate}: {formatIsoDateLabel(activeMarketDate, copy.marketDatePending)}
            </span>
            <span className="pill neutral">{copy.compositeReady}</span>
          </div>
        }
      />

      <section className="hero-strip">
        <UnitRefreshFrame busy={summaryBusy} className={styles.frame} label={copy.loadingRows}>
          <div className="glass hero-card">
            <ComponentTag
              label="markets.factor-screening"
              api="/api/trading/eod/freshness + /api/trading/eod/momentum-factors + /api/trading/eod/low-risk-factors + /api/trading/eod/beta-factors + /api/trading/eod/value-factors + /api/trading/eod/advanced-value-factors"
            />
            <p className="eyebrow">{copy.summaryEyebrow}</p>
            <h2>{copy.summaryTitle}</h2>
            <p className={styles.panelCopy}>
              {selectedDataset?.note ?? copy.summaryBody}
              {marketDateNote ? ` ${marketDateNote}` : ""}
            </p>

            <div className="detail-list">
              <div className="detail-row">
                <span>{copy.requestedDate}</span>
                <strong>{formatIsoDateLabel(activeMarketDate, copy.marketDatePending)}</strong>
              </div>
              <div className="detail-row">
                <span>{copy.resolvedDate}</span>
                <strong>{formatIsoDateLabel(selectedDataset?.marketDate ?? activeMarketDate, copy.marketDatePending)}</strong>
              </div>
              <div className="detail-row">
                <span>{copy.selectedFamily}</span>
                <strong>{selectedDataset?.title ?? getFamilyFallbackLabel(selectedFamily)}</strong>
              </div>
              <div className="detail-row">
                <span>{copy.sortBasis}</span>
                <strong>{selectedDataset?.sortBasis ?? "Pending"}</strong>
              </div>
            </div>

            <div className={styles.heroActions}>
              <button type="button" className={styles.secondaryAction} onClick={handleRefresh}>
                {copy.refresh}
              </button>
              <Link href="/markets" className={styles.secondaryLink}>
                {copy.backToMarkets}
              </Link>
            </div>
          </div>
        </UnitRefreshFrame>

        <div className="glass hero-card surface-muted">
          <p className="eyebrow">{copy.controlsEyebrow}</p>
          <h2>{copy.controlsTitle}</h2>
          <p className={styles.panelCopy}>{copy.controlsBody}</p>

          <form className={styles.controlStack} onSubmit={handleDateSubmit}>
            <label className={styles.field}>
              <span>{copy.marketDate}</span>
              <input
                key={dateFieldKey}
                name="marketDate"
                type="date"
                defaultValue={requestedMarketDate ?? activeMarketDate ?? ""}
              />
            </label>

            <div className={styles.actionRow}>
              <button type="submit" className={styles.primaryAction}>
                {copy.applyDate}
              </button>
              <button type="button" className={styles.secondaryAction} onClick={handleUseLatestDate}>
                {copy.latestDate}
              </button>
            </div>

            <label className={styles.field}>
              <span>{copy.queryLabel}</span>
              <input
                type="search"
                value={query}
                placeholder={copy.queryPlaceholder}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>{copy.visibleRows}</span>
              <select value={visibleRows} onChange={(event) => setVisibleRows(Number(event.target.value))}>
                {VISIBLE_ROW_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value.toLocaleString(numberLocale)}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.filterModeGrid} role="radiogroup" aria-label={copy.filterEyebrow}>
              {FACTOR_SCREENING_FILTER_MODES.map((mode) => {
                const isActive = mode === filterMode;

                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={`${styles.filterModeButton} ${isActive ? styles.filterModeButtonActive : ""}`.trim()}
                    onClick={() => setFilterMode(mode)}
                  >
                    <span>{copy.filterModes[mode]}</span>
                    <strong>{getFilterModeCount(selectedDataset, mode).toLocaleString(numberLocale)}</strong>
                  </button>
                );
              })}
            </div>
          </form>
        </div>
      </section>

      <section className="content-grid single-column-grid">
        <div className={`glass section-card ${styles.familySection}`}>
          <div className={styles.sectionHead}>
            <div>
              <p className="eyebrow">{copy.allFamilies}</p>
              <h2>{copy.familySummary}</h2>
            </div>
            <span className="pill neutral">{copy.countSummary(visibleRowItems.length, filteredRows.length)}</span>
          </div>

          <div className={styles.familyGrid}>
            {familyDatasets.map((dataset, index) => {
              const family = FACTOR_SCREENING_FAMILY_ORDER[index];
              const title = dataset?.title ?? getFamilyFallbackLabel(family);
              const state = dataset?.state ?? "future";
              const stateLabel = copy.state[state];
              const dataTone = dataset ? getFamilyTone(dataset) : "neutral";
              const isSelected = family === selectedFamily;

              return (
                <button
                  key={family}
                  type="button"
                  className={`${styles.familyCard} ${isSelected ? styles.familyCardSelected : ""}`.trim()}
                  aria-pressed={isSelected}
                  onClick={() => handleFamilySelect(family)}
                >
                  <div className={styles.familyCardHead}>
                    <div>
                      <strong>{title}</strong>
                      <p>{dataset?.subtitle ?? ""}</p>
                    </div>
                    <span className={`pill ${dataTone}`}>{stateLabel}</span>
                  </div>

                  <div className={styles.familyMetaGrid}>
                    <div>
                      <span>{copy.rowsReturned}</span>
                      <strong>{dataset?.totalEntries?.toLocaleString(numberLocale) ?? "..."}</strong>
                    </div>
                    <div>
                      <span>{copy.statusEligible}</span>
                      <strong>{dataset?.eligibleCount.toLocaleString(numberLocale) ?? "..."}</strong>
                    </div>
                    <div>
                      <span>{copy.marketDate}</span>
                      <strong>{formatIsoDateLabel(dataset?.marketDate ?? activeMarketDate, copy.marketDatePending)}</strong>
                    </div>
                    <div>
                      <span>{copy.featureVersion}</span>
                      <strong>{dataset?.featureVersion ?? stateLabel}</strong>
                    </div>
                  </div>

                  {dataset?.error ? <p className={styles.errorText}>{dataset.error}</p> : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="content-grid single-column-grid">
        <UnitRefreshFrame busy={summaryBusy} className={styles.frame} label={copy.loadingRows}>
          <div className={`glass section-card ${styles.resultsSection}`}>
            <div className={styles.sectionHead}>
              <div>
                <p className="eyebrow">{copy.resultsEyebrow}</p>
                <h2>{selectedDataset?.title ?? copy.resultsTitle}</h2>
                <p className={styles.panelCopy}>
                  {selectedDataset?.state === "future"
                    ? copy.futureSlotBody
                    : selectedDataset?.note ?? copy.summaryBody}
                </p>
              </div>
              <div className={styles.statusCluster}>
                <span className="pill positive">
                  {copy.statusEligible}: {selectedDataset?.eligibleCount.toLocaleString(numberLocale) ?? 0}
                </span>
                <span className="pill warning">
                  {copy.statusCaution}: {selectedDataset?.cautionCount.toLocaleString(numberLocale) ?? 0}
                </span>
                <span className="pill neutral">
                  {copy.statusAudit}: {selectedDataset?.auditCount.toLocaleString(numberLocale) ?? 0}
                </span>
              </div>
            </div>

            {summaryError ? (
              <div className={styles.emptyState}>
                <strong>{copy.loadError}</strong>
                <p>{summaryError}</p>
              </div>
            ) : !activeMarketDate || (!workspace && summaryBusy) ? (
              <div className={styles.emptyState}>
                <strong>{copy.loadingRows}</strong>
                <p>{copy.marketDatePending}</p>
              </div>
            ) : selectedDataset?.state === "future" ? (
              <div className={styles.emptyState}>
                <strong>{copy.futureSlotTitle}</strong>
                <p>{copy.futureSlotBody}</p>
              </div>
            ) : selectedDataset?.state === "error" ? (
              <div className={styles.emptyState}>
                <strong>{copy.loadError}</strong>
                <p>{selectedDataset.error ?? copy.loadError}</p>
              </div>
            ) : selectedDataset && filteredRows.length === 0 ? (
              <div className={styles.emptyState}>
                <strong>{selectedDataset.totalRows === 0 ? copy.emptyRows : copy.emptyFilters}</strong>
                <p>{selectedDataset.note}</p>
              </div>
            ) : selectedDataset ? (
              <>
                <div className={styles.resultsSummary}>
                  <div className={styles.summaryBadge}>
                    <span>{copy.matchingRows}</span>
                    <strong>{filteredRows.length.toLocaleString(numberLocale)}</strong>
                  </div>
                  <div className={styles.summaryBadge}>
                    <span>{copy.activeFilters}</span>
                    <strong data-testid="factor-active-filter-value">
                      {copy.filterModes[filterMode]}
                    </strong>
                  </div>
                  <div className={styles.summaryBadge}>
                    <span>{copy.searchStatus}</span>
                    <strong>{query.trim() ? query.trim() : "All rows"}</strong>
                  </div>
                  <div className={styles.summaryBadge}>
                    <span>{copy.rowsReturned}</span>
                    <strong>{selectedDataset.totalRows.toLocaleString(numberLocale)}</strong>
                  </div>
                </div>

                {hiddenRowsCount > 0 ? (
                  <p className={styles.helperText}>{copy.showingFirst(visibleRowItems.length, filteredRows.length)}</p>
                ) : null}

                <div className={styles.rowList}>
                  {visibleRowItems.map((row) => (
                    <Link
                      key={`${row.family}:${row.symbol}:${row.displayRank}`}
                      href={row.href}
                      className={styles.rowCard}
                      aria-label={copy.openSymbol(row.companyName, row.symbol)}
                    >
                      <div className={styles.rowTop}>
                        <div className={styles.rowIdentity}>
                          <div className={styles.rankBadge}>{row.displayRankLabel}</div>
                          <div>
                            <strong>{row.companyName ?? row.symbol}</strong>
                            <p>
                              {row.companyName ? row.symbol : copy.nameUnavailable}
                              {row.market ? ` · ${row.market}` : ""}
                            </p>
                          </div>
                        </div>
                        <span className={`pill ${row.status.tone}`}>{row.statusLabel}</span>
                      </div>

                      <div className={styles.metricGrid}>
                        {row.metrics.map((metric) => (
                          <div key={`${row.symbol}:${metric.label}`} className={styles.metricCard}>
                            <span>{metric.label}</span>
                            <strong
                              className={
                                metric.tone === "positive"
                                  ? styles.positiveMetric
                                  : metric.tone === "negative"
                                    ? styles.negativeMetric
                                    : undefined
                              }
                            >
                              {metric.value}
                            </strong>
                          </div>
                        ))}
                      </div>

                      {row.quality ? (
                        <div className={styles.qualityBlock} aria-label={`${row.symbol} quality score status`}>
                          <div className={styles.qualityHeader}>
                            <div>
                              <strong>{row.quality.title}</strong>
                              <p>{row.quality.summary}</p>
                            </div>
                            <span className={`pill ${row.quality.tone}`}>{row.quality.calculationLabel}</span>
                          </div>

                          <div className={styles.qualityMetricGrid}>
                            {row.quality.metrics.map((metric) => (
                              <div key={`${row.symbol}:quality:${metric.label}`} className={styles.metricCard}>
                                <span>{metric.label}</span>
                                <strong>{metric.value}</strong>
                              </div>
                            ))}
                          </div>

                          {row.quality.componentHints.length > 0 ? (
                            <div className={styles.qualityHintGroup}>
                              {row.quality.componentHints.map((hint) => (
                                <span key={`${row.symbol}:quality:${hint}`} className={styles.qualityHint}>
                                  {hint}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <p className={styles.rowNote}>
                        <span>{copy.note}:</span> {row.note}
                      </p>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.emptyState}>
                <strong>{copy.loadError}</strong>
                <p>{copy.marketDatePending}</p>
              </div>
            )}
          </div>
        </UnitRefreshFrame>
      </section>
    </div>
  );
}
