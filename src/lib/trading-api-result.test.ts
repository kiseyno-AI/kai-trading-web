import assert from "node:assert/strict";
import test from "node:test";

import { classifyTradingApiFailure, normalizeTradingApiJsonResult } from "./trading-api-result";

test("classifies common BFF failure states consistently", () => {
  assert.equal(classifyTradingApiFailure({ message: "Not Found", status: 404 }), "endpoint-pending");
  assert.equal(classifyTradingApiFailure({ message: "missing credentials", status: 500 }), "not-configured");
  assert.equal(classifyTradingApiFailure({ message: "Timed out after 5.0s", status: 504 }), "timeout");
  assert.equal(classifyTradingApiFailure({ message: "connect ECONNREFUSED", status: 502 }), "upstream-unavailable");
  assert.equal(classifyTradingApiFailure({ message: "Bad Request", status: 400 }), "http-error");
});

test("normalizes invalid successful BFF payloads without throwing", () => {
  const result = normalizeTradingApiJsonResult(
    {
      data: null,
      ok: true,
    },
    {
      invalidResponseMessage: "Expected object payload.",
      isValidData: (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
    },
  );

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("Expected invalid payload to normalize as a failure.");
  assert.equal(result.kind, "invalid-response");
  assert.equal(result.message, "Expected object payload.");
});
