export const DASHBOARD_RECOMMENDATION_SOURCE = "dashboard-decider";

const RECOMMENDATION_SOURCE_PARAM = "recommendationSource";
const STOP_LOSS_PRICE_PARAM = "stopLossPrice";
const TARGET_PRICE_PARAM = "targetPrice";
const REFERENCE_PRICE_PARAM = "referencePrice";
const REFERENCE_PRICE_KIND_PARAM = "referencePriceKind";

export type DashboardRecommendationReferencePriceKind = "current" | "close";

export type DashboardRecommendationContext = {
  referencePrice: number | null;
  referencePriceKind: DashboardRecommendationReferencePriceKind;
  stopLossPrice: number | null;
  targetPrice: number | null;
};

type SearchParamReader = {
  get(name: string): string | null;
};

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

export function appendDashboardRecommendationContext(
  params: URLSearchParams,
  context: DashboardRecommendationContext,
) {
  params.set(RECOMMENDATION_SOURCE_PARAM, DASHBOARD_RECOMMENDATION_SOURCE);
  params.set(REFERENCE_PRICE_KIND_PARAM, context.referencePriceKind);
  setPriceParam(params, STOP_LOSS_PRICE_PARAM, context.stopLossPrice);
  setPriceParam(params, TARGET_PRICE_PARAM, context.targetPrice);
  setPriceParam(params, REFERENCE_PRICE_PARAM, context.referencePrice);
}

export function readDashboardRecommendationContext(
  params: SearchParamReader,
): DashboardRecommendationContext | null {
  if (params.get(RECOMMENDATION_SOURCE_PARAM) !== DASHBOARD_RECOMMENDATION_SOURCE) {
    return null;
  }

  return {
    referencePrice: readPriceParam(params, REFERENCE_PRICE_PARAM),
    referencePriceKind: params.get(REFERENCE_PRICE_KIND_PARAM) === "close" ? "close" : "current",
    stopLossPrice: readPriceParam(params, STOP_LOSS_PRICE_PARAM),
    targetPrice: readPriceParam(params, TARGET_PRICE_PARAM),
  };
}
