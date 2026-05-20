import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFactorFamilySnapshotResult,
  buildFactorInspectPath,
  extractFactorInspectItems,
  getAdvancedValueFactorStatusDescriptor,
  getBetaFactorStatusDescriptor,
  getFactorStatusLabel,
  getLowRiskFactorStatusDescriptor,
  getMomentumFactorStatusDescriptor,
  getUnifiedValueStatusDescriptor,
  getValueFactorStatusDescriptor,
  isLowRiskTradingValueUnavailable,
  resolveLowRiskTradingValueStatus,
  hasUnifiedValueFields,
  pickFactorInspectItem,
  resolveUnifiedValueStatusCode,
} from "./factor-snapshot";

test("buildFactorInspectPath uses the core read contract for each factor family", () => {
  assert.equal(
    buildFactorInspectPath("momentum", { marketDate: "2026-04-24", symbol: "005930" }),
    "/api/trading/eod/momentum-factors?market_date=2026-04-24&symbols=005930&limit=1",
  );
  assert.equal(
    buildFactorInspectPath("lowRisk", { marketDate: "2026-04-24", symbol: "005930" }),
    "/api/trading/eod/low-risk-factors?market_date=2026-04-24&symbol=005930",
  );
  assert.equal(
    buildFactorInspectPath("beta", { marketDate: "2026-04-24", symbol: "005930" }),
    "/api/trading/eod/beta-factors?market_date=2026-04-24&symbol=005930",
  );
  assert.equal(
    buildFactorInspectPath("value", { marketDate: "2026-04-24", symbol: "005930" }),
    "/api/trading/eod/value-factors?market_date=2026-04-24&symbol=005930",
  );
  assert.equal(
    buildFactorInspectPath("advancedValue", { marketDate: "2026-04-24", symbol: "005930" }),
    "/api/trading/eod/advanced-value-factors?market_date=2026-04-24&symbol=005930",
  );
});

test("pickFactorInspectItem prefers the matching symbol and tolerates item plus items payloads", () => {
  const response = {
    item: {
      symbol: "000660",
      market_date: "2026-04-24",
      value_score: 0.41,
      value_status: "scored",
    },
    items: [
      {
        symbol: "005930",
        market_date: "2026-04-24",
        value_score: 0.92,
        value_status: "scored",
      },
      {
        symbol: "000660",
        market_date: "2026-04-24",
        value_score: 0.41,
        value_status: "scored",
      },
    ],
  };

  assert.equal(extractFactorInspectItems(response).length, 2);
  assert.deepEqual(pickFactorInspectItem(response, "005930"), response.items[0]);
});

test("buildFactorFamilySnapshotResult keeps per-family HTTP failures isolated", () => {
  const snapshot = buildFactorFamilySnapshotResult(
    "beta",
    "2026-04-24",
    "005930",
    "/api/trading/eod/beta-factors?market_date=2026-04-24&symbol=005930",
    { ok: false, message: null, status: 502 },
  );

  assert.deepEqual(snapshot, {
    family: "beta",
    path: "/api/trading/eod/beta-factors?market_date=2026-04-24&symbol=005930",
    ok: false,
    status: 502,
    requestedMarketDate: "2026-04-24",
    marketDate: null,
    featureVersion: null,
    summary: null,
    item: null,
    items: [],
    error: "HTTP 502",
  });
});

