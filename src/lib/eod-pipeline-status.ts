import { normalizeDartFundamentalsMarketDate } from "@/lib/dart-fundamentals-daily";

export const EOD_PIPELINE_STATUS_UPSTREAM_PATH = "/eod/pipeline/status";
export const EOD_PIPELINE_STATUS_CLIENT_PATH = "/api/trading/eod/pipeline/status";
export const EOD_PIPELINE_STATUS_REQUEST_TIMEOUT_MS = 10_000;

export function buildEodPipelineStatusPath(basePath: string, marketDate: string | null | undefined) {
  const params = new URLSearchParams();
  const normalizedMarketDate = normalizeDartFundamentalsMarketDate(marketDate);

  if (normalizedMarketDate) {
    params.set("market_date", normalizedMarketDate);
  }

  return params.size > 0 ? `${basePath}?${params.toString()}` : basePath;
}
