import {
  proxyTradingUpstreamJson,
} from "@/lib/trading-upstream";
import { EOD_PIPELINE_STATUS_REQUEST_TIMEOUT_MS } from "@/lib/eod-pipeline-status";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();

  return proxyTradingUpstreamJson(
    query ? `/eod/pipeline/status?${query}` : "/eod/pipeline/status",
    undefined,
    { timeoutMs: EOD_PIPELINE_STATUS_REQUEST_TIMEOUT_MS },
  );
}
