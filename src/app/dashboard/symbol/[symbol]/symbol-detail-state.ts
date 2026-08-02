import { isPlaceholderSymbolMetaSeed } from "@/lib/symbol-meta";

export type SymbolMetaSeed = {
  symbol: string;
  standard_code: string;
  name_ko: string;
  market: string;
};

export type AggregateContextLoadState = "loading" | "success" | "error";

export type DisclosureSectionState = "loading" | "list" | "empty" | "unavailable";

export type SymbolDetailMode =
  | "overview"
  | "action-summary"
  | "technical-analysis"
  | "fundamentals-history"
  | "disclosure-coverage"
  | "system-freshness";

export type SymbolDetailModeDefinition = {
  mode: SymbolDetailMode;
  path: string;
  api: string;
};

export type SymbolDetailSectionVisibility = {
  showOverview: boolean;
  showChartSection: boolean;
  showFactorSnapshotSection: boolean;
  showActionSection: boolean;
  showTechnicalSection: boolean;
  showFundamentalsSection: boolean;
  showDisclosureSection: boolean;
  showFreshnessSection: boolean;
};

export const SYMBOL_DETAIL_NAV_CONTEXT_PARAM = "navContext";
export const SYMBOL_DETAIL_MY_SYMBOLS_NAV_CONTEXT = "my-symbols";
export const SYMBOL_DETAIL_SEARCH_NAV_CONTEXT = "search";
export const SYMBOL_DETAIL_FEEDBACK_NAV_CONTEXT = "signal-decider-feedback";
export const SYMBOL_DETAIL_CALENDAR_NAV_CONTEXT = "calendar";
export const SYMBOL_DETAIL_PIOTROSKI_NAV_CONTEXT = "piotroski";
export const SYMBOL_DETAIL_DECIDER_FEEDBACK_RETURN_ROUTE = "decider-feedback";
export const SYMBOL_DETAIL_SIGNAL_DECIDER_FEEDBACK_RETURN_ROUTE = SYMBOL_DETAIL_FEEDBACK_NAV_CONTEXT;
export const SYMBOL_DETAIL_SEARCH_QUERY_PARAM = "q";
export const SYMBOL_DETAIL_FEEDBACK_ACTION_PARAM = "feedbackAction";
export const SYMBOL_DETAIL_FEEDBACK_SORT_PARAM = "feedbackSort";
export const SYMBOL_DETAIL_FEEDBACK_RETURN_NAV_CONTEXT_PARAM = "feedbackNavContext";
export const SYMBOL_DETAIL_FEEDBACK_RETURN_ORIGIN_DATE_PARAM = "feedbackOriginDate";
export const SYMBOL_DETAIL_FEEDBACK_RETURN_ROUTE_PARAM = "feedbackRoute";

export type SymbolDetailNavContext =
  | typeof SYMBOL_DETAIL_MY_SYMBOLS_NAV_CONTEXT
  | typeof SYMBOL_DETAIL_SEARCH_NAV_CONTEXT
  | typeof SYMBOL_DETAIL_FEEDBACK_NAV_CONTEXT
  | typeof SYMBOL_DETAIL_CALENDAR_NAV_CONTEXT
  | typeof SYMBOL_DETAIL_PIOTROSKI_NAV_CONTEXT;

export type SymbolDetailFeedbackReturnRoute =
  | typeof SYMBOL_DETAIL_DECIDER_FEEDBACK_RETURN_ROUTE
  | typeof SYMBOL_DETAIL_SIGNAL_DECIDER_FEEDBACK_RETURN_ROUTE;

export const SYMBOL_DETAIL_MODES: SymbolDetailModeDefinition[] = [
  {
    mode: "overview",
    path: "",
    api: "/api/trading/quotes/{symbol} + layered symbol APIs",
  },
  {
    mode: "action-summary",
    path: "/action-summary",
    api: "/api/trading/eod/action-summaries",
  },
  {
    mode: "technical-analysis",
    path: "/technical-analysis",
    api: "/api/trading/eod/technical-snapshots",
  },
  {
    mode: "fundamentals-history",
    path: "/fundamentals-history",
    api: "/api/trading/disclosures/dart/fundamentals/history",
  },
  {
    mode: "disclosure-coverage",
    path: "/disclosure-coverage",
    api: "/api/trading/agent-context/symbol-day",
  },
  {
    mode: "system-freshness",
    path: "/system-freshness",
    api: "/api/trading/eod/freshness",
  },
];

const SYMBOL_DETAIL_MODE_BY_ID = SYMBOL_DETAIL_MODES.reduce(
  (acc, item) => {
    acc[item.mode] = item;
    return acc;
  },
  {} as Record<SymbolDetailMode, SymbolDetailModeDefinition>,
);

