import assert from "node:assert/strict";
import test from "node:test";

import { getUserFacingErrorMessage, isRawUpstreamDiagnosticMessage } from "./user-facing-errors";

test("detects raw upstream diagnostics that should stay out of primary UI copy", () => {
  assert.equal(isRawUpstreamDiagnosticMessage("HTTP 504: Timed out after 5.0s while loading /portfolio/summary from trading-core."), true);
  assert.equal(isRawUpstreamDiagnosticMessage("Timed out after 5.0s while loading /agent-context/feedback?limit=200 from trading-core."), true);
  assert.equal(isRawUpstreamDiagnosticMessage("Timed out after 5.0s while loading /eod/freshness from trading-core."), true);
  assert.equal(isRawUpstreamDiagnosticMessage("Runtime failed while reading /execution/runtime/portfolio-risk-snapshot."), true);
});

test("keeps concise product copy while preserving non-diagnostic messages", () => {
  assert.equal(getUserFacingErrorMessage("Broker account values are delayed.", "Unavailable."), "Broker account values are delayed.");
  assert.equal(getUserFacingErrorMessage("HTTP 504 for /api/trading/scanner/tracked-symbols", "Tracked symbols unavailable."), "Tracked symbols unavailable.");
  assert.equal(getUserFacingErrorMessage(null, "Portfolio unavailable."), "Portfolio unavailable.");
});
