import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import ts from "typescript";

import {
  createMarketSnapshotRequestTimeout,
  hasResponseForRequestedMarketDate,
} from "./use-live-dashboard-data";

type TimeoutOptions = NonNullable<Parameters<typeof createMarketSnapshotRequestTimeout>[0]>;
type TimeoutApi = NonNullable<TimeoutOptions["timeoutApi"]>;

function buildTimeoutApi() {
  let clearCount = 0;
  let scheduledDelay: number | null = null;
  let timeoutCallback: (() => void) | null = null;

  const timeoutApi: TimeoutApi = {
    clearTimeout: (() => {
      clearCount += 1;
    }) as typeof globalThis.clearTimeout,
    setTimeout: ((callback: () => void, timeoutMs?: number) => {
      timeoutCallback = callback;
      scheduledDelay = typeof timeoutMs === "number" ? timeoutMs : null;
      return 1 as ReturnType<typeof globalThis.setTimeout>;
    }) as typeof globalThis.setTimeout,
  };

  return {
    get clearCount() {
      return clearCount;
    },
    get scheduledDelay() {
      return scheduledDelay;
    },
    runTimeout() {
      assert.ok(timeoutCallback, "expected a market snapshot request timeout to be scheduled");
      timeoutCallback();
    },
    timeoutApi,
  };
}

test("aborts stalled market snapshot requests when the timeout elapses", () => {
  const timeout = buildTimeoutApi();
  const requestTimeout = createMarketSnapshotRequestTimeout({
    timeoutApi: timeout.timeoutApi,
    timeoutMs: 123,
  });

  assert.equal(timeout.scheduledDelay, 123);
  assert.equal(requestTimeout.signal.aborted, false);

  timeout.runTimeout();

  assert.equal(requestTimeout.signal.aborted, true);
  assert.match(
    requestTimeout.signal.reason instanceof Error
      ? requestTimeout.signal.reason.message
      : String(requestTimeout.signal.reason),
    /Market snapshot request timed out after 123ms\./,
  );
});

test("clears settled market snapshot request timeouts without aborting the request", () => {
  const timeout = buildTimeoutApi();
  const requestTimeout = createMarketSnapshotRequestTimeout({
    timeoutApi: timeout.timeoutApi,
    timeoutMs: 123,
  });

  requestTimeout.clear();
  requestTimeout.clear();

  assert.equal(timeout.clearCount, 1);
  assert.equal(requestTimeout.signal.aborted, false);
});

test("clears and aborts in-flight market snapshot requests on cleanup", () => {
  const timeout = buildTimeoutApi();
  const requestTimeout = createMarketSnapshotRequestTimeout({
    timeoutApi: timeout.timeoutApi,
    timeoutMs: 123,
  });

  requestTimeout.abort();
  requestTimeout.abort();

  assert.equal(timeout.clearCount, 1);
  assert.equal(requestTimeout.signal.aborted, true);
});

test("requires a requested-date match before reusing latest fallback snapshots", () => {
  const fallbackSnapshot = {
    market_date: "2026-04-24",
    requested_market_date: "2026-04-27",
    resolved_market_date: "2026-04-24",
    is_latest_fallback: true,
  };

  assert.equal(hasResponseForRequestedMarketDate(fallbackSnapshot, "2026-04-27"), true);
  assert.equal(hasResponseForRequestedMarketDate(fallbackSnapshot, "2026-04-28"), false);
  assert.equal(
    hasResponseForRequestedMarketDate(
      {
        market_date: "2026-04-24",
        resolved_market_date: "2026-04-24",
        is_latest_fallback: true,
      },
      "2026-04-27",
    ),
    false,
  );
});

test("continues to reuse non-fallback snapshots that resolve to the requested market date", () => {
  assert.equal(
    hasResponseForRequestedMarketDate(
      {
        market_date: "2026-04-27",
        requested_market_date: null,
        resolved_market_date: "2026-04-27",
        is_latest_fallback: false,
      },
      "2026-04-27",
    ),
    true,
  );
});

test("wires the market snapshot poll fetch through the timeout signal", () => {
  const sourcePath = new URL("./use-live-dashboard-data.ts", import.meta.url);
  const source = readFileSync(sourcePath, "utf8");
  const sourceFile = ts.createSourceFile(
    sourcePath.pathname,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  let marketSnapshotFetchCall: string | null = null;

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "getJsonNoCache" &&
      node.getText(sourceFile).includes("MarketSnapshotResponseDto") &&
      node.getText(sourceFile).includes("MARKET_SNAPSHOT_PATH")
    ) {
      marketSnapshotFetchCall = node.getText(sourceFile);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  assert.ok(marketSnapshotFetchCall, "expected the market snapshot poll fetch call");
  assert.match(marketSnapshotFetchCall, /signal: requestTimeout\.signal/);
  assert.match(source, /requestTimeout\.clear\(\);/);
  assert.match(source, /inFlightRequest\?\.abort\(\);/);
});

test("loads dashboard signal-decider progress and feedback without the generic cached timeout helper", () => {
  const sourcePath = new URL("./use-live-dashboard-data.ts", import.meta.url);
  const source = readFileSync(sourcePath, "utf8");

  assert.match(source, /const data = await getJsonNoCache<AgentFeedbackProgressResponseDto>\(progressPath\);/);
  assert.doesNotMatch(source, /getJson<AgentFeedbackProgressResponseDto>\(progressPath\)/);
  assert.match(source, /getJsonNoCache<AgentFeedbackListResponseDto>\(feedbackPath\)/);
  assert.match(source, /getJsonNoCache<AgentFeedbackListResponseDto>\(latestFeedbackPath\)/);
});
