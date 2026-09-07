import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { AgentFeedbackProgressResponseDto } from "@/types/trading-api";

import {
  createMarketSnapshotRequestTimeout,
  hasResponseForRequestedMarketDate,
  isEodPipelineStatusTransientError,
  getEodPipelineStatusMonitorAwarePollDelayMs,
  getEodPipelineStatusPollDelayMsWithTransientErrors,
  selectAgentFeedbackProgressForMarketDate,
  selectSignalDeciderFeedbackForMarketDate,
  shouldSeedInitialMarketSnapshot,
  shouldSeedInitialTrackedSnapshot,
} from "./use-live-dashboard-data";

type MarketSnapshotTimeoutOptions = NonNullable<Parameters<typeof createMarketSnapshotRequestTimeout>[0]>;
type MarketSnapshotTimeoutApi = NonNullable<MarketSnapshotTimeoutOptions["timeoutApi"]>;

function buildMarketSnapshotTimeoutApi() {
  let clearCount = 0;
  let scheduledDelay: number | null = null;
  let timeoutCallback: (() => void) | null = null;
  const timeoutApi = {
    clearTimeout: (() => {
      clearCount += 1;
    }) as MarketSnapshotTimeoutApi["clearTimeout"],
    setTimeout: ((callback: () => void, delay?: number) => {
      timeoutCallback = callback;
      scheduledDelay = delay ?? null;
      return 1;
    }) as MarketSnapshotTimeoutApi["setTimeout"],
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

test("does not seed unavailable dashboard sentinels into shared trading snapshots", () => {
  assert.equal(
    shouldSeedInitialMarketSnapshot({
      state: "UNAVAILABLE",
      is_open: false,
      server_time: null,
    }),
    false,
  );
  assert.equal(
    shouldSeedInitialTrackedSnapshot({
      market_state: "unavailable",
      as_of: null,
      items: [],
    }),
    false,
  );
  assert.equal(
    shouldSeedInitialMarketSnapshot({
      state: "CLOSED",
      is_open: false,
      server_time: "2026-04-27T16:00:00+09:00",
    }),
    true,
  );
  assert.equal(
    shouldSeedInitialTrackedSnapshot({
      market_state: "closed",
      as_of: "2026-04-27T16:00:00+09:00",
      items: [],
    }),
    true,
  );
});

test("rejects signal-decider payloads whose rows do not match the requested dashboard date", () => {
  const feedback = {
    request: {
      market_date: "2026-04-30",
      symbols: [],
      agent_name: "signal-decider",
      limit: 200,
    },
    summary: { count: 1 },
    items: [
      {
        market_date: "2026-04-29",
        symbol: "005930",
        agent: { name: "signal-decider", run_id: "run-stale" },
        feedback: {
          role: "signal-decider",
          symbol: "005930",
          market_date: "2026-04-29",
          preferred_action: "wait",
        },
      },
    ],
  };

  assert.equal(selectSignalDeciderFeedbackForMarketDate(feedback, "2026-04-30"), null);
});

test("rejects dashboard agent progress reported for a different market date", () => {
  const staleProgress = {
    request: { market_date: "2026-04-29" },
    result: { market_date: "2026-04-29" },
  } as unknown as AgentFeedbackProgressResponseDto;

  assert.equal(selectAgentFeedbackProgressForMarketDate(staleProgress, "2026-04-30"), null);
  assert.equal(selectAgentFeedbackProgressForMarketDate(staleProgress, "2026-04-29"), staleProgress);
});

test("aborts stalled market snapshot requests when the timeout elapses", () => {
  const timeout = buildMarketSnapshotTimeoutApi();
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
  const timeout = buildMarketSnapshotTimeoutApi();
  const requestTimeout = createMarketSnapshotRequestTimeout({
    timeoutApi: timeout.timeoutApi,
    timeoutMs: 123,
  });

  requestTimeout.clear();
  requestTimeout.clear();

  assert.equal(timeout.clearCount, 1);
  assert.equal(requestTimeout.signal.aborted, false);
});

test("wires the market snapshot poll through its BFF path and request timeout", () => {
  const sourcePath = new URL("./use-live-dashboard-data.ts", import.meta.url);
  const source = readFileSync(sourcePath, "utf8");

  assert.match(source, /const MARKET_SNAPSHOT_PATH = "\/api\/trading\/market\/snapshot";/);
  assert.match(
    source,
    /const snapshot = await getJsonNoCache<MarketSnapshotResponseDto>\(MARKET_SNAPSHOT_PATH, \{\s*signal: requestTimeout\.signal,\s*\}\);/,
  );
  assert.match(source, /requestTimeout\.clear\(\);/);
  assert.match(source, /inFlightRequest\?\.abort\(\);/);
  assert.match(source, /getMarketSnapshotPollDelayMs\(\{/);
});

test("expected dashboard API outages do not trigger the framework error overlay", () => {
  const sourcePath = new URL("./use-live-dashboard-data.ts", import.meta.url);
  const source = readFileSync(sourcePath, "utf8");

  assert.doesNotMatch(source, /console\.error\(/);
  assert.match(source, /console\.warn\("Dashboard market snapshot load failed"/);
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

test("rejects non-fallback snapshots whose actual dates do not match the requested market date", () => {
  assert.equal(
    hasResponseForRequestedMarketDate(
      {
        market_date: "2026-04-26",
        requested_market_date: "2026-04-27",
        resolved_market_date: "2026-04-26",
        is_latest_fallback: false,
      },
      "2026-04-27",
    ),
    false,
  );
});

test("detects transient EOD pipeline status timeout failures", () => {
  assert.equal(isEodPipelineStatusTransientError(new Error("HTTP 504 from /api/trading/eod/pipeline/status")), true);
  assert.equal(isEodPipelineStatusTransientError(new Error("EOD pipeline status request timed out after 1000ms.")), true);
  assert.equal(
    isEodPipelineStatusTransientError(
      Object.assign(new Error("signal is aborted without reason"), { name: "AbortError" }),
    ),
    true,
  );
  assert.equal(isEodPipelineStatusTransientError(new Error("The operation was aborted.")), true);
  assert.equal(isEodPipelineStatusTransientError(new Error("HTTP 502 from /api/trading/eod/pipeline/status")), false);
  assert.equal(isEodPipelineStatusTransientError(new Error("Unexpected parse error")), false);
  assert.equal(isEodPipelineStatusTransientError("string-error"), false);
});

test("uses a longer retry delay only for transient pipeline status errors", () => {
  const runningStatus = {
    market_date: "2026-04-30",
    status: "running",
    stage_order: ["price_collection"],
    stages: {
      price_collection: {
        status: "running",
        processed: 1,
        total: 10,
        failed: 0,
      },
    },
  } satisfies Parameters<typeof getEodPipelineStatusPollDelayMsWithTransientErrors>[0]["pipelineStatus"];

  const idleStatus = {
    market_date: "2026-04-30",
    status: "completed",
    stage_order: ["price_collection"],
    stages: {
      price_collection: {
        status: "completed",
        processed: 10,
        total: 10,
        failed: 0,
      },
    },
  } satisfies Parameters<typeof getEodPipelineStatusPollDelayMsWithTransientErrors>[0]["pipelineStatus"];

  assert.equal(
    getEodPipelineStatusPollDelayMsWithTransientErrors({
      pipelineStatus: runningStatus,
      timeoutErrorCount: 0,
    }),
    1_000,
  );
  assert.equal(
    getEodPipelineStatusPollDelayMsWithTransientErrors({
      pipelineStatus: runningStatus,
      timeoutErrorCount: 1,
    }),
    2_000,
  );
  assert.equal(
    getEodPipelineStatusPollDelayMsWithTransientErrors({
      pipelineStatus: runningStatus,
      timeoutErrorCount: 3,
    }),
    10_000,
  );
  assert.equal(
    getEodPipelineStatusPollDelayMsWithTransientErrors({
      pipelineStatus: idleStatus,
      timeoutErrorCount: 3,
    }),
    30_000,
  );
});

test("keeps monitor-open polling fast only while transient pipeline status polling is healthy", () => {
  const runningStatus = {
    market_date: "2026-04-30",
    status: "running",
    stage_order: ["price_collection"],
    stages: {
      price_collection: {
        status: "running",
        processed: 1,
        total: 10,
        failed: 0,
      },
    },
  } satisfies Parameters<typeof getEodPipelineStatusMonitorAwarePollDelayMs>[0]["pipelineStatus"];

  const idleStatus = {
    market_date: "2026-04-30",
    status: "completed",
    stage_order: ["price_collection"],
    stages: {
      price_collection: {
        status: "completed",
        processed: 10,
        total: 10,
        failed: 0,
      },
    },
  } satisfies Parameters<typeof getEodPipelineStatusMonitorAwarePollDelayMs>[0]["pipelineStatus"];

  assert.equal(
    getEodPipelineStatusMonitorAwarePollDelayMs({
      pipelineStatus: idleStatus,
      processMonitorOpen: true,
      timeoutErrorCount: 0,
    }),
    2_000,
  );
  assert.equal(
    getEodPipelineStatusMonitorAwarePollDelayMs({
      pipelineStatus: runningStatus,
      processMonitorOpen: false,
      timeoutErrorCount: 0,
    }),
    1_000,
  );
  assert.equal(
    getEodPipelineStatusMonitorAwarePollDelayMs({
      pipelineStatus: runningStatus,
      processMonitorOpen: true,
      timeoutErrorCount: 2,
    }),
    5_000,
  );
  assert.equal(
    getEodPipelineStatusMonitorAwarePollDelayMs({
      pipelineStatus: runningStatus,
      processMonitorOpen: true,
      timeoutErrorCount: 3,
    }),
    10_000,
  );
});

test("loads pipeline status with a request timeout signal and quiet transient error handling", () => {
  const sourcePath = new URL("./use-live-dashboard-data.ts", import.meta.url);
  const source = readFileSync(sourcePath, "utf8");

  assert.match(
    source,
    /const currentPipelineStatus = await getJsonNoCache<EodPipelineStatusResponseDto>\(pipelineStatusPath, {\s*signal: currentRequestTimeout\.signal,\s*}\);/,
  );
  assert.match(
    source,
    /const latestCompletedRequestTimeout = createEodPipelineStatusRequestTimeout\(\);/,
  );
  assert.match(
    source,
    /signal: latestCompletedRequestTimeout\.signal/,
  );
  assert.match(source, /isEodPipelineStatusTransientError\(pipelineStatusError\)/);
  assert.match(source, /const \[pipelineStatusError, setPipelineStatusError\] = useState<string \| null>/);
  assert.match(source, /setPipelineStatusError\(getDashboardLoadErrorMessage\(pipelineStatusError\)\);/);
  assert.match(source, /pipelineStatusError,/);
  assert.match(
    source,
    /console\.warn\(\s*["']Dashboard EOD pipeline status load timed out, continuing to retry["']\s*,/,
  );
  assert.match(
    source,
    /getEodPipelineStatusMonitorAwarePollDelayMs\({\s*pipelineStatus: nextPipelineStatus,\s*processMonitorOpen,\s*timeoutErrorCount,\s*}\)/,
  );
});

test("uses one pipeline status polling owner with a 2s monitor-open cadence", () => {
  const sourcePath = new URL("./use-live-dashboard-data.ts", import.meta.url);
  const source = readFileSync(sourcePath, "utf8");

  assert.match(source, /const EOD_PIPELINE_STATUS_MONITOR_POLL_MS = 2_000;/);
  assert.match(source, /processMonitorOpen = false/);
  assert.match(
    source,
    /getEodPipelineStatusMonitorAwarePollDelayMs\({\s*pipelineStatus: nextPipelineStatus,\s*processMonitorOpen,\s*timeoutErrorCount,\s*}\)/,
  );
  assert.match(
    source,
    /\}, \[freshness, latestCompletedPipelineStatusPath, pipelineRequestMarketDate, pipelineStatusPath, processMonitorOpen\]\);/,
  );
  assert.equal((source.match(/getJsonNoCache<EodPipelineStatusResponseDto>\(pipelineStatusPath/g) ?? []).length, 1);
});

test("wires daily process drawer open state to restart and stop fast pipeline polling", () => {
  const sourcePath = new URL("../../app/dashboard/live-dashboard-client.tsx", import.meta.url);
  const source = readFileSync(sourcePath, "utf8");

  assert.match(
    source,
    /const \[processMonitorDrawerOpen, setProcessMonitorDrawerOpen\] = useState\(false\);[\s\S]*?useLiveDashboardData\(/,
  );
  assert.match(source, /processMonitorOpen: processMonitorDrawerOpen/);
  assert.match(
    source,
    /setProcessMonitorDrawerClosing\(false\);\s*setProcessMonitorDrawerOpen\(true\);/,
  );
  assert.match(
    source,
    /setProcessMonitorDrawerOpen\(false\);\s*setProcessMonitorDrawerClosing\(true\);/,
  );
  assert.doesNotMatch(source, /processMonitorOpen: processMonitorDrawerMounted/);
});

test("loads dashboard signal-decider progress and feedback without the generic cached timeout helper", () => {
  const sourcePath = new URL("./use-live-dashboard-data.ts", import.meta.url);
  const source = readFileSync(sourcePath, "utf8");

  assert.match(source, /const data = await getJsonNoCache<AgentFeedbackProgressResponseDto>\(progressPath\);/);
  assert.doesNotMatch(source, /getJson<AgentFeedbackProgressResponseDto>\(progressPath\)/);
  assert.match(source, /getJsonNoCache<AgentFeedbackListResponseDto>\(feedbackPath\)/);
  assert.match(source, /getJsonNoCache<AgentFeedbackListResponseDto>\(latestFeedbackPath\)/);
  assert.match(source, /getLatestActionMarketDate\(freshness\)/);
  assert.match(source, /resolveSignalDeciderLatestFeedbackMarketDate\(\{/);
  assert.match(source, /latestSignalDeciderFeedbackMarketDate !== normalizeMarketDateKey\(agentProgressMarketDate\)/);
  assert.match(source, /marketDate: latestSignalDeciderFeedbackMarketDate,/);
});

test("avoids immediate duplicated signal-decider feedback loads on hydrated dashboard payloads", () => {
  const sourcePath = new URL("./use-live-dashboard-data.ts", import.meta.url);
  const source = readFileSync(sourcePath, "utf8");

  assert.match(source, /const initialSignalDeciderFeedbackMarketDate = normalizeMarketDateKey\(/);
  assert.match(
    source,
    /selectSignalDeciderFeedbackForMarketDate\(\s*initialSignalDeciderFeedback,\s*initialSignalDeciderFeedbackMarketDate,\s*\)/,
  );
  assert.match(
    source,
    /const shouldSkipSignalDeciderFeedbackInitialLoad =\s*initialSignalDeciderFeedbackMarketDateRef.current !== null &&\s*initialSignalDeciderFeedbackMarketDateRef\.current === normalizeMarketDateKey\(agentProgressMarketDate\);/,
  );
  assert.match(
    source,
    /if \(shouldSkipSignalDeciderFeedbackInitialLoad\) {\s*[\s\S]*?scheduleNextLoad\(false\);/s,
  );
  assert.match(
    source,
    /if \(shouldSkipSignalDeciderFeedbackInitialLoad\) {\s*initialSignalDeciderFeedbackMarketDateRef\.current = null;/s,
  );
});

test("loads portfolio summary client-side and preserves loading state when SSR did not provide summary data", () => {
  const sourcePath = new URL("./use-live-dashboard-data.ts", import.meta.url);
  const source = readFileSync(sourcePath, "utf8");

  assert.match(
    source,
    /const \[portfolioSummary, setPortfolioSummary\] = useState<PortfolioSummaryDto \| null>\(initialPortfolioSummary\);/,
  );
  assert.match(
    source,
    /const \[portfolioSummaryLoadState, setPortfolioSummaryLoadState\] = useState<\"error\" \| \"loading\" \| \"success\">\(\r?\n\s*initialPortfolioSummary \? \"success\" : \"loading\",\s*\);/,
  );
  assert.match(
    source,
    /const loadPortfolioSummary = async \(\) => \{[\s\S]*?const summary = await getJsonNoCache<PortfolioSummaryDto>\(PORTFOLIO_SUMMARY_PATH\);[\s\S]*?setPortfolioSummary\(summary\);/,
  );
  assert.match(source, /void loadPortfolioSummary\(\);/);
  assert.match(source, /const timer = window\.setInterval\(loadPortfolioSummary, 60_000\);/);
});
