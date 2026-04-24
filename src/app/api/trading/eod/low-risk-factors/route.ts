import { NextRequest } from "next/server";

import { proxyTradingUpstreamJson } from "@/lib/trading-upstream";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const path = query ? `/eod/low-risk-factors?${query}` : "/eod/low-risk-factors";
  return proxyTradingUpstreamJson(path);
}
