"use client";

import Link from "next/link";
import { useCallback, type MouseEvent as ReactMouseEvent } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { MobileAppChrome, type MobileAppChromeRouteChrome } from "@/components/mobile/mobile-app-chrome";
import { DocumentRouteLink } from "@/components/navigation/document-route-link";
import type { DashboardToolbarStatusTone } from "@/components/navigation/dashboard-toolbar";
import { useAppState } from "@/components/providers/app-state-provider";
import { SurfaceState } from "@/components/ui/surface-state";
import { UnitRefreshFrame } from "@/components/ui/unit-refresh-frame";
import {
  ActionSummarySection,
  DisclosureCoverageSection,
  FundamentalsHistorySection,
  HeroActionRecommendationMetric,
  HeroFundamentalLatestMetric,
  HeroPiotroskiMetric,
  SystemFreshnessSection,
  TechnicalAnalysisSection,
} from "@/features/symbol-detail/symbol-detail-sections";
import {
  buildFocusTurnoverValue,
  formatCompactNumber,
  formatIsoDateLabel,
  formatQuoteUnavailableReasonLabel,
  formatSignedNumber,
  formatSignedPercent,
  hasNumber,
} from "@/features/symbol-detail/symbol-detail-derived-state";
import { PRICE_HISTORY_RANGES } from "@/features/symbol-detail/symbol-detail-types";
import { useSymbolDetailData } from "@/features/symbol-detail/use-symbol-detail-data";
import { getSymbolDetailCopy } from "@/i18n/symbol-detail-copy";
import { formatPrice } from "@/lib/format";
import { getNumberLocale } from "@/lib/locale";
import { buildPiotroskiListHref } from "@/lib/piotroski-pass-list";
import {
  appendDashboardRecommendationContextToHref,
  getDashboardDecisionConflict,
} from "@/lib/dashboard-recommendation-context";
import {
  buildDeciderFeedbackHref,
  buildSignalDeciderFeedbackHref,
} from "@/lib/signal-decider-feedback";

import { FactorSnapshotSection } from "./factor-snapshot-section";
import { SymbolHistoryChart } from "./symbol-history-chart";
import styles from "./symbol-detail.module.css";
import {
  SYMBOL_DETAIL_CALENDAR_NAV_CONTEXT,
  SYMBOL_DETAIL_FEEDBACK_NAV_CONTEXT,
  SYMBOL_DETAIL_MODES,
  SYMBOL_DETAIL_PIOTROSKI_NAV_CONTEXT,
  SYMBOL_DETAIL_SEARCH_NAV_CONTEXT,
  SYMBOL_DETAIL_SEARCH_QUERY_PARAM,
  SYMBOL_DETAIL_SIGNAL_DECIDER_FEEDBACK_RETURN_ROUTE,
  resolveSymbolDetailCalendarReviewDate,
  type SymbolDetailMode,
} from "./symbol-detail-state";

type SymbolDetailClientProps = {
  mode?: SymbolDetailMode;
  symbol?: string;
};

