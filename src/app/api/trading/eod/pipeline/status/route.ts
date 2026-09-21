import { EOD_PIPELINE_STATUS_REQUEST_TIMEOUT_MS } from "@/lib/eod-pipeline-status";
import { createInFlightResponseCoalescer } from "@/lib/in-flight-response-coalescer";
import { proxyTradingUpstreamJson } from "@/lib/trading-upstream";

const coalescePipelineStatusResponse = createInFlightResponseCoalescer();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const upstreamPath = query ? `/eod/pipeline/status?${query}` : "/eod/pipeline/status";

  return coalescePipelineStatusResponse(upstreamPath, () =>
    proxyTradingUpstreamJson(
      upstreamPath,
      undefined,
      { timeoutMs: EOD_PIPELINE_STATUS_REQUEST_TIMEOUT_MS },
    ),
  );
}
