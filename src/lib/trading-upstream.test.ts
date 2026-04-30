import assert from "node:assert/strict";
import test from "node:test";

import { proxyTradingUpstreamJson } from "./trading-upstream";

function createAbortAwareFetch() {
  let requestCount = 0;
  let latestUrl = "";
  let latestSignal: AbortSignal | null = null;

  const fetchMock = ((input: RequestInfo | URL, init?: RequestInit) => {
    requestCount += 1;
    latestUrl = String(input);
    latestSignal = init?.signal ?? null;

    return new Promise<Response>((_resolve, reject) => {
      if (!latestSignal) {
        reject(new Error("Expected fetch to receive an AbortSignal."));
        return;
      }

      if (latestSignal.aborted) {
        reject(new DOMException("aborted", "AbortError"));
        return;
      }

      latestSignal.addEventListener(
        "abort",
        () => reject(new DOMException("aborted", "AbortError")),
        { once: true },
      );
    });
  }) as typeof fetch;

  return {
    fetchMock,
    getLatestSignal: () => latestSignal,
    getLatestUrl: () => latestUrl,
    getRequestCount: () => requestCount,
  };
}

test("proxyTradingUpstreamJson returns a bounded 504 response when upstream never resolves", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.TRADING_API_UPSTREAM_BASE_URL;
  const fetchState = createAbortAwareFetch();

  process.env.TRADING_API_UPSTREAM_BASE_URL = "https://core.example.test";
  globalThis.fetch = fetchState.fetchMock;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) {
      delete process.env.TRADING_API_UPSTREAM_BASE_URL;
    } else {
      process.env.TRADING_API_UPSTREAM_BASE_URL = originalBaseUrl;
    }
  });

  const response = await proxyTradingUpstreamJson(
    "/symbols/search?q=005930&limit=20",
    undefined,
    { timeoutMs: 10 },
  );
  const body = (await response.json()) as {
    error?: string;
    message?: string;
    path?: string;
    timeoutMs?: number;
  };

  assert.equal(fetchState.getRequestCount(), 1);
  assert.equal(fetchState.getLatestUrl(), "https://core.example.test/symbols/search?q=005930&limit=20");
  assert.equal(fetchState.getLatestSignal()?.aborted, true);
  assert.equal(response.status, 504);
  assert.equal(response.headers.get("x-kai-trading-upstream-timeout-ms"), "10");
  assert.equal(body.error, "Upstream request timed out");
  assert.equal(body.path, "/symbols/search?q=005930&limit=20");
  assert.equal(body.timeoutMs, 10);
  assert.match(body.message ?? "", /Timed out after 10ms/i);
});
