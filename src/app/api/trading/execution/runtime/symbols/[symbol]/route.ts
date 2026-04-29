import { EXECUTION_RUNTIME_SYMBOL_UPSTREAM_BASE_PATH } from "@/lib/execution-runtime";
import { proxyTradingUpstreamJson } from "@/lib/trading-upstream";

type ExecutionRuntimeSymbolRouteContext = {
  params: Promise<{ symbol: string }>;
};

export async function GET(request: Request, context: ExecutionRuntimeSymbolRouteContext) {
  const { symbol } = await context.params;
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const upstreamPath = `${EXECUTION_RUNTIME_SYMBOL_UPSTREAM_BASE_PATH}/${encodeURIComponent(symbol)}`;

  return proxyTradingUpstreamJson(query ? `${upstreamPath}?${query}` : upstreamPath);
}
