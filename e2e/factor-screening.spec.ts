import { expect, test, type Page, type Route } from "@playwright/test";

const marketDate = "2026-04-23";

const factorPayloads = {
  momentum: {
    market_date: marketDate,
    feature_version: "momentum_v2",
    summary: {
      entries: 5,
      requested_symbols: [],
      matched_symbols: ["005930", "035420", "000660", "043260", "010170"],
      missing_symbols: [],
      ranked_symbols: 5,
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
        symbol: "035420",
        name_ko: "NAVER",
        market: "KOSPI",
        market_date: marketDate,
        close_price: 185000,
        ma_60: 176000,
        ma_120: 168000,
        momentum_12_1: 0.18,
        return_5d: 0.02,
        has_sufficient_history: true,
        is_price_above_ma120: true,
        is_ma60_above_ma120: true,
        is_recent_overheated: true,
        momentum_rank: 16,
        momentum_percentile: 0.72,
        is_momentum_eligible: false,
        factor_payload: null,
        captured_at: null,
      },
      {
        symbol: "000660",
        name_ko: "SK Hynix",
        market: "KOSPI",
        market_date: marketDate,
        close_price: 201000,
        ma_60: 194000,
        ma_120: 189000,
        momentum_12_1: 0.23,
        return_5d: 0.05,
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
  lowRisk: {
    market_date: marketDate,
    feature_version: "low_risk_v1",
    summary: {
      entries: 2,
      requested_symbol: null,
      matched_symbols: ["000660", "005930"],
      missing_symbols: [],
      eligible_count: 1,
      liquidity_floor_pass_count: 2,
      insufficient_history_count: 0,
    },
    items: [
      {
        symbol: "000660",
        name_ko: "SK Hynix",
        market: "KOSPI",
        market_date: marketDate,
        volatility_60d: 0.11,
        volatility_120d: 0.13,
        max_drawdown_120d: -0.15,
        avg_trading_value_20d: 145000000,
        volatility_60d_rank: 8,
        volatility_120d_rank: 9,
        max_drawdown_120d_rank: 5,
        liquidity_rank: 120,
        volatility_60d_percentile: 0.94,
        volatility_120d_percentile: 0.92,
        max_drawdown_120d_percentile: 0.91,
        liquidity_percentile: 0.87,
        passes_liquidity_floor: true,
        low_risk_score: 0.93,
        low_risk_classification: "eligible",
        is_low_risk_eligible: true,
        history_days_available: 250,
        factor_payload: null,
        captured_at: null,
      },
      {
        symbol: "005930",
        name_ko: "Samsung Electronics",
        market: "KOSPI",
        market_date: marketDate,
        volatility_60d: 0.16,
        volatility_120d: 0.18,
        max_drawdown_120d: -0.21,
        avg_trading_value_20d: 120000000,
        volatility_60d_rank: 45,
        volatility_120d_rank: 41,
        max_drawdown_120d_rank: 39,
        liquidity_rank: 140,
        volatility_60d_percentile: 0.72,
        volatility_120d_percentile: 0.74,
        max_drawdown_120d_percentile: 0.7,
        liquidity_percentile: 0.8,
        passes_liquidity_floor: true,
        low_risk_score: 0.66,
        low_risk_classification: "watchlist",
        is_low_risk_eligible: false,
        history_days_available: 250,
        factor_payload: null,
        captured_at: null,
      },
    ],
  },
  beta: {
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
        beta_60d: 0.74,
        beta_120d: 0.79,
        beta_60d_rank: 15,
        beta_120d_rank: 18,
        beta_60d_percentile: 0.84,
        beta_120d_percentile: 0.88,
        low_beta_score: 0.85,
        low_beta_classification: "eligible",
        is_low_beta_eligible: true,
        history_days_available: 240,
        factor_payload: null,
        captured_at: null,
      },
    ],
  },
  value: {
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
    ],
  },
  advancedValue: {
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
} as const;

type FactorPayloadFixtures = Record<keyof typeof factorPayloads, unknown>;
type FactorPayloadFixtureFamily = keyof FactorPayloadFixtures;