export function SymbolDetailClient({ mode = "overview", symbol: serverSymbol }: SymbolDetailClientProps) {
  const { locale } = useAppState();
  const copy = getSymbolDetailCopy(locale);
  const numberLocale = getNumberLocale(locale);
  const tradeDisabledDescriptionId = "symbol-trade-disabled-description";
  const {
    activeDetailMode,
    activeMode,
    chartMetrics,
    chartUnitRefreshing,
    dashboardRecommendation,
    detailErrors,
    disclosureItemLimit,
    focusBar,
    focusCandleDetail,
    focusCandleRows,
    focusCandleValue,
    focusMovePct,
    fundamentalsEntryLimit,
    fsDiv,
    handleToggleTrackedSymbol,
    hasSelectedRangeHistoryLoaded,
    historyHydrating,
    historyLoading,
    introTitle,
    isTrackedSymbol,
    loading,
    localizedModes,
    marketDate,
    marketDateBasisCopy,
    marketDateLabel,
    marketLabel,
    marketStateRows,
    normalizedSymbol,
    priceHistory,
    previousFocusBar,
    quote,
    quotePollingState,
    quoteSourceCopy,
    navContext,
    feedbackActionFilter,
    feedbackAgent,
    feedbackFocus,
    feedbackNavContext,
    feedbackOriginDate,
    feedbackPage,
    feedbackReturnRoute,
    feedbackSortMode,
    feedbackStatusFilter,
    routeQueryString,
    searchContextQuery,
    selectedBar,
    selectedRange,
    setActiveMode,
    setSelectedBar,
    setSelectedRange,
    symbolDetailActiveNav,
    showActionSection,
    showChartSection,
    showDisclosureSection,
    showFactorSnapshotSection,
    showFreshnessSection,
    showFundamentalsSection,
    showOverview,
    showTechnicalSection,
    symbol,
    symbolReady,
    toolbarMarketOpenState,
    trackingButtonLabel,
    trackingError,
    trackingSaving,
  } = useSymbolDetailData({
    copy,
    locale,
    mode,
    numberLocale,
    serverSymbol,
  });

  const toolbarMarketBadgeLabel =
    toolbarMarketOpenState === null
      ? copy.header.marketPending
      : toolbarMarketOpenState
        ? copy.header.marketOpen
        : copy.header.marketClosed;
  const toolbarMarketBadgeTone: DashboardToolbarStatusTone =
    toolbarMarketOpenState === null ? "neutral" : toolbarMarketOpenState ? "positive" : "closed";
  const isSearchContext = navContext === SYMBOL_DETAIL_SEARCH_NAV_CONTEXT;
  const calendarReviewDate = resolveSymbolDetailCalendarReviewDate(navContext, marketDate);
  const calendarDecisionContextLabel = calendarReviewDate
    ? copy.calendarReview.decisionBasisTemplate.replace("%date%", calendarReviewDate)
    : null;
  const backHref = (() => {
    if (isSearchContext) {
      return `/search${searchContextQuery ? `?${SYMBOL_DETAIL_SEARCH_QUERY_PARAM}=${encodeURIComponent(searchContextQuery)}` : ""}`;
    }

    if (navContext === SYMBOL_DETAIL_FEEDBACK_NAV_CONTEXT) {
      if (feedbackReturnRoute === SYMBOL_DETAIL_SIGNAL_DECIDER_FEEDBACK_RETURN_ROUTE) {
        return buildSignalDeciderFeedbackHref(marketDate, {
          actionFilter: feedbackActionFilter,
          focus: feedbackFocus,
          navContext: feedbackNavContext,
          originDate: feedbackOriginDate,
          page: feedbackPage ? Number.parseInt(feedbackPage, 10) : null,
          query: searchContextQuery,
          sortMode: feedbackSortMode,
          statusFilter: feedbackStatusFilter,
        });
      }

      return buildDeciderFeedbackHref({
        actionFilter: feedbackActionFilter,
        agentName: feedbackAgent,
        focus: feedbackFocus,
        marketDate,
        navContext: feedbackNavContext,
        originDate: feedbackOriginDate,
        page: feedbackPage ? Number.parseInt(feedbackPage, 10) : null,
        query: searchContextQuery,
        sortMode: feedbackSortMode,
        statusFilter: feedbackStatusFilter,
      });
    }

    if (navContext === SYMBOL_DETAIL_CALENDAR_NAV_CONTEXT && marketDate) {
      return `/calendar?date=${encodeURIComponent(marketDate)}`;
    }

    if (navContext === SYMBOL_DETAIL_PIOTROSKI_NAV_CONTEXT) {
      return buildPiotroskiListHref(marketDate);
    }

    return "/dashboard";
  })();
  const backLabel =
    navContext === SYMBOL_DETAIL_FEEDBACK_NAV_CONTEXT
      ? copy.header.backToFeedback
      : navContext === SYMBOL_DETAIL_CALENDAR_NAV_CONTEXT
        ? copy.header.backToCalendar
        : navContext === SYMBOL_DETAIL_PIOTROSKI_NAV_CONTEXT
          ? copy.header.backToPiotroskiList
          : isSearchContext
            ? copy.header.backToSearch
            : copy.header.backToDashboard;
  const leadingLink =
    navContext === SYMBOL_DETAIL_FEEDBACK_NAV_CONTEXT ? (
      <DocumentRouteLink href={backHref} className={styles.backButton} aria-label={backLabel} title={backLabel}>
        ←
      </DocumentRouteLink>
    ) : (
      <Link href={backHref} className={styles.backButton} aria-label={backLabel} title={backLabel}>
        ←
      </Link>
    );

  const handleDetailModeNavigation = (
    event: ReactMouseEvent<HTMLButtonElement>,
    nextMode: SymbolDetailMode,
  ) => {
    if (event.defaultPrevented) return;
    if (typeof event.button === "number" && event.button !== 0) return;

    event.preventDefault();
    if (activeMode !== nextMode) {
      setActiveMode(nextMode);
    }
  };
  const handleOpenFreshnessDetail = useCallback(() => {
    setActiveMode("system-freshness");
  }, [setActiveMode]);
  const dashboardRecommendationConflict = dashboardRecommendation
    ? getDashboardDecisionConflict(dashboardRecommendation)
    : null;
  const dashboardRecommendationEvidenceHref = dashboardRecommendation
    ? appendDashboardRecommendationContextToHref(
        buildSignalDeciderFeedbackHref(marketDate, { query: normalizedSymbol, symbols: [normalizedSymbol] }),
        dashboardRecommendation,
      )
    : null;
  const dashboardExecutionActionLabel = dashboardRecommendation?.executionAction
    ? copy.dashboardRecommendation.actions[dashboardRecommendation.executionAction]
    : copy.dashboardRecommendation.actions.unavailable;
  const dashboardExecutionSourceLabel = dashboardRecommendation?.executionSource
    ? copy.dashboardRecommendation.executionSources[dashboardRecommendation.executionSource]
    : copy.dashboardRecommendation.executionRuntimeSource;
  const dashboardSignalActionLabel = dashboardRecommendation?.signalDeciderEvidence
    ? copy.dashboardRecommendation.signalActions[dashboardRecommendation.signalDeciderEvidence.action]
    : copy.common.unavailable;

  const pendingChrome = {
    activeNav: symbolDetailActiveNav,
    leading: leadingLink,
    title: copy.common.pending,
    status: { label: copy.header.marketPending },
    toolbarAction: "dev-mode",
  } satisfies MobileAppChromeRouteChrome;

  if (!symbolReady) {
    return (
      <MobileAppChrome chrome={pendingChrome}>
        <div className={styles.detailPage} data-mode={activeMode}>
          <section className={`${styles.panel} ${styles.chartCard}`} role="status" aria-live="polite" aria-busy="true">
            <SurfaceState className={styles.emptyPanel} title={copy.loadingWorkspace} tone="loading">
              <span className="clamp-3">{copy.common.loading}</span>
            </SurfaceState>
          </section>
        </div>
      </MobileAppChrome>
    );
  }

  return (
    <MobileAppChrome
      chrome={{
        activeNav: symbolDetailActiveNav,
        leading: leadingLink,
        title: introTitle,
        status: { label: toolbarMarketBadgeLabel, tone: toolbarMarketBadgeTone },
        toolbarAction: "dev-mode",
      }}
    >
      <div className={styles.detailPage} data-mode={activeMode}>
        <section className={`${styles.panel} ${styles.heroCard}`} id="summary">
          <ComponentTag
            label="symbol.hero"
            api="/api/trading/quotes/{symbol} + /api/trading/market/status + /api/trading/symbols/search + /api/trading/symbols/{symbol}/price-bars + /api/trading/eod/action-summaries + /api/trading/agent-context/symbol-day + /api/trading/eod/piotroski-filter-results"
          />

          <div className={styles.heroTopRow}>
            <div>
              <p className={styles.sectionEyebrow}>{copy.hero.eyebrow}</p>
              <div className={styles.heroTitleRow}>
                <h1 className="clamp-3">{introTitle}</h1>
                <p className={styles.heroCompany}>{symbol}</p>
              </div>
            </div>

            <div className={styles.heroControls}>
              <div className={styles.tradeStatusGroup}>
                <button
                  type="button"
                  className={styles.tradeButton}
                  disabled
                  aria-disabled="true"
                  aria-describedby={tradeDisabledDescriptionId}
                  title={copy.hero.tradeDisabledTitle}
                >
                  {copy.hero.tradeDisabledLabel}
                </button>
                <p id={tradeDisabledDescriptionId} className={styles.tradeDisabledText}>
                  {copy.hero.tradeDisabledDescription}
                </p>
              </div>
              <button
                type="button"
                className={`${styles.watchBadge} ${isTrackedSymbol ? styles.watchBadgeActive : ""}`.trim()}
                aria-label={trackingButtonLabel}
                aria-pressed={isTrackedSymbol}
                aria-busy={trackingSaving}
                disabled={trackingSaving}
                title={trackingButtonLabel}
                onClick={handleToggleTrackedSymbol}
              >
                <span aria-hidden="true">{isTrackedSymbol ? "★" : "☆"}</span>
              </button>
              {trackingError ? (
                <p className={styles.trackingFeedback} role="status">
                  {trackingError}
                </p>
              ) : null}
            </div>
          </div>

          {calendarReviewDate ? (
            <aside
              className={styles.calendarReviewContext}
              aria-label={copy.calendarReview.ariaLabel}
              data-testid="calendar-review-context"
            >
              <p className={styles.sectionEyebrow}>{copy.calendarReview.eyebrow}</p>
              <strong>{copy.calendarReview.titleTemplate.replace("%date%", calendarReviewDate)}</strong>
              <p>{copy.calendarReview.body}</p>
            </aside>
          ) : null}

          <div className={styles.heroQuoteBlock}>
            {calendarReviewDate ? (
              <span className={styles.heroDataContextLabel}>{copy.calendarReview.latestData}</span>
            ) : null}
            <strong>
              {quote
                ? quote.available
                  ? `₩${formatPrice(quote.price)}`
                  : copy.common.notAvailable
                : loading
                  ? copy.hero.priceLoading
                  : copy.hero.quotePending}
            </strong>
            <span className={hasNumber(quote?.change_pct) ? (quote.change_pct >= 0 ? styles.positive : styles.negative) : ""}>
              {quote?.available
                ? `${formatSignedPercent(quote.change_pct, copy.common.unavailable)} · ${formatSignedNumber(quote.change, copy.common.unavailable, numberLocale)}`
                : formatQuoteUnavailableReasonLabel(quote?.unavailable_reason, copy)}
            </span>
            {quoteSourceCopy ? <p className={`clamp-3 ${styles.heroCopy}`}>{quoteSourceCopy}</p> : null}
          </div>

          <div className={styles.heroPills}>
            <span className="pill neutral">{marketLabel}</span>
            {marketStateRows.map((item) => (
              <span
                key={item.market}
                className={`pill ${item.stateCode === "OPEN" ? "positive" : !item.isReady || item.stateCode === null ? "warning" : "info"}`}
              >
                {item.market}: {item.state}
              </span>
            ))}
            <span className={`pill ${quotePollingState === "active" ? "warning" : "info"}`}>
              {quotePollingState === "closed"
                ? copy.hero.closedSession
                : quotePollingState === "active"
                  ? copy.hero.pollingActive
                  : copy.hero.pollingStopped}
            </span>
          </div>

          <div className={styles.heroMetrics}>
            <article className={styles.heroMetricCard}>
              <span>{copy.hero.focusCandle}</span>
              {focusCandleValue ? <strong>{focusCandleValue}</strong> : null}
              {focusCandleRows.length > 0 ? (
                <dl className={styles.heroMetricList}>
                  {focusCandleRows.map((row) => (
                    <div key={`${copy.hero.focusCandle}-${row.label}`} className={styles.heroMetricRow}>
                      <dt>{row.label}</dt>
                      <dd className={row.valueClassName}>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {focusCandleDetail ? <p className="clamp-3">{focusCandleDetail}</p> : null}
            </article>

            <HeroFundamentalLatestMetric
              copy={copy}
              fsDiv={fsDiv}
              marketDate={marketDate}
              normalizedSymbol={normalizedSymbol}
              symbolReady={symbolReady}
            />

            <HeroPiotroskiMetric
              copy={copy}
              marketDate={marketDate}
              normalizedSymbol={normalizedSymbol}
              symbolReady={symbolReady}
            />

            <HeroActionRecommendationMetric
              copy={copy}
              decisionContextLabel={calendarDecisionContextLabel}
              fsDiv={fsDiv}
              marketDate={marketDate}
              normalizedSymbol={normalizedSymbol}
              symbolReady={symbolReady}
            />
          </div>
        </section>

        {detailErrors.length > 0 ? (
          <section className={`${styles.panel} ${styles.alertCard}`}>
            <ComponentTag label="symbol.errors" api="client fetch states" />
            <p className={styles.sectionEyebrow}>{copy.errors.dataIssues}</p>
            <div className={styles.errorList}>
              {detailErrors.map((error) => (
                <div key={error} className={styles.feedback}>
                  {error}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className={`${styles.panel} ${styles.detailNavigator}`}>
          <div>
            <p className={styles.sectionEyebrow}>{activeDetailMode.eyebrow}</p>
            <h2 className={styles.cardTitle}>{activeDetailMode.title}</h2>
          </div>
          <nav className={styles.detailTabs} aria-label={copy.modes.tabsAriaLabel}>
            {SYMBOL_DETAIL_MODES.map((item) => (
              <button
                key={item.mode}
                type="button"
                aria-pressed={activeMode === item.mode}
                className={`${styles.detailTab} ${activeMode === item.mode ? styles.detailTabActive : ""}`.trim()}
                onClick={(event) => handleDetailModeNavigation(event, item.mode)}
              >
                {localizedModes[item.mode].label}
              </button>
            ))}
          </nav>
        </section>

        {showActionSection && dashboardRecommendation ? (
          <section
            className={`${styles.panel} ${styles.recommendationContextCard}`}
            aria-labelledby="dashboard-recommendation-context-title"
          >
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.sectionEyebrow}>{copy.dashboardRecommendation.eyebrow}</p>
                <h2 id="dashboard-recommendation-context-title" className={styles.cardTitle}>
                  {introTitle} · {copy.dashboardRecommendation.title}
                </h2>
              </div>
              <span className="pill info">
                {copy.dashboardRecommendation.marketDate}{" "}
                {dashboardRecommendation.marketDate ?? marketDate ?? copy.common.datePending}
              </span>
            </div>
            <p className={styles.supportingCopy}>{copy.dashboardRecommendation.body}</p>
            <div className={styles.metricGrid}>
              <article className={styles.metricCard}>
                <span>{copy.dashboardRecommendation.source}</span>
                <strong>{dashboardExecutionSourceLabel}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>{copy.dashboardRecommendation.executionAction}</span>
                <strong>{dashboardExecutionActionLabel}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>{copy.dashboardRecommendation.stopLossPrice}</span>
                <strong>{formatPrice(dashboardRecommendation.stopLossPrice, copy.common.unavailable)}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>{copy.dashboardRecommendation.targetPrice}</span>
                <strong>{formatPrice(dashboardRecommendation.targetPrice, copy.common.unavailable)}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>
                  {dashboardRecommendation.referencePriceKind === "close"
                    ? copy.dashboardRecommendation.closePrice
                    : copy.dashboardRecommendation.currentPrice}
                </span>
                <strong>{formatPrice(dashboardRecommendation.referencePrice, copy.common.unavailable)}</strong>
              </article>
            </div>
            {dashboardRecommendationConflict && dashboardRecommendation.signalDeciderEvidence ? (
              <section
                className={styles.sourceConflictPanel}
                aria-labelledby="dashboard-source-conflict-title"
                data-testid="dashboard-source-conflict"
              >
                <div className={styles.sourceConflictHeader}>
                  <div>
                    <p className={styles.sectionEyebrow}>{copy.dashboardRecommendation.conflictBadge}</p>
                    <h3 id="dashboard-source-conflict-title" className={styles.sourceConflictTitle}>
                      {copy.dashboardRecommendation.conflictTitle}
                    </h3>
                  </div>
                  <span className="pill warning">{copy.dashboardRecommendation.conflictBadge}</span>
                </div>
                <p className={styles.supportingCopy}>{copy.dashboardRecommendation.conflictBody}</p>
                <div className={styles.sourceConflictComparison}>
                  <article className={styles.metricCard}>
                    <span>{dashboardExecutionSourceLabel}</span>
                    <strong>{dashboardExecutionActionLabel}</strong>
                    <p>
                      {copy.dashboardRecommendation.stopLossPrice}{" "}
                      {formatPrice(dashboardRecommendation.stopLossPrice, copy.common.unavailable)} ·{" "}
                      {copy.dashboardRecommendation.targetPrice}{" "}
                      {formatPrice(dashboardRecommendation.targetPrice, copy.common.unavailable)}
                    </p>
                  </article>
                  <article className={styles.metricCard}>
                    <span>{copy.dashboardRecommendation.signalDeciderSource}</span>
                    <strong>{dashboardSignalActionLabel}</strong>
                    <p>
                      {copy.dashboardRecommendation.stopLossPrice}{" "}
                      {formatPrice(
                        dashboardRecommendation.signalDeciderEvidence.stopLossPrice,
                        copy.common.unavailable,
                      )}{" "}
                      · {copy.dashboardRecommendation.targetPrice}{" "}
                      {formatPrice(
                        dashboardRecommendation.signalDeciderEvidence.targetPrice,
                        copy.common.unavailable,
                      )}
                    </p>
                  </article>
                </div>
                <div className={styles.sourceConflictReasons}>
                  {dashboardRecommendationConflict.actionConflict ? (
                    <span className="pill warning">{copy.dashboardRecommendation.conflictAction}</span>
                  ) : null}
                  {dashboardRecommendationConflict.riskPlanConflict ? (
                    <span className="pill warning">{copy.dashboardRecommendation.conflictRiskPlan}</span>
                  ) : null}
                </div>
                {dashboardRecommendationEvidenceHref ? (
                  <Link
                    href={dashboardRecommendationEvidenceHref}
                    className={`${styles.detailLink} ${styles.dashboardEvidenceFallback}`}
                  >
                    {copy.dashboardRecommendation.reviewSignalEvidence}
                  </Link>
                ) : null}
              </section>
            ) : null}
          </section>
        ) : null}

        {showChartSection ? (
          <section
            className={`${styles.panel} ${styles.chartCard}`}
            id="chart"
            aria-busy={chartUnitRefreshing || undefined}
            data-refreshing={chartUnitRefreshing ? "true" : "false"}
          >
            <UnitRefreshFrame busy={chartUnitRefreshing} label={copy.common.refreshing}>
              <ComponentTag
                label="symbol.chart"
                api="/api/trading/symbols/{symbol}/price-bars + /api/trading/quotes/{symbol}"
              />

              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.sectionEyebrow}>
                    {activeMode === "technical-analysis" ? copy.chart.technicalEyebrow : copy.chart.overviewEyebrow}
                  </p>
                  <h2 className={styles.cardTitle}>
                    {activeMode === "technical-analysis" ? copy.chart.technicalTitle : copy.chart.overviewTitle}
                  </h2>
                </div>

                <div className={styles.rangeRow}>
                  {PRICE_HISTORY_RANGES.map((range) => (
                    <button
                      key={range}
                      type="button"
                      className={`${styles.rangeButton} ${selectedRange === range ? styles.rangeButtonActive : ""}`.trim()}
                      onClick={() => setSelectedRange(range)}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.focusGrid}>
                <article className={styles.focusCard}>
                  <span>{copy.chart.focusDate}</span>
                  <strong>
                    {focusBar?.trade_date
                      ? formatIsoDateLabel(focusBar.trade_date, copy.common.datePending)
                      : historyLoading
                        ? copy.common.loading
                        : copy.chart.noCandleSelected}
                  </strong>
                  <p className="clamp-3">
                    {focusBar
                      ? `${copy.chart.open} ${formatPrice(focusBar.open_price)} · ${copy.chart.highest} ${formatPrice(focusBar.high_price)} · ${copy.chart.lowest} ${formatPrice(focusBar.low_price)}`
                      : copy.chart.selectCandle}
                  </p>
                </article>
                <article className={styles.focusCard}>
                  <span>{copy.chart.closeMove}</span>
                  <strong className={hasNumber(focusMovePct) ? (focusMovePct >= 0 ? styles.positive : styles.negative) : ""}>
                    {hasNumber(focusMovePct) ? formatSignedPercent(focusMovePct, copy.common.unavailable) : copy.chart.noPriorCandle}
                  </strong>
                  <p className="clamp-3">
                    {previousFocusBar
                      ? `${copy.chart.priorClose} ${formatPrice(previousFocusBar.close_price)} · ${copy.chart.currentClose} ${formatPrice(focusBar?.close_price)}`
                      : copy.chart.priorCloseComparison}
                  </p>
                </article>
                <article className={styles.focusCard}>
                  <span>{copy.chart.volume}</span>
                  <strong>{formatCompactNumber(focusBar?.volume, copy.common.unavailable, numberLocale)}</strong>
                  <p className="clamp-3">
                    {focusBar ? `${copy.chart.turnover} ${buildFocusTurnoverValue(focusBar, copy)}` : copy.chart.turnover}
                  </p>
                </article>
              </div>

              <div className={styles.chartFrame}>
                {priceHistory && priceHistory.items.length > 0 ? (
                  <SymbolHistoryChart
                    key={`${symbol}-${selectedRange}`}
                    symbol={symbol}
                    bars={priceHistory.items}
                    initialSelectedBarTradeDate={selectedBar?.trade_date ?? null}
                    onSelectedBarChange={setSelectedBar}
                  />
                ) : historyLoading ? (
                  <SurfaceState className={styles.emptyPanel} title={copy.chart.loadingTitle} tone="loading">
                    <span className="clamp-3">{copy.chart.loadingBody}</span>
                  </SurfaceState>
                ) : (
                  <SurfaceState className={styles.emptyPanel} title={copy.chart.emptyTitle}>
                    <span className="clamp-3">{copy.chart.emptyBody}</span>
                  </SurfaceState>
                )}
              </div>

              <div className={styles.chartFooter}>
                <span>
                  {chartMetrics
                    ? `${selectedRange} ${copy.chart.returnLabel} ${formatSignedPercent(chartMetrics.returnPercent, copy.chart.returnUnavailable)}`
                    : historyHydrating
                      ? `${copy.chart.hydratingPrefix} ${selectedRange} ${copy.chart.historySuffix}`.trim()
                      : hasSelectedRangeHistoryLoaded
                        ? `${selectedRange} ${copy.chart.returnLabel} ${copy.chart.returnUnavailable}`
                        : `${selectedRange} ${copy.chart.returnPendingSuffix}`}
                </span>
                <span>
                  {marketDateBasisCopy ??
                    (marketDate
                      ? `${marketDateLabel} ${formatIsoDateLabel(marketDate, copy.common.datePending)}`
                      : copy.chart.marketDatePending)}
                </span>
                <span>{historyHydrating ? copy.chart.loadingTitle : copy.chart.swipeHint}</span>
              </div>
            </UnitRefreshFrame>
          </section>
        ) : null}

        {showFactorSnapshotSection ? (
          <FactorSnapshotSection
            copy={copy}
            marketDate={marketDate}
            marketDateBasisCopy={marketDateBasisCopy}
            marketDateLabel={marketDateLabel}
            normalizedSymbol={normalizedSymbol}
            numberLocale={numberLocale}
            symbolReady={symbolReady}
          />
        ) : null}

        {showActionSection || showTechnicalSection ? (
          <section className={styles.insightGrid}>
            {showActionSection ? (
              <ActionSummarySection
                copy={copy}
                dashboardRecommendationEvidenceHref={
                  dashboardRecommendationConflict ? null : dashboardRecommendationEvidenceHref
                }
                decisionContextLabel={calendarDecisionContextLabel}
                fsDiv={fsDiv}
                marketDate={marketDate}
                normalizedSymbol={normalizedSymbol}
                symbolReady={symbolReady}
              />
            ) : null}

            {showTechnicalSection ? (
              <TechnicalAnalysisSection
                copy={copy}
                fsDiv={fsDiv}
                marketDate={marketDate}
                normalizedSymbol={normalizedSymbol}
                symbolReady={symbolReady}
              />
            ) : null}
          </section>
        ) : null}

        {showFundamentalsSection || showDisclosureSection ? (
          <section className={styles.evidenceGrid}>
            {showFundamentalsSection ? (
              <FundamentalsHistorySection
                copy={copy}
                fsDiv={fsDiv}
                marketDate={marketDate}
                normalizedSymbol={normalizedSymbol}
                symbol={symbol}
                symbolReady={symbolReady}
                fundamentalsEntryLimit={fundamentalsEntryLimit}
                introTitle={introTitle}
              />
            ) : null}

            {showDisclosureSection ? (
              <DisclosureCoverageSection
                copy={copy}
                fsDiv={fsDiv}
                marketDate={marketDate}
                normalizedSymbol={normalizedSymbol}
                routeQueryString={routeQueryString}
                symbol={symbol}
                symbolReady={symbolReady}
                disclosureItemLimit={disclosureItemLimit}
              />
            ) : null}
          </section>
        ) : null}

        {showFreshnessSection ? (
          <SystemFreshnessSection
            copy={copy}
            fsDiv={fsDiv}
            marketDate={marketDate}
            normalizedSymbol={normalizedSymbol}
            onOpenDetail={handleOpenFreshnessDetail}
            quote={quote}
            showOverview={showOverview}
            symbolReady={symbolReady}
          />
        ) : null}
      </div>
    </MobileAppChrome>
  );
}
