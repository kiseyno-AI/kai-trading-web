import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFactorScreeningPath,
  filterFactorScreeningRows,
  type FactorScreeningRow,
  getFactorScreeningMarketDateNote,
  loadFactorScreeningWorkspace,
  resolveFactorScreeningFamily,
  resolveFactorScreeningMarketDate,
  resolveFactorScreeningRouteStatus,
} from "./factor-screening";

const routeStatusMarketDate = "2026-04-23";

function buildRouteStatusDataset(
  state: "ready" | "error" | "future",
  totalRows: number,
  marketDate: string | null = routeStatusMarketDate,
) {
  return { marketDate, state, totalRows };
}

function buildRouteStatusWorkspace() {
  return {
    families: {
      advancedValue: buildRouteStatusDataset("ready", 1),
      beta: buildRouteStatusDataset("ready", 1),
      composite: buildRouteStatusDataset("future", 0),
      lowRisk: buildRouteStatusDataset("ready", 1),
      momentum: buildRouteStatusDataset("ready", 1),
      value: buildRouteStatusDataset("ready", 1),
    },
  } satisfies NonNullable<Parameters<typeof resolveFactorScreeningRouteStatus>[0]["workspace"]>;
}

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

test("resolveFactorScreeningRouteStatus only reports ready for a complete current-date row basis", () => {
  const readyWorkspace = buildRouteStatusWorkspace();
  const baseOptions = {
    activeMarketDate: routeStatusMarketDate,
    hasError: false,
    isBusy: false,
    selectedFamily: "momentum" as const,
    workspace: readyWorkspace,
  };

  assert.equal(resolveFactorScreeningRouteStatus(baseOptions), "ready");
  assert.equal(
    resolveFactorScreeningRouteStatus({ ...baseOptions, activeMarketDate: null, workspace: null }),
    "pending",
  );
  assert.equal(resolveFactorScreeningRouteStatus({ ...baseOptions, isBusy: true }), "pending");
  assert.equal(resolveFactorScreeningRouteStatus({ ...baseOptions, hasError: true }), "unavailable");

  const unavailableWorkspace = buildRouteStatusWorkspace();
  for (const family of ["momentum", "lowRisk", "beta", "value", "advancedValue"] as const) {
    unavailableWorkspace.families[family] = buildRouteStatusDataset("error", 0, null);
  }
  assert.equal(
    resolveFactorScreeningRouteStatus({ ...baseOptions, workspace: unavailableWorkspace }),
    "unavailable",
  );

  const partialWorkspace = buildRouteStatusWorkspace();
  partialWorkspace.families.beta = buildRouteStatusDataset("error", 0, null);
  assert.equal(resolveFactorScreeningRouteStatus({ ...baseOptions, workspace: partialWorkspace }), "partial");

  const staleWorkspace = buildRouteStatusWorkspace();
  staleWorkspace.families.value = buildRouteStatusDataset("ready", 1, "2026-04-22");
  assert.equal(resolveFactorScreeningRouteStatus({ ...baseOptions, workspace: staleWorkspace }), "partial");

  assert.equal(
    resolveFactorScreeningRouteStatus({ ...baseOptions, selectedFamily: "composite" }),
    "partial",
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
          entries: 4,
          requested_symbols: [],
          matched_symbols: ["005930", "000660", "043260", "010170"],
          missing_symbols: [],
          ranked_symbols: 4,
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
          {
            symbol: "043260",
            name_ko: "043260",
            company_name: "Seongho Electronics",
            market: "KOSDAQ",
            market_date: marketDate,
            close_price: 2250,
            ma_60: 2200,
            ma_120: 2150,
            momentum_12_1: 0.12,
            return_5d: 0.01,
            has_sufficient_history: true,
            is_price_above_ma120: true,
            is_ma60_above_ma120: false,
            is_recent_overheated: false,
            momentum_rank: 21,
            momentum_percentile: 0.66,
            is_momentum_eligible: false,
            factor_payload: null,
            captured_at: null,
          },
          {
            symbol: "010170",
            name_ko: "010170",
            market: "KOSPI",
            market_date: marketDate,
            close_price: 11500,
            ma_60: 11300,
            ma_120: 11000,
            momentum_12_1: 0.09,
            return_5d: 0.02,
            has_sufficient_history: true,
            is_price_above_ma120: true,
            is_ma60_above_ma120: false,
            is_recent_overheated: false,
            momentum_rank: 22,
            momentum_percentile: 0.64,
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
          entries: 2,
          requested_symbol: null,
          matched_symbols: ["005930", "035420"],
          missing_symbols: [],
          scored_count: 1,
          invalid_per_count: 1,
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
            pbr_status: "available",
            dividend_yield_status: "available",
            fcf_yield_status: "available",
            ev_to_ebitda_status: "available",
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
            unified_value_score: 0.88,
            unified_value_rank: 7,
            unified_value_percentile: 0.94,
            unified_value_status: "scored",
            quality_score: 0.78,
            quality_rank: 12,
            quality_percentile: 0.89,
            quality_status: "scored_partial",
            components_possible: 6,
            components_used: 4,
            is_quality_score_complete: false,
            quality_component_statuses: {
              roe: "scored",
              roa: "scored",
              gross_profit_to_assets: "missing_metric",
              operating_cash_flow_to_net_income: "invalid_net_income",
              debt_ratio: "scored",
              accruals_ratio: "scored",
            },
            factor_payload: null,
            captured_at: null,
          },
          {
            symbol: "035420",
            name_ko: "NAVER",
            market: "KOSPI",
            market_date: marketDate,
            per: -3.2,
            pbr: 1.1,
            dividend_yield: 0.01,
            per_status: "invalid_non_positive",
            pbr_status: "available",
            dividend_yield_status: "available",
            fcf_yield_status: "missing_metric",
            ev_to_ebitda_status: "insufficient_fundamentals",
            per_rank: null,
            pbr_rank: 47,
            dividend_yield_rank: 63,
            per_percentile: null,
            pbr_percentile: 0.7,
            dividend_yield_percentile: 0.54,
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
          },
        ],
      },
      "/api/trading/eod/advanced-value-factors": {
        market_date: marketDate,
        feature_version: "advanced_value_v1",
        summary: {
          entries: 2,
          requested_symbol: null,
          matched_symbols: ["005930", "035420"],
          missing_symbols: [],
          eligible_count: 1,
          watchlist_count: 1,
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
            unified_value_score: null,
            unified_value_rank: 1,
            unified_value_percentile: null,
            unified_value_status: "missing_metric",
            factor_payload: null,
            captured_at: null,
          },
          {
            symbol: "035420",
            name_ko: "NAVER",
            market: "KOSPI",
            market_date: marketDate,
            market_cap_proxy: 310000000000,
            enterprise_value: 325000000000,
            ebitda: 39000000000,
            free_cash_flow: 12000000000,
            fcf_yield: 0.039,
            ev_to_ebitda: 8.8,
            fcf_yield_status: "available",
            ev_to_ebitda_status: "available",
            fcf_yield_valid_for_scoring: true,
            ev_to_ebitda_valid_for_scoring: true,
            fcf_yield_rank: 5,
            ev_to_ebitda_rank: 12,
            fcf_yield_percentile: 0.95,
            ev_to_ebitda_percentile: 0.88,
            advanced_value_score: 0.9,
            advanced_value_rank: 2,
            advanced_value_percentile: 0.97,
            advanced_value_components_used: 2,
            advanced_value_classification: "watchlist",
            is_advanced_value_eligible: false,
            unified_value_score: 0.99,
            unified_value_rank: 99,
            unified_value_percentile: 0.99,
            unified_value_status: "scored",
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
    const companyNameFromAlternateField = workspace.families.momentum.rows.find((row) => row.symbol === "043260");
    assert.equal(companyNameFromAlternateField?.companyName, "Seongho Electronics");
    assert.match(
      companyNameFromAlternateField?.href ?? "",
      /\/dashboard\/symbol\/043260\?name=Seongho\+Electronics&market=KOSDAQ&marketDate=2026-04-23$/,
    );
    const symbolOnlyIdentityRow = workspace.families.momentum.rows.find((row) => row.symbol === "010170");
    assert.equal(symbolOnlyIdentityRow?.companyName, null);
    assert.match(symbolOnlyIdentityRow?.href ?? "", /\/dashboard\/symbol\/010170\?market=KOSPI&marketDate=2026-04-23$/);
    assert.equal(symbolOnlyIdentityRow?.href.includes("name="), false);
    assert.deepEqual(
      filterFactorScreeningRows(workspace.families.momentum.rows, {
        mode: "review",
        query: "010170",
      }).map((row) => row.symbol),
      ["010170"],
    );
    assert.equal(workspace.families.lowRisk.cautionCount, 1);
    assert.equal(workspace.families.beta.rows[0]?.statusLabel, "Eligible");
    assert.equal(workspace.families.value.rows[0]?.displayRankLabel, "#7");
    assert.deepEqual(
      workspace.families.value.rows[0]?.metrics.slice(0, 4).map((metric) => metric.label),
      ["Unified value score", "Unified percentile", "Unified rank", "Overall status"],
    );
    assert.match(workspace.families.value.rows[0]?.note ?? "", /PER: Available/);
    assert.match(workspace.families.value.rows[0]?.note ?? "", /EV \/ EBITDA: Available/);
    assert.equal(workspace.families.value.rows[0]?.quality?.calculationLabel, "Partial calculation");
    assert.deepEqual(
      workspace.families.value.rows[0]?.quality?.metrics.map((metric) => `${metric.label}:${metric.value}`),
      [
        "Quality score:78.0%",
        "Quality percentile:89.0%",
        "Quality rank:#12",
        "Score status:Partial",
        "Possible components:6",
        "Used components:4",
        "Calculation:Partial calculation",
      ],
    );
    assert.deepEqual(workspace.families.value.rows[0]?.quality?.componentHints, [
      "ROE: Scored",
      "ROA: Scored",
      "Gross profit / assets: Missing metric",
      "OCF / net income: Invalid net income",
      "Debt ratio: Scored",
      "Accruals: Scored",
    ]);
    assert.equal(workspace.families.value.rows[1]?.statusLabel, "PER excluded");
    assert.match(
      workspace.families.value.rows[1]?.note ?? "",
      /excluded from PER scoring because earnings were non-positive/,
    );
    assert.match(
      workspace.families.value.rows[0]?.href ?? "",
      /\/dashboard\/symbol\/005930\?name=Samsung\+Electronics&market=KOSPI&marketDate=2026-04-23$/,
    );
    assert.deepEqual(
      workspace.families.advancedValue.rows.map((row) => `${row.symbol}:${row.displayRankLabel}:${row.statusLabel}`),
      ["035420:#2:Watchlist", "005930:#11:Eligible"],
    );
    assert.deepEqual(
      filterFactorScreeningRows(workspace.families.advancedValue.rows, {
        mode: "eligible",
        query: "",
      }).map((row) => row.symbol),
      ["005930"],
    );
    assert.equal(workspace.families.advancedValue.cautionCount, 1);
    assert.equal(workspace.families.advancedValue.auditCount, 0);
    assert.deepEqual(
      workspace.families.advancedValue.rows[1]?.metrics.slice(0, 4).map((metric) => metric.label),
      ["Advanced component score", "Component pct", "Component rank", "FCF yield"],
    );
    assert.equal(
      workspace.families.advancedValue.rows[1]?.metrics.find((metric) => metric.label === "Unified rank")?.value,
      "#1",
    );
    assert.match(workspace.families.advancedValue.rows[1]?.note ?? "", /Unified valuation context: Missing metric/);
    assert.equal(workspace.families.composite.state, "future");
    assert.equal(workspace.families.composite.totalRows, 0);
    } finally {
      global.fetch = originalFetch;
    }
  });

