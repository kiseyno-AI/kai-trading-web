import { EXECUTION_RUNTIME_DAILY_BOARD_UPSTREAM_PATH } from "@/lib/execution-runtime";
import { proxyTradingUpstreamJsonFromRequest } from "@/lib/trading-upstream";

export async function GET(request: Request) {
  return proxyTradingUpstreamJsonFromRequest(request, EXECUTION_RUNTIME_DAILY_BOARD_UPSTREAM_PATH);
}
