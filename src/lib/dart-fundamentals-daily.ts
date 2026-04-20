export const DART_FUNDAMENTALS_DAILY_INSPECT_UPSTREAM_PATH =
  "/disclosures/dart/fundamentals/daily/inspect";
export const DART_FUNDAMENTALS_DAILY_INSPECT_CLIENT_PATH =
  "/api/trading/disclosures/dart/fundamentals/daily/inspect";

export function normalizeDartFundamentalsMarketDate(value: string | null | undefined) {
  if (!value?.trim()) return null;

  const datePart = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
}

export function buildDartFundamentalsDailyInspectPath(
  basePath: string,
  marketDate: string | null | undefined,
  runsLimit = 1,
) {
  const params = new URLSearchParams({ runs_limit: String(runsLimit) });
  const normalizedMarketDate = normalizeDartFundamentalsMarketDate(marketDate);

  if (normalizedMarketDate) {
    params.set("market_date", normalizedMarketDate);
  }

  return `${basePath}?${params.toString()}`;
}
