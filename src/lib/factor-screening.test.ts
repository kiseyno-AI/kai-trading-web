import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFactorScreeningPath,
  filterFactorScreeningRows,
  getFactorScreeningMarketDateNote,
  loadFactorScreeningWorkspace,
  resolveFactorScreeningFamily,
  resolveFactorScreeningMarketDate,
} from "./factor-screening";

test("buildFactorScreeningPath uses market-date list reads for every available family", () => {
  assert.equal(
    buildFactorScreeningPath("momentum", "2026-04-23"),
    "/api/trading/eod/momentum-factors?market_date=2026-04-23",
  );
  assert.equal(
    buildFactorScreeningPath("lowRisk", "2026-04-23"),
    "/api/trading/eod/low-risk-factors?market_date=2026-04-23",
  );
  assert.equal(
    buildFactorScreeningPath("beta", "2026-04-23"),
    "/api/trading/eod/beta-factors?market_date=2026-04-23",
  );
  assert.equal(
    buildFactorScreeningPath("value", "2026-04-23"),
    "/api/trading/eod/value-factors?market_date=2026-04-23",
  );
  assert.equal(
    buildFactorScreeningPath("advancedValue", "2026-04-23"),
    "/api/trading/eod/advanced-value-factors?market_date=2026-04-23",
  );
});

