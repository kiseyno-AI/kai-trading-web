import { NextRequest } from "next/server";

import { proxyTradingUpstreamJson } from "@/lib/trading-upstream";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const path = query ? `/eod/value-factors?${query}` : "/eod/value-factors";
  return proxyTradingUpstreamJson(path);
}