const emptyFactorPayloads = {
  momentum: {
    ...factorPayloads.momentum,
    summary: {
      ...factorPayloads.momentum.summary,
      entries: 0,
      eligible_symbols: 0,
      matched_symbols: [],
      ranked_symbols: 0,
    },
    items: [],
  },
  lowRisk: {
    ...factorPayloads.lowRisk,
    summary: {
      ...factorPayloads.lowRisk.summary,
      eligible_count: 0,
      entries: 0,
      insufficient_history_count: 0,
      liquidity_floor_pass_count: 0,
      matched_symbols: [],
    },
    items: [],
  },
  beta: {
    ...factorPayloads.beta,
    summary: {
      ...factorPayloads.beta.summary,
      eligible_count: 0,
      entries: 0,
      insufficient_history_count: 0,
      matched_symbols: [],
      watchlist_count: 0,
    },
    items: [],
  },
  value: {
    ...factorPayloads.value,
    summary: {
      ...factorPayloads.value.summary,
      entries: 0,
      invalid_per_count: 0,
      matched_symbols: [],
      missing_metric_count: 0,
      scored_count: 0,
    },
    items: [],
  },
  advancedValue: {
    ...factorPayloads.advancedValue,
    summary: {
      ...factorPayloads.advancedValue.summary,
      eligible_count: 0,
      entries: 0,
      ineligible_count: 0,
      insufficient_components_count: 0,
      matched_symbols: [],
      watchlist_count: 0,
    },
    items: [],
  },
} satisfies FactorPayloadFixtures;

const eligibleMomentumOnlyPayloads = {
  ...factorPayloads,
  momentum: {
    ...factorPayloads.momentum,
    summary: {
      ...factorPayloads.momentum.summary,
      entries: 1,
      eligible_symbols: 1,
      matched_symbols: ["005930"],
      ranked_symbols: 1,
    },
    items: [factorPayloads.momentum.items[0]],
  },
} satisfies FactorPayloadFixtures;

const symbolMeta = {
  "005930": {
    market: "KOSPI",
    name: "Samsung Electronics",
    standardCode: "KR7005930003",
  },
  "035420": {
    market: "KOSPI",
    name: "NAVER",
    standardCode: "KR7035420009",
  },
  "000660": {
    market: "KOSPI",
    name: "SK Hynix",
    standardCode: "KR7000660001",
  },
  "043260": {
    market: "KOSDAQ",
    name: "Seongho Electronics",
    standardCode: "KR7043260000",
  },
  "010170": {
    market: "KOSPI",
    name: "대한광통신",
    standardCode: "KR7010170008",
  },
} as const;

function buildQuote(symbol: keyof typeof symbolMeta) {
  return {
    symbol,
    company_name: symbolMeta[symbol].name,
    price: symbol === "005930" ? 71000 : symbol === "035420" ? 185000 : 201000,
    change: symbol === "005930" ? 500 : symbol === "035420" ? -2000 : 3000,
    change_pct: symbol === "005930" ? 0.71 : symbol === "035420" ? -1.07 : 1.52,
    volume: 1000000,
    turnover: 71000000000,
    market_state: "OPEN",
    source: "kis_live",
    fallback: false,
    is_live: true,
    available: true,
    trade_date: marketDate,
  };
}

function isSymbolMetaKey(symbol: string): symbol is keyof typeof symbolMeta {
  return symbol in symbolMeta;
}