test("loadFactorScreeningWorkspace maps current families into one ranking workspace and keeps the composite slot reserved", async () => {
  const originalFetch = global.fetch;
  const marketDate = "2026-04-23";

  global.fetch = (async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const pathname = new URL(url, "http://kai.local").pathname;

    const bodyByPath: Record<string, unknown> = {
      "/api/trading/eod/momentum-factors": {
        market_date: marketDate,
        feature_version: "momentum_v2",
        summary: {
          entries: 2,
          requested_symbols: [],
          matched_symbols: ["005930", "000660"],
          missing_symbols: [],
          ranked_symbols: 2,
          eligible_symbols: 1,
        },
        items: [
          {
            symbol: "005930",
            name_ko: "Samsung Electronics",
            market: "KOSPI",
            market_date: marketDate,
            close_price: 71000,
            ma_60: 68000,
            ma_120: 65000,
            momentum_12_1: 0.28,
            return_5d: 0.07,
            has_sufficient_history: true,
            is_price_above_ma120: true,
            is_ma60_above_ma120: true,
            is_recent_overheated: false,
            momentum_rank: 3,
            momentum_percentile: 0.97,
            is_momentum_eligible: true,
            factor_payload: null,
            captured_at: null,
          },
          {
            symbol: "000660",
            name_ko: "SK Hynix",
            market: "KOSPI",
            market_date: marketDate,
            close_price: 185000,
            ma_60: 170000,
            ma_120: 160000,
            momentum_12_1: 0.19,
            return_5d: 0.03,
            has_sufficient_history: false,
            is_price_above_ma120: true,
            is_ma60_above_ma120: true,
            is_recent_overheated: false,
            momentum_rank: null,
            momentum_percentile: null,
            is_momentum_eligible: false,
            factor_payload: null,
            captured_at: null,
          },
        ],
      },
      "/api/trading/eod/low-risk-factors": {
        market_date: marketDate,
        feature_version: "low_risk_v1",
        summary: {
          entries: 2,
          requested_symbol: null,
          matched_symbols: ["005930", "035420"],
          missing_symbols: [],
          eligible_count: 1,
          liquidity_floor_pass_count: 2,
          insufficient_history_count: 0,
        },
        items: [
          {
            symbol: "005930",
            name_ko: "Samsung Electronics",
            market: "KOSPI",
            market_date: marketDate,
            volatility_60d: 0.12,
            volatility_120d: 0.15,
            max_drawdown_120d: -0.17,
            avg_trading_value_20d: 125000000,
            volatility_60d_rank: 12,
            volatility_120d_rank: 11,
            max_drawdown_120d_rank: 7,
            liquidity_rank: 160,
            volatility_60d_percentile: 0.92,
            volatility_120d_percentile: 0.9,
            max_drawdown_120d_percentile: 0.89,
            liquidity_percentile: 0.82,
            passes_liquidity_floor: true,
            low_risk_score: 0.91,
            low_risk_classification: "eligible",
            is_low_risk_eligible: true,
            history_days_available: 250,
            factor_payload: null,
            captured_at: null,
          },
          {
            symbol: "035420",
            name_ko: "NAVER",
            market: "KOSPI",
            market_date: marketDate,
            volatility_60d: 0.2,
            volatility_120d: 0.24,
            max_drawdown_120d: -0.29,
            avg_trading_value_20d: 91000000,
            volatility_60d_rank: 80,
            volatility_120d_rank: 75,
            max_drawdown_120d_rank: 81,
            liquidity_rank: 120,
            volatility_60d_percentile: 0.55,
            volatility_120d_percentile: 0.51,
            max_drawdown_120d_percentile: 0.44,
            liquidity_percentile: 0.74,
            passes_liquidity_floor: true,
            low_risk_score: 0.61,
            low_risk_classification: "watchlist",
            is_low_risk_eligible: false,
            history_days_available: 250,
            factor_payload: null,
            captured_at: null,
          },
        ],
      },
      "/api/trading/eod/beta-factors": {
        market_date: marketDate,
        feature_version: "beta_v1",
        summary: {
          entries: 1,
          requested_symbol: null,
          matched_symbols: ["005930"],
          missing_symbols: [],
          eligible_count: 1,
          watchlist_count: 0,
          insufficient_history_count: 0,
        },
        items: [
          {
            symbol: "005930",
            name_ko: "Samsung Electronics",
            market: "KOSPI",
            market_date: marketDate,
            benchmark_id: "KOSPI_EQW",
            benchmark_market: "KOSPI",
            beta_60d: 0.75,
            beta_120d: 0.8,
            beta_60d_rank: 18,
            beta_120d_rank: 22,
            beta_60d_percentile: 0.82,
            beta_120d_percentile: 0.84,
            low_beta_score: 0.85,
            low_beta_classification: "eligible",
            is_low_beta_eligible: true,
            history_days_available: 240,
            factor_payload: null,
            captured_at: null,
          },
        ],
      },
      "/api/trading/eod/value-factors": {
        market_date: marketDate,
        feature_version: "value_v1",
        summary: {
          entries: 1,
          requested_symbol: null,
          matched_symbols: ["005930"],
          missing_symbols: [],
          scored_count: 1,
          invalid_per_count: 0,
          missing_metric_count: 0,
        },
        items: [
          {
            symbol: "005930",
            name_ko: "Samsung Electronics",
            market: "KOSPI",
            market_date: marketDate,
            per: 11.2,
            pbr: 1.4,
            dividend_yield: 0.025,
            per_status: "available",
            per_rank: 42,
            pbr_rank: 38,
            dividend_yield_rank: 19,
            per_percentile: 0.76,
            pbr_percentile: 0.81,
            dividend_yield_percentile: 0.87,
            value_score: 0.83,
            value_rank: 9,
            value_percentile: 0.91,
            value_status: "scored",
            factor_payload: null,
            captured_at: null,
          },
        ],
      },
      "/api/trading/eod/advanced-value-factors": {
        market_date: marketDate,
        feature_version: "advanced_value_v1",
        summary: {
          entries: 1,
          requested_symbol: null,
          matched_symbols: ["005930"],
          missing_symbols: [],
          eligible_count: 1,
          watchlist_count: 0,
          ineligible_count: 0,
          insufficient_components_count: 0,
        },
        items: [
          {
            symbol: "005930",
            name_ko: "Samsung Electronics",
            market: "KOSPI",
            market_date: marketDate,
            market_cap_proxy: 420000000000,
            enterprise_value: 430000000000,
            ebitda: 51000000000,
            free_cash_flow: 19000000000,
            fcf_yield: 0.045,
            ev_to_ebitda: 8.4,
            fcf_yield_status: "available",
            ev_to_ebitda_status: "available",
            fcf_yield_valid_for_scoring: true,
            ev_to_ebitda_valid_for_scoring: true,
            fcf_yield_rank: 14,
            ev_to_ebitda_rank: 27,
            fcf_yield_percentile: 0.88,
            ev_to_ebitda_percentile: 0.74,
            advanced_value_score: 0.86,
            advanced_value_rank: 11,
            advanced_value_percentile: 0.9,
            advanced_value_components_used: 2,
            advanced_value_classification: "eligible",
            is_advanced_value_eligible: true,
            factor_payload: null,
            captured_at: null,
          },
        ],
      },
    };

    const body = bodyByPath[pathname];
    assert.ok(body, `Unexpected request path: ${pathname}`);

    return new Response(JSON.stringify(body), {
      headers: {
        "Content-Type": "application/json",
      },
      status: 200,
    });
  }) as typeof fetch;

  try {
    const workspace = await loadFactorScreeningWorkspace({
      marketDate,
      numberLocale: "en-US",
    });

    assert.equal(workspace.requestedMarketDate, marketDate);
    assert.equal(workspace.families.momentum.eligibleCount, 1);
    assert.equal(workspace.families.momentum.auditCount, 1);
    assert.equal(workspace.families.lowRisk.cautionCount, 1);
    assert.equal(workspace.families.beta.rows[0]?.statusLabel, "Eligible");
    assert.equal(workspace.families.value.rows[0]?.displayRankLabel, "#9");
    assert.match(
      workspace.families.value.rows[0]?.href ?? "",
      /\/dashboard\/symbol\/005930\?name=Samsung\+Electronics&market=KOSPI&marketDate=2026-04-23$/,
    );
    assert.equal(workspace.families.composite.state, "future");
    assert.equal(workspace.families.composite.totalRows, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test("market-date helpers and row filters preserve ranking intent without hiding audit states accidentally", () => {
  assert.equal(resolveFactorScreeningFamily("momentum"), "momentum");
  assert.equal(resolveFactorScreeningFamily("composite"), "composite");
  assert.equal(resolveFactorScreeningFamily("unknown"), null);

  assert.equal(
    resolveFactorScreeningMarketDate({
      today: {
        action_summary: null,
        eod_status: null,
        fundamentals: null,
        price: null,
        technical_analysis: null,
        trade_date: "2026-04-24",
      },
      latest: {
        price_trade_date: "2026-04-23",
        technical_market_date: "2026-04-23",
        action_market_date: "2026-04-23",
      },
    }),
    "2026-04-23",
  );

  assert.equal(
    getFactorScreeningMarketDateNote("2026-04-24", "2026-04-23"),
    "Requested 2026-04-24. Showing stored rows for 2026-04-23.",
  );

  const rows = [
    {
      companyName: "Samsung Electronics",
      displayRank: 3,
      displayRankLabel: "#3",
      family: "momentum",
      href: "/dashboard/symbol/005930",
      isEligible: true,
      market: "KOSPI",
      marketDate: "2026-04-23",
      metrics: [],
      note: "Eligible row",
      searchText: "samsung electronics 005930 eligible",
      sortRank: 3,
      sortScore: 0.97,
      status: { code: "eligible", tone: "positive" },
      statusBucket: "eligible",
      statusLabel: "Eligible",
      symbol: "005930",
    },
    {
      companyName: "NAVER",
      displayRank: 18,
      displayRankLabel: "#18",
      family: "momentum",
      href: "/dashboard/symbol/035420",
      isEligible: false,
      market: "KOSPI",
      marketDate: "2026-04-23",
      metrics: [],
      note: "Caution row",
      searchText: "naver 035420 watchlist",
      sortRank: 18,
      sortScore: 0.64,
      status: { code: "watchlist", tone: "info" },
      statusBucket: "caution",
      statusLabel: "Watchlist",
      symbol: "035420",
    },
    {
      companyName: "SK Hynix",
      displayRank: 99,
      displayRankLabel: "#99",
      family: "momentum",
      href: "/dashboard/symbol/000660",
      isEligible: false,
      market: "KOSPI",
      marketDate: "2026-04-23",
      metrics: [],
      note: "Audit row",
      searchText: "sk hynix 000660 insufficient history",
      sortRank: null,
      sortScore: null,
      status: { code: "insufficient_history", tone: "warning" },
      statusBucket: "audit",
      statusLabel: "Insufficient history",
      symbol: "000660",
    },
  ];

  assert.equal(
    filterFactorScreeningRows(rows, {
      eligibleOnly: true,
      includeAudit: true,
      includeCaution: true,
      query: "",
    }).length,
    1,
  );

  assert.deepEqual(
    filterFactorScreeningRows(rows, {
      eligibleOnly: false,
      includeAudit: false,
      includeCaution: true,
      query: "naver",
    }).map((row) => row.symbol),
    ["035420"],
  );

  assert.deepEqual(
    filterFactorScreeningRows(rows, {
      eligibleOnly: false,
      includeAudit: true,
      includeCaution: false,
      query: "",
    }).map((row) => row.symbol),
    ["005930", "000660"],
  );
});
