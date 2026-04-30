import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getSignalDeciderReviewJson } from "./signal-decider-review-fetch";

test("signal-decider review fetches do not install fixed client abort timers", async (t) => {
  const sourcePath = new URL("./signal-decider-review-fetch.ts", import.meta.url);
  const source = readFileSync(sourcePath, "utf8");
  let requestInit: RequestInit | undefined;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_input, init) => {
    requestInit = init;
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const data = await getSignalDeciderReviewJson<{ ok: boolean }>("/api/trading/agent-context/feedback");

  assert.deepEqual(data, { ok: true });
  assert.equal(requestInit?.signal, undefined);
  assert.doesNotMatch(source, /SIGNAL_DECIDER_REVIEW_REQUEST_TIMEOUT_MS/);
  assert.doesNotMatch(source, /AbortController/);
  assert.doesNotMatch(source, /setTimeout/);
  assert.doesNotMatch(source, /Signal-decider review request timed out after/);
});

test("signal-decider review fetches preserve real HTTP error messages", async (t) => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ message: "upstream feedback failed" }), {
      headers: { "Content-Type": "application/json" },
      status: 503,
    })) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(
    () => getSignalDeciderReviewJson("/api/trading/agent-context/feedback"),
    /upstream feedback failed/,
  );
});