async function stubFactorScreeningApis(
  page: Page,
  payloads: FactorPayloadFixtures = factorPayloads,
  unavailableFamilies: readonly FactorPayloadFixtureFamily[] = [],
) {
  const fulfillFamily = async (route: Route, family: FactorPayloadFixtureFamily) => {
    if (unavailableFamilies.includes(family)) {
      await route.fulfill({
        json: { error: "Upstream request timed out" },
        status: 504,
      });
      return;
    }

    await route.fulfill({ json: payloads[family] });
  };

  await page.route("**/api/trading/eod/freshness", async (route) => {
    await route.fulfill({
      json: {
        today: {
          trade_date: marketDate,
          eod_status: "completed",
          symbols_total: 3,
          symbols_succeeded: 3,
          symbols_failed: 0,
        },
        latest: {
          price_trade_date: marketDate,
          technical_market_date: marketDate,
          action_market_date: marketDate,
        },
        technical: {
          success: true,
          latest_date: marketDate,
        },
      },
    });
  });

  await page.route("**/api/trading/eod/momentum-factors?**", async (route) => {
    await fulfillFamily(route, "momentum");
  });
  await page.route("**/api/trading/eod/low-risk-factors?**", async (route) => {
    await fulfillFamily(route, "lowRisk");
  });
  await page.route("**/api/trading/eod/beta-factors?**", async (route) => {
    await fulfillFamily(route, "beta");
  });
  await page.route("**/api/trading/eod/value-factors?**", async (route) => {
    await fulfillFamily(route, "value");
  });
  await page.route("**/api/trading/eod/advanced-value-factors?**", async (route) => {
    await fulfillFamily(route, "advancedValue");
  });

  await page.route("**/api/trading/market/status", async (route) => {
    await route.fulfill({
      json: {
        state: "OPEN",
        is_open: true,
        server_time: "2026-04-23T09:20:00+09:00",
      },
    });
  });

  await page.route("**/api/trading/quotes/*", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const symbol = pathname.split("/").at(-1) ?? "";

    if (!isSymbolMetaKey(symbol)) {
      await route.fulfill({
        json: {
          market_state: "OPEN",
          as_of: "2026-04-23T09:20:00+09:00",
          items: [buildQuote("005930"), buildQuote("000660")],
        },
      });
      return;
    }

    await route.fulfill({
      json: buildQuote(symbol),
    });
  });

  await page.route("**/api/trading/scanner/tracked-symbols", async (route) => {
    await route.fulfill({
      json: {
        tracked_symbols: [],
        count: 0,
        last_updated_at: null,
      },
    });
  });

  await page.route("**/api/trading/scanner/realtime-trending?**", async (route) => {
    await route.fulfill({
      json: {
        status: "ok",
        source: "kis",
        as_of: "2026-04-23T09:20:00+09:00",
        market: "KRX",
        summary: {
          item_count: 0,
        },
        items: [],
      },
    });
  });

  await page.route("**/api/trading/symbols/favorites", async (route) => {
    await route.fulfill({
      json: {
        count: 0,
        items: [],
      },
    });
  });

  await page.route("**/api/trading/symbols/search?**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q")?.toUpperCase() ?? "";
    const item = (Object.entries(symbolMeta) as Array<[keyof typeof symbolMeta, (typeof symbolMeta)[keyof typeof symbolMeta]]>)
      .find(([symbol]) => symbol === query);

    await route.fulfill({
      json: {
        query,
        count: item ? 1 : 0,
        items: item
          ? [
              {
                symbol: item[0],
                standard_code: item[1].standardCode,
                name_ko: item[1].name,
                market: item[1].market,
              },
            ]
          : [],
      },
    });
  });

  await page.route("**/api/trading/agent-context/symbol-day?**", async (route) => {
    const symbol = (new URL(route.request().url()).searchParams.get("symbols") ?? "005930") as keyof typeof symbolMeta;

    await route.fulfill({
      json: {
        request: {
          market_date: marketDate,
          symbols: [symbol],
          fs_div: null,
          fs_label: null,
          disclosures_limit: 4,
        },
        summary: {
          requested_symbol_count: 1,
          matched_symbol_count: 1,
          technical_snapshot_count: 0,
          action_summary_count: 0,
          fundamentals_count: 0,
          recent_disclosure_symbol_count: 0,
          missing_symbols: [],
        },
        items: [
          {
            symbol,
            market_date: marketDate,
            company: {
              symbol,
              name_ko: symbolMeta[symbol].name,
              market: symbolMeta[symbol].market,
              instrument_type: "stock",
              standard_code: symbolMeta[symbol].standardCode,
              source: "test",
              is_active: true,
              last_refreshed_at: null,
              dart: {
                corp_code: "00126380",
                corp_name: symbolMeta[symbol].name,
              },
            },
            technical_snapshot: null,
            action_summary: null,
            fundamentals: {
              latest_snapshot: null,
              history_summary: {
                entries: 0,
                latest_receipt_date: null,
                latest_period_end_date: null,
                available_business_years: [],
                recent_periods: [],
              },
            },
            recent_disclosures: {
              count: 0,
              items: [],
            },
            availability: {
              company: true,
              technical_snapshot: false,
              action_summary: false,
              fundamentals: false,
              recent_disclosures: false,
            },
          },
        ],
      },
    });
  });

  await page.route("**/api/trading/eod/technical-snapshots?**", async (route) => {
    await route.fulfill({
      json: {
        market_date: marketDate,
        items: [],
      },
    });
  });

  await page.route("**/api/trading/eod/action-summaries?**", async (route) => {
    await route.fulfill({
      json: {
        market_date: marketDate,
        items: [],
      },
    });
  });

  await page.route("**/api/trading/disclosures/dart/fundamentals/history?**", async (route) => {
    await route.fulfill({
      json: {
        request: {
          symbols: [],
          start_date: "2021-04-23",
          end_date: marketDate,
          fs_div: null,
        },
        companies: [],
      },
    });
  });

  await page.route("**/api/trading/symbols/*/price-bars?**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const symbol = pathname.split("/").at(-2) as keyof typeof symbolMeta;

    await route.fulfill({
      json: {
        symbol,
        count: 3,
        start_date: "2026-04-21",
        end_date: marketDate,
        requested_start_date: "2025-04-23",
        requested_end_date: marketDate,
        items: [
          {
            trade_date: "2026-04-21",
            open_price: 70000,
            high_price: 71000,
            low_price: 69500,
            close_price: 70500,
            volume: 1000000,
            turnover: 70500000000,
            source: "test",
            captured_at: "2026-04-21T16:00:00+09:00",
          },
          {
            trade_date: "2026-04-22",
            open_price: 70600,
            high_price: 71600,
            low_price: 70200,
            close_price: 70900,
            volume: 1100000,
            turnover: 77990000000,
            source: "test",
            captured_at: "2026-04-22T16:00:00+09:00",
          },
          {
            trade_date: marketDate,
            open_price: 70900,
            high_price: 71500,
            low_price: 70700,
            close_price: symbol === "005930" ? 71000 : symbol === "035420" ? 185000 : 201000,
            volume: 1200000,
            turnover: 85200000000,
            source: "test",
            captured_at: "2026-04-23T16:00:00+09:00",
          },
        ],
      },
    });
  });

  await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
    await route.fulfill({
      json: {
        market_date: marketDate,
        summary: {
          entries: 1,
          requested_symbol: null,
          matched_symbols: ["005930"],
          missing_symbols: [],
          passed_count: 1,
          not_passed_count: 0,
        },
        items: [
          {
            symbol: "005930",
            market_date: marketDate,
            passed_filter: true,
            piotroski_score: 8,
            passes_piotroski_score: true,
            captured_at: null,
          },
        ],
      },
    });
  });
}

