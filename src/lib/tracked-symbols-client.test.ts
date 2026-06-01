import assert from "node:assert/strict";
import test from "node:test";

import { MOBILE_TOOLBAR_TRACKED_SYMBOLS_PATH } from "./mobile-toolbar-data";
import {
  invalidateTrackedSymbolsCache,
  removeTrackedSymbol,
  type TrackedSymbolsResponse,
} from "./tracked-symbols-client";
import { seedTradingApiJsonCache } from "./trading-api-cache";

test("removeTrackedSymbol refreshes tracked symbols before posting the replacement list", async (t) => {
  const originalFetch = globalThis.fetch;
  const staleTrackedSymbols: TrackedSymbolsResponse = {
    tracked_symbols: ["F70100026", "000660"],
    count: 2,
    last_updated_at: "2026-04-14T15:55:00+09:00",
  };
  const freshTrackedSymbols: TrackedSymbolsResponse = {
    tracked_symbols: ["F70100026", "005930", "035420"],
    count: 3,
    last_updated_at: "2026-04-14T16:00:00+09:00",
  };
  const requestOrder: string[] = [];
  let postedSymbols: string[] | null = null;

  invalidateTrackedSymbolsCache();
  seedTradingApiJsonCache(MOBILE_TOOLBAR_TRACKED_SYMBOLS_PATH, staleTrackedSymbols);

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    requestOrder.push(method);

    if (method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as { symbols?: string[] };
      postedSymbols = body.symbols ?? null;
      return new Response(
        JSON.stringify({
          tracked_symbols: postedSymbols,
          count: postedSymbols?.length ?? 0,
          last_updated_at: "2026-04-14T16:01:00+09:00",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    return new Response(JSON.stringify(freshTrackedSymbols), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
    invalidateTrackedSymbolsCache();
  });

  const result = await removeTrackedSymbol("F70100026");

  assert.deepEqual(requestOrder, ["GET", "POST"]);
  assert.deepEqual(postedSymbols, ["005930", "035420"]);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected removeTrackedSymbol to succeed.");
  assert.deepEqual(result.nextSymbols, ["005930", "035420"]);
});
