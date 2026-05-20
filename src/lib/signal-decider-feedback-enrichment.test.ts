import assert from "node:assert/strict";
import test from "node:test";

import type { AgentFeedbackListResponseDto } from "@/types/trading-api";
import type { SignalDeciderReviewDateResponse } from "@/lib/signal-decider-feedback";
import {
  buildSignalDeciderFeedbackListFromReviewDateResponse,
  normalizeSignalDeciderFeedbackItems,
} from "@/lib/signal-decider-feedback";
import {
  enrichSignalDeciderFeedbackListWithSymbolMetadata,
  enrichSignalDeciderReviewDateResponseWithSymbolMetadata,
  resolveSymbolNameFromSearchEndpoint,
} from "./signal-decider-feedback-enrichment";

function buildFeedbackListResponse() {
  return {
    request: {
      market_date: "2026-05-20",
      symbols: [],
      agent_name: "signal-decider",
      limit: 10,
    },
    summary: {
      count: 3,
    },
    items: [
      {
        id: "snapshot-1",
        market_date: "2026-05-20",
        symbol: "139480",
        agent: {
          name: "signal-decider",
          run_id: "run-1",
        },
        summary: {},
        feedback: {
          role: "signal-decider",
          symbol: "139480",
          market_date: "2026-05-20",
          preferred_action: "buy",
          next_day_open_action: "buy",
          confidence_score_10: 7,
          conviction_score_10: 6,
        },
        normalized_feedback: null,
        details: null,
        context: null,
        received_at: "2026-05-20T07:45:00+00:00",
      },
      {
        id: "snapshot-2",
        market_date: "2026-05-20",
        symbol: "004150",
        agent: {
          name: "signal-decider",
          run_id: "run-1",
        },
        summary: {
          company_name: "004150",
        },
        feedback: {
          role: "signal-decider",
          symbol: "004150",
          market_date: "2026-05-20",
          preferred_action: "buy",
          next_day_open_action: "buy",
          confidence_score_10: 5,
          conviction_score_10: 5,
        },
        normalized_feedback: null,
        details: null,
        context: null,
        received_at: "2026-05-20T07:45:00+00:00",
      },
      {
        id: "snapshot-3",
        market_date: "2026-05-20",
        symbol: "035420",
        agent: {
          name: "signal-decider",
          run_id: "run-1",
        },
        summary: {
          company_name: "Naver",
        },
        feedback: {
          role: "signal-decider",
          symbol: "035420",
          market_date: "2026-05-20",
          preferred_action: "buy",
          next_day_open_action: "buy",
          confidence_score_10: 5,
          conviction_score_10: 5,
        },
        normalized_feedback: null,
        details: null,
        context: null,
        received_at: "2026-05-20T07:45:00+00:00",
      },
    ],
  } satisfies AgentFeedbackListResponseDto;
}

function buildReviewDateResponse(symbol = "139480") {
  return {
    request: {
      market_date: "2026-05-20",
    },
    summary: {
      count: 1,
      review_status_counts: {
        reviewed: 1,
      },
    },
    items: [
      {
        snapshot_id: "snapshot-review-1",
        symbol,
        market_date: "2026-05-20",
        run_id: "run-review-1",
        captured_at: "2026-05-20T07:50:00+00:00",
        decision: {
          role: "signal-decider",
          symbol,
          market_date: "2026-05-20",
          preferred_action: "buy",
        },
      },
    ],
  } satisfies SignalDeciderReviewDateResponse;
}

test("resolves missing signal-decider list company names from symbol search", async () => {
  const response = buildFeedbackListResponse();
  const resolvedSymbols: string[] = [];
  const resolveSymbolName = async (symbol: string) => {
    resolvedSymbols.push(symbol);
    if (symbol === "139480") return "한화오션";
    if (symbol === "004150") return "신한은행";
    return null;
  };

  const enriched = await enrichSignalDeciderFeedbackListWithSymbolMetadata({
    response,
    resolveSymbolName,
  });
  const normalized = normalizeSignalDeciderFeedbackItems(enriched);

  assert.equal(normalized.find((item) => item.symbol === "139480")?.companyName, "한화오션");
  assert.equal(normalized.find((item) => item.symbol === "004150")?.companyName, "신한은행");
  assert.equal(normalized.find((item) => item.symbol === "035420")?.companyName, "Naver");
  assert.deepEqual(resolvedSymbols, ["139480", "004150"]);
});

test("keeps explicit unavailable company names for unresolved signal-decider feedback rows", async () => {
  const response = buildFeedbackListResponse();
  const enriched = await enrichSignalDeciderFeedbackListWithSymbolMetadata({
    response,
    resolveSymbolName: async () => null,
  });
  const normalized = normalizeSignalDeciderFeedbackItems(enriched);

  assert.equal(normalized.find((item) => item.symbol === "139480")?.companyName, null);
  assert.equal(normalized.find((item) => item.symbol === "004150")?.companyName, null);
});

test("resolves replay review rows so calendar dialogs show company names", async () => {
  const response = buildReviewDateResponse("139480");
  const enriched = await enrichSignalDeciderReviewDateResponseWithSymbolMetadata({
    response,
    resolveSymbolName: async () => "현대차",
  });
  const feedbackResponse = buildSignalDeciderFeedbackListFromReviewDateResponse({
    response: enriched,
    fallbackMarketDate: "2026-05-20",
  });
  const normalized = normalizeSignalDeciderFeedbackItems(feedbackResponse);

  assert.equal(normalized[0]?.companyName, "현대차");
});

test("keeps replay review rows explicit when symbol search cannot enrich", async () => {
  const response = buildReviewDateResponse("139480");
  const enriched = await enrichSignalDeciderReviewDateResponseWithSymbolMetadata({
    response,
    resolveSymbolName: async () => null,
  });
  const feedbackResponse = buildSignalDeciderFeedbackListFromReviewDateResponse({
    response: enriched,
    fallbackMarketDate: "2026-05-20",
  });
  const normalized = normalizeSignalDeciderFeedbackItems(feedbackResponse);

  assert.equal(normalized[0]?.companyName, null);
});

test("loads company names from /symbols/search endpoint for resolver", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.TRADING_API_UPSTREAM_BASE_URL;
  let requestUrl = "";

  globalThis.fetch = ((input: RequestInfo | URL) => {
    requestUrl = String(input);
    return Promise.resolve(
      new Response(
        JSON.stringify({
          items: [
            { symbol: "139480", company_name: "한화오션" },
            { symbol: "139480", company_name: "139480" },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    ) as Response;
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) {
      delete process.env.TRADING_API_UPSTREAM_BASE_URL;
    } else {
      process.env.TRADING_API_UPSTREAM_BASE_URL = originalBaseUrl;
    }
  });

  process.env.TRADING_API_UPSTREAM_BASE_URL = "https://core.example.test";

  const resolved = await resolveSymbolNameFromSearchEndpoint("139480");

  assert.equal(requestUrl, "https://core.example.test/symbols/search?q=139480&limit=20");
  assert.equal(resolved, "한화오션");
});