test("factor status helpers preserve explainable family-specific states", () => {
  assert.deepEqual(
    getMomentumFactorStatusDescriptor({
      symbol: "005930",
      market_date: "2026-04-24",
      close_price: 72000,
      ma_60: 70000,
      ma_120: 68000,
      momentum_12_1: 0.24,
      return_5d: 0.17,
      has_sufficient_history: true,
      is_price_above_ma120: true,
      is_ma60_above_ma120: true,
      is_recent_overheated: true,
      momentum_rank: 8,
      momentum_percentile: 0.98,
      is_momentum_eligible: false,
      factor_payload: null,
      captured_at: null,
    }),
    { code: "overheated", tone: "warning" },
  );

  assert.deepEqual(
    getLowRiskFactorStatusDescriptor({
      symbol: "005930",
      market_date: "2026-04-24",
      volatility_60d: 0.12,
      volatility_120d: 0.15,
      max_drawdown_120d: -0.18,
      avg_trading_value_20d: 125000000,
      volatility_60d_rank: 10,
      volatility_120d_rank: 15,
      max_drawdown_120d_rank: 9,
      liquidity_rank: 180,
      volatility_60d_percentile: 0.91,
      volatility_120d_percentile: 0.88,
      max_drawdown_120d_percentile: 0.9,
      liquidity_percentile: 0.03,
      passes_liquidity_floor: false,
      low_risk_score: 0.71,
      low_risk_classification: "liquidity_excluded",
      is_low_risk_eligible: false,
      history_days_available: 250,
      factor_payload: null,
      captured_at: null,
    }),
    { code: "liquidity_excluded", tone: "warning" },
  );

  assert.deepEqual(
    getBetaFactorStatusDescriptor({
      symbol: "005930",
      market_date: "2026-04-24",
      benchmark_id: "KOSPI_EQW",
      benchmark_market: "KOSPI",
      beta_60d: 0.71,
      beta_120d: 0.82,
      beta_60d_rank: 18,
      beta_120d_rank: 32,
      beta_60d_percentile: 0.84,
      beta_120d_percentile: 0.77,
      low_beta_score: 0.8,
      low_beta_classification: "watchlist",
      is_low_beta_eligible: false,
      history_days_available: 180,
      factor_payload: null,
      captured_at: null,
    }),
    { code: "watchlist", tone: "info" },
  );

  assert.deepEqual(
    getValueFactorStatusDescriptor({
      symbol: "005930",
      market_date: "2026-04-24",
      per: -4.2,
      pbr: 1.1,
      dividend_yield: 0.021,
      per_status: "invalid_non_positive",
      per_rank: null,
      pbr_rank: 35,
      dividend_yield_rank: 12,
      per_percentile: null,
      pbr_percentile: 0.79,
      dividend_yield_percentile: 0.95,
      value_score: null,
      value_rank: null,
      value_percentile: null,
      value_status: "invalid_per",
      factor_payload: null,
      captured_at: null,
    }),
    { code: "invalid_per", tone: "warning" },
  );

  const unifiedValueItem = {
    symbol: "005930",
    market_date: "2026-04-24",
    per: -4.2,
    pbr: 1.1,
    dividend_yield: 0.021,
    per_status: "invalid_non_positive",
    per_rank: null,
    pbr_rank: 35,
    dividend_yield_rank: 12,
    per_percentile: null,
    pbr_percentile: 0.79,
    dividend_yield_percentile: 0.95,
    value_score: null,
    value_rank: null,
    value_percentile: null,
    value_status: "invalid_per",
    unified_value_score: null,
    unified_value_rank: null,
    unified_value_percentile: null,
    unified_value_status: "invalid_per",
    factor_payload: null,
    captured_at: null,
  };

  assert.equal(hasUnifiedValueFields(unifiedValueItem), true);
  assert.equal(resolveUnifiedValueStatusCode(unifiedValueItem), "invalid_per");
  assert.deepEqual(getValueFactorStatusDescriptor(unifiedValueItem), { code: "invalid_per", tone: "warning" });
  assert.deepEqual(getUnifiedValueStatusDescriptor("insufficient_fundamentals"), {
    code: "insufficient_fundamentals",
    tone: "warning",
  });
  assert.equal(getFactorStatusLabel("invalid_per"), "PER excluded");

  assert.deepEqual(
    getAdvancedValueFactorStatusDescriptor({
      symbol: "005930",
      market_date: "2026-04-24",
      market_cap_proxy: 120000000000,
      enterprise_value: 150000000000,
      ebitda: null,
      free_cash_flow: 4200000000,
      fcf_yield: 0.035,
      ev_to_ebitda: null,
      fcf_yield_status: "available",
      ev_to_ebitda_status: "missing_depreciation_and_amortization",
      fcf_yield_valid_for_scoring: true,
      ev_to_ebitda_valid_for_scoring: false,
      fcf_yield_rank: 22,
      ev_to_ebitda_rank: null,
      fcf_yield_percentile: 0.83,
      ev_to_ebitda_percentile: null,
      advanced_value_score: null,
      advanced_value_rank: null,
      advanced_value_percentile: null,
      advanced_value_components_used: 1,
      advanced_value_classification: "insufficient_components",
      is_advanced_value_eligible: false,
      factor_payload: null,
      captured_at: null,
    }),
    { code: "insufficient_components", tone: "warning" },
  );
});

test("low-risk trading value status is resolved from factor payload status aliases", () => {
  const payload = {
    avg_trading_value_20d: 0,
    factor_payload: {
      avg_trading_value_20d_status: "missing",
      avg_trading_value_20d_source: "fallback",
    },
  };

  assert.equal(resolveLowRiskTradingValueStatus(payload), "missing");
  assert.equal(isLowRiskTradingValueUnavailable(payload), true);
});

test("low-risk trading value is considered available only when positive and status is not unavailable-like", () => {
  const payload = {
    avg_trading_value_20d: 325000000,
    factor_payload: {
      avg_trading_value_20d_status: "available",
      avg_trading_value_20d_source: "confirmed",
    },
  };

  assert.equal(resolveLowRiskTradingValueStatus(payload), "available");
  assert.equal(isLowRiskTradingValueUnavailable(payload), false);
});

test("low-risk trading value unavailable states include estimated and needs-confirmation markers", () => {
  const estimatedPayload = {
    avg_trading_value_20d: 120000000,
    factor_payload: {
      avg_trading_value_20d_status: "estimated_from_partial",
    },
  };
  const confirmPayload = {
    avg_trading_value_20d: 120000000,
    factor_payload: {
      avg_trading_value_20d_status: "needs confirmation",
    },
  };

  assert.equal(isLowRiskTradingValueUnavailable(estimatedPayload), true);
  assert.equal(isLowRiskTradingValueUnavailable(confirmPayload), true);
});
