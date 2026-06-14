import assert from "node:assert/strict";
import test from "node:test";

import { buildCryptoReadOnlySurfaceModel } from "./crypto-readonly";

test("crypto read-only model keeps missing upstream endpoints pending or unavailable", () => {
  const model = buildCryptoReadOnlySurfaceModel({
    marketOverview: {
      ok: false,
      message: "Not Found",
      status: 404,
    },
    runtimeReadiness: {
      ok: false,
      message: "connect ECONNREFUSED",
      status: 502,
    },
  });

  assert.equal(model.marketSource.state, "pending");
  assert.equal(model.readinessSource.state, "unavailable");
  assert.equal(model.rows.length, 0);
});

test("crypto read-only model merges market and readiness rows without fake fallbacks", () => {
  const model = buildCryptoReadOnlySurfaceModel({
    marketOverview: {
      ok: true,
      data: {
        asOf: "2026-06-14T08:00:00Z",
        items: [
          {
            assetClass: "crypto",
            lastPrice: 95000000,
            marketStatus: "available",
            name: "Bitcoin",
            quoteCurrency: "KRW",
            symbol: "BTC/KRW",
            updatedAt: "2026-06-14T08:00:00Z",
            venue: "UPBIT",
          },
        ],
      },
    },
    runtimeReadiness: {
      ok: true,
      data: {
        items: [
          {
            asset_class: "crypto",
            paper_trading_enabled: true,
            quote_currency: "KRW",
            readiness: "paper_ready",
            symbol: "BTC/KRW",
            venue: "UPBIT",
          },
          {
            readiness: "pending",
            symbol: "ETH/KRW",
            venue: "UPBIT",
          },
        ],
      },
    },
  });

  assert.equal(model.marketSource.state, "ready");
  assert.equal(model.readinessSource.state, "ready");
  assert.equal(model.rows.length, 2);
  assert.deepEqual(
    model.rows.map((row) => [row.pairLabel, row.lastPriceLabel, row.readinessLabel, row.paperStatusLabel]),
    [
      ["BTC/KRW", "95,000,000", "paper_ready", "Paper enabled"],
      ["ETH/KRW", "Unavailable", "pending", "Pending"],
    ],
  );
});

test("crypto read-only model keeps base and quote keyed readiness rows distinct", () => {
  const model = buildCryptoReadOnlySurfaceModel({
    marketOverview: {
      ok: true,
      data: {
        items: [],
      },
    },
    runtimeReadiness: {
      ok: true,
      data: {
        items: [
          {
            baseCurrency: "BTC",
            paperTradingEnabled: true,
            quoteCurrency: "KRW",
            readiness: "paper_ready",
            venue: "UPBIT",
          },
          {
            baseCurrency: "ETH",
            paperTradingEnabled: false,
            quoteCurrency: "KRW",
            readiness: "pending",
            venue: "UPBIT",
          },
        ],
      },
    },
  });

  assert.equal(model.rows.length, 2);
  assert.deepEqual(
    model.rows.map((row) => [row.key, row.pairLabel, row.readinessLabel, row.paperStatusLabel]),
    [
      ["UPBIT:BTC/KRW", "BTC/KRW", "paper_ready", "Paper enabled"],
      ["UPBIT:ETH/KRW", "ETH/KRW", "pending", "Paper disabled"],
    ],
  );
});
