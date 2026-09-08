import type { SignalDeciderAction } from "@/lib/signal-decider-feedback";

export const DASHBOARD_RECOMMENDATION_SOURCE = "execution-runtime";

const LEGACY_DASHBOARD_RECOMMENDATION_SOURCE = "dashboard-decider";
const RECOMMENDATION_SOURCE_PARAM = "recommendationSource";
const RECOMMENDATION_SYMBOL_PARAM = "recommendationSymbol";
const RECOMMENDATION_MARKET_DATE_PARAM = "recommendationMarketDate";
const EXECUTION_ACTION_PARAM = "executionAction";
const EXECUTION_SOURCE_PARAM = "executionSource";
const STOP_LOSS_PRICE_PARAM = "stopLossPrice";
const TARGET_PRICE_PARAM = "targetPrice";
const REFERENCE_PRICE_PARAM = "referencePrice";
const REFERENCE_PRICE_KIND_PARAM = "referencePriceKind";
const SIGNAL_DECIDER_ACTION_PARAM = "signalDeciderAction";
const SIGNAL_DECIDER_MARKET_DATE_PARAM = "signalDeciderMarketDate";
const SIGNAL_DECIDER_STOP_LOSS_PRICE_PARAM = "signalDeciderStopLossPrice";
const SIGNAL_DECIDER_TARGET_PRICE_PARAM = "signalDeciderTargetPrice";

export type DashboardRecommendationReferencePriceKind = "current" | "close";
export type DashboardExecutionAction =
  | "buy-monitoring"
  | "sell-monitoring"
  | "monitoring"
  | "planned-buy-today"
  | "planned-buy-next"
  | "planned-sell-today"
  | "planned-sell-next";
export type DashboardExecutionSource = "execution-board" | "monitored-symbols";

export type DashboardSignalDeciderEvidenceContext = {
  action: SignalDeciderAction;
  marketDate: string;
  stopLossPrice: number | null;
  targetPrice: number | null;
};

export type DashboardRecommendationContext = {
  executionAction: DashboardExecutionAction | null;
  executionSource: DashboardExecutionSource | null;
  marketDate: string | null;
  referencePrice: number | null;
  referencePriceKind: DashboardRecommendationReferencePriceKind;
  signalDeciderEvidence: DashboardSignalDeciderEvidenceContext | null;
  source: typeof DASHBOARD_RECOMMENDATION_SOURCE;
  stopLossPrice: number | null;
  symbol: string | null;
  targetPrice: number | null;
};

export type DashboardDecisionConflict = {
  actionConflict: boolean;
  riskPlanConflict: boolean;
};

type SearchParamReader = {
  get(name: string): string | null;
};

const EXECUTION_ACTIONS = new Set<DashboardExecutionAction>([
  "buy-monitoring",
  "sell-monitoring",
  "monitoring",
  "planned-buy-today",
  "planned-buy-next",
  "planned-sell-today",
  "planned-sell-next",
]);
const EXECUTION_SOURCES = new Set<DashboardExecutionSource>(["execution-board", "monitored-symbols"]);
const SIGNAL_DECIDER_ACTIONS = new Set<SignalDeciderAction>([
  "buy",
  "wait",
  "reject",
  "watch_for_trigger",
  "avoid_chase",
  "unknown",
]);

function setPriceParam(params: URLSearchParams, key: string, value: number | null) {
  if (value !== null && Number.isFinite(value) && value > 0) {
    params.set(key, String(value));
  }
}

