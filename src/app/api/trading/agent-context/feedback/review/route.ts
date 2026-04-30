import { NextRequest } from "next/server";

import { proxyTradingUpstreamJson } from "@/lib/trading-upstream";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const path = query ? "/agent-context/feedback/review?".concat(query) : "/agent-context/feedback/review";

  return proxyTradingUpstreamJson(path);
}