test("factor screening supports switching, eligibility filtering, composite placeholder, and symbol drill-in", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await stubFactorScreeningApis(page);

  await page.goto("/markets/factors");

  const activeFilterValue = page.getByTestId("factor-active-filter-value");

  await expect(page.getByRole("heading", { name: /Factor ranking workspace/i })).toBeVisible();
  await expect(page.getByText("Factors ready", { exact: true }).first()).toBeVisible();
  const desktopNav = page.getByRole("navigation", { name: /Primary desktop/i });
  await expect(desktopNav.getByRole("link")).toHaveCount(4);
  await expect(desktopNav.getByRole("link", { name: "Explore", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(desktopNav.getByRole("link", { name: "Markets", exact: true })).toHaveCount(0);
  await expect(desktopNav.getByRole("link", { name: "Bots", exact: true })).toHaveCount(0);
  await expect(page.getByText("2026.04.23").first()).toBeVisible();
  await expect(activeFilterValue).toHaveText("Review set");
  await expect(page.getByRole("link", { name: /Open Samsung Electronics/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open NAVER/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open Seongho Electronics \(043260\)/i })).toBeVisible();
  const symbolOnlyRow = page.getByRole("link", { name: /Open 010170 \(name unavailable\)/i });
  await expect(symbolOnlyRow).toBeVisible();
  await expect(symbolOnlyRow).toContainText("Name unavailable");
  await expect(page.getByRole("link", { name: /Open SK Hynix/i })).toHaveCount(0);
  await expect(page.getByText("043260 (043260)")).toHaveCount(0);
  await expect(page.getByText("010170 (010170)")).toHaveCount(0);

  await page.getByRole("radio", { name: /Eligible/i }).click();
  await expect(activeFilterValue).toHaveText("Eligible");
  await expect(page.getByRole("link", { name: /Open NAVER/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Open SK Hynix/i })).toHaveCount(0);

  await page.getByRole("radio", { name: /Caution/i }).click();
  await expect(activeFilterValue).toHaveText("Caution");
  await expect(page.getByRole("link", { name: /Open Samsung Electronics/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Open NAVER/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open SK Hynix/i })).toHaveCount(0);

  await page.getByRole("radio", { name: /Audit/i }).click();
  await expect(activeFilterValue).toHaveText("Audit");
  await expect(page.getByRole("link", { name: /Open Samsung Electronics/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Open NAVER/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Open SK Hynix/i })).toBeVisible();

  await page.getByRole("radio", { name: /All/i }).click();
  await expect(activeFilterValue).toHaveText("All");
  await expect(page.getByRole("link", { name: /Open Samsung Electronics/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open NAVER/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open SK Hynix/i })).toBeVisible();

  await page.getByRole("button", { name: /Low risk/i }).click();
  await expect(page.getByText("Low-risk score").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Open SK Hynix/i })).toBeVisible();

  await page.getByRole("button", { name: /Unified value/i }).click();
  await expect(page.getByText("Unified value score").first()).toBeVisible();
  await expect(page.getByText("Unified rank").first()).toBeVisible();
  await expect(page.getByText("Overall status").first()).toBeVisible();
  await expect(page.getByText("Quality score").first()).toBeVisible();
  await expect(page.getByText("Partial calculation").first()).toBeVisible();
  await expect(page.getByText("4 used / 6 possible").first()).toBeVisible();
  await expect(page.getByText("OCF / net income: Invalid net income").first()).toBeVisible();
  await expect(page.getByText(/EV \/ EBITDA: Available/i)).toBeVisible();

  await page.getByRole("button", { name: /Composite/i }).click();
  await expect(page.getByText(/Composite ranking slot reserved/i)).toBeVisible();

  await page.getByRole("button", { name: /Low risk/i }).click();
  await page.getByRole("link", { name: /Open SK Hynix/i }).click();

  await expect(page).toHaveURL(
    /\/dashboard\/symbol\/000660\?name=SK\+Hynix&market=KOSPI&marketDate=2026-04-23/,
  );
  await expect(page.getByRole("heading", { name: /SK Hynix/i })).toBeVisible();
});

