import assert from "node:assert/strict";
import test from "node:test";

import {
  getExecutionRuntimeMonitoredSymbolsReadResult,
  getExecutionRuntimeStatusReadResult,
  normalizeExecutionRuntimeDailyBoardResult,
  normalizeExecutionRuntimeMonitoredSymbolsResult,
  normalizeExecutionRuntimeStatusResult,
  selectExecutionRuntimeResponseForMarketDate,
} from "./execution-runtime-read";

test("normalizes execution runtime timeout responses with stable failure kind", () => {
  const result = normalizeExecutionRuntimeStatusResult({
    ok: false,
    message: "Trading API request timed out after 6.0s.",
    status: 504,
  });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("Expected timeout to normalize as a failure.");
  assert.equal(result.kind, "timeout");
  assert.equal(result.status, 504);
  assert.match(result.message, /timed out after 6\.0s/i);
});

test("normalizes invalid execution runtime status payloads", () => {
  const result = normalizeExecutionRuntimeStatusResult({
    ok: true,
    data: {
      mode: "paper",
    } as never,
  });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("Expected malformed status to normalize as a failure.");
  assert.equal(result.kind, "invalid-response");
  assert.equal(result.message, "Execution runtime status response was invalid.");
});

test("accepts execution runtime list payloads with absent or array items", () => {
  const monitoredSymbols = normalizeExecutionRuntimeMonitoredSymbolsResult({
    ok: true,
    data: {
      items: [],
      summary: {
        items_total: 0,
      },
    },
  });
  const dailyBoard = normalizeExecutionRuntimeDailyBoardResult({
    ok: true,
    data: {
      market_date: "2026-04-30",
      summary: {
        items_total: 0,
      },
    },
  });

  assert.equal(monitoredSymbols.ok, true);
  assert.equal(dailyBoard.ok, true);
});

test("selects execution runtime payloads only for the exact requested market date", () => {
  const mondayBoard = {
    market_date: "2026-10-19",
    request: {
      market_date: "2026-10-19",
    },
    items: [],
  };

  assert.equal(
    selectExecutionRuntimeResponseForMarketDate(mondayBoard, "2026-10-19"),
    mondayBoard,
  );
  assert.equal(selectExecutionRuntimeResponseForMarketDate(mondayBoard, "2026-10-16"), null);
  assert.equal(
    selectExecutionRuntimeResponseForMarketDate(
      {
        ...mondayBoard,
        request: {
          market_date: "2026-10-16",
        },
      },
      "2026-10-19",
    ),
    null,
  );
  assert.equal(
    selectExecutionRuntimeResponseForMarketDate(
      {
        request: {
          market_date: "2026-10-19",
        },
        items: [],
      },
      "2026-10-19",
    ),
    null,
  );
});

test("rejects malformed execution runtime activity coverage metadata", () => {
  const result = normalizeExecutionRuntimeDailyBoardResult({
    ok: true,
    data: {
      activity_coverage: {
        status: 0,
      },
      items: [],
      market_date: "2026-10-19",
    } as never,
  });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("Expected malformed activity coverage to normalize as a failure.");
  assert.equal(result.kind, "invalid-response");
});

test("rejects malformed execution runtime market-date metadata", () => {
  const malformedTopLevelDate = normalizeExecutionRuntimeDailyBoardResult({
    ok: true,
    data: {
      items: [],
      market_date: 42,
    } as never,
  });
  const malformedRequestedDate = normalizeExecutionRuntimeMonitoredSymbolsResult({
    ok: true,
    data: {
      items: [],
      market_date: "2026-10-19",
      request: {
        market_date: 42,
      },
    } as never,
  });

  assert.equal(malformedTopLevelDate.ok, false);
  assert.equal(malformedRequestedDate.ok, false);
});

test("rejects malformed execution runtime list payload item containers", () => {
  const result = normalizeExecutionRuntimeMonitoredSymbolsResult({
    ok: true,
    data: {
      items: {
        symbol: "005930",
      },
    } as never,
  });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("Expected malformed list to normalize as a failure.");
  assert.equal(result.kind, "invalid-response");
  assert.equal(result.message, "Execution runtime monitored-symbols response was invalid.");
});

test("rejects malformed execution runtime list items before dashboard rendering", () => {
  const malformedBoardItem = normalizeExecutionRuntimeDailyBoardResult({
    ok: true,
    data: {
      items: [
        {
          status: 42,
          symbol: "005930",
        },
      ],
      market_date: "2026-10-19",
    } as never,
  });
  const malformedMonitoredItem = normalizeExecutionRuntimeMonitoredSymbolsResult({
    ok: true,
    data: {
      items: [
        {
          monitoring_state: 42,
          symbol: "005930",
        },
      ],
      market_date: "2026-10-19",
    } as never,
  });

  assert.equal(malformedBoardItem.ok, false);
  assert.equal(malformedMonitoredItem.ok, false);
});

test("normalizes empty successful execution runtime status JSON as invalid response", async (t) => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => new Response("", { status: 200 })) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await getExecutionRuntimeStatusReadResult();

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("Expected empty JSON to normalize as a failure.");
  assert.equal(result.kind, "invalid-response");
  assert.equal(result.message, "Execution runtime status response was invalid.");
  assert.equal(result.status, null);
});

test("requests a fresh execution runtime status by default", async (t) => {
  const originalFetch = globalThis.fetch;
  let requestedInput: RequestInfo | URL | null = null;

  globalThis.fetch = (async (input) => {
    requestedInput = input;
    return Response.json({
      exec_connected: true,
      paused: true,
      status: "paused",
    });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await getExecutionRuntimeStatusReadResult();

  assert.equal(String(requestedInput), "/api/trading/execution/runtime/status?refresh=true");
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected fresh runtime status to normalize successfully.");
  assert.equal(result.data.paused, true);
  assert.equal(result.data.status, "paused");
});

test("normalizes malformed successful execution runtime monitored-symbols JSON as invalid response", async (t) => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response("{ malformed", {
      headers: {
        "content-type": "application/json",
      },
      status: 200,
    })) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await getExecutionRuntimeMonitoredSymbolsReadResult();

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("Expected malformed JSON to normalize as a failure.");
  assert.equal(result.kind, "invalid-response");
  assert.equal(result.message, "Execution runtime monitored-symbols response was invalid.");
  assert.equal(result.status, null);
});
