import { NextRequest } from "next/server";

import { proxyTradingUpstreamJson } from "@/lib/trading-upstream";
import { FACTOR_SCREENING_API_REQUEST_TIMEOUT_MS } from "@/lib/factor-screening";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const path = query ? `/eod/value-factors?${query}` : "/eod/value-factors";
  return proxyTradingUpstreamJson(path, undefined, { timeoutMs: FACTOR_SCREENING_API_REQUEST_TIMEOUT_MS });
}