function readPriceParam(params: SearchParamReader, key: string) {
  const value = params.get(key);
  if (!value) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readMarketDateParam(params: SearchParamReader, key: string) {
  const value = params.get(key)?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function readExecutionAction(params: SearchParamReader) {
  const value = params.get(EXECUTION_ACTION_PARAM) as DashboardExecutionAction | null;
  return value && EXECUTION_ACTIONS.has(value) ? value : null;
}

function readExecutionSource(params: SearchParamReader) {
  const value = params.get(EXECUTION_SOURCE_PARAM) as DashboardExecutionSource | null;
  return value && EXECUTION_SOURCES.has(value) ? value : null;
}

function readSignalDeciderEvidence(params: SearchParamReader): DashboardSignalDeciderEvidenceContext | null {
  const action = params.get(SIGNAL_DECIDER_ACTION_PARAM) as SignalDeciderAction | null;
  const marketDate = readMarketDateParam(params, SIGNAL_DECIDER_MARKET_DATE_PARAM);
  if (!action || !SIGNAL_DECIDER_ACTIONS.has(action) || !marketDate) return null;

  return {
    action,
    marketDate,
    stopLossPrice: readPriceParam(params, SIGNAL_DECIDER_STOP_LOSS_PRICE_PARAM),
    targetPrice: readPriceParam(params, SIGNAL_DECIDER_TARGET_PRICE_PARAM),
  };
}

export function appendDashboardRecommendationContext(
  params: URLSearchParams,
  context: DashboardRecommendationContext,
) {
  params.set(RECOMMENDATION_SOURCE_PARAM, DASHBOARD_RECOMMENDATION_SOURCE);
  params.set(REFERENCE_PRICE_KIND_PARAM, context.referencePriceKind);
  if (context.symbol) params.set(RECOMMENDATION_SYMBOL_PARAM, context.symbol);
  if (context.marketDate) params.set(RECOMMENDATION_MARKET_DATE_PARAM, context.marketDate);
  if (context.executionAction) params.set(EXECUTION_ACTION_PARAM, context.executionAction);
  if (context.executionSource) params.set(EXECUTION_SOURCE_PARAM, context.executionSource);
  setPriceParam(params, STOP_LOSS_PRICE_PARAM, context.stopLossPrice);
  setPriceParam(params, TARGET_PRICE_PARAM, context.targetPrice);
  setPriceParam(params, REFERENCE_PRICE_PARAM, context.referencePrice);

  if (context.signalDeciderEvidence) {
    params.set(SIGNAL_DECIDER_ACTION_PARAM, context.signalDeciderEvidence.action);
    params.set(SIGNAL_DECIDER_MARKET_DATE_PARAM, context.signalDeciderEvidence.marketDate);
    setPriceParam(
      params,
      SIGNAL_DECIDER_STOP_LOSS_PRICE_PARAM,
      context.signalDeciderEvidence.stopLossPrice,
    );
    setPriceParam(params, SIGNAL_DECIDER_TARGET_PRICE_PARAM, context.signalDeciderEvidence.targetPrice);
  }
}

export function appendDashboardRecommendationContextToHref(
  href: string,
  context: DashboardRecommendationContext,
) {
  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const hrefWithoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const queryIndex = hrefWithoutHash.indexOf("?");
  const pathname = queryIndex >= 0 ? hrefWithoutHash.slice(0, queryIndex) : hrefWithoutHash;
  const params = new URLSearchParams(queryIndex >= 0 ? hrefWithoutHash.slice(queryIndex + 1) : "");

  appendDashboardRecommendationContext(params, context);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

export function getDashboardDecisionConflict(
  context: Pick<
    DashboardRecommendationContext,
    "executionAction" | "marketDate" | "signalDeciderEvidence" | "stopLossPrice" | "targetPrice"
  >,
): DashboardDecisionConflict | null {
  const evidence = context.signalDeciderEvidence;
  if (!evidence || !context.marketDate || evidence.marketDate !== context.marketDate) {
    return null;
  }

  const isBuyExecutionAction = context.executionAction?.includes("buy") === true;
  const isSellExecutionAction = context.executionAction?.includes("sell") === true;
  const actionConflict =
    evidence.action !== "unknown" &&
    ((isBuyExecutionAction && evidence.action !== "buy") ||
      (isSellExecutionAction && evidence.action === "buy"));
  const riskPlanConflict =
    (context.stopLossPrice !== null &&
      evidence.stopLossPrice !== null &&
      context.stopLossPrice !== evidence.stopLossPrice) ||
    (context.targetPrice !== null &&
      evidence.targetPrice !== null &&
      context.targetPrice !== evidence.targetPrice);

  return actionConflict || riskPlanConflict ? { actionConflict, riskPlanConflict } : null;
}

export function readDashboardRecommendationContext(
  params: SearchParamReader,
): DashboardRecommendationContext | null {
  const source = params.get(RECOMMENDATION_SOURCE_PARAM);
  if (source !== DASHBOARD_RECOMMENDATION_SOURCE && source !== LEGACY_DASHBOARD_RECOMMENDATION_SOURCE) {
    return null;
  }

  const symbol = params.get(RECOMMENDATION_SYMBOL_PARAM)?.trim() || null;

  return {
    executionAction: readExecutionAction(params),
    executionSource: readExecutionSource(params),
    marketDate: readMarketDateParam(params, RECOMMENDATION_MARKET_DATE_PARAM),
    referencePrice: readPriceParam(params, REFERENCE_PRICE_PARAM),
    referencePriceKind: params.get(REFERENCE_PRICE_KIND_PARAM) === "close" ? "close" : "current",
    signalDeciderEvidence: readSignalDeciderEvidence(params),
    source: DASHBOARD_RECOMMENDATION_SOURCE,
    stopLossPrice: readPriceParam(params, STOP_LOSS_PRICE_PARAM),
    symbol,
    targetPrice: readPriceParam(params, TARGET_PRICE_PARAM),
  };
}
