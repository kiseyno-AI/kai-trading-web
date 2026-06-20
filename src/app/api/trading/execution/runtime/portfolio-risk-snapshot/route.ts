import { EXECUTION_RUNTIME_PORTFOLIO_RISK_SNAPSHOT_UPSTREAM_PATH } from "@/lib/execution-runtime";
import { proxyTradingUpstreamJson } from "@/lib/trading-upstream";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();

  return proxyTradingUpstreamJson(
    query
      ? `${EXECUTION_RUNTIME_PORTFOLIO_RISK_SNAPSHOT_UPSTREAM_PATH}?${query}`
      : EXECUTION_RUNTIME_PORTFOLIO_RISK_SNAPSHOT_UPSTREAM_PATH,
  );
}
