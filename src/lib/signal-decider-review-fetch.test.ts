import assert from "node:assert/strict";
import test from "node:test";

import { getSignalDeciderReviewJson } from "./signal-decider-review-fetch";

function rejectIfStillPending<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
  const timeout = new Promise<T>((_resolve, reject) => {
    timeoutId = globalThis.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }
  });
}

test("signal-decider review fetches do not install fixed client abort timers by default", async (t) => {
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
});

test("signal-decider review fetches can resolve hanging reads as explicit timeouts", async (t) => {
  let requestInit: RequestInit | undefined;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_input, init) => {
    requestInit = init;
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(Object.assign(new Error("The operation was aborted."), { name: "AbortError" }));
      });
    });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(
    () => getSignalDeciderReviewJson("/api/trading/agent-context/feedback", { timeoutMs: 10 }),
    /Timed out after 10ms while loading \/api\/trading\/agent-context\/feedback\./,
  );
  assert.ok(requestInit?.signal instanceof AbortSignal);
});

test("signal-decider review fetch timeout stays active while response body is read", async (t) => {
  let requestInit: RequestInit | undefined;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_input, init) => {
    requestInit = init;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        init?.signal?.addEventListener(
          "abort",
          () => {
            controller.error(Object.assign(new Error("The operation was aborted."), { name: "AbortError" }));
          },
          { once: true },
        );
      },
    });

    return new Response(body, {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(
    () =>
      rejectIfStillPending(
        getSignalDeciderReviewJson("/api/trading/agent-context/feedback", { timeoutMs: 10 }),
        250,
        "Timed response body read did not abort.",
      ),
    /Timed out after 10ms while loading \/api\/trading\/agent-context\/feedback\./,
  );
  assert.equal(requestInit?.signal instanceof AbortSignal, true);
  assert.equal(requestInit?.signal?.aborted, true);
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