test("loadFactorScreeningWorkspace keeps successful families when some factor families time out", async () => {
  const originalFetch = global.fetch;
  const marketDate = "2026-04-24";
  const timeoutMessage = "Timed out after 15.0s while loading /eod/beta-factors from trading-core.";

  global.fetch = (async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const pathname = new URL(url, "http://kai.local").pathname;

    if (pathname === "/api/trading/eod/momentum-factors") {
      return new Response(
        JSON.stringify({
          market_date: marketDate,
          feature_version: "momentum_v2",
          summary: {
            entries: 1,
            requested_symbols: [],
            matched_symbols: ["005930"],
            missing_symbols: [],
            ranked_symbols: 1,
            eligible_count: 1,
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
          ],
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    if (pathname === "/api/trading/eod/value-factors") {
      return new Response(
        JSON.stringify({
          market_date: marketDate,
          feature_version: "value_v1",
          summary: {
            entries: 1,
            requested_symbol: null,
            matched_symbols: ["035420"],
            missing_symbols: [],
            scored_count: 1,
            invalid_per_count: 0,
            missing_metric_count: 0,
          },
          items: [
            {
              symbol: "035420",
              name_ko: "NAVER",
              market: "KOSPI",
              market_date: marketDate,
              per: 9.8,
              pbr: 1.5,
              dividend_yield: 0.012,
              per_rank: 12,
              pbr_rank: 8,
              dividend_yield_rank: 4,
              per_percentile: 0.71,
              pbr_percentile: 0.62,
              dividend_yield_percentile: 0.74,
              value_score: 0.77,
              value_rank: 22,
              value_percentile: 0.77,
              value_status: "scored",
              quality_score: 0.7,
              quality_rank: 14,
              quality_percentile: 0.78,
              quality_status: "scored",
              components_possible: 6,
              components_used: 2,
              is_quality_score_complete: false,
              factor_payload: null,
              captured_at: null,
            },
          ],
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    if (pathname === "/api/trading/eod/advanced-value-factors") {
      return new Response(
        JSON.stringify({
          market_date: marketDate,
          feature_version: "advanced_value_v1",
          summary: {
            entries: 0,
            requested_symbol: null,
            matched_symbols: [],
            missing_symbols: [],
            eligible_count: 0,
            watchlist_count: 0,
            ineligible_count: 0,
            insufficient_components_count: 0,
          },
          items: [],
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    if (pathname === "/api/trading/eod/beta-factors") {
      return new Response(
        JSON.stringify({
          error: "Upstream request timed out",
          message: timeoutMessage,
        }),
        { headers: { "Content-Type": "application/json" }, status: 504 },
      );
    }

    if (pathname === "/api/trading/eod/low-risk-factors") {
      return new Response(
        JSON.stringify({
          error: "Upstream request timed out",
          message: timeoutMessage,
        }),
        { headers: { "Content-Type": "application/json" }, status: 504 },
      );
    }

    assert.fail(`Unexpected request path: ${pathname}`);
  }) as typeof fetch;

  try {
    const workspace = await loadFactorScreeningWorkspace({
      marketDate,
      numberLocale: "en-US",
    });

    assert.equal(workspace.families.momentum.state, "ready");
    assert.equal(workspace.families.value.state, "ready");
    assert.equal(workspace.families.advancedValue.state, "ready");
    assert.equal(workspace.families.beta.state, "error");
    assert.equal(workspace.families.lowRisk.state, "error");
    assert.equal(workspace.families.momentum.totalRows, 1);
    assert.equal(workspace.families.value.totalRows, 1);
    assert.equal(workspace.families.advancedValue.totalRows, 0);
    assert.equal(
      workspace.families.momentum.rows[0]?.symbol,
      "005930",
    );
    assert.equal(
      workspace.families.value.rows[0]?.symbol,
      "035420",
    );
    assert.equal(
      workspace.families.advancedValue.rows.length,
      0,
    );
    assert.equal(workspace.families.beta.error?.includes("HTTP"), false);
    assert.equal(workspace.families.lowRisk.error?.includes("HTTP"), false);
    assert.match(workspace.families.beta.error ?? "", /timed out/i);
    assert.match(workspace.families.lowRisk.error ?? "", /factor family data request timed out/i);
    assert.equal(workspace.families.beta.note, "Factor family data request timed out.");
    assert.equal(workspace.families.lowRisk.note, "Factor family data request timed out.");
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

  const rows: FactorScreeningRow[] = [
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
      quality: null,
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
      quality: null,
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
      quality: null,
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
      mode: "eligible",
      query: "",
    }).length,
    1,
  );

  assert.deepEqual(
    filterFactorScreeningRows(rows, {
      mode: "review",
      query: "naver",
    }).map((row) => row.symbol),
    ["035420"],
  );

  assert.deepEqual(
    filterFactorScreeningRows(rows, {
      mode: "all",
      query: "",
    }).map((row) => row.symbol),
    ["005930", "035420", "000660"],
  );

  assert.deepEqual(
    filterFactorScreeningRows(rows, {
      mode: "caution",
      query: "",
    }).map((row) => row.symbol),
    ["035420"],
  );

  assert.deepEqual(
    filterFactorScreeningRows(rows, {
      mode: "audit",
      query: "",
    }).map((row) => row.symbol),
    ["000660"],
  );
});
