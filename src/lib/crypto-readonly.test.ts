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
    paperRuntime: {
      ok: false,
      message: "Not Found",
      status: 404,
    },
    runtimeReadiness: {
      ok: false,
      message: "connect ECONNREFUSED",
      status: 502,
    },
    strategyOverview: {
      ok: false,
      message: "Not Found",
      status: 404,
    },
  });

  assert.equal(model.marketSource.state, "pending");
  assert.equal(model.readinessSource.state, "unavailable");
  assert.equal(model.strategySource.state, "pending");
  assert.equal(model.paperSource.state, "pending");
  assert.equal(model.rows.length, 0);
  assert.equal(model.strategyPaperRows.length, 0);
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
    paperRuntime: {
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
    strategyOverview: {
      ok: true,
      data: {
        items: [],
      },
    },
  });

  assert.equal(model.marketSource.state, "ready");
  assert.equal(model.readinessSource.state, "ready");
  assert.equal(model.strategySource.state, "pending");
  assert.equal(model.paperSource.state, "pending");
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
    paperRuntime: {
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
    strategyOverview: {
      ok: true,
      data: {
        items: [],
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

test("crypto read-only model merges BTC and ETH strategy plus paper runtime rows by normalized Upbit pair", () => {
  const model = buildCryptoReadOnlySurfaceModel({
    marketOverview: {
      ok: true,
      data: {
        items: [
          {
            assetClass: "crypto",
            lastPrice: 95000000,
            name: "Bitcoin",
            quoteCurrency: "KRW",
            symbol: "BTC/KRW",
            venue: "UPBIT",
          },
        ],
      },
    },
    paperRuntime: {
      ok: true,
      data: {
        items: [
          {
            active_paper_job_count: 1,
            asset_class: "crypto",
            last_heartbeat_at: "2026-06-14T09:15:00Z",
            mode: "paper",
            open_paper_order_count: 0,
            paper_runtime_state: "paper_ready",
            paper_trading_enabled: true,
            provider: "UPBIT",
            readiness: "paper_ready",
            symbol: "KRW-BTC",
            venue: "UPBIT",
          },
          {
            activePaperJobCount: 0,
            mode: "paper",
            openPaperOrderCount: 0,
            paperRuntimeState: "pending",
            paperTradingEnabled: false,
            provider: "UPBIT",
            symbol: "KRW-ETH",
            venue: "UPBIT",
          },
        ],
      },
    },
    runtimeReadiness: {
      ok: true,
      data: {
        items: [],
      },
    },
    strategyOverview: {
      ok: true,
      data: {
        items: [
          {
            assetClass: "crypto",
            invalidationLevel: 91000000,
            momentumScore: 72,
            provider: "core",
            quoteCurrency: "KRW",
            reasons: ["trend confirmed", "liquidity acceptable"],
            readiness: "ready",
            riskTier: "moderate",
            strategyName: "BTC weekend momentum",
            symbol: "KRW-BTC",
            targetLevel: 99000000,
            trendState: "uptrend",
            venue: "UPBIT",
            volatilityTier: "medium",
          },
          {
            asset_class: "crypto",
            momentum_score: "51",
            provider: "core",
            readiness: "pending",
            risk_tier: "high",
            strategy_name: "ETH range watch",
            symbol: "KRW-ETH",
            trend_state: "range",
            venue: "UPBIT",
            volatility_tier: "high",
          },
        ],
      },
    },
  });

  assert.equal(model.strategySource.state, "ready");
  assert.equal(model.paperSource.state, "ready");
  assert.equal(model.rows.length, 2);
  assert.equal(model.strategyPaperRows.length, 2);
  assert.deepEqual(
    model.strategyPaperRows.map((row) => [
      row.key,
      row.pairLabel,
      row.strategyNameLabel,
      row.strategyReadinessLabel,
      row.trendStateLabel,
      row.momentumScoreLabel,
      row.paperRuntimeLabel,
      row.paperStatusLabel,
      row.liveControlsLabel,
    ]),
    [
      [
        "UPBIT:BTC/KRW",
        "BTC/KRW",
        "BTC weekend momentum",
        "ready",
        "uptrend",
        "72",
        "paper_ready",
        "Paper enabled",
        "No web controls",
      ],
      [
        "UPBIT:ETH/KRW",
        "ETH/KRW",
        "ETH range watch",
        "pending",
        "range",
        "51",
        "pending",
        "Paper disabled",
        "No web controls",
      ],
    ],
  );
});
