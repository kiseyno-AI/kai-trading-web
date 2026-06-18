import { NextRequest } from "next/server";

import { proxyTradingUpstreamJson } from "@/lib/trading-upstream";

const AGENT_CONTEXT_FEEDBACK_PROGRESS_TIMEOUT_MS = 15_000;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const path = query ? `/agent-context/feedback/progress?${query}` : "/agent-context/feedback/progress";

  return proxyTradingUpstreamJson(path, undefined, { timeoutMs: AGENT_CONTEXT_FEEDBACK_PROGRESS_TIMEOUT_MS });
}