type SymbolMetaParams = {
  name: string | null;
  market: string | null;
  standardCode: string | null;
};

export function buildInitialSymbolMeta(symbol: string, params: SymbolMetaParams): SymbolMetaSeed | null {
  if (!params.name && !params.market && !params.standardCode) {
    return null;
  }

  return {
    symbol,
    name_ko: params.name ?? symbol,
    market: params.market ?? "-",
    standard_code: params.standardCode ?? "-",
  };
}

export function resolveSymbolDetailMode(value: string | null | undefined) {
  if (!value) return null;
  return Object.prototype.hasOwnProperty.call(SYMBOL_DETAIL_MODE_BY_ID, value) ? (value as SymbolDetailMode) : null;
}

export function resolveSymbolDetailNavContext(value: string | null | undefined): SymbolDetailNavContext | null {
  return value === SYMBOL_DETAIL_MY_SYMBOLS_NAV_CONTEXT ||
    value === SYMBOL_DETAIL_SEARCH_NAV_CONTEXT ||
    value === SYMBOL_DETAIL_FEEDBACK_NAV_CONTEXT ||
    value === SYMBOL_DETAIL_CALENDAR_NAV_CONTEXT ||
    value === SYMBOL_DETAIL_PIOTROSKI_NAV_CONTEXT
    ? value
    : null;
}

export function resolveSymbolDetailFeedbackReturnRoute(
  value: string | null | undefined,
): SymbolDetailFeedbackReturnRoute | null {
  return value === SYMBOL_DETAIL_DECIDER_FEEDBACK_RETURN_ROUTE ||
    value === SYMBOL_DETAIL_SIGNAL_DECIDER_FEEDBACK_RETURN_ROUTE
    ? value
    : null;
}

export function resolveSymbolDetailActiveNav(navContext: SymbolDetailNavContext | null): "dashboard" | "symbols" | "calendar" | null {
  if (navContext === SYMBOL_DETAIL_PIOTROSKI_NAV_CONTEXT) return "dashboard";
  if (navContext === SYMBOL_DETAIL_MY_SYMBOLS_NAV_CONTEXT) return "symbols";
  if (navContext === SYMBOL_DETAIL_CALENDAR_NAV_CONTEXT) return "calendar";
  return null;
}

export function resolveSymbolDetailModeFromPathname(pathname: string | null, symbol: string) {
  if (!pathname || !symbol) return null;

  const segments = pathname.split("/").filter(Boolean);
  const symbolSegmentIndex = segments.findIndex(
    (segment, index) => segment === "symbol" && segments[index - 1] === "dashboard",
  );
  if (symbolSegmentIndex === -1) return null;

  const encodedSymbol = segments[symbolSegmentIndex + 1];
  if (!encodedSymbol) return null;

  try {
    if (decodeURIComponent(encodedSymbol) !== symbol) return null;
  } catch {
    if (encodedSymbol !== symbol) return null;
  }

  const detailPath = segments[symbolSegmentIndex + 2] ? `/${segments[symbolSegmentIndex + 2]}` : "";
  return SYMBOL_DETAIL_MODES.find((item) => item.path === detailPath)?.mode ?? null;
}

export function getSymbolDetailSectionVisibility(activeMode: SymbolDetailMode): SymbolDetailSectionVisibility {
  const showOverview = activeMode === "overview";

  return {
    showOverview,
    showChartSection: showOverview || activeMode === "technical-analysis",
    showFactorSnapshotSection: showOverview,
    showActionSection: activeMode === "action-summary",
    showTechnicalSection: activeMode === "technical-analysis",
    showFundamentalsSection: activeMode === "fundamentals-history",
    showDisclosureSection: activeMode === "disclosure-coverage",
    showFreshnessSection: showOverview || activeMode === "system-freshness",
  };
}

export function createSymbolMetaResetToken(symbol: string, initialMeta: SymbolMetaSeed | null): string {
  return [symbol, initialMeta?.name_ko ?? "", initialMeta?.market ?? "", initialMeta?.standard_code ?? ""].join("|");
}

export function shouldFetchSymbolMeta(initialMeta: SymbolMetaSeed | null): boolean {
  if (initialMeta === null) {
    return true;
  }

  return isPlaceholderSymbolMetaSeed(initialMeta.market) || isPlaceholderSymbolMetaSeed(initialMeta.standard_code);
}

export function getDisclosureSectionState(
  loadState: AggregateContextLoadState,
  aggregateContextLoaded: boolean,
  disclosureCount: number,
): DisclosureSectionState {
  if (loadState === "loading") {
    return "loading";
  }

  if (loadState === "error" || !aggregateContextLoaded) {
    return "unavailable";
  }

  return disclosureCount > 0 ? "list" : "empty";
}