test("factor screening active filter does not report caution for eligible-only momentum results", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 750 });
  await stubFactorScreeningApis(page, eligibleMomentumOnlyPayloads);

  await page.goto("/markets/factors");
  await page.getByRole("button", { name: /Korean/i }).first().click();

  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.getByRole("heading", { name: /팩터 순위 워크스페이스/i })).toBeVisible();
  await expect(page.getByText("적격: 1").first()).toBeVisible();
  await expect(page.getByText("주의: 0").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Samsung Electronics \(005930\) 상세 열기/i })).toBeVisible();
  await expect(page.getByTestId("factor-active-filter-value")).toHaveText("검토 세트");
  await expect(page.getByTestId("factor-active-filter-value")).not.toHaveText("주의");
  await expect(
    page.getByText("12-1 모멘텀, 이동평균선 추세 확인 및 단기 과열 방지", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("선택한 시장일자의 12-1 모멘텀 순위와 추세 게이트 상태입니다.", {
      exact: true,
    }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Samsung Electronics \(005930\) 상세 열기/i }),
  ).toContainText("추세 확인을 통과했고 최근 단기 과열 방지 조건도 충족했습니다.");
  await expect(
    page.getByText("Trend confirmation passed and the recent overheat guard stayed clear.", {
      exact: true,
    }),
  ).toHaveCount(0);
});

test("factor screening removes loading copy after empty family results resolve", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await stubFactorScreeningApis(page, emptyFactorPayloads);

  await page.goto(`/markets/factors?marketDate=${marketDate}`);

  await expect(page.getByRole("heading", { name: /Factor ranking workspace/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Momentum/i })).toContainText("Ready");
  await expect(page.getByRole("button", { name: /Low risk/i })).toContainText("Ready");
  await expect(page.getByText("Factor data unavailable", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Factors ready", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Core returned no rows for this factor family and market date.")).toBeVisible();
  await expect(page.getByText("Loading factor ranking rows...")).toHaveCount(0);
});

