import assert from "node:assert/strict";
import test from "node:test";

import { getUserFacingSelectedDateReviewError } from "./signal-decider-calendar-error";

const selectedUnavailable = "Selected date review is unavailable.";

test("maps selected-date review timeout payloads to user-facing unavailable copy", () => {
  const mapped = getUserFacingSelectedDateReviewError({
    errorMessage: "Timed out after 5.0s while loading /agent-context/feedback/review?market_date=2026-05-04&agent_name=signal-decider&limit=200 from trading-core.",
    selectedUnavailable,
    devMode: false,
  });

  assert.equal(mapped, selectedUnavailable);
});

test("keeps endpoint-related API errors out of selected-date render", () => {
  const mapped = getUserFacingSelectedDateReviewError({
    errorMessage: "HTTP 504 for /api/trading/agent-context/feedback/review?market_date=2026-05-04",
    selectedUnavailable,
    devMode: false,
  });

  assert.equal(mapped, selectedUnavailable);
});

test("keeps generic non-endpoint errors when not in dev mode", () => {
  const mapped = getUserFacingSelectedDateReviewError({
    errorMessage: "Temporary service error",
    selectedUnavailable,
    devMode: false,
  });

  assert.equal(mapped, "Temporary service error");
});

test("returns raw error text in dev mode for unknown messages", () => {
  const mapped = getUserFacingSelectedDateReviewError({
    errorMessage: "Unexpected schema mismatch",
    selectedUnavailable,
    devMode: true,
  });

  assert.equal(mapped, "Unexpected schema mismatch");
});
