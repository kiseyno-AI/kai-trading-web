import assert from "node:assert/strict";
import test from "node:test";

import {
  getUserFacingSelectedDateReviewError,
  shouldSuppressSelectedDateReviewFallbackError,
} from "./signal-decider-calendar-error";

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

test("suppresses dependency-gap review warnings after fallback rows succeed", () => {
  const suppressed = shouldSuppressSelectedDateReviewFallbackError({
    errorMessage:
      "Calendar index is not a dedicated Core contract yet. This page uses the real generic signal-decider feedback read for each visible date, while a dedicated calendar/replay endpoint is still a dependency gap.",
    devMode: false,
  });

  assert.equal(suppressed, true);
});

test("suppresses review errors when the feedback fallback conclusively returns no rows", () => {
  const suppressed = shouldSuppressSelectedDateReviewFallbackError({
    errorMessage: "Timed out after 5.0s while loading /agent-context/feedback/review from trading-core.",
    devMode: false,
    fallbackResolvedEmpty: true,
  });

  assert.equal(suppressed, true);
});

test("keeps review errors visible when an empty feedback fallback has active progress", () => {
  const suppressed = shouldSuppressSelectedDateReviewFallbackError({
    errorMessage: "Timed out after 5.0s while loading /agent-context/feedback/review from trading-core.",
    devMode: false,
    fallbackProgressActive: true,
    fallbackResolvedEmpty: true,
  });

  assert.equal(suppressed, false);
});

test("keeps review errors visible when an empty feedback fallback contradicts the calendar snapshot", () => {
  const suppressed = shouldSuppressSelectedDateReviewFallbackError({
    calendarHasStoredDecisions: true,
    errorMessage: "Timed out after 5.0s while loading /agent-context/feedback/review from trading-core.",
    devMode: false,
    fallbackResolvedEmpty: true,
  });

  assert.equal(suppressed, false);
});

test("keeps timeout review errors visible after fallback attempts", () => {
  const suppressed = shouldSuppressSelectedDateReviewFallbackError({
    errorMessage: "Timed out after 5.0s while loading /agent-context/feedback/review from trading-core.",
    devMode: false,
  });

  assert.equal(suppressed, false);
});
