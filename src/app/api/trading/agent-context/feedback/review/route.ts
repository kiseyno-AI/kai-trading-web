import { NextRequest, NextResponse } from "next/server";

import {
  enrichSignalDeciderReviewDateResponseWithSymbolMetadata,
  resolveSymbolNameFromSearchEndpoint,
} from "@/lib/signal-decider-feedback-enrichment";
import { proxyTradingUpstreamJson } from "@/lib/trading-upstream";
import type { SignalDeciderReviewDateResponse } from "@/lib/signal-decider-feedback";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const path = query ? "/agent-context/feedback/review?".concat(query) : "/agent-context/feedback/review";
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

  let responsePayload: SignalDeciderReviewDateResponse;
  try {
    responsePayload = JSON.parse(responseText) as SignalDeciderReviewDateResponse;
  } catch {
    return new NextResponse(responseText, {
      headers,
      status: upstreamResponse.status,
    });
  }

  const enrichedResponse = await enrichSignalDeciderReviewDateResponseWithSymbolMetadata({
    response: responsePayload,
    resolveSymbolName: resolveSymbolNameFromSearchEndpoint,
  });

  return new NextResponse(JSON.stringify(enrichedResponse), {
    headers,
    status: upstreamResponse.status,
  });
}
