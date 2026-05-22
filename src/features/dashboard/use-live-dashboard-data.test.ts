import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  hasResponseForRequestedMarketDate,
  isEodPipelineStatusTransientError,
  getEodPipelineStatusPollDelayMsWithTransientErrors,
} from "./use-live-dashboard-data";

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

test("detects transient EOD pipeline status timeout failures", () => {
  assert.equal(isEodPipelineStatusTransientError(new Error("HTTP 504 from /api/trading/eod/pipeline/status")), true);
  assert.equal(isEodPipelineStatusTransientError(new Error("EOD pipeline status request timed out after 1000ms.")), true);
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
  assert.match(
    source,
    /console\.warn\(\s*["']Dashboard EOD pipeline status load timed out, continuing to retry["']\s*,/,
  );
  assert.match(
    source,
    /getEodPipelineStatusPollDelayMsWithTransientErrors\({\s*pipelineStatus: nextPipelineStatus,\s*timeoutErrorCount,\s*}\)/,
  );
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

  assert.ok(
    source.includes(
      "const initialSignalDeciderFeedbackMarketDateRef = useRef<string | null>(\n    normalizeMarketDateKey(initialSignalDeciderFeedback?.request?.market_date),\n  );",
    ),
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
