import { NextRequest, NextResponse } from "next/server";

import {
  SIGNAL_DECIDER_AGENT_NAME,
  resolveDeciderAgentName,
} from "@/lib/signal-decider-feedback";
import {
  enrichSignalDeciderFeedbackListWithSymbolMetadata,
  resolveSymbolNameFromSearchEndpoint,
} from "@/lib/signal-decider-feedback-enrichment";
import { proxyTradingUpstreamJson } from "@/lib/trading-upstream";
import type { AgentFeedbackListResponseDto } from "@/types/trading-api";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const path = query ? `/agent-context/feedback?${query}` : "/agent-context/feedback";
  const upstreamResponse = await proxyTradingUpstreamJson(path);

  if (upstreamResponse.status !== 200) {
    return upstreamResponse;
  }

  const headers = new Headers(upstreamResponse.headers);
  const responseText = await upstreamResponse.text();

  if (!responseText) {
    return new NextResponse(responseText, {
      headers,
      status: upstreamResponse.status,
    });
  }

  let responsePayload: AgentFeedbackListResponseDto;
  try {
    responsePayload = JSON.parse(responseText) as AgentFeedbackListResponseDto;
  } catch {
    return new NextResponse(responseText, {
      headers,
      status: upstreamResponse.status,
    });
  }

  const requestedAgentName = request.nextUrl.searchParams.get("agent_name");
  const shouldEnrich =
    resolveDeciderAgentName(requestedAgentName ?? responsePayload.request?.agent_name ?? null) === SIGNAL_DECIDER_AGENT_NAME;
  if (!shouldEnrich) {
    return new NextResponse(responseText, {
      headers,
      status: upstreamResponse.status,
    });
  }

  const enrichedResponse = await enrichSignalDeciderFeedbackListWithSymbolMetadata({
    response: responsePayload,
    resolveSymbolName: resolveSymbolNameFromSearchEndpoint,
  });

  return new NextResponse(JSON.stringify(enrichedResponse), {
    headers,
    status: upstreamResponse.status,
  });
}
