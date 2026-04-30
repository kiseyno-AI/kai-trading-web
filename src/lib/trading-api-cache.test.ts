import assert from "node:assert/strict";
import test from "node:test";

import { getTradingApiJsonResult } from "./trading-api-cache";

function createAbortAwareFetch() {
  let requestCount = 0;
  let latestSignal: AbortSignal | null = null;

  const fetchMock = ((_input: RequestInfo | URL, init?: RequestInit) => {
    requestCount += 1;
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
    getRequestCount: () => requestCount,
  };
}

test("getTradingApiJsonResult resolves a hanging browser read as a 504 timeout result", async (t) => {
  const originalFetch = globalThis.fetch;
  const fetchState = createAbortAwareFetch();

  globalThis.fetch = fetchState.fetchMock;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await getTradingApiJsonResult<{ items: unknown[] }>(
    "/api/trading/symbols/search?q=005930&limit=20",
    undefined,
    { timeoutMs: 10 },
  );

  assert.equal(fetchState.getRequestCount(), 1);
  assert.equal(fetchState.getLatestSignal()?.aborted, true);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("Expected timeout result to be an error.");
  assert.equal(result.status, 504);
  assert.match(result.message ?? "", /timed out after 10ms/i);
});
