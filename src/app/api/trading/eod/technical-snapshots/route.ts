import { NextRequest } from "next/server";

import { proxyTradingUpstreamJson } from "@/lib/trading-upstream";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const path = query
    ? `/eod/technical-snapshots?${query}`
    : "/eod/technical-snapshots";

  return proxyTradingUpstreamJson(path);
}
