import assert from "node:assert/strict";
import test from "node:test";

import { GET as getEodPipelineStatus } from "../app/api/trading/eod/pipeline/status/route";

import { createInFlightResponseCoalescer } from "./in-flight-response-coalescer";

test("coalesces concurrent response loads for the same key without caching settled responses", async () => {
  let loadCount = 0;
  let resolveLoad: ((response: Response) => void) | null = null;
  const pendingResponse = new Promise<Response>((resolve) => {
    resolveLoad = resolve;
  });
  const coalesce = createInFlightResponseCoalescer();
  const load = () => {
    loadCount += 1;
    return pendingResponse;
  };

  const firstResponsePromise = coalesce("/eod/pipeline/status?market_date=2026-09-21", load);
  const secondResponsePromise = coalesce("/eod/pipeline/status?market_date=2026-09-21", load);

  assert.equal(loadCount, 1);
  resolveLoad?.(Response.json({ status: "running" }));

  const [firstResponse, secondResponse] = await Promise.all([
    firstResponsePromise,
    secondResponsePromise,
  ]);

  assert.notEqual(firstResponse, secondResponse);
  assert.deepEqual(await firstResponse.json(), { status: "running" });
  assert.deepEqual(await secondResponse.json(), { status: "running" });

  const settledResponse = await coalesce(
    "/eod/pipeline/status?market_date=2026-09-21",
    async () => {
      loadCount += 1;
      return Response.json({ status: "completed" });
    },
  );

  assert.equal(loadCount, 2);
  assert.deepEqual(await settledResponse.json(), { status: "completed" });
});

test("the EOD pipeline status BFF sends one Core request for concurrent identical reads", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.TRADING_API_UPSTREAM_BASE_URL;
  let upstreamRequestCount = 0;
  let resolveUpstreamRequest: ((response: Response) => void) | null = null;
  const pendingUpstreamResponse = new Promise<Response>((resolve) => {
    resolveUpstreamRequest = resolve;
  });

  process.env.TRADING_API_UPSTREAM_BASE_URL = "https://core.example.test";
  globalThis.fetch = (() => {
    upstreamRequestCount += 1;
    return pendingUpstreamResponse;
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) {
      delete process.env.TRADING_API_UPSTREAM_BASE_URL;
    } else {
      process.env.TRADING_API_UPSTREAM_BASE_URL = originalBaseUrl;
    }
  });

  const request = new Request(
    "http://localhost/api/trading/eod/pipeline/status?market_date=2026-09-21",
  );
  const firstResponsePromise = getEodPipelineStatus(request);
  const secondResponsePromise = getEodPipelineStatus(request);

  assert.equal(upstreamRequestCount, 1);
  resolveUpstreamRequest?.(Response.json({ market_date: "2026-09-21", status: "running" }));

  const [firstResponse, secondResponse] = await Promise.all([
    firstResponsePromise,
    secondResponsePromise,
  ]);

  assert.equal(upstreamRequestCount, 1);
  assert.deepEqual(await firstResponse.json(), {
    market_date: "2026-09-21",
    status: "running",
  });
  assert.deepEqual(await secondResponse.json(), {
    market_date: "2026-09-21",
    status: "running",
  });
});

test("does not coalesce responses for different request keys", async () => {
  let loadCount = 0;
  const coalesce = createInFlightResponseCoalescer();
  const load = async () => {
    loadCount += 1;
    return Response.json({ loadCount });
  };

  const [firstDateResponse, secondDateResponse] = await Promise.all([
    coalesce("/eod/pipeline/status?market_date=2026-09-19", load),
    coalesce("/eod/pipeline/status?market_date=2026-09-21", load),
  ]);

  assert.equal(loadCount, 2);
  assert.deepEqual(await firstDateResponse.json(), { loadCount: 1 });
  assert.deepEqual(await secondDateResponse.json(), { loadCount: 2 });
});