test("factor screening reports partial status and names timed-out families", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFactorScreeningApis(page, factorPayloads, ["lowRisk", "beta", "value", "advancedValue"]);

  await page.goto("/markets/factors");

  await expect(page.getByTestId("factor-aggregate-status")).toHaveText("Factor data partial");
  await expect(page.getByTestId("factor-unavailable-families")).toHaveText(
    "Unavailable families: Low risk, Beta, Unified value, Advanced value components.",
  );
  await expect(page.locator('[data-app-chrome-topbar="fixed"]')).toContainText("Factor data partial");
  await expect(page.locator("aside").filter({ hasText: "Market status" })).toContainText("Factor data partial");
  await expect(page.getByText("Factors ready", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Composite-ready layout", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Factor family data request timed out.", { exact: true })).toHaveCount(4);

  await page.getByRole("button", { name: /Korean/i }).first().click();

  await expect(page.getByTestId("factor-aggregate-status")).toHaveText("팩터 데이터 일부 제공");
  await expect(page.getByTestId("factor-unavailable-families")).toHaveText(
    "사용 불가 패밀리: Low risk, Beta, Unified value, Advanced value components.",
  );
  await expect(page.getByText("팩터 준비 완료", { exact: true })).toHaveCount(0);
  await expect(page.getByText("합성 준비 완료 레이아웃", { exact: true })).toHaveCount(0);
  await expect(page.getByText("팩터 패밀리 데이터 요청 시간이 초과되었습니다.", { exact: true })).toHaveCount(4);
  await expect(page.getByText("Factor family data request timed out.", { exact: true })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });

  await expect(page.getByTestId("factor-aggregate-status")).toBeVisible();
  await expect(page.locator('[data-app-chrome-topbar="fixed"]')).toContainText("팩터 데이터 일부 제공");
  const viewportMetrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewportMetrics.scrollWidth).toBeLessThanOrEqual(viewportMetrics.clientWidth + 1);
});

test("factor screening route chrome stays unavailable when market-date resolution returns HTTP 504", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route("**/api/trading/eod/freshness", async (route) => {
    await route.fulfill({
      json: {
        error: "Upstream request timed out",
        message: "HTTP 504",
      },
      status: 504,
    });
  });

  await page.goto("/markets/factors");

  await expect(page.getByRole("heading", { name: /Factor ranking workspace/i })).toBeVisible();
  await expect(page.getByText("Factor data unavailable", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Factors ready", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Factor screening is unavailable right now.")).toBeVisible();
  await expect(page.getByText("HTTP 504", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Korean/i }).first().click();

  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.getByText("팩터 데이터 사용 불가", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("팩터 준비 완료", { exact: true })).toHaveCount(0);
  await expect(page.getByText("팩터 데이터 요청 시간이 초과되었습니다.", { exact: true })).toBeVisible();
  await expect(page.getByText("HTTP 504", { exact: true })).toHaveCount(0);
});

test("factor screening stays usable on mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubFactorScreeningApis(page);

  await page.goto("/markets/factors");

  await expect(page.getByRole("heading", { name: /Factor ranking workspace/i })).toBeVisible();
  const primaryNav = page.getByRole("navigation", { name: /^Primary$/i });
  await expect(primaryNav.getByRole("link")).toHaveCount(4);
  await expect(primaryNav.getByRole("link", { name: "Explore", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(primaryNav.getByRole("link", { name: "Markets", exact: true })).toHaveCount(0);
  await expect(primaryNav.getByRole("link", { name: "Bots", exact: true })).toHaveCount(0);
  await expect(page.getByText("2026.04.23").first()).toBeVisible();

  const viewportMetrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(viewportMetrics.scrollWidth).toBeLessThanOrEqual(viewportMetrics.clientWidth + 1);

  await page.getByRole("button", { name: /Low risk/i }).click();
  await expect(page.getByText("Low-risk score").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Open SK Hynix/i })).toBeVisible();

  await page.getByRole("button", { name: /Unified value/i }).click();
  await expect(page.getByText("Quality score").first()).toBeVisible();
  await expect(page.getByText("Partial calculation").first()).toBeVisible();
  await expect(page.getByText("4 used / 6 possible").first()).toBeVisible();

  await page.getByRole("button", { name: /Composite/i }).click();
  await expect(page.getByText(/Composite ranking slot reserved/i)).toBeVisible();

  await page.getByRole("button", { name: /Low risk/i }).click();
  await page.getByRole("link", { name: /Open SK Hynix/i }).click();

  await expect(page).toHaveURL(
    /\/dashboard\/symbol\/000660\?name=SK\+Hynix&market=KOSPI&marketDate=2026-04-23/,
  );
  await expect(page.getByRole("heading", { name: /SK Hynix/i })).toBeVisible();

  await expect(page.getByRole("link", { name: "My Symbols", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Explore", exact: true })).toBeVisible();
});
