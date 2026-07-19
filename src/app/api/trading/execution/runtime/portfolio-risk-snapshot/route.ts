import { EXECUTION_RUNTIME_PORTFOLIO_RISK_SNAPSHOT_UPSTREAM_PATH } from "@/lib/execution-runtime";
import { proxyTradingUpstreamJsonFromRequest } from "@/lib/trading-upstream";

export async function GET(request: Request) {
  return proxyTradingUpstreamJsonFromRequest(request, EXECUTION_RUNTIME_PORTFOLIO_RISK_SNAPSHOT_UPSTREAM_PATH);
}
